import { apiRequest, apiUrl } from "@/lib/api/client";
import type { ChatConversation, ChatMember, ChatMessage, ChatMessagePage, ChatOverview } from "./types";

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
    return apiRequest<ChatMessagePage>(`${chatPath(projectId)}/conversations/${conversationId}/messages${suffix}`, { signal });
  },
  /** The sender is the signed-in user; the body carries nothing but the text. */
  send: (projectId: string, conversationId: string, content: string) =>
    apiRequest<ChatMessage>(`${chatPath(projectId)}/conversations/${conversationId}/messages`, {
      method: "POST",
      body: { content },
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
