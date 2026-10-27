export type MeetingStatus = "SCHEDULED" | "OPEN" | "ENDED" | "CANCELLED";
/** The icons a meeting may carry: the backend allowlist (V55), in picker order. */
export const MEETING_ICONS = ["video", "users", "calendar", "presentation", "code", "laptop", "lightbulb", "target", "briefcase", "graduation-cap", "clipboard-list", "message-square"] as const;
export type MeetingIconName = (typeof MEETING_ICONS)[number];
/** PROJECT: linked to one project when it was created. INDEPENDENT: no project. Either way access is only the organizer and the attendees. */
export type MeetingKind = "PROJECT" | "INDEPENDENT";
/** The project of a project meeting as the viewer may see it: null unless the viewer is a member of that project right now. */
export type MeetingProject = { id: string; slug: string; name: string; logoVersion: number | null; logoShape: "SQUARE" | "CIRCLE" | null };
export type MeetingInput = {
  /** Create only: the type is fixed when the meeting is created. PROJECT needs `projectId`; INDEPENDENT must not send one. */
  meetingType?: MeetingKind; projectId?: string | null;
  title: string; description: string; startsAt: string; endsAt: string;
  zoneId: string; agenda: string[]; attendeeIds: string[];
  /** Omitted on update keeps the stored icon; a new meeting without one gets the video icon. */
  icon?: MeetingIconName;
  /** Create only: the server clock becomes the start, so a slow device clock cannot be refused as "in the past". */
  startNow?: boolean;
};
/** Someone in a meeting: only what is needed to show them (never an e-mail address). */
export type MeetingPerson = { userId: string; nickname: string; profilePhotoVersion: number | null };
export type Meeting = MeetingInput & {
  /** Access is the organizer and the attendees only (a project meeting's project grants nothing). `attendees` are the display profiles of `attendeeIds`. */
  id: string; meetingType: MeetingKind; project: MeetingProject | null; organizerId: string; organizer: MeetingPerson | null; attendees: MeetingPerson[]; status: MeetingStatus;
  openedAt: string | null; endedAt: string | null; overtime: boolean;
  chatRetained: boolean; version: number; roomEpoch: number;
  reconnectRequired: boolean; cleanupPending: boolean;
  /** Stored icon name (older meetings: video). */
  icon: string;
  /** True when the signed-in member has cleared this finished meeting from their own history (only returned with `hidden=INCLUDE`/`ONLY`). */
  hidden: boolean;
};
export type MeetingParticipant = {
  id: string; identity: string; displayName: string; guest: boolean;
  connected: boolean; revoked: boolean; joinedAt: string | null; leftAt: string | null;
  /** Set for signed-in users only; with the photo version it builds the PDA avatar URL. Guests and guest callers get null. */
  userId: string | null; profilePhotoVersion: number | null;
};
export type MeetingJoin = {
  participantId: string; identity: string; roomEpoch: number; status: MeetingStatus;
  chatRetained: boolean; media: { url: string; token: string; expiresAt: string };
};
/** One emoji on a message: how many people, whether you are one of them, and the first names (the server bounds the list). */
export type MeetingReaction = { emoji: string; count: number; reactedByMe: boolean; reactors: { participantId: string; displayName: string }[] };
/** The answered message as a short quote from the server (never the whole history). */
export type MeetingReply = { id: string; participantId: string; displayName: string; preview: string };
export type MeetingMessage = {
  id: string; participantId: string; displayName: string; content: string;
  sentAt: string; mentionIds: string[];
  replyToMessageId?: string | null; replyTo?: MeetingReply | null; reactions?: MeetingReaction[];
};
export type MeetingInvite = { id: string; token: string; expiresAt: string; maxUses: number };
export type MeetingInviteMetadata = { id: string; expiresAt: string; maxUses: number; uses: number; revoked: boolean };
export type GuestMeeting = Pick<Meeting, "id" | "title" | "startsAt" | "endsAt" | "zoneId" | "status" | "openedAt" | "overtime" | "chatRetained" | "agenda" | "roomEpoch" | "reconnectRequired">;
