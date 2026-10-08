import { execFileSync } from "node:child_process";
import path from "node:path";

/** Fresh QA UUID-only PostgreSQL read, outside the application cache/ORM. */
export function bannerInDatabase(id: string): { rows: number; bytes: number; version: boolean } {
 if (!/^[a-f0-9-]{36}$/.test(id)) throw Error("Invalid QA project UUID");
 const cid = execFileSync("docker", ["compose", "ps", "-q", "postgres"], { cwd: path.resolve(__dirname, "../.."), encoding: "utf8" }).trim();
 const command: string[] = JSON.parse(execFileSync("docker", ["inspect", "--format", "{{json .Config.Cmd}}", cid], { encoding: "utf8" }));
 const port = command[command.indexOf("-p") + 1];
 const sql = `PREPARE qa_banner(uuid) AS SELECT json_build_object('rows',(SELECT count(*) FROM project_banners WHERE project_id=$1),'bytes',COALESCE((SELECT octet_length(data) FROM project_banners WHERE project_id=$1),0),'version',banner_updated_at IS NOT NULL) FROM projects WHERE id=$1;EXECUTE qa_banner('${id}');`;
 return JSON.parse(execFileSync("docker", ["exec", cid, "sh", "-c", 'psql -p "$1" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -qAtc "$2"', "qa", port, sql], { encoding: "utf8" }).trim());
}
