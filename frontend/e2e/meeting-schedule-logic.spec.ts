import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import path from "node:path";

// Pure logic of the meeting form's planned time (no browser UI, no backend): UTC conversion, DST gaps and overlaps, midnight and
// the 24 hour limit, each evaluated in a Node process started with the viewer's time zone (TZ), because Date reads it at start-up.
const MODULE = path.resolve(__dirname, "../src/features/meetings/meeting-schedule.ts").replace(/\\/g, "/");
const NOW = Date.parse("2026-10-23T00:00:00Z");

type Case = [start: string, end: string, immediate?: boolean];
function evaluate(zone: string, cases: Case[], instants: string[] = []) {
  const script = `import { scheduleProblem, localDateTime, splitLocal, joinLocal } from "file:///${MODULE}";
    const cases = ${JSON.stringify(cases)}, instants = ${JSON.stringify(instants)};
    console.log(JSON.stringify({
      problems: cases.map(([start, end, immediate]) => scheduleProblem(start, end, Boolean(immediate), ${NOW})),
      iso: cases.map(([start]) => { const date = new Date(start); return Number.isFinite(date.getTime()) ? date.toISOString() : null; }),
      roundTrip: instants.map(value => new Date(joinLocal(splitLocal(localDateTime(value)))).toISOString()),
      local: instants.map(localDateTime),
    }));`;
  const out = execFileSync(process.execPath, ["--no-warnings", "--input-type=module", "-e", script], { env: { ...process.env, TZ: zone }, encoding: "utf8" });
  return JSON.parse(out) as { problems: (string | null)[]; iso: (string | null)[]; roundTrip: string[]; local: string[] };
}

test.describe("meeting schedule rules", () => {
  test("Europe/Istanbul (fixed UTC+3): instants, midnight, limits", () => {
    const result = evaluate("Europe/Istanbul", [
      ["2026-10-24T10:00", "2026-10-24T11:00"],           // ordinary
      ["2026-10-24T23:30", "2026-10-25T00:30"],           // crosses local midnight
      ["2026-10-24T10:00", "2026-10-25T10:00"],           // exactly 24 hours
      ["2026-10-24T10:00", "2026-10-25T10:01"],           // 24 hours and a minute
      ["2026-10-24T10:00", "2026-10-24T10:00"],           // empty
      ["2026-10-24T10:00", "2026-10-24T09:00"],           // ends before it starts
      ["2026-10-22T10:00", "2026-10-22T11:00"],           // in the past
      ["2026-10-22T10:00", "2026-10-23T09:00", true],     // "start now" ignores the typed start
      ["", "2026-10-24T11:00"],                           // incomplete
    ], ["2026-10-24T07:00:00.000Z", "2026-12-31T21:00:00.000Z"]);
    expect(result.problems).toEqual([null, null, null, "tooLong", "endBeforeStart", "endBeforeStart", "past", null, "incomplete"]);
    expect(result.iso[0]).toBe("2026-10-24T07:00:00.000Z");           // Istanbul is UTC+3 all year
    expect(result.iso[1]).toBe("2026-10-24T20:30:00.000Z");
    expect(result.local).toEqual(["2026-10-24T10:00", "2027-01-01T00:00"]);
    expect(result.roundTrip).toEqual(["2026-10-24T07:00:00.000Z", "2026-12-31T21:00:00.000Z"]);
  });

  test("America/New_York: spring-forward gap is rejected, fall-back overlap keeps the first occurrence", () => {
    const result = evaluate("America/New_York", [
      ["2027-03-14T02:30", "2027-03-14T04:00"],           // 02:30 does not exist on 14 March 2027
      ["2027-03-14T01:30", "2027-03-14T03:30"],           // valid, spans the gap: one real hour long
      ["2027-03-13T22:00", "2027-03-14T02:30"],           // the END falls in the gap
      ["2026-11-01T01:30", "2026-11-01T03:00"],           // 01:30 happens twice on 1 November 2026
    ], ["2026-11-01T05:30:00.000Z", "2026-11-01T06:30:00.000Z", "2027-03-14T07:30:00.000Z"]);
    expect(result.problems).toEqual(["nonexistent", null, "nonexistent", null]);
    expect(result.iso[3]).toBe("2026-11-01T05:30:00.000Z");           // first 01:30 (EDT, UTC-4)
    // A stored instant (either 01:30) edits back to the same instant when its local text is unambiguous, and the repeated hour resolves to the first one.
    expect(result.local[0]).toBe("2026-11-01T01:30");
    expect(result.local[1]).toBe("2026-11-01T01:30");
    expect(result.roundTrip[0]).toBe("2026-11-01T05:30:00.000Z");
    expect(result.roundTrip[2]).toBe("2027-03-14T07:30:00.000Z");     // 03:30 EDT, no round-trip drift
  });

  test("Europe/Berlin: last-Sunday-of-March gap and the 24 hour limit across a 23 hour day", () => {
    const result = evaluate("Europe/Berlin", [
      ["2027-03-28T02:30", "2027-03-28T04:00"],           // 02:30 does not exist
      ["2027-03-27T12:00", "2027-03-28T12:00"],           // 23 real hours (one hour skipped): within the limit
      ["2027-03-27T12:00", "2027-03-28T13:00"],           // 24 real hours: exactly the limit
      ["2027-03-27T12:00", "2027-03-28T13:01"],           // over the limit
    ]);
    expect(result.problems).toEqual(["nonexistent", null, null, "tooLong"]);
    expect(result.iso[1]).toBe("2027-03-27T11:00:00.000Z");           // CET, UTC+1
  });

  test("Pacific/Auckland (southern DST, UTC+13 in summer)", () => {
    const result = evaluate("Pacific/Auckland", [
      ["2026-10-24T10:00", "2026-10-24T11:00"],           // NZDT starts 27 Sep 2026: UTC+13
      ["2027-04-04T02:30", "2027-04-04T04:00"],           // 02:30 happens twice at the end of NZDT: first occurrence, valid
    ]);
    expect(result.problems).toEqual([null, null]);
    expect(result.iso[0]).toBe("2026-10-23T21:00:00.000Z");
  });
});
