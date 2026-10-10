import { createHmac } from "node:crypto";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Decode(value: string): Buffer {
  const bytes: number[] = [];
  let bits = 0;
  let acc = 0;
  for (const char of value.replace(/[\s=-]/g, "").toUpperCase()) {
    const index = ALPHABET.indexOf(char);
    if (index < 0) throw new Error("Not a base32 character");
    acc = (acc << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((acc >> bits) & 0xff);
    }
  }
  return Buffer.from(bytes);
}

/**
 * The 6-digit authenticator code (RFC 6238: HMAC-SHA1, 30 second steps) for a base32 secret, `stepOffset` steps from
 * now. The server accepts one step either side and never accepts a step it already used, so a test that needs a
 * second code in the same window asks for the next step.
 */
export function totpCode(secret: string, stepOffset = 0, nowMs = Date.now()): string {
  const counter = Math.floor(nowMs / 30_000) + stepOffset;
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac("sha1", base32Decode(secret)).update(message).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary = hmac.readUInt32BE(offset) & 0x7fffffff;
  return String(binary % 1_000_000).padStart(6, "0");
}
