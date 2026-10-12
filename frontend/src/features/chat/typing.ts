import type { TypingPerson } from "./types";

/** While the user keeps typing, a "typing" signal is repeated at most this often (throttle). */
export const TYPING_RESEND_MS = 3_000;
/** Without a keystroke for this long the sender announces "stopped" (debounce). */
export const TYPING_IDLE_MS = 5_000;
/**
 * How long a received "typing" signal is believed without a fresh one. Longer than {@link TYPING_RESEND_MS} so one lost
 * signal does not flicker, and it is what clears the indicator when the sender's connection simply vanishes.
 */
export const TYPING_EXPIRE_MS = 7_000;
/** Hard bound on tracked typists, whatever the server sends. */
const MAX_TRACKED = 500;

export type TypingSnapshot = Record<string, TypingPerson[]>;

/**
 * Receiver side: who is typing, per conversation. Entries expire on their own, so a missing "stopped" signal (closed
 * tab, dropped connection) can never leave the indicator stuck. Browser-only; nothing is persisted.
 */
export class TypingTracker {
  private readonly entries = new Map<string, { conversationId: string; person: TypingPerson; timer: ReturnType<typeof setTimeout> }>();

  constructor(private readonly onChange: (snapshot: TypingSnapshot) => void, private readonly expireMs = TYPING_EXPIRE_MS) {}

  set(conversationId: string, person: TypingPerson) {
    const key = `${conversationId}:${person.userId}`;
    const existing = this.entries.get(key);
    if (existing) clearTimeout(existing.timer);
    else if (this.entries.size >= MAX_TRACKED) return;
    const timer = setTimeout(() => this.clear(conversationId, person.userId), this.expireMs);
    this.entries.set(key, { conversationId, person, timer });
    if (!existing || existing.person.nickname !== person.nickname) this.emit();
  }

  clear(conversationId: string, userId: string) {
    const key = `${conversationId}:${userId}`;
    const existing = this.entries.get(key);
    if (!existing) return;
    clearTimeout(existing.timer);
    this.entries.delete(key);
    this.emit();
  }

  clearAll() {
    if (this.entries.size === 0) return;
    this.entries.forEach((entry) => clearTimeout(entry.timer));
    this.entries.clear();
    this.emit();
  }

  private emit() {
    const snapshot: TypingSnapshot = {};
    this.entries.forEach((entry) => {
      (snapshot[entry.conversationId] ??= []).push(entry.person);
    });
    this.onChange(snapshot);
  }
}

/**
 * Sender side: turns keystrokes into a few signals. The first keystroke announces "typing" at once, further ones only
 * repeat it every {@link TYPING_RESEND_MS}; {@link TYPING_IDLE_MS} after the last keystroke (or when the box is cleared
 * or another conversation is used) "stopped" is announced. Sending a message needs no signal: the message itself
 * clears the indicator at the receiver, so {@link cancel} just forgets the state.
 */
export class TypingEmitter {
  private conversationId: string | null = null;
  private lastSent = 0;
  private idleTimer: ReturnType<typeof setTimeout> | undefined;

  private send: (conversationId: string, typing: boolean) => void;

  constructor(
    send: (conversationId: string, typing: boolean) => void = () => {},
    private readonly now: () => number = Date.now,
  ) {
    this.send = send;
  }

  /** Rebinds the transport; the owner calls it from an effect so the emitter itself never reads React refs. */
  setSender(send: (conversationId: string, typing: boolean) => void) {
    this.send = send;
  }

  typing(conversationId: string) {
    if (this.conversationId !== null && this.conversationId !== conversationId) this.stop();
    const time = this.now();
    if (this.conversationId === null || time - this.lastSent >= TYPING_RESEND_MS) {
      this.send(conversationId, true);
      this.lastSent = time;
    }
    this.conversationId = conversationId;
    clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => this.stop(), TYPING_IDLE_MS);
  }

  /** Announces "stopped" if "typing" was announced. */
  stop() {
    const conversationId = this.conversationId;
    this.cancel();
    if (conversationId !== null) this.send(conversationId, false);
  }

  /** Forgets the state without announcing anything (message sent, connection lost, chat left). */
  cancel() {
    clearTimeout(this.idleTimer);
    this.idleTimer = undefined;
    this.conversationId = null;
    this.lastSent = 0;
  }
}

/** Display names of the people typing, never more than two. `others` is how many more are typing. */
export function typingLabelParts(people: TypingPerson[]): { names: string[]; others: number } {
  const names = people.slice(0, 2).map((person) => person.nickname ?? "?");
  return { names, others: Math.max(people.length - 2, 0) };
}
