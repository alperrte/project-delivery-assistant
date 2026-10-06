# Squad Service Modernization

## Final verdict

2026-10-06. **Onaylı kapsam tamamlandı; Tasks1–10 DoD kapalı. Canonical pre-push PASSED, exit0.**

[Source of truth planı](../../PDA_SQUAD_SERVICE_MODERNIZATION_PLAN.md) sırasıyla uygulandı: implementation → targeted test → gerekli fix/retest → DoD → checkbox → next task. Branch `squad-service-backend`, HEAD `faa61df`; index boş ve başlangıç HEAD/user prompt korundu. Commit/push/staging/pull/merge yapılmadı.

Full gate: **506 backend tests,0 failure/error/skip;272 Chromium passed+1 expected skip; lint/TypeScript/production build/Docker build/start/health PASS.** Final frontend3000/backend8080/Swagger/OpenAPI HTTP200; yeni claim ve teamDeletion schema doğrulandı. Backend/PostgreSQL Docker çalışıyor; gate sonrası Next dev hidden başlatıldı.

Bağımsız **sharp production security follow-up açık**; güncel audit6 high/production1. Bu kayıt release güvenlik onayı değildir. Onaylı Squad kapsamında açık functional bug/gate failure kalmadı.

## Task checklist

| Task | Durum / kanıt |
| --- | --- |
|1 Preflight/contracts |[x] Current runtime, source/hash,63 backend+18 Chromium baseline |
|2 Additive notification foundation |[x] V56→V57/legacy/check/dedup/JPA;10 backend |
|3 Delete lifecycle/locking/snapshot |[x] Clean77 backend;11 concurrency scenarios, SIMPLE/ADVANCED pool |
|4 Fanout/recovery/own claim |[x]37 backend; rollback/replay/503-recipient batch/atomic claim |
|5 Center/popup/account boundary |[x]22 targeted Chromium; actual offline/foreground/two-context chains |
|6 Delete UX/cache/navigation |[x]25 targeted Chromium; retained DB/remote detail/guards |
|7 Identity/preview/performance |[x]58 backend+16 Chromium; size30=11,size100=11;101 actual teams |
|8 Invitations/role presentation |[x]38 backend+14 Chromium; real eight-role form/lifecycle/visual matrix |
|9 Combined regression |[x]132 backend+56 Chromium; new security/page-shrink/warm-add cases |
|10 Full gate/docs/final preservation |[x] Canonical exit0;506 backend+272 Chromium/1 expected skip; final health/hash/index |

## Team deletion lifecycle

Üründe **Sil**, mevcut `DELETE /projects/{p}/teams/{t}` ve backend `deleteTeam`; legacy squad archive adapters aynı use-case'e yönlenir. `squads.archived_at` reuse edilir. Team/member/history rows ve task/invitation FK UUID'leri tutulur; project membership, sibling/project/task/status/assignment/comment/activity silinmez. Hard-delete/reopen/automatic General Team yok.

Children409 ve last-team orphan409 korunur. Live pending invitations CANCELLED; elapsed physical PENDING EXPIRED. Inactive team'e invitation create/resend/accept grant üretmez. İlk delete bir204/event; tekrar/deleted/wrong scoped ID404, ikinci event yok.

Existing project lock → UUID-ordered team locks → invitation lock/fresh revalidation sırası kullanılır. Duplicate delete, child create/move, member add/removal, manager demotion, rename, stale external preview ve delete-vs-accept gerçek bounded barriers ile doğrulandı. Demotion testinde eski attached role cache gerçek red üretti; mevcut RolePolicy üstünde fresh active-role scalar read ile giderildi.

**Onaylı pool davranışı korundu:** retained team target UUID geçmişte kalır; deleted target mevcut project pool claim/release'i kısıtlamaz. SIMPLE/ADVANCED tasks ve history retained; confirmation bu etkiyi açıklar.

## Notification persistence

Immutable public TeamDeleted event; eventId, active ProjectMembership recipient IDs, project/team/actor display snapshot ve occurredAt deletion transaction'ında alınır. Actor hariçtir; entity/repository event payload değildir.

AFTER_COMMIT → tek REQUIRES_NEW fanout transaction → JDBC chunks500. V57 event/recipient unique dedup replay'i güvenli yapar. Rollback'ta kayıt yok. Partial writer failure fanout transaction'ını rollback eder; committed deletion kalır. Existing Modulith registry üzerinden yalnız aged TeamDeleted için60s/max50 retry-age guarded recovery vardır; Task event recovery modeli değişmedi. Gerçek503-recipient boundary ve failure→registry replay→dedup testleri geçti.

