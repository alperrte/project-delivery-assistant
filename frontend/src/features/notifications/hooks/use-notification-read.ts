"use client";

import { useEffect, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { sessionQueryKey } from "@/features/auth/hooks/use-session";
import { ApiError } from "@/lib/api/client";
import { notificationsApi } from "../api";
import { reconcileNotificationRead } from "../query-keys";
import type { Notification } from "../types";

type Actor = { userId: string | undefined; current: () => boolean } | null;
/**
 * `many` marks only the listed ids (one PATCH each), never the whole inbox. `delete` / `deleteAll` permanently remove
 * the caller's own READ notifications (one row / the whole history); they share this hook so reads and deletes use one
 * single-flight guard, one actor check and one reconcile.
 */
export type ReadAction = { kind: "read"; id: string } | { kind: "all" } | { kind: "many"; ids: readonly string[] }
  | { kind: "delete"; id: string } | { kind: "deleteAll" };
export const isDeleteAction = (action: ReadAction | undefined) => action?.kind === "delete" || action?.kind === "deleteAll";
type Operation = { action: ReadAction; actor: string; controller: AbortController };
export type ReadResult = { action: ReadAction; data: Notification | { count: number }; refreshError?: unknown };

/** Server-confirmed reads share one synchronous guard and the current account's lifetime. */
export function useNotificationRead(owner: Actor, onError?: (error: unknown, action: ReadAction) => void) {
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

  /** Sequential per-id reads; a partial failure still reconciles what was committed before it rethrows. */
  async function send(op: Operation, owns: () => boolean): Promise<Notification | { count: number } | undefined> {
    const action = op.action;
    if (action.kind === "read") return notificationsApi.read(action.id, op.controller.signal);
    if (action.kind === "all") return notificationsApi.readAll(op.controller.signal);
    if (action.kind === "deleteAll") return notificationsApi.deleteAllRead(op.controller.signal);
    if (action.kind === "delete") { await notificationsApi.deleteOne(action.id, op.controller.signal); return { count: 1 }; }
    let done = 0;
    try {
      for (const id of action.ids) {
        if (!owns()) return undefined;
        await notificationsApi.read(id, op.controller.signal);
        done++;
      }
    } catch (error) {
      if (done > 0 && owns()) await reconcileNotificationRead(client, op.actor).catch(() => undefined);
      throw error;
    }
    return { count: done };
  }

  const mutation = useMutation({
    retry: false,
    mutationFn: async (op: Operation): Promise<ReadResult | undefined> => {
      const owns = () => current() && userId === op.actor && !op.controller.signal.aborted;
      try {
        if (!owns()) return;
        const data = await send(op, owns);
        if (!data) return;
        if (!owns()) return;
        let refreshError: unknown;
        try { await reconcileNotificationRead(client, op.actor); }
        catch (error) { refreshError = error; }
        if (owns()) return { action: op.action, data, refreshError };
      } catch (error) {
        // The row is already gone (another tab/device deleted it): show the truth instead of waiting for the next poll.
        if (op.action.kind === "delete" && error instanceof ApiError && error.status === 404 && owns())
          await reconcileNotificationRead(client, op.actor).catch(() => undefined);
        if (owns()) throw error;
      } finally { if (operation.current === op) operation.current = null; }
    },
    onError: (error, op) => { if (current() && userId === op.actor && !op.controller.signal.aborted) onError?.(error, op.action); },
  });

  function execute(action: ReadAction) {
    if (!current() || operation.current || mutation.isPending) return false;
    const op = { action, actor: userId!, controller: new AbortController() };
    operation.current = op; mutation.mutate(op); return true;
  }
  /** Same guard as `execute`, but resolves with the result (undefined when not started/owned) and rejects on failure. */
  function executeAsync(action: ReadAction) {
    if (!current() || operation.current || mutation.isPending) return Promise.resolve<ReadResult | undefined>(undefined);
    const op = { action, actor: userId!, controller: new AbortController() };
    operation.current = op; return mutation.mutateAsync(op);
  }
  return { ...mutation, execute, executeAsync };
}
