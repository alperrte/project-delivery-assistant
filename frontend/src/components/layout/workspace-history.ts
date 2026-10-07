/** Read-only native capability adapter. No URL stack, router state writes or history interception. */
import { authenticatedRoute } from "./authenticated-route";
export type HistoryEntry = { readonly index: number; readonly url: string | null };
export type HistoryCapabilities = {readonly canGoBack:boolean;readonly canGoForward:boolean;readonly currentEntry:{readonly index:number}|null; entries?: () => readonly HistoryEntry[]};
type NativeHistory = HistoryCapabilities & EventTarget;
export const HISTORY_PENDING=-1,HISTORY_UNAVAILABLE=0,HISTORY_KNOWN=1,HISTORY_BACK=2,HISTORY_FORWARD=4;
export const HISTORY_BACK_BOUNDARY=8,HISTORY_FORWARD_BOUNDARY=16,HISTORY_BACK_UNVERIFIED=32,HISTORY_FORWARD_UNVERIFIED=64,HISTORY_UNAUTHENTICATED=128;

export function historySnapshot(native:HistoryCapabilities|null|undefined):number {
  try {
    if(!native?.currentEntry||!Number.isInteger(native.currentEntry.index)||native.currentEntry.index<0||
       typeof native.canGoBack!=="boolean"||typeof native.canGoForward!=="boolean")return HISTORY_UNAVAILABLE;
    return HISTORY_KNOWN|(native.canGoBack?HISTORY_BACK:0)|(native.canGoForward?HISTORY_FORWARD:0);
  } catch {return HISTORY_UNAVAILABLE;}
}
function nativeHistory():NativeHistory|undefined {
  if(typeof window==="undefined")return;
  try {return (window as unknown as {navigation?:NativeHistory}).navigation;}catch{return;}
}
export function authenticatedHistorySnapshot(native: HistoryCapabilities | undefined, currentUrl: string, ready: boolean) {
  if (!ready) return HISTORY_UNAUTHENTICATED;
  try {
    if (!(historySnapshot(native) & HISTORY_KNOWN) || !native?.currentEntry || typeof native.entries !== "function") return HISTORY_UNAVAILABLE;
    const current = new URL(currentUrl);
    if (!authenticatedRoute(current.pathname)) return HISTORY_UNAUTHENTICATED;
    const entries = native.entries();
    if (!Array.isArray(entries)) return HISTORY_UNAVAILABLE;
    let snapshot = HISTORY_KNOWN;
    for (const [offset, capable, flag, boundary, unverified] of [
      [-1, native.canGoBack, HISTORY_BACK, HISTORY_BACK_BOUNDARY, HISTORY_BACK_UNVERIFIED],
      [1, native.canGoForward, HISTORY_FORWARD, HISTORY_FORWARD_BOUNDARY, HISTORY_FORWARD_UNVERIFIED],
    ] as const) {
      if (!capable) continue;
      const entry = entries.find(value => value.index === native.currentEntry!.index + offset);
      if (!entry?.url) { snapshot |= unverified; continue; }
      try {
        const target = new URL(entry.url);
        snapshot |= target.origin === current.origin && !target.username && !target.password && authenticatedRoute(target.pathname) ? flag : boundary;
      } catch { snapshot |= unverified; }
    }
    return snapshot;
  } catch { return HISTORY_UNAVAILABLE; }
}
export function currentHistorySnapshot(ready=true){
  if(typeof window==="undefined")return HISTORY_PENDING;
  try{return authenticatedHistorySnapshot(nativeHistory(),window.location.href,ready);}catch{return HISTORY_UNAVAILABLE;}
}
export function subscribeHistory(notify:()=>void) {
  const native=nativeHistory();
  if(!native||typeof native.addEventListener!=="function")return ()=>{};
  const events=["currententrychange","navigatesuccess","navigateerror"];
  for(const event of events)native.addEventListener(event,notify);
  window.addEventListener("pageshow",notify);window.addEventListener("popstate",notify);
  return ()=>{for(const event of events)native.removeEventListener(event,notify);window.removeEventListener("pageshow",notify);window.removeEventListener("popstate",notify);};
}
export function attemptHistoryTraversal(direction:typeof HISTORY_BACK|typeof HISTORY_FORWARD,action:()=>void,ready=true) {
  const snapshot=currentHistorySnapshot(ready);
  if(!(snapshot&HISTORY_KNOWN)||!(snapshot&direction))return false;
  action();return true;
}
