/**
 * Decides, from a stream of microphone levels, whether someone is speaking.
 *
 * The LiveKit server also reports active speakers, but it measures levels on its own interval, smooths them over several
 * intervals and only reports voices above a fixed loudness, so the indicator lags behind speech and misses quiet voices.
 * This gate runs on the audio each browser already holds (local microphone, remote tracks), so it reacts in tens of
 * milliseconds and adapts to the room instead of using one fixed loudness.
 *
 * - Adaptive noise floor: falls quickly to quieter input, rises very slowly, and is frozen while someone speaks, so a long
 *   monologue cannot raise the bar for itself.
 * - Hysteresis: the level to start must exceed the level to keep going, so a voice hovering near the limit does not flicker.
 * - Attack: a few consecutive loud frames are needed, which rejects single key clicks and bumps without a visible delay.
 * - Release: the indicator stays through short pauses between words and ends soon after real silence.
 */
export type SpeechGateOptions = {
  /** Quietest level (dBFS, band-limited RMS) that may ever count as speech, however silent the room is. */
  minimumOnDb: number;
  /** How far above the noise floor speech has to be to start. */
  marginDb: number;
  /** How far below the start level the signal may fall before the release timer starts. */
  hysteresisDb: number;
  /** Consecutive frames above the start level before speech is reported. */
  attackFrames: number;
  /** How long the level has to stay below the stop level before speech ends. */
  releaseMs: number;
  /** Upper bound for the learned noise floor, so a permanently loud room cannot silence the indicator. */
  maximumFloorDb: number;
};

export const DEFAULT_SPEECH_GATE: SpeechGateOptions = {
  minimumOnDb: -52,
  marginDb: 9,
  hysteresisDb: 5,
  attackFrames: 2,
  releaseMs: 320,
  maximumFloorDb: -44,
};

const INITIAL_FLOOR_DB = -62;
const SILENCE_DB = -100;

export function rmsToDb(rms: number): number {
  return rms > 0 ? Math.max(SILENCE_DB, 20 * Math.log10(rms)) : SILENCE_DB;
}

export class SpeechGate {
  private floorDb = INITIAL_FLOOR_DB;
  private loudFrames = 0;
  private belowSince: number | null = null;
  private speaking = false;

  constructor(private readonly options: SpeechGateOptions = DEFAULT_SPEECH_GATE) {}

  get isSpeaking(): boolean {
    return this.speaking;
  }

  get noiseFloorDb(): number {
    return this.floorDb;
  }

  /** The level that starts speech right now. */
  get startDb(): number {
    return Math.max(this.options.minimumOnDb, this.floorDb + this.options.marginDb);
  }

  /** A muted source is never speaking; forget what was learned so the next unmute starts clean. */
  reset(): void {
    this.floorDb = INITIAL_FLOOR_DB;
    this.loudFrames = 0;
    this.belowSince = null;
    this.speaking = false;
  }

  /** Feed one level (dBFS) taken at `nowMs`; returns whether the source counts as speaking after this frame. */
  update(levelDb: number, nowMs: number): boolean {
    const { hysteresisDb, attackFrames, releaseMs, maximumFloorDb } = this.options;
    if (!this.speaking) {
      // Quieter input pulls the floor down at once; louder input nudges it up slowly (about 20 s time constant at 30 ms frames).
      this.floorDb = levelDb < this.floorDb
        ? this.floorDb + (levelDb - this.floorDb) * 0.2
        : Math.min(maximumFloorDb, this.floorDb + (levelDb - this.floorDb) * 0.0015);
    }
    const start = this.startDb;
    if (!this.speaking) {
      this.loudFrames = levelDb >= start ? this.loudFrames + 1 : 0;
      if (this.loudFrames >= attackFrames) {
        this.speaking = true;
        this.belowSince = null;
      }
      return this.speaking;
    }
    if (levelDb >= start - hysteresisDb) {
      this.belowSince = null;
    } else {
      this.belowSince ??= nowMs;
      if (nowMs - this.belowSince >= releaseMs) {
        this.speaking = false;
        this.loudFrames = 0;
        this.belowSince = null;
      }
    }
    return this.speaking;
  }
}
