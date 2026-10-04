"use client";

import { useEffect, useRef } from "react";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { chatApi } from "./api";
import { applyReadToOverview, chatKeys, flattenMessages } from "./cache";
import type { ChatMessagePage } from "./types";

/**
 * The conversation list of a project (project group, own direct conversations, unread). `poll` is for when no socket
 * keeps it fresh (the sidebar badge outside the project's own pages).
 */
export function useChatOverview(projectId: string | undefined, options: { poll?: boolean } = {}) {
  return useQuery({
    queryKey: chatKeys.overview(projectId ?? ""),
    queryFn: ({ signal }) => chatApi.overview(projectId!, signal),
    enabled: !!projectId,
    refetchInterval: options.poll ? 60_000 : false,
  });
}

/** The people the caller can start a conversation with; only needed while the panel is showing. */
export function useChatMembers(projectId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: chatKeys.members(projectId ?? ""),
    queryFn: ({ signal }) => chatApi.members(projectId!, signal),
    enabled: !!projectId && enabled,
  });
}

/**
 * One conversation's history, newest page first and older pages on demand (`before` cursor). The socket and the
 * reconnect catch-up keep it current, so it is never refetched on its own: loaded messages survive the panel
 * changing state or being closed for a while.
 */
export function useChatMessages(projectId: string | undefined, conversationId: string | undefined) {
  const query = useInfiniteQuery({
    queryKey: chatKeys.messages(projectId ?? "", conversationId ?? ""),
    queryFn: ({ pageParam, signal }): Promise<ChatMessagePage> =>
      chatApi.messages(projectId!, conversationId!, pageParam ? { before: pageParam } : {}, signal),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.messages[0]?.id : undefined),
    enabled: !!projectId && !!conversationId,
    staleTime: Infinity,
    refetchOnMount: false,
    refetchOnReconnect: false,
  });
  return { ...query, messages: flattenMessages(query.data) };
}

/** Opens (finds or creates) the direct conversation with a project member. */
export function useOpenDirect(projectId: string | undefined) {
  return useMutation({
    mutationFn: (userId: string) => chatApi.openDirect(projectId!, userId),
  });
}

/** Marks a conversation read; the unread count drops right away and the server confirms in the background. */
export function useMarkRead(projectId: string | undefined, ownerKey: string) {
  const lifetime = useRef({ active: true });
  useEffect(() => {
    const generation = { active: true };
    lifetime.current = generation;
    return () => { generation.active = false; };
  }, [ownerKey]);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (conversationId: string) => chatApi.markRead(projectId!, conversationId),
    onMutate: (conversationId) => {
      if (projectId) applyReadToOverview(queryClient, projectId, conversationId);
      return { projectId, generation: lifetime.current };
    },
    onError: (_error, _conversationId, context) => {
      // The optimistic zero may be wrong now: let the server say what is still unread.
      if (context?.generation.active && context.projectId) void queryClient.invalidateQueries({ queryKey: chatKeys.overview(context.projectId) });
    },
  });
}
