// Generates the animated README SVGs (CSS animations only: GitHub renders them through <img>, no scripts).
// Base state of every element is the FINAL state, so prefers-reduced-motion (animation: none) shows a readable still.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const OUT = process.argv[2];
mkdirSync(OUT, { recursive: true });

const FONT = "system-ui,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const MONO = "ui-monospace,SFMono-Regular,'SF Mono',Menlo,Consolas,'Liberation Mono',monospace";
const K = {
  bg0: "#060a14", bg1: "#0e1730", panel: "#111b33", panel2: "#17233f", line: "#25325a",
  text: "#e9eefb", mute: "#8a98b8", blue: "#4c8dff", blue2: "#8bb8ff",
  green: "#35d39b", amber: "#f5b94a", red: "#ff6b81", term: "#0a1020",
};
const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const tw = (s, size, k = 0.56) => s.length * size * k;

const T = (x, y, s, o = {}) => {
  const { size = 16, fill = K.text, weight = 400, anchor = "start", font = FONT, ls, cls } = o;
  return `<text x="${x}" y="${y}" font-size="${size}" fill="${fill}" font-weight="${weight}" text-anchor="${anchor}" font-family="${font}"${ls ? ` letter-spacing="${ls}"` : ""}${cls ? ` class="${cls}"` : ""}>${esc(s)}</text>`;
};
const R = (x, y, w, h, r, fill, stroke, sw = 1, extra = "") =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}"${stroke ? ` stroke="${stroke}" stroke-width="${sw}"` : ""}${extra ? " " + extra : ""}/>`;
const C = (cx, cy, r, fill, extra = "") => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}"${extra ? " " + extra : ""}/>`;
const G = (cls, inner, style = "") => `<g class="${cls}"${style ? ` style="${style}"` : ""}>${inner}</g>`;
const avatar = (cx, cy, r, txt, fill) =>
  C(cx, cy, r, fill) + T(cx, cy + r * 0.36, txt, { size: r * 0.95, weight: 700, anchor: "middle", fill: "#06101f" });

function scene(w, h) {
  const css = [];
  const defs = [];
  const out = [];
  let n = 0;
  const pct = (x, Tt) => Math.min(100, +((x / Tt) * 100).toFixed(2));
  return {
    css, defs, out, w, h,
    add(x) { out.push(x); },
    // Visible between tIn and tOut inside a loop of T seconds.
    seq(Tt, tIn, tOut, from = "translateY(12px)", f = 0.45) {
      n += 1;
      const a = pct(tIn, Tt), b = pct(tIn + f, Tt), c = pct(Math.min(tOut, Tt), Tt), d = pct(tOut + f, Tt);
      css.push(`@keyframes s${n}{0%,${a}%{opacity:0;transform:${from}}${b}%,${c}%{opacity:1;transform:none}${d}%,100%{opacity:0;transform:${from}}}`);
      css.push(`.s${n}{animation:s${n} ${Tt}s infinite both cubic-bezier(.22,1,.36,1);transform-box:fill-box;transform-origin:center}`);
      return `s${n}`;
    },
    // Free-form keyframes.
    kf(Tt, frames, timing = "linear") {
      n += 1;
      css.push(`@keyframes s${n}{${frames}}`);
      css.push(`.s${n}{animation:s${n} ${Tt}s infinite both ${timing};transform-box:fill-box;transform-origin:center}`);
      return `s${n}`;
    },
    svg(title, desc, extraCss = "") {
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-labelledby="t d"><title id="t">${esc(title)}</title><desc id="d">${esc(desc)}</desc><defs>${defs.join("")}</defs><style>
.fl{animation:fl 5s ease-in-out infinite alternate}
@keyframes fl{from{transform:translateY(0)}to{transform:translateY(-7px)}}
.bn{animation:bn 1.1s ease-in-out infinite}
@keyframes bn{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-5px)}}
.pl{animation:pl 1.8s ease-in-out infinite}
@keyframes pl{0%,100%{opacity:.35}50%{opacity:1}}
.ring{animation:ring 1.7s ease-out infinite;transform-box:fill-box;transform-origin:center}
@keyframes ring{0%{transform:scale(.92);opacity:.85}100%{transform:scale(1.4);opacity:0}}
.br{animation:br 6s ease-in-out infinite;transform-box:fill-box;transform-origin:center}
@keyframes br{0%,100%{transform:scale(1);opacity:.55}50%{transform:scale(1.12);opacity:.9}}
.cur{animation:cur 1s steps(1) infinite}
@keyframes cur{50%{opacity:0}}
${css.join("\n")}${extraCss}
@media (prefers-reduced-motion:reduce){*{animation:none!important}}
</style>${out.join("")}</svg>`;
    },
  };
}

// Dark rounded stage with a soft glow, shared by every scene.
function stage(s, glow = true) {
  s.defs.push(
    `<linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${K.bg1}"/><stop offset="1" stop-color="${K.bg0}"/></linearGradient>`,
    `<radialGradient id="gl" cx="50%" cy="0%" r="75%"><stop offset="0" stop-color="${K.blue}" stop-opacity=".34"/><stop offset="1" stop-color="${K.blue}" stop-opacity="0"/></radialGradient>`,
    `<linearGradient id="tx" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${K.blue2}"/><stop offset="1" stop-color="${K.green}"/></linearGradient>`,
    `<pattern id="dots" width="26" height="26" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1" fill="#ffffff" fill-opacity=".05"/></pattern>`,
    `<clipPath id="cl"><rect width="${s.w}" height="${s.h}" rx="20"/></clipPath>`,
  );
  s.add(`<g clip-path="url(#cl)">${R(0, 0, s.w, s.h, 0, "url(#bg)")}${R(0, 0, s.w, s.h, 0, "url(#dots)")}${glow ? `<g class="br">${R(0, 0, s.w, s.h * 0.7, 0, "url(#gl)")}</g>` : ""}</g>`);
  s.add(R(0.5, 0.5, s.w - 1, s.h - 1, 20, "none", K.line));
}

