import {
  isVoiceAvailable,
  isPTTOnly,
  isInVoice,
  joinVoice,
  leaveVoice,
  setPTT,
  onCapsChange,
  onSpeakingChange,
  getSpeakingLabels,
  setInputDevice,
  getInputDeviceId,
  setOutputVolume,
  getOutputVolume,
} from "./voice";
import getCookie from "../utils/getCookie";
import setCookie from "../utils/setCookie";

let installed = false;
let menuButton: HTMLElement | null = null;
let menuIcon: HTMLElement | null = null;
let menuText: HTMLElement | null = null;
let settingsFieldset: HTMLFieldSetElement | null = null;
let settingsToggleButton: HTMLButtonElement | null = null;
let settingsStatusLine: HTMLElement | null = null;
let settingsSpeakingList: HTMLElement | null = null;
let deviceSelect: HTMLSelectElement | null = null;
let outputVolumeSlider: HTMLInputElement | null = null;
let toggleInFlight = false;
let deviceListPopulated = false;

function isTypingTarget(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (target.isContentEditable) return true;
  return false;
}

function render() {
  const available = isVoiceAvailable();

  if (menuButton) {
    menuButton.style.display = available ? "" : "none";
  }
  if (settingsFieldset) {
    settingsFieldset.style.display = available ? "" : "none";
  }

  if (!available) return;

  const joined = isInVoice();
  const ptt = isPTTOnly();

  if (menuIcon) {
    menuIcon.innerHTML = joined ? "&#127908;" : "&#128264;";
  }
  if (menuText) {
    menuText.textContent = joined ? "Mute" : "Voice";
    (menuText as HTMLElement).style.color = joined ? "#5cb85c" : "";
  }
  if (menuButton) {
    menuButton.setAttribute(
      "title",
      joined
        ? ptt
          ? "Voice on — hold V to talk. Click to mute."
          : "Voice on (open mic). Click to mute."
        : "Click to enable voice chat",
    );
  }

  if (settingsToggleButton) {
    settingsToggleButton.textContent = joined ? "Mute / Disconnect" : "Enable Voice";
  }
  if (settingsStatusLine) {
    if (joined) {
      settingsStatusLine.textContent = ptt
        ? "Connected — hold V to talk"
        : "Connected — open mic";
    } else {
      settingsStatusLine.textContent = ptt
        ? "Push-to-talk (V) when enabled"
        : "Open mic when enabled";
    }
  }

  if (settingsSpeakingList) {
    const labels = getSpeakingLabels();
    settingsSpeakingList.textContent =
      labels.length === 0
        ? "🔊 Speaking: (nobody)"
        : `🔊 Speaking: ${labels.join(", ")}`;
  }
}

async function populateDeviceList(): Promise<void> {
  if (!deviceSelect) return;
  if (
    typeof navigator === "undefined" ||
    !navigator.mediaDevices ||
    typeof navigator.mediaDevices.enumerateDevices !== "function"
  ) {
    return;
  }
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const previousValue = deviceSelect.value;
    while (deviceSelect.options.length > 0) {
      deviceSelect.remove(0);
    }
    deviceSelect.add(new Option("Default", ""));
    let idx = 1;
    for (const device of devices) {
      if (device.kind !== "audioinput") continue;
      const label = device.label || `Microphone ${idx}`;
      deviceSelect.add(new Option(label, device.deviceId));
      idx++;
    }
    const saved = getCookie("voiceInputDevice");
    const target = previousValue || saved || getInputDeviceId() || "";
    if (target) {
      const found = Array.from(deviceSelect.options).some(
        (opt) => opt.value === target,
      );
      deviceSelect.value = found ? target : "";
    }
    deviceListPopulated = true;
  } catch (e) {
    console.warn("Failed to enumerate audio devices", e);
  }
}

