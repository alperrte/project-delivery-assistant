import { expect, test } from "@playwright/test";
import { api, declineTeamPrompt } from "./helpers";
import { MANAGER_STORAGE, MEMBER_STORAGE } from "./global-setup";
import { projectOrganizationInDatabase } from "./organization-project-db";
import { localizeHref } from "../src/i18n/routing";
import { mkdirSync } from "node:fs";
import path from "node:path";

test.use({ storageState: MANAGER_STORAGE });
test("explicit standalone selection and assign/move/remove persist real UI requests and PostgreSQL", async ({ page }) => {
  const prefix = `Org association ${Date.now()}`;
  await page.goto("/tr/organizasyonlar");
  const a = (await api(page, "POST", "/organizations", { name: `${prefix} A` })).json as {id:string;name:string};
  const b = (await api(page, "POST", "/organizations", { name: `${prefix} B` })).json as {id:string;name:string};
  let project: {id:string;slug:string} | undefined;
  try {
    await page.goto("/tr/projeler/yeni");
    await page.locator("#project-name").fill(prefix);await page.getByRole("radio", {name:/^Web/}).click();
    const select = page.locator("#main-content").getByRole("combobox");
    await select.click();await page.getByRole("option", {name:a.name,exact:true}).click();
    await select.click();await page.getByRole("option", {name:"Organizasyon yok",exact:true}).click();
    const [created] = await Promise.all([page.waitForResponse(r=>r.request().method()==="POST"&&new URL(r.url()).pathname==="/api/v1/projects"),page.getByRole("button",{name:/^Projeyi oluştur$/}).click()]);
    await declineTeamPrompt(page);expect(created.status()).toBe(201);expect(created.request().postDataJSON().organizationId).toBeUndefined();
    project=await created.json();expect(projectOrganizationInDatabase(project!.id)).toBeNull();
    await page.goto(`/tr/projeler/${project!.slug}?section=settings`);
    for (const org of [a,b,null]) {
      await page.locator("#settings-organization").click();await page.getByRole("option",{name:org?.name??"Organizasyon yok",exact:true}).click();
      const [saved]=await Promise.all([page.waitForResponse(r=>r.request().method()==="PUT"&&new URL(r.url()).pathname===`/api/v1/projects/${project!.id}`),page.locator('form button[type="submit"]').click()]);
      expect(saved.status()).toBe(200);expect(saved.request().postDataJSON().organizationId).toBe(org?.id??null);
      expect(projectOrganizationInDatabase(project!.id)).toBe(org?.id??null);
      expect(((await api(page,"GET",`/projects/${project!.id}`)).json as {organizationId:string|null}).organizationId).toBe(org?.id??null);
    }
    await page.reload();await expect(page.locator("#settings-organization")).toContainText("Organizasyon yok");
  } finally {
    if(project)await api(page,"POST",`/projects/${project.id}/archive`);
    for(const org of [a,b])await api(page,"POST",`/organizations/${org.id}/archive`);
  }
});

test("101 linked projects remain accessible through real server pagination",async({page})=>{
 await page.goto("/tr/organizasyonlar");const prefix=`101 linked ${Date.now()}`;
 const org=(await api(page,"POST","/organizations",{name:prefix})).json as {id:string};const projects:{id:string;slug:string}[]=[];const pages=new Set<string>();
 page.on("request",r=>{if(r.url().includes(`/organizations/${org.id}/projects?`))pages.add(new URL(r.url()).searchParams.get("page")!);});
 try {
  for(let n=0;n<101;n++){const created=await api(page,"POST","/projects",{name:`${prefix} ${String(n).padStart(3,"0")}`,organizationId:org.id,projectType:"WEB"});expect(created.status).toBe(201);projects.push(created.json as {id:string;slug:string});}
  expect(projectOrganizationInDatabase(projects[100].id)).toBe(org.id);
  await page.goto(`/tr/organizasyonlar/${org.id}`);await expect(page.locator("#main-content").getByRole("link",{name:prefix+" 000",exact:true})).toBeVisible();
  for(let index=1;index<=5;index++){await page.getByRole("button",{name:"Sonraki",exact:true}).click();await expect(page.locator("#main-content").getByRole("link",{name:`${prefix} ${String(index*20).padStart(3,"0")}`,exact:true})).toBeVisible();}
  await expect(page.getByRole("button",{name:"Sonraki",exact:true})).toBeDisabled();expect([...pages].sort()).toEqual(["0","1","2","3","4","5"]);
  const last=await api(page,"GET",`/organizations/${org.id}/projects?page=1&size=100`);expect(last.status).toBe(200);expect((last.json as {content:{id:string}[];totalElements:number}).totalElements).toBe(101);expect((last.json as {content:{id:string}[]}).content[0].id).toBe(projects[100].id);
 }finally{for(const p of projects)await api(page,"POST",`/projects/${p.id}/archive`);await api(page,"POST",`/organizations/${org.id}/archive`);}
});

