import { test, expect, type CDPSession, type Page } from "@playwright/test";
import fs from "node:fs";
import { REJECTED_STATE } from "./consent-state";

/**
 * Theme-switch performance on the two public pages with the heaviest scenes: Landing (/) and Login (/login).
 *
 * Two kinds of tests live here:
 *
 * 1. Functional guards (always on, cheap, not timing-sensitive): the switch does not change the route, keeps keyboard
 *    focus on the toggle, plays the circle only when motion is on, and logs no hydration warning.
 * 2. Measurements (opt-in, `THEME_PERF=1`): clicks the toggle in a Chromium page and records, with CDP Performance
 *    metrics, a devtools.timeline trace, PerformanceObserver (longtask, event, long-animation-frame) and a
 *    requestAnimationFrame frame-gap sampler, what the switch costs. Numbers are printed and, with `THEME_PERF_OUT`,
 *    written to a JSON file. Hard assertions are deliberately loose (absolute ceilings far above a healthy value) because
 *    wall-clock numbers depend on the machine; the point is the printed table, compared before/after a change.
 *
 *    Run against a production build, never the dev server (React dev overhead hides the real cost):
 *      npm run build; npx next start -p 3100
 *      THEME_PERF=1 E2E_BASE_URL=http://localhost:3100 npx playwright test e2e/theme-switch-performance.spec.ts
 *    `THEME_PERF_RENDERS=1` (against `next dev`, where component names exist) lists the components React re-renders.
 */

// Playwright's own trace/screenshot recording would add load and artefact churn to the measured contexts.
test.use({ trace: "off", screenshot: "off" });

const MEASURE = process.env.THEME_PERF === "1";
// Headless Chromium rasterises and composites in software (SwiftShader), which is not what a person sees. For the
// measurement run ask for the real GPU (ANGLE/D3D11); THEME_PERF_GPU=0 forces the software path again.
const GPU_ARGS = ["--enable-gpu", "--ignore-gpu-blocklist", "--use-gl=angle", "--use-angle=d3d11", "--enable-zero-copy", "--enable-gpu-rasterization"];
if (MEASURE && process.env.THEME_PERF_GPU !== "0") test.use({ launchOptions: { args: GPU_ARGS } });
// THEME_PERF_CHANNEL=chrome measures the installed Google Chrome (its own Windows GPU choice) instead of the bundled Chromium.
if (MEASURE && process.env.THEME_PERF_CHANNEL) test.use({ channel: process.env.THEME_PERF_CHANNEL });
const RENDERS = process.env.THEME_PERF_RENDERS === "1";
const WINDOW_MS = 1500;
const PAGES = [
  { name: "landing", path: "/" },
  { name: "login", path: "/login" },
] as const;
// THEME_PERF_VIEWPORT=2560x1440 measures one custom size instead (e.g. the developer's own monitor).
const CUSTOM_VIEWPORT = process.env.THEME_PERF_VIEWPORT?.match(/^(\d+)x(\d+)$/);
const VIEWPORTS = CUSTOM_VIEWPORT
  ? [{ name: CUSTOM_VIEWPORT[0], width: Number(CUSTOM_VIEWPORT[1]), height: Number(CUSTOM_VIEWPORT[2]) }]
  : [
      { name: "1440x900", width: 1440, height: 900 },
      { name: "390x844", width: 390, height: 844 },
    ];

type Scheme = "light" | "dark";

/** The page's own toggle: the first visible theme switch (Landing also embeds inert demo switches further down). */
async function themeButton(page: Page, to: Scheme) {
  const toggles = page.locator(".theme-toggle");
  const count = await toggles.count();
  for (let i = 0; i < count; i++) {
    if (await toggles.nth(i).isVisible()) return toggles.nth(i).locator("button").nth(to === "light" ? 0 : 1);
  }
  throw new Error("no visible theme toggle");
}

async function openSettled(page: Page, path: string, scheme: Scheme, extraStorage: Record<string, string> = {}) {
  await page.addInitScript(
    ([theme, extra]) => {
      localStorage.setItem("theme", theme as string);
      for (const [key, value] of Object.entries(extra as Record<string, string>)) localStorage.setItem(key, value);
    },
    [scheme, extraStorage] as const,
  );
  await page.goto(path, { waitUntil: "load" });
  await page.waitForFunction(() => [...document.images].every(image => image.complete || image.loading === "lazy"));
  // Entrance animations (auth-enter-*, 1.6s) and fonts must be over so only the switch is measured.
  await page.waitForTimeout(2600);
}

