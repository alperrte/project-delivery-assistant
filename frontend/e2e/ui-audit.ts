import { appendFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { Page } from "@playwright/test";

// Shared by the UI/UX audit specs. Every check is recorded to a JSON-lines file so the run can be summarised per
// checklist item (how many checks were made, how many failed), and the failures are returned so the test can assert.

const FILE = process.env.UI_AUDIT_FILE ?? "test-results/ui-audit.jsonl";

export const VIEWPORTS = [
  { name: "320", width: 320, height: 640 },
  { name: "390", width: 390, height: 844 },
  { name: "768", width: 768, height: 1024 },
  { name: "1280", width: 1280, height: 720 },
  { name: "1920", width: 1920, height: 1080 },
] as const;

export class Findings {
  total = 0;
  fails: string[] = [];
  warns: string[] = [];
  constructor(readonly item: string) {}

  check(label: string, ok: boolean, detail = "") {
    this.total += 1;
    if (!ok) this.fails.push(detail ? `${label} → ${detail}` : label);
    this.write(ok ? "pass" : "fail", label, detail);
    return ok;
  }

  /** Not a failure: something worth reporting (for example a target smaller than 44 px but larger than 24 px). */
  warn(label: string, detail = "") {
    this.warns.push(detail ? `${label} → ${detail}` : label);
    this.write("warn", label, detail);
  }

  private write(status: string, label: string, detail: string) {
    try {
      mkdirSync(dirname(FILE), { recursive: true });
      appendFileSync(FILE, `${JSON.stringify({ item: this.item, status, label, detail })}\n`);
    } catch {
      // The record is a convenience; a failed write must never fail a test.
    }
  }

  message() {
    return this.fails.join("\n");
  }
}

/** Page-level horizontal overflow and elements sticking out of the viewport that nothing clips. */
export async function overflowReport(page: Page) {
  return page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const offenders: string[] = [];
    const describe = (el: Element) => {
      const r = el.getBoundingClientRect();
      const text = (el.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 30);
      return `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ""}.${String(el.getAttribute("class") ?? "").split(" ").slice(0, 3).join(".")} [${Math.round(r.left)}..${Math.round(r.right)}] "${text}"`;
    };
    for (const el of Array.from(document.querySelectorAll("body *"))) {
      const cs = getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden") continue;
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) continue;
      if (r.right <= vw + 1 && r.left >= -1) continue;
      if (el.closest('[aria-hidden="true"], [inert], [hidden]')) continue;
      let clipped = false;
      for (let p: Element | null = el.parentElement; p && p !== document.body && p !== document.documentElement; p = p.parentElement) {
        const ps = getComputedStyle(p);
        if (ps.position === "fixed") { clipped = true; break; }
        const pr = p.getBoundingClientRect();
        if (/(auto|scroll|hidden|clip)/.test(ps.overflowX) && pr.right <= vw + 1 && pr.left >= -1) { clipped = true; break; }
      }
      if (clipped) continue;
      if (cs.position === "fixed") continue;
      offenders.push(describe(el));
      if (offenders.length >= 5) break;
    }
    return {
      docOverflow: document.documentElement.scrollWidth - vw,
      bodyOverflow: document.body.scrollWidth - vw,
      offenders,
    };
  });
}

/** Visible interactive elements with their smallest side, skipping inline links inside running text. */
export async function touchTargets(page: Page) {
  return page.evaluate(() => {
    const sel = 'a[href], button, input:not([type="hidden"]), select, textarea, [role="button"], [role="tab"], [role="menuitem"], [role="checkbox"], [role="switch"], [role="radio"], summary';
    const out: { name: string; w: number; h: number }[] = [];
    for (const el of Array.from(document.querySelectorAll<HTMLElement>(sel))) {
      const cs = getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden") continue;
      if (el.closest('[aria-hidden="true"], [inert], [hidden]')) continue;
      let r = el.getBoundingClientRect();
      if (el instanceof HTMLInputElement && (el.type === "checkbox" || el.type === "radio") && (r.width < 24 || r.height < 24)) {
        const label = el.closest("label") ?? (el.id ? document.querySelector(`label[for="${el.id}"]`) : null);
        if (label) r = label.getBoundingClientRect();
      }
      if (r.width < 1 || r.height < 1) continue;
      // An absolutely placed ::after (stretched link, enlarged checkbox hit area) is part of what a finger can hit.
      const after = getComputedStyle(el, "::after");
      if (after.position === "absolute" && after.content !== "none") {
        const aw = parseFloat(after.width);
        const ah = parseFloat(after.height);
        if (aw > r.width || ah > r.height) r = { ...r.toJSON(), width: Math.max(r.width, aw || 0), height: Math.max(r.height, ah || 0) } as DOMRect;
      }
      // Skip link: visually hidden until it takes focus.
      // The thin handle that brings back the auto-hidden header is not a normal control.
      if (el.tagName === "BUTTON" && !(el.textContent ?? "").trim() && !el.getAttribute("aria-label") && r.height <= 8) continue;
      if (el.classList.contains("sr-only") || /^#main-content$/.test(el.getAttribute("href") ?? "")) continue;
      // Off screen on purpose (skip link, closed drawer).
      if (r.right <= 0 || r.bottom <= 0 || r.left >= window.innerWidth) continue;
      let fixedAncestor = false;
      for (let p: Element | null = el; p && p !== document.body; p = p.parentElement) {
        const st = getComputedStyle(p);
        if (st.position === "fixed" && p.getBoundingClientRect().right <= 0) { fixedAncestor = true; break; }
      }
      if (fixedAncestor) continue;
      if (el.tagName === "A" && cs.display === "inline") continue; // WCAG 2.5.8 inline exception
      const name = (el.getAttribute("aria-label") ?? el.textContent ?? el.getAttribute("name") ?? "").trim().replace(/\s+/g, " ").slice(0, 28);
      out.push({ name: `${el.tagName.toLowerCase()}[${name}]`, w: Math.round(r.width), h: Math.round(r.height) });
    }
    return out;
  });
}

const SIGNATURE = (el: Element) => {
  const cs = getComputedStyle(el);
  return [cs.backgroundColor, cs.color, cs.borderTopColor, cs.boxShadow, cs.textDecorationLine, cs.transform, cs.opacity, cs.outlineStyle, cs.filter].join("|");
};

/** Tab through the page; returns one entry per focused element saying whether a focus indicator is drawn. */
export async function focusSweep(page: Page, limit = 40) {
  const seen = new Set<string>();
  const results: { name: string; visible: boolean }[] = [];
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  for (let i = 0; i < limit; i += 1) {
    await page.keyboard.press("Tab");
    const info = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || el === document.body) return null;
      // The Next.js dev overlay is not part of the product.
      if (el.tagName.toLowerCase() === "nextjs-portal") return { name: "dev-overlay", visible: true, key: "dev-overlay" };
      const cs = getComputedStyle(el);
      const outline = cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) > 0;
      const shadow = cs.boxShadow !== "none";
      const name = `${el.tagName.toLowerCase()}[${(el.getAttribute("aria-label") ?? el.textContent ?? el.getAttribute("name") ?? "").trim().replace(/\s+/g, " ").slice(0, 28)}]`;
      const r = el.getBoundingClientRect();
      return { name, visible: outline || shadow, key: `${name}@${Math.round(r.left)},${Math.round(r.top)}` };
    });
    if (!info) break;
    if (seen.has(info.key)) break;
    seen.add(info.key);
    results.push({ name: info.name, visible: info.visible });
  }
  return results;
}

export { SIGNATURE };
