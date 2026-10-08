import { z } from "zod";

export const GITHUB_REPOSITORY_URL = /^https:\/\/github\.com\/[^/\s]+\/[^/\s]+$/;

export const connectRepositorySchema = z.object({
  repositoryUrl: z.string().min(1, "required").regex(GITHUB_REPOSITORY_URL, "githubUrl"),
});

export type ConnectRepositoryValues = z.infer<typeof connectRepositorySchema>;
