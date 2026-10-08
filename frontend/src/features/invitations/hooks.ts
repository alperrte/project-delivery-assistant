"use client";
import { useQuery } from "@tanstack/react-query";
import { invitationsApi } from "./api";
import { invitationKeys } from "./query-keys";
import { useSession } from "@/features/auth/hooks/use-session";

const freshness = {
  staleTime: 0,
  refetchOnWindowFocus: true,
  refetchOnReconnect: true,
  refetchInterval: 30_000,
  refetchIntervalInBackground: false,
};

/** Own effective pending total, independent of the displayed history page/filter. */
export function useIncomingInvitationCount(enabled = true) {
  const { data: user } = useSession();
  return useQuery({
    queryKey: invitationKeys.incomingPending(user?.id),
    queryFn: ({ signal }) => invitationsApi.mine(0, 1, "PENDING", signal),
    select: page => page.totalElements,
    enabled: enabled && !!user?.id,
    ...freshness,
  });
}

/** Manager-owned project total. It never shares the incoming recipient key. */
export function usePendingInvitationCount(projectId: string, enabled: boolean) {
  const { data: user } = useSession();
  return useQuery({
    queryKey: invitationKeys.projectPending(projectId, user?.id),
    queryFn: ({ signal }) => invitationsApi.list(projectId, 0, 1, "PENDING", signal),
    select: page => page.totalElements,
    enabled: enabled && !!projectId && !!user?.id,
    ...freshness,
  });
}
