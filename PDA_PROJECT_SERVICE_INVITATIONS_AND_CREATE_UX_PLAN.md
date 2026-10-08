# PDA — Project Invitations & Create UX Planı

Tarih: 2026-10-07. Durum: **Tasks 1-8 complete; canonical full gate PASSED.**

Source of truth: `.agents/PDA_Project_Service_Invitations_and_Create_UX_Plan_and_Implementation.md` çalışma modeli, A–J kapsamı/1–48 bölümleri, final formatı ve 33 kritik kuralının tamamı. Prompt ve `frontend/CLAUDE.md` tamamen okundu; CLAUDE→AGENTS, repository güvenlik/mimari/klasör/checklist bağlamı, frontend workflow/design/globals ve installed Next use-client dokümanı incelendi. IDE'de görünen `.agents/decisions/...` kopyası diskte mevcut değil; kullanıcı tarafından açıkça verilen `.agents/...` yolu esas alındı.

Her task **implementation → targeted test → gerekli bug fix/retest → Definition of Done → checkbox `[x]` → sonraki bağımlı task** sırasıyla yürütüldü. Bir taskın DoD'si tamamlanmadan bağımlı taska geçilmez. İlk plan tesliminde kutular açıktı ve implementation yoktu; sonraki kullanıcı onayıyla uygulanıp aşağıdaki gerçek verification kayıtlarıyla kapatıldı. Ayrı implementation teslimi: `docs/compliation/2026-10-08-project-invitations-create-ux.md`.

## 1. Güncel temel / audit bulguları

Branch `project-service-backend`, HEAD `677607eb6d09950377ca45ecb7dde12146a8d1e2`; yerel `origin/main` ahead/behind **0/0**. Başlangıçta yalnız kullanıcının yeni prompt'u untracked; index boş. Agent fetch/pull/merge/branch değişimi yapmadı. Remote ayrıca fetch edilmedi; güncellik local ref karşılaştırmasıdır. Önceki notification/full gate sayıları bu yeni taskın PASS kanıtı değildir.

| Alan | Gerçek source / durum | Plan etkisi |
| --- | --- | --- |
| Sidebar | `layout/project-sidebar-nav.tsx`, `projects/project-sections.ts`: `invitations` parent=teams/managerOnly ama expanded modda sürekli child Link; collapsed modda child yok, Teams icon yalnız link/dot | Gerçek disclosure ve collapsed erişilebilir flyout gerekir; mevcut href/section/aliases korunur |
| Incoming | `/project-invitations/me?status=PENDING`; `listMine` recipient UUID + PENDING + expiresAt>server clock; `MyInvitation` projectName/team/roles/inviter display | Global badge current actor'ın incoming totalElements'ıdır; outgoing count ile birleşmez |
| Project pending | `usePendingInvitationCount`: actor+project key, `/projects/{p}/invitations/all?status=PENDING&page=0&size=1`, select totalElements; sadece manager enabled | Mevcut hook/API reuse; loading/error'ı otomatik0 sayma; foreground refresh eklenir |
| Count UI | Project sidebar'da child sayı/dot var; global Davetler nav/header badge yok; incoming page pending/all tabs, server pages20 | Incoming shared size1 count query + page/sidebar bounded badge; project heading kendi count'unu kullanır |
| Expiry | InvitationService locked expiry materialization; pending list/count filters expiresAt, resend fresh row/token; accept/reject/principal/team guards hazır | Lifecycle/migrations/unique constraints yeniden tasarlanmaz |
| Archive sınırı | `ProjectService.archive` yalnız project marker yazar; incoming pending query active-project join yapmıyor; archived row projectName=null/actions absent olabilir | Arşivli project PENDING liste/count kararı aşağıda; badge ile list predicate aynı olmalı |
| Cache | `invitationKeys` actor-scoped mine/project; boundary cancel/remove; acceptance existing projects+invitation roots invalidates | Count aynı private family'de; size1 count ayrı key, page20 ile key collision yok |
| Create banner | `BannerPickField`→`ImagePicker cover`; `usePickedImage` URL→`ProjectPreviewPanel`→actual ProjectCard `preview.bannerSrc`; create sonrası uploadBanner ve partial failure warning hazır | Preview var; yeniden kurulmaz. Corrupt/load failure ve URL lifecycle kabulü kapatılır |
| Validation | `image-validation.ts`: PNG/JPEG/WebP, 2 MiB, empty/type/size; EntityCover load-error halinde decorative fallback; usePickedImage replace/remove/unmount revoke | Decode/load failure kullanıcı feedback'i eksik olabilir; yalnız scoped minimum düzeltme, backend authoritative |
| Invitation event | `ProjectInvitationEvents.Created/Accepted/Rejected` scalar IDs taşıyor; projectName yok. NotificationFactory generic message, UI generic localized body | Safe event-time project-name snapshot için additive event/notification DTO/schema gerekir |
| Notifications | Yeni/Geçmiş/read/read-all/actor lifetime/claim mevcut; V56/V57/V59 structured snapshots; repository commits yeni type | Davet context aynı pattern'e eklenir; read/history/popup/repository/task contracts korunur |
| Baseline drift | RepositoryLink callback mevcut `useNotificationRead` yanında legacy `read.mutate(n.id)` kullanıyor; hook mutation variables Operation, supported entry execute(action) | Task1 TypeScript/targeted test bu source uyumsuzluğunu doğrular; minimum integration fix, repository feature redesign yok |
| Organization | Organization.ownerUserId; owner-only profile/media/create. Membership/invitation/token/accept/reject/UI/notification source bulunmadı | **MISSING FEATURE**; kullanıcı kararı: proje kapsamı, organization ayrı karar |

