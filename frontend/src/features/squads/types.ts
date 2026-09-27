export type Squad = {
  id: string;
  projectId: string;
  name: string;
  description: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
};

export type SquadMember = {
  userId: string;
  nickname: string | null;
  addedBy: string;
  addedAt: string;
};
