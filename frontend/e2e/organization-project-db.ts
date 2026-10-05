import { execFileSync } from "node:child_process";
import path from "node:path";

/** Real QA-only PostgreSQL read; no credentials or user-chosen SQL is exposed. */
export function projectOrganizationInDatabase(id: string): string | null {
  if (!/^[a-f0-9-]{36}$/.test(id)) throw new Error("Invalid QA UUID");
  const cwd = path.resolve(__dirname, "../..");
  const cid = execFileSync("docker", ["compose", "ps", "-q", "postgres"], { cwd, encoding: "utf8" }).trim();
  const command: string[] = JSON.parse(execFileSync("docker", ["inspect", "--format", "{{json .Config.Cmd}}", cid], { encoding: "utf8" }));
  const port = command[command.indexOf("-p") + 1];
  const sql = `PREPARE qa_relation(uuid) AS SELECT coalesce(organization_id::text,'NULL') FROM projects WHERE id=$1; EXECUTE qa_relation('${id}');`;
  const value = execFileSync("docker", ["exec", cid, "sh", "-c", 'psql -p "$1" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -qAtc "$2"', "qa", port, sql], { encoding: "utf8" }).trim();
  if (!value) throw new Error("QA project missing from PostgreSQL");
  return value === "NULL" ? null : value;
}