En yüksek migration **V59** (repository commit tracking). Notification context için önerilen yeni migration **V60**, implementation preflight'ta tekrar doğrulanır. V21/V31/V36/V56/V57/V58/V59 değiştirilmez.

Bu tur source incelemesidir: baseline/runtime/audit/test/gate çalıştırılmadı, servis ve veri değiştirilmedi. Installed source ile manifest/runtime image uyumu Task1'de doğrulanır. Mevcut dev dependency borcu yeniden ölçülür; bu feature paket/lock/ENV/Compose güncellemesi planlamaz.

## 2. Kararlar ve scope

### Organization capability — kullanıcı kararı

**Mevcut proje kapsamı; organization ayrı karar.** Bugün organization sahibi creation principal'ından atanır; organization'a başka kullanıcı ekleyen membership API/UI yok. Organization→Project association veya ProjectMembership, organization membership/grant değildir. Invitation entity/token/accept/reject ve organization notification yok. Yeni domain/schema/API/UI oluşturulmayacak; `Pending product decision` olarak raporlanacak, proje tesliminde blocker sayılmayacak. Sonradan açık onay verilirse ayrı source-of-truth planı gerekir; bu plana gizli yeni feature eklenmez.

### Arşivli project incoming count — kullanıcı kararı

**Kullanıcı onayı:** arşivlenmiş projelerin physical PENDING satırları incoming PENDING liste ve count'tan birlikte dışlanacak. Active-project predicate aynı server PENDING sorgusuna eklenir; all/history kayıtları korunur, lifecycle/write/permission modeli değişmez. Yeni count endpoint'i veya client filter gerekmez; list/count aynı predicate'i kullanır. Task1 bu kararı current source üzerinde freeze eder. Issuer demotion gibi diğer authorization edge'leri sessizce farklı bir badge lifecycle'a çevrilmez.

### İki count / polling / privacy

- **Incoming**: own `/project-invitations/me?status=PENDING&page=0&size=1` totalElements. Registered target invitedUserId=current UUID; dış email-token akışı sırf email aynı diye yeni incoming membership/notification modeli kazanmaz.
- **Project-managed**: authorized selected project `/projects/{p}/invitations/all?status=PENDING&page=0&size=1` totalElements. Manager's outgoing pending kayıtlar; current actor'a gelen davet sayısı değil.
- Existing key factories'e distinct pending-count suffix; incoming mineRoot(user), project existing project(p,user) family. Count/list status/size/page keys çakışmaz; nonmanager/unknown actor query disabled, unknown/error stale data “0” veya success gibi gösterilmez.
- Mevcut frontend provider default focus refetch kapalı; invitation hook'ta polling yok. Shared count hooks'a önerilen30 saniye **foreground-only** polling ve explicit focus/online refetch eklenir. Existing NotificationOwner/read/history/claim interval'ları değişmez; badge için socket/broker/provider kurulmaz. Expiry server clock ile query predicate'te; client countdown badge source of truth olmaz.
- New invite/accept/reject/cancel/resend/team-delete/external or legacy accept sonrasında ilgili own list/count prefixes invalidate/cancel/reconcile edilir. Other user/session işlemleri poll/refocus ile gelir; anında websocket delivery vaadi yok.
- Sidebar/page aynı query sonucu kullanır; count>0 small badge, >99 görünüm99+, accessible exact count/plural text.0 badge absent; loading/error unknown. Global heading count current PENDING'dir, All tab total değildir; project heading pending count, accepted/rejected/history total değildir.
- Logout/login/register/session/account/project change eski requests/badges/flyout/local states'i temizler. Current identity dispatch/completion guard+AbortSignal ve existing clearPrivateInvitations reuse; storage'a private invite data/count yazılmaz.

### Ekipler navigation

Expanded/sidebar ve mobile drawer'da **Ekipler** gerçek disclosure Button+chevron, altında **Tüm ekipler** mevcut teams link'i ve manager-only **Ekip Davetleri** link'i. Team list erişimi korunur; yeni route/role/navigation library yok. Parent toggle drawer'ı kapatmaz; child navigate mevcut onNavigate ile kapatır.

Teams/invitations query sections ve gerçek `/projects/{slug}/teams/...` routes parent'ı girişte açar; aliases members/squads korunur. User manual collapse override actor+project+logical pathname/section scope'unda; yeni route/context girişinde yeniden uygun open state. Sıradan page/status filter query değişimi user toggle'ını resetlemez. Active child aria-current, active parent descendant indication; no project/nonmanager states doğru.

Collapsed mod: Teams icon existing nonmodal primitive flyout açar; team list ve yetkili invitation child gerçek Link. Current route icon/child selection'ında temsil edilir; route change kendi kendine floating popup/focus açmaz. Expanded logical route-aware state ile floating presentation ayrı tutulur. Flyout outside/Escape/navigation/actor/project change'de kapanır; anchor detached'e focus dönmez.44px button/hit targets, aria-expanded/controls, native links ve tab order; fake menu/tree semantics yok. Navbar/reserve/chat/drawer geometry aynı kalır.

