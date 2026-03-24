import { client } from "../client";
import { renderAreaList } from "../dom/renderAreaList";
import { safeTags } from "../encoding";

export const createArea = (id: number, aname: string) => {
  const name = safeTags(aname);
  client.areas.push({
    name,
    players: 0,
    status: "IDLE",
    cm: "",
    locked: "FREE",
  });
  renderAreaList();
};
