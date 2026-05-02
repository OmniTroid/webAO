import { applyVoiceCaps } from "../../voice/voice";
import { installVoiceUI } from "../../voice/voiceUI";

export const handleVC_CAPS = (args: string[]) => {
  const enabled = args[1] === "1";
  const pttOnly = args[2] === "1";
  const maxPeers = Number(args[3]) || 0;
  const iceJson = args[4] || "[]";
  console.debug(
    `voice: VC_CAPS received enabled=${args[1]} ptt=${args[2]} maxPeers=${args[3]} ice=${iceJson}`,
  );
  installVoiceUI();
  applyVoiceCaps(enabled, pttOnly, maxPeers, iceJson);
};