### Banner preview — reuse ve eksik kabul

Mevcut local banner thumbnail + actual card preview zaten create öncesi çalışacak şekilde bağlı. Önce gerçek choose→replace→remove→reselect akışını doğrula; başarılı mevcut davranışı yeniden yazma. Settings ve create cover aynı EntityCover/object-cover ve mevcut aspect/layout kullanır; picker cover crop ve card crop layoutlarının kendi amaçları korunur.

Frontend MIME/empty/2 MiB validation backend policy'yi genişletmez. Corrupted/decode/load failure sessiz fallback'a düşüyorsa banner-scoped accessible error ve güvenli draft davranışı eklenir: başarısız replacement eski valid selection'ı korur, stale decode completion yeni seçimi overwrite etmez. Gerekirse local decode probe için geçici URL+generation/unmount cleanup kullanılır; global bütün ImagePicker consumers'ını gerekmeden değiştirme. Her probe/draft URL replacement/remove/cancel/unmount/success'te revoke; input reset aynı dosyanın reselect'ini sağlar.

Preview persisted/uploaded demek değildir. POST project önce, existing logo/banner upload sonra; create failed draft/retry, banner upload failed created project+existing warning behavior korunur. No autosave/upload-on-select, new storage endpoint, fixed palette, credentials/proxy/media policy change. Dimension/type ultimate boundary backend; client full decode ile server header sniffing'i aynı güvenlik garantisi diye sunma.

### Invitation notification context

Yeni invitation-related notification'lar için **event anındaki projectName snapshot**; created/accepted/rejected üç mevcut type aynı safe context pattern'i kullanır. Registered invite Created mevcut locked Project.name'den; accept/reject/resend kendi event transaction'ındaki current project adı. Rename eski notification'ı rewrite etmez; sonraki event yeni adı taşır. External email'in account recipient'i yokken fake Created notification eklenmez; mevcut register/accept manager notification akışı korunur.

Proposed nullable `invitationContext={projectName}` DTO/TS field, scalar `invitation_project_name VARCHAR(160)` notification column; yalnız üç invitation type'ta kullanılabilir, legacy rows null. Existing V56/V57/V59 CHECK/snapshot/read/popup/repository fields korunur. Yeni V60 additive; eski satır/delete/backfill veya English message parsing yok. Schema yalnız gerektiği bu context için; yeni invitation domain/type/broker kurulmaz.

Project public event record'larına nullable projectName additive component ve legacy constructors/serialized event compatibility; producer existing locked Project lookup'u reuse eder. Notification modülü Project repository/entity import etmez. Writer/factory scalar snapshot+bounded server text yazar; current recipient/self suppression/AFTER_COMMIT/transaction semantics aynı.

Frontend context varsa TR/EN/DE doğal quoted-project body render eder; yoksa mevcut generic safe fallback. New created message örneği: `“PDA” projesine davet edildiniz.` Plain React text; HTML execute edilmez. Name yalnız safe display context; owner/email/token/roles/private organization info eklenmez. Nonmember recipient için project/profile GET per row yapılmaz. Yeni project link eklenmez; existing safe invitation preview/auth path varsa mevcut authorization boundary korunur. Archived history context kalabilir; existing hard-delete notification cleanup politikası aynı.

## 3. Task dependency sırası

```text
Task1 Current preflight / org decision / baseline drift
 → Task2 Effective pending list/count contract
 → Task3 Invitation event/notification context persistence
 → Task4 Actor count hooks + sidebar nested navigation/page badges
 → Task5 Existing create-banner preview gaps/lifecycle
 → Task6 Notification context rendering/cache integration
 → Task7 Combined real security/data/browser/visual regression
 → Task8 Full gate/docs/separate implementation completion
```

Task4 Task2'ye, Task6 Task3'e bağımlı; Task5 presentation işi baseline sonrası bağımsız olabilir, fakat source-of-truth execution sırası yukarıdaki gibi korunur. Organization yeni implementation taskı yok.

## Task 1 — Preflight, capability/contract freeze ve baseline

### Amaç
677607e güncel source/runtime üstünde contract ve scope'u sabitle.
### Neden bu sırada?
Count semantics, notification drift ve migration sırası sonraki bütün işlerin temelidir.
### Prerequisite
Implementation onayı; archive/count kararı.
### Etkilenecek alanlar
- Backend: Project/Invitation/Notification/Organization public contracts.
- Database: migration max/V59, effective pending and snapshots.
- Frontend: current source/manifest/installed APIs, sidebar/media/center.
- Navigation: section/routes/aliases/collapsed/drawer.
- Notification: RepositoryLink read-hook compatibility ve existing contexts.
- Cache: principal/project count/list mutation inventory.
- Security: SECURITY/auth/API/media/module ADR; current debt.
- i18n/a11y: existing primitives/tokens/TR/EN/DE/focus contracts.
- Tests: targeted existing invitation/notification/sidebar/banner baseline.
### Checklist
- [x] 1.1 HEAD/index/worktree/prompt hashes/source drift kaydet; user files korunmuş.
- [x] 1.2 Organization MISSING/deferred ve archived incoming choice freeze; counts vs notification unread ayrımını belgeye sabitle.
- [x] 1.3 Current TypeScript/baseline RepositoryLink legacy mutate mismatch doğrula; gerekiyorsa supported read.execute üzerinden dar fix ve target repository/read/history regression, feature redesign yok.
- [x] 1.4 Current image/schema/ports/Docker/JDK/Node; backend+frontend targeted baseline ve lint/type/build; fresh audit debt, no ENV/quota/package change.
### Definition of Done
- [x] Mandatory product/schema/API/focus decision belirsizliği yok; drift/baseline bugları net ve testli.
- [x] Current source/runtime/baseline evidence kayıtlı; previous gate counts yeni PASS değil.

