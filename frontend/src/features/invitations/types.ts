import type { ProjectRole, ProjectStatus, ProjectType } from "@/features/projects/types";

export type InvitationStatus = "PENDING" | "ACCEPTED" | "REJECTED" | "CANCELLED" | "EXPIRED";

export type Invitation = {
  id: string;
  projectId: string;
  invitedUserId: string | null;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  message: string | null;
  nickname: string | null;
  invitedBy: string;
  invitedByNickname?: string | null;
  invitedByPhotoVersion?: number | null;
  profilePhotoVersion?: number | null;
  initialRoles: ProjectRole[];
  status: InvitationStatus;
  rejectionMessage: string | null;
  createdAt: string;
  expiresAt: string;
  teamId: string | null;
  teamName: string | null;
};

export type CreatedInvitation = { invitationId: string; token: string; expiresAt: string };

export type ExternalInvitationPreview = {
  projectName: string;
  inviterName: string;
  roles: ProjectRole[];
  message: string | null;
  email: string;
  firstName: string;
  lastName: string;
  expiresAt: string;
  status: "PENDING";
};

export type AcceptedExternalInvitation = { projectId: string; projectSlug: string };

export type MyInvitation = {
  id: string;
  projectId: string;
  projectName: string | null;
  invitedBy: string;
  invitedByNickname: string | null;
  invitedByPhotoVersion?: number | null;
  initialRoles: ProjectRole[];
  status: InvitationStatus;
  createdAt: string;
  expiresAt: string;
  message: string | null;
  teamName: string | null;
};

/** The invited account's card-level view; it does not confer project membership. */
export type InvitationProjectPreview = {
  projectId: string;
  slug: string;
  name: string;
  tagline: string | null;
  description: string | null;
  projectGoal: string | null;
  status: ProjectStatus;
  projectType: ProjectType;
  techStack: string | null;
  memberCount: number;
  updatedAt: string;
  logoVersion: number | null;
};
