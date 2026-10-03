import type { InfiniteData, QueryClient } from "@tanstack/react-query";
import { previewOf } from "./limits";
import type { ChatConversation, ChatMessage, ChatMessagePage, ChatOverview } from "./types";

/** Query keys of one project's chat. Everything is nested under the project id, so projects never share state. */
export const chatKeys = {
  all: (projectId: string) => ["projects", projectId, "chat"] as const,
  overview: (projectId: string) => ["projects", projectId, "chat", "overview"] as const,
  members: (projectId: string) => ["projects", projectId, "chat", "members"] as const,
  messagesRoot: (projectId: string) => ["projects", projectId, "chat", "messages"] as const,
  messages: (projectId: string, conversationId: string) =>
    ["projects", projectId, "chat", "messages", conversationId] as const,
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
export function appendMessages(queryClient: QueryClient, projectId: string, conversationId: string, incoming: ChatMessage[]) {
  queryClient.setQueryData<MessagePages>(chatKeys.messages(projectId, conversationId), (old) => {
    if (!old || old.pages.length === 0) return old;
    const known = new Set(old.pages.flatMap((page) => page.messages.map((message) => message.id)));
    const fresh = incoming.filter((message) => !known.has(message.id));
    if (fresh.length === 0) return old;
    const [newest, ...rest] = old.pages;
    return { ...old, pages: [{ ...newest, messages: [...newest.messages, ...fresh] }, ...rest] };
  });
}

/** The id of the newest confirmed message of a loaded conversation, the cursor for a reconnect catch-up. */
export function newestMessageId(data: MessagePages | undefined): string | undefined {
  const all = flattenMessages(data);
  return all.length > 0 ? all[all.length - 1].id : undefined;
}

function withTotals(overview: ChatOverview): ChatOverview {
  const totalUnread = overview.group.unread + overview.directs.reduce((sum, direct) => sum + direct.unread, 0);
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
  const next = { ...overview, group: apply(overview.group), directs: overview.directs.map(apply) };
  return { overview: withTotals(next), found };
}

/**
 * Applies one confirmed message to the conversation list: newest-message preview and, when it is somebody else's and
 * the user is not looking at it, one more unread. Returns false when the conversation is not in the list yet (a first
 * direct message from someone), so the caller can refetch the list instead.
 */
export function applyMessageToOverview(
  queryClient: QueryClient,
  projectId: string,
  message: ChatMessage,
  options: { mine: boolean; viewing: boolean },
): boolean {
  const key = chatKeys.overview(projectId);
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
export function applyReadToOverview(queryClient: QueryClient, projectId: string, conversationId: string) {
  queryClient.setQueryData<ChatOverview>(chatKeys.overview(projectId), (old) =>
    old ? mapConversation(old, conversationId, (conversation) => ({ ...conversation, unread: 0 })).overview : old,
  );
}
