import { test, expect } from "@playwright/test";
import { DEFAULT_SPEECH_GATE, SpeechGate, rmsToDb } from "../src/features/meetings/room/speech-gate";
import { canShareScreen, screenShareMessage } from "../src/features/meetings/room/screen-share";

// Pure logic of the meeting room (no browser, no backend): speaking detection and screen-share error mapping.
const FRAME = 30;
/** Feeds `ms` of constant level and returns the first time (ms into the burst) at which the gate reported speech, or null. */
function burst(gate: SpeechGate, db: number, ms: number, start: number) {
  let firstOn: number | null = null;
  for (let t = 0; t < ms; t += FRAME) if (gate.update(db, start + t + FRAME) && firstOn === null) firstOn = t + FRAME;
  return { firstOn, end: start + ms };
}

test.describe("SpeechGate", () => {
  test("speech starts within two frames", () => {
    const gate = new SpeechGate();
    expect(burst(gate, -35, 300, 0).firstOn).toBe(FRAME * DEFAULT_SPEECH_GATE.attackFrames);
    expect(gate.isSpeaking).toBe(true);
  });

  test("a quiet voice is detected, room noise is not", () => {
    const quiet = new SpeechGate();
    burst(quiet, -63, 1000, 0);
    expect(burst(quiet, -48, 300, 1000).firstOn).not.toBeNull();
    const noisy = new SpeechGate();
    expect(burst(noisy, -58, 5000, 0).firstOn).toBeNull();
  });

  test("a single key click or bump does not count as speech", () => {
    const gate = new SpeechGate();
    burst(gate, -65, 600, 0);
    gate.update(-25, 630);
    burst(gate, -65, 600, 660);
    expect(gate.isSpeaking).toBe(false);
  });

  test("a short pause keeps the indicator on, real silence ends it soon after", () => {
    const gate = new SpeechGate();
    let now = burst(gate, -35, 600, 0).end;
    now = burst(gate, -80, 200, now).end;
    expect(gate.isSpeaking).toBe(true);
    now = burst(gate, -35, 300, now).end;
    burst(gate, -80, 1000, now);
    expect(gate.isSpeaking).toBe(false);
    // Released within the release time plus two frames of the last voiced frame.
    const probe = new SpeechGate();
    let t = burst(probe, -35, 300, 0).end;
    let off: number | null = null;
    for (let i = 1; i <= 40 && off === null; i++) { t += FRAME; if (!probe.update(-80, t)) off = i * FRAME; }
    expect(off).not.toBeNull();
    expect(off!).toBeLessThanOrEqual(DEFAULT_SPEECH_GATE.releaseMs + 2 * FRAME);
  });

  test("hysteresis: a level just under the start level does not release", () => {
    const gate = new SpeechGate();
    burst(gate, -40, 300, 0);
    const between = gate.startDb - DEFAULT_SPEECH_GATE.hysteresisDb + 1;
    burst(gate, between, 2000, 300);
    expect(gate.isSpeaking).toBe(true);
  });

  test("the noise floor does not climb while someone speaks, and a mute resets the gate", () => {
    const gate = new SpeechGate();
    burst(gate, -63, 1000, 0);
    const before = gate.noiseFloorDb;
    burst(gate, -35, 60_000, 1000);
    // Only the two attack frames before speech is confirmed may nudge the floor (by well under a decibel).
    expect(Math.abs(gate.noiseFloorDb - before)).toBeLessThan(0.2);
    gate.reset();
    expect(gate.isSpeaking).toBe(false);
  });

  test("a permanently loud room cannot raise the bar past the cap", () => {
    const gate = new SpeechGate();
    burst(gate, -30, 600_000, 0);
    expect(gate.noiseFloorDb).toBeLessThanOrEqual(DEFAULT_SPEECH_GATE.maximumFloorDb);
  });

  test("rmsToDb", () => {
    expect(rmsToDb(1)).toBeCloseTo(0);
    expect(rmsToDb(0.1)).toBeCloseTo(-20);
    expect(rmsToDb(0)).toBe(-100);
  });
});

test.describe("screen sharing helpers", () => {
  const named = (name: string, message = "") => Object.assign(new Error(message), { name });

  test("maps failures to the four user messages", () => {
    expect(screenShareMessage(named("DeviceUnsupportedError", "getDisplayMedia not supported"))).toBe("screenShareUnsupported");
    expect(screenShareMessage(named("NotSupportedError"))).toBe("screenShareUnsupported");
    expect(screenShareMessage(named("AbortError"))).toBe("screenShareCancelled");
    expect(screenShareMessage(named("NotAllowedError", "Permission denied"))).toBe("screenShareCancelled");
    expect(screenShareMessage(named("NotAllowedError", "Permission denied by system"))).toBe("screenShareDenied");
    expect(screenShareMessage(named("NotAllowedError", "disallowed by permissions policy"))).toBe("screenShareDenied");
    expect(screenShareMessage(named("SecurityError"))).toBe("screenShareDenied");
    expect(screenShareMessage(named("NotReadableError"))).toBe("screenShareFailed");
    expect(screenShareMessage("boom")).toBe("screenShareFailed");
  });

  test("a browser without getDisplayMedia (every phone browser, insecure pages) is reported as unsupported", () => {
    const original = Object.getOwnPropertyDescriptor(globalThis, "navigator");
    const set = (value: unknown) => Object.defineProperty(globalThis, "navigator", { value, configurable: true });
    try {
      set({});
      expect(canShareScreen()).toBe(false);
      set({ mediaDevices: {} });
      expect(canShareScreen()).toBe(false);
      expect(screenShareMessage(named("TypeError"))).toBe("screenShareUnsupported");
      set({ mediaDevices: { getDisplayMedia: () => Promise.resolve() } });
      expect(canShareScreen()).toBe(true);
    } finally {
      if (original) Object.defineProperty(globalThis, "navigator", original); else Reflect.deleteProperty(globalThis, "navigator");
    }
  });
});
