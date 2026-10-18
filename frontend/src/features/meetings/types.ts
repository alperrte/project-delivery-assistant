export type MeetingStatus = "SCHEDULED" | "OPEN" | "ENDED" | "CANCELLED";
export type MeetingInput = {
  title: string; description: string; startsAt: string; endsAt: string;
  zoneId: string; agenda: string[]; attendeeIds: string[];
};
export type Meeting = MeetingInput & {
  id: string; projectId: string; organizerId: string; status: MeetingStatus;
  openedAt: string | null; endedAt: string | null; overtime: boolean;
  chatRetained: boolean; version: number; roomEpoch: number;
  reconnectRequired: boolean; cleanupPending: boolean;
};
export type MeetingParticipant = {
  id: string; identity: string; displayName: string; guest: boolean;
  connected: boolean; revoked: boolean; joinedAt: string | null; leftAt: string | null;
};
export type MeetingJoin = {
  participantId: string; identity: string; roomEpoch: number; status: MeetingStatus;
  chatRetained: boolean; media: { url: string; token: string; expiresAt: string };
};
export type MeetingMessage = {
  id: string; participantId: string; displayName: string; content: string;
  sentAt: string; mentionIds: string[];
};
export type MeetingInvite = { id: string; token: string; expiresAt: string; maxUses: number };
export type MeetingInviteMetadata = { id: string; expiresAt: string; maxUses: number; uses: number; revoked: boolean };
export type GuestMeeting = Pick<Meeting, "id" | "title" | "startsAt" | "endsAt" | "zoneId" | "status" | "openedAt" | "overtime" | "chatRetained" | "agenda" | "roomEpoch" | "reconnectRequired">;
