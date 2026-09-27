export type Criterion = {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  completed: boolean;
  sortOrder: number;
  createdBy: string;
  createdAt: string;
  completedBy: string | null;
  completedAt: string | null;
};