const L = {
  tr: {
    eyebrow: "AÇIK KAYNAK · SELF-HOSTED · APACHE 2.0",
    h1: "Görev, sohbet, toplantı ve kod.", h2: "Tek çalışma alanında.",
    lead: "Hepsi PDA’da:", words: ["toplantı", "sohbet", "görev", "repo"],
    heroTitle: "PDA: görev, sohbet, toplantı ve kod tek çalışma alanında",
    heroDesc: "Animasyonlu başlık: PDA'da toplantı, sohbet, görev ve repo bir arada.",
    chipMeet: "TOPLANTI", chipChat: "SOHBET", chipTask: "GÖREV", chipGit: "GITHUB",
    live: "CANLI", sprint: "Sprint planlama", chatMsg: "Giriş akışı hazır.", taskName: "Giriş akışını tasarla", done: "Tamamlandı", commit: "Misafir bağlantısı ekle", newCommit: "yeni commit",
    stackA: "4 sekme. 4 abonelik. 4 giriş.", stackB: "Hepsi tek yerde.",
    tools: ["Görev takibi", "Mesajlaşma", "Görüntülü toplantı", "Kod takibi"],
    stackTitle: "Dört ayrı araç PDA'da birleşir", stackDesc: "Görev takibi, mesajlaşma, görüntülü toplantı ve kod takibi araçları tek PDA çalışma alanında birleşir.",
    meetTitle: "Toplantı: projeye bağlı, bağımsız ve misafirli", meetDesc: "Canlı bir proje toplantısı, bağımsız bir toplantı, kopyalanan misafir bağlantısı ve odaya hesapsız katılan bir misafir.",
    meetings: "TOPLANTILAR", meetProj: "PDA Öğrenci Platformu · Proje toplantısı", join: "Katıl", retro: "Retrospektif", standalone: "Bağımsız toplantı",
    guestLink: "Misafir bağlantısı", copy: "Kopyala", copied: "Kopyalandı", guest: "Misafir", guestJoined: "Misafir katıldı", leave: "Ayrıl",
    chatT: "Proje sohbeti, özel mesaj ve dosya paylaşımı", chatD: "Üç mesaj, bir PDF eki, bir tepki ve yazıyor göstergesi.",
    chatRoom: "PDA Öğrenci Platformu", tabGroup: "Proje grubu", tabDm: "Özel mesaj",
    m1: "Giriş akışı hazır, pull request’i açıyorum.", m2: "Test raporu ekte.", m3: "Harika, bugün birleştirelim.", file: "test-raporu.pdf", typing: "Ayşe yazıyor…", compose: "Mesaj yaz…",
    taskT: "Basit ve gelişmiş görev", taskD: "Görev formu basit modda başlık ve açıklama, gelişmiş modda sorumlular, öncelik, bitiş, tahmin ve alt görevlerle açılır.",
    newTask: "YENİ GÖREV", simple: "Basit", advanced: "Gelişmiş", fTitle: "Başlık", fDesc: "Açıklama", taskVal: "Landing page deneyimini hazırla", descVal: "Giriş akışı, toplantı ve sohbet bölümlerini hazırla.",
    fAssign: "Sorumlular", fPrio: "Öncelik", prio: "Yüksek", fDue: "Bitiş", due: "30 Eki", fEst: "Tahmin", est: "8 sa · 5 puan", fSub: "Alt görevler", subs: ["Tasarım", "Kod", "Test"], extras: ["Sprint", "Kanban", "Takvim", "Hatırlatıcı"],
    repoT: "Basit ve gelişmiş GitHub takibi", repoD: "Temel modda ana daldaki son commit'ler, gelişmiş modda dallar ve birleştirilmemiş commit'ler; yeni commit bildirimi.",
    basic: "Temel", lastCommits: "main dalındaki son commit’ler", branches: "DALLAR", unmerged: "BİRLEŞTİRİLMEMİŞ COMMIT’LER", merged: "Birleştirildi", open: "Açık", toastT: "Yeni commit", notify: "Yeni commit gelince ekibe bildirim gider.",
    commits: ["Misafir bağlantısı ekle", "Sohbette dosya paylaşımı", "Pano sütun sırasını düzelt", "Depo ayarlarını bağla", "Giriş akışına test yaz"], when: ["2 dk", "1 sa", "3 sa", "dün", "dün"],
    orgT: "GitHub benzeri organizasyon", orgD: "Bir organizasyon profili ve altında üç proje kartı.", org: "Kodlama Kulübü", orgAbout: ["Öğrencilerin birlikte proje", "geliştirdiği topluluk."], orgLoc: "İstanbul", orgUpd: "Güncellendi: Bugün", orgProj: "3 proje",
    projects: ["PDA Öğrenci Platformu", "Mobil Uygulama", "Veri Analizi Ödevi"],
    termT: "Kendi sunucuna kurulum", termD: "Repoyu klonla, .env dosyasını hazırla, Docker ile backend ve veritabanını, npm ile frontend'i başlat.", termTitle: "Terminal", ready: "Hazır", termCap: "Apache 2.0 · Kendi sunucun, kendi verin.",
  },
  en: {
    eyebrow: "OPEN SOURCE · SELF-HOSTED · APACHE 2.0",
    h1: "Tasks, chat, meetings and code.", h2: "One workspace.",
    lead: "All in PDA:", words: ["meetings", "chat", "tasks", "repos"],
    heroTitle: "PDA: tasks, chat, meetings and code in one workspace",
    heroDesc: "Animated banner: meetings, chat, tasks and repos together in PDA.",
    chipMeet: "MEETING", chipChat: "CHAT", chipTask: "TASK", chipGit: "GITHUB",
    live: "LIVE", sprint: "Sprint planning", chatMsg: "Sign-in flow is ready.", taskName: "Design the sign-in flow", done: "Done", commit: "Add guest join link", newCommit: "new commit",
    stackA: "4 tabs. 4 subscriptions. 4 logins.", stackB: "All in one place.",
    tools: ["Task tracking", "Messaging", "Video meetings", "Code tracking"],
    stackTitle: "Four separate tools merge into PDA", stackDesc: "Task tracking, messaging, video meetings and code tracking merge into a single PDA workspace.",
    meetTitle: "Meetings: project-linked, standalone and with guests", meetDesc: "A live project meeting, a standalone meeting, a copied guest link and a guest joining the room without an account.",
    meetings: "MEETINGS", meetProj: "PDA Student Platform · Project meeting", join: "Join", retro: "Retrospective", standalone: "Standalone meeting",
    guestLink: "Guest link", copy: "Copy", copied: "Copied", guest: "Guest", guestJoined: "Guest joined", leave: "Leave",
    chatT: "Project chat, direct messages and file sharing", chatD: "Three messages, a PDF attachment, a reaction and a typing indicator.",
    chatRoom: "PDA Student Platform", tabGroup: "Project group", tabDm: "Direct message",
    m1: "The sign-in flow is ready, opening the pull request.", m2: "Test report is attached.", m3: "Great, let us merge it today.", file: "test-report.pdf", typing: "Ayşe is typing…", compose: "Write a message…",
    taskT: "Simple and advanced tasks", taskD: "The task form opens with a title and description in simple mode, and adds assignees, priority, due date, estimate and subtasks in advanced mode.",
    newTask: "NEW TASK", simple: "Simple", advanced: "Advanced", fTitle: "Title", fDesc: "Description", taskVal: "Prepare the landing page experience", descVal: "Prepare the sign-in, meeting and chat sections.",
    fAssign: "Assignees", fPrio: "Priority", prio: "High", fDue: "Due", due: "Oct 30", fEst: "Estimate", est: "8 h · 5 pts", fSub: "Subtasks", subs: ["Design", "Code", "Test"], extras: ["Sprint", "Kanban", "Calendar", "Reminders"],
    repoT: "Basic and advanced GitHub tracking", repoD: "Basic mode lists the latest commits on the main branch; advanced mode shows branches and unmerged commits; a new commit notification appears.",
    basic: "Basic", lastCommits: "Latest commits on main", branches: "BRANCHES", unmerged: "UNMERGED COMMITS", merged: "Merged", open: "Open", toastT: "New commit", notify: "The team is notified of every new commit.",
    commits: ["Add guest join link", "Share files in project chat", "Fix board column order", "Connect the repository settings", "Cover the sign-in flow with tests"], when: ["2 min", "1 h", "3 h", "1 d", "1 d"],
    orgT: "A GitHub-like organization", orgD: "An organization profile with three project cards under it.", org: "Coding Club", orgAbout: ["A community where students", "build projects together."], orgLoc: "Istanbul", orgUpd: "Updated: Today", orgProj: "3 projects",
    projects: ["PDA Student Platform", "Mobile App", "Data Analysis Course Project"],
    termT: "Set it up on your own server", termD: "Clone the repo, prepare .env, start the backend and database with Docker and the frontend with npm.", termTitle: "Terminal", ready: "Ready", termCap: "Apache 2.0 · Your server, your data.",
  },
};

