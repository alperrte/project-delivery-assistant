import { test,expect,type Page } from "@playwright/test";
import { api,createProject } from "./helpers";
import { MANAGER_STORAGE,MEMBER_STORAGE } from "./global-setup";
import { localizeHref } from "../src/i18n/routing";
import { chooseMessageAction } from "./chat-actions";

test("message menu keyboard/touch/focus/own-other geometry and context cancellation use the real chat",async({browser})=>{
 const ac=await browser.newContext({storageState:MANAGER_STORAGE}),bc=await browser.newContext({storageState:MEMBER_STORAGE});
 const a=await ac.newPage(),b=await bc.newPage();let pid:string|undefined;
 const row=(p:Page,text:string)=>p.getByTestId("chat-message").filter({has:p.getByTestId("chat-message-text").filter({hasText:text})});
 try {
  const slug=await createProject(a,`Action menu ${Date.now()}`);pid=((await api(a,"GET",`/projects/by-slug/${slug}`)).json as {id:string}).id;
  await b.goto("/tr/projeler");const actor=(await api(b,"GET","/auth/me")).json as {id:string};
  const team=(await api(a,"POST",`/projects/${pid}/teams`,{name:"Action team"})).json as {id:string};
  const invite=(await api(a,"POST",`/projects/${pid}/invitations`,{userId:actor.id,teamId:team.id,roles:["TESTER"]})).json as {invitationId:string;token:string};
  expect((await api(b,"POST",`/projects/${pid}/invitations/${invite.invitationId}/accept`,{token:invite.token})).status).toBe(200);
  await a.getByTestId("chat-nav-item").click();await a.getByTestId("chat-composer").fill("Menu question");await a.getByTestId("chat-composer").press("Enter");await expect(row(a,"Menu question")).toHaveCount(1);await expect(a.getByTestId("chat-pending")).toHaveCount(0);
  const longText="Long menu text "+"content ".repeat(150);
  for(const text of [longText,"😀"]){await a.getByTestId("chat-composer").fill(text);await a.getByTestId("chat-composer").press("Enter");await expect(row(a,text.trim())).toHaveCount(1);await expect(a.getByTestId("chat-pending")).toHaveCount(0);}
  for(const [locale,label,reply] of [["tr","Mesaj seçeneklerini aç","Yanıtla"],["en","Open message actions","Reply"],["de","Nachrichtenaktionen öffnen","Antworten"]] as const){
   await b.goto(localizeHref(`/projects/${slug}`,locale));await b.getByTestId("chat-nav-item").click();const message=row(b,"Menu question");await expect(message).toBeVisible();
   const trigger=message.getByTestId("chat-message-actions");await expect(trigger).toHaveAttribute("aria-label",label);await trigger.focus();await trigger.press("Enter");
   await expect(b.getByTestId("chat-message-reply")).toHaveText(reply);await expect(b.getByTestId("chat-message-reply")).toBeFocused();
   await b.getByTestId("chat-message-reply").press("ArrowDown");await expect(b.getByTestId("chat-message-react")).toBeFocused();await b.getByTestId("chat-message-react").press("Escape");
   await expect(b.getByTestId("chat-message-react")).toHaveCount(0);await expect(trigger).toBeFocused();await expect(b.getByTestId("chat-panel")).toBeVisible();
   await chooseMessageAction(message,"reply");await expect(b.getByTestId("chat-composer")).toBeFocused();await b.getByTestId("chat-composer").press("Escape");
   await trigger.focus();await trigger.press("Space");await b.getByTestId("chat-message-react").click();await expect(b.getByTestId("chat-message-react-popup")).toBeVisible();await expect(b.getByTestId("chat-message-reply")).toHaveCount(0);
   await b.getByTestId("emoji-THUMBS_UP").press("Escape");await expect(trigger).toBeFocused();await expect(b.getByTestId("chat-panel")).toBeVisible();
  }
  await b.goto(`/tr/projeler/${slug}`);await b.getByTestId("chat-nav-item").click();const other=row(b,"Menu question");
  await chooseMessageAction(other,"react");await b.getByTestId("emoji-THUMBS_UP").click();await expect(row(a,"Menu question").getByTestId("chat-reaction-THUMBS_UP")).toContainText("1");
  for(const page of [a,b]){
   for(const text of ["Menu question",longText.trim(),"😀"]){
    const item=row(page,text);await expect(item).toBeVisible();await item.scrollIntoViewIfNeeded();await chooseMessageAction(item,"react");
    const popup=(await page.getByTestId("chat-message-react-popup").boundingBox())!;expect(popup.x).toBeGreaterThanOrEqual(0);expect(popup.x+popup.width).toBeLessThanOrEqual(1280);
    await page.getByTestId("emoji-THUMBS_UP").press("Escape");await expect(page.getByTestId("chat-message-react-popup")).toHaveCount(0);
   }
   const message=row(page,"Menu question");const bubble=(await message.getByTestId("chat-message-bubble").boundingBox())!,chips=(await message.getByTestId("chat-reactions").boundingBox())!;expect(chips.y-bubble.y-bubble.height).toBe(4);
   await page.setViewportSize({width:390,height:844});await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))));if(await page.getByTestId("chat-conversation-group").isVisible())await page.getByTestId("chat-conversation-group").click();await expect(message).toBeVisible();const trigger=message.getByTestId("chat-message-actions");await expect(trigger).toBeVisible();const box=(await trigger.boundingBox())!;expect(box.width).toBe(44);expect(box.height).toBe(44);
   await message.getByTestId("chat-message-text").evaluate(node=>{const range=document.createRange();range.selectNodeContents(node);const selection=getSelection()!;selection.removeAllRanges();selection.addRange(range);});expect(await page.evaluate(()=>getSelection()?.toString())).toBe("Menu question");
   await chooseMessageAction(message,"react");const popup=(await page.getByTestId("chat-message-react-popup").boundingBox())!;expect(popup.x).toBeGreaterThanOrEqual(0);expect(popup.x+popup.width).toBeLessThanOrEqual(390);await page.getByTestId("emoji-THUMBS_UP").press("Escape");
  }
  await b.setViewportSize({width:1280,height:800});await b.getByTestId("chat-minimize").click();await b.getByTestId("chat-bar-expand").click();await chooseMessageAction(row(b,"Menu question"),"reply");await expect(b.getByTestId("chat-reply-context")).toBeVisible();
  await b.getByTestId("chat-fullscreen").click();await row(b,"Menu question").getByTestId("chat-message-actions").click();await b.locator('.app-shell a[href="/tr/organizasyonlar"]').first().click();await expect(b.getByTestId("chat-panel")).toHaveCount(0);await expect(b.getByTestId("chat-message-reply")).toHaveCount(0);
 }finally{if(pid&&!a.isClosed())await api(a,"POST",`/projects/${pid}/archive`).catch(()=>undefined);await ac.close();await bc.close();}
});
