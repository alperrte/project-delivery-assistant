import { useQuery } from "@tanstack/react-query";
import { invitationsApi } from "./api";
import { invitationKeys } from "./query-keys";
import { useSession } from "@/features/auth/hooks/use-session";

/** Pending invitations of a project, read from the total of a one-row page. Only managers can see invitations. */
export function usePendingInvitationCount(projectId: string, enabled: boolean) {
  const {data:user}=useSession();
  return useQuery({
    queryKey: [...invitationKeys.project(projectId,user?.id), "pending-count"],
    queryFn: ({signal}) => invitationsApi.list(projectId, 0, 1, "PENDING",signal),
    select: (page) => page.totalElements,
    enabled: enabled && !!projectId && !!user?.id,
  });
}
