import type { LabelColor } from "@/features/tasks/types";

export type { LabelColor };

export type Label = {
  id: string;
  name: string;
  color: LabelColor;
  /** Active tasks currently tagged with the label. */
  usageCount: number;
};
