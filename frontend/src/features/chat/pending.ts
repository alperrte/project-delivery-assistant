import type { PendingMessage } from "./types";

/** Same text with two different quoted targets must not acknowledge the wrong outbox item. */
export function pendingMatches(pending: PendingMessage, content: string, replyId?: string | null) {
  return pending.status === "sending" && pending.content === content && (pending.replyTo?.id ?? null) === (replyId ?? null);
}
