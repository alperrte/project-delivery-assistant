import {test,expect} from "@playwright/test";
import {existsSync,readFileSync} from "node:fs";
import path from "node:path";
import {api,login,registerUser,uniqueUser} from "./helpers";
import {AUTH_DIR,MANAGER_STORAGE,MEMBER_STORAGE,MEMBER_USER_FILE} from "./global-setup";
import {expireQaInvitation,invitationInDatabase} from "./invitation-db";

test("INV-003 same-document account switch isolates invitation list/preview and late real responses",async({browser})=>{
 const ac=await browser.newContext({storageState:MANAGER_STORAGE}),bc=await browser.newContext(),cc=await browser.newContext();
 const a=await ac.newPage(),b=await bc.newPage(),c=await cc.newPage();const member=JSON.parse(readFileSync(MEMBER_USER_FILE,"utf8"));const outsiderFile=path.join(AUTH_DIR,"chat-outsider-user.json");const reuseOutsider=existsSync(outsiderFile);const outsider=reuseOutsider?JSON.parse(readFileSync(outsiderFile,"utf8")):uniqueUser("invscope");let pid:string|undefined;
 let releaseB!:()=>void,releaseC!:()=>void;const heldB=new Promise<void>(r=>releaseB=r),heldC=new Promise<void>(r=>releaseC=r);let arrivedB!:()=>void,arrivedC!:()=>void;const startedB=new Promise<void>(r=>arrivedB=r),startedC=new Promise<void>(r=>arrivedC=r);let phase:"B"|"C"="B";
 try{
  await a.goto("/tr/projeler");await login(b,member.email,member.password);if(reuseOutsider)await login(c,outsider.email,outsider.password);else await registerUser(c,outsider);const recipient=(await api(b,"GET","/auth/me")).json as {id:string};
  const name=`INV regression scope ${Date.now()}`;const p=(await api(a,"POST","/projects",{name,projectType:"WEB"})).json as {id:string};pid=p.id;
  const team=(await api(a,"POST",`/projects/${pid}/teams`,{name:"Private scope",includeCreator:true})).json as {id:string};const invitation=(await api(a,"POST",`/projects/${pid}/invitations`,{userId:recipient.id,teamId:team.id,roles:["TESTER"],message:"B private invitation"})).json as {invitationId:string};
  await b.locator('.app-shell a[href="/tr/davetler"]').first().click();const row=b.getByRole("row").filter({hasText:name});await expect(row).toBeVisible();await row.getByRole("button",{name:/proje bilgilerini/}).click();await expect(b.getByRole("dialog")).toContainText(name);await b.keyboard.press("Escape");
  await b.locator('.app-shell a[href="/tr/projeler"]').first().click();
  // TEST-ONLY late delivery of a real authorized response, not a fabricated successful body.
  await b.route("**/api/v1/project-invitations/me**",async route=>{
   if(new URL(route.request().url()).searchParams.get("size")==="100"){await route.continue();return;}
   if(phase==="B"){const response=await route.fetch();arrivedB();await heldB;await route.fulfill({response}).catch(()=>undefined);}
   else{arrivedC();await heldC;await route.continue().catch(()=>undefined);}
  });
  await b.locator('.app-shell a[href="/tr/davetler"]').first().click();await startedB;
  await b.mouse.move(1,200);await b.mouse.move(1,1);await b.locator("header").getByRole("button",{name:/Hesap/}).click();await b.getByRole("menuitem",{name:"Çıkış yap",exact:true}).click();await expect(b).toHaveURL(/\/tr\/giris/);
  phase="C";await b.locator('input[name="email"]').fill(outsider.email);await b.locator('input[name="password"]').fill(outsider.password);await b.getByRole("button",{name:/^Giriş yap$/}).click();await expect(b.locator("#main-content")).toBeVisible();
  await b.locator('.app-shell a[href="/tr/davetler"]').first().click();await startedC;releaseB();
  await expect(b.getByRole("row").filter({hasText:name})).toHaveCount(0);await expect(b.getByText("B private invitation",{exact:true})).toHaveCount(0);await expect(b.getByRole("dialog")).toHaveCount(0);
  expect((await api(b,"GET",`/projects/${pid}`)).status).toBe(403);expect((await api(b,"POST",`/project-invitations/${invitation.invitationId}/accept`)).status).toBe(404);
  releaseC();await expect(b.getByRole("status")).toHaveCount(0);await expect(b.getByRole("row").filter({hasText:name})).toHaveCount(0);
 }finally{releaseB();releaseC();if(pid)await api(a,"POST",`/projects/${pid}/archive`);await ac.close();await bc.close();await cc.close();}
});