// ---------------------------------------------------------------- hero
function hero(t) {
  const s = scene(1200, 520);
  stage(s);
  const P = 12;
  s.add(T(600, 70, t.eyebrow, { size: 13, anchor: "middle", fill: K.blue2, font: MONO, ls: 3 }));
  s.add(T(600, 150, t.h1, { size: 52, weight: 700, anchor: "middle", ls: -1 }));
  s.add(T(600, 214, t.h2, { size: 52, weight: 700, anchor: "middle", ls: -1, fill: "url(#tx)" }));
  s.add(T(560, 291, t.lead, { size: 24, anchor: "end", fill: K.mute }));
  s.add(R(580, 258, 230, 46, 23, K.panel, K.blue, 1.5));
  t.words.forEach((word, i) => {
    const seg = P / 4;
    const cls = s.seq(P, i * seg, (i + 1) * seg - 0.1, "translateY(10px)", 0.35);
    s.add(G(cls + (i ? " alt" : ""), T(695, 289, word, { size: 25, weight: 600, anchor: "middle", fill: K.blue2 })));
  });
  const cw = 252, ch = 116, y0 = 352, x0 = 60, gap = 24;
  const frame = (i, label, inner) => {
    const x = x0 + i * (cw + gap);
    return G("fl", R(x, y0, cw, ch, 14, K.panel2, K.line) + T(x + 16, y0 + 26, label, { size: 11, fill: K.mute, font: MONO, ls: 2 }) + inner(x, y0), `animation-delay:-${(i * 1.3).toFixed(1)}s`);
  };
  // 1 meeting
  s.add(frame(0, t.chipMeet, (x, y) =>
    `<g>${C(x + 22, y + 54, 9, K.red, 'class="ring"')}</g>${C(x + 22, y + 54, 5, K.red)}` +
    T(x + 38, y + 60, t.sprint, { size: 16, weight: 600 }) +
    avatar(x + 28, y + 90, 11, "AL", K.blue2) + avatar(x + 47, y + 90, 11, "HT", K.green) + avatar(x + 66, y + 90, 11, "AY", K.amber) +
    R(x + cw - 66, y + 78, 50, 22, 11, "#ff6b8126") + T(x + cw - 41, y + 93, t.live, { size: 11, anchor: "middle", fill: K.red, font: MONO, weight: 700 })));
  // 2 chat
  s.add(frame(1, t.chipChat, (x, y) =>
    R(x + 16, y + 40, cw - 32, 36, 13, "#4c8dff30") + T(x + 30, y + 63, t.chatMsg, { size: 14 }) +
    [0, 1, 2].map(i => `<g class="bn" style="animation-delay:${i * 0.18}s">${C(x + 30 + i * 13, y + 95, 3.5, K.mute)}</g>`).join("")));
  // 3 task
  s.add(frame(2, t.chipTask, (x, y) =>
    R(x + 16, y + 42, 22, 22, 6, K.green) +
    `<path d="M${x + 22} ${y + 53} l4 4 l8 -9" fill="none" stroke="#06101f" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="26" class="ck"/>` +
    T(x + 48, y + 59, t.taskName, { size: 15, weight: 500 }) +
    R(x + 16, y + 82, cw - 32, 6, 3, "#ffffff14") + `<g class="gr">${R(x + 16, y + 82, cw - 32, 6, 3, K.green)}</g>` +
    T(x + 16, y + 106, t.done, { size: 12, fill: K.green })));
  // 4 commit
  s.add(frame(3, t.chipGit, (x, y) =>
    T(x + 16, y + 54, "a1f3c9e", { size: 13, fill: K.blue2, font: MONO }) +
    T(x + 16, y + 78, t.commit, { size: 15 }) +
    T(x + 16, y + 102, "main", { size: 12, fill: K.mute, font: MONO }) +
    `<g class="pl">${C(x + cw - 100, y + 98, 3.5, K.green)}</g>` + T(x + cw - 90, y + 102, t.newCommit, { size: 12, fill: K.green })));
  return s.svg(t.heroTitle, t.heroDesc, `
.ck{animation:ck 4s ease-in-out infinite}
@keyframes ck{0%,10%{stroke-dashoffset:26}30%,100%{stroke-dashoffset:0}}
.gr{transform-box:fill-box;transform-origin:left;animation:gr 4s ease-in-out infinite}
@keyframes gr{0%,10%{transform:scaleX(.15)}40%,100%{transform:scaleX(1)}}
@media (prefers-reduced-motion:reduce){.alt{opacity:0}}`);
}

