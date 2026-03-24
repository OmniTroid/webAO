import { client } from "../client";
import { area_click } from "./areaClick";

export function renderAreaList() {
  const container = document.getElementById("areas")!;
  container.innerHTML = "";

  for (let i = 0; i < client.areas.length; i++) {
    const area = client.areas[i];
    const el = document.createElement("SPAN");
    el.className = `area-button area-${area.status.toLowerCase()}`;
    el.id = `area${i}`;
    el.innerText = `${area.name} (${area.players}) [${area.status}]`;
    el.title =
      `Players: ${area.players}\n` +
      `Status: ${area.status}\n` +
      `CM: ${area.cm}\n` +
      `Area lock: ${area.locked}`;
    el.onclick = function () {
      area_click(el);
    };
    container.appendChild(el);
  }
}
