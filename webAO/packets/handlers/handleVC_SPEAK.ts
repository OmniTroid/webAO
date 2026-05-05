import { notifyRemoteSpeaking } from "../../voice/voice";

export const handleVC_SPEAK = (args: string[]) => {
  const uid = Number(args[1]);
  const on = args[2] === "1";
  if (!Number.isFinite(uid)) return;
  notifyRemoteSpeaking(uid, on);
};
