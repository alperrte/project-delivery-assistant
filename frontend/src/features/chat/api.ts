import { apiRequest, apiUrl } from "@/lib/api/client";
import type { ChatConversation, ChatMember, ChatReceipt, ChatMessage, ChatMessagePage, ChatOverview, ReactionCode, ReactionSnapshot } from "./types";
import { normalizeChatMessage, validReactionSnapshot } from "./reactions";

import type { ChatMessageInfo } from "./types";
const chatPath = (accountId: string) => { void accountId; return `/chat`; };

export const chatApi = {
  search: (conversationId: string, q: string, page: number, signal?: AbortSignal) =>
    apiRequest<import("./types").ChatSearchPage>(`/chat/conversations/${conversationId}/messages/search?${new URLSearchParams({ q, page: String(page), size: "20" })}`, { signal })
      .then(result => ({ ...result, messages: result.messages.map(normalizeChatMessage) })),
  context: (conversationId: string, messageId: string, signal?: AbortSignal) =>
    apiRequest<import("./types").ChatMessageContext>(`/chat/conversations/${conversationId}/messages/${messageId}/context`, { signal })
      .then(result => ({ ...result, messages: result.messages.map(normalizeChatMessage) })),
  info: (conversationId: string,messageId: string,signal?:AbortSignal) => apiRequest<ChatMessageInfo>(`/chat/conversations/${conversationId}/messages/${messageId}/info`,{signal}),
  sendFile: (conversationId: string, file: File, content: string, reply?: string,signal?:AbortSignal) => {
    const body=new FormData();body.append("file",file);body.append("content",content);if(reply)body.append("replyToMessageId",reply);
    return apiRequest<ChatMessage>(`/chat/conversations/${conversationId}/messages/attachment`,{method:"POST",body,signal}).then(normalizeChatMessage);
  },
  /** The project group (created on first use), the caller's direct conversations and the unread total. */
  overview: (accountId: string, signal?: AbortSignal) => apiRequest<ChatOverview>(`${chatPath(accountId)}/conversations`, { signal }),
  /** The other active members of the project. */
  members: (accountId: string, signal?: AbortSignal) => apiRequest<ChatMember[]>(`${chatPath(accountId)}/members`, { signal }),
  /** Finds or creates the direct conversation with another member of the same project. */
  openDirect: (accountId: string, userId: string) =>
    apiRequest<ChatConversation>(`${chatPath(accountId)}/direct/${userId}`, { method: "POST" }),
  /** Newest page without a cursor; `before` pages back, `after` is the catch-up after a reconnect. */
  messages: (accountId: string, conversationId: string, params: { before?: string; after?: string; limit?: number } = {}, signal?: AbortSignal) => {
    const query = new URLSearchParams();
    if (params.before) query.set("before", params.before);
    if (params.after) query.set("after", params.after);
    if (params.limit) query.set("limit", String(params.limit));
    const queryString = query.toString();
    const suffix = queryString ? `?${queryString}` : "";
    return apiRequest<ChatMessagePage>(`${chatPath(accountId)}/conversations/${conversationId}/messages${suffix}`, { signal })
      .then(page => ({ ...page, messages: page.messages.map(normalizeChatMessage) }));
  },
  /** The sender is the signed-in user; the body carries nothing but the text. */
  send: (accountId: string, conversationId: string, content: string, replyToMessageId?: string | null, signal?: AbortSignal) =>
    apiRequest<ChatMessage>(`${chatPath(accountId)}/conversations/${conversationId}/messages`, {
      method: "POST",
      signal,
      body: { content, ...(replyToMessageId ? { replyToMessageId } : {}) },
    }).then(normalizeChatMessage),
  react: (accountId: string, conversationId: string, messageId: string, code: ReactionCode, add: boolean, signal?: AbortSignal) =>
    apiRequest<ReactionSnapshot>(`${chatPath(accountId)}/conversations/${conversationId}/messages/${messageId}/reactions/${code}`, { method: add ? "PUT" : "DELETE", signal })
      .then(snapshot => { if (!validReactionSnapshot(snapshot) || snapshot.messageId !== messageId) throw new Error("Invalid reaction contract"); return snapshot; }),
  reactionSnapshots: (accountId: string, conversationId: string, messageIds: string[], signal?: AbortSignal) =>
    apiRequest<ReactionSnapshot[]>(`${chatPath(accountId)}/conversations/${conversationId}/messages/reactions?${new URLSearchParams({ messageIds: messageIds.join(",") })}`, { signal })
      .then(snapshots => {
        const expected = new Set(messageIds), seen = new Set<string>();
        if (!Array.isArray(snapshots) || snapshots.length !== expected.size || snapshots.some(snapshot => {
          if (!validReactionSnapshot(snapshot) || !expected.has(snapshot.messageId) || seen.has(snapshot.messageId)) return true;
          seen.add(snapshot.messageId); return false;
        })) throw new Error("Invalid reaction batch contract");
        return snapshots;
      }),
  /** The other members' read markers of a conversation ("seen"). */
  receipts: (accountId: string, conversationId: string, signal?: AbortSignal) =>
    apiRequest<ChatReceipt[]>(`${chatPath(accountId)}/conversations/${conversationId}/receipts`, { signal }),
  /** Only the sender may delete; the text is erased for everybody and a tombstone stays. */
  deleteMessage: (accountId: string, conversationId: string, messageId: string, signal?: AbortSignal) =>
    apiRequest<void>(`${chatPath(accountId)}/conversations/${conversationId}/messages/${messageId}`, { method: "DELETE", signal }),
  /** Ephemeral "is typing" signal; the server derives the typist from the session and stores nothing. */
  typing: (accountId: string, conversationId: string, typing: boolean, signal?: AbortSignal) =>
    apiRequest<void>(`${chatPath(accountId)}/conversations/${conversationId}/typing`, { method: "POST", signal, body: { typing } }),
  markRead: (accountId: string, conversationId: string, messageIds: string[]) =>
    apiRequest<void>(`${chatPath(accountId)}/conversations/${conversationId}/read`, { method: "POST", body: {messageIds} }),
  markDelivered: (accountId: string, conversationId: string, messageIds: string[]) =>
    apiRequest<void>(`${chatPath(accountId)}/conversations/${conversationId}/delivered`, { method: "POST", body: { messageIds } }),
};

/**
 * WebSocket URL of the chat socket, derived from the API base (`http` becomes `ws`, `https` becomes `wss`). The
 * browser sends the HttpOnly session cookie with the handshake, so no token is ever put in the URL.
 */
export function chatSocketUrl(): string {
  const url = new URL(apiUrl("/ws"), typeof window === "undefined" ? "http://localhost" : window.location.href);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url.toString();
}
