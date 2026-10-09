// A portable 503 document for a host/proxy to serve when Next.js itself is unavailable.
// No external JavaScript, image, font, backend or session dependency.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const css = fs.readFileSync(path.join(root, "src/app/globals.css"), "utf8");
const names = ["background", "foreground", "muted-foreground", "primary", "primary-foreground", "border", "ring"];
function tokens(selector) {
  const start = css.indexOf(selector + " {");
  if (start < 0) throw new Error("Missing palette: " + selector);
  const block = css.slice(start, css.indexOf("}", start));
  return names.map(name => {
    const value = block.match(new RegExp("--" + name + ":\\s*([^;]+);"))?.[1];
    if (!value) throw new Error("Missing token: " + name);
    return `--${name}:${value};`;
  }).join("");
}
const copies = Object.fromEntries(["tr", "en", "de"].map(locale => [locale, JSON.parse(fs.readFileSync(path.join(root, "src/i18n/errors", locale + ".json"), "utf8"))]));
const escape = value => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
const tr = copies.tr;
const html = `<!doctype html>
<html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>503 · PDA</title>
<script>try{var theme=localStorage.getItem('theme');if(theme==='light'||theme==='dark')document.documentElement.dataset.theme=theme;}catch{}</script>
<style>
:root{${tokens(":root")}color-scheme:light;}html[data-theme=dark]{${tokens(".dark")}color-scheme:dark;}
@media(prefers-color-scheme:dark){html:not([data-theme=light]){${tokens(".dark")}color-scheme:dark;}}
*{box-sizing:border-box;}body{margin:0;background:var(--background);color:var(--foreground);font-family:system-ui,sans-serif;}a{color:inherit;}button,a{cursor:pointer;}a:focus-visible,button:focus-visible{outline:2px solid var(--ring);outline-offset:4px;}
header{max-width:1152px;margin:auto;padding:24px;}header a{display:inline-flex;align-items:center;min-height:44px;text-decoration:none;font-size:18px;font-weight:600;}
main{min-height:75dvh;display:flex;align-items:center;padding:24px;}section{width:100%;max-width:1024px;margin:auto;display:grid;grid-template-columns:.9fr 1.1fr;gap:64px;align-items:center;padding:40px 0;}
.code{text-align:center;font:600 clamp(6rem,18vw,12rem)/1 ui-monospace,monospace;letter-spacing:-.08em;border-right:1px solid var(--border);padding:40px 48px 40px 0;}.label{font-size:12px;color:var(--muted-foreground);}.copy{min-width:0;}h1{font-size:clamp(30px,4vw,40px);line-height:1.15;letter-spacing:-.02em;margin:12px 0 16px;}p{line-height:1.75;color:var(--muted-foreground);}aside{border-left:2px solid var(--primary);padding-left:16px;margin:24px 0;}h2{font-size:14px;margin:0;}aside p{font-size:14px;margin:4px 0;}.actions{display:flex;flex-wrap:wrap;gap:12px;margin-top:32px;}.action{min-height:44px;padding:12px 20px;border:1px solid var(--border);border-radius:10px;font:500 14px/20px system-ui,sans-serif;text-decoration:none;background:transparent;color:var(--foreground);text-align:center;}.primary{background:var(--primary);color:var(--primary-foreground);border-color:var(--primary);}.contact{display:inline-flex;align-items:center;min-height:44px;margin-top:20px;font-size:14px;color:var(--muted-foreground);text-underline-offset:4px;}
@media(max-width:767px){section{grid-template-columns:1fr;gap:32px;}.code{border-right:0;border-bottom:1px solid var(--border);padding:0 0 32px;}}
</style></head><body><header><a href="/login">PDA · Project Delivery Assistant</a></header><main><section data-error-code="503" aria-labelledby="error-title"><div class="code" aria-hidden="true">503</div><div class="copy"><div class="label" data-copy="common.label">${escape(tr.common.label)}</div><h1 id="error-title" data-copy="503.title">${escape(tr["503"].title)}</h1><p data-copy="503.description">${escape(tr["503"].description)}</p><aside><h2 data-copy="common.next">${escape(tr.common.next)}</h2><p data-copy="503.hint">${escape(tr["503"].hint)}</p></aside><div class="actions"><button type="button" class="action primary" id="retry" data-copy="common.retry">${escape(tr.common.retry)}</button><a href="/dashboard" class="action" data-copy="common.home">${escape(tr.common.home)}</a></div><a href="mailto:pdassistant.info@gmail.com" class="contact" data-copy="common.contact">${escape(tr.common.contact)}</a></div></section></main>
<script>const copies=${JSON.stringify(copies).replaceAll("<", "\\u003c")};let locale='tr';try{const cookie=document.cookie.split('; ').find(row=>row.startsWith('NEXT_LOCALE='))?.split('=')[1];const language=(cookie||navigator.language.slice(0,2)).toLowerCase();if(copies[language])locale=language;}catch{}document.documentElement.lang=locale;document.querySelectorAll('[data-copy]').forEach(el=>{const [group,key]=el.dataset.copy.split('.');el.textContent=copies[locale][group][key];});document.getElementById('retry').addEventListener('click',()=>location.reload());</script>
</body></html>
`;
const output = path.join(root, "public/errors/503.html");
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, html, "utf8");
console.log("Portable maintenance page generated: public/errors/503.html");
