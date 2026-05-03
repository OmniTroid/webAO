import { client } from "../client";
import { sender } from "../client/sender";

interface IceServerEntry {
  urls: string | string[];
  username?: string;
  credential?: string;
}

interface VoiceCaps {
  enabled: boolean;
  pttOnly: boolean;
  maxPeers: number;
  iceServers: IceServerEntry[];
  forceRelay: boolean;
}

interface SignalMessage {
  kind: "offer" | "answer" | "ice";
  data: any;
}

let caps: VoiceCaps = {
  enabled: false,
  pttOnly: true,
  maxPeers: 0,
  iceServers: [],
  forceRelay: true,
};

let localStream: MediaStream | null = null;
let inVoice = false;
let listenOnly = false;
let vcMuted = false;
let pttActive = false;
let localOpenMic = false;
let currentDeviceId: string | null = null;
let outputVolume = 1;

const peers = new Map<number, RTCPeerConnection>();
const remoteAudio = new Map<number, HTMLAudioElement>();
const speakingPeers = new Map<number, string>();
const speakingListeners: Array<() => void> = [];
const capsListeners: Array<() => void> = [];
const pendingCandidates = new Map<number, RTCIceCandidateInit[]>();

function notifyCapsUpdated() {
  for (let i = 0; i < capsListeners.length; i++) {
    try {
      capsListeners[i]();
    } catch (e) {
      console.error(e);
    }
  }
  try {
    if (typeof window !== "undefined" && typeof CustomEvent === "function") {
      window.dispatchEvent(new CustomEvent("voice-caps-updated"));
    }
  } catch (_e) {
    // CustomEvent may be unavailable in unusual environments
  }
}

export function onCapsChange(listener: () => void): () => void {
  capsListeners.push(listener);
  return () => {
    const idx = capsListeners.indexOf(listener);
    if (idx >= 0) capsListeners.splice(idx, 1);
  };
}

function notifySpeakingListeners() {
  for (let i = 0; i < speakingListeners.length; i++) {
    try {
      speakingListeners[i]();
    } catch (e) {
      console.error(e);
    }
  }
}

function encodeSignal(msg: SignalMessage): string {
  return btoa(unescape(encodeURIComponent(JSON.stringify(msg))));
}

function decodeSignal(b64: string): SignalMessage | null {
  try {
    return JSON.parse(decodeURIComponent(escape(atob(b64))));
  } catch (e) {
    console.warn("Failed to decode voice signalling blob", e);
    return null;
  }
}

function sendSignal(toUid: number, msg: SignalMessage) {
  sender.sendServer(`VC_SIG#${toUid}#${encodeSignal(msg)}#%`);
}

function attachRemoteTrack(uid: number, stream: MediaStream) {
  let audio = remoteAudio.get(uid);
  if (!audio) {
    audio = document.createElement("audio");
    audio.autoplay = true;
    audio.setAttribute("playsinline", "true");
    audio.style.display = "none";
    document.body.appendChild(audio);
    remoteAudio.set(uid, audio);
  }
  audio.srcObject = stream;
  audio.volume = vcMuted ? 0 : outputVolume;
  const playPromise = audio.play();
  if (playPromise && typeof (playPromise as any).catch === "function") {
    (playPromise as Promise<void>).catch(() => {
      // autoplay may be blocked until user gesture; ignore
    });
  }
}

function detachRemoteTrack(uid: number) {
  const audio = remoteAudio.get(uid);
  if (audio) {
    audio.srcObject = null;
    if (audio.parentNode) audio.parentNode.removeChild(audio);
    remoteAudio.delete(uid);
  }
}

