import type { QueryClient } from "@tanstack/react-query";

export const organizationKeys = {
  all: ["organizations"] as const,
  list: (page: number) => ["organizations", "list", page] as const,
  detail: (id: string) => ["organizations", "detail", id] as const,
  projects: (id: string, page: number) => ["organizations", "projects", id, page] as const,
  picker: ["organizations", "picker"] as const,
};

export async function invalidateOrganizationQueries(queryClient: QueryClient) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: organizationKeys.all }),
    queryClient.invalidateQueries({
      predicate: query => query.queryKey[0] === "projects" && query.queryKey[2] === "home",
    }),
  ]);
}