## Task 2 — Effective pending contracts / count source

### Amaç
İki count için mevcut server totals ve privacy/lifecycle kontratını doğrula.
### Neden bu sırada?
Frontend badge doğru recipient/project predicate'ine bağlı.
### Prerequisite
Task1 DoD.
### Etkilenecek alanlar
- Backend: ProjectInvitationService/Repository/controllers; archived predicate yalnız onaylı karara göre.
- Database: existing invitations/expiry/team/membership; no new count table.
- Frontend: downstream existing list params/size1 totals.
- Navigation: manager vs recipient count sources.
- Notification: counts unread-notification değildir.
- Cache: distinct incoming/project actor families.
- Security: principal/nonmanager/foreign project/no ADMIN bypass.
- i18n/a11y: correct unknown/zero semantics.
- Tests: ProjectInvitationService/API/Repository + existing expiry/team tests.
### Checklist
- [x] 2.1 Mine PENDING + project PENDING total/page1 reuse; no new count endpoint unless real need proved.
- [x] 2.2 Effective expired/accepted/rejected/cancelled excluded; selected archive decision applied to list+count together, all/history retained.
- [x] 2.3 Foreign/anonymous/manager/disabled/CSRF bounds; own target UUID, project scope; no recipient query override.
- [x] 2.4 Real PostgreSQL 0/1/2/>99, expiry/cancel/resend/accept/reject/external/archived/team grant regressions; prior unique/lock/roles semantics retained.
### Definition of Done
- [x] Exact two totals own vs authorized project, list and badge predicates consistent.
- [x] Targeted backend persistence/security/lifecycle passes; existing domains/constraints not bypassed.

## Task 3 — Invitation project-name event snapshot foundation

### Amaç
Safe localized display context'i current notification architecture içinde kalıcılaştır.
### Neden bu sırada?
Task6 UI event-time projectName için gerçek DTO/schema ister.
### Prerequisite
Task2 DoD; preflight migration slot verified.
### Etkilenecek alanlar
- Backend: ProjectInvitationEvents/producers; Notification entity/context/factory/writer/listener/response.
- Database: proposed additive V60 invitation_project_name/subset CHECK; V56/57/59 retained.
- Frontend: nullable wire field; rendering Task6.
- Navigation: no project access grant/link.
- Notification: created/accepted/rejected context + legacy events/rows.
- Cache: existing actor/read/history response defaults.
- Security: scalar bounded plain project name, recipient unchanged.
- i18n/a11y: structured context enables localized text.
- Tests: proposed InvitationNotificationContextMigration/Integration tests; current factory/read/popup/repository tests.
### Checklist
- [x] 3.1 Event name from existing locked project within mutation; compatible legacy constructors/JSON, no module repository leakage.
- [x] 3.2 Additive snapshot storage/DTO/default null; fresh+legacy DB upgrade, old read/popup/context retention; no parsing/backfill.
- [x] 3.3 Real create/accept/reject/resend/rename/rollback + external behavior; recipient/self rules and bounded names unchanged.
- [x] 3.4 Migration/entity/serialized events/owned API targeted tests pass; new schema justified by missing safe localized context.
### Definition of Done
- [x] Fresh invitation notification includes event-time project name; legacy safe generic fallback.
- [x] V56/V57/V59/read/history/claim/fanout and module/security regressions pass.

## Task 4 — Count hooks, nested Teams navigation ve badges

### Amaç
Global incoming ve project-managed pending badge'i gerçek data ile doğru yüzeye bağla.
### Neden bu sırada?
Count source contract artık stabil; navigation state ve cache entegrasyonu kurulabilir.
### Prerequisite
Task3 DoD (count contract Task2).
### Etkilenecek alanlar
- Backend: existing mine/project pending list APIs.
- Database: effective pending source; fresh own QA UUID reads.
- Frontend: invitations hooks/keys/pages, AppShell/sidebar, project nav, shared badge.
- Navigation: Teams disclosure/children/collapsed flyout/mobile/current route.
- Notification: current owner polling untouched; no new socket.
- Cache: actor+project scopes, all affected list/count invalidation; focus/online30s foreground.
- Security: nonmanager/unknown/session boundary/late responses.
- i18n/a11y: plural exact count,99+, native controls/links/44px/TR-EN-DE.
- Tests: proposed invitation-badges/sidebar-team-menu; existing navigation/invitation/cache/demo.
### Checklist
- [x] 4.1 Distinct count hooks/keys, same source for sidebar/headings; unknown/error not0, >99 display bounded/exact SR label.
- [x] 4.2 Parent/default/current-child/manual toggle + canonical/alias routes; manager child, no-project, collapse flyout/mobile drawer close/focus.
- [x] 4.3 Create/accept/reject/cancel/resend/expiry/team-delete/external/legacy family invalidation and foreground new invite refresh; no reload.
- [x] 4.4 A/B counts0→1→2→1→0, scoped project counts and late actor/project responses; keyboard/touch/drawer/demo/current navbar/history regressions.
### Definition of Done
- [x] Incoming and outgoing counts never mixed; own fresh pending data visible in both relevant surfaces.
- [x] Nested nav discoverable/current correct in all sidebar modes; targeted real API/DB/cache/i18n/a11y tests pass.

