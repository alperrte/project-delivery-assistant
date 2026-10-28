import { apiRequest } from "@/lib/api/client";
import type { Page } from "@/types/pagination";
import type { GuestMeeting, Meeting, MeetingInput, MeetingInvite, MeetingInviteMetadata, MeetingJoin, MeetingMessage, MeetingParticipant, MeetingPerson, MeetingStatus } from "./types";

/** Safety bound for the full list: 20 pages of 100 meetings. */
const MAX_LIST_PAGES = 20;
/** Meetings belong to the signed-in user, not to a project: no route here carries a project id. */
const root = "/meetings";
export const meetingsApi = {
  list: (page = 0, status?: MeetingStatus, signal?: AbortSignal) =>
    apiRequest<Page<Meeting>>(`${root}?page=${page}&size=12&sort=startsAt,desc${status ? `&status=${status}` : ""}`, { signal }),
  /**
   * Every meeting the user organizes or attends (pages of 100, at most MAX_LIST_PAGES pages). The list screen filters, searches, sorts and groups
   * this one set, so the tab counts, the search and the pagination always describe the same meetings.
   */
  listAll: async (signal?: AbortSignal) => {
    const content: Meeting[] = [];
    for (let page = 0; page < MAX_LIST_PAGES; page++) {
      // `hidden=EXCLUDE` (the default) leaves out what this user cleared from their own history; nobody else is affected.
      const result = await apiRequest<Page<Meeting>>(`${root}?page=${page}&size=100&sort=startsAt,desc&hidden=EXCLUDE`, { signal });
      content.push(...result.content);
      if (page + 1 >= result.totalPages) return { content, complete: true };
    }
    return { content, complete: false };
  },
  /** How many meetings this user has cleared from their own history. */
  hiddenCount: (signal?: AbortSignal) => apiRequest<{ count: number }>(`${root}/history`, { signal }),
  /** Hides this user's finished and cancelled meetings from their own list; no meeting data changes and nobody else is affected. */
  clearHistory: () => apiRequest<{ count: number }>(`${root}/history/clear`, { method: "POST" }),
  restoreHistory: () => apiRequest<{ count: number }>(`${root}/history/restore`, { method: "POST" }),
  detail: (id: string, signal?: AbortSignal) => apiRequest<Meeting>(`${root}/${id}`, { signal }),
  create: (body: MeetingInput, guard?: () => boolean) => apiRequest<Meeting>(root, { method: "POST", body, guard }),
  update: (id: string, body: MeetingInput, guard?: () => boolean) => apiRequest<Meeting>(`${root}/${id}`, { method: "PUT", body, guard }),
  action: (id: string, action: "start" | "cancel" | "end", guard?: () => boolean) => apiRequest<Meeting>(`${root}/${id}/${action}`, { method: "POST", guard }),
  invite: (id: string, body: { expiresAt: string; maxUses: number }) => apiRequest<MeetingInvite>(`${root}/${id}/invites`, { method: "POST", body }),
  invites: (id: string, page: number, signal?: AbortSignal) => apiRequest<Page<MeetingInviteMetadata>>(`${root}/${id}/invites?page=${page}&size=10`, { signal }),
  revokeInvite: (id: string, inviteId: string) => apiRequest(`${root}/${id}/invites/${inviteId}`, { method: "DELETE" }),
  moderate: (id: string, participantId: string, action: "mute" | "kick") => apiRequest(`${root}/${id}/participants/${participantId}/${action}`, { method: "POST" }),
  calendar: async (from: string, to: string, signal?: AbortSignal) => {
    const content: Meeting[] = [];
    for (let page = 0; ; page++) {
      const result = await apiRequest<Page<Meeting>>(`${root}/calendar?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&page=${page}&size=100`, { signal });
      content.push(...result.content);
      if (page + 1 >= result.totalPages) return content;
    }
  },
  /** People who can be invited: a nickname lookup over every active account, whatever projects they are in (id, nickname, photo version only). */
  searchPeople: (query: string, signal?: AbortSignal) => apiRequest<MeetingPerson[]>(`${root}/attendees/search?q=${encodeURIComponent(query)}`, { signal }),
};

/** Guest requests intentionally bypass PDA refresh while retaining the shared CSRF transport. */
export function meetingConnectionApi(meetingId: string, guest = false) {
  const path = guest ? `/meetings/guest/${meetingId}` : `${root}/${meetingId}`;
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
