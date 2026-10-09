import { execFileSync } from "node:child_process";
import path from "node:path";

/**
 * TEST-ONLY read/seed access to the local PostgreSQL container, outside the application. It runs psql inside the
 * container with the container's own POSTGRES_USER/POSTGRES_DB, so no credential is read or logged here.
 */
export function psql(sql: string): string {
  const cid = execFileSync("docker", ["compose", "ps", "-q", "postgres"], { cwd: path.resolve(__dirname, "../.."), encoding: "utf8" }).trim();
  if (!cid) throw new Error("The postgres container is not running");
  const args: string[] = JSON.parse(execFileSync("docker", ["inspect", "--format", "{{json .Config.Cmd}}", cid], { encoding: "utf8" }));
  const port = args.includes("-p") ? args[args.indexOf("-p") + 1] : "5432";
  return execFileSync("docker", ["exec", cid, "sh", "-c", 'psql -p "$1" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -qAtc "$2"', "qa", port, sql], { encoding: "utf8" }).trim();
}

const UUID = /^[a-f0-9-]{36}$/i;
export function uuid(value: string): string {
  if (!UUID.test(value)) throw new Error("Invalid QA UUID");
  return value;
}

export type AnalyticsSessionRow = {
  visitor_id: string;
  entry_path: string;
  source_type: string;
  referrer_domain: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  engaged_seconds: number;
  page_views: number;
  consent_version: number;
  views: string[];
};

/** The analytics session and its page views as stored in PostgreSQL, or null when there is no such session. */
export function analyticsSession(sessionId: string): AnalyticsSessionRow | null {
  const out = psql(`SELECT row_to_json(t) FROM (
    SELECT s.visitor_id, s.entry_path, s.source_type, s.referrer_domain, s.utm_source, s.utm_medium, s.utm_campaign,
           s.engaged_seconds, s.page_views, s.consent_version,
           COALESCE((SELECT json_agg(v.path ORDER BY v.occurred_at, v.path) FROM analytics_page_views v WHERE v.session_id = s.id), '[]'::json) AS views
    FROM analytics_sessions s WHERE s.id = '${uuid(sessionId)}') t`);
  return out ? (JSON.parse(out) as AnalyticsSessionRow) : null;
}

/** Makes this test's own account an administrator. Test-only and local: the application has no such endpoint. */
export function promoteToAdmin(email: string) {
  if (!/^[A-Za-z0-9._+-]+@[A-Za-z0-9.-]+$/.test(email)) throw new Error("Invalid QA email");
  const changed = psql(`WITH changed AS (UPDATE users SET global_role = 'ADMIN' WHERE email = '${email}' RETURNING id) SELECT count(*) FROM changed`);
  if (changed !== "1") throw new Error("Expected to promote exactly one test account");
}
