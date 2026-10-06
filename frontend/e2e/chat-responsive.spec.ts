import { chooseMessageAction } from "./chat-actions";
import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { MANAGER_STORAGE } from "./global-setup";
import { api, createProject } from "./helpers";

test.use({storageState:MANAGER_STORAGE});
test("reply/reaction/picker preserve viewport, theme and motion preferences at 320/390/768/1024/1440",async({page})=>{
  const slug=await createProject(page,`Chat Responsive ${Date.now()}`);
  const project=((await api(page,"GET",`/projects/by-slug/${slug}`)).json as {id:string}).id;
  const directory=path.resolve("../.local/chat-action-nav-implementation/screens/chat");mkdirSync(directory,{recursive:true});
  try {
    await page.getByTestId("chat-nav-item").click();const input=page.getByTestId("chat-composer");await expect(input).toBeEnabled();
    await input.fill("Responsive question");await input.press("Enter");
    const question=page.getByTestId("chat-message").filter({has:page.getByTestId("chat-message-text").filter({hasText:"Responsive question"})});
    await question.hover();await chooseMessageAction(question,"reply");await input.fill("Responsive answer");await input.press("Enter");
    const answer=page.getByTestId("chat-message").filter({has:page.getByTestId("chat-message-text").filter({hasText:"Responsive answer"})});
    await expect(answer.getByTestId("chat-reply-quote")).toBeVisible();await answer.hover();await chooseMessageAction(answer,"react");await page.getByTestId("emoji-HEART").click();
    await expect(answer.getByTestId("chat-reaction-HEART")).toContainText("1");
    await expect(page.getByTestId("chat-message-react-popup")).toHaveCount(0);
    const bubble=answer.getByTestId("chat-message-bubble"),chips=answer.getByTestId("chat-reactions");
    const before=(await bubble.boundingBox())!,chipBox=(await chips.boundingBox())!;
    expect(chipBox.y-(before.y+before.height)).toBeGreaterThanOrEqual(3.5);
    expect(chipBox.y-(before.y+before.height)).toBeLessThanOrEqual(4.5);
    const height=await page.getByTestId("chat-messages").evaluate(element=>element.scrollHeight);
    await answer.getByTestId("chat-message-actions").click();await expect(page.getByTestId("chat-message-reply")).toBeVisible();
    const after=(await bubble.boundingBox())!;expect(after.height).toBe(before.height);expect(after.width).toBe(before.width);
    expect(await page.getByTestId("chat-messages").evaluate(element=>element.scrollHeight)).toBe(height);
    await page.getByTestId("chat-message-reply").press("Escape");await expect(page.getByTestId("chat-message-reply")).toHaveCount(0);await expect(page.getByTestId("chat-panel")).toBeVisible();
    for(const width of [320,390,768,1024,1440])for(const dark of [false,true]){
      await page.setViewportSize({width,height:900});await page.evaluate(value=>document.documentElement.classList.toggle("dark",value),dark);
      await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))));if(!await input.isVisible())await page.getByTestId("chat-conversation-group").click();
      await chooseMessageAction(answer,"reply");await expect(page.getByTestId("chat-reply-context")).toBeVisible();
      expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(width);
      await page.getByTestId("chat-composer-emoji").click();const popup=page.getByTestId("chat-composer-emoji-popup");await expect(popup).toBeVisible();
      await popup.evaluate(async element=>{await Promise.all(element.getAnimations().map(animation=>animation.finished.catch(()=>undefined)));});
      const box=(await popup.boundingBox())!;expect(box.x).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(width);
      await page.screenshot({path:path.join(directory,`${width}-${dark?"dark":"light"}.png`)});
      await page.getByTestId("emoji-SMILE").press("Escape");await expect(popup).toHaveCount(0);
      await input.press("Escape");await expect(page.getByTestId("chat-panel")).toBeVisible();
      await chooseMessageAction(answer,"react");const reaction=page.getByTestId("chat-message-react-popup");await expect(reaction).toBeVisible();await reaction.evaluate(async el=>{await Promise.all(el.getAnimations().map(animation=>animation.finished.catch(()=>undefined)));});const reactionBox=(await reaction.boundingBox())!;expect(reactionBox.x).toBeGreaterThanOrEqual(0);expect(reactionBox.x+reactionBox.width).toBeLessThanOrEqual(width);expect(reactionBox.y).toBeGreaterThanOrEqual(0);expect(reactionBox.y+reactionBox.height).toBeLessThanOrEqual(900);
      await page.screenshot({path:path.join(directory,`reaction-${width}-${dark?"dark":"light"}.png`)});await page.getByTestId("emoji-HEART").press("Escape");
    }
    await page.emulateMedia({reducedMotion:"reduce"});await page.evaluate(()=>document.documentElement.dataset.motion="off");
    await page.getByTestId("chat-composer-emoji").click();await expect(page.getByTestId("chat-composer-emoji-popup")).toBeVisible();
    const duration=await page.getByTestId("chat-composer-emoji-popup").evaluate(element=>getComputedStyle(element).animationDuration);
    expect(parseFloat(duration)).toBeLessThanOrEqual(0.00001);
    await page.getByTestId("emoji-SMILE").press("Escape");
    await chooseMessageAction(answer,"react");await expect(page.getByTestId("chat-message-react-popup")).toBeVisible();expect(parseFloat(await page.getByTestId("chat-message-react-popup").evaluate(element=>getComputedStyle(element).animationDuration))).toBeLessThanOrEqual(0.00001);await page.getByTestId("emoji-HEART").press("Escape");
    await answer.getByTestId("chat-message-actions").click();await expect(page.getByTestId("chat-message-reply")).toBeVisible();expect(parseFloat(await page.getByTestId("chat-message-reply").locator('xpath=..').evaluate(element=>getComputedStyle(element).animationDuration))).toBeLessThanOrEqual(0.00001);await page.getByTestId("chat-message-reply").press("Escape");
  } finally {await api(page,"POST",`/projects/${project}/archive`).catch(()=>undefined);}
});