// ---------------------------------------------------------------- stack -> PDA
function stack(t) {
  const s = scene(1200, 360);
  stage(s);
  const P = 9;
  const cx = 600, cy = 205;
  const tools = [
    { x: 80, y: 110, c: K.amber }, { x: 80, y: 230, c: K.blue2 },
    { x: 910, y: 110, c: K.red }, { x: 910, y: 230, c: K.green },
  ];
  // connectors
  tools.forEach(tool => {
    const x1 = tool.x < 600 ? tool.x + 210 : tool.x, y1 = tool.y + 28;
    const cls = s.seq(P, 0.6, 2.9, "none", 0.4);
    s.add(G(cls + " alt", `<path d="M${x1} ${y1} L${cx} ${cy}" stroke="${K.line}" stroke-width="1.5" stroke-dasharray="5 6" fill="none"/>`));
  });
  tools.forEach((tool, i) => {
    const dx = cx - (tool.x + 105), dy = cy - (tool.y + 28);
    const fx = tool.x < 600 ? -70 : 70;
    const cls = s.kf(P,
      `0%{transform:translate(${fx}px,0);opacity:0}7%,28%{transform:none;opacity:1}38%{transform:translate(${dx}px,${dy}px) scale(.35);opacity:0}93%{transform:translate(${dx}px,${dy}px) scale(.35);opacity:0}93.01%{transform:none;opacity:0}100%{transform:none;opacity:1}`,
      "cubic-bezier(.22,1,.36,1)");
    s.add(G(cls + " alt",
      R(tool.x, tool.y, 210, 56, 14, K.panel2, K.line) + C(tool.x + 26, tool.y + 28, 7, tool.c) +
      T(tool.x + 44, tool.y + 34, t.tools[i], { size: 16, weight: 500 }), `animation-delay:${i * 0.12}s`));
  });
  const p1 = s.seq(P, 0.2, 3.0, "translateY(8px)");
  s.add(G(p1 + " alt", T(600, 62, t.stackA, { size: 28, weight: 600, anchor: "middle", fill: K.mute })));
  const p2 = s.seq(P, 3.5, 8.3, "scale(.94)");
  s.add(G(p2, T(600, 62, t.stackB, { size: 30, weight: 700, anchor: "middle", fill: "url(#tx)" })));
  const badge = s.seq(P, 3.2, 8.3, "scale(.55)", 0.6);
  s.defs.push(`<radialGradient id="hl" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="${K.blue}" stop-opacity=".55"/><stop offset="1" stop-color="${K.blue}" stop-opacity="0"/></radialGradient>`,
    `<linearGradient id="bd" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${K.blue}"/><stop offset="1" stop-color="#2a5fd6"/></linearGradient>`);
  // Real PDA logo (frontend/public/images/branding/pda-logo-512.png), embedded so the SVG stays self-contained on GitHub.
  const logoPath = new URL("../../../../frontend/public/images/branding/pda-logo-512.png", import.meta.url);
  const logo = readFileSync(process.env.PDA_LOGO || logoPath).toString("base64");
  s.add(G(badge, `<g class="br">${C(cx, cy, 130, "url(#hl)")}</g><image x="${cx - 90}" y="${cy - 90}" width="180" height="180" href="data:image/png;base64,${logo}"/>`));
  return s.svg(t.stackTitle, t.stackDesc, `@media (prefers-reduced-motion:reduce){.alt{display:none}}`);
}