function buildPeerConnection(remoteUid: number): RTCPeerConnection {
  const pc = new RTCPeerConnection({
    iceServers: caps.iceServers as RTCIceServer[],
    iceTransportPolicy: caps.forceRelay ? "relay" : "all",
  });

  pc.onicecandidate = (ev) => {
    if (ev.candidate) {
      sendSignal(remoteUid, { kind: "ice", data: ev.candidate.toJSON() });
    }
  };

  pc.ontrack = (ev) => {
    const stream = ev.streams && ev.streams[0] ? ev.streams[0] : new MediaStream([ev.track]);
    attachRemoteTrack(remoteUid, stream);
  };

  pc.oniceconnectionstatechange = () => {
    if (pc.iceConnectionState === "failed") {
      // If we were the offerer, restart ICE to recover the connection.
      if (pc.localDescription && pc.localDescription.type === "offer") {
        pc.createOffer({ iceRestart: true })
          .then((offer) => pc.setLocalDescription(offer))
          .then(() => {
            if (pc.localDescription) {
              sendSignal(remoteUid, { kind: "offer", data: pc.localDescription });
            }
          })
          .catch((e) => console.warn(`ICE restart failed for peer ${remoteUid}`, e));
      }
    }
  };

  if (localStream) {
    const tracks = localStream.getAudioTracks();
    for (let i = 0; i < tracks.length; i++) {
      pc.addTrack(tracks[i], localStream);
    }
  }

  peers.set(remoteUid, pc);
  return pc;
}

function getOrCreatePeer(remoteUid: number): RTCPeerConnection {
  const existing = peers.get(remoteUid);
  if (existing) return existing;
  return buildPeerConnection(remoteUid);
}

function applyPTTToTracks() {
  if (!localStream) return;
  const enable = localOpenMic || (caps.pttOnly ? pttActive : true);
  const tracks = localStream.getAudioTracks();
  for (let i = 0; i < tracks.length; i++) {
    tracks[i].enabled = enable;
  }
}

function buildAudioConstraints(): MediaTrackConstraints {
  const constraints: MediaTrackConstraints = {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  };
  if (currentDeviceId) {
    constraints.deviceId = { exact: currentDeviceId };
  }
  return constraints;
}

async function ensureLocalStream(): Promise<MediaStream> {
  if (localStream) return localStream;
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: buildAudioConstraints(),
  });
  localStream = stream;
  applyPTTToTracks();
  return stream;
}

export async function setInputDevice(deviceId: string): Promise<void> {
  const normalized = deviceId || null;
  if (normalized === currentDeviceId) return;
  currentDeviceId = normalized;
  if (!localStream) return;
  let newStream: MediaStream;
  try {
    newStream = await navigator.mediaDevices.getUserMedia({
      audio: buildAudioConstraints(),
    });
  } catch (e) {
    console.error("Failed to switch microphone", e);
    throw e;
  }
  const newTrack = newStream.getAudioTracks()[0];
  if (!newTrack) return;
  peers.forEach((pc) => {
    const senders = pc.getSenders();
    for (let i = 0; i < senders.length; i++) {
      const s = senders[i];
      if (s.track && s.track.kind === "audio") {
        s.replaceTrack(newTrack).catch((err) =>
          console.warn("replaceTrack failed", err),
        );
      }
    }
  });
  const oldTracks = localStream.getTracks();
  for (let i = 0; i < oldTracks.length; i++) {
    try {
      oldTracks[i].stop();
    } catch (_) {
      // ignore
    }
  }
  localStream = newStream;
  applyPTTToTracks();
}

export function getInputDeviceId(): string | null {
  return currentDeviceId;
}

export function setOutputVolume(volume: number): void {
  const clamped = Math.max(0, Math.min(1, volume));
  outputVolume = clamped;
  if (!vcMuted) {
    remoteAudio.forEach((audio) => {
      audio.volume = clamped;
    });
  }
}

export function isVCMuted(): boolean {
  return vcMuted;
}

export function setVCMuted(muted: boolean): void {
  vcMuted = muted;
  const vol = muted ? 0 : outputVolume;
  remoteAudio.forEach((audio) => {
    audio.volume = vol;
  });
}

