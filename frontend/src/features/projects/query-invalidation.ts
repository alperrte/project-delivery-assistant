import type { QueryClient } from "@tanstack/react-query";
import { sessionQueryKey } from "@/features/auth/hooks/use-session";
import { chatKeys } from "@/features/chat/cache";

/** Project names and logos also appear in the current account's central chat overview. */
export async function invalidateProjectChatOverview(queryClient: QueryClient, actorId?: string) {
  if (!actorId || queryClient.getQueryData<{ id: string }>(sessionQueryKey)?.id !== actorId) return;
  await queryClient.invalidateQueries({ queryKey: chatKeys.overview(actorId), exact: true });
}

/** A project row belongs to both the global project cache and its organization pages. */
export async function invalidateProjectMutation(queryClient: QueryClient, actorId?: string, ...organizationIds: (string | null | undefined)[]) {
  await Promise.all([
    invalidateProjectChatOverview(queryClient, actorId),
    queryClient.invalidateQueries({ queryKey: ["projects"] }),
    queryClient.invalidateQueries({ queryKey: ["project-invitations"] }),
    ...[...new Set(organizationIds.filter((id): id is string => !!id))].map(id =>
      queryClient.invalidateQueries({ queryKey: ["organizations", "projects", id] })),
  ]);
}
