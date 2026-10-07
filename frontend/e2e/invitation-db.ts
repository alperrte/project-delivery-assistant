import {execFileSync} from "node:child_process";
import path from "node:path";

function uuid(value:string){if(!/^[a-f0-9-]{36}$/.test(value))throw Error("Invalid QA UUID");return value;}
function query(sql:string) {
 const cid=execFileSync("docker",["compose","ps","-q","postgres"],{cwd:path.resolve(__dirname,"../.."),encoding:"utf8"}).trim();
 const command:string[]=JSON.parse(execFileSync("docker",["inspect","--format","{{json .Config.Cmd}}",cid],{encoding:"utf8"}));const port=command[command.indexOf("-p")+1];
 return execFileSync("docker",["exec",cid,"sh","-c",'psql -p "$1" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -qAtc "$2"',"qa",port,sql],{encoding:"utf8"}).trim();
}
/** TEST-ONLY expiry of this test's own invitation ID. The server clock and policies stay unchanged. */
export function expireQaInvitation(id:string){query(`PREPARE qa_exp(uuid) AS UPDATE project_invitations SET expires_at=now()-interval '1 minute' WHERE id=$1;EXECUTE qa_exp('${uuid(id)}');`);}
/** TEST-ONLY page-boundary dataset cloned from the test's actual external invitation.
 * No token is usable, no membership is granted; normal create/mutation scenarios use the real API.
 * This avoids weakening the existing ten-create quota just to seed a 21-row page. */
export function seedQaInvitationPage(templateId: string) {
 const count = query(`PREPARE qa_page(uuid) AS WITH added AS (
 INSERT INTO project_invitations(id,project_id,email,invitee_first_name,invitee_last_name,invited_by,token_hash,status,created_at,expires_at,team_id)
 SELECT gen_random_uuid(),i.project_id,'e2e-page-'||gen_random_uuid()||'@example.test','Pagination','Page',i.invited_by,md5(gen_random_uuid()::text)||md5(gen_random_uuid()::text),'PENDING',now(),now()+interval '7 days',i.team_id
 FROM project_invitations i CROSS JOIN generate_series(1,20) WHERE i.id=$1 AND i.email LIKE 'e2e-page-template-%@example.test' RETURNING id),
 roles AS (INSERT INTO project_invitation_roles(invitation_id,role) SELECT id,'TESTER' FROM added RETURNING invitation_id) SELECT count(*) FROM roles;
 EXECUTE qa_page('${uuid(templateId)}');`);
 if (Number(count) !== 20) throw Error("QA invitation page fixture did not insert exactly20 rows");
}
export function invitationInDatabase(id:string,userId:string):{status:string;membership:string|null;roles:string[]|null;teamRows:number} {
 return JSON.parse(query(`PREPARE qa_read(uuid,uuid) AS SELECT json_build_object('status',i.status,'membership',(SELECT status FROM project_memberships WHERE project_id=i.project_id AND user_id=$2),'roles',(SELECT json_agg(r.role ORDER BY r.role) FROM project_membership_roles r JOIN project_memberships m ON m.id=r.membership_id WHERE m.project_id=i.project_id AND m.user_id=$2),'teamRows',(SELECT count(*) FROM squad_members sm JOIN project_memberships m ON m.id=sm.project_membership_id WHERE sm.squad_id=i.team_id AND m.user_id=$2)) FROM project_invitations i WHERE i.id=$1;EXECUTE qa_read('${uuid(id)}','${uuid(userId)}');`));
}