V57 scalar snapshot/presentation kolonları, consistency CHECK ve claim partial index additive'dir. Önceki migration'lar/V56 task snapshot/read history değişmedi.

## Login / active-session popup

Own atomic claim oldest unread/unpresented SQUAD_DELETED kaydını en fazla bir tane alır. Presentation timestamp kalıcıdır; read/readAt/unread count ayrı kalır. Aynı kayıt iki context/device tarafından claim edilemez.

Semantics **at-most-once presentation grant**: commit sonrası response kaybolursa popup kaçabilir; kalıcı history kalır. Lease/ACK/exactly-once visual delivery yok. Frontend mutation automatic retry ile sonraki kaydı tüketmez.

Authenticated foreground AppShell initialization/focus/reconnect/30s loop; hidden/offline/logout/demo claim etmez. Tek outstanding claim/aktif Sonner toast, close button ve focus çalmayan bilgi sunumu. Center mevcut server pagination/list/count/read/read-all ile bağlı; V56 structured task ve legacy body sunumu korunur. Deleted team detail link'i sunulmaz.

## Team card member previews

Mevcut deterministic newest5 window/count altyapısı üstünde authorized membership IDs → safe UserAccounts batch profiles. Additive firstName/lastName; email/global directory/auth response genişlemesi yok. Cards metadata/member REST lookup yapmaz; mevcut photo media requests normaldir.

Gerçek100-team/500-member PostgreSQL fixture'da prepared statements **size30=11,size100=11**. Başlangıçtaki13/16 artışı authorized membership batch'inde roles fetch ile giderildi. Gerçek101-team runtime dataset server pages0/1 kullanır; list/cards per-team members GET üretmez. Bu ölçüm sınırsız ölçek/latency garantisi değildir.

## Profile photo / initials behavior

Gerçek onboarding A.T/N.C/M.Y, PostgreSQL K.K/H.T profilleri, nullable-name nickname/unknown fallback ve Unicode/combining/Türkçe casing doğrulandı. Initials gerçek isimde ilk/son meaningful token grapheme'inden gelir; nickname'den soyad üretilmez.

Scoped preview fotoğraf/fallback, avatar altında initials, beş kişi ve doğru +N/count gösterir. Gerçek upload/decode ve açık TEST-ONLY image failure fallback geçti. Generic AvatarStack consumers korunur. Üye add/remove UI mutation→warm list client navigation document marker'ı korudu.320/390/768/1024/1440, üç dil ve iki tema screenshots incelendi; scoped grid minimum-width overflow giderildi.

## Team invitations modernization

Mevcut semantic desktop table/mobile cards, gerçek team/target/status/date/actions, principal keys ve server status/page20 korunur. Authorized page mapper tek batch'te safe inviter nickname/photo version ve target photo version sağlar. Missing/inactive inviter localized unavailable; UUID isim diye sunulmaz.

Actual form201→eight roles, fresh-ID resend/cancel, recipient accept→fresh PostgreSQL exact roles/team ve önceki reject/expiry/reinvite/legacy warm cache/external signed-in/account switch/429 regressions geçti. Error stale rows ile birlikte sunulmaz;21-row page2 cancel→20-row living page clamp reload olmadan doğrulandı. Page dataset açık TEST-ONLY prepared own-template fixture'dır; mevcut10-create quota değiştirilmedi.

## Role icon mapping

| Role | Phosphor icon |
| --- | --- |
|PROJECT_MANAGER |Crown |
|BACKEND_DEVELOPER |BracketsCurly |
|FRONTEND_DEVELOPER |Code |
|FULL_STACK_DEVELOPER |Stack |
|AI_ML_DEVELOPER |Brain |
|UI_UX_DEVELOPER |Palette |
|TESTER |Flask |
|ANALYST |ChartLine |

Mapping exhaustive; selector/badges ortak presenter, TR/EN/DE labels, decorative icons ve44px selector/action hedefleri. German multiline badge clipping screenshot'ta bulunup scoped content height ile giderildi ve bounds assertion eklenerek yeniden test edildi. Renk/ikon permission boundary değildir.

## Authorization / security

