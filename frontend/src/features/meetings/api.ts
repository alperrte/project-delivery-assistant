import { apiRequest } from "@/lib/api/client";
import type { Page } from "@/types/pagination";
import type { GuestMeeting, Meeting, MeetingInput, MeetingInvite, MeetingInviteMetadata, MeetingJoin, MeetingMessage, MeetingParticipant, MeetingStatus } from "./types";

/** Safety bound for the full list: 20 pages of 100 meetings. */
const MAX_LIST_PAGES = 20;
const root = (projectId: string) => `/projects/${encodeURIComponent(projectId)}/meetings`;
export const meetingsApi = {
  list: (projectId: string, page = 0, status?: MeetingStatus, signal?: AbortSignal) =>
    apiRequest<Page<Meeting>>(`${root(projectId)}?page=${page}&size=12&sort=startsAt,desc${status ? `&status=${status}` : ""}`, { signal }),
  /**
   * Every meeting of the project (pages of 100, at most MAX_LIST_PAGES pages). The list screen filters, searches, sorts and groups
   * this one set, so the tab counts, the search and the pagination always describe the same meetings.
   */
  listAll: async (projectId: string, signal?: AbortSignal) => {
    const content: Meeting[] = [];
    for (let page = 0; page < MAX_LIST_PAGES; page++) {
      // `hidden=EXCLUDE` (the default) leaves out what this member cleared from their own history; nobody else is affected.
      const result = await apiRequest<Page<Meeting>>(`${root(projectId)}?page=${page}&size=100&sort=startsAt,desc&hidden=EXCLUDE`, { signal });
      content.push(...result.content);
      if (page + 1 >= result.totalPages) return { content, complete: true };
    }
    return { content, complete: false };
  },
  /** How many meetings this member has cleared from their own history in the project. */
  hiddenCount: (projectId: string, signal?: AbortSignal) => apiRequest<{ count: number }>(`${root(projectId)}/history`, { signal }),
  /** Hides this member's finished and cancelled meetings from their own list; no meeting data changes and nobody else is affected. */
  clearHistory: (projectId: string) => apiRequest<{ count: number }>(`${root(projectId)}/history/clear`, { method: "POST" }),
  restoreHistory: (projectId: string) => apiRequest<{ count: number }>(`${root(projectId)}/history/restore`, { method: "POST" }),
  detail: (projectId: string, id: string, signal?: AbortSignal) => apiRequest<Meeting>(`${root(projectId)}/${id}`, { signal }),
  create: (projectId: string, body: MeetingInput, guard?: () => boolean) => apiRequest<Meeting>(root(projectId), { method: "POST", body, guard }),
  update: (projectId: string, id: string, body: MeetingInput, guard?: () => boolean) => apiRequest<Meeting>(`${root(projectId)}/${id}`, { method: "PUT", body, guard }),
  action: (projectId: string, id: string, action: "start" | "cancel" | "end", guard?: () => boolean) => apiRequest<Meeting>(`${root(projectId)}/${id}/${action}`, { method: "POST", guard }),
  invite: (projectId: string, id: string, body: { expiresAt: string; maxUses: number }) => apiRequest<MeetingInvite>(`${root(projectId)}/${id}/invites`, { method: "POST", body }),
  invites: (projectId: string, id: string, page: number, signal?: AbortSignal) => apiRequest<Page<MeetingInviteMetadata>>(`${root(projectId)}/${id}/invites?page=${page}&size=10`, { signal }),
  revokeInvite: (projectId: string, id: string, inviteId: string) => apiRequest(`${root(projectId)}/${id}/invites/${inviteId}`, { method: "DELETE" }),
  moderate: (projectId: string, id: string, participantId: string, action: "mute" | "kick") => apiRequest(`${root(projectId)}/${id}/participants/${participantId}/${action}`, { method: "POST" }),
  calendar: async (projectId: string, from: string, to: string, signal?: AbortSignal) => {
    const content: Meeting[] = [];
    for (let page = 0; ; page++) {
      const result = await apiRequest<Page<Meeting>>(`${root(projectId)}/calendar?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&page=${page}&size=100`, { signal });
      content.push(...result.content);
      if (page + 1 >= result.totalPages) return content;
    }
  },
};

/** Guest requests intentionally bypass PDA refresh while retaining the shared CSRF transport. */
export function meetingConnectionApi(projectId: string | undefined, meetingId: string) {
  const path = projectId ? `${root(projectId)}/${meetingId}` : `/meetings/guest/${meetingId}`;
  return {
    join: (signal?: AbortSignal) => apiRequest<MeetingJoin>(`${path}/join`, { method: "POST", signal }),
    leave: () => apiRequest(`${path}/leave`, { method: "POST", keepalive: true }),
    participants: (signal?: AbortSignal) => apiRequest<MeetingParticipant[]>(`${path}/participants`, { signal }),
    chat: (page = 0, signal?: AbortSignal) => apiRequest<Page<MeetingMessage>>(`${path}/chat?page=${page}&size=50`, { signal }),
    send: (content: string, mentionIds: string[], replyToMessageId?: string) => apiRequest<MeetingMessage>(`${path}/chat`, { method: "POST", body: { content, mentionIds, replyToMessageId } }),
    message: (messageId: string, signal?: AbortSignal) => apiRequest<MeetingMessage>(`${path}/chat/${messageId}`, { signal }),
    /** The page of the newest-first history that holds this message (to reach an answered message that is not loaded yet). */
    locate: (messageId: string, signal?: AbortSignal) => apiRequest<{ messageId: string; page: number; size: number }>(`${path}/chat/${messageId}/page?size=50`, { signal }),
    react: (messageId: string, emoji: string) => apiRequest<MeetingMessage>(`${path}/chat/${messageId}/reactions`, { method: "PUT", body: { emoji } }),
    unreact: (messageId: string, emoji: string) => apiRequest<MeetingMessage>(`${path}/chat/${messageId}/reactions?emoji=${encodeURIComponent(emoji)}`, { method: "DELETE" }),
  };
}
export const createGuestSession = (inviteToken: string, displayName: string) => apiRequest<{ meetingId: string; participantId: string; expiresAt: string }>("/meetings/guest/session", { method: "POST", body: { inviteToken, displayName } });
export const previewGuestMeeting = (inviteToken: string, signal?: AbortSignal) => apiRequest<GuestMeeting>("/meetings/guest/preview", { method: "POST", body: { inviteToken }, signal });
export const guestMeetingState = (meetingId: string, signal?: AbortSignal) => apiRequest<GuestMeeting>(`/meetings/guest/${meetingId}/state`, { signal });
