// "Start now" opens the call and joins it. That intent is a one-time, short-lived note this tab keeps for that one meeting, never a
// link parameter: a link someone else sends can therefore never make a person join a call just by being opened.
const KEY = "pda:meeting-autojoin:v1";
const FRESH_MS = 60_000;

export function markAutoJoin(meetingId: string) {
  try { window.sessionStorage.setItem(KEY, JSON.stringify({ meetingId, at: Date.now() })); } catch { /* the person then joins with the button */ }
}

/** True once for the meeting that was just started from the form in this tab; the note is always removed. */
export function consumeAutoJoin(meetingId: string): boolean {
  try {
    const raw = window.sessionStorage.getItem(KEY);
    window.sessionStorage.removeItem(KEY);
    const note = raw ? JSON.parse(raw) as { meetingId?: unknown; at?: unknown } : null;
    return note?.meetingId === meetingId && typeof note.at === "number" && Date.now() - note.at >= 0 && Date.now() - note.at < FRESH_MS;
  } catch { return false; }
}
