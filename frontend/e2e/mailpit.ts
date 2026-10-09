/**
 * The throw-away SMTP sink of the end-to-end stack (docker-compose.e2e.yml). The backend delivers real mail to it
 * through its normal SMTP code path; these helpers only READ what arrived. Nothing here can send a message.
 */
const MAILPIT = process.env.E2E_MAILPIT_URL ?? "http://localhost:8025";

export type MailpitAddress = { Name: string; Address: string };
export type MailpitMessage = {
  ID: string;
  Subject: string;
  From: MailpitAddress;
  To: MailpitAddress[];
  Cc: MailpitAddress[];
  Bcc: MailpitAddress[];
  ReplyTo: MailpitAddress[];
  Text: string;
  Created: string;
};

type Summary = { ID: string };

async function json<T>(path: string): Promise<T> {
  const response = await fetch(`${MAILPIT}${path}`);
  if (!response.ok) throw new Error(`Mailpit ${path} answered ${response.status}`);
  return (await response.json()) as T;
}

/** Full messages whose text contains the marker, newest first. */
export async function mailsContaining(marker: string): Promise<MailpitMessage[]> {
  const found = await json<{ messages: Summary[] }>(`/api/v1/search?query=${encodeURIComponent(marker)}&limit=50`);
  return Promise.all(found.messages.map((summary) => json<MailpitMessage>(`/api/v1/message/${summary.ID}`)));
}

export async function mailpitAvailable(): Promise<boolean> {
  try {
    return (await fetch(`${MAILPIT}/livez`)).ok;
  } catch {
    return false;
  }
}