test("organization projects retry clamps an emptied last page to the remaining real page",async({page})=>{
 await page.goto("/tr/organizasyonlar");const name=`Org pagination ${Date.now()}`;
 const org=(await api(page,"POST","/organizations",{name})).json as {id:string};const ids:string[]=[];
 try {
  for(let n=0;n<21;n++){const p=(await api(page,"POST","/projects",{name:`${name} ${String(n).padStart(3,"0")}`,organizationId:org.id})).json as {id:string};ids.push(p.id);}
  await page.goto(`/tr/organizasyonlar/${org.id}`);await expect(page.getByRole("heading",{level:1,name,exact:true})).toBeVisible();
  // TEST-ONLY failed page request; retry reads the real changed PostgreSQL dataset.
  await page.route(`**/organizations/${org.id}/projects?*`,route=>new URL(route.request().url()).searchParams.get("page")==="1"?route.abort():route.continue());
  await page.getByRole("button",{name:"Sonraki",exact:true}).click();await expect(page.getByTestId("organization-projects-error")).toBeVisible();
  await api(page,"POST",`/projects/${ids.at(-1)}/archive`);await page.unroute(`**/organizations/${org.id}/projects?*`);
  await page.getByTestId("organization-projects-error").getByRole("button").first().click();
  await expect(page.locator("#main-content").getByRole("link",{name:name+" 000",exact:true})).toBeVisible();
  await expect(page.getByRole("button",{name:"Sonraki",exact:true})).toBeDisabled();await expect(page.getByTestId("organization-projects-error")).toHaveCount(0);
 }finally{for(const id of ids)await api(page,"POST",`/projects/${id}/archive`);await api(page,"POST",`/organizations/${org.id}/archive`);}
});

test("organization projects have independent loading/error/retry and membership-filtered empty states",async({page})=>{
 await page.goto("/tr/organizasyonlar");const name=`Org states ${Date.now()}`;
 const org=(await api(page,"POST","/organizations",{name})).json as {id:string};
 let release!:()=>void;
 try {
  // TEST-ONLY latency injection; the eventual success still comes from the real backend.
  await page.route(`**/organizations/${org.id}/projects?*`,async route=>{await new Promise<void>(resolve=>{release=resolve;});await route.continue();});
  await page.goto(`/tr/organizasyonlar/${org.id}`);await expect(page.getByRole("heading",{level:1,name,exact:true})).toBeVisible();
  await expect(page.getByTestId("organization-projects-loading")).toBeVisible();release();
  await expect(page.getByText("Bu organizasyonda erişebildiğiniz aktif proje yok.",{exact:true})).toBeVisible();
  await page.unroute(`**/organizations/${org.id}/projects?*`);
  // TEST-ONLY failure; retry is unmocked and uses PostgreSQL-backed GET.
  await page.route(`**/organizations/${org.id}/projects?*`,route=>route.abort());await page.reload();
  await expect(page.getByTestId("organization-projects-error")).toBeVisible();await expect(page.getByRole("heading",{level:1,name,exact:true})).toBeVisible();
  await page.unroute(`**/organizations/${org.id}/projects?*`);
  await page.getByTestId("organization-projects-error").getByRole("button").first().click();
  await expect(page.getByText("Bu organizasyonda erişebildiğiniz aktif proje yok.",{exact:true})).toBeVisible();await expect(page.getByTestId("organization-projects-error")).toHaveCount(0);
 }finally{release?.();await page.unroute(`**/organizations/${org.id}/projects?*`);await api(page,"POST",`/organizations/${org.id}/archive`);}
});