Existing active project permissions, cookie session, CSRF/CORS, quotas ve RolePolicy korunur. Yeni authenticated matcher yalnız exact own claim POST'tur. Team deletion manager-only; ADMIN nonmember, normal/non-team viewer, removed/disabled account, wrong project ve missing CSRF HTTP matrix geçti. Reddedilen delete DB'yi değiştirmez ve notification yaratmaz.

Base `/api/v1`. Swagger `http://localhost:8080/swagger-ui/index.html`, `/v3/api-docs`; normal login ve mutation CSRF. [SECURITY §11](../../.agents/SECURITY.md#11-api-and-swagger-security) güncellendi.

| Method/path | Auth/scope ve request | Success / önemli errors |
| --- | --- | --- |
|DELETE `/projects/{p}/teams/{t}` |Active PROJECT_MANAGER/SQUAD_MANAGE+CSRF; no body |204 retained delete;403,404,409 children/orphan |
|POST `/projects/{p}/squads/{t}/archive` |Legacy adapter, aynı manager+CSRF/no body |Aynı use-case/status/errors; breaking removal yok |
|GET `/projects/{p}/teams`, `/{t}` |PROJECT_VIEW; list page≥0/size1..100 |200 additive memberPreview;400,401,403,404 detail |
|GET `/projects/{p}/invitations`, `/all` |Manager; status?/page/size |200 safe batch display/no token;400,401,403 |
|GET `/notifications` |Own session;page/size/unreadOnly/type |200 own page + nullable teamDeletion/popupPresentedAt;400,401 |
|GET `/notifications/unread-count` |Own session |200 count;401 |
|PATCH `/notifications/{id}/read`, `/read-all` |Own session+CSRF;no body |200 notification/count;400,401,403,404 foreign ID |
|POST `/notifications/team-deletions/claim` |Own session+CSRF;no body/actor/ID |200 one own snapshot or204;400 nonempty body,401,403;private/no-store |

Safe team create: `{"name":"Example Team","includeCreator":true}`. Delete/claim body yok. Malformed UUID/validation400; no active session401; unauthorized/CSRF403. Yeni public route veya global directory/media endpoint yok; previous invitation mutation contracts korunur.

## Cache behavior

Notifications actor-scoped keys + AbortSignal/lifetime guards/cancel-remove/toast dismissal; sign-in/out/register/account switch önceki principal'ın late response/history/toast'ını göstermez. Private/auth data browser storage'a yazılmaz.

Delete affected team/list/detail/roster/candidates, project membership/invitation/task and own notification families'i stale yapar. Detail/list bounded foreground refetch/refocus;404 living Teams route'a bir kere replace. Hard reload çözüm olarak kullanılmadı. Navbar viewport-centered konumu/reserve, contained demo inert/disabled ve FULLSCREEN→CLOSED / COMPACT-BAR persistence/history davranışları regression'dan geçti.

## Changed files

- Backend lifecycle/contracts: [SquadService](../../backend/src/main/java/com/pda/squad/application/service/SquadService.java), [SquadLifecycleEvents](../../backend/src/main/java/com/pda/squad/SquadLifecycleEvents.java), ProjectAccess/ProjectTeamContext, ProjectInvitationService/repositories, TeamController/TeamView, UserAccounts/UserAccountService.
- Persistence/delivery: [V57](../../backend/src/main/resources/db/migration/V57__team_deletion_notifications.sql), [fanout store](../../backend/src/main/java/com/pda/notification/application/TeamDeletionNotificationStore.java), [recovery](../../backend/src/main/java/com/pda/notification/application/TeamDeletionPublicationRecovery.java), Notification entity/factory/service/controller/type, exact security matcher.
- Frontend: [notification owner](../../frontend/src/features/notifications/notification-owner.tsx), [center](../../frontend/src/features/notifications/components/notification-center.tsx), [DeleteTeamButton](../../frontend/src/features/squads/components/delete-team-button.tsx), team cache/list/detail/card/initials/preview, invitations page/fields, [role presenter](../../frontend/src/features/projects/role-presentation.tsx), shared ConfirmDialog/Sonner, auth boundary cleanup, catalogs.
- Tests: TeamDeletion factory/migration/integration/concurrency/recovery, existing Squad/Invitation integration extensions; real deletion/notification/preview/invitation modernization and prepared DB helpers; existing landing mock reference and synchronous header geometry diagnostic update.
- Docs: source plan; scoped SECURITY/API/database/architecture/folder/design/web checklist notes. Global checklist kutuları topluca[x] yapılmadı.

## Test results

| Command / stage | Result |
| --- | --- |
|Task7 clean targeted Maven |58/0/0/0, exit0; prepared11/11 |
|Task8 clean targeted Maven |38/0/0/0, exit0 |
|Task9 combined clean targeted Maven |132/0/0/0, exit0 |
|Task9 frontend lint / `npx.cmd tsc --noEmit` / build |exit0 |
|Task9 combined Chromium package |56 passed, exit0 |
|Canonical `backend/mvnw.cmd clean verify` |506 tests,0 failure/error/skip; BUILD SUCCESS |
|Canonical lint/TypeScript/production build |exit0 |
|Canonical `npm.cmd run test:e2e` |272 Chromium passed+1 expected skip;exit0/retries0 |
|`./pre-push/pre-push.cmd` |**PASSED exit0**, full backend/frontend/E2E/Docker build/start/health |
|Final3000/8080/Swagger/OpenAPI |HTTP200; claim/teamDeletion schema verified |
|`npm.cmd audit --json` / `--omit=dev --json` |6 high /1 high; both exit1, separate dependency follow-up |

Tek skip existing production controlled crash route disabled olduğu için `error-pages.spec.ts` expected skip'idir; backend/Testcontainers skipped0. İlk demotion red, Docker DNS, Maven clean file lock, yanlış breadcrumb/icon locator, scoped grid overflow ve German clipping düzeltildi/retested; failed attempts PASS sayılmadı.

Normal yeni başarı akışları gerçek backend/PostgreSQL/Chromium kullanır. Pure/cache tests ve mevcut UI contract/reference mocks ayrı kanıttır; persistence proof sayılmaz. Network abort/latency/late real-response relay ve expiry/page dataset fixtures açık TEST-ONLY. Private source/log/JUnit/screenshots `.local/squad-modernization/`; raw auth/token/password trace yayınlanmadı.

Başarılı cases own QA IDs'i archive eder. Sekiz failed-setup leftover project exact QA owner/name/UUID doğrulandıktan sonra gerçek archive API ile temizlendi. User/account rows, archived history ve volume'ler silinmedi. Final HEAD/index/prompt ve60 protected tracked-file hashes doğrulandı; old migrations/package/lock/Compose/RolePolicy değişmedi.

## Remaining issues

Onaylı Squad functional scope ve quality gate kapalı. **Independent dependency follow-up açık:** installed `sharp@0.35.4`, reviewed GHSA-wq5f-xc86-pv6w; affected<0.35.5, patched0.35.5. Upstream koşullu glibc Linux/librsvg SVG memory vulnerability bildiriyor. PDA exploit/runtime reachability yeniden üretilmedi; production audit classification exploit proof değildir. [Reviewed advisory](https://github.com/advisories/GHSA-wq5f-xc86-pv6w).

Source-map-js1.2.2 korunur; existing ESLint/braces5 high dev debt sürer. Bu task package/lock update yapmadı; ayrı compatible sharp patch kararı gerekir. Global release waiver verilmedi. At-most-once lost-response tradeoff ve retained soft-delete/pool semantiği onaylı sınırlardır; reopen/hard-delete/automatic transfer kapsam dışıdır.

### Kullanıcı kontrolü

1. QA backup ekipleriyle manager olarak Sil dialog'unu kontrol et; children/last-team409 açıklamaları görünmeli. Gerçek kullanıcı ekibini test amaçlı silme; reopen yok.
2. İki QA member session'da delete sonrası online30s/offline login popup; close→center history→reload tekrar popup yok. Actor notification almamalı; iki context aynı grant'i paylaşamaz.
3. Aynı sekmede logout→başka QA account login; önceki notification/invitation/preview/toast görünmemeli.
4. Team cards gerçek fotoğraf/initials/+N; UI add/remove→client list navigation; uzun isimler/mobile/tema ve üç dili kontrol et.
5. Davet formu/listesi sekiz ikonlu rol, gerçek inviter/status; resend/cancel/accept ve page shrink güncel olmalı. Sidebar/navbar önceki merkez konumunda kalmalı; chat/history/pool davranışı korunmalı.
6. [Planı](../../PDA_SQUAD_SERVICE_MODERNIZATION_PLAN.md), bu ayrı implementation kaydını ve sharp follow-up'ını incele. Commit/push/staging kullanıcıya bırakıldı.
