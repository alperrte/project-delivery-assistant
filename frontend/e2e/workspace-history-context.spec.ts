import {test,expect,type Page} from "@playwright/test";
import {api,createProject} from "./helpers";
import {MANAGER_STORAGE} from "./global-setup";
test.use({storageState:MANAGER_STORAGE});
async function arrow(page:Page,direction:"back"|"forward") {await page.mouse.move(1,200);await page.mouse.move(1,1);await page.getByTestId(`workspace-${direction}`).click();}
async function push(page:Page,href:string){await page.evaluate(h=>(window as unknown as {next:{router:{push:(href:string)=>void}}}).next.router.push(h),href);await expect(page).toHaveURL(new RegExp(href+"$"));}
test("native PDA traversal isolates projects and canceled traversal keeps fullscreen open",async({page})=>{
 const first=await createProject(page,`History A ${Date.now()}`),a=((await api(page,"GET",`/projects/by-slug/${first}`)).json as {id:string}).id;
 const second=await createProject(page,`History B ${Date.now()}`),b=((await api(page,"GET",`/projects/by-slug/${second}`)).json as {id:string}).id;
 try{
  await push(page,`/tr/projeler/${first}`);await page.getByTestId("chat-nav-item").click();await expect(page.getByTestId("chat-composer")).toBeEnabled();await page.getByTestId("chat-composer").fill("private A draft");await page.getByTestId("chat-minimize").click();
  await push(page,`/tr/projeler/${second}`);await expect(page.getByTestId("chat-bar")).toHaveCount(0);await page.getByTestId("chat-nav-item").click();await expect(page.getByTestId("chat-composer")).toHaveValue("");
  await arrow(page,"back");await expect(page).toHaveURL(new RegExp(`/tr/projeler/${first}$`));await expect(page.getByTestId("chat-panel")).toHaveCount(0);await page.getByTestId("chat-nav-item").click();await expect(page.getByTestId("chat-composer")).toHaveValue("");
  // TEST-ONLY cancellation at the native browser boundary; production does not intercept navigation.
  await page.evaluate(()=>{const n=(window as unknown as {navigation:EventTarget}).navigation;const cancel=(e:Event)=>e.preventDefault();Object.assign(window,{__cancelQaTraversal:cancel});n.addEventListener("navigate",cancel);});
  await arrow(page,"back");await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))));await expect(page).toHaveURL(new RegExp(`/tr/projeler/${first}$`));await expect(page.getByTestId("chat-panel")).toBeVisible();
  await page.evaluate(()=>{const w=window as unknown as {navigation:EventTarget;__cancelQaTraversal:EventListener};w.navigation.removeEventListener("navigate",w.__cancelQaTraversal);});
  // Real browser completion, no application debounce/queue. Mixed native and PDA inputs remain synchronized.
  await arrow(page,"forward");await expect(page).toHaveURL(new RegExp(`/tr/projeler/${second}$`));await page.goBack();await arrow(page,"forward");await expect(page).toHaveURL(new RegExp(`/tr/projeler/${second}$`));
  await page.evaluate(()=>{const w=window as unknown as {navigation:EventTarget;__qaEntries:number};w.__qaEntries=0;w.navigation.addEventListener("currententrychange",()=>w.__qaEntries++);history.back();history.back();history.forward();});await expect.poll(()=>page.evaluate(()=>(window as unknown as {__qaEntries:number}).__qaEntries)).toBeGreaterThan(0);
  await expect.poll(async()=>{const actual=await page.evaluate(()=>{const n=(window as unknown as {navigation:{canGoBack:boolean;canGoForward:boolean}}).navigation;return {back:n.canGoBack,forward:n.canGoForward};});return (await page.getByTestId("workspace-back").isEnabled())===actual.back&&(await page.getByTestId("workspace-forward").isEnabled())===actual.forward;}).toBe(true);
 }finally{await api(page,"POST",`/projects/${a}/archive`);await api(page,"POST",`/projects/${b}/archive`);}
});
