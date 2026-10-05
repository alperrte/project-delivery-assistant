import type { ChatMessage, ReactionCode, ReactionSnapshot } from "./types";

export const REACTION_EMOJI: Record<ReactionCode, string> = {
  THUMBS_UP: "👍", HEART: "❤️", LAUGH: "😂", SURPRISED: "😮", SAD: "😢", THANKS: "🙏",
};
export function validReactionVersion(value: unknown): value is string {
  return typeof value === "string" && /^(0|[1-9][0-9]{0,18})$/.test(value) && BigInt(value) <= BigInt("9223372036854775807");
}
export function newerReactionVersion(incoming: string, previous: string) {
  return validReactionVersion(incoming) && validReactionVersion(previous) && BigInt(incoming) > BigInt(previous);
}
export function validReactionSnapshot(value: unknown): value is ReactionSnapshot {
  if (!value || typeof value !== "object") return false;
  const snapshot = value as Partial<ReactionSnapshot>;
  if (typeof snapshot.messageId !== "string" || !snapshot.messageId.length || snapshot.messageId.length > 128 || !validReactionVersion(snapshot.reactionVersion) || !Array.isArray(snapshot.reactions) || snapshot.reactions.length > 6) return false;
  const seen = new Set<string>();
  return snapshot.reactions.every((item) => {
    if (!item || typeof item !== "object" || typeof item.code !== "string" || !Object.hasOwn(REACTION_EMOJI, item.code) || seen.has(item.code)) return false;
    seen.add(item.code);
    return item.emoji === REACTION_EMOJI[item.code] && Number.isSafeInteger(item.count) && item.count > 0 && typeof item.reactedByCurrentUser === "boolean";
  });
}
export function normalizeChatMessage(message: ChatMessage): ChatMessage {
  const result = { ...message, replyTo: message.replyTo ?? null, reactions: message.reactions ?? [], reactionVersion: message.reactionVersion ?? "0" };
  if (typeof result.id !== "string" || typeof result.conversationId !== "string" || result.conversationId.length > 128 || typeof result.content !== "string" || Array.from(result.content).length > 2000 ||
      typeof result.sender?.userId !== "string" || result.sender.userId.length > 128 || (result.sender.nickname != null && (typeof result.sender.nickname !== "string" || result.sender.nickname.length > 256)) || typeof result.createdAt !== "string" || result.createdAt.length > 64 ||
      !validReactionSnapshot({ messageId: result.id, reactionVersion: result.reactionVersion, reactions: result.reactions })) throw new Error("Invalid chat message contract");
  if (result.replyTo && (typeof result.replyTo.id !== "string" || result.replyTo.id.length > 128 || typeof result.replyTo.preview !== "string" || Array.from(result.replyTo.preview).length > 140 || typeof result.replyTo.sender?.userId !== "string")) throw new Error("Invalid chat reply contract");
  return result;
}

/** Short, bounded buffer for reaction frames that beat the corresponding MESSAGE/history page. */
export class ReactionBuffer {
  private entries = new Map<string, { conversationId: string; snapshot: ReactionSnapshot; expires: number }>();
  constructor(private now: () => number = Date.now, private max = 1000, private ttl = 120_000) { }
  put(conversationId: string, snapshot: ReactionSnapshot) {
    this.expire();
    const key = `${conversationId}:${snapshot.messageId}`;
    const old = this.entries.get(key);
    if (old && !newerReactionVersion(snapshot.reactionVersion, old.snapshot.reactionVersion)) return;
    this.entries.delete(key);
    this.entries.set(key, { conversationId, snapshot, expires: this.now() + this.ttl });
    if (this.entries.size > this.max) this.entries.delete(this.entries.keys().next().value!);
  }
  takeLoaded(conversationId: string, ids: Set<string>): ReactionSnapshot[] {
    this.expire();
    const result: ReactionSnapshot[] = [];
    for (const [key, item] of this.entries) if (item.conversationId === conversationId && ids.has(item.snapshot.messageId)) {
      result.push(item.snapshot); this.entries.delete(key);
    }
    return result;
  }
  clear() { this.entries.clear(); }
  private expire() { for (const [key, item] of this.entries) if (item.expires <= this.now()) this.entries.delete(key); }
}