// ---------------------------------------------------------------- meeting
function meeting(t) {
  const s = scene(1000, 400);
  stage(s);
  const P = 10;
  s.add(T(32, 50, t.meetings, { size: 12, fill: K.mute, font: MONO, ls: 2 }));
  // live card
  s.add(R(32, 66, 350, 132, 14, K.panel2, K.blue, 1.5));
  s.add(R(48, 82, 56, 22, 11, "#ff6b8126") + C(62, 93, 4, K.red) + `<g class="ring">${C(62, 93, 4, K.red)}</g>` + T(72, 97, t.live, { size: 11, fill: K.red, font: MONO, weight: 700 }));
  s.add(T(48, 130, t.sprint, { size: 20, weight: 600 }));
  s.add(T(48, 152, t.meetProj, { size: 13, fill: K.mute }));
  s.add(avatar(60, 178, 11, "AL", K.blue2) + avatar(79, 178, 11, "HT", K.green) + avatar(98, 178, 11, "AY", K.amber));
  s.add(R(290, 166, 76, 28, 14, K.blue) + T(328, 185, t.join, { size: 13, weight: 600, anchor: "middle", fill: "#06101f" }));
  // standalone card
  s.add(R(32, 212, 350, 74, 14, K.panel2, K.line));
  s.add(T(48, 244, t.retro, { size: 17, weight: 600 }));
  s.add(R(48, 256, tw(t.standalone, 12, 0.58) + 20, 20, 10, "#ffffff12") + T(58, 270, t.standalone, { size: 12, fill: K.mute }));
  // guest link row
  s.add(R(32, 302, 350, 64, 14, K.panel, K.line));
  s.add(`<g stroke="${K.blue2}" stroke-width="2.4" fill="none" stroke-linecap="round"><rect x="46" y="326" width="22" height="14" rx="7"/><rect x="58" y="326" width="22" height="14" rx="7"/></g>`);
  s.add(T(96, 330, t.guestLink, { size: 14, weight: 600 }) + T(96, 350, "…/join/ • •", { size: 12, fill: K.mute, font: MONO }));
  const cp = s.seq(P, 0, 1.4, "none", 0.01);
  s.add(G(cp + " alt", R(278, 321, 88, 28, 14, "#ffffff12", K.line) + T(322, 340, t.copy, { size: 13, anchor: "middle", fill: K.text })));
  const copied = s.seq(P, 1.4, 9.2, "scale(.9)", 0.3);
  s.add(G(copied, R(278, 321, 88, 28, 14, "#35d39b26", K.green) + T(322, 340, t.copied, { size: 13, anchor: "middle", fill: K.green, weight: 600 })));
  // room
  s.add(R(410, 32, 558, 296, 16, K.panel, K.line));
  const tile = (x, y, name, ini, col, speaking) =>
    R(x, y, 262, 128, 12, K.panel2, speaking ? K.green : K.line, speaking ? 2 : 1) +
    (speaking ? `<g class="pl">${R(x - 3, y - 3, 268, 134, 14, "none", K.green, 2)}</g>` : "") +
    avatar(x + 131, y + 54, 26, ini, col) + T(x + 14, y + 116, name, { size: 13, fill: K.text, weight: 500 });
  s.add(tile(424, 46, "Alper", "AL", K.blue2, false));
  s.add(tile(696, 46, "Hamza", "HT", K.green, true));
  s.add(tile(424, 184, "Ayşe", "AY", K.amber, false));
  s.add(R(696, 184, 262, 128, 12, "none", K.line, 1.5, 'stroke-dasharray="6 6"'));
  const gt = s.seq(P, 2.6, 9.2, "scale(.92)", 0.5);
  s.add(G(gt, R(696, 184, 262, 128, 12, K.panel2, K.blue, 2) + avatar(827, 238, 26, "?", K.mute) + T(710, 300, t.guest, { size: 13, weight: 500 }) + R(884, 196, 62, 20, 10, "#4c8dff30") + T(915, 210, "guest", { size: 11, anchor: "middle", fill: K.blue2, font: MONO })));
  const toast = s.seq(P, 2.6, 5.6, "translateY(-14px)", 0.45);
  s.add(G(toast, R(620, 8, 200, 34, 17, K.blue, "#ffffff40") + C(640, 25, 5, "#fff") + T(654, 30, t.guestJoined, { size: 13, weight: 600, fill: "#fff" })));
  // controls
  const btn = (cx, d) => C(cx, 358, 18, K.panel2, `stroke="${K.line}"`) + d;
  const ic = `stroke="${K.text}" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"`;
  s.add(btn(577, `<rect x="572" y="349" width="10" height="14" rx="5" ${ic}/><path d="M569 358 v1 a8 8 0 0 0 16 0 v-1" ${ic}/>`));
  s.add(btn(623, `<rect x="614" y="351" width="13" height="14" rx="3" ${ic}/><path d="M627 355 l7 -4 v14 l-7 -4" ${ic}/>`));
  s.add(btn(669, `<rect x="660" y="350" width="18" height="12" rx="2" ${ic}/><path d="M665 368 h8" ${ic}/>`));
  s.add(btn(715, `<path d="M706 351 h18 v11 h-9 l-6 5 v-5 h-3 z" ${ic}/>`));
  s.add(R(749, 340, 70, 36, 18, K.red) + T(784, 363, t.leave, { size: 13, weight: 700, anchor: "middle", fill: "#fff" }));
  return s.svg(t.meetTitle, t.meetDesc, `@media (prefers-reduced-motion:reduce){.alt{display:none}}`);
}

// ---------------------------------------------------------------- chat
function chat(t) {
  const s = scene(900, 500);
  stage(s, false);
  const P = 11;
  s.add(R(24, 24, 852, 452, 16, K.panel, K.line));
  s.add(T(48, 58, "#", { size: 20, weight: 700, fill: K.blue2 }) + T(66, 58, t.chatRoom, { size: 17, weight: 700 }));
  s.add(T(836, 58, t.tabDm, { size: 14, anchor: "end", fill: K.mute }));
  const gx = 836 - tw(t.tabDm, 14, 0.58) - 28;
  s.add(T(gx, 58, t.tabGroup, { size: 14, anchor: "end", fill: K.text, weight: 600 }) + R(gx - tw(t.tabGroup, 14, 0.6), 66, tw(t.tabGroup, 14, 0.6), 3, 1.5, K.blue));
  s.add(`<path d="M24 82 H876" stroke="${K.line}"/>`);
  const bubbleW = (str, size) => Math.round(tw(str, size, 0.54) + 34);
  // m1
  let b1 = bubbleW(t.m1, 15);
  s.add(G(s.seq(P, 0.5, 10.4), avatar(56, 120, 17, "AL", K.blue2) + T(86, 108, "Alper", { size: 12, fill: K.mute }) + R(86, 116, b1, 40, 14, K.panel2, K.line) + T(103, 141, t.m1, { size: 15 })));
  // m2 (mine, right)
  const b2 = bubbleW(t.m2, 15);
  s.add(G(s.seq(P, 2.0, 10.4, "translateX(18px)"), R(836 - b2, 176, b2, 40, 14, K.blue) + T(836 - b2 + 17, 201, t.m2, { size: 15, fill: "#06101f", weight: 500 })));
  s.add(G(s.seq(P, 3.0, 10.4, "translateX(18px)"),
    R(556, 226, 280, 66, 14, K.panel2, K.line) + R(572, 240, 36, 38, 8, "#ff6b8128") + T(590, 264, "PDF", { size: 12, weight: 700, anchor: "middle", fill: K.red, font: MONO }) +
    T(622, 255, t.file, { size: 14, weight: 600 }) + T(622, 273, "284 KB", { size: 12, fill: K.mute }) +
    `<path d="M812 252 v14 m-6 -6 l6 6 l6 -6" stroke="${K.blue2}" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`));
  // m3
  const b3 = bubbleW(t.m3, 15);
  s.add(G(s.seq(P, 5.0, 10.4), avatar(56, 330, 17, "HT", K.green) + T(86, 318, "Hamza", { size: 12, fill: K.mute }) + R(86, 326, b3, 40, 14, K.panel2, K.line) + T(103, 351, t.m3, { size: 15 })));
  s.add(G(s.seq(P, 6.2, 10.4, "scale(.7)", 0.35), R(92, 372, 54, 24, 12, "#4c8dff30", K.blue) + T(104, 389, "👍", { size: 13 }) + T(126, 389, "2", { size: 13, weight: 600, fill: K.blue2 })));
  // typing
  s.add(G(s.seq(P, 7.2, 10.4),
    avatar(56, 428, 13, "AY", K.amber) + R(80, 414, 128, 28, 14, K.panel2) +
    [0, 1, 2].map(i => `<g class="bn" style="animation-delay:${i * 0.18}s">${C(98 + i * 13, 428, 3.6, K.mute)}</g>`).join("") + T(148, 433, t.typing, { size: 12, fill: K.mute })));
  // composer
  s.add(R(44, 446, 812, 20, 10, "none"));
  return s.svg(t.chatT, t.chatD);
}

