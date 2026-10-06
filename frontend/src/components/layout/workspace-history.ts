/** Read-only native capability adapter. No URL stack, router state writes or history interception. */
export type HistoryCapabilities = {readonly canGoBack:boolean;readonly canGoForward:boolean;readonly currentEntry:{readonly index:number}|null};
type NativeHistory = HistoryCapabilities & EventTarget;
export const HISTORY_PENDING=-1,HISTORY_UNAVAILABLE=0,HISTORY_KNOWN=1,HISTORY_BACK=2,HISTORY_FORWARD=4;

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
export function currentHistorySnapshot(){return historySnapshot(nativeHistory());}
export function subscribeHistory(notify:()=>void) {
  const native=nativeHistory();
  if(!native||typeof native.addEventListener!=="function")return ()=>{};
  const events=["currententrychange","navigatesuccess","navigateerror"];
  for(const event of events)native.addEventListener(event,notify);
  window.addEventListener("pageshow",notify);window.addEventListener("popstate",notify);
  return ()=>{for(const event of events)native.removeEventListener(event,notify);window.removeEventListener("pageshow",notify);window.removeEventListener("popstate",notify);};
}
export function attemptHistoryTraversal(direction:typeof HISTORY_BACK|typeof HISTORY_FORWARD,action:()=>void) {
  const snapshot=currentHistorySnapshot();
  if(!(snapshot&HISTORY_KNOWN)||!(snapshot&direction))return false;
  action();return true;
}