/** Console messages that point at a hydration problem. */
function watchHydration(page: Page) {
  const problems: string[] = [];
  const pattern = /hydrat|did not match|server rendered HTML|Minified React error #(418|419|422|423|425)/i;
  page.on("console", message => {
    if ((message.type() === "error" || message.type() === "warning") && pattern.test(message.text())) problems.push(message.text());
  });
  page.on("pageerror", error => {
    if (pattern.test(error.message)) problems.push(error.message);
  });
  return problems;
}

test.describe("theme switch: functional guards", () => {
  for (const { name, path } of PAGES) {
    test(`${name}: switching keeps the route and focus, and logs no hydration warning`, async ({ page }) => {
      const problems = watchHydration(page);
      await openSettled(page, path, "light");
      const url = page.url();
      const dark = await themeButton(page, "dark");
      await dark.focus();
      await dark.click();
      await expect(page.locator("html")).toHaveClass(/dark/);
      await expect(page.locator("html")).not.toHaveClass(/theme-(reveal|close-in)/);
      expect(page.url()).toBe(url);
      // Same element still focused (no remount) and the pressed state followed the theme.
      await expect.poll(() => page.evaluate(() => document.activeElement?.getAttribute("aria-pressed"))).toBe("true");
      expect(await page.evaluate(() => document.activeElement?.closest(".theme-toggle") !== null)).toBe(true);

      const light = await themeButton(page, "light");
      await light.click();
      await expect(page.locator("html")).not.toHaveClass(/dark/);
      await expect(page.locator("html")).not.toHaveClass(/theme-(reveal|close-in)/);
      expect(page.url()).toBe(url);
      expect(problems).toEqual([]);
    });

    test(`${name}: opens in dark without a hydration warning`, async ({ page }) => {
      const problems = watchHydration(page);
      await openSettled(page, path, "dark");
      await expect(page.locator("html")).toHaveClass(/dark/);
      expect(problems).toEqual([]);
    });

    test(`${name}: with motion off the theme is applied without playing the circle`, async ({ page }) => {
      await openSettled(page, path, "light", { "pda:motion": "off" });
      await page.evaluate(() => {
        const seen = new Set<string>();
        Object.assign(window, { __seen: seen });
        new MutationObserver(() => {
          for (const cls of ["theme-reveal", "theme-close-in"]) if (document.documentElement.classList.contains(cls)) seen.add(cls);
        }).observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
      });
      await (await themeButton(page, "dark")).click();
      await expect(page.locator("html")).toHaveClass(/dark/);
      await page.waitForTimeout(900);
      expect(await page.evaluate(() => [...(window as unknown as { __seen: Set<string> }).__seen])).toEqual([]);
    });
  }
});

test("login: the endless loops rest while the circle plays and run again afterwards", async ({ page }) => {
  await openSettled(page, "/login", "light");
  // Headless Chromium is a software renderer, where the neon is dropped on purpose (next tests). Lift the verdict here
  // (nothing re-applies it once the page is settled) so the loops can be inspected as a GPU browser would run them.
  await page.evaluate(() => delete document.documentElement.dataset.renderer);
  const state = () => page.evaluate(() => getComputedStyle(document.querySelector(".auth-neon-band")!).animationPlayState);
  expect(await state()).toBe("running");
  await (await themeButton(page, "dark")).click();
  await expect(page.locator("html")).toHaveClass(/theme-close-in/);
  expect(await state()).toBe("paused");
  await expect(page.locator("html")).not.toHaveClass(/theme-close-in/);
  expect(await state()).toBe("running");
});

