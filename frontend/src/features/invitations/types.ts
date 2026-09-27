import type { ProjectRole } from "@/features/projects/types";

export type InvitationStatus = "PENDING" | "ACCEPTED" | "REJECTED" | "CANCELLED" | "EXPIRED";

export type Invitation = {
  id: string;
  projectId: string;
  invitedUserId: string | null;
  email: string | null;
  invitedBy: string;
  initialRoles: ProjectRole[];
  status: InvitationStatus;
  createdAt: string;
  expiresAt: string;
};

export type CreatedInvitation = { invitationId: string; token: string; expiresAt: string };
