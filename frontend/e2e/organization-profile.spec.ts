import { test, expect } from "@playwright/test";
import { api } from "./helpers";
import { MANAGER_STORAGE } from "./global-setup";
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=", "base64");
test.use({ storageState: MANAGER_STORAGE });
test("organization profile preview, URL validation and responsive themes", async ({ page }) => {
 await page.goto("/tr/organizasyonlar/yeni");
 await page.setViewportSize({width:1536,height:1024});
 await page.evaluate(()=>document.documentElement.classList.add("dark"));
 await page.screenshot({path:"../.local/organization-reference-dark.png",fullPage:true});
 await page.locator("#org-name").fill("Profile Preview");
 await page.locator("#org-description").fill("Live description");
 await page.locator('input[type="file"]').nth(0).setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: png });
 await page.locator('input[type="file"]').nth(1).setInputFiles({ name: "cover.png", mimeType: "image/png", buffer: png });
 const preview = page.locator("#organization-preview");
 await expect(preview.locator("article").getByRole("heading", { name: "Profile Preview" })).toBeVisible();
 await expect(preview.locator('img[src^="blob:"]')).toHaveCount(6);
 await expect(preview.getByRole("link")).toHaveCount(0);
 await page.locator("#org-website").fill("javascript:alert(1)");
 await page.locator('button[type="submit"]').click();
 await expect(page.locator("#org-website-error")).toBeVisible();
 await expect(page).toHaveURL(/\/yeni$/);
 for (const dark of [false, true]) {
  await page.evaluate(dark => document.documentElement.classList.toggle("dark", dark), dark);
  for (const width of [320, 390, 768, 1280, 1440]) {
   await page.setViewportSize({ width, height: 900 });
   await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.screenshot({ path: `../.local/organization-preview-${dark ? "dark" : "light"}.png`, fullPage: true });
 }
});