test("warm old/new organization lists refresh after move/remove/assign/rename/create/archive without reload",async({page})=>{
 await page.goto("/tr/organizasyonlar");const prefix=`Warm org ${Date.now()}`;
 const a=(await api(page,"POST","/organizations",{name:prefix+" A"})).json as {id:string;name:string};
 const b=(await api(page,"POST","/organizations",{name:prefix+" B"})).json as {id:string;name:string};
 const p=(await api(page,"POST","/projects",{name:prefix+" P1",projectType:"WEB",organizationId:a.id})).json as {id:string;slug:string};
 // Establish fresh fixture data before warming caches; no reload is used after a tested mutation.
 await page.reload();
 const created=[p];const requests:string[]=[];page.on("request",r=>{if(r.method()==="GET"&&/\/organizations\/[^/]+\/projects\?/.test(r.url()))requests.push(new URL(r.url()).pathname);});
 async function orgPage(org:{id:string;name:string}){
  await page.locator('.app-shell a[href="/tr/organizasyonlar"]').first().click();await page.locator(`#main-content a[href="/tr/organizasyonlar/${org.id}"]`).click();await expect(page.getByRole("heading",{level:1,name:org.name,exact:true})).toBeVisible();
 }
 async function settings(){
  let targetPage=0;
  for(;;targetPage++){
   const result=(await api(page,"GET",`/projects?page=${targetPage}&size=12`)).json as {content:{id:string}[];totalPages:number};
   if(result.content.some(item=>item.id===p.id))break;
   if(targetPage+1>=result.totalPages)throw new Error("QA project is not visible in global list");
  }
  await page.locator('.app-shell a[href="/tr/projeler"]').first().click();
  for(let index=0;index<targetPage;index++){await page.getByRole("button",{name:"Sonraki",exact:true}).click();await expect(page.locator('button[aria-current="page"]')).toHaveText(String(index+2));}
  await page.locator(`#main-content a[href="/tr/projeler/${p.slug}/duzenle"]`).click();await expect(page.locator("#settings-name")).toBeVisible();
 }
 async function save(){const [r]=await Promise.all([page.waitForResponse(r=>r.request().method()==="PUT"&&r.url().endsWith(`/projects/${p.id}`)),page.locator('form button[type="submit"]').click()]);expect(r.status()).toBe(200);}
 try {
  await orgPage(b);await orgPage(a);await expect(page.locator(`#main-content a[href="/tr/projeler/${p.slug}"]`)).toBeVisible();
  let previous: {id:string;name:string}|null=a;
  for(const target of [b,null,a]){
   const affected=new Set([previous?.id,target?.id]);
   await settings();await page.locator("#settings-organization").click();await page.getByRole("option",{name:target?.name??"Organizasyon yok",exact:true}).click();await save();
   expect(projectOrganizationInDatabase(p.id)).toBe(target?.id??null);
   for(const org of [a,b]){const before=requests.length;await orgPage(org);if(affected.has(org.id))await expect.poll(()=>requests.length).toBeGreaterThan(before);const row=page.locator(`#main-content a[href="/tr/projeler/${p.slug}"]`);if(target?.id===org.id)await expect(row).toBeVisible();else await expect(row).toHaveCount(0);}
   previous=target;
  }
  await settings();await page.locator("#settings-name").fill(prefix+" renamed");await save();await orgPage(a);await expect(page.locator("#main-content").getByRole("link",{name:prefix+" renamed",exact:true})).toBeVisible();
  await page.locator('.app-shell a[href="/tr/projeler"]').first().click();await page.getByRole("link",{name:"Yeni proje",exact:true}).click();
  await page.locator("#project-name").fill(prefix+" P2");await page.getByRole("radio",{name:/^Web/}).click();await page.locator("#main-content").getByRole("combobox").click();await page.getByRole("option",{name:a.name,exact:true}).click();
  const [response]=await Promise.all([page.waitForResponse(r=>r.request().method()==="POST"&&new URL(r.url()).pathname==="/api/v1/projects"),page.getByRole("button",{name:/^Projeyi oluştur$/}).focus().then(()=>page.keyboard.press("Enter"))]);await declineTeamPrompt(page);const second=await response.json();created.push(second);expect(projectOrganizationInDatabase(second.id)).toBe(a.id);
  await orgPage(a);await expect(page.locator(`#main-content a[href="/tr/projeler/${second.slug}"]`)).toBeVisible();
  await settings();await page.getByRole("button",{name:"Projeyi sil",exact:true}).click();await page.getByRole("dialog").getByLabel(/Onaylamak için proje adını yazın/).fill(prefix+" renamed");await page.getByRole("dialog").getByRole("button",{name:"Bu projeyi sil",exact:true}).click();
  await expect(page).toHaveURL(/\/tr\/projeler$/);await orgPage(a);await expect(page.locator(`#main-content a[href="/tr/projeler/${p.slug}"]`)).toHaveCount(0);await expect(page.locator(`#main-content a[href="/tr/projeler/${second.slug}"]`)).toBeVisible();
 }finally{for(const p of created)await api(page,"POST",`/projects/${p.id}/archive`);for(const org of [a,b])await api(page,"POST",`/organizations/${org.id}/archive`);}
});

