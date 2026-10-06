import { expect, type Locator } from "@playwright/test";

export async function chooseMessageAction(message:Locator,action:"reply"|"react") {
  const page=message.page(),id=await message.getAttribute("data-message-id");
  await message.getByTestId("chat-message-actions").click();
  await page.getByTestId(`chat-message-${action}`).click();
  if(action==="reply")await expect(page.getByTestId("chat-reply-context").locator("[data-reply-id]")).toHaveAttribute("data-reply-id",id!);
  else await expect(page.getByTestId("chat-message-react-popup")).toBeVisible();
}
