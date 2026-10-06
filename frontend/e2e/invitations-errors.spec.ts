import {test,expect} from "@playwright/test";
import {api} from "./helpers";
import {MANAGER_STORAGE} from "./global-setup";
import {ApiError} from "../src/lib/api/client";
import {isInvalidInvitationToken,isPreviewServerFailure} from "../src/features/invitations/external-preview-error";
import messages from "../src/i18n/messages/tr.json";

test("INV-004 error classification preserves token validity versus network/server/rate limit",()=>{
 expect(isInvalidInvitationToken(new ApiError(404))).toBe(true);
 expect(isInvalidInvitationToken(new ApiError(400,undefined,{token:"token"}))).toBe(true);
 for(const status of [0,403,429,500,503])expect(isInvalidInvitationToken(new ApiError(status))).toBe(false);
 expect(isInvalidInvitationToken(new ApiError(400))).toBe(false);
 expect(isPreviewServerFailure(new ApiError(503))).toBe(true);expect(isPreviewServerFailure(new ApiError(0))).toBe(false);
});

test("INV-004 TEST-ONLY preview failures have correct copy; retry returns the actual server preview",async({browser})=>{
 const ac=await browser.newContext({storageState:MANAGER_STORAGE}),gc=await browser.newContext();const a=await ac.newPage(),g=await gc.newPage();let pid:string|undefined;let failure:number|"network"|null=500;
 try{
  await a.goto("/tr/projeler");const name=`INV preview retry ${Date.now()}`,p=(await api(a,"POST","/projects",{name,projectType:"WEB"})).json as {id:string};pid=p.id;const team=(await api(a,"POST",`/projects/${pid}/teams`,{name:"Error team",includeCreator:true})).json as {id:string};const inv=(await api(a,"POST",`/projects/${pid}/invitations`,{email:`inv-error-${Date.now()}@example.test`,firstName:"Audit",lastName:"Guest",roles:["TESTER"],teamId:team.id})).json as {token:string};
  await g.route("**/api/v1/project-invitations/external/preview",async route=>{
   if(failure===null){await route.continue();return;}
   if(failure==="network"){await route.abort("connectionfailed");return;}
   await route.fulfill({status:failure,contentType:"application/problem+json",body:JSON.stringify({status:failure,...(failure===400?{invalidFields:["token"]}:{})})});
  });
  for(const value of [500,503,"network",404,400] as const){
   failure=value;await g.goto(`/tr/kayit?failure=${value}#invitation=${inv.token}`);
   const expected=value==="network"?messages.errors.network:value===404||value===400?messages.invitations.externalExpired:messages.invitations.externalUnavailable;
   await expect(g.getByRole("alert").filter({hasText:expected})).toBeVisible();
   if(value===404||value===400){await expect(g.getByRole("button",{name:messages.invitations.retry,exact:true})).toHaveCount(0);}
   else{
    await expect(g.getByRole("button",{name:messages.invitations.retry,exact:true})).toBeVisible();
    if(value===500){failure=null;await g.getByRole("button",{name:messages.invitations.retry,exact:true}).click();await expect(g.getByText(name,{exact:false})).toBeVisible();await expect(g.getByRole("button",{name:"Kayıt ol ve projeye katıl",exact:true})).toBeVisible();await expect(g.getByRole("alert").filter({hasText:expected})).toHaveCount(0);}
   }
  }
 }finally{if(pid)await api(a,"POST",`/projects/${pid}/archive`);await ac.close();await gc.close();}
});

test("INV-004 real backend429 is rate limit, never expired; retry retains the enforced quota",async({browser})=>{
 const ac=await browser.newContext({storageState:MANAGER_STORAGE}),gc=await browser.newContext();const a=await ac.newPage(),g=await gc.newPage();let pid:string|undefined;
 try{
  await a.goto("/tr/projeler");await g.goto("/tr/giris");const p=(await api(a,"POST","/projects",{name:`INV rate limit ${Date.now()}`,projectType:"WEB"})).json as {id:string};pid=p.id;const team=(await api(a,"POST",`/projects/${pid}/teams`,{name:"Rate team",includeCreator:true})).json as {id:string};const inv=(await api(a,"POST",`/projects/${pid}/invitations`,{email:`inv-rate-${Date.now()}@example.test`,firstName:"Audit",lastName:"Guest",roles:["TESTER"],teamId:team.id})).json as {token:string};
  let status=0;for(let n=0;n<220&&status!==429;n++)status=(await api(g,"POST","/project-invitations/external/preview",{token:inv.token})).status;expect(status).toBe(429);
  await g.goto(`/tr/kayit#invitation=${inv.token}`);await expect(g.getByRole("alert").filter({hasText:messages.errors.tooManyRequests})).toBeVisible();await expect(g.getByText(messages.invitations.externalExpired,{exact:true})).toHaveCount(0);
  await g.getByRole("button",{name:messages.invitations.retry,exact:true}).click();await expect(g.getByRole("alert").filter({hasText:messages.errors.tooManyRequests})).toBeVisible();
 }finally{if(pid)await api(a,"POST",`/projects/${pid}/archive`);await ac.close();await gc.close();}
});