test.describe("login: software rendering drops the neon", () => {
  const neonDisplay = (page: Page) => page.evaluate(() => getComputedStyle(document.querySelector(".auth-neon")!).display);

  test("a browser without hardware acceleration is detected, the neon is hidden and the page stays whole", async ({ page }) => {
    const problems = watchHydration(page);
    await openSettled(page, "/login", "light");
    // Headless Chromium rasterises with SwiftShader, which is exactly the case the probe has to recognise.
    await expect(page.locator("html")).toHaveAttribute("data-renderer", "software");
    expect(await page.evaluate(() => sessionStorage.getItem("pda:renderer"))).toBe("software");
    expect(await neonDisplay(page)).toBe("none");

    // Everything else of the scene stays: photos, logo, card, corner controls.
    await expect(page.locator(".auth-enter-scene")).toBeVisible();
    await expect(page.locator(".auth-enter-scene img:visible")).toHaveCount(1);
    await expect(page.getByRole("link", { name: /pda/i }).first()).toBeVisible();
    await expect(page.locator(".auth-scope").first()).toBeVisible();
    await expect(page.locator('input[type="email"], input[name="email"]').first()).toBeVisible();

    // The theme still switches.
    await (await themeButton(page, "dark")).click();
    await expect(page.locator("html")).toHaveClass(/dark/);
    await expect(page.locator("html")).not.toHaveClass(/theme-(reveal|close-in)/);
    expect(await neonDisplay(page)).toBe("none");
    await expect(page.locator(".auth-enter-scene img:visible")).toHaveCount(1);
    expect(problems).toEqual([]);
  });

  test("a cached verdict is applied while the document is still being parsed, so the neon never shows", async ({ page }) => {
    await page.addInitScript(() => {
      sessionStorage.setItem("pda:renderer", "software");
      const observer = new MutationObserver(() => {
        if (document.documentElement.dataset.renderer !== "software") return;
        // The observer runs right after the head script: the body has not been parsed yet.
        Object.assign(window, { __rendererAppliedBeforeMain: document.querySelector("main") === null });
        observer.disconnect();
      });
      // The init script runs before <html> exists, so watch the document itself.
      observer.observe(document, { subtree: true, attributes: true, attributeFilter: ["data-renderer"] });
    });
    await page.goto("/login", { waitUntil: "load" });
    expect(await page.evaluate(() => (window as unknown as { __rendererAppliedBeforeMain?: boolean }).__rendererAppliedBeforeMain)).toBe(true);
    expect(await neonDisplay(page)).toBe("none");
  });

  test("a hardware verdict keeps the neon", async ({ page }) => {
    const problems = watchHydration(page);
    await page.addInitScript(() => sessionStorage.setItem("pda:renderer", "hardware"));
    await openSettled(page, "/login", "light");
    expect(await page.evaluate(() => document.documentElement.dataset.renderer ?? null)).toBeNull();
    expect(await neonDisplay(page)).toBe("block");
    expect(problems).toEqual([]);
  });
});

/* ------------------------------------------------------------------------------------------------------------ */
/* Measurement                                                                                                   */
/* ------------------------------------------------------------------------------------------------------------ */

type TraceEvent = { pid: number; tid: number; ts: number; dur?: number; ph: string; name: string; cat?: string; args?: Record<string, unknown> };

type Sample = {
  swapMs: number | null; // click -> html class actually flipped
  vtCallMs: number | null; // click -> document.startViewTransition() called
  vtReadyMs: number | null; // click -> transition snapshots ready (animation can start)
  vtFinishedMs: number | null;
  inpMs: number | null; // longest "event" timing entry for the click (input delay + handlers + next paint)
  longestLongTaskMs: number;
  longTasks: number;
  loafMaxMs: number;
  maxFrameGapMs: number;
  framesOver50: number;
  frameCount: number;
  cdp: Record<string, number>; // deltas of CDP Performance metrics over the window
  trace?: Record<string, number>;
  mutations: number;
  focusKept: boolean;
};

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted.length ? sorted[Math.floor(sorted.length / 2)] : NaN;
};

const INSTRUMENT = (windowMs: number) => `
(() => {
  const m = { t0: null, swap: null, vtCall: null, vtReady: null, vtFinished: null, long: [], events: [], loaf: [], frames: [], mutations: 0 };
  window.__m = m;
  const observe = (type, cb, opts) => { try { new PerformanceObserver(l => l.getEntries().forEach(cb)).observe({ type, ...opts }); } catch {} };
  observe('longtask', e => m.long.push(e.duration));
  observe('long-animation-frame', e => m.loaf.push(e.duration));
  observe('event', e => { if (e.interactionId || ['click','pointerdown','pointerup','mousedown','mouseup'].includes(e.name)) m.events.push(e.duration); }, { durationThreshold: 16 });
  const html = document.documentElement;
  const wasDark = html.classList.contains('dark');
  new MutationObserver(() => {
    if (m.t0 !== null && m.swap === null && html.classList.contains('dark') !== wasDark) m.swap = performance.now() - m.t0;
  }).observe(html, { attributes: true, attributeFilter: ['class'] });
  new MutationObserver(r => { if (m.t0 !== null) m.mutations += r.length; }).observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true });
  const original = document.startViewTransition ? document.startViewTransition.bind(document) : null;
  if (original) document.startViewTransition = (cb) => {
    m.vtCall = performance.now() - m.t0;
    const t = original(cb);
    t.ready.then(() => { m.vtReady = performance.now() - m.t0; }, () => {});
    t.finished.then(() => { m.vtFinished = performance.now() - m.t0; }, () => {});
    return t;
  };
  document.addEventListener('click', () => {
    if (m.t0 !== null) return;
    m.t0 = performance.now();
    performance.mark('pda-theme-click');
    let last = m.t0;
    const tick = (now) => {
      m.frames.push(now - last); last = now;
      if (now - m.t0 < ${windowMs}) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, true);
})();
`;