// ---------------------------------------------------------------- tasks
function tasks(t) {
  const s = scene(1000, 500);
  stage(s);
  const P = 10;
  const segX = 40, segW = 300, half = segW / 2;
  s.add(T(40, 44, t.newTask, { size: 12, fill: K.mute, font: MONO, ls: 2 }));
  s.add(R(segX, 58, segW, 46, 23, K.panel, K.line));
  const hl = s.kf(P, `0%,44%{transform:translateX(-${half}px)}50%,92%{transform:none}98%,100%{transform:translateX(-${half}px)}`, "cubic-bezier(.65,0,.35,1)");
  s.add(G(hl, R(segX + half + 4, 62, half - 8, 38, 19, K.blue)));
  s.add(T(segX + half / 2, 87, t.simple, { size: 15, weight: 600, anchor: "middle", fill: K.mute }) + T(segX + half + half / 2, 87, t.advanced, { size: 15, weight: 600, anchor: "middle", fill: K.mute }));
  s.add(G(s.seq(P, 0, 4.7, "none", 0.25) + " alt", T(segX + half / 2, 87, t.simple, { size: 15, weight: 700, anchor: "middle", fill: "#06101f" })));
  s.add(G(s.seq(P, 5.0, 9.4, "none", 0.25), T(segX + half + half / 2, 87, t.advanced, { size: 15, weight: 700, anchor: "middle", fill: "#06101f" })));
  // form card
  s.add(R(40, 124, 920, 306, 16, K.panel, K.line));
  s.add(T(64, 156, t.fTitle, { size: 12, fill: K.mute, font: MONO, ls: 1 }));
  s.add(R(64, 164, 872, 40, 10, K.panel2, K.line) + T(80, 190, t.taskVal, { size: 16 }));
  s.add(T(64, 232, t.fDesc, { size: 12, fill: K.mute, font: MONO, ls: 1 }));
  s.add(R(64, 240, 872, 50, 10, K.panel2, K.line) + T(80, 270, t.descVal, { size: 15, fill: K.mute }));
  const colW = 206;
  const cols = [
    [t.fAssign, avatar(86, 336, 13, "AL", K.blue2) + avatar(108, 336, 13, "HT", K.green) + avatar(130, 336, 13, "AY", K.amber)],
    [t.fPrio, R(284, 322, tw(t.prio, 14) + 28, 28, 14, "#f5b94a26", K.amber) + T(298, 341, t.prio, { size: 14, weight: 600, fill: K.amber })],
    [t.fDue, T(504, 342, t.due, { size: 15, weight: 500 })],
    [t.fEst, T(724, 342, t.est, { size: 15, weight: 500 })],
  ];
  const rowB = s.seq(P, 5.3, 9.4, "translateY(10px)");
  s.add(G(rowB, cols.map(([label, inner], i) =>
    T(64 + i * (colW + 14) + 0, 312, label, { size: 12, fill: K.mute, font: MONO, ls: 1 }) + R(64 + i * (colW + 14), 322, colW, 28, 0, "none") + inner).join("")));
  const rowC = s.seq(P, 5.8, 9.4, "translateY(10px)");
  const subX = [64, 190, 316];
  s.add(G(rowC, T(64, 380, t.fSub, { size: 12, fill: K.mute, font: MONO, ls: 1 }) + t.subs.map((label, i) => {
    const x = subX[i] + (i === 0 ? 0 : 0);
    const done = i < 2;
    return R(x, 392, 20, 20, 6, done ? K.green : "none", done ? undefined : K.mute, 1.5) +
      (done ? `<path d="M${x + 5} ${x * 0 + 402} l4 4 l7 -8" stroke="#06101f" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>` : "") +
      T(x + 28, 407, label, { size: 15, fill: K.text });
  }).join("")));
  // quiet extras
  t.extras.forEach((label, i) => {
    const x = 40 + i * 120;
    s.add(R(x, 448, 108, 30, 15, "#ffffff10", K.line) + T(x + 54, 468, label, { size: 13, anchor: "middle", fill: K.mute }));
  });
  return s.svg(t.taskT, t.taskD, `@media (prefers-reduced-motion:reduce){.alt{opacity:0}}`);
}

