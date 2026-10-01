import { z } from "zod";

export const TEAM_NAME_MAX = 120;
export const TEAM_DESCRIPTION_MAX = 280;

export const teamFormSchema = z.object({
  name: z.string().trim().min(1, "required").max(TEAM_NAME_MAX, "maxLength"),
  description: z.string().max(TEAM_DESCRIPTION_MAX, "maxLength").optional(),
  /** Empty string means top level. */
  parentTeamId: z.string().optional(),
  includeCreator: z.boolean(),
});

export type TeamFormValues = z.infer<typeof teamFormSchema>;

/** What the create endpoint takes. */
export type TeamPayload = {
  name: string;
  description?: string;
  parentTeamId?: string;
  includeCreator: boolean;
};
