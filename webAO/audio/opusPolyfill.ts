/**
 * Opus Polyfill for browsers without native Opus support (Safari/iOS)
 * Uses ogg-opus-decoder WASM library to decode Opus files and plays via Web Audio API
 */

import { OggOpusDecoder } from "ogg-opus-decoder";

// Singleton AudioContext for Web Audio API playback
let audioContext: AudioContext | null = null;

// Singleton decoder instance (reused for performance)
let decoder: OggOpusDecoder | null = null;
let decoderReady: Promise<void> | null = null;

// Cache for decoded audio buffers
const audioBufferCache = new Map<string, AudioBuffer>();

/**
 * Check if the browser natively supports Opus audio
 */
export function supportsOpusNatively(): boolean {
  const audio = document.createElement("audio");
  // Check for Ogg Opus support (most common container)
  const canPlayOgg = audio.canPlayType('audio/ogg; codecs="opus"');
  // Also check WebM Opus
  const canPlayWebm = audio.canPlayType('audio/webm; codecs="opus"');

  return canPlayOgg === "probably" || canPlayWebm === "probably";
}

/**
 * Get or create the shared AudioContext
 */
export function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioContext;
}

/**
 * Resume AudioContext if suspended (required for iOS after user interaction)
 */
export async function resumeAudioContext(): Promise<void> {
  const ctx = getAudioContext();
  if (ctx.state === "suspended") {
    await ctx.resume();
  }
}

/**
 * Get or create the shared decoder instance
 */
async function getDecoder(): Promise<OggOpusDecoder> {
  if (!decoder) {
    decoder = new OggOpusDecoder();
    decoderReady = decoder.ready;
  }
  await decoderReady;
  return decoder;
}

/**
 * Decode an Opus file and return an AudioBuffer
 */
async function decodeOpusFile(url: string): Promise<AudioBuffer> {
  // Check cache first
  if (audioBufferCache.has(url)) {
    return audioBufferCache.get(url)!;
  }

  const dec = await getDecoder();
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);

  // Decode the Opus file
  const { channelData, samplesDecoded, sampleRate } = await dec.decodeFile(uint8Array);

  if (samplesDecoded === 0) {
    throw new Error(`Failed to decode ${url}: no samples`);
  }

  // Create AudioBuffer from decoded data
  const ctx = getAudioContext();
  const audioBuffer = ctx.createBuffer(
    channelData.length,
    samplesDecoded,
    sampleRate
  );

  for (let i = 0; i < channelData.length; i++) {
    // Get the destination channel and copy data manually to avoid type issues
    const destChannel = audioBuffer.getChannelData(i);
    destChannel.set(channelData[i]);
  }

  // Cache the result (limit cache size)
  if (audioBufferCache.size > 100) {
    // Remove oldest entry
    const firstKey = audioBufferCache.keys().next().value;
    if (firstKey) audioBufferCache.delete(firstKey);
  }
  audioBufferCache.set(url, audioBuffer);

  // Reset decoder for next use
  await dec.reset();

  return audioBuffer;
}

/**
 * A polyfilled audio element that mimics HTMLAudioElement interface
 * but uses Web Audio API for playback of Opus files
 */
export class PolyfillAudioElement {
  private _src = "";
  private _volume = 1;
  private _loop = false;
  private _paused = true;
  private _currentTime = 0;
  private _duration = 0;

  private sourceNode: AudioBufferSourceNode | null = null;
  private gainNode: GainNode | null = null;
  private startTime = 0;
  private audioBuffer: AudioBuffer | null = null;
  private isLoading = false;
  private loadError: Error | null = null;

  // Event handlers
  onerror: ((ev: Event) => any) | null = null;
  onended: ((ev: Event) => any) | null = null;
  onloadeddata: ((ev: Event) => any) | null = null;
  onplay: ((ev: Event) => any) | null = null;
  onpause: ((ev: Event) => any) | null = null;

  constructor() {
    // Initialize gain node for volume control
    const ctx = getAudioContext();
    this.gainNode = ctx.createGain();
    this.gainNode.connect(ctx.destination);
  }

  get src(): string {
    return this._src;
  }

  set src(value: string) {
    this._src = value;
    this.loadError = null;
    this.audioBuffer = null;
    this._duration = 0;
    this._currentTime = 0;

    if (value && value.endsWith(".opus")) {
      this.loadAudio(value);
    }
  }

  get volume(): number {
    return this._volume;
  }

  set volume(value: number) {
    this._volume = Math.max(0, Math.min(1, value));
    if (this.gainNode) {
      this.gainNode.gain.value = this._volume;
    }
  }

  get loop(): boolean {
    return this._loop;
  }

  set loop(value: boolean) {
    this._loop = value;
    if (this.sourceNode) {
      this.sourceNode.loop = value;
    }
  }

  get paused(): boolean {
    return this._paused;
  }

  get currentTime(): number {
    if (!this._paused && this.startTime > 0) {
      return getAudioContext().currentTime - this.startTime;
    }
    return this._currentTime;
  }

  set currentTime(value: number) {
    this._currentTime = value;
    if (!this._paused && this.audioBuffer) {
      this.stop();
      this.playFromOffset(value);
    }
  }

  get duration(): number {
    return this._duration;
  }