## Task 5 — Existing create-banner preview/lifecycle kabulü

### Amaç
Zaten bağlı olan thumbnail/card preview'yi gerçek choose/upload ve failure/cleanup ile kapat.
### Neden bu sırada?
Shared shell/navigation changes sonrası create/responsive preview regression somut ölçülür.
### Prerequisite
Task4 DoD.
### Etkilenecek alanlar
- Backend: existing project media validation/upload, no new route/storage.
- Database: actual created banner BYTEA/version only after upload.
- Frontend: BannerPickField/ImagePicker/usePickedImage/EntityCover/ProjectCard/PreviewPanel; scoped gap only.
- Navigation: dirty/cancel/success route and mobile preview anchor.
- Notification: no new notification on preview.
- Cache: existing project mutation roots/preview local state separate.
- Security: MIME/size/decode/backend authority; no SVG/remote fetch policy relaxation.
- i18n/a11y: label/error/remove/change,44px,contrast.
- Tests:11-project-banner/project-create/settings + proposed banner lifecycle/decode cases.
### Checklist
- [x] 5.1 Valid select before POST renders both picker/card; no backend upload on selection. Already-correct behavior unchanged.
- [x] 5.2 Replace/remove/reselect/cancel/unmount/create-fail/success URL cleanup; no stale async decode winner if scoped validator added.
- [x] 5.3 Empty/type/2 MiB/corrupt/load failure; visible safe error/draft policy, previous valid selection preserved; server still rejects unsafe uploads.
- [x] 5.4 Actual create→upload→DB→card, upload failure doesn't erase created project;320–1440/themes/languages/motion and current settings/logo/dock regression.
### Definition of Done
- [x] Preview before persistence works, no fake upload success; actual backend banner persists after valid save.
- [x] Lifecycle/error/a11y/responsive proof passed; reused existing media flow, no broad unrelated redesign.

## Task 6 — Invitation notification context UI / cache integration

### Amaç
Recipient Notification Center'da hangi proje olduğunu doğal yerelleştirilmiş metinle göster.
### Neden bu sırada?
Task3 persisted context hazır; shell/count/banner/source regressions tamam.
### Prerequisite
Task5 DoD (payload Task3).
### Etkilenecek alanlar
- Backend: Task3 own DTO/event contract.
- Database: real persisted context/read/snapshot records.
- Frontend: notification types/body/render/catalogs.
- Navigation: existing safe invitation/task/repository links; no dead project link.
- Notification: New/History/read/read-all/popup/repository/task preserved.
- Cache: actor query family + invitation mutation effects; no per-row project lookup.
- Security: nonmember safe project name, plain text/XSS/IDOR boundaries.
- i18n/a11y: natural TR/EN/DE created/accepted/rejected context, long names.
- Tests: proposed invitation-notification-context + read/history/popup/repository baseline.
### Checklist
- [x] 6.1 Structured context present→localized project name; absent→generic legacy fallback, no text parsing/fake name.
- [x] 6.2 A invites B to named project→DB/API/UI; creation name frozen after rename, future event current name; safe archived/hard-delete behavior.
- [x] 6.3 New→read→History same context; popupPresentedAt != readAt, account late responses protected; external/signup semantics retained.
- [x] 6.4 Quotes/HTML-like/long names/theme/mobile/three languages; no extra project/profile query, task/repository read-on-open integration preserved.
### Definition of Done
- [x] Fresh project invitation context visible/localized and persistent in history; privacy/legacy safe.
- [x] Targeted real notification/recipient/read/cache/i18n regressions pass; Organization deferred remains explicit.

## Task 7 — Combined real security/data/browser regression

