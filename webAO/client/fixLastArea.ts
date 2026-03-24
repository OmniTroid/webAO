import { client } from "../client";
import { renderAreaList } from "../dom/renderAreaList";
import { addTrack } from "./addTrack";

/**
 * Area list fuckery
 */
export const fix_last_area = () => {
  if (client.areas.length > 0) {
    const malplaced = client.areas.pop().name;
    renderAreaList();
    addTrack(malplaced);
  }
};
