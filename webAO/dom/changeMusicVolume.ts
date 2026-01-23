import { client } from "../client";
import setCookie from "../utils/setCookie";
import { AudioElement } from "../audio/opusPolyfill";

export const changeMusicVolume = (volume: number = -1) => {
  const clientVolume = Number(
    (<HTMLInputElement>document.getElementById("client_mvolume")).value,
  );
  const musicVolume = volume === -1 ? clientVolume : volume;
  client.viewport.music.forEach(
    (channel: AudioElement) => (channel.volume = musicVolume),
  );
  setCookie("musicVolume", String(musicVolume));
};
(window as any).changeMusicVolume = changeMusicVolume;