### Amaç
Four surfaces + lifecycle + scope decisions birlikte doğrulansın.
### Neden bu sırada?
All implementations complete; full gate öncesi scope bugs çözülür.
### Prerequisite
Task6 DoD.
### Etkilenecek alanlar
- Backend: Project/Invitation/Notification/Organization capability contracts.
- Database: fresh prepared own QA UUID reads, migration/legacy/concurrency.
- Frontend: actual two-user flows/new specs + existing packages.
- Navigation: all expanded/collapsed/drawer/current/history/localized variants.
- Notification: project context snapshots, read/history/popup/repository.
- Cache: warm mutation/new arrival/expiry/session/actor/project boundary.
- Security: IDOR/CSRF/session/nonmanager/global ADMIN/expired/deleted targets.
- i18n/a11y:320/390/768/1024/1440,TR/EN/DE,light/dark/reduced motion,keyboard/touch/contrast/screenshots.
- Tests: normal success actual frontend/API/backend/PostgreSQL, faults/latency/expiry fixtures TEST-ONLY.
### Checklist
- [x] 7.1 Incoming2projects accept1/reject1, managed project pending2 cancel/resend/expiry, external acceptance, count/page/table/team membership snapshots.
- [x] 7.2 A→B late count/list/mutation; selected P→Q stale project count/flyout; real role/CSRF/IDOR guards preserved.
- [x] 7.3 Banner full lifecycle/actual DB/upload negative; no card mock success; corrupt decode vs backend header validation limits clear.
- [x] 7.4 Invitation name DB/API/UI/New/History/rename/legacy; existing repository new main and popup/read/task regressions.
- [x] 7.5 Full visual/focus/motion/header/drawer/history/demo acceptance; fix/retest; QA only own IDs cleanup, user data/volumes preserved.
### Definition of Done
- [x] Acceptance matrix command/exit/count/source/DB/screenshots recorded, no mock counted as normal success proof.
- [x] No unresolved scope bug; organization MISSING/deferred not fabricated integration/test.

## Task 8 — Full gate/docs/separate implementation completion

### Amaç
Current source quality gates ve user-reviewable ayrı teslim.
### Neden bu sırada?
Önceki DoD closed source'u doğrular; eski completion sayıları reuse edilmez.
### Prerequisite
Task7 DoD.
### Etkilenecek alanlar
- Backend: full Maven/Testcontainers and new context/expiry/permissions.
- Database: additive migration upgrade/constraints/legacy snapshot integrity.
- Frontend: lint/type/build/targeted+full Chromium/current runtime.
- Navigation: scoped design notes/existing placement.
- Notification: structured snapshot/read/history limits documented.
- Cache: actor/project/interval/invalidation proof.
- Security: §11 safe endpoint/body/query/auth/errors/Swagger inventory, no policy waiver.
- i18n/a11y: scoped web checklist notes, global boxes not blanket[x].
- Tests: canonical pre-push Docker build/start/health,3000/8080/Swagger restored.
### Checklist
- [x] 8.1 Backend full,frontend lint/TypeScript/production build,targeted/full Chromium PASS; skips/failures recorded honestly.
- [x] 8.2 Root ./pre-push/pre-push.cmd exit0 includes backend/Docker; current image/schema verified; only own processes restore, no quota/ENV weakening.
- [x] 8.3 API/security/database/architecture/folder/design/checklist scoped notes; organization Pending product decision explicit.
- [x] 8.4 Actual-date `docs/compliation/YYYY-MM-DD-project-invitations-create-ux.md`, README format/prompt headings/manual controls/API examples.
- [x] 8.5 Final HEAD/index/prompt/user files protected; no commit/push/staging/pull/merge; QA own UUID cleanup/debt reported.
### Definition of Done
- [x] All previous DoD/full regression/canonical gate PASSED, backend skip never PASS.
- [x] Separate completion ready; only approved scope with no blocker says `Kalan blocker yok.`; independent debt/organization decision visible.

## 4. Validation ve teslim

Validation route executed; exact per-stage commands/exit/count and real test names are in verification entries and separate completion. The command block documents the route, not a substitute for those results:

```powershell
Push-Location backend
.\mvnw.cmd '-Dtest=ProjectInvitationServiceTest,ProjectInvitationApiIntegrationTest,ProjectInvitationRepositoryTest,NotificationIntegrationTest,NotificationReadStateIntegrationTest,TeamDeletionNotificationIntegrationTest,ProjectApiIntegrationTest' clean test
# New invitation-context migration/event/API tests and actual repository notification tests eklenir.
.\mvnw.cmd clean verify
Pop-Location
Push-Location frontend
npm.cmd run lint
npx.cmd tsc --noEmit
npm.cmd run build
npx.cmd playwright test e2e/10-global-invitations.spec.ts e2e/invitation-remediation.spec.ts e2e/invitations-errors.spec.ts e2e/11-project-banner.spec.ts e2e/project-create-page.spec.ts e2e/notification-history.spec.ts --project=chromium
# New badges/nested-nav/banner-lifecycle/context and current repository specs eklenir.
npx.cmd playwright test --project=chromium
Pop-Location
.\pre-push\pre-push.cmd
```

Final headings: Final verdict; Task checklist; Invitation domain audit; Sidebar Teams navigation; Global incoming invitation badge; Project team invitation badge; Project creation banner preview; Project invitation notification context; Organization invitation capability; Cache / polling behavior; Authorization / account isolation; Responsive / accessibility / i18n; Changed files; Test results; Remaining issues.

| Prompt | Plan |
| --- | --- |
|1–2,7–14,30,33–35,40–43 |Two count contracts/effective pending/scopes/cache,Task1/2/4/7 |
|3–6,36,44 |Route-aware nested nav/collapse/drawer/a11y,Task4/7 |
|15–20,38,45 |Existing preview/validation/lifecycle/persistence,Task5/7 |
|21–25,32,46 |Immutable safe invitation context/legacy/rename,Task3/6/7 |
|26–29,31,47 |Organization audit MISSING and approved defer,scope gate |
|37,39,48 +33 critical rules |Accessible true counts/real data/ordered DoD/full gate/Git preservation,Task1–8 |