export function getOutputVolume(): number {
  return outputVolume;
}

function teardownPeer(uid: number) {
  const pc = peers.get(uid);
  if (pc) {
    try {
      pc.close();
    } catch (_e) {
      // ignore
    }
    peers.delete(uid);
  }
  pendingCandidates.delete(uid);
  detachRemoteTrack(uid);
  if (speakingPeers.delete(uid)) {
    notifySpeakingListeners();
  }
}

function teardownAll() {
  const uids: number[] = [];
  peers.forEach((_pc, uid) => uids.push(uid));
  for (let i = 0; i < uids.length; i++) {
    teardownPeer(uids[i]);
  }
  if (localStream) {
    const tracks = localStream.getTracks();
    for (let i = 0; i < tracks.length; i++) {
      try {
        tracks[i].stop();
      } catch (_e) {
        // ignore
      }
    }
    localStream = null;
  }
  inVoice = false;
  listenOnly = false;
  pttActive = false;
  if (speakingPeers.size > 0) {
    speakingPeers.clear();
    notifySpeakingListeners();
  }
}

export function applyVoiceCaps(
  enabled: boolean,
  pttOnly: boolean,
  maxPeers: number,
  iceJson: string,
  forceRelay = true,
) {
  let iceServers: IceServerEntry[] = [];
  if (iceJson) {
    try {
      const parsed = JSON.parse(iceJson);
      if (Array.isArray(parsed)) iceServers = parsed;
    } catch (e) {
      console.warn("Failed to parse VC_CAPS ice_json", e);
    }
  }
  caps = { enabled, pttOnly, maxPeers, iceServers, forceRelay };
  console.debug(
    `voice: caps applied enabled=${enabled} ptt=${pttOnly} maxPeers=${maxPeers} ice=${iceServers.length} relay=${forceRelay}`,
  );
  if (!enabled && inVoice) {
    teardownAll();
  }
  notifyCapsUpdated();
}

export function isVoiceAvailable(): boolean {
  return caps.enabled;
}

export function isPTTOnly(): boolean {
  return caps.pttOnly;
}

export function isInVoice(): boolean {
  return inVoice;
}

export async function joinVoiceListenOnly(): Promise<void> {
  if (!caps.enabled || inVoice) return;
  inVoice = true;
  listenOnly = true;
  sender.sendServer(`VC_JOIN#${client.playerID}#%`);
}

export function isListenOnly(): boolean {
  return listenOnly;
}

export async function joinVoice(): Promise<void> {
  if (!caps.enabled) return;
  if (inVoice && !listenOnly) return;

  if (listenOnly) {
    // Leave listen-only first so we can rejoin with mic
    sender.sendServer(`VC_LEAVE#${client.playerID}#%`);
    teardownAll();
  }

  try {
    await ensureLocalStream();
  } catch (e) {
    console.error("Microphone permission denied or unavailable", e);
    throw e;
  }
  inVoice = true;
  listenOnly = false;
  sender.sendServer(`VC_JOIN#${client.playerID}#%`);
}

export function leaveVoice(): void {
  if (!inVoice) return;
  sender.sendServer(`VC_LEAVE#${client.playerID}#%`);
  teardownAll();
  notifyCapsUpdated();
}

export function setPTT(active: boolean): void {
  if (!inVoice) return;
  if (pttActive === active) return;
  pttActive = active;
  applyPTTToTracks();
  sender.sendServer(`VC_SPEAK#${client.playerID}#${active ? 1 : 0}#%`);
  notifySpeakingListeners();
}

export function handlePeerJoined(uid: number): void {
  if (!inVoice || uid === client.playerID) return;
  getOrCreatePeer(uid);
}

export function handlePeerLeft(uid: number): void {
  teardownPeer(uid);
}