function analyseTrace(events: TraceEvent[]) {
  const names = new Map<string, string>();
  for (const e of events) if (e.ph === "M" && e.name === "thread_name") names.set(`${e.pid}:${e.tid}`, String(e.args?.name));
  const mark = events.find(e => e.name === "pda-theme-click");
  if (!mark) return undefined;
  const t0 = mark.ts;
  const t1 = t0 + WINDOW_MS * 1000;
  const main = `${mark.pid}:${mark.tid}`;
  const sum: Record<string, number> = {};
  const add = (key: string, us: number) => { sum[key] = (sum[key] ?? 0) + us / 1000; };
  let longestMainTask = 0;
  for (const e of events) {
    if (e.ph !== "X" || e.dur === undefined || e.ts < t0 || e.ts > t1) continue;
    const thread = `${e.pid}:${e.tid}`;
    const threadName = names.get(thread) ?? "";
    if (thread === main) {
      if (e.name === "RunTask") longestMainTask = Math.max(longestMainTask, e.dur / 1000);
      if (["UpdateLayoutTree", "Layout", "PrePaint", "Paint", "Layerize", "Commit", "UpdateLayer", "HitTest", "FunctionCall", "EvaluateScript", "EventDispatch", "RunMicrotasks", "FireAnimationFrame", "ResizeObserver", "HandlePostMessage"].includes(e.name)) add(`main.${e.name}`, e.dur);
    } else if (/ThreadPool|CompositorTileWorker/.test(threadName)) {
      if (["RasterTask", "ImageDecodeTask"].includes(e.name)) add(`raster.${e.name}`, e.dur);
    } else if (/VizCompositor/.test(threadName)) {
      if (e.name === "DirectRenderer::DrawFrame") add("gpu.DrawFrame", e.dur);
    } else if (/CrGpuMain/.test(threadName)) {
      if (e.name === "RunTask") add("gpu.mainRunTask", e.dur);
    }
  }
  sum["main.longestRunTask"] = longestMainTask;
  return Object.fromEntries(Object.entries(sum).map(([k, v]) => [k, Math.round(v * 100) / 100]));
}

async function metrics(cdp: CDPSession) {
  const { metrics } = await cdp.send("Performance.getMetrics");
  return Object.fromEntries(metrics.map(m => [m.name, m.value])) as Record<string, number>;
}

