"use client";
import { useCallback,useEffect,useSyncExternalStore } from "react";
import { useRouter } from "@/i18n/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useSession, sessionQueryKey } from "@/features/auth/hooks/use-session";
import type { AuthenticatedUser } from "@/features/auth/api";
import { HISTORY_PENDING,HISTORY_UNAVAILABLE,HISTORY_KNOWN,HISTORY_BACK,HISTORY_FORWARD,HISTORY_UNAUTHENTICATED,HISTORY_BACK_BOUNDARY,HISTORY_FORWARD_BOUNDARY,HISTORY_BACK_UNVERIFIED,HISTORY_FORWARD_UNVERIFIED,currentHistorySnapshot,subscribeHistory,attemptHistoryTraversal } from "./workspace-history";

export function useWorkspaceHistory(enabled=true) {
  const router=useRouter();
  const session=useSession(enabled),client=useQueryClient();
  const ready=enabled&&session.isSuccess&&!session.isFetching&&!session.isError&&!!session.data?.id&&!session.data.mustChangePassword;
  useEffect(()=>{
    if(!enabled)return;
    const resume=(event:PageTransitionEvent)=>{if(event.persisted)void client.invalidateQueries({queryKey:sessionQueryKey});};
    window.addEventListener("pageshow",resume);
    return ()=>window.removeEventListener("pageshow",resume);
  },[enabled,client]);
  const subscribe=useCallback((notify:()=>void)=>enabled?subscribeHistory(notify):()=>{},[enabled]);
  const snapshot=useCallback(()=>enabled?currentHistorySnapshot(ready):HISTORY_UNAVAILABLE,[enabled,ready]);
  const state=useSyncExternalStore(subscribe,snapshot,()=>HISTORY_PENDING);
  const known=state>=0&&!!(state&HISTORY_KNOWN);
  const currentReady=()=>{
    const data=client.getQueryData<AuthenticatedUser>(sessionQueryKey),state=client.getQueryState(sessionQueryKey);
    return ready&&!!data?.id&&data.id===session.data?.id&&!data.mustChangePassword&&state?.status==="success"&&state.fetchStatus!=="fetching";
  };
  const reason=(direction:number)=>state===HISTORY_PENDING?"pending":state===HISTORY_UNAUTHENTICATED?"unauthenticated":!known?"unavailable":
    state&(direction===HISTORY_BACK?HISTORY_BACK_UNVERIFIED:HISTORY_FORWARD_UNVERIFIED)?"unavailable":
    state&(direction===HISTORY_BACK?HISTORY_BACK_BOUNDARY:HISTORY_FORWARD_BOUNDARY)?"boundary":"noSafeEntry";
  return {status:!enabled?"contained":state===HISTORY_PENDING?"pending":state===HISTORY_UNAUTHENTICATED?"unauthenticated":known?"ready":"unavailable",
    canBack:known&&!!(state&HISTORY_BACK),canForward:known&&!!(state&HISTORY_FORWARD),
    backReason:reason(HISTORY_BACK),forwardReason:reason(HISTORY_FORWARD),
    back:()=>enabled&&attemptHistoryTraversal(HISTORY_BACK,()=>router.back(),currentReady()),
    forward:()=>enabled&&attemptHistoryTraversal(HISTORY_FORWARD,()=>router.forward(),currentReady())};
}
