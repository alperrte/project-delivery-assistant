import { expect, test, type Page, type WebSocketRoute } from "@playwright/test";
import { api, createProject } from "./helpers";
import { MANAGER_STORAGE, MEMBER_STORAGE } from "./global-setup";
import { localizeHref } from "../src/i18n/routing";

test.describe.serial("Chat replies and reactions", () => {
  let a: Page, b: Page, slug: string, project: string, conversation: string;
  const row = (page: Page, text: string) => page.getByTestId("chat-message").filter({ has: page.getByTestId("chat-message-text").filter({ hasText: text }) });
  async function open(page: Page) { await page.getByTestId("chat-nav-item").click(); await expect(page.getByTestId("chat-composer")).toBeEnabled(); }
  async function send(page: Page, text: string) { await page.getByTestId("chat-composer").fill(text); await page.getByTestId("chat-composer").press("Enter"); }

  test.beforeAll(async ({ browser }) => {
    a = await (await browser.newContext({ storageState: MANAGER_STORAGE })).newPage();
    b = await (await browser.newContext({ storageState: MEMBER_STORAGE })).newPage();
    slug = await createProject(a, `Reply Reactions ${Date.now()}`);
    project = ((await api(a,"GET",`/projects/by-slug/${slug}`)).json as {id:string}).id;
    await b.goto("/projects");const person=((await api(b,"GET","/auth/me")).json as {id:string});
    const team=(await api(a,"POST",`/projects/${project}/teams`,{name:"Reply team"})).json as {id:string};
    const invitation=(await api(a,"POST",`/projects/${project}/invitations`,{userId:person.id,teamId:team.id,roles:["TESTER"]})).json as {invitationId:string;token:string};
    expect((await api(b,"POST",`/projects/${project}/invitations/${invitation.invitationId}/accept`,{token:invitation.token})).status).toBe(200);
    await a.goto(`/projects/${slug}`);await b.goto(`/projects/${slug}`);await open(a);await open(b);
    conversation=((await api(a,"GET",`/projects/${project}/chat/conversations`)).json as {group:{id:string}}).group.id;
  });
  test.afterAll(async()=>{if(a){await api(a,"POST",`/projects/${project}/archive`).catch(()=>undefined);await a.context().close();}await b?.context().close();});

  test("reply uses real two-user REST/WS/history; cancel/Escape preserve text and do not minimize", async () => {
    await send(a,"Meeting time? <b>plain text</b>");
    const original=row(b,"Meeting time?");await expect(original).toBeVisible();
    const originalId=await original.getAttribute("data-message-id");
    await original.hover();await original.getByTestId("chat-message-reply").click();
    await expect(b.getByTestId("chat-reply-context")).toContainText("Meeting time?");
    await b.getByTestId("chat-composer").fill("Keep draft");await b.getByTestId("chat-composer").press("Escape");
    await expect(b.getByTestId("chat-reply-context")).toHaveCount(0);
    await expect(b.getByTestId("chat-panel")).toBeVisible();await expect(b.getByTestId("chat-composer")).toHaveValue("Keep draft");
    await original.hover();await original.getByTestId("chat-message-reply").click();
    const request=b.waitForRequest(r=>r.method()==="POST"&&r.url().endsWith(`/conversations/${conversation}/messages`));
    await send(b,"14:00");expect((await request).postDataJSON()).toMatchObject({content:"14:00",replyToMessageId:originalId});
    await expect(row(a,"14:00").getByTestId("chat-reply-quote")).toHaveAttribute("data-reply-id",originalId!);
    await expect(row(a,"14:00").locator("b")).toHaveCount(0);
    await a.reload();await open(a);
    await expect(row(a,"14:00").getByTestId("chat-reply-quote")).toContainText("Meeting time?");
    const history=(await api(a,"GET",`/projects/${project}/chat/conversations/${conversation}/messages`)).json as {messages:{content:string;replyTo:{id:string}|null}[]};
    expect(history.messages.find(m=>m.content==="14:00")?.replyTo?.id).toBe(originalId);
  });

  test("direct reply arrives only in the selected direct conversation and survives reload", async () => {
    const actorA=(await api(a,"GET","/auth/me")).json as {id:string};
    const actorB=(await api(b,"GET","/auth/me")).json as {id:string};
    await a.locator(`[data-testid="chat-conversation-direct"][data-peer-id="${actorB.id}"]`).click();
    await b.locator(`[data-testid="chat-conversation-direct"][data-peer-id="${actorA.id}"]`).click();
    await expect(a.getByTestId("chat-composer")).toBeEnabled();await expect(b.getByTestId("chat-composer")).toBeEnabled();
    await send(a,"Direct question");const target=row(b,"Direct question");await expect(target).toBeVisible();
    await target.hover();await target.getByTestId("chat-message-reply").click();await send(b,"Direct answer");
    await expect(row(a,"Direct answer").getByTestId("chat-reply-quote")).toContainText("Direct question");
    await a.reload();await open(a);await a.locator(`[data-testid="chat-conversation-direct"][data-peer-id="${actorB.id}"]`).click();
    await expect(row(a,"Direct answer").getByTestId("chat-reply-quote")).toContainText("Direct question");
    await a.getByTestId("chat-conversation-group").click();await b.getByTestId("chat-conversation-group").click();
  });

  test("failed reply retries its captured target even after reply mode is cleared", async () => {
    await send(a,"Retry question");const target=row(b,"Retry question");await expect(target).toBeVisible();
    const id=await target.getAttribute("data-message-id");await target.hover();await target.getByTestId("chat-message-reply").click();
    let blocked=true;
    await b.route(`**/conversations/${conversation}/messages`,route=>{if(route.request().method()==="POST"&&blocked){blocked=false;return route.abort();}return route.continue();});
    await send(b,"Retry answer");const failed=b.getByTestId("chat-pending");await expect(failed).toHaveAttribute("data-status","failed");
    await expect(failed.getByTestId("chat-reply-quote")).toHaveAttribute("data-reply-id",id!);
    await failed.getByRole("button",{name:"Tekrar dene",exact:true}).click();
    await expect(row(a,"Retry answer").getByTestId("chat-reply-quote")).toHaveAttribute("data-reply-id",id!);
    await b.unroute(`**/conversations/${conversation}/messages`);
  });

  test("reactions update the other user's open view, toggle, aggregate and never create unread messages", async () => {
    await a.goto(`/tr/projeler/${slug}`);await b.goto(`/tr/projeler/${slug}`);await open(a);await open(b);
    await send(a,"React meeting");const original=row(b,"React meeting");await expect(original).toBeVisible();
    async function choose(page:Page,code:string){const message=row(page,"React meeting");await message.hover();await message.getByTestId("chat-message-react").click();await page.getByTestId(`emoji-${code}`).click();}
    // Stabilize the existing read debounce before measuring reaction-only effects.
    expect((await api(a,"POST",`/projects/${project}/chat/conversations/${conversation}/read`)).status).toBe(204);
    const before=(await api(a,"GET",`/projects/${project}/chat/conversations`)).json as {totalUnread:number};
    await choose(b,"THUMBS_UP");
    await expect(row(a,"React meeting").getByTestId("chat-reaction-THUMBS_UP")).toContainText("1");
    await expect(original.getByTestId("chat-reaction-THUMBS_UP")).toHaveAttribute("aria-pressed","true");
    await expect(row(a,"React meeting").getByTestId("chat-reaction-THUMBS_UP")).toHaveAttribute("aria-pressed","false");
    await original.getByTestId("chat-reaction-THUMBS_UP").click();
    await expect(row(a,"React meeting").getByTestId("chat-reactions")).toHaveCount(0);
    await choose(b,"THUMBS_UP");await choose(b,"HEART");
    await row(a,"React meeting").getByTestId("chat-reaction-THUMBS_UP").click();
    await expect(original.getByTestId("chat-reaction-THUMBS_UP")).toContainText("2");
    await expect(row(a,"React meeting").getByTestId("chat-reaction-HEART")).toContainText("1");
    expect(((await api(a,"GET",`/projects/${project}/chat/conversations`)).json as {totalUnread:number}).totalUnread).toBe(before.totalUnread);
    await a.reload();await open(a);
    await expect(row(a,"React meeting").getByTestId("chat-reaction-THUMBS_UP")).toContainText("2");
    await expect(row(a,"React meeting").getByTestId("chat-reaction-THUMBS_UP")).toHaveAttribute("aria-pressed","true");
    await expect(row(a,"React meeting").getByTestId("chat-reaction-HEART")).toHaveAttribute("aria-pressed","false");
  });

  test("composer emoji insertion preserves caret and sends real Unicode; picker Escape does not cancel reply", async () => {
    const input=b.getByTestId("chat-composer");await input.fill("AB");
    await input.evaluate((element:HTMLTextAreaElement)=>{element.focus();element.setSelectionRange(1,1);});
    await b.getByTestId("chat-composer-emoji").click();await b.getByTestId("emoji-LAUGH").click();
    await expect(input).toHaveValue("A😂B");await expect(input).toBeFocused();
    await input.fill("");await b.getByTestId("chat-composer-emoji").click();await b.getByTestId("emoji-LAUGH").click();
    await b.getByTestId("chat-composer-emoji").click();await b.getByTestId("emoji-HEART").click();
    await expect(input).toHaveValue("😂❤️");await input.press("Enter");
    await expect(row(a,"😂❤️")).toBeVisible();await a.reload();await open(a);await expect(row(a,"😂❤️")).toBeVisible();
    const target=row(b,"React meeting");await target.hover();await target.getByTestId("chat-message-reply").click();
    const picker=b.getByTestId("chat-composer-emoji");await picker.focus();await picker.press("Enter");
    await expect(b.getByTestId("chat-composer-emoji-popup")).toBeVisible();
    await b.getByTestId("emoji-SMILE").press("Escape");
    await expect(b.getByTestId("chat-composer-emoji-popup")).toHaveCount(0);
    await expect(b.getByTestId("chat-reply-context")).toBeVisible();await expect(b.getByTestId("chat-panel")).toBeVisible();
    await expect(input).toBeFocused();await input.press("Escape");await expect(b.getByTestId("chat-reply-context")).toHaveCount(0);
  });

  test("failed reaction shows error without changing chips; mobile picker fits both themes", async () => {
    const target=row(b,"React meeting");await target.hover();await target.getByTestId("chat-message-react").click();
    await b.route("**/messages/*/reactions/SAD",route=>route.abort());
    await b.getByTestId("emoji-SAD").click();
    await expect(b.getByText("Tepki gönderilemedi.",{exact:false})).toBeVisible();
    await expect(target.getByTestId("chat-reaction-SAD")).toHaveCount(0);await b.unroute("**/messages/*/reactions/SAD");
    await b.getByTestId("chat-minimize").click();await b.getByTestId("chat-bar-expand").click();
    await b.setViewportSize({width:390,height:844});
    for(const dark of [false,true]){
      await b.evaluate(value=>document.documentElement.classList.toggle("dark",value),dark);
      await b.getByTestId("chat-composer-emoji").click();const popup=b.getByTestId("chat-composer-emoji-popup");await expect(popup).toBeVisible();
      const bounds=(await popup.boundingBox())!;expect(bounds.x).toBeGreaterThanOrEqual(0);expect(bounds.x+bounds.width).toBeLessThanOrEqual(390);
      await b.getByTestId("emoji-SMILE").press("Escape");await expect(popup).toHaveCount(0);
    }
    await b.setViewportSize({width:1280,height:720});await b.getByTestId("chat-fullscreen").click();
  });

  test("cached reopen and real socket reconnect batch-resync missed reactions on an old message", async ({browser}) => {
    await send(a,"Old message for reaction resync");
    const id=(await row(a,"Old message for reaction resync").getAttribute("data-message-id"))!;
    const context=await browser.newContext({storageState:await a.context().storageState()});
    let dropReactions=false,pauseConnections=false,clientSocket:WebSocketRoute|undefined;
    // TEST-ONLY loss injection. Every forwarded frame and every snapshot comes from the real backend.
    await context.routeWebSocket("**/api/v1/ws",socket=>{
      if(pauseConnections){void socket.close();return;}
      const server=socket.connectToServer();clientSocket=socket;
      server.onMessage(data=>{if(dropReactions&&data.toString().includes('"type":"REACTIONS"'))return;socket.send(data);});
    });
    const page=await context.newPage();const snapshots:string[][]=[];
    page.on("request",request=>{if(request.url().includes("/messages/reactions?"))snapshots.push((new URL(request.url()).searchParams.get("messageIds")??"").split(","));});
    try {
      await page.goto(`/tr/projeler/${slug}`);await open(page);await expect(row(page,"Old message for reaction resync")).toBeVisible();
      await page.getByTestId("chat-composer").fill("resync draft");
      dropReactions=true;
      expect((await api(b,"PUT",`/projects/${project}/chat/conversations/${conversation}/messages/${id}/reactions/THANKS`)).status).toBe(200);
      await expect(row(page,"Old message for reaction resync").getByTestId("chat-reactions")).toHaveCount(0);
      await page.getByTestId("chat-panel-close").click();dropReactions=false;
      await open(page);
      await expect(row(page,"Old message for reaction resync").getByTestId("chat-reaction-THANKS")).toContainText("1");
      expect(snapshots.some(batch=>batch.includes(id))).toBe(true);
      const before=snapshots.length;
      pauseConnections=true;await clientSocket!.close({code:1001,reason:"QA reconnect"});
      expect((await api(b,"PUT",`/projects/${project}/chat/conversations/${conversation}/messages/${id}/reactions/SAD`)).status).toBe(200);
      pauseConnections=false;
      await expect(row(page,"Old message for reaction resync").getByTestId("chat-reaction-SAD")).toContainText("1",{timeout:15000});
      await expect(page.getByTestId("chat-composer")).toHaveValue("resync draft");
      expect(snapshots.length).toBeGreaterThan(before);expect(snapshots.every(batch=>batch.length<=50)).toBe(true);
    } finally {await context.close();}
  });

  test("reply controls translate and fit mobile light/dark; context survives compact and navigation close", async () => {
    const labels={tr:"Yanıtla",en:"Reply",de:"Antworten"};
    for(const locale of ["tr","en","de"] as const){
      await b.goto(localizeHref(`/projects/${slug}`,locale));
      await open(b);await expect(row(b,"Retry question")).toBeVisible();
      await row(b,"Retry question").hover();await row(b,"Retry question").getByRole("button",{name:labels[locale],exact:true}).click();
      await b.getByTestId("chat-composer").fill(`draft ${locale}`);
      await b.getByTestId("chat-minimize").click();await b.getByTestId("chat-bar-expand").click();
      await expect(b.getByTestId("chat-reply-context")).toContainText("Retry question");
      await b.getByTestId("chat-fullscreen").click();
      await b.locator(`.app-shell a[href="${localizeHref("/settings",locale)}"]`).first().click();
      await expect(b.getByTestId("chat-panel")).toHaveCount(0);await open(b);
      await expect(b.getByTestId("chat-reply-context")).toBeVisible();
      const emojiLabels={tr:"Emoji seç",en:"Choose emoji",de:"Emoji auswählen"};
      await b.getByTestId("chat-composer").evaluate((input:HTMLTextAreaElement)=>input.setSelectionRange(input.value.length,input.value.length));
      await b.getByTestId("chat-composer-emoji").click();
      await expect(b.getByTestId("chat-composer-emoji-popup")).toHaveAttribute("aria-label",emojiLabels[locale]);
      await b.getByTestId("emoji-SMILE").click();
      await expect(b.getByTestId("chat-composer")).toHaveValue(`draft ${locale}😀`);
      for(const dark of [false,true]){
        await b.evaluate(dark=>document.documentElement.classList.toggle("dark",dark),dark);
        await b.setViewportSize({width:390,height:844});
        // Full mobile starts on its list; switch to the same group conversation.
        if(!await b.getByTestId("chat-composer").isVisible())await b.getByTestId("chat-conversation-group").click();
        await expect(b.getByTestId("chat-reply-context")).toBeVisible();
        expect(await b.evaluate(()=>document.documentElement.scrollWidth)).toBe(390);
      }
      await b.setViewportSize({width:1280,height:720});
    }
    await b.goto(`/projects/${slug}`);await open(b);
  });
});
