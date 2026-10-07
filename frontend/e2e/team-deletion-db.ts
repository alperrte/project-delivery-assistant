import { execFileSync } from "node:child_process";
import path from "node:path";

function uuid(value: string) {
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(value)) throw Error("Invalid QA UUID");
  return value;
}
/** Fresh physical reads of this test's own UUIDs, outside ORM and frontend caches. */
export function teamDeletionInDatabase(teamId: string, userId: string): { deleted: boolean; memberRows: number; notifications: number; presented: number } {
  const cid = execFileSync("docker", ["compose", "ps", "-q", "postgres"], { cwd: path.resolve(__dirname, "../.."), encoding: "utf8" }).trim();
  const command: string[] = JSON.parse(execFileSync("docker", ["inspect", "--format", "{{json .Config.Cmd}}", cid], { encoding: "utf8" }));
  const port = command.indexOf("-p") >= 0 ? command[command.indexOf("-p") + 1] : "5432";
  const sql = `PREPARE team_qa_read(uuid,uuid) AS SELECT json_build_object('deleted',archived_at IS NOT NULL,'memberRows',
    (SELECT count(*) FROM squad_members WHERE squad_id=$1),'notifications',
    (SELECT count(*) FROM notifications WHERE resource_id=$1 AND recipient_user_id=$2 AND type='SQUAD_DELETED'),'presented',
    (SELECT count(*) FROM notifications WHERE resource_id=$1 AND recipient_user_id=$2 AND type='SQUAD_DELETED' AND popup_presented_at IS NOT NULL))
    FROM squads WHERE id=$1; EXECUTE team_qa_read('${uuid(teamId)}','${uuid(userId)}');`;
  return JSON.parse(execFileSync("docker", ["exec", cid, "sh", "-c", 'psql -p "$1" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -qAtc "$2"', "qa", port, sql], { encoding: "utf8" }).trim());
}

/** Only the QA user's safe display fields; no account credentials are selected. */
export function memberIdentityInDatabase(userId: string): { firstName: string | null; lastName: string | null; hasPhoto: boolean } {
  const cid = execFileSync("docker", ["compose", "ps", "-q", "postgres"], { cwd: path.resolve(__dirname, "../.."), encoding: "utf8" }).trim();
  const command: string[] = JSON.parse(execFileSync("docker", ["inspect", "--format", "{{json .Config.Cmd}}", cid], { encoding: "utf8" }));
  const port = command.indexOf("-p") >= 0 ? command[command.indexOf("-p") + 1] : "5432";
  const sql = `PREPARE member_qa_read(uuid) AS SELECT json_build_object('firstName',first_name,'lastName',last_name,'hasPhoto',profile_photo_updated_at IS NOT NULL) FROM users WHERE id=$1; EXECUTE member_qa_read('${uuid(userId)}');`;
  return JSON.parse(execFileSync("docker", ["exec", cid, "sh", "-c", 'psql -p "$1" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -qAtc "$2"', "qa", port, sql], { encoding: "utf8" }).trim());
}
