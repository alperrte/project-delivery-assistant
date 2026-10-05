import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { MANAGER_STORAGE } from "./global-setup";
import { api, createProject } from "./helpers";

test.use({storageState:MANAGER_STORAGE});
test("reply/reaction/picker preserve viewport, theme and motion preferences at 320/390/768/1440",async({page})=>{
  const slug=await createProject(page,`Chat Responsive ${Date.now()}`);
  const project=((await api(page,"GET",`/projects/by-slug/${slug}`)).json as {id:string}).id;
  const directory=path.resolve("../.local/chat-rp/screens");mkdirSync(directory,{recursive:true});
  try {
    await page.getByTestId("chat-nav-item").click();const input=page.getByTestId("chat-composer");await expect(input).toBeEnabled();
    await input.fill("Responsive question");await input.press("Enter");
    const question=page.getByTestId("chat-message").filter({has:page.getByTestId("chat-message-text").filter({hasText:"Responsive question"})});
    await question.hover();await question.getByTestId("chat-message-reply").click();await input.fill("Responsive answer");await input.press("Enter");
    const answer=page.getByTestId("chat-message").filter({has:page.getByTestId("chat-message-text").filter({hasText:"Responsive answer"})});
    await expect(answer.getByTestId("chat-reply-quote")).toBeVisible();await answer.hover();await answer.getByTestId("chat-message-react").click();await page.getByTestId("emoji-HEART").click();
    await expect(answer.getByTestId("chat-reaction-HEART")).toContainText("1");
    for(const width of [320,390,768,1440])for(const dark of [false,true]){
      await page.setViewportSize({width,height:900});await page.evaluate(value=>document.documentElement.classList.toggle("dark",value),dark);
      if(!await input.isVisible())await page.getByTestId("chat-conversation-group").click();
      await answer.getByTestId("chat-message-reply").click();await expect(page.getByTestId("chat-reply-context")).toBeVisible();
      expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(width);
      await page.getByTestId("chat-composer-emoji").click();const popup=page.getByTestId("chat-composer-emoji-popup");await expect(popup).toBeVisible();
      await popup.evaluate(async element=>{await Promise.all(element.getAnimations().map(animation=>animation.finished.catch(()=>undefined)));});
      const box=(await popup.boundingBox())!;expect(box.x).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(width);
      await page.screenshot({path:path.join(directory,`${width}-${dark?"dark":"light"}.png`)});
      await page.getByTestId("emoji-SMILE").press("Escape");await expect(popup).toHaveCount(0);
      await input.press("Escape");await expect(page.getByTestId("chat-panel")).toBeVisible();
    }
    await page.emulateMedia({reducedMotion:"reduce"});await page.evaluate(()=>document.documentElement.dataset.motion="off");
    await page.getByTestId("chat-composer-emoji").click();await expect(page.getByTestId("chat-composer-emoji-popup")).toBeVisible();
    const duration=await page.getByTestId("chat-composer-emoji-popup").evaluate(element=>getComputedStyle(element).animationDuration);
    expect(parseFloat(duration)).toBeLessThanOrEqual(0.00001);
    await page.getByTestId("emoji-SMILE").press("Escape");
  } finally {await api(page,"POST",`/projects/${project}/archive`).catch(()=>undefined);}
});
