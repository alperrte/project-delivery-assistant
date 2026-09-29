// Local visual preview of the real Project Service screens. No API writes.
/* eslint-disable @typescript-eslint/no-require-imports */
const { chromium } = require("@playwright/test");
const { mkdirSync } = require("node:fs");
const path = require("node:path");

const origin = process.argv[2] ?? "http://localhost:3000";
const projectId = "pda-visual-preview";
const userId = "preview-manager";
const organizationId = "preview-organization";
const now = "2026-09-28T09:00:00Z";

const project = {
  id: projectId,
  name: "PDA Öğrenci Platformu",
  slug: projectId,
  description: "Üniversite öğrencileri için proje geliştirme, ekip kurma ve iş birliği yapma platformu.",
  status: "PLANNING",
  priority: "MEDIUM",
  startDate: "2026-01-12",
  targetEndDate: "2026-12-20",
  projectGoal: "Öğrencilerin fikirlerini ekiplerle birlikte çalışan projelere dönüştürmek.",
  techStack: "Next.js, Spring Boot, PostgreSQL",
  visibility: "PRIVATE",
  organizationId,
  createdBy: userId,
  createdAt: "2026-01-12T10:00:00Z",
  updatedAt: now,
  archivedAt: null,
};

const organization = {
  id: organizationId,
  name: "PDA",
  slug: "pda",
  description: "Öğrenci ekiplerinin çalışma alanı.",
  ownerUserId: userId,
  status: "ACTIVE",
  createdAt: "2026-01-12T10:00:00Z",
  updatedAt: now,
  archivedAt: null,
};

const names = [
  "Kullanıcı kaydı ve giriş sistemi", "Proje oluşturma özelliği", "Ekip yönetimi modülü",
  "Üye davet akışı", "Başarı kriterleri listesi", "Proje rolleri", "Organizasyon alanı",
  "GitHub depo bağlantısı", "Proje ilerleme özeti", "Bildirim merkezi",
  "Görev panosu", "Arama ve filtreleme", "Raporlama ekranı", "Mobil gezinme",
  "Erişilebilirlik denetimi", "E-posta bildirimleri", "Dosya paylaşımı",
  "Proje zaman çizelgesi", "Yönetici görünümü", "Yayın kontrol listesi",
];
const criteria = names.map((title, index) => ({
  id: `preview-criterion-${index + 1}`,
  projectId,
  title,
  description: index % 3 === 0 ? "Kullanıcı akışı ve kabul koşulları doğrulanacak." : null,
  completed: index < 7,
  sortOrder: index,
  createdBy: userId,
  createdAt: new Date(Date.UTC(2026, index < 7 ? index : 6, 12 + index % 10)).toISOString(),
  completedBy: index < 7 ? userId : null,
  completedAt: index < 7 ? new Date(Date.UTC(2026, index + 1, 12 + index % 10)).toISOString() : null,
}));

const members = [
  [userId, "hamza", ["PROJECT_MANAGER"], "2026-01-12T10:00:00Z"],
  ["preview-member-2", "Zeynep Yılmaz", ["BACKEND_DEVELOPER"], "2026-02-15T10:00:00Z"],
  ["preview-member-3", "Mehmet Demir", ["FRONTEND_DEVELOPER"], "2026-03-12T10:00:00Z"],
  ["preview-member-4", "Ayşe Kaya", ["UI_UX_DEVELOPER"], "2026-04-18T10:00:00Z"],
  ["preview-member-5", "Emre Şahin", ["ANALYST"], "2026-05-20T10:00:00Z"],
].map(([id, nickname, roles, joinedAt]) => ({ userId: id, nickname, roles, joinedAt }));

const invitations = [
  ["preview-invite-1", "ali@example.com", ["FRONTEND_DEVELOPER"], "2026-09-21T10:00:00Z"],
  ["preview-invite-2", "sude@example.com", ["UI_UX_DEVELOPER"], "2026-09-22T10:00:00Z"],
].map(([id, email, initialRoles, createdAt]) => ({
  id, projectId, invitedUserId: null, email, invitedBy: userId,
  initialRoles, status: "PENDING", createdAt, expiresAt: "2026-10-05T10:00:00Z",
}));

const squads = [
  ["preview-squad-1", "Frontend Ekibi", "Kullanıcı arayüzü geliştirmeleri"],
  ["preview-squad-2", "Backend Ekibi", "Sunucu ve veritabanı geliştirmeleri"],
].map(([id, name, description]) => ({
  id, projectId, name, description, createdBy: userId,
  createdAt: "2026-02-01T10:00:00Z", updatedAt: now, archivedAt: null,
}));

