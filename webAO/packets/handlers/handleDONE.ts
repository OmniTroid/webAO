import queryParser from "../../utils/queryParser";
import { client, clientState, autoChar } from "../../client";

const { mode } = queryParser();
/**
 * Handles the handshake completion packet, meaning the player
 * is ready to select a character.
 *
 * @param {Array} args packet arguments
 */
export const handleDONE = (_args: string[]) => {
  // DONE packet signals that the handshake is complete
  client.state = clientState.Joined;
  document.getElementById("client_loading")!.style.display = "none";
  if (mode === "watch") {
    // Spectators don't need to pick a character
    document.getElementById("client_waiting")!.style.display = "none";
  }

  if (autoChar) {
    // Hide charselect immediately (spectator mode) so the user isn't stuck
    // on the selection screen. If the CC request succeeds, PV will confirm it.
    document.getElementById("client_waiting")!.style.display = "none";
    document.getElementById("client_charselect")!.style.display = "none";

    const charIndex = client.chars.findIndex(
      (c: any) => c && c.name.toLowerCase() === autoChar.toLowerCase()
    );
    if (charIndex !== -1) {
      client.sender.sendCharacter(charIndex);
    }
  }
};
