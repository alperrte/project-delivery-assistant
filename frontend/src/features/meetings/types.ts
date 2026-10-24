export type MeetingStatus = "SCHEDULED" | "OPEN" | "ENDED" | "CANCELLED";
/** The icons a meeting may carry: the backend allowlist (V55), in picker order. */
export const MEETING_ICONS = ["video", "users", "calendar", "presentation", "code", "laptop", "lightbulb", "target", "briefcase", "graduation-cap", "clipboard-list", "message-square"] as const;
export type MeetingIconName = (typeof MEETING_ICONS)[number];
export type MeetingInput = {
  title: string; description: string; startsAt: string; endsAt: string;
  zoneId: string; agenda: string[]; attendeeIds: string[];
  /** Omitted on update keeps the stored icon; a new meeting without one gets the video icon. */
  icon?: MeetingIconName;
  /** Create only: the server clock becomes the start, so a slow device clock cannot be refused as "in the past". */
  startNow?: boolean;
};
export type Meeting = MeetingInput & {
  id: string; projectId: string; organizerId: string; status: MeetingStatus;
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
  /** Set for signed-in members only; with the photo version it builds the PDA avatar URL. Guests and guest callers get null. */
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
