import { handleRemoteSignal } from "../../voice/voice";

export const handleVC_SIG = (args: string[]) => {
  const fromUid = Number(args[1]);
  const payload = args[2] || "";
  if (!Number.isFinite(fromUid) || !payload) return;
  void handleRemoteSignal(fromUid, payload);
};
