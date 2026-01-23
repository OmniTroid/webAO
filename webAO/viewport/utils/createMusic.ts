import { opusCheck } from "../../dom/opusCheck";
import { wrapAudioElement, AudioElement } from "../../audio/opusPolyfill";

export const createMusic = (): AudioElement[] => {
  const audioChannels = document.getElementsByClassName(
    "audioChannel",
  ) as HTMLCollectionOf<HTMLAudioElement>;
  const music = [...audioChannels].map((channel: HTMLAudioElement) => {
    channel.volume = 0.5;
    channel.onerror = opusCheck(channel);
    return wrapAudioElement(channel);
  });
  return music;
};