const page = (content) => ({ content, page: 0, size: 20, totalPages: 1, totalElements: content.length });
const home = {
  ...project,
  organization: { id: organizationId, name: organization.name, slug: organization.slug },
  managers: [{ userId, nickname: "hamza" }],
  teamMemberCount: members.length,
  criteriaProgress: { completed: criteria.filter((item) => item.completed).length, total: criteria.length },
  repository: {
    connected: false, provider: null, repositoryOwner: null, repositoryName: null,
    defaultBranch: null, lastCommit: null, githubUnavailable: false,
  },
};

function readFixture(requestUrl) {
  const url = new URL(requestUrl);
  const path = url.pathname.replace(/^\/api\/v1/, "");
  if (path === "/auth/me") return { id: userId, nickname: "hamza", email: "preview@example.com", globalRole: "USER", mustChangePassword: false };
  if (path === "/projects" || path === "/organizations") return page(path === "/projects" ? [project] : [organization]);
  if (path === `/projects/by-slug/${projectId}` || path === `/projects/${projectId}`) return project;
  if (path === `/projects/${projectId}/home`) return home;
  if (path === `/projects/${projectId}/criteria`) return criteria;
  if (path === `/projects/${projectId}/members`) return page(members);
  if (path === `/projects/${projectId}/members/${userId}`) return members[0];
  if (path === `/projects/${projectId}/members/search`) return [];
  if (path === `/projects/${projectId}/invitations`) return page(invitations);
  if (path === `/projects/${projectId}/squads`) return page(squads);
  for (const squad of squads) {
    if (path === `/projects/${projectId}/squads/${squad.id}`) return squad;
    if (path === `/projects/${projectId}/squads/${squad.id}/members`) {
      return page(squad.id === squads[0].id ? members.slice(0, 3).map((member) => ({
        userId: member.userId, nickname: member.nickname, addedBy: userId, addedAt: member.joinedAt,
      })) : members.slice(3).map((member) => ({
        userId: member.userId, nickname: member.nickname, addedBy: userId, addedAt: member.joinedAt,
      })));
    }
  }
  if (path === `/organizations/${organizationId}`) return organization;
  if (path === `/organizations/${organizationId}/projects`) return page([project]);
  return undefined;
}

async function main() {
  const browser = await chromium.launch({ headless: false, args: ["--window-size=1536,960"] });
  const context = await browser.newContext({
    viewport: { width: 1480, height: 870 }, locale: "tr-TR", colorScheme: "dark",
  });
  const tab = await context.newPage();
  await tab.route("**/api/v1/**", async (route) => {
    if (route.request().method() !== "GET") {
      await route.fulfill({
        status: 403, contentType: "application/problem+json",
        body: JSON.stringify({ code: "preview_read_only", detail: "Bu görsel önizlemede değişiklikler kaydedilmez." }),
      });
      return;
    }
    const data = readFixture(route.request().url());
    await route.fulfill({
      status: data === undefined ? 404 : 200,
      contentType: "application/json",
      body: JSON.stringify(data ?? {}),
    });
  });
  await tab.goto(`${origin}/projects/${projectId}`);
  await tab.getByRole("heading", { name: project.name }).waitFor();
  await tab.getByRole("heading", { name: "Son kriter hareketleri" }).waitFor();
  const captures = path.resolve(__dirname, "../../tmp/project-preview");
  mkdirSync(captures, { recursive: true });
  await tab.screenshot({ path: path.join(captures, "genel-bakis.png"), fullPage: true });
  for (const [section, label] of [
    ["kriterler", "Kriterler"], ["uyeler", "Üyeler"], ["davetler", "Davetler"],
    ["ekipler", "Ekipler"], ["depo", "Depo"], ["ayarlar", "Ayarlar"],
  ]) {
    await tab.getByRole("tab", { name: label }).click();
    await tab.waitForTimeout(250);
    await tab.screenshot({ path: path.join(captures, `${section}.png`), fullPage: true });
  }
  await tab.getByRole("tab", { name: "Genel Bakış" }).click();
  await tab.setViewportSize({ width: 390, height: 844 });
  await tab.screenshot({ path: path.join(captures, "mobil-genel-bakis.png"), fullPage: true });
  await tab.setViewportSize({ width: 1480, height: 870 });
  console.log(`Görsel demo açık: ${origin}/projects/${projectId}`);
  console.log("Bu pencere örnek API verilerini kullanır. Yazma işlemleri engellenir; kapatınca demo verisi kaybolur.");
  console.log(`Ekran görüntüleri: ${captures}`);
  await new Promise((resolve) => browser.on("disconnected", resolve));
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
