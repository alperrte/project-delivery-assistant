/**
 * Content-Security-Policy of every page. The proxy (`src/proxy.ts`) builds a fresh policy with a per-request nonce:
 * Next.js reads the nonce from the request's own `Content-Security-Policy` header and stamps it on its inline and
 * framework scripts; the layout hands the same nonce (`x-nonce`) to the scripts it writes itself and to next-themes.
 *
 * - `script-src`: nonce + `strict-dynamic` only. No `unsafe-inline`; `unsafe-eval` is added in development alone
 *   (React's debug tooling needs it). No third-party script origin exists in PDA.
 * - `style-src` keeps `unsafe-inline`: React `style={}` attributes and the animation libraries write inline styles.
 *   Styles cannot run code, and the script policy is the part that stops XSS.
 * - `connect-src`/`img-src` name the API origin (`NEXT_PUBLIC_API_URL`), including its WebSocket twin for the chat.
 * - `frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'` close clickjacking, plugin,
 *   base-tag and form-hijack routes. `upgrade-insecure-requests` only when `NEXT_PUBLIC_SITE_URL` is an https address (on http it would break the page).
 */

const DEFAULT_API_URL = "http://localhost:8080/api/v1";

/** `scheme://host[:port]` of the API and its WebSocket twin (`ws://` or `wss://`). */
export function apiOrigins(apiUrl: string | undefined = process.env.NEXT_PUBLIC_API_URL): string[] {
  try {
    const url = new URL(apiUrl ?? DEFAULT_API_URL);
    const socket = `${url.protocol === "https:" ? "wss:" : "ws:"}//${url.host}`;
    return [url.origin, socket];
  } catch {
    return [];
  }
}

export function buildCsp(nonce: string, options: { development?: boolean } = {}): string {
  const development = options.development ?? process.env.NODE_ENV !== "production";
  const [apiOrigin, apiSocket] = apiOrigins();
  const api = [apiOrigin, apiSocket].filter(Boolean);
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'", ...(development ? ["'unsafe-eval'"] : [])],
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:", ...(apiOrigin ? [apiOrigin] : [])],
    "font-src": ["'self'"],
    "connect-src": ["'self'", ...api, ...(development ? ["ws:", "http:"] : [])],
    "worker-src": ["'self'"],
    "manifest-src": ["'self'"],
    "media-src": ["'self'"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
  };
  const policy = Object.entries(directives).map(([name, values]) => `${name} ${values.join(" ")}`);
  // Only for a site that is declared https (NEXT_PUBLIC_SITE_URL): on plain http (localhost in WebKit, a LAN install) the
  // upgrade would turn every script, style and font request into a https request nobody answers and break the whole page.
  if (!development && (process.env.NEXT_PUBLIC_SITE_URL ?? "").startsWith("https://")) policy.push("upgrade-insecure-requests");
  return policy.join("; ");
}

/** A fresh, unguessable value for one response (128 bits, base64). */
export function createNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}
