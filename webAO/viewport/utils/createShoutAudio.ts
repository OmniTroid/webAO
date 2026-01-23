import { AO_HOST } from "../../client/aoHost";
import { wrapAudioElement, AudioElement } from "../../audio/opusPolyfill";

export const createShoutAudio = (): AudioElement => {
  const shoutAudio = document.getElementById(
    "client_shoutaudio",
  ) as HTMLAudioElement;
  shoutAudio.src = `${AO_HOST}misc/default/objection.opus`;
  return wrapAudioElement(shoutAudio);
};
