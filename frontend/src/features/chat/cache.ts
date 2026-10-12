import type { InfiniteData, QueryClient } from "@tanstack/react-query";
import { previewOf } from "./limits";
import type { ChatConversation, ChatMessage, ChatReceipt, ChatMessagePage, ChatOverview, ReactionSnapshot } from "./types";
import { newerReactionVersion, normalizeChatMessage } from "./reactions";

/** Query keys of one project's chat. Everything is nested under the project id, so projects never share state. */
export const chatKeys = {
  all: (accountId: string) => ["accounts", accountId, "chat"] as const,
  overview: (accountId: string) => ["accounts", accountId, "chat", "overview"] as const,
  members: (accountId: string) => ["accounts", accountId, "chat", "members"] as const,
  infoFamily: (accountId: string) => ["accounts", accountId, "chat", "info"] as const,
  infoRoot: (accountId: string, conversationId: string) => ["accounts", accountId, "chat", "info", conversationId] as const,
  info: (accountId: string, conversationId: string, messageId: string) => ["accounts", accountId, "chat", "info", conversationId, messageId] as const,
  receipts: (accountId: string, conversationId: string) =>
    ["accounts", accountId, "chat", "receipts", conversationId] as const,
  receiptsRoot: (accountId: string) => ["accounts", accountId, "chat", "receipts"] as const,
  messagesRoot: (accountId: string) => ["accounts", accountId, "chat", "messages"] as const,
  messages: (accountId: string, conversationId: string) =>
    ["accounts", accountId, "chat", "messages", conversationId] as const,
};

export type MessagePages = InfiniteData<ChatMessagePage, unknown>;

/** Every loaded message of a conversation, oldest first. Page 0 is the newest, later pages are older. */
export function flattenMessages(data: MessagePages | undefined): ChatMessage[] {
  if (!data) return [];
  const seen = new Set<string>();
  const result: ChatMessage[] = [];
  for (const page of [...data.pages].reverse()) {
    for (const message of page.messages) {
      if (seen.has(message.id)) continue;
      seen.add(message.id);
      result.push(message);
    }
  }
  return result;
}

/**
 * Adds a message to a conversation that is already loaded (a conversation nobody opened is simply fetched fresh when
 * it is opened). Messages are identified by id, so the same message arriving over the socket, the REST response and
 * a reconnect catch-up lands exactly once.
 */
export function appendMessages(queryClient: QueryClient, accountId: string, conversationId: string, incoming: ChatMessage[]) {
  queryClient.setQueryData<MessagePages>(chatKeys.messages(accountId, conversationId), (old) => {
    if (!old || old.pages.length === 0) return old;
    const known = new Set(old.pages.flatMap((page) => page.messages.map((message) => message.id)));
    const fresh = incoming.map(normalizeChatMessage).filter((message) => message.conversationId === conversationId && !known.has(message.id));
    const updates = new Map(incoming.map(message => [message.id, normalizeChatMessage(message)]));
    const pages = old.pages.map(page => ({ ...page, messages: page.messages.map(message => {
      const update = updates.get(message.id);
      if (!update || update.conversationId !== conversationId) return message;
      const newer = newerReactionVersion(update.reactionVersion, message.reactionVersion ?? "0");
      return { ...message, ...update, replyTo: update.replyTo ?? message.replyTo ?? null,
        reactions: newer ? update.reactions : message.reactions ?? [],
        reactionVersion: newer ? update.reactionVersion : message.reactionVersion ?? "0" };
    }) }));
    const [newest, ...rest] = pages;
    return { ...old, pages: [{ ...newest, messages: [...newest.messages, ...fresh] }, ...rest] };
  });
}

/** Absolute, personalized snapshots: no counter increments, no phantom messages. */
export function applyReactionSnapshots(queryClient: QueryClient, accountId: string, conversationId: string, incoming: ReactionSnapshot[]): Set<string> {
  const key = chatKeys.messages(accountId, conversationId);
  const old = queryClient.getQueryData<MessagePages>(key);
  const found = new Set<string>();
  if (!old) return found;
  const snapshots = new Map(incoming.map(snapshot => [snapshot.messageId, snapshot]));
  let changed = false;
  const pages = old.pages.map(page => ({ ...page, messages: page.messages.map(message => {
    const snapshot = snapshots.get(message.id);
    if (!snapshot || message.conversationId !== conversationId) return message;
    found.add(message.id);
    if (!newerReactionVersion(snapshot.reactionVersion, message.reactionVersion ?? "0")) return message;
    changed = true;
    return { ...message, reactionVersion: snapshot.reactionVersion, reactions: snapshot.reactions };
  }) }));
  if (changed) queryClient.setQueryData(key, { ...old, pages });
  return found;
}

