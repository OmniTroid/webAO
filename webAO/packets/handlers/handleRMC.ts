import { client } from "../../client";

/**
 * Handles a music change to an arbitrary resource, with an offset in seconds.
 * @param {Array} args packet arguments
 */
export const handleRMC = (args: string[]) => {
  // Get the channel (defaults to 0)
  const channel = Number(args[2]) || 0;
  const music = client.viewport.music[channel];

  if (!music) return;

  music.pause();

  // Music offset + drift from song loading
  const totime = parseFloat(args[1]) || 0;
  const loadStartTime = new Date().getTime() / 1000;

  // For HTMLAudioElement, we can add event listener
  if (music instanceof HTMLAudioElement) {
    const onLoaded = () => {
      const drift = new Date().getTime() / 1000 - loadStartTime;
      music.currentTime = totime + drift;
      music.play();
      music.removeEventListener("loadedmetadata", onLoaded);
    };
    music.addEventListener("loadedmetadata", onLoaded, false);
  } else {
    // For polyfilled element, just set currentTime directly after a short delay
    setTimeout(() => {
      const drift = new Date().getTime() / 1000 - loadStartTime;
      music.currentTime = totime + drift;
      music.play();
    }, 100);
  }
};
