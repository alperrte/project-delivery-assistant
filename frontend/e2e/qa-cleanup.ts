import { appendFileSync, existsSync, readFileSync, readdirSync, rmSync } from "node:fs";
import path from "node:path";
import { psql, uuid } from "./db";

/**
 * Cleanup of the throw-away accounts the meeting specs create (`meetingAccount(role, { fresh: true })`).
 *
 * Only rows that belong to such an account are removed, and an account is only ever touched when ALL of this holds:
 *   - its e-mail is `meeting-<uuid>@example.test` and its nickname is `meeting-<role>-<8 hex>` (what the fixture writes, nothing a person can register),
 *   - it is not one of the four persistent QA accounts (`.auth/meeting-<role>-user.json`, reused on purpose),
 *   - it was made by THIS run (its id is in this run's ledger), or it is older than STALE_AFTER (left behind by a run that was killed).
 * A run that is still going therefore never loses its accounts to another run. The database is the local compose PostgreSQL that `psql()` talks to.
 */
const AUTH = path.join(__dirname, ".auth");
const PERSISTENT_ROLES = ["manager", "member", "solo", "outsider"] as const;
// Leftovers of a killed run are swept once they are this old. A one-off sweep can shorten it (e.g. PDA_QA_STALE_AFTER="1 minutes") when no other run is going.
const STALE_AFTER = /^\d{1,3} (minutes|hours)$/.test(process.env.PDA_QA_STALE_AFTER ?? "") ? process.env.PDA_QA_STALE_AFTER! : "3 hours";
const QA_EMAIL = "^meeting-[0-9a-f-]{36}@example\\.test$";
const QA_NICKNAME = "^meeting-(manager|member|solo|outsider)-[0-9a-f]{8}$";

const runId = () => process.env.PDA_QA_RUN ?? `process-${process.pid}`;
const ledger = (id = runId()) => path.join(AUTH, `qa-run-${id.replace(/[^A-Za-z0-9-]/g, "")}.ids`);

/** Called by the fixture the moment a fresh account exists, so it is cleaned up even when the test that made it fails. */
export function registerQaAccount(id: string) { appendFileSync(ledger(), `${uuid(id)}\n`); }

function persistentIds(): string[] {
  return PERSISTENT_ROLES.flatMap(role => {
    const file = path.join(AUTH, `meeting-${role}-user.json`);
    return existsSync(file) ? [uuid((JSON.parse(readFileSync(file, "utf8")) as { id: string }).id)] : [];
  });
}

/** Removes the accounts of this run (and stale ones of dead runs) with everything that only exists because of them. Returns how many accounts went. */
export function cleanupQaAccounts(): number {
  const own = existsSync(ledger()) ? readFileSync(ledger(), "utf8").split("\n").filter(Boolean).map(uuid) : [];
  const keep = persistentIds().map(id => `'${id}'`).join(",") || "'00000000-0000-0000-0000-000000000000'";
  const ownList = own.map(id => `'${id}'`).join(",") || "'00000000-0000-0000-0000-000000000000'";
  const removed = psql(`BEGIN;
CREATE TEMP TABLE qa ON COMMIT DROP AS SELECT id FROM users
  WHERE email ~ '${QA_EMAIL}' AND nickname ~ '${QA_NICKNAME}' AND id NOT IN (${keep})
    AND (id IN (${ownList}) OR created_at < now() - interval '${STALE_AFTER}');
CREATE TEMP TABLE qa_projects ON COMMIT DROP AS SELECT id FROM projects WHERE created_by IN (SELECT id FROM qa);
DELETE FROM meetings WHERE organizer_id IN (SELECT id FROM qa);
DELETE FROM meeting_attendees WHERE user_id IN (SELECT id FROM qa);
DELETE FROM meeting_participants WHERE user_id IN (SELECT id FROM qa);
DELETE FROM notifications WHERE recipient_user_id IN (SELECT id FROM qa);
DELETE FROM project_membership_roles WHERE membership_id IN (SELECT id FROM project_memberships WHERE user_id IN (SELECT id FROM qa));
DELETE FROM project_memberships WHERE user_id IN (SELECT id FROM qa);
DELETE FROM projects WHERE id IN (SELECT id FROM qa_projects);
DELETE FROM user_sessions WHERE user_id IN (SELECT id FROM qa);
DELETE FROM email_verification_challenges WHERE user_id IN (SELECT id FROM qa);
DELETE FROM password_reset_challenges WHERE user_id IN (SELECT id FROM qa);
DELETE FROM password_change_challenges WHERE user_id IN (SELECT id FROM qa);
DELETE FROM user_oauth_identities WHERE user_id IN (SELECT id FROM qa);
DELETE FROM account_deletion_requests WHERE user_id IN (SELECT id FROM qa);
WITH gone AS (DELETE FROM users WHERE id IN (SELECT id FROM qa) RETURNING id) SELECT count(*) FROM gone;
COMMIT;`).split("\n").filter(line => /^\d+$/.test(line)).at(-1) ?? "0";
  // The credential files of the accounts that are gone (their names carry no id, so match on the ones whose account no longer exists).
  for (const name of existsSync(AUTH) ? readdirSync(AUTH) : []) {
    if (!/^meeting-(manager|member|solo|outsider)-fresh-[0-9a-f]{8}\.json$/.test(name)) continue;
    const file = path.join(AUTH, name);
    try {
      const { id } = JSON.parse(readFileSync(file, "utf8")) as { id: string };
      if (psql(`SELECT count(*) FROM users WHERE id='${uuid(id)}'`) === "0") rmSync(file);
    } catch { /* unreadable or half-written: leave it for the next run */ }
  }
  if (existsSync(ledger())) rmSync(ledger());
  return Number(removed);
}
