import type { ProjectRole } from "@/features/projects/types";

export type Squad = {
  id: string;
  projectId: string;
  name: string;
  description: string | null;
  parentTeamId: string | null;
  general: boolean;
  memberCount: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
};

export type SquadMember = {
  userId: string;
  nickname: string | null;
  email: string | null;
  roles: ProjectRole[];
  addedBy: string;
  addedAt: string;
};
