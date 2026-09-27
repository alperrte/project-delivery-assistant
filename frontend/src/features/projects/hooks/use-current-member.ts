import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/features/auth/hooks/use-session";
import { membersApi } from "../members-api";

export function useCurrentMember(projectId: string) {
  const { data: user } = useSession();
  const query = useQuery({
    queryKey: ["projects", projectId, "members", "me", user?.id],
    queryFn: () => membersApi.detail(projectId, user!.id),
    enabled: !!user,
  });

  return { ...query, isManager: query.data?.roles.includes("PROJECT_MANAGER") ?? false };
}
