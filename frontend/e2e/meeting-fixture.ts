import { randomBytes, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { psql, uuid } from "./db";

/** TEST-ONLY local accounts: no registration request, outgoing email, or change to an existing user's credentials. */
export function meetingAccount(role: "manager" | "member") {
  const directory = path.join(__dirname, ".auth"); mkdirSync(directory, { recursive: true });
  const file = path.join(directory, `meeting-${role}-user.json`);
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
  writeFileSync(file, JSON.stringify({ id, email, password })); return file;
}
