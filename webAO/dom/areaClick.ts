import { client } from "../client";
import { appendICNotice } from "../client/appendICNotice";
import { renderPlayerList } from "./renderPlayerList";
/**
 * Triggered when an item on the area list is clicked.
 * @param {HTMLElement} el
 */
export function area_click(el: HTMLElement) {
  const area = client.areas[el.id.substring(4)].name;
  client.sender.sendMusicChange(area);
  appendICNotice(`switched to ${el.textContent}`);
  client.area = Number(el.id.substring(4));
  renderPlayerList();
}
window.area_click = area_click;
