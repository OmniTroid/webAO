import { client } from "../../client";
import { handlePeerLeft, leaveVoice } from "../../voice/voice";

export const handleVC_LEAVE = (args: string[]) => {
  const uid = Number(args[1]);
  if (!Number.isFinite(uid)) return;
  if (uid === client.playerID) {
    leaveVoice();
  } else {
    handlePeerLeft(uid);
  }
};
