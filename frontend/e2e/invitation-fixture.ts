import { expect, type Page } from "@playwright/test";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { AUTH_DIR } from "./global-setup";
import { api, login, uniqueUser } from "./helpers";

/** Real isolated QA recipient via existing invitation registration; no quota overrides or unrelated pending-row cleanup. */
export async function createIsolatedInvitationRecipient(manager: Page, recipient: Page) {
 const identity=await api(manager,"GET","/auth/me");expect(identity.status).toBe(200);
 const managerId=(identity.json as {id:string}).id;
 if(!/^[a-f0-9-]{36}$/.test(managerId))throw Error("Invalid suite QA manager UUID");
 const fixtureFile=path.join(AUTH_DIR,`invitation-recipient-${managerId}.json`);
 if(existsSync(fixtureFile)) {
  const saved=JSON.parse(readFileSync(fixtureFile,"utf8")) as {account:ReturnType<typeof uniqueUser>;bootstrapId:string};
  await login(recipient,saved.account.email,saved.account.password);
  return {bootstrapId:saved.bootstrapId};
 }
 const account=uniqueUser("recipient"); let bootstrapId: string | undefined;
 try {
  await recipient.goto("/login");
  const project=await api(manager,"POST","/projects",{name:`Invitation recipient QA ${Date.now()}`,projectType:"WEB"});expect(project.status).toBe(201);
  bootstrapId=(project.json as {id:string}).id;
  const team=await api(manager,"POST",`/projects/${bootstrapId}/teams`,{name:"Recipient setup",includeCreator:true});expect(team.status).toBe(201);
  const invitation=await api(manager,"POST",`/projects/${bootstrapId}/invitations`,{email:account.email,firstName:"QA",lastName:"Recipient",teamId:(team.json as {id:string}).id,roles:["TESTER"]});expect(invitation.status).toBe(201);
  expect((await api(recipient,"POST","/auth/register/invitation",{token:(invitation.json as {token:string}).token,...account,firstName:"QA",lastName:"Recipient",confirmPassword:account.password})).status).toBe(200);
  await login(recipient,account.email,account.password);
  writeFileSync(fixtureFile,JSON.stringify({account,bootstrapId}));
  return {bootstrapId};
 } catch(error) {if(bootstrapId)await api(manager,"POST",`/projects/${bootstrapId}/archive`);throw error;}
}
