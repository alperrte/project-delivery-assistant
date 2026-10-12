"use client";

import { useEffect, useRef } from "react";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { chatApi } from "./api";
import { chatKeys, flattenMessages } from "./cache";
import type { ChatMessagePage } from "./types";

/**
 * The conversation list of a project (project group, own direct conversations, unread). `poll` is for when no socket
 * keeps it fresh (the sidebar badge outside the project's own pages).
 */
export function useChatOverview(accountId: string | undefined, options: { poll?: boolean } = {}) {
  return useQuery({
    queryKey: chatKeys.overview(accountId ?? ""),
    queryFn: ({ signal }) => chatApi.overview(accountId!, signal),
    enabled: !!accountId,
    refetchInterval: options.poll ? 60_000 : false,
  });
}

/** The people the caller can start a conversation with; only needed while the panel is showing. */
export function useChatMembers(accountId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: chatKeys.members(accountId ?? ""),
    queryFn: ({ signal }) => chatApi.members(accountId!, signal),
    enabled: !!accountId && enabled,
  });
}

/**
 * One conversation's history, newest page first and older pages on demand (`before` cursor). The socket and the
 * reconnect catch-up keep it current, so it is never refetched on its own: loaded messages survive the panel
 * changing state or being closed for a while.
 */
export function useChatMessages(accountId: string | undefined, conversationId: string | undefined) {
  const query = useInfiniteQuery({
    queryKey: chatKeys.messages(accountId ?? "", conversationId ?? ""),
    queryFn: ({ pageParam, signal }): Promise<ChatMessagePage> =>
      chatApi.messages(accountId!, conversationId!, pageParam ? { before: pageParam } : {}, signal),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.messages[0]?.id : undefined),
    enabled: !!accountId && !!conversationId,
    staleTime: Infinity,
    refetchOnMount: false,
    refetchOnReconnect: false,
  });
  return { ...query, messages: flattenMessages(query.data) };
}

/**
 * Who has read the conversation ("seen"). Loaded once per opened conversation; SEEN socket events patch it in place
 * and a reconnect refetches it, so it is never polled.
 */
export function useChatReceipts(accountId: string | undefined, conversationId: string | undefined) {
  return useQuery({
    queryKey: chatKeys.receipts(accountId ?? "", conversationId ?? ""),
    queryFn: ({ signal }) => chatApi.receipts(accountId!, conversationId!, signal),
    enabled: !!accountId && !!conversationId,
    staleTime: Infinity,
    refetchOnReconnect: false,
  });
}

/** Opens (finds or creates) the direct conversation with a project member. */
export function useOpenDirect(accountId: string | undefined) {
  return useMutation({
    mutationFn: (userId: string) => chatApi.openDirect(accountId!, userId),
  });
}

/** Marks a conversation read; the unread count drops right away and the server confirms in the background. */
export function useMarkRead(accountId: string | undefined, ownerKey: string) {
  const lifetime = useRef({ active: true });
  useEffect(() => {
    const generation = { active: true };
    lifetime.current = generation;
    return () => { generation.active = false; };
  }, [ownerKey]);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({conversationId,messageIds}: {conversationId:string;messageIds:string[]}) => chatApi.markRead(accountId!, conversationId,messageIds),
    onMutate: () => {
      // Exact visible-message receipts are confirmed by the server, then unread is refetched.
      return { accountId, generation: lifetime.current };
    },
    onSuccess: () => {if(accountId) void queryClient.invalidateQueries({queryKey:chatKeys.overview(accountId)});},
    onError: (_error, _conversationId, context) => {
      // The optimistic zero may be wrong now: let the server say what is still unread.
      if (context?.generation.active && context.accountId) void queryClient.invalidateQueries({ queryKey: chatKeys.overview(context.accountId) });
    },
  });
}
