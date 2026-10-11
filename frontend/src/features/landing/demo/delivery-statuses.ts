import { TASK_STATUSES } from "@/features/tasks/types";

/** The task statuses the "delivery" chapter walks through. Kept apart from the demo workspace so the landing page can read it without loading the workspace code. */
export const DELIVERY_STATUSES = TASK_STATUSES.filter(status => status !== "BACKLOG");
