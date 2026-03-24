import { client } from "../../client";
import { renderAreaList } from "../../dom/renderAreaList";
import { safeTags } from "../../encoding";

/**
 * Handle the change of players in an area.
 * @param {Array} args packet arguments
 */
export const handleARUP = (args: string[]) => {
  args = args.slice(1);
  for (let i = 0; i < args.length - 1; i++) {
    if (client.areas[i]) {
      // the server sends us ARUP before we even get the area list
      switch (Number(args[0])) {
        case 0: // playercount
          client.areas[i].players = Number(args[i + 1]);
          break;
        case 1: // status
          client.areas[i].status = safeTags(args[i + 1]);
          break;
        case 2:
          client.areas[i].cm = safeTags(args[i + 1]);
          break;
        case 3:
          client.areas[i].locked = safeTags(args[i + 1]);
          break;
      }
    }
  }
  renderAreaList();
};
