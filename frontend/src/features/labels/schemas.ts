import { z } from "zod";
import { LABEL_COLORS } from "@/features/tasks/types";

export const LABEL_NAME_MAX = 40;

export const labelFormSchema = z.object({
  name: z.string().trim().min(1, "required").max(LABEL_NAME_MAX, "maxLength"),
  color: z.enum(LABEL_COLORS),
});

export type LabelFormValues = z.infer<typeof labelFormSchema>;
