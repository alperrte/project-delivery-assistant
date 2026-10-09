import { test, expect, type Page } from "@playwright/test";
import { api } from "./helpers";
import { createIsolatedInvitationRecipient } from "./invitation-fixture";
import { MANAGER_STORAGE } from "./global-setup";
import { notificationInDatabase, clearQaInvitationContext } from "./notification-db";
import { localizeHref } from "../src/i18n/routing";
import tr from "../src/i18n/messages/tr.json";
import en from "../src/i18n/messages/en.json";
import de from "../src/i18n/messages/de.json";

type Note = { id: string; type: string; resourceId: string; read: boolean; popupPresentedAt: string | null; invitationContext: { projectName: string } | null };
const notes = async (page: Page) => ((await api(page, "GET", "/notifications?size=100")).json as { content: Note[] }).content;

test("real invitation project snapshot stays localized, plain text and persistent in New/History after rename", async ({ browser }) => {
 test.setTimeout(150_000);
 const ac = await browser.newContext({ storageState: MANAGER_STORAGE }), a = await ac.newPage();
 const bc = await browser.newContext(), b = await bc.newPage();
 let id: string | undefined, bootstrapId: string | undefined;
 try {
  await a.goto("/projects"); bootstrapId=(await createIsolatedInvitationRecipient(a,b)).bootstrapId;
  await b.goto("/projects");
  const user = (await api(b,"GET","/auth/me")).json as {id:string};
  const name = `Invitation <img src=x> "QA" ${Date.now()} ` + "LongName".repeat(8);
  const made = await api(a,"POST","/projects",{name,projectType:"WEB"}); expect(made.status).toBe(201);
  const project = made.json as {id:string;name:string;description:string|null;priority:string;status:string;projectType:string}; id=project.id;
  const team = await api(a,"POST",`/projects/${id}/teams`,{name:"Context team",includeCreator:true}); expect(team.status).toBe(201);
  const invite = await api(a,"POST",`/projects/${id}/invitations`,{userId:user.id,teamId:(team.json as {id:string}).id,roles:["TESTER"]}); expect(invite.status).toBe(201);
  const invitationId=(invite.json as {invitationId:string}).invitationId;
  const created=(await notes(b)).find(n=>n.resourceId===invitationId && n.type==="PROJECT_INVITATION_CREATED")!;
  expect(created.invitationContext).toEqual({projectName:name}); expect(created.read).toBe(false);
  expect(notificationInDatabase(user.id,created.id)).toMatchObject({rowCount:1,read:false,presentedAt:null});
  expect((await api(b,"GET",`/projects/${id}`)).status).toBe(403);
  const renamed = `Renamed QA ${Date.now()}`;
  expect((await api(a,"PUT",`/projects/${id}`,{...project,name:renamed})).status).toBe(200);
  // Only lookups of the invited (still private) project count; the sidebar legitimately reads the recipient's own selected project's /home.
  const lookups:string[]=[];b.on("request",r=>{const p=new URL(r.url()).pathname;if(p.startsWith("/api/v1/") && new RegExp(`/projects/${id}(?:/home)?$`).test(p))lookups.push(r.url());});
  for(const locale of ["tr","en","de"] as const) for(const width of [320,1440]) {
   await b.setViewportSize({width,height:900}); await b.goto(localizeHref("/projects",locale)); await b.mouse.move(20,2);
   const strings=({tr,en,de})[locale].notifications;
   await b.getByRole("button",{name:strings.title,exact:true}).click();
   const row=b.locator(`[data-notification-id="${created.id}"]`);
   await expect(row).toContainText(strings.invitationContext.PROJECT_INVITATION_CREATED.replace("{project}",name));
   await expect(row.locator("img")).toHaveCount(0);
   await expect(row.locator("a")).toHaveCount(0);
   await expect.poll(()=>b.evaluate(()=>document.documentElement.scrollWidth)).toBe(width);
   await b.screenshot({path:`../.local/project-invitations-create-implementation/task6-${locale}-${width}.png`});
   await b.keyboard.press("Escape");
  }
  expect(lookups).toEqual([]);
  // The locale loop leaves NEXT_LOCALE=de; unprefixed URLs follow that cookie, so return to the Turkish URL explicitly.
  await b.goto(localizeHref("/projects","tr")); await b.mouse.move(20,2); await b.getByRole("button",{name:"Bildirimler",exact:true}).click();
  const row=b.locator(`[data-notification-id="${created.id}"]`);
  const read=b.waitForResponse(r=>r.url().endsWith(`/notifications/${created.id}/read`)&&r.request().method()==="PATCH");
  await row.getByRole("button",{name:"Okundu olarak işaretle",exact:true}).click(); expect((await read).status()).toBe(200);
  await b.getByRole("tab",{name:"Geçmiş",exact:true}).click(); await expect(row).toContainText(name);
  expect(notificationInDatabase(user.id,created.id)).toMatchObject({read:true,presentedAt:null});
  expect((await notes(b)).find(n=>n.id===created.id)?.invitationContext).toEqual({projectName:name});
  expect((await api(b,"POST",`/project-invitations/${invitationId}/reject`)).status).toBe(204);
  const rejected=(await notes(a)).find(n=>n.resourceId===invitationId && n.type==="PROJECT_INVITATION_REJECTED")!;
  expect(rejected.invitationContext).toEqual({projectName:renamed});
  const second=await api(a,"POST",`/projects/${id}/invitations`,{userId:user.id,teamId:(team.json as {id:string}).id,roles:["TESTER"]});expect(second.status).toBe(201);
  const secondId=(second.json as {invitationId:string}).invitationId;
  expect((await api(b,"POST",`/project-invitations/${secondId}/accept`)).status).toBe(200);
  const accepted=(await notes(a)).find(n=>n.resourceId===secondId&&n.type==="PROJECT_INVITATION_ACCEPTED")!;expect(accepted.invitationContext).toEqual({projectName:renamed});
  for(const locale of ["tr","en","de"] as const) {
   await a.goto(localizeHref("/projects",locale));await a.mouse.move(20,2);
   const strings=({tr,en,de})[locale].notifications;
   await a.getByRole("button",{name:strings.title,exact:true}).click();
   await expect(a.locator(`[data-notification-id="${rejected.id}"]`)).toContainText(strings.invitationContext.PROJECT_INVITATION_REJECTED.replace("{project}",renamed));
   await expect(a.locator(`[data-notification-id="${accepted.id}"]`)).toContainText(strings.invitationContext.PROJECT_INVITATION_ACCEPTED.replace("{project}",renamed));
  }
  const manager=(await api(a,"GET","/auth/me")).json as {id:string};
  clearQaInvitationContext(manager.id,accepted.id);
  await a.goto(localizeHref("/projects","tr"));await a.mouse.move(20,2);await a.getByRole("button",{name:"Bildirimler",exact:true}).click();
  await expect(a.locator(`[data-notification-id="${accepted.id}"]`)).toContainText(tr.notifications.bodies.PROJECT_INVITATION_ACCEPTED);
  expect((await notes(a)).find(n=>n.id===accepted.id)?.invitationContext).toBeNull();
 } finally {if(id)await api(a,"POST",`/projects/${id}/archive`);if(bootstrapId)await api(a,"POST",`/projects/${bootstrapId}/archive`);await ac.close();await bc.close();}
});