async function runOnce(page: Page, cdp: CDPSession, to: Scheme, withTrace: boolean, throttle: number): Promise<Sample> {
  await page.evaluate(INSTRUMENT(WINDOW_MS));
  const button = await themeButton(page, to);
  await button.focus();
  const events: TraceEvent[] = [];
  let done: (() => void) | undefined;
  let onData: ((data: { value: unknown[] }) => void) | undefined;
  let onComplete: (() => void) | undefined;
  const complete = new Promise<void>(resolve => { done = resolve; });
  if (withTrace) {
    onData = data => { events.push(...(data.value as unknown as TraceEvent[])); };
    onComplete = () => done?.();
    cdp.on("Tracing.dataCollected", onData);
    cdp.on("Tracing.tracingComplete", onComplete);
    await cdp.send("Tracing.start", { categories: "devtools.timeline,disabled-by-default-devtools.timeline,blink.user_timing,cc,gpu,viz", transferMode: "ReportEvents" });
  }
  if (throttle > 1) await cdp.send("Emulation.setCPUThrottlingRate", { rate: throttle });
  const before = await metrics(cdp);
  await button.click();
  await page.waitForTimeout(WINDOW_MS + 300);
  const after = await metrics(cdp);
  if (throttle > 1) await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
  if (withTrace) {
    await cdp.send("Tracing.end");
    // Never wait forever for the trace: a stalled tracing session must not hang the whole run.
    await Promise.race([complete, new Promise<void>(resolve => setTimeout(resolve, 30_000))]);
    if (onData) cdp.off("Tracing.dataCollected", onData);
    if (onComplete) cdp.off("Tracing.tracingComplete", onComplete);
  }
  if (withTrace && process.env.THEME_PERF_TRACE_FILE) fs.writeFileSync(process.env.THEME_PERF_TRACE_FILE, JSON.stringify(events));
  const m = await page.evaluate(() => {
    const data = (window as unknown as { __m: Record<string, unknown> }).__m as {
      swap: number | null; vtCall: number | null; vtReady: number | null; vtFinished: number | null;
      long: number[]; events: number[]; loaf: number[]; frames: number[]; mutations: number;
    };
    return { ...data, focusKept: document.activeElement?.closest(".theme-toggle") !== null };
  });
  const delta: Record<string, number> = {};
  for (const key of ["TaskDuration", "ScriptDuration", "LayoutDuration", "RecalcStyleDuration", "LayoutCount", "RecalcStyleCount", "LayoutObjects", "Nodes"]) {
    delta[key] = Math.round(((after[key] ?? 0) - (before[key] ?? 0)) * (key.endsWith("Duration") ? 1000 : 1) * 100) / 100; // seconds -> ms
  }
  const frames = m.frames.slice(1);
  return {
    swapMs: m.swap,
    vtCallMs: m.vtCall,
    vtReadyMs: m.vtReady,
    vtFinishedMs: m.vtFinished,
    inpMs: m.events.length ? Math.max(...m.events) : null,
    longestLongTaskMs: m.long.length ? Math.max(...m.long) : 0,
    longTasks: m.long.length,
    loafMaxMs: m.loaf.length ? Math.max(...m.loaf) : 0,
    maxFrameGapMs: frames.length ? Math.max(...frames) : 0,
    framesOver50: frames.filter(gap => gap > 50).length,
    frameCount: frames.length,
    cdp: delta,
    trace: withTrace ? analyseTrace(events) : undefined,
    mutations: m.mutations,
    focusKept: m.focusKept,
  };
}

const results: Record<string, unknown> = {};

test.describe("theme switch: measurement", () => {
  test.skip(!MEASURE, "opt-in: THEME_PERF=1 (timing-sensitive, run against a production build)");
  test.setTimeout(3 * 60_000);

  for (const viewport of VIEWPORTS) {
    for (const { name, path } of PAGES) {
      for (const throttle of [1, 4]) {
        for (const from of ["light", "dark"] as const) {
          const to: Scheme = from === "light" ? "dark" : "light";
          test(`${name} ${viewport.name} cpu${throttle}x ${from}->${to}`, async ({ browser, baseURL }) => {
            const samples: Sample[] = [];
            let traced: Sample | undefined;
            // Cold samples: each on a fresh page, so the hidden theme's images/filters have never been drawn.
            for (let rep = 0; rep < 3; rep++) {
              const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, baseURL, locale: "tr-TR", storageState: REJECTED_STATE });
              const page = await context.newPage();
              const cdp = await context.newCDPSession(page);
              await cdp.send("Performance.enable");
              await openSettled(page, path, from);
              const withTrace = rep === 2;
              const sample = await runOnce(page, cdp, to, withTrace, throttle);
              if (withTrace) traced = sample;
              samples.push(sample);
              // Warm: switch back on the same page once everything has been drawn in both themes.
              if (rep === 0) {
                await page.waitForTimeout(800);
                const warm = await runOnce(page, cdp, from, false, throttle);
                results[`${name} ${viewport.name} cpu${throttle}x ${to}->${from} (warm)`] = warm;
              }
              await context.close();
            }
            const pick = (fn: (s: Sample) => number | null) => median(samples.map(fn).filter((v): v is number => v !== null));
            const summary = {
              swapMs: pick(s => s.swapMs),
              vtReadyMs: pick(s => s.vtReadyMs),
              inpMs: pick(s => s.inpMs),
              longestLongTaskMs: pick(s => s.longestLongTaskMs),
              longTasks: pick(s => s.longTasks),
              loafMaxMs: pick(s => s.loafMaxMs),
              maxFrameGapMs: pick(s => s.maxFrameGapMs),
              framesOver50: pick(s => s.framesOver50),
              taskMs: pick(s => s.cdp.TaskDuration),
              scriptMs: pick(s => s.cdp.ScriptDuration),
              styleMs: pick(s => s.cdp.RecalcStyleDuration),
              layoutMs: pick(s => s.cdp.LayoutDuration),
              mutations: pick(s => s.mutations),
              trace: traced?.trace,
              samples,
            };
            results[`${name} ${viewport.name} cpu${throttle}x ${from}->${to} (cold)`] = summary;
            if (process.env.THEME_PERF_OUT) fs.writeFileSync(process.env.THEME_PERF_OUT, JSON.stringify(results, null, 1));
            console.log(`PERF ${name} ${viewport.name} cpu${throttle}x ${from}->${to}\n` + JSON.stringify({ ...summary, samples: undefined }, null, 1));

            // Loose ceilings only: a healthy switch is far below these on any machine, a broken one (blocked main thread,
            // lost toggle, no theme change) is far above.
            expect(summary.swapMs, "the theme class must flip").toBeLessThan(throttle > 1 ? 3000 : 1000);
            expect(summary.longestLongTaskMs).toBeLessThan(throttle > 1 ? 5000 : 2000);
            expect(samples.every(s => s.focusKept)).toBe(true);
          });
        }
      }
    }
  }

  test.afterAll(() => {
    if (process.env.THEME_PERF_OUT) fs.writeFileSync(process.env.THEME_PERF_OUT, JSON.stringify(results, null, 1));
  });
});

