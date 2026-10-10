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

/** Every message addressed to one recipient, newest first. */
export async function mailsTo(address: string): Promise<MailpitMessage[]> {
  return mailsContaining(`to:"${address}"`);
}

/**
 * The 6-digit code of the newest mail to `address`, once more than `alreadySeen` mails have arrived there. Pass the
 * count from before triggering a new mail, so an earlier code is never picked up by mistake.
 */
export async function waitForCode(address: string, alreadySeen = 0, timeoutMs = 20_000): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const mails = await mailsTo(address);
    if (mails.length > alreadySeen) {
      const code = /\b(\d{6})\b/.exec(mails[0].Text)?.[1];
      if (code) return code;
    }
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  throw new Error(`No code mail for ${address} within ${timeoutMs} ms`);
}

export async function mailpitAvailable(): Promise<boolean> {
  try {
    return (await fetch(`${MAILPIT}/livez`)).ok;
  } catch {
    return false;
  }
}
