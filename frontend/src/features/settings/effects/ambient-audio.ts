import type { AnimationPreset } from "../theme-animation";

export type AudioState = "idle" | "starting" | "playing" | "blocked";

/** One gesture-owned context per workspace. All sounds are original, bounded procedural ambience. */
export class AmbientAudio {
  private context?: AudioContext;
  private master?: GainNode;
  private nodes: AudioNode[] = [];
  private sources: (AudioBufferSourceNode | OscillatorNode)[] = [];
  private timers = new Set<ReturnType<typeof setTimeout>>();
  private listeners = new Set<() => void>();
  private state: AudioState = "idle";
  private preset?: AnimationPreset;
  private generation = 0;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  snapshot = () => this.state;
  private publish(state: AudioState) { this.state = state; this.listeners.forEach(listener => listener()); }

  /** Call directly from a click/key activation. No effect or generic document gesture starts audio. */
  play = async (preset: AnimationPreset, volume: number) => {
    this.stop();
    const generation = this.generation;
    this.publish("starting");
    try {
      const context = new AudioContext();
      this.context = context;
      await context.resume();
      if (generation !== this.generation) { await context.close().catch(() => {}); return; }
      if (context.state !== "running") throw new Error("Audio unavailable");
      this.master = context.createGain();
      this.master.gain.value = Math.max(0, Math.min(100, volume)) / 100 * .14;
      this.master.connect(context.destination);
      this.preset = preset;
      this.build(preset);
      this.publish("playing");
      context.onstatechange = () => {
        if (this.context === context && context.state !== "running") this.stop();
      };
    } catch {
      if (generation !== this.generation) return;
      this.stop();
      this.publish("blocked");
    }
  };

  update(preset: AnimationPreset, volume: number) {
    if (this.state !== "playing" || !this.context || !this.master) return;
    if (this.preset !== preset) {
      this.clearNodes();
      this.preset = preset;
      this.build(preset);
    }
    this.master.gain.setTargetAtTime(Math.max(0, Math.min(100, volume)) / 100 * .14, this.context.currentTime, .08);
  }

  private later(action: () => void, milliseconds: number) {
    const timer = setTimeout(() => { this.timers.delete(timer); action(); }, milliseconds);
    this.timers.add(timer);
  }

  private noise(brown = false) {
    const context = this.context!;
    const buffer = context.createBuffer(1, context.sampleRate * 3, context.sampleRate);
    const samples = buffer.getChannelData(0);
    let previous = 0;
    for (let i = 0; i < samples.length; i++) {
      const white = Math.random() * 2 - 1;
      previous = (previous + .025 * white) / 1.025;
      samples[i] = brown ? previous * 4 : white * .4;
    }
    const source = context.createBufferSource();
    source.buffer = buffer; source.loop = true;
    this.sources.push(source); this.nodes.push(source);
    return source;
  }

  private build(preset: AnimationPreset) {
    const context = this.context!, master = this.master!;
    const noise = this.noise(preset !== "RAIN");
    const filter = context.createBiquadFilter();
    filter.type = preset === "WATER" ? "bandpass" : "lowpass";
    filter.frequency.value = preset === "SNOW" ? 420 : preset === "WATER" ? 650 : preset === "THUNDERSTORM" ? 2600 : 6500;
    filter.Q.value = preset === "WATER" ? .65 : .4;
    const gain = context.createGain();
    gain.gain.value = preset === "SNOW" ? .5 : preset === "WATER" ? .8 : 1;
    noise.connect(filter).connect(gain).connect(master);
    this.nodes.push(filter, gain);
    if (preset === "SNOW" || preset === "WATER") {
      const wave = context.createOscillator(), depth = context.createGain();
      wave.frequency.value = preset === "SNOW" ? .12 : .35;
      depth.gain.value = .18;
      wave.connect(depth).connect(gain.gain);
      this.sources.push(wave); this.nodes.push(wave, depth); wave.start();
    }
    noise.start();
    if (preset === "WATER") this.bubble();
  }

  private bubble() {
    if (!this.context || !this.master || this.preset !== "WATER") return;
    const context = this.context, tone = context.createOscillator(), envelope = context.createGain();
    const now = context.currentTime;
    tone.frequency.setValueAtTime(450 + Math.random() * 400, now);
    tone.frequency.exponentialRampToValueAtTime(180, now + .16);
    envelope.gain.setValueAtTime(0, now); envelope.gain.linearRampToValueAtTime(.1, now + .025);
    envelope.gain.exponentialRampToValueAtTime(.001, now + .25);
    tone.connect(envelope).connect(this.master);
    tone.onended = () => { tone.disconnect(); envelope.disconnect(); this.sources = this.sources.filter(source => source !== tone); this.nodes = this.nodes.filter(node => node !== tone && node !== envelope); };
    this.sources.push(tone); this.nodes.push(tone, envelope);
    tone.start(); tone.stop(now + .3);
    this.later(() => this.bubble(), 900 + Math.random() * 1800);
  }

  /** Called by the same scene event that paints a bolt; distance delays the associated rumble. */
  thunder = () => {
    if (this.state !== "playing" || this.preset !== "THUNDERSTORM") return;
    this.later(() => {
      if (!this.context || !this.master || this.preset !== "THUNDERSTORM") return;
      const context = this.context, noise = this.noise(true), filter = context.createBiquadFilter(), envelope = context.createGain();
      const now = context.currentTime;
      filter.type = "lowpass"; filter.frequency.value = 140;
      envelope.gain.setValueAtTime(0, now); envelope.gain.linearRampToValueAtTime(1.4, now + .25);
      envelope.gain.exponentialRampToValueAtTime(.001, now + 3.5);
      noise.connect(filter).connect(envelope).connect(this.master);
      this.nodes.push(filter, envelope);
      noise.onended = () => { noise.disconnect(); filter.disconnect(); envelope.disconnect(); this.sources = this.sources.filter(source => source !== noise); this.nodes = this.nodes.filter(node => node !== noise && node !== filter && node !== envelope); };
      noise.start(); noise.stop(now + 3.7);
    }, 500 + Math.random() * 1000);
  };

  private clearNodes() {
    this.timers.forEach(clearTimeout); this.timers.clear();
    this.sources.forEach(source => { source.onended = null; try { source.stop(); } catch {} });
    this.nodes.forEach(node => node.disconnect());
    this.sources = []; this.nodes = [];
  }

  stop = () => {
    this.generation++;
    this.clearNodes();
    this.master?.disconnect(); this.master = undefined;
    const context = this.context; this.context = undefined; this.preset = undefined;
    if (context) context.onstatechange = null;
    if (context && context.state !== "closed") void context.close().catch(() => {});
    this.publish("idle");
  };
}
