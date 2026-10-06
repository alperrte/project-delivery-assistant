import { test,expect,type Page } from "@playwright/test";
import { MANAGER_STORAGE } from "./global-setup";
import { api,createProject } from "./helpers";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { localizeHref } from "../src/i18n/routing";
import { chooseMessageAction } from "./chat-actions";

async function arrow(page:Page,direction:"back"|"forward") {
 await page.mouse.move(1,200);await page.mouse.move(1,1);
 const button=page.getByTestId(`workspace-${direction}`);await expect(button).toBeEnabled();await button.click();
}
async function link(page:Page,href:string) {
 await page.locator(`.app-shell a[href="${localizeHref(href,"tr")}"]`).first().click();await expect(page).toHaveURL(new RegExp(localizeHref(href,"tr").replace(/[?]/g,"\\?")+"$"));
}
async function route(page:Page,href:string,replace=false) {
 await page.evaluate(({href,replace})=>{const router=(window as unknown as {next:{router:{push:(href:string)=>void;replace:(href:string)=>void}}}).next.router;router[replace?"replace":"push"](href);},{href,replace});
 await expect(page).toHaveURL(new RegExp(href.replace(/[?]/g,"\\?")+"$"));
}

test.use({storageState:MANAGER_STORAGE});
test("history header stays viewport-centered, fits mobile and remains outside full-chat inert",async({page})=>{
 const slug=await createProject(page,`History layout ${Date.now()}`),pid=((await api(page,"GET",`/projects/by-slug/${slug}`)).json as {id:string}).id;
 const screenshots=path.resolve("../.local/chat-action-nav-implementation/screens");mkdirSync(screenshots,{recursive:true});
 try {
  await expect(page.locator('[data-sonner-toast]')).toHaveCount(0);
  for(const width of [320,390,640,768,1024,1440])for(const dark of [false,true]){
   await page.setViewportSize({width,height:900});await page.evaluate(d=>document.documentElement.classList.toggle("dark",d),dark);await page.mouse.move(1,200);await page.mouse.move(1,1);
   const header=page.locator('.app-shell header');await expect(header).toBeVisible();await expect.poll(()=>header.evaluate(el=>{const scale=getComputedStyle(el).scale;return scale==="none"?1:Number.parseFloat(scale);})).toBe(1);const box=(await header.boundingBox())!;
   expect(box.x).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(width);expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(width);
   if(width<640){expect(box.height).toBe(112);await expect.poll(async()=>(await page.getByTestId("workspace-back").boundingBox())!.width).toBe(44);}
   expect(box.x+box.width/2).toBe(width/2);
   // One synchronous DOM snapshot: sequential protocol reads can mix positions from responsive width transitions.
   const controls=await header.getByRole("button").evaluateAll(buttons=>buttons.flatMap(button=>{const rect=button.getBoundingClientRect(),style=getComputedStyle(button);return rect.width>0&&rect.height>0&&style.visibility!=="hidden"?[{x:rect.x,y:rect.y,width:rect.width,height:rect.height,label:button.getAttribute("aria-label")??(button as HTMLElement).innerText}]:[];}));
   for(const control of controls){expect(control.x).toBeGreaterThanOrEqual(box.x);expect(control.x+control.width).toBeLessThanOrEqual(box.x+box.width);}
   for(let i=0;i<controls.length;i++)for(let j=i+1;j<controls.length;j++){const a=controls[i],b=controls[j];expect(Math.max(0,Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y)),JSON.stringify({width,dark,a,b})).toBeLessThanOrEqual(0.5);}
   if(width>=1024){await page.getByRole("button",{name:"Kenar çubuğunu daralt",exact:true}).click();expect((await header.boundingBox())!.x).toBe(box.x);await page.getByRole("button",{name:"Kenar çubuğunu genişlet",exact:true}).click();expect((await header.boundingBox())!.x).toBe(box.x);}
   await page.screenshot({path:path.join(screenshots,`header-${width}-${dark?"dark":"light"}.png`)});
  }
  await page.setViewportSize({width:390,height:844});await page.mouse.move(1,1);await page.getByRole("button",{name:"Gezinme menüsü",exact:true}).click();await page.getByRole("dialog").getByTestId("chat-nav-item").click();
  await expect(page.getByTestId("chat-panel")).toBeVisible();await expect(page.getByRole("dialog")).toHaveCount(0);
  const header=(await page.locator('.app-shell header').boundingBox())!,chat=(await page.getByTestId("chat-panel").boundingBox())!;expect(chat.y).toBe(128);expect(chat.y).toBeGreaterThan(header.y+header.height);
  expect(await page.getByTestId("workspace-back").evaluate(el=>!!el.closest("[inert]"))).toBe(false);expect(await page.locator("#main-content").getAttribute("inert")).not.toBeNull();
 }finally{await api(page,"POST",`/projects/${pid}/archive`);}
});

test("unknown native capability stays visibly disabled with an honest explanation",async({browser})=>{
 const context=await browser.newContext({storageState:MANAGER_STORAGE});await context.addInitScript(()=>Object.defineProperty(window,"navigation",{configurable:true,value:undefined}));const page=await context.newPage();
 try{await page.goto("/tr/projeler");await expect(page.getByTestId("workspace-history")).toHaveAttribute("data-history-status","unavailable");await expect(page.getByTestId("workspace-back")).toBeDisabled();await expect(page.getByTestId("workspace-forward")).toBeDisabled();await expect(page.getByText("Geçmiş bilgisi bu tarayıcıda okunamıyor; tarayıcı oklarını kullanın.")).toHaveCount(1);}finally{await context.close();}
});

