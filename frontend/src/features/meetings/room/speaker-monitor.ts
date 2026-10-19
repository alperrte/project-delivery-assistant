"use client";
import { useEffect, useState } from "react";
import { Track, type Room } from "livekit-client";
import { SpeechGate, rmsToDb } from "./speech-gate";

export type SpeakerSource = { identity: string; track: MediaStreamTrack | undefined; muted: boolean };
/** -1: not measured here (use the server's speaker flag), 0: silent or muted, 1: speaking. */
export type SpeakerState = -1 | 0 | 1;

const FRAME_MS = 30;
type AudioContextConstructor = typeof AudioContext;
type Entry = { trackId: string; nodes: AudioNode[]; analyser: AnalyserNode; buffer: Float32Array<ArrayBuffer>; gate: SpeechGate; muted: boolean };

/**
 * Measures every participant's microphone level in the browser and keeps one speaking flag per identity.
 * Levels are sampled outside React; only a change of a flag notifies subscribers, so a quiet room costs no renders.
 */
export class SpeakerMonitor {
  private context: AudioContext | undefined;
  private unavailable = false;
  private readonly entries = new Map<string, Entry>();
  private readonly listeners = new Set<() => void>();
  private timer: ReturnType<typeof setInterval> | undefined;
  private readonly wake = () => { void this.context?.resume().catch(() => {}); };

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  snapshot(identity: string): SpeakerState {
    const entry = this.entries.get(identity);
    if (!entry || this.context?.state !== "running") return -1;
    return entry.muted || !entry.gate.isSpeaking ? 0 : 1;
  }

  /** Replaces the measured set: new tracks get an analyser, vanished or restarted ones lose theirs. */
  sync(sources: SpeakerSource[]) {
    let changed = false;
    const wanted = new Map(sources.filter(source => source.track).map(source => [source.identity, source]));
    for (const [identity, entry] of this.entries) {
      if (wanted.get(identity)?.track?.id !== entry.trackId) { this.release(identity); changed = true; }
    }
    for (const [identity, source] of wanted) {
      const existing = this.entries.get(identity);
      if (existing) {
        if (existing.muted !== source.muted) {
          existing.muted = source.muted;
          if (source.muted) existing.gate.reset();
          changed = true;
        }
      } else if (this.attach(identity, source)) changed = true;
    }
    if (this.entries.size && !this.timer) this.timer = setInterval(() => this.tick(), FRAME_MS);
    if (!this.entries.size && this.timer) { clearInterval(this.timer); this.timer = undefined; }
    if (changed) this.emit();
  }

  dispose() {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
    for (const identity of [...this.entries.keys()]) this.release(identity);
    window.removeEventListener("pointerdown", this.wake);
    window.removeEventListener("keydown", this.wake);
    void this.context?.close().catch(() => {});
    this.context = undefined;
  }

  private ensureContext(): AudioContext | undefined {
    if (this.context || this.unavailable) return this.context;
    const Constructor: AudioContextConstructor | undefined = window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioContextConstructor }).webkitAudioContext;
    try {
      if (!Constructor) throw new Error("AudioContext unsupported");
      this.context = new Constructor({ latencyHint: "interactive" });
      this.context.onstatechange = () => this.emit();
      // Browsers keep a context suspended until the page has seen a gesture; resume on the first one.
      window.addEventListener("pointerdown", this.wake);
      window.addEventListener("keydown", this.wake);
      void this.context.resume().catch(() => {});
    } catch {
      // No Web Audio: every participant keeps using the server's (slower) speaker flag.
      this.unavailable = true;
    }
    return this.context;
  }

  private attach(identity: string, source: SpeakerSource): boolean {
    const context = this.ensureContext();
    if (!context || !source.track) return false;
    try {
      const input = context.createMediaStreamSource(new MediaStream([source.track]));
      // Speech lives roughly between 150 Hz and 3.8 kHz; filtering out rumble and hiss keeps them from counting as a voice.
      const highpass = context.createBiquadFilter(); highpass.type = "highpass"; highpass.frequency.value = 150;
      const lowpass = context.createBiquadFilter(); lowpass.type = "lowpass"; lowpass.frequency.value = 3800;
      const analyser = context.createAnalyser(); analyser.fftSize = 1024; analyser.smoothingTimeConstant = 0;
      input.connect(highpass); highpass.connect(lowpass); lowpass.connect(analyser);
      this.entries.set(identity, { trackId: source.track.id, nodes: [input, highpass, lowpass, analyser], analyser, buffer: new Float32Array(analyser.fftSize), gate: new SpeechGate(), muted: source.muted });
      return true;
    } catch {
      return false;
    }
  }

  private release(identity: string) {
    this.entries.get(identity)?.nodes.forEach(node => { try { node.disconnect(); } catch { /* already disconnected */ } });
    this.entries.delete(identity);
  }

  private tick() {
    if (this.context?.state !== "running" || document.visibilityState === "hidden") return;
    const now = performance.now();
    let changed = false;
    for (const entry of this.entries.values()) {
      if (entry.muted) continue;
      entry.analyser.getFloatTimeDomainData(entry.buffer);
      let sum = 0;
      for (const sample of entry.buffer) sum += sample * sample;
      const before = entry.gate.isSpeaking;
      if (entry.gate.update(rmsToDb(Math.sqrt(sum / entry.buffer.length)), now) !== before) changed = true;
    }
    if (changed) this.emit();
  }

  private emit() {
    this.listeners.forEach(listener => listener());
  }
}

export function speakerSources(room: Room | undefined): SpeakerSource[] {
  if (!room) return [];
  return [room.localParticipant, ...room.remoteParticipants.values()].map(participant => {
    const publication = participant.getTrackPublication(Track.Source.Microphone);
    return { identity: participant.identity, track: publication?.track?.mediaStreamTrack, muted: !publication || publication.isMuted };
  });
}

/** One monitor per room view; re-synced whenever the set of microphone tracks or their mute state changes (the caller re-renders on every room event). */
export function useSpeakerMonitor(room: Room | undefined): SpeakerMonitor {
  const [monitor] = useState(() => new SpeakerMonitor());
  useEffect(() => () => monitor.dispose(), [monitor]);
  const signature = speakerSources(room).map(source => `${source.identity}:${source.track?.id ?? ""}:${source.muted ? 1 : 0}`).join("|");
  useEffect(() => { monitor.sync(speakerSources(room)); }, [monitor, room, signature]);
  return monitor;
}