test("INV-002 legacy token accept refreshes warm project list and sidebar without reload",async({browser})=>{
 const ac=await browser.newContext({storageState:MANAGER_STORAGE}),bc=await browser.newContext({storageState:MEMBER_STORAGE});const a=await ac.newPage(),b=await bc.newPage();let pid:string|undefined;
 try{
  await a.goto("/tr/projeler");await b.goto("/tr/projeler");await expect(b.getByRole("heading",{name:"Projeler",exact:true})).toBeVisible();const user=(await api(b,"GET","/auth/me")).json as {id:string};
  const name=`INV legacy warm ${Date.now()}`,p=(await api(a,"POST","/projects",{name,projectType:"WEB"})).json as {id:string;slug:string};pid=p.id;const team=(await api(a,"POST",`/projects/${pid}/teams`,{name:"Legacy team",includeCreator:true})).json as {id:string};const inv=(await api(a,"POST",`/projects/${pid}/invitations`,{userId:user.id,teamId:team.id,roles:["TESTER"]})).json as {invitationId:string;token:string};
  let accepts=0;b.on("request",r=>{if(r.method()==="POST"&&r.url().endsWith(`/${inv.invitationId}/accept`))accepts++;});
  await b.evaluate(url=>(window as unknown as {next:{router:{push:(url:string)=>void}}}).next.router.push(url),`/tr/davetler/${pid}/${inv.invitationId}?token=${inv.token}`);await b.getByRole("button",{name:"Kabul et",exact:true}).click();await expect(b.getByText("Projeye katıldınız.",{exact:true})).toBeVisible();expect(invitationInDatabase(inv.invitationId,user.id)).toEqual({status:"ACCEPTED",membership:"ACTIVE",roles:["TESTER"],teamRows:1});
  await b.getByRole("button",{name:/Projelere/}).click();await expect(b.locator(`a[href="/tr/projeler/${p.slug}/genel-bakis"]`).first()).toBeVisible({timeout:5000});expect(accepts).toBe(1);await b.locator(`a[href="/tr/projeler/${p.slug}/genel-bakis"]`).first().click();await expect(b.getByRole("heading",{name,exact:true})).toBeVisible();
 }finally{if(pid)await api(a,"POST",`/projects/${pid}/archive`);await ac.close();await bc.close();}
});

test("INV-002 external signed-in accept refreshes the existing warm membership cache family",async({browser})=>{
 const ac=await browser.newContext({storageState:MANAGER_STORAGE}),ec=await browser.newContext();const a=await ac.newPage(),e=await ec.newPage();const user=uniqueUser("invexternal");let pid:string|undefined,bootstrapId:string|undefined;
 try{
  await a.goto("/tr/projeler");const name=`INV external warm ${Date.now()}`,p=(await api(a,"POST","/projects",{name,projectType:"WEB"})).json as {id:string;slug:string};pid=p.id;const team=(await api(a,"POST",`/projects/${pid}/teams`,{name:"External team",includeCreator:true})).json as {id:string};
  // Invite while unregistered, then register through another genuine invitation. No extra normal-register quota is consumed.
  const inv=(await api(a,"POST",`/projects/${pid}/invitations`,{email:user.email,firstName:"Audit",lastName:"Guest",teamId:team.id,roles:["TESTER"]})).json as {invitationId:string;token:string};
  const bootstrap=(await api(a,"POST","/projects",{name:`INV bootstrap ${Date.now()}`,projectType:"WEB"})).json as {id:string;slug:string};bootstrapId=bootstrap.id;const bootstrapTeam=(await api(a,"POST",`/projects/${bootstrapId}/teams`,{name:"Bootstrap team",includeCreator:true})).json as {id:string};const bootstrapInvite=(await api(a,"POST",`/projects/${bootstrapId}/invitations`,{email:user.email,firstName:"Audit",lastName:"Guest",teamId:bootstrapTeam.id,roles:["TESTER"]})).json as {token:string};
  await e.goto("/tr/giris");expect((await api(e,"POST","/auth/register/invitation",{token:bootstrapInvite.token,email:user.email,firstName:"Audit",lastName:"Guest",nickname:user.nickname,password:user.password,confirmPassword:user.password})).status).toBe(200);await login(e,user.email,user.password);await e.locator('.app-shell a[href="/tr/projeler"]').first().click();await expect(e.locator(`a[href="/tr/projeler/${bootstrap.slug}/genel-bakis"]`).first()).toBeVisible();const principal=(await api(e,"GET","/auth/me")).json as {id:string};
  await e.evaluate(()=>Object.assign(window,{__invitationWarmDocument:true}));
  await e.evaluate(url=>(window as unknown as {next:{router:{push:(url:string)=>void}}}).next.router.push(url),`/tr/kayit#invitation=${inv.token}`);await e.getByRole("button",{name:"Projeye katıl",exact:true}).click();await expect(e).toHaveURL(new RegExp(`/tr/projeler/${p.slug}/genel-bakis$`));expect(invitationInDatabase(inv.invitationId,principal.id)).toEqual({status:"ACCEPTED",membership:"ACTIVE",roles:["TESTER"],teamRows:1});
  await e.locator('.app-shell a[href="/tr/projeler"]').first().click();expect(await e.evaluate(()=>(window as unknown as {__invitationWarmDocument?:boolean}).__invitationWarmDocument)).toBe(true);await expect(e.locator(`a[href="/tr/projeler/${p.slug}/genel-bakis"]`).first()).toBeVisible({timeout:3000});
 }finally{if(pid)await api(a,"POST",`/projects/${pid}/archive`);if(bootstrapId)await api(a,"POST",`/projects/${bootstrapId}/archive`);await ac.close();await ec.close();}
});