test("PDA and browser traversal preserve native entries and close only fullscreen logical navigation",async({page})=>{
 const slug=await createProject(page,`History chat ${Date.now()}`),pid=((await api(page,"GET",`/projects/by-slug/${slug}`)).json as {id:string}).id;
 const root=localizeHref(`/projects/${slug}`,"tr");
 try{
  await link(page,`/projects/${slug}/tasks`);const tasks=page.url();await link(page,"/calendar");const calendar=page.url();
  await arrow(page,"back");await expect(page).toHaveURL(tasks);await arrow(page,"back");await expect(page).toHaveURL(new RegExp(root+"$"));
  await arrow(page,"forward");await expect(page).toHaveURL(tasks);await page.goBack();await expect(page).toHaveURL(new RegExp(root+"$"));await arrow(page,"forward");await expect(page).toHaveURL(tasks);await arrow(page,"forward");await expect(page).toHaveURL(calendar);
  await page.getByTestId("chat-nav-item").click();await expect(page.getByTestId("chat-composer")).toBeEnabled();await page.getByTestId("chat-composer").fill("history draft");
  await expect(page.getByTestId("workspace-forward")).toBeDisabled();await page.getByTestId("workspace-forward").evaluate(el=>(el as HTMLButtonElement).click());await expect(page.getByTestId("chat-panel")).toBeVisible();
  await arrow(page,"back");await expect(page).toHaveURL(tasks);await expect(page.getByTestId("chat-panel")).toHaveCount(0);await expect(page.getByTestId("chat-bar")).toHaveCount(0);await expect(page.locator("#main-content")).not.toHaveAttribute("inert","");
  await page.getByTestId("chat-nav-item").click();await expect(page.getByTestId("chat-composer")).toHaveValue("history draft");
  await page.getByTestId("chat-composer").fill("quoted original");await page.getByTestId("chat-composer").press("Enter");const message=page.getByTestId("chat-message").filter({hasText:"quoted original"});await expect(message).toHaveCount(1);await chooseMessageAction(message,"reply");await page.getByTestId("chat-composer").fill("reply draft");
  await page.getByTestId("chat-minimize").click();await page.getByTestId("chat-bar-expand").click();await expect(page.getByTestId("chat-compact")).toBeVisible();await arrow(page,"forward");await expect(page).toHaveURL(calendar);await expect(page.getByTestId("chat-composer")).toHaveValue("reply draft");await expect(page.getByTestId("chat-reply-context")).toBeVisible();
  await page.getByTestId("chat-minimize").click();await arrow(page,"back");await expect(page).toHaveURL(tasks);await expect(page.getByTestId("chat-bar")).toBeVisible();await page.getByTestId("chat-bar-expand").click();await expect(page.getByTestId("chat-composer")).toHaveValue("reply draft");
  await page.getByTestId("chat-fullscreen").click();await route(page,root+"?section=criteria");await expect(page.getByTestId("chat-panel")).toHaveCount(0);
  await page.getByTestId("chat-nav-item").click();await route(page,root+"?section=criteria&filter=qa#history");await expect(page.getByTestId("chat-panel")).toBeVisible();
  const index=await page.evaluate(()=>(window as unknown as {navigation:{currentEntry:{index:number}}}).navigation.currentEntry.index);
  await route(page,root+"?section=criteria&filter=replaced#history",true);expect(await page.evaluate(()=>(window as unknown as {navigation:{currentEntry:{index:number}}}).navigation.currentEntry.index)).toBe(index);
  await arrow(page,"back");await expect(page).toHaveURL(root+"?section=criteria");await expect(page.getByTestId("chat-panel")).toBeVisible();await arrow(page,"back");await expect(page).toHaveURL(tasks);await expect(page.getByTestId("chat-panel")).toHaveCount(0);
  await link(page,"/calendar");await expect(page.getByTestId("workspace-forward")).toBeDisabled();
 }finally{await api(page,"POST",`/projects/${pid}/archive`);}
});

test("locale document history and logged-out private traversal retain native/auth boundaries",async({browser})=>{
 const context=await browser.newContext({storageState:MANAGER_STORAGE});const page=await context.newPage();
 try{
  await page.goto("/tr/projeler?qa=history#locale");await page.locator("header").getByRole("button",{name:"Dil",exact:true}).click();await page.getByRole("menuitem",{name:/English/}).click();await expect(page).toHaveURL("/en/projects?qa=history#locale");await expect(page.locator("html")).toHaveAttribute("lang","en");
  await arrow(page,"back");await expect(page).toHaveURL("/tr/projeler?qa=history#locale");await expect(page.locator("html")).toHaveAttribute("lang","tr");await arrow(page,"forward");await expect(page.locator("html")).toHaveAttribute("lang","en");
  expect((await api(page,"POST","/auth/logout")).status).toBeLessThan(300);await page.goto("/en/login");await page.goBack();await expect(page).toHaveURL(/\/en\/login/);await expect(page.locator("#main-content")).toHaveCount(0);await expect(page.getByTestId("chat-bar")).toHaveCount(0);
 }finally{await context.close();}
});
