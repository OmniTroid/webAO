import setCookie from "../utils/setCookie";
import { client } from "../client";
import { AudioElement } from "../audio/opusPolyfill";
/**
 * Triggered by the blip volume slider.
 */
export const changeBlipVolume = () => {
  const blipVolume = (<HTMLInputElement>(
    document.getElementById("client_bvolume")
  )).value;
  client.viewport.blipChannels.forEach(
    (channel: AudioElement) => (channel.volume = Number(blipVolume)),
  );
  setCookie("blipVolume", blipVolume);
};
(window as any).changeBlipVolume = changeBlipVolume;