// ---------------------------------------------------------------- repository
function repo(t) {
  const s = scene(1000, 500);
  stage(s);
  const P = 11;
  s.add(`<path d="M44 52 a8 8 0 1 1 0 .1 M44 52 v18 M56 70 a6 6 0 1 0 .1 0" stroke="${K.blue2}" stroke-width="2" fill="none"/>`);
  s.add(T(72, 62, "alperrte/project-delivery-assistant", { size: 17, weight: 600, font: MONO }));
  s.add(R(466, 44, 62, 26, 13, "#4c8dff26", K.blue) + T(497, 62, "main", { size: 13, anchor: "middle", fill: K.blue2, font: MONO }));
  const segW = 280, half = segW / 2, segX = 680;
  s.add(R(segX, 40, segW, 40, 20, K.panel, K.line));
  const hl = s.kf(P, `0%,44%{transform:translateX(-${half}px)}50%,92%{transform:none}98%,100%{transform:translateX(-${half}px)}`, "cubic-bezier(.65,0,.35,1)");
  s.add(G(hl, R(segX + half + 4, 44, half - 8, 32, 16, K.blue)));
  s.add(T(segX + half / 2, 66, t.basic, { size: 14, weight: 600, anchor: "middle", fill: K.mute }) + T(segX + half * 1.5, 66, t.advanced, { size: 14, weight: 600, anchor: "middle", fill: K.mute }));
  s.add(G(s.seq(P, 0, 4.9, "none", 0.25) + " alt", T(segX + half / 2, 66, t.basic, { size: 14, weight: 700, anchor: "middle", fill: "#06101f" })));
  s.add(G(s.seq(P, 5.2, 10.2, "none", 0.25), T(segX + half * 1.5, 66, t.advanced, { size: 14, weight: 700, anchor: "middle", fill: "#06101f" })));
  s.add(R(40, 100, 920, 340, 16, K.panel, K.line));
  const authors = [["AL", K.blue2], ["HT", K.green], ["AY", K.amber], ["AL", K.blue2], ["HT", K.green]];
  const hashes = ["a1f3c9e", "7be02d4", "c95a118", "3d7e6f0", "e48b2a7"];
  // basic phase
  const basic = s.seq(P, 0, 4.9, "none", 0.3);
  s.add(G(basic + " alt", T(64, 134, t.lastCommits.toUpperCase(), { size: 12, fill: K.mute, font: MONO, ls: 1.5 }) +
    t.commits.map((msg, i) => {
      const y = 150 + i * 56;
      return `<path d="M64 ${y} H936" stroke="${K.line}"/>` +
        T(64, y + 34, hashes[i], { size: 14, fill: K.blue2, font: MONO }) + T(160, y + 34, msg, { size: 16 }) +
        avatar(600, y + 28, 12, authors[i][0], authors[i][1]) + T(690, y + 33, t.when[i], { size: 13, anchor: "end", fill: K.mute });
    }).join("")));
  // advanced phase
  const adv = s.seq(P, 5.2, 10.2, "none", 0.3);
  const brs = [["main", 0, 0, true], ["feature/guest-link", 3, 0, false], ["feature/chat-files", 2, 1, false], ["fix/board-order", 0, 0, true]];
  s.add(G(adv, T(64, 134, t.branches, { size: 12, fill: K.mute, font: MONO, ls: 1.5 }) +
    brs.map(([name, ahead, behind, merged], i) => {
      const y = 150 + i * 62;
      return `<path d="M64 ${y} H470" stroke="${K.line}"/>` +
        T(64, y + 30, name, { size: 14, weight: 600, font: MONO }) +
        R(64, y + 40, 8 + ahead * 26, 7, 3.5, K.green) + R(64 + 8 + ahead * 26 + 6, y + 40, behind ? 8 + behind * 20 : 0, 7, 3.5, K.amber) +
        (merged ? R(366, y + 14, 98, 26, 13, "#35d39b26", K.green) + T(415, y + 32, t.merged, { size: 12, anchor: "middle", fill: K.green, weight: 600 })
          : R(366, y + 14, 98, 26, 13, "#f5b94a26", K.amber) + T(415, y + 32, t.open, { size: 12, anchor: "middle", fill: K.amber, weight: 600 }));
    }).join("") +
    `<path d="M492 128 V424" stroke="${K.line}"/>` + T(516, 134, t.unmerged, { size: 12, fill: K.mute, font: MONO, ls: 1.5 }) +
    [0, 1, 2].map(i => {
      const y = 150 + i * 62;
      return `<path d="M516 ${y} H936" stroke="${K.line}"/>` + T(516, y + 30, hashes[i], { size: 14, fill: K.blue2, font: MONO }) + T(516, y + 52, t.commits[i], { size: 14, fill: K.text }) + avatar(912, y + 34, 12, authors[i][0], authors[i][1]);
    }).join("")));
  // toast + note (basic phase)
  s.add(G(s.seq(P, 2.6, 4.7, "translateX(40px)", 0.5) + " alt",
    R(716, 116, 228, 62, 14, K.panel2, K.green, 1.5) + C(740, 147, 5, K.green) + `<g class="ring">${C(740, 147, 5, K.green)}</g>` +
    T(756, 142, t.toastT, { size: 14, weight: 700 }) + T(756, 162, "a1f3c9e · main", { size: 12, fill: K.mute, font: MONO })));
  s.add(`<g>${`<path d="M64 466 a8 8 0 0 1 16 0 v6 l3 4 h-22 l3 -4 z M68 480 a4 4 0 0 0 8 0" stroke="${K.blue2}" stroke-width="2" fill="none" stroke-linejoin="round"/>`}${T(96, 478, t.notify, { size: 14, fill: K.mute })}</g>`);
  return s.svg(t.repoT, t.repoD, `@media (prefers-reduced-motion:reduce){.alt{opacity:0}}`);
}

