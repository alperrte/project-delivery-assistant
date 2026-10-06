"use client";
import { useCallback,useSyncExternalStore } from "react";
import { useRouter } from "@/i18n/navigation";
import { HISTORY_PENDING,HISTORY_UNAVAILABLE,HISTORY_KNOWN,HISTORY_BACK,HISTORY_FORWARD,currentHistorySnapshot,subscribeHistory,attemptHistoryTraversal } from "./workspace-history";

export function useWorkspaceHistory(enabled=true) {
  const router=useRouter();
  const subscribe=useCallback((notify:()=>void)=>enabled?subscribeHistory(notify):()=>{},[enabled]);
  const snapshot=useCallback(()=>enabled?currentHistorySnapshot():HISTORY_UNAVAILABLE,[enabled]);
  const state=useSyncExternalStore(subscribe,snapshot,()=>HISTORY_PENDING);
  const known=state>=0&&!!(state&HISTORY_KNOWN);
  return {status:!enabled?"contained":state===HISTORY_PENDING?"pending":known?"ready":"unavailable",
    canBack:known&&!!(state&HISTORY_BACK),canForward:known&&!!(state&HISTORY_FORWARD),
    back:()=>enabled&&attemptHistoryTraversal(HISTORY_BACK,()=>router.back()),
    forward:()=>enabled&&attemptHistoryTraversal(HISTORY_FORWARD,()=>router.forward())};
}
