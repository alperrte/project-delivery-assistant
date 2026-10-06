import type { ProjectRole, UserRef } from "@/features/projects/types";

export type TeamLastJoined = { userId: string; nickname: string | null; joinedAt: string };
export type TeamMemberPreview = { userId: string; nickname: string | null; profilePhotoVersion?: number | null; firstName?: string | null; lastName?: string | null };

export type Team = {
  id: string;
  projectId: string;
  name: string;
  description: string | null;
  parentTeamId: string | null;
  memberCount: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  updatedBy: UserRef;
  /** Newest members first, at most five. */
  memberPreview: TeamMemberPreview[];
  lastJoined: TeamLastJoined | null;
};

export type TeamRef = { id: string; name: string };

export type TeamMember = {
  userId: string;
  nickname: string | null;
  profilePhotoVersion?: number | null;
  email: string | null;
  roles: ProjectRole[];
  addedBy: string;
  addedAt: string;
  otherTeams: TeamRef[];
};

/** `PROJECT_MEMBER` is added straight away, `NONE` has to be invited. */
export type TeamCandidateStatus = "TEAM_MEMBER" | "PROJECT_MEMBER" | "INVITED" | "NONE";
export type TeamCandidate = { userId: string; nickname: string; status: TeamCandidateStatus };