test("INV-001 expired invitation history, resend, cancel and reinvite persist without weakening uniqueness",async({browser})=>{
 const ac=await browser.newContext({storageState:MANAGER_STORAGE}),bc=await browser.newContext({storageState:MEMBER_STORAGE});const a=await ac.newPage(),b=await bc.newPage();let pid:string|undefined;
 try{
  await a.goto("/tr/projeler");await b.goto("/tr/davetler");const recipient=(await api(b,"GET","/auth/me")).json as {id:string;nickname:string};
  const p=(await api(a,"POST","/projects",{name:`INV expiry ${Date.now()}`,projectType:"WEB"})).json as {id:string;slug:string};pid=p.id;const team=(await api(a,"POST",`/projects/${pid}/teams`,{name:"Expiry team",includeCreator:true})).json as {id:string};
  const create=()=>api(a,"POST",`/projects/${pid}/invitations`,{userId:recipient.id,teamId:team.id,roles:["TESTER"]});
  const old=(await create()).json as {invitationId:string};expireQaInvitation(old.invitationId);
  expect((await api(a,"GET",`/projects/${pid}/invitations/all?status=PENDING`)).json).toMatchObject({totalElements:0});
  await a.goto(`/projects/${p.slug}?section=invitations`);await a.getByRole("tab",{name:"Süresi doldu",exact:true}).click();const row=a.getByRole("row").filter({hasText:recipient.nickname});await expect(row).toBeVisible();
  const response=a.waitForResponse(r=>r.url().endsWith(`/${old.invitationId}/resend`));await row.getByRole("button",{name:/yeniden gönder/i}).click();const res=await response;expect(res.status()).toBe(200);const next=await res.json() as {invitationId:string};
  expect(invitationInDatabase(old.invitationId,recipient.id).status).toBe("EXPIRED");expect(invitationInDatabase(next.invitationId,recipient.id).status).toBe("PENDING");expect((await create()).status).toBe(409);expect((await api(b,"POST",`/project-invitations/${old.invitationId}/accept`)).status).toBe(409);
  expect((await api(a,"DELETE",`/projects/${pid}/invitations/${next.invitationId}`)).status).toBe(204);
  const clear=(await create()).json as {invitationId:string};expireQaInvitation(clear.invitationId);expect((await api(a,"DELETE",`/projects/${pid}/invitations/${clear.invitationId}`)).status).toBe(204);expect(invitationInDatabase(clear.invitationId,recipient.id).status).toBe("EXPIRED");
  const renewed=await create();expect(renewed.status).toBe(201);const finalId=(renewed.json as {invitationId:string}).invitationId;expect((await api(b,"POST",`/project-invitations/${finalId}/accept`)).status).toBe(200);expect(invitationInDatabase(finalId,recipient.id)).toEqual({status:"ACCEPTED",membership:"ACTIVE",roles:["TESTER"],teamRows:1});
 }finally{if(pid)await api(a,"POST",`/projects/${pid}/archive`);await ac.close();await bc.close();}
});