export async function toggleVoice(): Promise<void> {
  if (!isVoiceAvailable() || toggleInFlight) return;
  toggleInFlight = true;
  try {
    if (isInVoice()) {
      leaveVoice();
    } else {
      await joinVoice();
      // Once permission is granted device labels become available.
      await populateDeviceList();
    }
  } catch (e) {
    console.error("Voice toggle failed", e);
    if (settingsStatusLine) {
      settingsStatusLine.textContent = "Microphone unavailable";
    }
  } finally {
    toggleInFlight = false;
    render();
  }
}

function onKeyDown(e: KeyboardEvent) {
  if (!isVoiceAvailable() || !isInVoice() || !isPTTOnly()) return;
  if (e.key !== "v" && e.key !== "V") return;
  if (isTypingTarget(e.target)) return;
  if (e.repeat) return;
  setPTT(true);
  render();
}

function onKeyUp(e: KeyboardEvent) {
  if (!isVoiceAvailable() || !isInVoice() || !isPTTOnly()) return;
  if (e.key !== "v" && e.key !== "V") return;
  if (isTypingTarget(e.target)) return;
  setPTT(false);
  render();
}

async function onDeviceChange() {
  if (!deviceSelect) return;
  const id = deviceSelect.value;
  setCookie("voiceInputDevice", id);
  try {
    await setInputDevice(id);
  } catch (e) {
    if (settingsStatusLine) {
      settingsStatusLine.textContent = "Could not switch microphone";
    }
  }
  render();
}

function onOutputVolumeChange() {
  if (!outputVolumeSlider) return;
  const v = Number(outputVolumeSlider.value);
  setOutputVolume(v);
  setCookie("voiceOutputVolume", String(v));
}

export function installVoiceUI(): void {
  if (installed) return;
  if (typeof document === "undefined" || !document.body) {
    document.addEventListener("DOMContentLoaded", installVoiceUI, { once: true });
    return;
  }
  installed = true;

  menuButton = document.getElementById("menu_voice");
  menuIcon = document.getElementById("menu_voice_icon");
  menuText = document.getElementById("menu_voice_text");

  settingsFieldset = document.getElementById(
    "voice_settings",
  ) as HTMLFieldSetElement | null;
  settingsToggleButton = document.getElementById(
    "voice_toggle_button",
  ) as HTMLButtonElement | null;
  settingsStatusLine = document.getElementById("voice_status_line");
  settingsSpeakingList = document.getElementById("voice_speaking_list");
  deviceSelect = document.getElementById(
    "voice_input_device",
  ) as HTMLSelectElement | null;
  outputVolumeSlider = document.getElementById(
    "voice_output_volume",
  ) as HTMLInputElement | null;

  if (settingsToggleButton) {
    settingsToggleButton.addEventListener("click", () => {
      void toggleVoice();
    });
  }
  if (deviceSelect) {
    deviceSelect.addEventListener("change", () => {
      void onDeviceChange();
    });
  }
  if (outputVolumeSlider) {
    const stored = getCookie("voiceOutputVolume");
    if (stored) {
      outputVolumeSlider.value = stored;
      setOutputVolume(Number(stored));
    } else {
      outputVolumeSlider.value = String(getOutputVolume());
    }
    outputVolumeSlider.addEventListener("input", onOutputVolumeChange);
    outputVolumeSlider.addEventListener("change", onOutputVolumeChange);
  }

  // Pre-populate device list with whatever labels are available pre-permission.
  void populateDeviceList();
  if (
    typeof navigator !== "undefined" &&
    navigator.mediaDevices &&
    typeof navigator.mediaDevices.addEventListener === "function"
  ) {
    navigator.mediaDevices.addEventListener("devicechange", () => {
      void populateDeviceList();
    });
  }

  onCapsChange(render);
  window.addEventListener("voice-caps-updated", render);
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  onSpeakingChange(render);

  render();
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", installVoiceUI, { once: true });
  } else {
    installVoiceUI();
  }
}

// Suppress unused warning when populateDeviceList is unused otherwise.
void deviceListPopulated;
