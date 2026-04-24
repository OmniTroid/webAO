import { handleInitialPeers } from "../../voice/voice";

export const handleVC_PEERS = (args: string[]) => {
  const csv = args[1] || "";
  const uids: number[] = [];
  if (csv.length > 0) {
    const parts = csv.split(",");
    for (let i = 0; i < parts.length; i++) {
      const n = Number(parts[i]);
      if (Number.isFinite(n)) uids.push(n);
    }
  }
  void handleInitialPeers(uids);
};
