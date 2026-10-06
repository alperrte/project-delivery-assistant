import { test,expect } from "@playwright/test";
import { historySnapshot,subscribeHistory,attemptHistoryTraversal,HISTORY_BACK,HISTORY_FORWARD } from "../src/components/layout/workspace-history";

test("native adapter distinguishes unknown/no-entry, rechecks capabilities and cleans subscriptions",()=>{
 expect(historySnapshot(undefined)).toBe(0);expect(historySnapshot({currentEntry:null,canGoBack:false,canGoForward:false})).toBe(0);
 expect(historySnapshot({currentEntry:{index:0},canGoBack:false,canGoForward:false})).toBe(1);
 const native=Object.assign(new EventTarget(),{currentEntry:{index:1},canGoBack:true,canGoForward:false});
 const fake=Object.assign(new EventTarget(),{navigation:native});const descriptor=Object.getOwnPropertyDescriptor(globalThis,"window");
 Object.defineProperty(globalThis,"window",{configurable:true,value:fake});
 try {
  let notifications=0,calls=0;const cleanup=subscribeHistory(()=>notifications++);
  native.dispatchEvent(new Event("currententrychange"));fake.dispatchEvent(new Event("pageshow"));fake.dispatchEvent(new Event("popstate"));expect(notifications).toBe(3);
  expect(attemptHistoryTraversal(HISTORY_BACK,()=>calls++)).toBe(true);native.canGoBack=false;
  expect(attemptHistoryTraversal(HISTORY_BACK,()=>calls++)).toBe(false);expect(attemptHistoryTraversal(HISTORY_FORWARD,()=>calls++)).toBe(false);expect(calls).toBe(1);
  cleanup();native.dispatchEvent(new Event("navigateerror"));native.dispatchEvent(new Event("currententrychange"));fake.dispatchEvent(new Event("pageshow"));expect(notifications).toBe(3);
 }finally{if(descriptor)Object.defineProperty(globalThis,"window",descriptor);else Reflect.deleteProperty(globalThis,"window");}
});

test("real native same-origin capabilities follow push/replace/query/hash/back/forward/branch/reload",async({page})=>{
 await page.goto("/tr/giris");
 const read=async()=>page.evaluate(()=>{const n=(window as unknown as {navigation:{canGoBack:boolean;canGoForward:boolean;currentEntry:{index:number}}}).navigation;return {canGoBack:n.canGoBack,canGoForward:n.canGoForward,currentEntry:{index:n.currentEntry.index}};});
 expect(historySnapshot(await read())).toBe(1);
 await page.evaluate(()=>history.pushState({qa:true},"",location.pathname+"?native=1"));expect(historySnapshot(await read())).toBe(3);
 await page.evaluate(()=>history.replaceState({...history.state},"",location.pathname+"?native=2"));expect((await read()).currentEntry.index).toBe(1);
 await page.evaluate(()=>history.pushState({...history.state},"",location.pathname+"?native=3#qa"));expect((await read()).currentEntry.index).toBe(2);
 await page.goBack();expect(historySnapshot(await read())).toBe(7);expect(page.url()).toContain("native=2");
 await page.goForward();expect(historySnapshot(await read())).toBe(3);expect(page.url()).toContain("#qa");
 await page.goBack();await page.evaluate(()=>history.pushState({...history.state},"",location.pathname+"?native=new"));expect(historySnapshot(await read())).toBe(3);
 await page.reload();expect(historySnapshot(await read())).toBe(3);
 // Native browser traversal remains available at the application's same-origin boundary.
  await page.goBack();await page.goBack();expect(historySnapshot(await read())).toBe(5);
 await page.goBack();await expect(page).toHaveURL("about:blank");
});
