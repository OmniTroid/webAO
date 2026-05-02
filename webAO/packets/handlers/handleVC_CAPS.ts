import { applyVoiceCaps } from "../../voice/voice";
import { installVoiceUI } from "../../voice/voiceUI";

export const handleVC_CAPS = (args: string[]) => {
  const enabled = args[1] === "1";
  const pttOnly = args[2] === "1";
  const maxPeers = Number(args[3]) || 0;
  const iceJson = args[4] || "[]";
  // args[5]: "0" opts out of relay enforcement; anything else (including absent) keeps relay on
  const forceRelay = args[5] !== "0";
  console.debug(
    `voice: VC_CAPS received enabled=${args[1]} ptt=${args[2]} maxPeers=${args[3]} ice=${iceJson} relay=${forceRelay}`,
  );
  installVoiceUI();
  applyVoiceCaps(enabled, pttOnly, maxPeers, iceJson, forceRelay);
};
