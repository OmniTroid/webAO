import { applyVoiceCaps } from "../../voice/voice";

export const handleVC_CAPS = (args: string[]) => {
  const enabled = args[1] === "1";
  const pttOnly = args[2] === "1";
  const maxPeers = Number(args[3]) || 0;
  const iceJson = args[4] || "[]";
  applyVoiceCaps(enabled, pttOnly, maxPeers, iceJson);
};