test("standalone selectors retain keyboard, locale, viewport and theme behavior",async({page})=>{
  await page.goto("/tr/projeler");
  const project=(await api(page,"POST","/projects",{name:`Standalone layout ${Date.now()}`,projectType:"WEB"})).json as {id:string;slug:string};
  const screenshots=path.resolve("../.local/org-project-remediation/screens");mkdirSync(screenshots,{recursive:true});
  try {
    for(const [locale,none] of [["tr","Organizasyon yok"],["en","No organization"],["de","Keine Organisation"]] as const){
      await page.goto(localizeHref(`/projects/${project.slug}?section=settings`,locale));
      for(const width of [320,390,768,1440])for(const dark of [false,true]){
        await page.setViewportSize({width,height:900});await page.evaluate(d=>document.documentElement.classList.toggle("dark",d),dark);
        const picker=page.locator("#settings-organization");await expect(picker).toContainText(none);
        await picker.focus();await picker.press("Enter");const option=page.getByRole("option",{name:none,exact:true});await expect(option).toBeVisible();await option.press("Escape");await expect(option).toHaveCount(0);
        expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(width);
        if((width===320&&dark)||(width===1440&&!dark))await page.screenshot({path:path.join(screenshots,`${locale}-${width}-${dark?"dark":"light"}.png`)});
      }
    }
  }finally{await api(page,"POST",`/projects/${project.id}/archive`);}
});

test("co-manager keeps current organization label and gets plain text; archived association remains removable",async({page,browser})=>{
 await page.goto("/tr/projeler");const prefix=`Co org ${Date.now()}`;
 const org=(await api(page,"POST","/organizations",{name:prefix})).json as {id:string};
 const p=(await api(page,"POST","/projects",{name:prefix+" project",projectType:"WEB",organizationId:org.id})).json as {id:string;slug:string};
 const context=await browser.newContext({storageState:MEMBER_STORAGE}),co=await context.newPage();
 try {
  await co.goto("/tr/projeler");const actor=(await api(co,"GET","/auth/me")).json as {id:string};
  const team=(await api(page,"POST",`/projects/${p.id}/teams`,{name:"Co team"})).json as {id:string};
  const invite=(await api(page,"POST",`/projects/${p.id}/invitations`,{userId:actor.id,teamId:team.id,roles:["PROJECT_MANAGER"]})).json as {invitationId:string;token:string};
  expect((await api(co,"POST",`/projects/${p.id}/invitations/${invite.invitationId}/accept`,{token:invite.token})).status).toBe(200);
  await co.goto(`/tr/projeler/${p.slug}?section=settings`);await expect(co.locator("#settings-organization")).toContainText(prefix);
  await co.locator("#settings-name").fill(prefix+" saved");
  const [saved]=await Promise.all([co.waitForResponse(r=>r.request().method()==="PUT"&&r.url().endsWith(`/projects/${p.id}`)),co.locator('form button[type="submit"]').click()]);
  expect(saved.status()).toBe(200);expect(saved.request().postDataJSON().organizationId).toBe(org.id);
  await expect.poll(()=>projectOrganizationInDatabase(p.id)).toBe(org.id);
  await co.goto(`/tr/projeler/${p.slug}`);await expect(co.locator("#main-content").getByText(prefix,{exact:true})).toBeVisible();
  await expect(co.locator(`#main-content a[href="/tr/organizasyonlar/${org.id}"]`)).toHaveCount(0);
  expect((await api(co,"GET",`/organizations/${org.id}`)).status).toBe(403);
  await api(page,"POST",`/organizations/${org.id}/archive`);
  await co.goto(`/tr/projeler/${p.slug}?section=settings`);await expect(co.locator("#settings-organization")).toContainText("arşivlenmiş");
  expect(projectOrganizationInDatabase(p.id)).toBe(org.id);
  expect((await api(co,"GET",`/projects/${p.id}/home`)).status).toBe(200);
  await co.locator("#settings-organization").click();await co.getByRole("option",{name:"Organizasyon yok",exact:true}).click();
  const [response]=await Promise.all([co.waitForResponse(r=>r.request().method()==="PUT"&&r.url().endsWith(`/projects/${p.id}`)),co.locator('form button[type="submit"]').click()]);expect(response.status()).toBe(200);expect(projectOrganizationInDatabase(p.id)).toBeNull();
 }finally{await api(page,"POST",`/projects/${p.id}/archive`);await api(page,"POST",`/organizations/${org.id}/archive`);await context.close();}
});
