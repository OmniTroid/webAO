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
};

let localStream: MediaStream | null = null;
let inVoice = false;
let pttActive = false;

const peers = new Map<number, RTCPeerConnection>();
const remoteAudio = new Map<number, HTMLAudioElement>();
const speakingPeers = new Map<number, string>();
const speakingListeners: Array<() => void> = [];
const capsListeners: Array<() => void> = [];

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
  const pc = new RTCPeerConnection({ iceServers: caps.iceServers as RTCIceServer[] });

  pc.onicecandidate = (ev) => {
    if (ev.candidate) {
      sendSignal(remoteUid, { kind: "ice", data: ev.candidate.toJSON() });
    }
  };

  pc.ontrack = (ev) => {
    const stream = ev.streams && ev.streams[0] ? ev.streams[0] : new MediaStream([ev.track]);
    attachRemoteTrack(remoteUid, stream);
  };

  pc.onconnectionstatechange = () => {
    const state = pc.connectionState;
    if (state === "failed" || state === "closed" || state === "disconnected") {
      // Leave audio element attached briefly; final cleanup happens on VC_LEAVE.
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
  const enable = caps.pttOnly ? pttActive : true;
  const tracks = localStream.getAudioTracks();
  for (let i = 0; i < tracks.length; i++) {
    tracks[i].enabled = enable;
  }
}

async function ensureLocalStream(): Promise<MediaStream> {
  if (localStream) return localStream;
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  });
  localStream = stream;
  applyPTTToTracks();
  return stream;
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
  caps = { enabled, pttOnly, maxPeers, iceServers };
  console.debug(
    `voice: caps applied enabled=${enabled} ptt=${pttOnly} maxPeers=${maxPeers} ice=${iceServers.length}`,
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

export async function joinVoice(): Promise<void> {
  if (!caps.enabled || inVoice) return;
  try {
    await ensureLocalStream();
  } catch (e) {
    console.error("Microphone permission denied or unavailable", e);
    throw e;
  }
  inVoice = true;
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

export async function handleRemoteSignal(fromUid: number, b64: string): Promise<void> {
  if (!inVoice) return;
  const msg = decodeSignal(b64);
  if (!msg) return;
  const pc = getOrCreatePeer(fromUid);
  try {
    if (msg.kind === "offer") {
      await pc.setRemoteDescription(msg.data);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      sendSignal(fromUid, { kind: "answer", data: answer });
    } else if (msg.kind === "answer") {
      await pc.setRemoteDescription(msg.data);
    } else if (msg.kind === "ice") {
      try {
        await pc.addIceCandidate(msg.data);
      } catch (e) {
        console.warn("Failed to add ICE candidate", e);
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

function resolveDisplayName(uid: number): string {
  if (client && client.playerlist) {
    const entry = client.playerlist.get(uid);
    if (entry) {
      return entry.showName || entry.name || entry.charName || `Peer ${uid}`;
    }
  }
  return `Peer ${uid}`;
}
