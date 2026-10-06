import type { Task } from "./types";

/**
 * Client mirror of the backend task authorization (`.agents/SECURITY.md` §11). It only decides which controls are
 * enabled and which tooltip explains a locked one; the server enforces every rule again.
 *
 * - The project manager does everything.
 * - An assignee handles status, block, checklist, worklog, relations and attachments of their own task.
 * - Any other member can comment, watch, upload and claim.
 */
export type TaskPermissions = {
  /** Edit fields, assignees, labels, sprint, archive. */
  manage: boolean;
  /** Status, block, checklist, worklog and relations: the manager or an assignee. */
  work: boolean;
  /** Comment, watch and upload are open to every member. */
  collaborate: true;
  canClaim: boolean;
  canRelease: boolean;
};

export function taskPermissions(task: Task, userId: string | undefined, isManager: boolean): TaskPermissions {
  const assigned = !!userId && task.assigneeIds.includes(userId);
  const open = task.status !== "DONE";
  return {
    manage: isManager,
    work: isManager || assigned,
    collaborate: true,
    canClaim: !!task.pool?.open && open && !!userId && !assigned,
    // Only the sole assignee who took the task from the pool may hand it back.
    canRelease: open && !!task.pool?.claimed && task.assigneeIds.length === 1 && assigned,
  };
}

/** Why a control is locked, as an i18n key under `tasks.locked`. */
export type LockReason = "manager" | "assignee";

export const canEditOwn = (ownerId: string | null | undefined, userId: string | undefined, isManager: boolean) =>
  isManager || (!!userId && ownerId === userId);
