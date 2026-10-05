import { expect, test } from "@playwright/test";
import { MANAGER_STORAGE } from "./global-setup";

test.use({ storageState: MANAGER_STORAGE });

// CSS contract fixtures use the real application stylesheet, independently of
// primitive mount timing. Existing page suites exercise the actual controls.
for (const theme of ["light", "dark"] as const) {
  test(`state variants keep boolean/legacy attributes and animations in ${theme}`, async ({ page }) => {
    await page.goto("/settings");
    await expect(page.getByRole("heading", { level: 1, name: "Ayarlar" })).toBeVisible();
    const result = await page.evaluate((theme) => {
      document.documentElement.classList.toggle("dark", theme === "dark");
      document.documentElement.dataset.motion = "on";
      const fixture = document.createElement("div");
      fixture.style.cssText = "position:fixed;left:-10000px;top:0";
      document.body.append(fixture);
      const make = (classes: string) => {
        const node = document.createElement("div");
        node.className = classes;
        fixture.append(node);
        return node;
      };
      const popup = make("duration-100 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95");
      const readAnimation = () => {
        const style = getComputedStyle(popup);
        return { name: style.animationName, duration: style.animationDuration };
      };
      popup.setAttribute("data-open", "");
      const open = readAnimation();
      popup.setAttribute("data-open", "false");
      const falseOpen = readAnimation();
      popup.removeAttribute("data-open");
      popup.setAttribute("data-state", "open");
      const legacyOpen = readAnimation();
      popup.removeAttribute("data-state");
      popup.setAttribute("data-closed", "");
      const closed = readAnimation();

      const disabled = make("data-disabled:pointer-events-none data-disabled:opacity-50");
      disabled.setAttribute("data-disabled", "");
      const disabledStyle = { pointer: getComputedStyle(disabled).pointerEvents, opacity: getComputedStyle(disabled).opacity };
      disabled.setAttribute("data-disabled", "false");
      const enabledStyle = { pointer: getComputedStyle(disabled).pointerEvents, opacity: getComputedStyle(disabled).opacity };
      const primary = make("bg-primary");
      const checked = make("data-checked:bg-primary");
      checked.setAttribute("data-checked", "");
      const checkedColor = getComputedStyle(checked).backgroundColor;
      checked.setAttribute("data-checked", "false");
      const uncheckedColor = getComputedStyle(checked).backgroundColor;
      const background = make("bg-background");
      const active = make("data-active:bg-background");
      active.setAttribute("data-state", "active");
      const activeColor = getComputedStyle(active).backgroundColor;
      const horizontal = make("flex data-horizontal:flex-col");
      horizontal.setAttribute("data-orientation", "horizontal");
      const direction = getComputedStyle(horizontal).flexDirection;
      const vertical = make("data-vertical:w-px");
      vertical.setAttribute("data-orientation", "vertical");
      const width = getComputedStyle(vertical).width;
      const result = { open, falseOpen, legacyOpen, closed, disabledStyle, enabledStyle, checkedColor, uncheckedColor, primaryColor: getComputedStyle(primary).backgroundColor, activeColor, backgroundColor: getComputedStyle(background).backgroundColor, direction, width };
      fixture.remove();
      return result;
    }, theme);
    expect(result.open).toEqual({ name: "enter", duration: "0.1s" });
    expect(result.legacyOpen).toEqual(result.open);
    expect(result.falseOpen.name).toBe("none");
    expect(result.closed).toEqual({ name: "exit", duration: "0.1s" });
    expect(result.disabledStyle).toEqual({ pointer: "none", opacity: "0.5" });
    expect(result.enabledStyle).toEqual({ pointer: "auto", opacity: "1" });
    expect(result.checkedColor).toBe(result.primaryColor);
    expect(result.uncheckedColor).toBe("rgba(0, 0, 0, 0)");
    expect(result.activeColor).toBe(result.backgroundColor);
    expect(result.direction).toBe("column");
    expect(result.width).toBe("1px");
  });
}
