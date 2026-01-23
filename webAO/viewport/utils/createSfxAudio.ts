import { AO_HOST } from "../../client/aoHost";
import { wrapAudioElement, AudioElement } from "../../audio/opusPolyfill";

export const createSfxAudio = (): AudioElement => {
  const sfxAudio = document.getElementById(
    "client_sfxaudio",
  ) as HTMLAudioElement;
  sfxAudio.src = `${AO_HOST}sounds/general/sfx-realization.opus`;
  return wrapAudioElement(sfxAudio);
};
