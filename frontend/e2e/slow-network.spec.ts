import { test, expect, type CDPSession } from "@playwright/test";
import { REJECTED_STATE } from "./consent-state";

/**
 * Slow-network guard (opt-in, `SLOW_NET=1`): the two public entry pages must still show their main heading and stay free of
 * console errors on a throttled phone-class connection.
 *
 * Conditions (the "Slow 4G" preset of Chrome DevTools / Lighthouse): 150 ms round trip, 1.6 Mbps down, 750 Kbps up, and a 4x
 * CPU slowdown. The throttling is applied through the Chrome DevTools Protocol, so it only works in Chromium.
 *
 * The budgets are generous on purpose (a first load that takes ~10 s is a failure of a different size than one that takes 4 s);
 * the printed timings are the useful part. Run against a production build, never the dev server:
 *   npm run build; npx next start -p 3100
 *   SLOW_NET=1 E2E_BASE_URL=http://localhost:3100 npx playwright test e2e/slow-network.spec.ts
 */
test.skip(process.env.SLOW_NET !== "1", "set SLOW_NET=1 to run the slow-network checks");

test.use({ storageState: REJECTED_STATE, trace: "off", screenshot: "off" });

const SLOW_4G = { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 };
const CPU_SLOWDOWN = 4;
/** Time to the main heading being visible, from navigation start. */
const HEADING_BUDGET_MS = 15_000;

async function throttle(session: CDPSession) {
  await session.send("Network.enable");
  await session.send("Network.emulateNetworkConditions", SLOW_4G);
  await session.send("Emulation.setCPUThrottlingRate", { rate: CPU_SLOWDOWN });
}

for (const { name, path } of [
  { name: "landing", path: "/" },
  { name: "login", path: "/login" },
] as const) {
  test(`${name}: the main heading appears within the budget on Slow 4G and 4x CPU, with no console errors`, async ({ page, context }) => {
    test.setTimeout(90_000);
    const errors: string[] = [];
    page.on("console", message => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("pageerror", error => errors.push(error.message));

    await throttle(await context.newCDPSession(page));

    const started = Date.now();
    await page.goto(path, { waitUntil: "commit" });
    const heading = page.getByRole("heading", { level: 1 }).first();
    await expect(heading).toBeVisible({ timeout: HEADING_BUDGET_MS });
    const visibleAfter = Date.now() - started;
    console.log(`[slow-net] ${name}: heading visible after ${visibleAfter} ms`);
    expect(visibleAfter).toBeLessThan(HEADING_BUDGET_MS);

    // Let hydration and the deferred chunks finish before judging the console.
    await page.waitForLoadState("load", { timeout: 60_000 });
    expect(errors, errors.join("\n")).toEqual([]);
  });
}