/* ------------------------------------------------------------------------------------------------------------ */
/* Which components re-render (dev server only: production builds mangle component names)                      */
/* ------------------------------------------------------------------------------------------------------------ */

test.describe("theme switch: re-render census", () => {
  test.skip(!RENDERS, "opt-in: THEME_PERF_RENDERS=1 against `next dev`");

  for (const { name, path } of PAGES) {
    test(`${name}: components React renders for one theme switch`, async ({ page }) => {
      await page.addInitScript(() => {
        const state = { on: false, commits: 0, rendered: {} as Record<string, number>, mounted: 0 };
        Object.assign(window, { __renders: state });
        type Fiber = { tag: number; flags: number; type?: { displayName?: string; name?: string; render?: { name?: string }; type?: { name?: string } } | string; child: Fiber | null; sibling: Fiber | null; alternate: Fiber | null };
        const label = (f: Fiber) => {
          const t = f.type;
          if (!t || typeof t === "string") return null;
          return t.displayName || t.name || t.render?.name || t.type?.name || "Anonymous";
        };
        const visit = (f: Fiber, mount: boolean) => {
          // 0 function, 1 class, 11 forwardRef, 14 memo, 15 simple memo
          if ([0, 1, 11, 14, 15].includes(f.tag) && (mount || (f.flags & 1) === 1)) {
            const key = label(f);
            if (key) { state.rendered[key] = (state.rendered[key] ?? 0) + 1; if (mount) state.mounted++; }
          }
          // A fiber whose children are the very same objects as in the previous tree bailed out: nothing below re-rendered.
          if (!mount && f.alternate && f.child === f.alternate.child) return;
          for (let c = f.child; c; c = c.sibling) visit(c, mount || !c.alternate);
        };
        const walk = (root: Fiber) => {
          const current = root;
          if (current.child && current.alternate && current.child === current.alternate.child) return;
          for (let c = current.child; c; c = c.sibling) visit(c, !c.alternate);
        };
        const hook = {
          supportsFiber: true,
          renderers: new Map(),
          inject(renderer: unknown) { const id = this.renderers.size + 1; this.renderers.set(id, renderer); return id; },
          onScheduleFiberRoot() {},
          onCommitFiberUnmount() {},
          onPostCommitFiberRoot() {},
          checkDCE() {},
          onCommitFiberRoot(_id: number, root: { current: Fiber }) { if (state.on) { state.commits++; walk(root.current); } },
        };
        Object.defineProperty(window, "__REACT_DEVTOOLS_GLOBAL_HOOK__", { value: hook, configurable: true });
      });
      await openSettled(page, path, "light");
      await page.evaluate(() => { (window as unknown as { __renders: { on: boolean } }).__renders.on = true; });
      await (await themeButton(page, "dark")).click();
      await page.waitForTimeout(1500);
      const state = await page.evaluate(() => (window as unknown as { __renders: { commits: number; mounted: number; rendered: Record<string, number> } }).__renders);
      const total = Object.values(state.rendered).reduce((a, b) => a + b, 0);
      const top = Object.entries(state.rendered).sort((a, b) => b[1] - a[1]).slice(0, 25);
      console.log(`RENDERS ${name}: commits=${state.commits} componentRenders=${total} (of which mounts=${state.mounted})\n` + top.map(([k, v]) => `  ${v}x ${k}`).join("\n"));
      expect(state.commits).toBeGreaterThan(0);
    });
  }
});