// ---------------------------------------------------------------- organization
function org(t) {
  const s = scene(1000, 420);
  stage(s);
  const P = 10;
  s.defs.push(`<linearGradient id="cv" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2a5fd6"/><stop offset="1" stop-color="#1fb58a"/></linearGradient>`);
  s.add(G(s.seq(P, 0.2, 9.4, "translateY(14px)", 0.6),
    R(40, 40, 400, 340, 18, K.panel, K.line) +
    `<clipPath id="cc"><rect x="40" y="40" width="400" height="112" rx="18"/></clipPath><g clip-path="url(#cc)">${R(40, 40, 400, 112, 0, "url(#cv)")}${R(40, 40, 400, 112, 0, "url(#dots)")}</g>` +
    C(100, 160, 38, K.panel, `stroke="${K.line}" stroke-width="3"`) + avatar(100, 160, 32, "KK", K.blue2) +
    T(64, 230, t.org, { size: 24, weight: 700 }) +
    T(64, 256, t.orgAbout[0], { size: 14, fill: K.mute }) + T(64, 276, t.orgAbout[1], { size: 14, fill: K.mute }) +
    `<path d="M70 304 a6 6 0 1 1 12 0 c0 5 -6 10 -6 10 s-6 -5 -6 -10 z" stroke="${K.mute}" stroke-width="1.8" fill="none"/>` + T(92, 314, t.orgLoc, { size: 13, fill: K.mute }) +
    T(176, 314, t.orgUpd, { size: 13, fill: K.mute, font: MONO }) +
    R(64, 332, tw(t.orgProj, 13, 0.6) + 28, 28, 14, "#4c8dff26", K.blue) + T(78, 351, t.orgProj, { size: 13, weight: 600, fill: K.blue2 })));
  const pcols = [K.blue2, K.green, K.amber];
  const prog = [72, 45, 90];
  t.projects.forEach((name, i) => {
    const y = 40 + i * 116, cy = y + 49;
    const draw = s.kf(P, `0%,10%{stroke-dashoffset:260;opacity:1}22%,92%{stroke-dashoffset:0;opacity:1}100%{stroke-dashoffset:0;opacity:0}`, "ease-out");
    s.add(G(draw, `<path d="M440 210 C 480 210, 480 ${cy}, 524 ${cy}" stroke="${K.blue}" stroke-opacity=".55" stroke-width="2" fill="none" stroke-dasharray="260" style="stroke-dashoffset:0"/>`, `animation-delay:${i * 0.2}s`));
  });
  t.projects.forEach((name, i) => {
    const y = 40 + i * 116;
    const cls = s.seq(P, 1.6 + i * 0.6, 9.4, "translateX(40px)", 0.55);
    s.add(G(cls,
      R(524, y, 436, 98, 16, K.panel2, K.line) +
      R(542, y + 17, 64, 64, 12, pcols[i], undefined, 1, 'fill-opacity=".9"') + T(574, y + 58, name.split(" ").map(w => w[0]).slice(0, 2).join(""), { size: 22, weight: 800, anchor: "middle", fill: "#06101f" }) +
      T(626, y + 40, name, { size: 17, weight: 600 }) +
      R(626, y + 58, 250, 8, 4, "#ffffff14") + R(626, y + 58, 250 * prog[i] / 100, 8, 4, pcols[i]) +
      T(890, y + 67, prog[i] + "%", { size: 14, fill: K.mute, font: MONO })));
  });
  return s.svg(t.orgT, t.orgD);
}

// ---------------------------------------------------------------- terminal
function terminal(t) {
  const s = scene(900, 460);
  stage(s, false);
  const P = 17;
  s.add(R(24, 24, 852, 372, 14, K.term, K.line));
  s.add(R(24, 24, 852, 40, 14, K.panel, undefined) + R(24, 50, 852, 14, 0, K.panel));
  s.add(C(48, 44, 6, K.red) + C(68, 44, 6, K.amber) + C(88, 44, 6, K.green) + T(450, 49, t.termTitle, { size: 13, anchor: "middle", fill: K.mute, font: MONO }));
  const cw = 9.1, x0 = 48;
  const nb = " ";
  const lines = [
    { y: 100, cmd: "git clone https://github.com/alperrte/project-delivery-assistant.git", at: 0.6, dur: 2.2 },
    { y: 130, cmd: "cp .env.example .env", at: 3.4, dur: 1.0 },
    { y: 160, cmd: "docker compose up --build -d", at: 4.9, dur: 1.4 },
    { y: 190, out: [nb + "✔" + nb + "postgres" + nb + nb + "Healthy", K.green], at: 6.6 },
    { y: 218, out: [nb + "✔" + nb + "backend" + nb + nb + nb + "Started", K.green], at: 7.3 },
    { y: 258, cmd: "cd frontend && npm install && npm run dev", at: 8.4, dur: 1.8 },
    { y: 288, out: [nb + "▲" + nb + "http://localhost:3000" + nb + nb + "·" + nb + t.ready, K.blue2], at: 10.6 },
  ];
  lines.forEach(l => {
    if (l.cmd) {
      const txt = T(x0, l.y, "", { size: 15, font: MONO }).replace("></text>", `><tspan fill="${K.green}">$</tspan><tspan fill="${K.text}">${nb}${esc(l.cmd)}</tspan></text>`);
      s.add(txt);
      const W = Math.round((l.cmd.length + 3) * cw + 40);
      const steps = Math.max(8, l.cmd.length);
      const a = pct(l.at, P), b = pct(l.at + l.dur, P), c = pct(P - 1.2, P);
      const cls = s.kf(P, `0%,${a}%{transform:scaleX(1);animation-timing-function:steps(${steps},end)}${b}%,${c}%{transform:scaleX(0)}${pct(P - 0.6, P)}%,100%{transform:scaleX(1)}`);
      s.add(G(cls + " cov", R(x0, l.y - 18, W, 26, 0, K.term), `transform-origin:right center`));
    } else {
      const cls = s.seq(P, l.at, P - 1.2, "translateY(6px)", 0.3);
      s.add(G(cls, T(x0, l.y, l.out[0], { size: 15, font: MONO, fill: l.out[1] })));
    }
  });
  s.add(`<g class="cur">${R(x0 + 4, 304, 9, 18, 1, K.text)}</g>`);
  s.add(T(450, 430, t.termCap, { size: 14, anchor: "middle", fill: K.mute }));
  function pct(x, Tt) { return Math.min(100, +((x / Tt) * 100).toFixed(2)); }
  return s.svg(t.termT, t.termD, `.cov{transform-box:fill-box}@media (prefers-reduced-motion:reduce){.cov{display:none}}`);
}

const scenes = { hero, stack, meeting, chat, tasks, repo, org, terminal };
for (const [lang, dict] of Object.entries(L)) {
  for (const [name, fn] of Object.entries(scenes)) {
    writeFileSync(join(OUT, `${name}.${lang}.svg`), fn(dict), "utf8");
  }
}
console.log("ok", Object.keys(scenes).length * Object.keys(L).length);
