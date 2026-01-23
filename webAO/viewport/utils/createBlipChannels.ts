import { opusCheck } from "../../dom/opusCheck";
import { wrapAudioElement, AudioElement } from "../../audio/opusPolyfill";

export const createBlipsChannels = (): AudioElement[] => {
  const blipSelectors = document.getElementsByClassName(
    "blipSound",
  ) as HTMLCollectionOf<HTMLAudioElement>;

  // Allocate multiple blip audio channels to make blips less jittery
  const blipChannels = [...blipSelectors].map((channel: HTMLAudioElement) => {
    channel.volume = 0.5;
    channel.onerror = opusCheck(channel);
    return wrapAudioElement(channel);
  });
  return blipChannels;
};
