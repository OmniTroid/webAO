/* eslint @typescript-eslint/ban-types: "off" */
import { ChatMsg } from "./ChatMsg";
import { AudioElement } from "../../audio/opusPolyfill";

export interface Viewport {
  getTextNow: Function;
  setTextNow: Function;
  getChatmsg: Function;
  setChatmsg: Function;
  getSfxPlayed: Function;
  setSfxPlayed: Function;
  setTickTimer: Function;
  getTickTimer: Function;
  getAnimating: Function;
  setAnimating: Function;
  getLastEvidence: Function;
  setLastEvidence: Function;
  setLastCharacter: Function;
  getLastCharacter: Function;
  setShoutTimer: Function;
  getShoutTimer: Function;
  setTestimonyTimer: Function;
  getTestimonyTimer: Function;
  setTestimonyUpdater: Function;
  getTestimonyUpdater: Function;
  getTheme: Function;
  setTheme: Function;
  testimonyAudio: AudioElement;
  chat_tick: Function;
  playSFX: Function;
  set_side: Function;
  updateTestimony: Function;
  disposeTestimony: Function;
  handleTextTick: Function;
  setSfxAudio: Function;
  getSfxAudio: Function;
  getBackgroundFolder: Function;
  blipChannels: AudioElement[];
  music: AudioElement[];
  setBackgroundName: Function;
  getBackgroundName: Function;
  shoutaudio: AudioElement;
  updater: any;
}