/**
 * Turns a message into its tombstone in a loaded conversation (text and reactions dropped) and marks the replies that
 * quote it. Idempotent, so the socket event, the REST answer and a catch-up can all apply it.
 */
export function applyMessageDeleted(queryClient: QueryClient, accountId: string, conversationId: string, messageId: string) {
  queryClient.setQueryData<MessagePages>(chatKeys.messages(accountId, conversationId), (old) => {
    if (!old) return old;
    let changed = false;
    const pages = old.pages.map((page) => ({
      ...page,
      messages: page.messages.map((message) => {
        if (message.id === messageId && !message.deleted) {
          changed = true;
          return { ...message, deleted: true, content: "", reactions: [], replyTo: null };
        }
        if (message.replyTo?.id === messageId && !message.replyTo.deleted) {
          changed = true;
          return { ...message, replyTo: { ...message.replyTo, deleted: true, preview: "" } };
        }
        return message;
      }),
    }));
    return changed ? { ...old, pages } : old;
  });
}

/** Records that `userId` read the conversation up to `readAt` (markers only move forward). Not-yet-loaded lists are left alone. */
export function applySeen(queryClient: QueryClient, accountId: string, conversationId: string, userId: string, readAt: string) {
  queryClient.setQueryData<ChatReceipt[]>(chatKeys.receipts(accountId, conversationId), (old) => {
    if (!old) return old;
    const known = old.find((receipt) => receipt.userId === userId);
    if (known && Date.parse(known.readAt) >= Date.parse(readAt)) return old;
    return known ? old.map((receipt) => (receipt.userId === userId ? { userId, readAt } : receipt)) : [...old, { userId, readAt }];
  });
}

/** The id of the newest confirmed message of a loaded conversation, the cursor for a reconnect catch-up. */
export function newestMessageId(data: MessagePages | undefined): string | undefined {
  const all = flattenMessages(data);
  return all.length > 0 ? all[all.length - 1].id : undefined;
}

function withTotals(overview: ChatOverview): ChatOverview {
  const totalUnread = (overview.groups ?? []).reduce((sum, group) => sum + group.unread, 0) + overview.directs.reduce((sum, direct) => sum + direct.unread, 0);
  return { ...overview, totalUnread };
}

function mapConversation(
  overview: ChatOverview,
  conversationId: string,
  update: (conversation: ChatConversation) => ChatConversation,
): { overview: ChatOverview; found: boolean } {
  let found = false;
  const apply = (conversation: ChatConversation) => {
    if (conversation.id !== conversationId) return conversation;
    found = true;
    return update(conversation);
  };
  const next = { ...overview, group: overview.group ? apply(overview.group) : null, groups: (overview.groups ?? []).map(apply), directs: overview.directs.map(apply) };
  return { overview: withTotals(next), found };
}

/**
 * Applies one confirmed message to the conversation list: newest-message preview and, when it is somebody else's and
 * the user is not looking at it, one more unread. Returns false when the conversation is not in the list yet (a first
 * direct message from someone), so the caller can refetch the list instead.
 */
export function applyMessageToOverview(
  queryClient: QueryClient,
  accountId: string,
  message: ChatMessage,
  options: { mine: boolean; viewing: boolean },
): boolean {
  const key = chatKeys.overview(accountId);
  const old = queryClient.getQueryData<ChatOverview>(key);
  if (!old) return true;
  const { overview, found } = mapConversation(old, message.conversationId, (conversation) => ({
    ...conversation,
    lastMessage: { preview: previewOf(message.content), createdAt: message.createdAt, senderUserId: message.sender.userId },
    unread: conversation.unread + (!options.mine && !options.viewing ? 1 : 0),
  }));
  if (found) queryClient.setQueryData(key, overview);
  return found;
}

/** The user read a conversation (here or in another tab): its unread count is zero. */
export function applyReadToOverview(queryClient: QueryClient, accountId: string, conversationId: string) {
  queryClient.setQueryData<ChatOverview>(chatKeys.overview(accountId), (old) =>
    old ? mapConversation(old, conversationId, (conversation) => ({ ...conversation, unread: 0 })).overview : old,
  );
}
