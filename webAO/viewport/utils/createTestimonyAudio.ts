import { AO_HOST } from "../../client/aoHost";
import { wrapAudioElement, AudioElement } from "../../audio/opusPolyfill";

export const createTestimonyAudio = (): AudioElement => {
  const testimonyAudio = document.getElementById(
    "client_testimonyaudio",
  ) as HTMLAudioElement;
  testimonyAudio.src = `${AO_HOST}sounds/general/sfx-guilty.opus`;
  return wrapAudioElement(testimonyAudio);
};
