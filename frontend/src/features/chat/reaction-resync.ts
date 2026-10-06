import type { QueryClient } from "@tanstack/react-query";
import { applyReactionSnapshots, chatKeys, flattenMessages, type MessagePages } from "./cache";
import type { ReactionSnapshot } from "./types";

/** Shared by all conversations of one owner generation, not two workers per conversation. */
export class ReactionSyncQueue {
  private active = 0;
  private waiting: (() => void)[] = [];
  run<T>(operation: () => Promise<T>, signal: AbortSignal): Promise<T> {
    return new Promise((resolve, reject) => {
      this.waiting.push(() => {
        if (signal.aborted) { reject(new DOMException("Aborted", "AbortError")); return; }
        this.active += 1;
        void Promise.resolve().then(operation).then(resolve, reject).finally(() => { this.active -= 1; this.pump(); });
      });
      this.pump();
    });
  }
  private pump() { while (this.active < 2 && this.waiting.length) this.waiting.shift()!(); }
}

export async function resyncReactions(queryClient: QueryClient, projectId: string, conversationId: string,
  fetchSnapshots: (ids: string[], signal: AbortSignal) => Promise<ReactionSnapshot[]>,
  options: { signal: AbortSignal; current: () => boolean; queue: ReactionSyncQueue }) {
  const data = queryClient.getQueryData<MessagePages>(chatKeys.messages(projectId, conversationId));
  const ids = flattenMessages(data).map(message => message.id);
  const requests: Promise<void>[] = [];
  for (let start = 0; start < ids.length; start += 50) {
    const batch = ids.slice(start, start + 50);
    requests.push(options.queue.run(async () => {
      if (!options.current()) return;
      const snapshots = await fetchSnapshots(batch, options.signal);
      if (options.current() && !options.signal.aborted) applyReactionSnapshots(queryClient, projectId, conversationId, snapshots);
    }, options.signal));
  }
  await Promise.all(requests);
}