export async function handleInitialPeers(uids: number[]): Promise<void> {
  if (!inVoice) return;
  for (let i = 0; i < uids.length; i++) {
    const uid = uids[i];
    if (uid === client.playerID) continue;
    if (caps.maxPeers > 0 && peers.size >= caps.maxPeers) break;
    const pc = getOrCreatePeer(uid);
    try {
      const offer = await pc.createOffer({ offerToReceiveAudio: true });
      await pc.setLocalDescription(offer);
      sendSignal(uid, { kind: "offer", data: offer });
    } catch (e) {
      console.error(`Failed to create offer for peer ${uid}`, e);
    }
  }
}

async function flushPendingCandidates(uid: number, pc: RTCPeerConnection): Promise<void> {
  const pending = pendingCandidates.get(uid);
  if (!pending || pending.length === 0) return;
  pendingCandidates.delete(uid);
  for (const cand of pending) {
    try {
      await pc.addIceCandidate(cand);
    } catch (_e) {
      // ignore stale candidates
    }
  }
}

export async function handleRemoteSignal(fromUid: number, b64: string): Promise<void> {
  if (!inVoice) return;
  const msg = decodeSignal(b64);
  if (!msg) return;
  const pc = getOrCreatePeer(fromUid);
  try {
    if (msg.kind === "offer") {
      await pc.setRemoteDescription(msg.data);
      await flushPendingCandidates(fromUid, pc);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      sendSignal(fromUid, { kind: "answer", data: answer });
    } else if (msg.kind === "answer") {
      await pc.setRemoteDescription(msg.data);
      await flushPendingCandidates(fromUid, pc);
    } else if (msg.kind === "ice") {
      if (pc.remoteDescription) {
        try {
          await pc.addIceCandidate(msg.data);
        } catch (e) {
          console.warn("Failed to add ICE candidate", e);
        }
      } else {
        // Buffer until remote description is set
        if (!pendingCandidates.has(fromUid)) pendingCandidates.set(fromUid, []);
        pendingCandidates.get(fromUid)!.push(msg.data);
      }
    }
  } catch (e) {
    console.error(`Failed to process ${msg.kind} from ${fromUid}`, e);
  }
}

export function notifyRemoteSpeaking(uid: number, on: boolean): void {
  if (uid === client.playerID) return;
  const label = resolveDisplayName(uid);
  const changed = on ? !speakingPeers.has(uid) : speakingPeers.has(uid);
  if (on) {
    speakingPeers.set(uid, label);
  } else {
    speakingPeers.delete(uid);
  }
  if (changed) notifySpeakingListeners();
}

export function onSpeakingChange(listener: () => void): () => void {
  speakingListeners.push(listener);
  return () => {
    const idx = speakingListeners.indexOf(listener);
    if (idx >= 0) speakingListeners.splice(idx, 1);
  };
}

export function getSpeakingLabels(): string[] {
  const labels: string[] = [];
  speakingPeers.forEach((label) => labels.push(label));
  return labels;
}

export function getSpeakingUids(): number[] {
  const uids: number[] = [];
  speakingPeers.forEach((_label, uid) => uids.push(uid));
  return uids;
}

export function isLocalSpeaking(): boolean {
  if (!inVoice) return false;
  return localOpenMic || (caps.pttOnly ? pttActive : true);
}

export function getLocalPlayerID(): number {
  return client ? client.playerID : -1;
}

export function isLocalOpenMic(): boolean {
  return localOpenMic;
}

export function setLocalOpenMic(enabled: boolean): void {
  if (localOpenMic === enabled) return;
  localOpenMic = enabled;
  applyPTTToTracks();
  if (inVoice) {
    sender.sendServer(`VC_SPEAK#${client.playerID}#${enabled ? 1 : 0}#%`);
    notifySpeakingListeners();
  }
}

function resolveDisplayName(uid: number): string {
  if (client && client.playerlist) {
    const entry = client.playerlist.get(uid);
    if (entry) {
      return entry.showName || entry.name || entry.charName || `Peer ${uid}`;
    }
  }
  return `Peer ${uid}`;
}

