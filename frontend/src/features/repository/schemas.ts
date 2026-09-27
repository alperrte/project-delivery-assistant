import { z } from "zod";

export const connectRepositorySchema = z.object({
  repositoryUrl: z
    .string()
    .min(1, "required")
    .regex(/^https:\/\/github\.com\/[^/\s]+\/[^/\s]+$/, "githubUrl"),
});

export type ConnectRepositoryValues = z.infer<typeof connectRepositorySchema>;