test("create saves real metadata and both images, then the list uses versioned images", async ({ page }) => {
 await page.goto("/tr/organizasyonlar/yeni");const name = `Organization Profile ${Date.now()}`;
 await page.locator("#org-name").fill(name); await page.locator("#org-description").fill("Saved description");
 await page.locator("#org-website").fill("https://example.com");await page.locator("#org-contactEmail").fill("contact@example.com");await page.locator("#org-location").fill("Istanbul");await page.locator("#org-notes").fill("Saved notes independent of description");
 await page.locator('input[type="file"]').nth(0).setInputFiles({ name:"logo.png",mimeType:"image/png",buffer:png });
 await page.locator('input[type="file"]').nth(1).setInputFiles({ name:"cover.png",mimeType:"image/png",buffer:png });
 await page.locator('button[type="submit"]').click();await expect(page).toHaveURL(/\/tr\/organizasyonlar\/[0-9a-f-]{36}$/);
 const id = new URL(page.url()).pathname.split("/").at(-1)!;
 const result = await api(page,"GET",`/organizations/${id}`);
 expect(result.json).toMatchObject({ name,website:"https://example.com",contactEmail:"contact@example.com",location:"Istanbul",notes:"Saved notes independent of description",logoVersion:expect.any(String),coverVersion:expect.any(String) });
 await page.goto("/tr/organizasyonlar");const card = page.locator("article").filter({has:page.getByRole("heading",{name,exact:true})});
 await expect(page.locator("article").first()).toBeVisible();
 for(let index=0;await card.count()===0 && index<30;index++) {
  const next=page.getByRole("button",{name:"Sonraki",exact:true});if(!await next.isEnabled())break;
  const response=page.waitForResponse(r=>new URL(r.url()).pathname==="/api/v1/organizations" && r.request().method()==="GET");
  await next.click();await response;await expect(page.locator("article").first()).toBeVisible();
 }

 await expect(card.locator('img[src*="/logo?v="]')).toHaveCount(1);await expect(card.locator('img[src*="/cover?v="]')).toHaveCount(1);
 await expect.poll(()=>card.locator('img[src*="/logo?v="]').evaluate(el=>(el as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
});

for (const failedKinds of [["cover"], ["logo"], ["logo", "cover"]]) {
 test(`partial ${failedKinds.join("+")} upload retries only failed images without duplicate creation`, async ({ page }) => {
  let creates=0;const uploads={logo:0,cover:0};
  page.on("request",r=>{if(r.method()==="POST" && new URL(r.url()).pathname==="/api/v1/organizations")creates++;});
  for(const kind of ["logo","cover"] as const) await page.route(`**/api/v1/organizations/*/${kind}`,async route=>{
   if(route.request().method()==="PUT") {
    uploads[kind]++;
    if(failedKinds.includes(kind) && uploads[kind]===1) {
     await route.fulfill({status:503,contentType:"application/problem+json",body:JSON.stringify({status:503,code:"ORGANIZATION_MEDIA_UNAVAILABLE"})});return;
    }
   }
   await route.continue();
  });
  await page.goto("/tr/organizasyonlar/yeni");await page.locator("#org-name").fill(`Partial ${Date.now()}`);
  for(const index of [0,1])await page.locator('input[type="file"]').nth(index).setInputFiles({name:"image.png",mimeType:"image/png",buffer:png});
  await page.locator('button[type="submit"]').click();await expect(page.getByRole("button",{name:"Tekrar dene"})).toBeVisible();
  await page.setViewportSize({width:320,height:900});await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(creates).toBe(1);expect(uploads).toEqual({logo:1,cover:1});
  await page.locator('button[type="submit"]').click();await expect(page).toHaveURL(/\/tr\/organizasyonlar\/[0-9a-f-]{36}$/);
  expect(creates).toBe(1);for(const kind of ["logo","cover"] as const)expect(uploads[kind]).toBe(failedKinds.includes(kind)?2:1);
 });
}



test("edit preserves values, cancel leaves media unchanged, replace and confirmed removal update the profile", async ({ page }) => {
 await page.goto("/tr/organizasyonlar/yeni");const name=`Edit Profile ${Date.now()}`;
 await page.locator("#org-name").fill(name);await page.locator("#org-notes").fill("Original notes");await page.locator("#org-website").fill("https://example.com");
 for(const index of [0,1]) await page.locator('input[type="file"]').nth(index).setInputFiles({name:"image.png",mimeType:"image/png",buffer:png});
 await page.locator('button[type="submit"]').click();await expect(page).toHaveURL(/\/tr\/organizasyonlar\/[0-9a-f-]{36}$/);
 const id=new URL(page.url()).pathname.split("/").at(-1)!;const before=(await api(page,"GET",`/organizations/${id}`)).json as {logoVersion:string};
 await expect(page.locator('img[src*="/logo?v="]')).toHaveCount(1);await expect(page.getByRole("link",{name:"https://example.com",exact:true})).toBeVisible();
 await page.getByRole("link",{name:"Düzenle",exact:true}).click();await expect(page.locator("#org-website")).toHaveValue("https://example.com");await expect(page.locator("#org-notes")).toHaveValue("Original notes");
 await page.locator("#org-name").fill("Unsaved");await page.locator('input[type="file"]').nth(0).setInputFiles({name:"next.png",mimeType:"image/png",buffer:png});
 await page.getByRole("link",{name:"Vazgeç",exact:true}).click();await expect(page.getByRole("heading",{level:1,name,exact:true})).toBeVisible();
 expect(((await api(page,"GET",`/organizations/${id}`)).json as {logoVersion:string}).logoVersion).toBe(before.logoVersion);
 await page.getByRole("link",{name:"Düzenle",exact:true}).click();await page.locator("#org-name").fill(name+" updated");await page.locator("#org-notes").fill("Updated notes");
 await page.locator('input[type="file"]').nth(0).setInputFiles({name:"next.png",mimeType:"image/png",buffer:png});
 await page.evaluate(()=>window.dispatchEvent(new Event("focus")));await expect(page.locator("#org-name")).toHaveValue(name+" updated");
 await page.locator('button[type="submit"]').click();await expect(page.getByRole("heading",{level:1,name:name+" updated",exact:true})).toBeVisible();
 expect(((await api(page,"GET",`/organizations/${id}`)).json as {logoVersion:string}).logoVersion).not.toBe(before.logoVersion);await expect(page.getByText("Updated notes",{exact:true})).toBeVisible();
 await page.getByRole("link",{name:"Düzenle",exact:true}).click();await page.getByRole("button",{name:"Kaldır",exact:true}).first().click();
 await page.getByRole("dialog").getByRole("button",{name:"Kaldır",exact:true}).click();
 expect(((await api(page,"GET",`/organizations/${id}`)).json as {logoVersion:string}).logoVersion).not.toBeNull();
 await page.locator('button[type="submit"]').click();await expect(page).toHaveURL(/\/tr\/organizasyonlar\/[0-9a-f-]{36}$/);
 await expect(page.locator('img[src*="/logo?v="]')).toHaveCount(0);await expect(page.locator('img[src*="/cover?v="]')).toHaveCount(1);
 await page.route(`**/api/v1/organizations/${id}/cover*`,route=>route.fulfill({status:404}));
 await page.reload();await expect(page.getByRole("heading",{level:1,name:name+" updated",exact:true})).toBeVisible();
 await expect(page.locator('img[src*="/cover?v="]')).toHaveCount(0);
});


for (const [locale, segment, createSegment, choose] of [["tr","organizasyonlar","yeni","Logo yükle"],["en","organizations","new","Upload logo"],["de","organisationen","neu","Logo hochladen"]] as const) {
 test(`localized ${locale} profile has keyboard upload and no mobile overflow with reduced motion`, async ({page})=>{
  const runtimeErrors:string[]=[];page.on("pageerror",error=>runtimeErrors.push(error.message));
  await page.goto("/tr/genel-bakis");await expect.poll(()=>page.evaluate(()=>sessionStorage.getItem("pda:session-baseline"))).not.toBeNull();
  await page.emulateMedia({reducedMotion:"reduce"});await page.goto(`/${locale}/${segment}/${createSegment}`);
  await expect(page.locator("html")).toHaveAttribute("lang",locale);
  await page.locator("#org-name").fill("Keyboard Profile");await page.locator("#org-name").press("Tab");await expect(page.locator("#org-description")).toBeFocused();
  const button=page.getByRole("button",{name:choose,exact:true}).first();await button.focus();const chooser=page.waitForEvent("filechooser");await button.press("Enter");await (await chooser).setFiles({name:"logo.png",mimeType:"image/png",buffer:png});
  await expect(page.locator("#organization-preview article img")).toHaveCount(1);
  await page.locator("#org-contactEmail").fill("bad");await page.locator('button[type="submit"]').click();await expect(page.locator("#org-contactEmail-error")).toBeVisible();
  for(const width of [320,390,768,1280,1440]) {await page.setViewportSize({width,height:900});await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth)).toBe(true);}
  expect(runtimeErrors).toEqual([]);
 });
}

test("client file validation rejects empty, SVG and oversize files while retaining the valid preview", async({page})=>{
 await page.goto("/tr/organizasyonlar/yeni");await page.locator("#org-name").fill("File Validation");const input=page.locator('input[type="file"]').first();
 await input.setInputFiles({name:"logo.png",mimeType:"image/png",buffer:png});
 for(const file of [{name:"empty.png",mimeType:"image/png",buffer:Buffer.alloc(0)},{name:"bad.svg",mimeType:"image/svg+xml",buffer:Buffer.from("<svg/>")},{name:"huge.png",mimeType:"image/png",buffer:Buffer.alloc(524289)}]) {
  await input.setInputFiles(file);await expect(page.getByRole("alert").first()).toBeVisible();await expect(page.locator("#organization-preview article img")).toHaveCount(1);
 }
});
