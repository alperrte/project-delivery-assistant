import { randomBytes, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { expect, type BrowserContext, type Locator, type Page } from "@playwright/test";
import tr from "../src/i18n/meetings/tr.json";
import { psql, uuid } from "./db";
import { registerQaAccount } from "./qa-cleanup";

/** TEST-ONLY local accounts: no registration request, outgoing email, or change to an existing user's credentials. */
export function meetingAccount(role: "manager" | "member" | "solo" | "outsider", options: { fresh?: boolean } = {}) {
  const directory = path.join(__dirname, ".auth"); mkdirSync(directory, { recursive: true });
  // Meetings follow the user, so a reused account's list also holds every earlier run. Specs that count what a user can see ask for an account of their own.
  const file = path.join(directory, options.fresh ? `meeting-${role}-fresh-${randomBytes(4).toString("hex")}.json` : `meeting-${role}-user.json`);
  if (existsSync(file)) {
    const account = JSON.parse(readFileSync(file, "utf8")) as { id: string; email: string; password: string };
    if (psql(`SELECT count(*) FROM users WHERE id='${uuid(account.id)}'`) === "1") return file;
  }
  const id = randomUUID(), password = randomBytes(24).toString("hex") + "Aa1!";
  const email = `meeting-${id}@example.test`, nickname = `meeting-${role}-${randomBytes(4).toString("hex")}`;
  const directoryMaven = path.join(os.homedir(), ".m2/repository/org/springframework/security/spring-security-crypto");
  const version = readdirSync(directoryMaven).filter(value => existsSync(path.join(directoryMaven, value, `spring-security-crypto-${value}.jar`))).sort().at(-1)!;
  const source = path.join(directory, "MeetingQaHash.java");
  writeFileSync(source, 'class MeetingQaHash { public static void main(String[] args) throws Exception { String value = new String(System.in.readAllBytes(), java.nio.charset.StandardCharsets.UTF_8); System.out.print(org.springframework.security.crypto.bcrypt.BCrypt.hashpw(value, org.springframework.security.crypto.bcrypt.BCrypt.gensalt(10))); } }');
  const hash = execFileSync("java", ["--class-path", path.join(directoryMaven, version, `spring-security-crypto-${version}.jar`), source], { input: password, encoding: "utf8" }).trim();
  if (!/^\$2[aby]\$10\$[A-Za-z0-9./]{53}$/.test(hash)) throw new Error("Invalid test-only password hash");
  psql(`INSERT INTO users(id,email,nickname,password_hash,account_status,email_verification_status,global_role,email_verified_at,created_at,updated_at) VALUES('${uuid(id)}','${email}','${nickname}','${hash}','ACTIVE','VERIFIED','USER',now(),now(),now())`);
  writeFileSync(file, JSON.stringify({ id, email, password }));
  if (options.fresh) registerQaAccount(id); // removed again by the run's global teardown, whether or not the test that asked for it passed
  return file;
}

/** The side panel is open from the start on wide screens, so tapping its bar button would close it again: show a tab only if it is not the open one. */
export async function showPanel(page: Page, name: string) {
  const tab = page.locator("[data-meeting-room] aside").getByRole("tab", { name: new RegExp(`^${name}`), selected: true });
  if (!(await tab.isVisible())) await page.locator("[data-meeting-room]").getByRole("button", { name, exact: true }).click();
  await expect(tab).toBeVisible();
}

/**
 * Opens the menu of one person of the open participants panel (their "more" button, as a touch or keyboard user would) and returns
 * the menu. Without a name it is the first person who is not yourself. The panel itself is opened first if it is not.
 */
export async function openParticipantMenu(page: Page, name?: string): Promise<Locator> {
  await showPanel(page, tr.participants);
  const rows = page.locator("[data-meeting-room] [data-participant]");
  const row = name ? rows.filter({ hasText: name }).first() : rows.filter({ hasNotText: `(${tr.you})` }).first();
  const label = row.getByRole("button", { name: /^.* için seçenekler$|^Options for |^Optionen für / });
  await label.click();
  const menu = page.locator("[data-participant-menu]"); await expect(menu).toBeVisible();
  return menu;
}
/** The real gain (volume) values of the remote audio, read from the Web Audio nodes the page created (see `recordGains`). */
export const recordGains = () => {
  const gains: GainNode[] = []; Object.assign(window, { qaGains: gains });
  const original = AudioContext.prototype.createGain;
  AudioContext.prototype.createGain = function (this: AudioContext) { const node = original.call(this); gains.push(node); return node; };
};
export const readGains = (page: Page) => page.evaluate(() => (window as unknown as { qaGains: GainNode[] }).qaGains.map(node => Math.round(node.gain.value * 100) / 100));

/**
 * TEST-ONLY: the active members of a QA project, as the attendees of a meeting. Meetings no longer belong to projects, so another account
 * only reaches a meeting when it is invited; the tests that put two accounts in one project invite them explicitly with this.
 */
export function projectMateIds(projectId: string): string[] {
  return psql(`SELECT coalesce(string_agg(user_id::text,','),'') FROM project_memberships WHERE project_id='${uuid(projectId)}' AND status='ACTIVE'`).split(",").filter(Boolean);
}

/**
 * `next dev` draws its own round "N" badge (a <nextjs-portal>) over the bottom-left corner. On a phone that is where the call controls sit, so real
 * taps land on the badge instead. It exists only in development builds; a production build has none. Touch tests hide it so they measure the app.
 */
export const hideDevOverlay = (context: BrowserContext) => context.addInitScript(() => {
  const hide = () => { const style = document.createElement("style"); style.textContent = "nextjs-portal{display:none!important}"; document.documentElement.appendChild(style); };
  if (document.documentElement) hide(); else addEventListener("DOMContentLoaded", hide, { once: true });
});