  private async loadAudio(url: string): Promise<void> {
    if (this.isLoading) return;
    this.isLoading = true;

    try {
      this.audioBuffer = await decodeOpusFile(url);
      this._duration = this.audioBuffer.duration;
      this.isLoading = false;

      if (this.onloadeddata) {
        this.onloadeddata(new Event("loadeddata"));
      }
    } catch (error) {
      this.isLoading = false;
      this.loadError = error as Error;
      console.warn(`Polyfill failed to load ${url}:`, error);

      if (this.onerror) {
        this.onerror(new Event("error"));
      }
    }
  }

  private playFromOffset(offset: number): void {
    if (!this.audioBuffer || !this.gainNode) return;

    const ctx = getAudioContext();

    // Create new source node
    this.sourceNode = ctx.createBufferSource();
    this.sourceNode.buffer = this.audioBuffer;
    this.sourceNode.loop = this._loop;
    this.sourceNode.connect(this.gainNode);

    this.sourceNode.onended = () => {
      if (!this._loop) {
        this._paused = true;
        this._currentTime = 0;
        if (this.onended) {
          this.onended(new Event("ended"));
        }
      }
    };

    this.startTime = ctx.currentTime - offset;
    this.sourceNode.start(0, offset);
    this._paused = false;
  }

  async play(): Promise<void> {
    // Ensure AudioContext is resumed
    await resumeAudioContext();

    // Wait for audio to load if still loading
    if (this.isLoading) {
      await new Promise<void>((resolve) => {
        const checkLoaded = () => {
          if (!this.isLoading) {
            resolve();
          } else {
            setTimeout(checkLoaded, 10);
          }
        };
        checkLoaded();
      });
    }

    // If there was a load error or no buffer, try to trigger native error handling
    if (!this.audioBuffer) {
      if (this.onerror) {
        this.onerror(new Event("error"));
      }
      return;
    }

    // Stop any current playback
    this.stop();

    // Start playback
    this.playFromOffset(this._currentTime);

    if (this.onplay) {
      this.onplay(new Event("play"));
    }
  }

  pause(): void {
    if (this.sourceNode && !this._paused) {
      this._currentTime = this.currentTime;
      this.stop();
      this._paused = true;

      if (this.onpause) {
        this.onpause(new Event("pause"));
      }
    }
  }

  private stop(): void {
    if (this.sourceNode) {
      try {
        this.sourceNode.stop();
        this.sourceNode.disconnect();
      } catch (e) {
        // Ignore errors if already stopped
      }
      this.sourceNode = null;
    }
  }

  load(): void {
    if (this._src) {
      this.loadAudio(this._src);
    }
  }
}

// Track whether we need the polyfill
let needsPolyfill: boolean | null = null;

/**
 * Check if polyfill is needed (cached result)
 */
export function needsOpusPolyfill(): boolean {
  if (needsPolyfill === null) {
    needsPolyfill = !supportsOpusNatively();
    if (needsPolyfill) {
      console.log("Opus polyfill enabled - using WASM decoder for Opus audio");
    }
  }
  return needsPolyfill;
}

/**
 * Type for elements that can be either native or polyfilled
 */
export type AudioElement = HTMLAudioElement | PolyfillAudioElement;

/**
 * Wrap an existing HTMLAudioElement to intercept Opus playback
 * Returns the original element if polyfill not needed, or a proxy that handles Opus files
 */
export function wrapAudioElement(nativeElement: HTMLAudioElement): AudioElement {
  if (!needsOpusPolyfill()) {
    return nativeElement;
  }

  // Create a polyfill instance that will be used for Opus files
  const polyfillElement = new PolyfillAudioElement();

  // Copy initial properties
  polyfillElement.volume = nativeElement.volume;
  polyfillElement.loop = nativeElement.loop;

  // Create a proxy that routes to polyfill for Opus files
  return new Proxy(nativeElement, {
    get(target, prop) {
      const currentSrc = target.src || polyfillElement.src;
      const isOpus = currentSrc.endsWith(".opus");

      if (isOpus) {
        // Route to polyfill for Opus files
        const value = (polyfillElement as any)[prop];
        if (typeof value === "function") {
          return value.bind(polyfillElement);
        }
        return value;
      }

      // Use native element for non-Opus files
      const value = (target as any)[prop];
      if (typeof value === "function") {
        return value.bind(target);
      }
      return value;
    },

    set(target, prop, value) {
      // Always set on both elements to keep them in sync
      if (prop in polyfillElement) {
        (polyfillElement as any)[prop] = value;
      }
      (target as any)[prop] = value;
      return true;
    }
  }) as AudioElement;
}

/**
 * Initialize the Opus polyfill system
 * Call this early in app initialization, preferably after first user interaction
 */
export async function initOpusPolyfill(): Promise<void> {
  if (!needsOpusPolyfill()) {
    return;
  }

  // Pre-warm the decoder
  try {
    await getDecoder();
    console.log("Opus decoder initialized");
  } catch (error) {
    console.error("Failed to initialize Opus decoder:", error);
  }

  // Set up click handler to resume AudioContext (required for iOS)
  const resumeOnInteraction = async () => {
    await resumeAudioContext();
    document.removeEventListener("click", resumeOnInteraction);
    document.removeEventListener("touchstart", resumeOnInteraction);
  };

  document.addEventListener("click", resumeOnInteraction, { once: true });
  document.addEventListener("touchstart", resumeOnInteraction, { once: true });
}

// Export for global access
(window as any).opusPolyfill = {
  needsOpusPolyfill,
  initOpusPolyfill,
  wrapAudioElement,
  PolyfillAudioElement,
  resumeAudioContext
};