**İlk plan tesliminin tarihsel sınırı:** root plan yazıldı; current source/doküman audit'i ve ürün kararları toplandı. Production/test/config/schema/package/lock değişmedi; runtime/tests/gate çalıştırılmadı; implementation completion oluşturulmadı. Agent commit/push/staging/pull/merge yapmadı. Kullanıcı planı onaylayınca Task1'den başlanır.

## Implementation verification

### Task 1 - 2026-10-07

Current HEAD677607e/index/prompt baseline preserved; source baseline copied to `.local/project-invitations-create-implementation/baseline.json`. V59 highest, V60 slot currently free. Approved archived-project incoming PENDING exclusion and Organization MISSING/deferred frozen; incoming/project-managed counts remain separate from notification unread. Existing repository callback TS2345 reproduced; fixed through guarded read.execute with canceled navigation when actor/submission guard fails. Real own notification PATCH200/DB read/history regression1 PASS (repository snapshot is explicitly TEST-ONLY QA fixture, no route.fulfill); existing baseline32 Chromium PASS. Current lint/TypeScript/production build exit0. Backend initial64 had1 timestamp fixture failure: PostgreSQL rounded nanoseconds rather than truncating; fixture now uses microsecond input, same64 tests rerun0 failure/error/skip, BUILD SUCCESS/exit0. Existing GitHub UI fixture tests are contract-only, not live GitHub acceptance; invitation/banner/read successes use real backend/PostgreSQL. npm audit5 high dev/exit1, production0/exit0; packages/ENV/quotas unchanged. Current backend image build/start, Docker29.8.1/JDK25.0.1/Node24.19.0; Next dev restored, frontend/backend/Swagger/API docs200. Logs: task1-backend-final.log, `.local/notification-history/project-task1-*` and project-task1-repo-read-*. No full gate/completion claim.

### Task 2 - 2026-10-07

Incoming recipient PENDING repository query now applies active-project EXISTS in the same DB predicate used for content and totals; no new endpoint/table/client filter. Unfiltered history and physical archived PENDING rows retained. Real PostgreSQL0/1/2/101 totals, page1/page20, exact expiry boundary, accepted/rejected/cancelled/foreign recipient exclusion verified; size1 own API and ignored arbitrary recipient parameter preserve principal scope. Existing project manager totals and lifecycle/unique/roles/team/CSRF/expiry regressions retained. Clean targeted backend45 tests0 failure/error/skip exit0; current lint/type/build0 plus9 Chromium PASS against rebuilt current backend (external registration, global flow, account isolation, warm legacy/external accept, expiry, real archived pending contract). Normal success no route.fulfill; only QA timestamp/data fixtures explicitly TEST-ONLY. Logs task2-backend.log and `.local/notification-history/project-task2-*`. DoD complete; Task3 follows.

### Task 3 - 2026-10-07

V60 additive nullable invitation_project_name/context subset CHECK; existing V56/57/59 columns and old rows/events retained. Created/Accepted/Rejected scalar events gain nullable name with compatible constructors; producer existing locked Project names captured at event time. Notification module imports only public events, no Project repository/entity. Existing AFTER_COMMIT/REQUIRES_NEW recipient/self policy unchanged; generic legacy messages/read/popup retained, DTO/TS context additive. V59 upgrade preserves readAt/task/team/popup/repository snapshots exactly; bounded/invalid-scope constraints tested. Real create/resend/reject/accept/rename/history API, own scope, rollback and serialized pre-context events pass. Main targeted64 backend0 failure/error/skip exit0 including Modularity/V56/claim/read/repository; extra external registration+signed-in accept context2 PASS exit0, no fabricated external Created. Lint/TypeScript exit0. Logs task3-backend.log, task3-external-context.log, task3-lint/types.log. Frontend localized rendering belongs to Task6; no feature/full-gate completion claim.

### Task 4 - 2026-10-07

Actor-scoped incoming/project-managed one-row totals, shared 99+ badge with exact accessible count, heading/sidebar consumers and foreground30s/focus/reconnect freshness implemented. Existing family invalidation/session abort cleanup reused; no notification count mixing/new endpoint/socket. General30s staleTime initially suppressed fresh focus totals; scoped staleTime0 fixed and real0-1-2-1-0 flow passed. Teams disclosure uses existing ?section=teams canonical list, route/alias-aware children, manager gate, project/actor/logical-route key, mobile drawer and collapsed nonmodal flyout; current navbar/reserve unchanged. Initial incorrect /teams list URL produced404 and was fixed; old entry-point fixtures adapted without dropping business assertions. Current lint/type/build0, final combined28 PASS+1 geometry sampling failure; same current-source2 real badge tests rerunPASS after settled strict44px assertion (no source/threshold relaxation). This closes all29 targeted tests including real account switch/late responses, expiry/legacy/external warm cache, Teams, native/PDA history, three-language101-row bounded QA DB fixture and320px mobile. Landing reference fixtures remain TEST-ONLY; demo sends no backend requests. git diff --check0. Logs project-task4-verified-* and project-task4-geometry-final-*; earlier failed runs not PASS. Full gate pending.

### Task 5 - 2026-10-08