export interface IceServerCheckResult {
  url: string;
  ok: boolean;
  error?: string;
}

export interface VoiceConfigReport {
  voiceEnabled: boolean;
  pttOnly: boolean;
  maxPeers: number;
  forceRelay: boolean;
  iceServers: IceServerCheckResult[];
  webrtcSupported: boolean;
  getUserMediaSupported: boolean;
}

export async function checkVoiceConfig(timeoutMs = 5000): Promise<VoiceConfigReport> {
  const webrtcSupported = typeof RTCPeerConnection !== "undefined";
  const getUserMediaSupported =
    typeof navigator !== "undefined" &&
    typeof navigator.mediaDevices !== "undefined" &&
    typeof navigator.mediaDevices.getUserMedia === "function";

  const iceResults: IceServerCheckResult[] = [];

  for (const server of caps.iceServers) {
    const urls = Array.isArray(server.urls) ? server.urls : [server.urls];
    for (const url of urls) {
      const result = await probeIceServer({ urls: url, username: server.username, credential: server.credential }, timeoutMs);
      iceResults.push(result);
    }
  }

  const report: VoiceConfigReport = {
    voiceEnabled: caps.enabled,
    pttOnly: caps.pttOnly,
    maxPeers: caps.maxPeers,
    forceRelay: caps.forceRelay,
    iceServers: iceResults,
    webrtcSupported,
    getUserMediaSupported,
  };

  console.group("[webAO] Voice config check");
  console.log("Voice enabled:", report.voiceEnabled);
  console.log("PTT only:", report.pttOnly);
  console.log("Max peers:", report.maxPeers);
  console.log("Force relay (IP leak prevention):", report.forceRelay);
  console.log("WebRTC supported:", report.webrtcSupported);
  console.log("getUserMedia supported:", report.getUserMediaSupported);
  if (iceResults.length === 0) {
    console.warn("No ICE servers configured.");
  } else {
    for (const r of iceResults) {
      if (r.ok) {
        console.log(`  [OK]   ${r.url}`);
      } else {
        console.warn(`  [FAIL] ${r.url} — ${r.error}`);
      }
    }
  }
  console.groupEnd();

  return report;
}

async function probeIceServer(
  server: RTCIceServer,
  timeoutMs: number,
): Promise<IceServerCheckResult> {
  const url = Array.isArray(server.urls) ? server.urls[0] : server.urls;
  return new Promise((resolve) => {
    let done = false;
    let pc: RTCPeerConnection | null = null;
    const finish = (ok: boolean, error?: string) => {
      if (done) return;
      done = true;
      try { pc?.close(); } catch (_) { /* ignore */ }
      resolve({ url, ok, error });
    };

    const timer = setTimeout(() => finish(false, "timeout"), timeoutMs);

    try {
      pc = new RTCPeerConnection({ iceServers: [server], iceTransportPolicy: "all" });
      pc.createDataChannel("probe");
      pc.createOffer()
        .then((offer) => pc!.setLocalDescription(offer))
        .catch((e) => finish(false, String(e)));

      pc.onicegatheringstatechange = () => {
        if (pc?.iceGatheringState === "complete") {
          clearTimeout(timer);
          finish(true);
        }
      };

      pc.onicecandidate = (ev) => {
        if (ev.candidate === null) {
          clearTimeout(timer);
          finish(true);
        }
      };

      pc.onicecandidateerror = (ev) => {
        const e = ev as RTCPeerConnectionIceErrorEvent;
        if (e.errorCode >= 700) {
          clearTimeout(timer);
          finish(false, `ICE error ${e.errorCode}: ${e.errorText}`);
        }
      };
    } catch (e) {
      clearTimeout(timer);
      finish(false, String(e));
    }
  });
}

if (typeof window !== "undefined") {
  (window as any).checkVoiceConfig = checkVoiceConfig;
}
