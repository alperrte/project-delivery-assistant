import { execFileSync } from "node:child_process";
import path from "node:path";

/** Fresh prepared QA UUID read, outside the application ORM/cache. No auth or tokens are returned. */
export function notificationInDatabase(userId: string, id: string) {
  if (![userId, id].every(value => /^[a-f0-9-]{36}$/.test(value))) throw Error("Invalid QA UUID");
  const cid = execFileSync("docker", ["compose", "ps", "-q", "postgres"], { cwd: path.resolve(__dirname, "../.."), encoding: "utf8" }).trim();
  const args: string[] = JSON.parse(execFileSync("docker", ["inspect", "--format", "{{json .Config.Cmd}}", cid], { encoding: "utf8" }));
  const port = args.includes("-p") ? args[args.indexOf("-p") + 1] : "5432";
  const sql = `PREPARE notification_qa(uuid,uuid) AS SELECT jsonb_build_object('rowCount',count(*),'read',bool_and(is_read),'readAt',max(read_at),'presentedAt',max(popup_presented_at),'unreadCount',(SELECT count(*) FROM notifications WHERE recipient_user_id=$1 AND is_read=false)) FROM notifications WHERE recipient_user_id=$1 AND id=$2; EXECUTE notification_qa('${userId}','${id}');`;
  return JSON.parse(execFileSync("docker", ["exec", cid, "sh", "-c", 'psql -p "$1" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -qAtc "$2"', "qa", port, sql], { encoding: "utf8" }).trim()) as {
    rowCount: number; read: boolean; readAt: string | null; presentedAt: string | null; unreadCount: number;
  };
}

/** TEST-ONLY legacy nullable snapshot on this test's own newly created invitation notification. */
export function clearQaInvitationContext(userId: string, id: string) {
 if (![userId,id].every(value=>/^[a-f0-9-]{36}$/.test(value))) throw Error("Invalid QA UUID");
 const cid=execFileSync("docker",["compose","ps","-q","postgres"],{cwd:path.resolve(__dirname,"../.."),encoding:"utf8"}).trim();
 const command:string[]=JSON.parse(execFileSync("docker",["inspect","--format","{{json .Config.Cmd}}",cid],{encoding:"utf8"}));
 const port=command.includes("-p")?command[command.indexOf("-p")+1]:"5432";
 const sql=`PREPARE qa_legacy_context(uuid,uuid) AS WITH changed AS (UPDATE notifications SET invitation_project_name=NULL WHERE recipient_user_id=$1 AND id=$2 AND type IN ('PROJECT_INVITATION_CREATED','PROJECT_INVITATION_ACCEPTED','PROJECT_INVITATION_REJECTED') RETURNING id) SELECT count(*) FROM changed;EXECUTE qa_legacy_context('${userId}','${id}');`;
 const count=execFileSync("docker",["exec",cid,"sh","-c",'psql -p "$1" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -qAtc "$2"',"qa",port,sql],{encoding:"utf8"}).trim();
 if(Number(count)!==1) throw Error("QA legacy context must affect exactly one owned invitation notification");
}
