import type { AnimationPreset } from "../theme-animation";

export type AudioState = "idle" | "starting" | "playing" | "blocked";
const FILES: Record<AnimationPreset, string> = { RAIN: "rain", THUNDERSTORM: "rain", SNOW: "wind", WATER: "water", FIRE: "fire" };

/** Gesture-owned recorded ambience. Assets are same-origin and never fetched before explicit play. */
export class AmbientAudio {
  private context?: AudioContext;
  private master?: GainNode;
  private sources = new Map<AudioBufferSourceNode, GainNode>();
  private buffers = new Map<string, AudioBuffer>();
  private request?: AbortController;
  private listeners = new Set<() => void>();
  private state: AudioState = "idle";
  private preset?: AnimationPreset;
  private generation = 0;
  private loading = 0;
  private thunderUntil = 0;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  snapshot = () => this.state;
  private publish(state: AudioState) { this.state = state; this.listeners.forEach(listener => listener()); }

  /** Must be called directly from click/key activation; preferences never grant autoplay. */
  play = async (preset: AnimationPreset, volume: number) => {
    this.stop();
    const generation = this.generation;
    this.publish("starting");
    try {
      const context = new AudioContext();
      this.context = context;
      await context.resume();
      if (generation !== this.generation) return;
      if (context.state !== "running") throw new Error("Audio unavailable");
      this.master = context.createGain(); this.master.gain.value = this.volume(volume);
      this.master.connect(context.destination);
      context.onstatechange = () => { if (this.context === context && context.state !== "running") this.stop(); };
      await this.select(preset);
    } catch {
      if (generation === this.generation) { this.stop(); this.publish("blocked"); }
    }
  };

  private volume(value: number) { return Math.max(0, Math.min(100, value)) / 100 * .45; }
  update(preset: AnimationPreset, volume: number) {
    if (!this.context || !this.master) return;
    this.master.gain.setTargetAtTime(this.volume(volume), this.context.currentTime, .12);
    if (this.preset !== preset) void this.select(preset);
  }

  private async select(preset: AnimationPreset) {
    const context = this.context!;
    const ticket = ++this.loading;
    this.request?.abort(); this.clearSources(); this.preset = preset;
    const request = new AbortController(); this.request = request;
    this.publish("starting");
    try {
      const names = preset === "THUNDERSTORM" ? ["rain", "thunder"] : [FILES[preset]];
      const loaded = await Promise.all(names.map(async name => {
        if (this.buffers.has(name)) return [name, this.buffers.get(name)!] as const;
        const response = await fetch(`/audio/ambience/${name}.wav`, { signal: request.signal });
        if (!response.ok) throw new Error("Ambience unavailable");
        return [name, await context.decodeAudioData(await response.arrayBuffer())] as const;
      }));
      if (ticket !== this.loading || request.signal.aborted || this.context !== context) return;
      // Keep only this scene's one or two buffers, not an ever-growing decoded library.
      this.buffers = new Map(loaded);
      this.start(this.buffers.get(FILES[preset])!, true, preset === "THUNDERSTORM" ? .55 : .8);
      this.publish("playing");
    } catch {
      if (ticket !== this.loading || request.signal.aborted || this.context !== context) return;
      this.stop(); this.publish("blocked");
    }
  }

  private start(buffer: AudioBuffer, loop: boolean, level: number, delay = 0) {
    const context = this.context!, source = context.createBufferSource(), gain = context.createGain();
    source.buffer = buffer; source.loop = loop;
    const when = context.currentTime + delay;
    gain.gain.setValueAtTime(0, context.currentTime);
    gain.gain.setValueAtTime(0, when); gain.gain.linearRampToValueAtTime(level, when + (loop ? .6 : .035));
    source.connect(gain).connect(this.master!); this.sources.set(source, gain);
    source.onended = () => { source.disconnect(); gain.disconnect(); this.sources.delete(source); };
    source.start(when);
  }

  /** The canvas strike schedules its recorded rumble on the audio clock, with natural distance delay. */
  thunder = () => {
    const context = this.context, buffer = this.buffers.get("thunder");
    if (this.state !== "playing" || this.preset !== "THUNDERSTORM" || !context || !buffer || context.currentTime < this.thunderUntil) return;
    const delay = .45 + Math.random() * .85;
    this.thunderUntil = context.currentTime + delay + buffer.duration;
    this.start(buffer, false, .7 + Math.random() * .2, delay);
  };

  private clearSources() {
    this.sources.forEach((gain, source) => { source.onended = null; try { source.stop(); } catch {} source.disconnect(); gain.disconnect(); });
    this.sources.clear(); this.thunderUntil = 0;
  }
  stop = () => {
    this.generation++; this.loading++;
    this.request?.abort(); this.request = undefined;
    this.clearSources(); this.buffers.clear();
    this.master?.disconnect(); this.master = undefined;
    const context = this.context; this.context = undefined; this.preset = undefined;
    if (context) context.onstatechange = null;
    if (context && context.state !== "closed") void context.close().catch(() => {});
    this.publish("idle");
  };
}