Existing picker/card/usePickedImage and POST-then-PUT flow reused. Corrupt banner missing-error/previous-preview loss reproduced by expected red1; opt-in create-banner decode validation adds bounded generation cleanup, bitmap close/temp URL revoke, previous-valid preservation and TR/EN/DE alert. Other ImagePicker consumers retain default validation. Replace/remove/reselect/unmount, delayed native decode TEST-ONLY, no upload on selection, real create PUT204/fresh PostgreSQL byte length+version/warm card and controlled negative create/upload passed. Test locator initially matched Next route announcer too, scoped to actual inline alert; original API204 expectation corrected, not changed. Current lint/type/build0 and34 ChromiumPASS; final30-cell five-width/two-theme/three-language/reduced-motion matrix found German320 footer328px. Scoped sticky row wrap fixed; current lint/type/build0 +13 final ChromiumPASS, strict no overflow/mobile44 plus sticky/responsive chat. Ten screenshot artifacts inspected for light320/dark1440/error/card/header tokens. Logs project-task5-verified-* and project-task5-responsive-verified-*; earlier failures not PASS. Full gate pending.

### Task 6 - 2026-10-08

Created/Accepted/Rejected invitationContext renders event-time projectName in natural TR/EN/DE plain text; null/absent snapshots keep existing generic localized fallback. No per-row project lookup or dead invitation project link; Repository/task read-on-open and owner read/popup semantics unchanged. Current lint/type/build0 +12 real ChromiumPASS and extended three-language created/accepted/rejected1 PASS. Fresh own notification API, PostgreSQL read/presented separation, rename/future event, New-to-History retention, HTML-like quoted long name/mobile bounds, no extra backend project query, own legacy-null QA fixture and existing account late response/read-all/multitab/foreground popup/repository regressions verified. Initial measurement counted Next code prefetch as project REST and was correctly restricted to API paths; failed run not PASS. Legacy-null fixture explicitly TEST-ONLY on own new notification, all normal successful invitation paths use real backend/DB. Logs project-task6-final-* and project-task6-language-final-*, screenshots task6-*. Full gate pending.

### Task 7 - 2026-10-08

Combined current-source clean backend83 tests0 failure/error/skip exit0; frontend lint/type/build0 +34 real ChromiumPASS. Own incoming versus manager count, archived pending retained history/exclusion, UI mutation/warm cache/expiry/legacy/external/real429, actor late responses, banner negative/lifecycle/fresh DB, invitation context/read/repository, desktop/mobile/sidebar/drawer/native history/full-chat/chat motion and landing isolation passed together. Explicit visibility guard hides cached managed totals when manager gate/contained enablement is false; count failure now suppresses both stale number and fake0, actual response retry restores2 without reload. Final2 real count/nav testsPASS with exact101 aria/99+, three-language sidebar child scroll bounds and320 mobile; screenshots inspected (German nav/TR mobile/dark desktop). QA100-row page/legacy null/expiry/transport/delayed native decode are clearly TEST-ONLY; no route.fulfill in normal new success flows. New tests archive their own project IDs via existing API; user records/volumes not deleted, archived/account or older fixture metadata may remain. Logs task7-backend.log, project-task7-* and project-task7-nav-final-*. Organization remains out of scope. DoD complete; canonical full gate follows, not yet PASS.

### Task 8 - 2026-10-08

Current final canonical .\pre-push\pre-push.cmd PASSED exit0: backend548 tests0 failure/error/skip; full Chromium328 PASS+1 expected disabled production crash-route skip; lint/TypeScript/production build and Docker build/start/HTTP smoke passed. First canonical548 backend PASS/E2E306 PASS+6 failures+1 expected skip+16 not run; second548 backend PASS/E2E327 PASS+1 failure+1 expected skip, both exit1 and not PASS. Shared-recipient baseline/stale metadata/hidden disclosure fixtures corrected with genuine isolated invitation registration/current principal/disclosure navigation. Safe DOM geometry proved implicit auto grid track overflow, fixed with explicit one-column minimum; target47 PASS. Second real429 exposed fixture registration budget; manager-run-specific private recipient reuse keeps default policy intact, quota target9 PASS. Final full rerun passed without retries/timeout/policy relaxation.

API/database/architecture/folder/design/SECURITY11/checklist scoped notes updated; separate completion `docs/compliation/2026-10-08-project-invitations-create-ux.md`. Next dev restored; post-cleanup frontend3000/backend8080/Swagger/apiDocs200, new invitationContext schema, actual Flyway60. Docker backend running/HTTP200 and postgres healthy.46 current-suite own project UUIDs archived through existing authenticated API; no user/volume deletion, older QA/account/archive metadata may remain. HEAD/index/prompt unchanged; protected old migrations/package files60 unchanged, staged0 and git diff --check0. No commit/push/staging/pull/merge.

Independent audit now6 high/full exit1 and1 high/production exit1 (Next16.3.6), baseline5/production0 historical; reviewed advisory links/16.3.8 patched candidate and limited source-reachability bounds recorded. Packages untouched; separate dependency decision required, no global blocker-free or release waiver claim. Organization remains MISSING FEATURE/approved deferred. Evidence final-source-evidence.json/final-runtime.json/qa-cleanup.json/pre-push.log; two failed canonical logs preserved. All approved task DoD closed.
