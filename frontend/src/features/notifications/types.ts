export type Notification = {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  readAt: string | null;
  actorUserId: string | null;
  projectId: string | null;
  resourceType: string;
  resourceId: string;
  statusChange?: { previousStatus: string; newStatus: string; taskKey: string; taskTitle: string; actorNickname: string | null } | null;
  teamDeletion?: { projectName: string; teamName: string; actorNickname: string | null; occurredAt: string } | null;
  repositoryCommits?: {
    projectName: string;
    repositoryFullName: string;
    branch: string;
    commitCount: number;
    /** More commits arrived than the scan window shows; the count is a lower bound. */
    truncated: boolean;
    headMessage: string | null;
    headAuthor: string | null;
  } | null;
  invitationContext?: { projectName: string } | null;
  popupPresentedAt?: string | null;
};
