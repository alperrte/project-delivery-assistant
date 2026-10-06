import type { QueryClient } from "@tanstack/react-query";

/** A project row belongs to both the global project cache and its organization pages. */
export async function invalidateProjectMutation(queryClient: QueryClient, ...organizationIds: (string | null | undefined)[]) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ["projects"] }),
    ...[...new Set(organizationIds.filter((id): id is string => !!id))].map(id =>
      queryClient.invalidateQueries({ queryKey: ["organizations", "projects", id] })),
  ]);
}
