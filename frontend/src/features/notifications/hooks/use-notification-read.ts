"use client";

import { useEffect, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { sessionQueryKey } from "@/features/auth/hooks/use-session";
import { notificationsApi } from "../api";
import { reconcileNotificationRead } from "../query-keys";
import type { Notification } from "../types";

type Actor = { userId: string | undefined; current: () => boolean } | null;
export type ReadAction = { kind: "read"; id: string } | { kind: "all" };
type Operation = { action: ReadAction; actor: string; controller: AbortController };
export type ReadResult = { action: ReadAction; data: Notification | { count: number }; refreshError?: unknown };

/** Server-confirmed reads share one synchronous guard and the current account's lifetime. */
export function useNotificationRead(owner: Actor, onError?: (error: unknown) => void) {
  const client = useQueryClient(), userId = owner?.userId;
  const live = useRef(true), operation = useRef<Operation | null>(null);
  const current = () => live.current && !!userId && !!owner?.current()
    && client.getQueryData<{ id: string }>(sessionQueryKey)?.id === userId;
  useEffect(() => {
    live.current = true;
    const unsubscribe = client.getQueryCache().subscribe(event => {
      if (event.query.queryKey[0] === sessionQueryKey[0] && client.getQueryData<{ id: string }>(sessionQueryKey)?.id !== userId)
        operation.current?.controller.abort();
    });
    return () => { live.current = false; operation.current?.controller.abort(); unsubscribe(); };
  }, [client, userId]);

  const mutation = useMutation({
    retry: false,
    mutationFn: async (op: Operation): Promise<ReadResult | undefined> => {
      const owns = () => current() && userId === op.actor && !op.controller.signal.aborted;
      try {
        if (!owns()) return;
        const data = op.action.kind === "read"
          ? await notificationsApi.read(op.action.id, op.controller.signal)
          : await notificationsApi.readAll(op.controller.signal);
        if (!owns()) return;
        let refreshError: unknown;
        try { await reconcileNotificationRead(client, op.actor); }
        catch (error) { refreshError = error; }
        if (owns()) return { action: op.action, data, refreshError };
      } catch (error) {
        if (owns()) throw error;
      } finally { if (operation.current === op) operation.current = null; }
    },
    onError: (error, op) => { if (current() && userId === op.actor && !op.controller.signal.aborted) onError?.(error); },
  });

  function execute(action: ReadAction) {
    if (!current() || operation.current || mutation.isPending) return false;
    const op = { action, actor: userId!, controller: new AbortController() };
    operation.current = op; mutation.mutate(op); return true;
  }
  return { ...mutation, execute };
}
