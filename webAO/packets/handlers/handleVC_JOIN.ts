import { handlePeerJoined } from "../../voice/voice";

export const handleVC_JOIN = (args: string[]) => {
  const uid = Number(args[1]);
  if (!Number.isFinite(uid)) return;
  handlePeerJoined(uid);
};
