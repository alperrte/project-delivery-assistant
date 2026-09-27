import { z } from "zod";

export const inviteByEmailSchema = z.object({
  email: z.string().min(1, "required").email("email"),
  roles: z.array(z.string()).min(1, "required"),
});

export type InviteByEmailValues = z.infer<typeof inviteByEmailSchema>;
