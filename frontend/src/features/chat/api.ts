import { apiRequest, apiUrl } from "@/lib/api/client";
import type { ChatConversation, ChatMember, ChatMessage, ChatMessagePage, ChatOverview, ReactionCode, ReactionSnapshot } from "./types";
import { normalizeChatMessage, validReactionSnapshot } from "./reactions";

const chatPath = (projectId: string) => `/projects/${projectId}/chat`;

export const chatApi = {
  /** The project group (created on first use), the caller's direct conversations and the unread total. */
  overview: (projectId: string, signal?: AbortSignal) => apiRequest<ChatOverview>(`${chatPath(projectId)}/conversations`, { signal }),
  /** The other active members of the project. */
  members: (projectId: string, signal?: AbortSignal) => apiRequest<ChatMember[]>(`${chatPath(projectId)}/members`, { signal }),
  /** Finds or creates the direct conversation with another member of the same project. */
  openDirect: (projectId: string, userId: string) =>
    apiRequest<ChatConversation>(`${chatPath(projectId)}/direct/${userId}`, { method: "POST" }),
  /** Newest page without a cursor; `before` pages back, `after` is the catch-up after a reconnect. */
  messages: (projectId: string, conversationId: string, params: { before?: string; after?: string; limit?: number } = {}, signal?: AbortSignal) => {
    const query = new URLSearchParams();
    if (params.before) query.set("before", params.before);
    if (params.after) query.set("after", params.after);
    if (params.limit) query.set("limit", String(params.limit));
    const queryString = query.toString();
    const suffix = queryString ? `?${queryString}` : "";
    return apiRequest<ChatMessagePage>(`${chatPath(projectId)}/conversations/${conversationId}/messages${suffix}`, { signal })
      .then(page => ({ ...page, messages: page.messages.map(normalizeChatMessage) }));
  },
  /** The sender is the signed-in user; the body carries nothing but the text. */
  send: (projectId: string, conversationId: string, content: string, replyToMessageId?: string | null, signal?: AbortSignal) =>
    apiRequest<ChatMessage>(`${chatPath(projectId)}/conversations/${conversationId}/messages`, {
      method: "POST",
      signal,
      body: { content, ...(replyToMessageId ? { replyToMessageId } : {}) },
    }).then(normalizeChatMessage),
  react: (projectId: string, conversationId: string, messageId: string, code: ReactionCode, add: boolean, signal?: AbortSignal) =>
    apiRequest<ReactionSnapshot>(`${chatPath(projectId)}/conversations/${conversationId}/messages/${messageId}/reactions/${code}`, { method: add ? "PUT" : "DELETE", signal })
      .then(snapshot => { if (!validReactionSnapshot(snapshot) || snapshot.messageId !== messageId) throw new Error("Invalid reaction contract"); return snapshot; }),
  reactionSnapshots: (projectId: string, conversationId: string, messageIds: string[], signal?: AbortSignal) =>
    apiRequest<ReactionSnapshot[]>(`${chatPath(projectId)}/conversations/${conversationId}/messages/reactions?${new URLSearchParams({ messageIds: messageIds.join(",") })}`, { signal })
      .then(snapshots => {
        const expected = new Set(messageIds), seen = new Set<string>();
        if (!Array.isArray(snapshots) || snapshots.length !== expected.size || snapshots.some(snapshot => {
          if (!validReactionSnapshot(snapshot) || !expected.has(snapshot.messageId) || seen.has(snapshot.messageId)) return true;
          seen.add(snapshot.messageId); return false;
        })) throw new Error("Invalid reaction batch contract");
        return snapshots;
      }),
  markRead: (projectId: string, conversationId: string) =>
    apiRequest<void>(`${chatPath(projectId)}/conversations/${conversationId}/read`, { method: "POST" }),
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
