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
} from "./voice";

let installed = false;
let panel: HTMLDivElement | null = null;
let statusLine: HTMLDivElement | null = null;
let toggleButton: HTMLButtonElement | null = null;
let speakingList: HTMLDivElement | null = null;

function isTypingTarget(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (target.isContentEditable) return true;
  return false;
}

function render() {
  if (!panel || !statusLine || !toggleButton || !speakingList) return;

  if (!isVoiceAvailable()) {
    panel.style.display = "none";
    return;
  }
  panel.style.display = "";

  const joined = isInVoice();
  const ptt = isPTTOnly();

  if (joined) {
    toggleButton.textContent = "Leave Voice";
    statusLine.textContent = ptt
      ? "Connected — hold V to talk"
      : "Connected — open mic";
  } else {
    toggleButton.textContent = "Enable Voice";
    statusLine.textContent = ptt ? "Push-to-talk (V)" : "Open mic";
  }

  const labels = getSpeakingLabels();
  if (labels.length === 0) {
    speakingList.textContent = "🔊 Speaking: (nobody)";
  } else {
    speakingList.textContent = `🔊 Speaking: ${labels.join(", ")}`;
  }
}

async function onToggleClick() {
  if (!toggleButton) return;
  toggleButton.disabled = true;
  try {
    if (isInVoice()) {
      leaveVoice();
    } else {
      await joinVoice();
    }
  } catch (e) {
    console.error("Voice toggle failed", e);
    if (statusLine) {
      statusLine.textContent = "Microphone unavailable";
    }
  } finally {
    toggleButton.disabled = false;
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

export function installVoiceUI(): void {
  if (installed) return;
  if (typeof document === "undefined" || !document.body) {
    document.addEventListener("DOMContentLoaded", installVoiceUI, { once: true });
    return;
  }
  installed = true;

  panel = document.createElement("div");
  panel.id = "voice-chat-panel";
  panel.style.position = "fixed";
  panel.style.right = "12px";
  panel.style.bottom = "12px";
  panel.style.zIndex = "1000";
  panel.style.padding = "8px 12px";
  panel.style.background = "rgba(20, 20, 20, 0.85)";
  panel.style.color = "#fff";
  panel.style.font = "12px sans-serif";
  panel.style.border = "1px solid #444";
  panel.style.borderRadius = "6px";
  panel.style.minWidth = "180px";
  panel.style.display = "none";

  const title = document.createElement("div");
  title.textContent = "🎙️ Voice Chat";
  title.style.fontWeight = "bold";
  title.style.marginBottom = "4px";
  panel.appendChild(title);

  statusLine = document.createElement("div");
  statusLine.style.marginBottom = "6px";
  panel.appendChild(statusLine);

  toggleButton = document.createElement("button");
  toggleButton.type = "button";
  toggleButton.style.width = "100%";
  toggleButton.style.marginBottom = "6px";
  toggleButton.addEventListener("click", () => {
    void onToggleClick();
  });
  panel.appendChild(toggleButton);

  speakingList = document.createElement("div");
  speakingList.style.fontSize = "11px";
  speakingList.style.opacity = "0.85";
  panel.appendChild(speakingList);

  document.body.appendChild(panel);

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
