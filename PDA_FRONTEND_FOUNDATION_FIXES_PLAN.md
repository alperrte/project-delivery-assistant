# PDA — Frontend Foundation Fixes Planı

Tarih: 2026-10-06. Durum: **Tasks1–8 complete; canonical full gate PASSED — 2026-10-07.**

Source of truth: `.agents/PDA_Frontend_Foundation_Fixes_Plan_and_Implementation.md` dosyasının çalışma modeli, A–D kapsamı, test matrisi, teslim formatı ve25 kritik kuralının tamamı okundu. Root rehber/core belgeleri, SECURITY/auth ADR, frontend CLAUDE→AGENTS, workflow/design kuralları, globals.css ve mevcut kaynak incelendi. Kullanıcı onayıyla bu dosya implementation source of truth olarak kullanıldı.

Her task: **implementation → targeted test → bug fix/retest → DoD → checkbox `[x]` → sonraki bağımlı task**. İlk plan tesliminde implementation kutuları açıktı; kullanıcı onayıyla uygulandı. Güncel verification kayıtları aşağıdadır; eski completion/gate sayıları bu özelliğin kanıtı değildir.

## 1. Güncel kaynak ve Git sınırı

- Branch `general-features`, HEAD `ad1bc66`; başlangıçta yalnız kullanıcının foundation prompt'u untracked. Index boş. Önceki merge artık tamamlanmış; unmerged entry yok.
- Bu plan mevcut local HEAD'i esas alır. Fetch/pull/merge/branch değişimi yapılmaz; implementation preflight source drift'i yeniden kontrol eder.
- Yeni task bu tur production/backend/frontend/test/config değişikliği yapmaz. Runtime baseline/reproduction/test/gate implementation Task1'de alınır; bu tur servis durdurma/rebuild yoktur.
- Private hash/index/prompt evidence `.local/frontend-foundation-plan/`; secret/token/cookie veya raw history query değerleri raporlanmaz.

## 2. Gerçek kaynak bulguları

| Alan | Kaynak / mevcut davranış | Plan etkisi |
| --- | --- | --- |
| Username | `User.nickname`, `RegisterRequest`, `InvitationRegisterRequest`: Unicode letters/numbers/underscore,3–32; `uk_users_nickname` UNIQUE | UI username mevcut nickname alanıdır; yeni username kolonu yok |
| Login / identity | `LocalLoginService` email+password; `JwtTokens` subject UUID; `JwtCookieAuthenticationFilter` session aktifliği ve fresh active UserAccounts lookup | Rename email/UUID/session/refresh/provider identity'yi değiştirmez |
| Gerçek isim | firstName/lastName ayrı nullable alanlar; safe batch profiles/team initials bunları kullanır; OAuth displayName nickname üretim girdisidir | Kullanıcı adı düzenlemesi gerçek isim düzenlemesi değildir; fullname/initials uydurulmaz |
| Own profile | `ProfileSection` readonly `<dl>` nickname/email; accountApi yalnız photo PUT/DELETE; User API'de preferences/photo var | Nickname destekleyen profile update endpoint yok; minimal own profile PUT gerekir |
| Concurrent User writes | Photo replace/remove ve password change/reset User entity yükleyip değiştirir; User üzerinde DynamicUpdate/version yok | Rename'ın başka User write tarafından geri alınması riskini barrier ile doğrula; minimum field-write koruması planla |
| Cache/session | `sessionQueryKey=["session"]`; projects members/squads/home/chat; tasks; actor-scoped invitation/notification families | Session DTO fresh set + gerçek identity-dependent families; queryClient.clear yok |
| Auto-hide | `useAutoHide`: IDLE_MS700, TOP_ZONE24, downward threshold80; upward `show()` clearIdle yapar, scheduleHide çağırmaz | Source-level missing re-arm nedeni; gerçek bottom/up/idle red Task1'de alınır |
| Interaction lifecycle | Hover/focus/trigger attrs guards; focusout RAF handle cleanup yok; mobile drawer state AppHeader'a taşınmıyor; reveal yalnız setHidden(false) | Tek scheduling yolu, cancellable cleanup ve owned drawer/popup guard gerekir |
| Touch | Mevcut `(hover:none)` idle timer'ı bypass eder | Kullanıcı yeni karar verdi: **touch/mobile da700ms idle hide** |
| History | `workspace-history.ts` yalnız native canGoBack/Forward/currentEntry.index okur; target URL/entries yok | Adjacent entry URL doğrulaması eklenmeli; same-origin yeterli değil |
| Routing | `matchPath` canonical TR/EN/DE+legacy aliases → logical PAGE_ROUTES; `(app)/layout` AppShell; auth/public ayrı | Route sınıflandırması mevcut matcher ve gerçek `(app)` route set'iyle yapılır |
| Navbar/chat | Header viewport-centered; responsive reserve128/72; history main inert dışında; provider logical pathname+section fullscreen close | Konum/reserve/chat semantics değişmez; traversal click'i chat'i erken kapatmaz |
| Scroll containers | AppShell nav `overflow-y-auto`; drawer ayrıca own overflow wrapper; normal main explicit scroller değil, document scroll | Ana scrollbar viewport/root'tur; main'i yeni scroller yaparak scroll/history bozma |
| Palette | Workspace primary black/white override; root/dark label-blue gerçek blue token | Scrollbar için primary'yi körlemesine kullanma; scoped semantic alias → label-blue |
| Scrollbar CSS | globals.css'te mevcut özel scrollbar kuralları yok | Root/sidebar/drawer-only standard + WebKit fallback; inherited color leakage kontrolü |

Bunlar source bulgularıdır; bu tur runtime bug reproduce/PASS iddiası yoktur.

## 3. Ürün / teknik sözleşmeler

### 3.1 Nickname update

- Minimum öneri: **PUT `/api/v1/users/me/profile`**, body `{"nickname":"Yeni_ad"}`, success200 current own user summary; existing `/auth/me` current-session source olarak kalır. Preferences endpoint interface defaults içindir; nickname'i oraya koyma. Yeni GET/global user edit/directory endpoint gerekmez.
- Actor yalnız authenticated principal UUID. Request'te foreign ID seçimi/role/email/password/firstName/lastName mass assignment yok. Exact authenticated PUT matcher + mevcut CSRF; deny-all ve forced-password/session restrictions korunur. Unauthenticated401, CSRF403, invalid400, duplicate409 coded ProblemDetail; private/no-store.
- Mevcut case-sensitive unique davranış korunur.3–32 Unicode letter/number/underscore; Türkçe karakterler mevcut kuraldaki gibi geçerli. Yeni reserved list/casefold/NFC/NFKC/backfill/index değişikliği yok. Trim contract frontend/backend aynı whitespace set'iyle Task1'de freeze edilir; NBSP/FEFF/combining/astral edge cases uyuşmazlığı test edilir. Codepoint sınırı ile HTML UTF-16 maxLength farkı dikkate alınır.
- Same-value normalized save no-op; DB unique constraint authoritative. Friendly precheck race garantisi değildir; save/flush named nickname constraint conflict409'a dar map edilir. İki farklı actor aynı nickname'e yarışınca yalnız biri commit eder.
- Own row update transaction; rename-vs-photo/password/stale User writes için gerçek barrier red/proof. Gerekirse User `@DynamicUpdate` gibi minimum dirty-field protection; auth/password/session/role workflow yeniden tasarlanmaz. Yeni optimistic version/migration varsayılmaz.
- Email login ve UUID/session identity korunur; cookies/token claims/provider subject değiştirilmez, forced logout/token rotation gerekmez. Current/future email login, refresh/session list/revoke, password/photo/admin/OAuth regression gerekir.

### 3.2 Name propagation ve history snapshots

- Fresh own DTO session key'e yalnız hâlâ aynı actor/lifetime ise yazılır. Başka account'a geçilmiş late response/mutation toast yeni account'u overwrite etmez; account-bound form draft reset olur.
- Live nickname gösteren header/profile/avatar/search/member/team/inviter/assignee/chat yüzeyleri gerçek cached projections üzerinden tazelenir. Current user hard reload/logout/login yapmaz; userid/selected project aynı olduğundan chat owner generation/draft/reply/outbox reset edilmez.
- Task1 her consumer'ı **live projection / immutable historical snapshot / form-local selected identity** diye kayıtlar. Live fields refresh edilir; açık form selection UID'leri korunarak labels fresh lookup'tan resolve edilir. Task status/team deletion event snapshot actorNickname ve gerçekten persisted quote/history snapshots eski olayı temsil eder; toplu historical rewrite yok. Gelecek event snapshot yeni nickname'i alır.
- Real first/last name gösteren team initials/fullname, nickname rename sonrası aynı kalabilir; nickname-only fallback ve nickname DTO field yeni değeri alır. Başka cihazın tüm ekranlarını anlık güncellemek için yeni socket/event infra eklenmez; mevcut reload/refocus/poll/REST/WS davranışı test edilir.
- Identity-dependent query predicate gerçek keys'e dayanır: session; projects/{p}/members/squads/home/chat; task parts/mine carrying user refs; invitation project/me/preview and notification actor families gerektiği kadar. Criteria/media/statistics gibi unrelated queries refetch edilmez; blanket clear yok.

### 3.3 Authenticated native history

- Current authenticated workspace ready ve normal session olmalı. Native capability true **ve adjacent actual entry URL** same-origin + recognized `(app)` route olduğunda button enabled. Current page de workspace olmalı. Cookie/session guard auth authority olarak kalır; classifier project permission grant etmez.
- Native `entries()`/currentEntry.index/entry.url readonly okunur; exact index±1 hedefi bulunur. Public/auth/login/register/change-password/forgot-password/landing/errors/dev/API/logout/unmatched/external/unreadable URL deny. Non-workspace entry'nin üstünden atlama yok.
- Existing `matchPath` TR/EN/DE canonical/legacy aliases resolver reuse. Protected route set actual `(app)` pages ile karşılaştırılan testle korunur; guessed `/tr` prefix veya manuel ziyaret stack'i yok. Legacy invitation accept `(app)` içinde ve user action gerektiriyor; route classification bunun gerçek layout'una göre yapılır.
- Query/section/tab/hash hedefi private route üzerindeyse korunur. Native URL'yi yeniden localize/navigate etmeye çalışma; action mevcut `router.back()/forward()` kalır. Action öncesi current actor/readiness/capability/adjacent URL tekrar kontrol edilir.
- Unsupported/missing entries/null URL/errors/SSR/pending distinct safe disabled; directional no-entry/public-boundary/unavailable reason localized Tooltip/aria description. `history.length`, referrer veya visited counter tahmini yok.
- Native entry list yalnız kısa ömürlü read snapshot; persisted/copied history database yok. push/replace interception, private Next state changes, Navigation intercept, browser shortcut intercept veya history clear yok. Live subscriptions currententrychange/completion/error/pageshow/popstate + session state; stable external-store snapshot/cleanup.
- Logout→login/account B ve BFCache/page-show freshness actual guards/cache ile test edilir. Me stale/unknown ise arrows safe disabled; UI'de önceki actor private frame görünmemeli. Somut auth flaw çıkarsa reproduction/kök neden ve minimum scoped çözüm raporlanır; auth security gevşetilmez.
- Actual logical pathname/section traversal FULLSCREEN→CLOSED; compact/bar aynı owner içinde persistent. Filter/hash/native no-op/disabled/failed action chat'i erken kapatmaz. Username rename tek başına navigation değildir.

Native reference: [entries](https://developer.mozilla.org/en-US/docs/Web/API/Navigation/entries), [entry.url](https://developer.mozilla.org/en-US/docs/Web/API/NavigationHistoryEntry/url). API/browser support feature detection ile doğrulanır; eski browser için tahmini fallback yok.

### 3.4 Auto-hide ve scrollbar

- **Kullanıcı kararı:** touch/mobile scroll durunca da mevcut700ms idle hide. Fine pointer hover, top-edge pointer reveal, header focus/focus-within, owned search/account/notification/locale/theme popup ve mobile drawer açıkken görünür tutulur.
- Source missing re-arm gerçek red'den sonra fix. Show/reveal/scroll/interaction-exit tek scheduler; repeated scroll idle reset, bir timer; focusout RAF/listener/observer/media cleanup. Touch pointerenter synthetic hover'ı sticky yapmamalı; focused button'u sırf hide için blur etme.
- Page-top için mevcut runtime davranışı freeze edilir: source initial desktop idle schedule yapıyor, unconditional always-visible top rule yok. User prompt'un koşullu top-preservation kuralını yeni product behavior uydurmadan uygula; top-edge pointer hold ile scrollY0 aynı kavram değildir.
- Drawer state narrow prop/guard ile AppShell→AppHeader hook'a aktarılabilir; header remount/konum değişimi yok. Popup portal life cycle/attrs actual primitive ile izlenir; kapanışta guard kalkınca idle resumes. Reduced motion timing intent'i değiştirmez.
- Scrollbar alias mevcut label-blue/light-dark token'a bağlı; thumb hover existing foreground/color-mix ile palette uyumlu. Root document viewport + actual sidebar nav + drawer intended scroll box explicit scope; main reparent/new scroll container yok.
- Standard scrollbar-color/width ve WebKit pseudo rules; visibility/wheel/keyboard/touch korunur, forced-colors auto/system colors. Root scrollbar-color inherited olduğundan body boundary reset/popup exclusions ölçülür; chat, textarea, code block, select/popover/modal and horizontal table computed scrollbar styles değişmemeli.
- [scrollbar-color](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/scrollbar-color) inheritance/viewport behavior reference; final actual CSS cascade/bounds/visual proof gerekir. Firefox code/static support; repo mevcut Chromium-only suite, Firefox test varsa eklenir; yapılmayan real Firefox visual claim'i yok.

## 4. Dependency sırası

```text
Task1 Current source/runtime/contracts/baseline
 → Task2 Own nickname backend/transaction/error contract
 → Task3 Account form/session/live identity cache propagation
 → Task4 Authenticated adjacent history policy/controls
 → Task5 Desktop+touch navbar timer/interaction lifecycle
 → Task6 Scoped root/sidebar/drawer blue scrollbar
 → Task7 Integrated real session/navigation/visual regression
 → Task8 Full gate/docs/separate implementation completion
```

Username contract session propagation'dan önce gelir. History current-session readiness ve stabilized cache boundary'yi kullanır. Auto-hide, history disabled/focus controls ve actual drawer/popup composition üstünde doğrulanır. Scrollbar en son netleşen scroll/layout surfaces'a uygulanır. Bağımsız işler olsa da bu doğrulama sırası korunur.

## Task 1 — Preflight, source inventory ve gerçek baseline

### Amaç
Güncel HEAD/runtime ile contracts ve source-level bulguları gerçek reproduction'a dönüştür.
### Neden bu sırada?
Sonraki bütün API/cache/history/layout kararlarının temeli.
### Prerequisite
Implementation kullanıcı onayı.
### Etkilenecek alanlar
- Backend: User/Auth/Profile/DTO/unique mapping ve user writer inventory.
- Frontend: AppShell/header/auto-hide/history/account/chat/primitives/installed Next docs.
- Auth / Session: UUID/email login, current session/refresh, account boundary/BFCache.
- Cache: gerçek keys, dynamic versus snapshot nickname alanları ve local selections.
- Routing: `(app)` route set, matchPath, public/auth aliases, native entries/url support.
- Styling: actual root/sidebar/drawer scrollers, token inheritance/forced colors.
- Security: own PUT exact matcher/CSRF/forced-password constraints; policy/ENV retained.
- Tests: mevcut User/photo/Auth/preferences/chat/notification/invitation/history/header baselines.
### Checklist
- [x] 1.1 HEAD/index/worktree/prompt hashes/source drift; user edits korunmuş.
- [x] 1.2 Nickname constraints/trim/codepoint/case/no-op/status/error API freeze; consumer/cache matrix ve stale User write races net.
- [x] 1.3 Bottom→up→idle desktop red gerçek runtime'da al; touch700 yeni karar, guards/page-top/native-entry contracts freeze.
- [x] 1.4 Current image/schema/ports/Docker/JDK/Node ve targeted backend/Chromium baseline; failed attempts/skips ayrı kaydet.
### Definition of Done
- [x] Zorunlu contract belirsizliği yok; minimum route/mutation/case/whitespace/history policy reviewable.
- [x] Reproduction/current baseline kanıtlı; eski gate sonuçları feature PASS sayılmadı.

## Task 2 — Own nickname backend ve concurrency

### Amaç
Nickname'i existing identity/session modelinde güvenli mutable alan yap.
### Neden bu sırada?
UI/save/cache verified backend contract ister.
### Prerequisite
Task1 DoD.
### Etkilenecek alanlar
- Backend: User domain setter, proposed UserProfileController/service/request, UserRepository/error handler.
- Frontend: wire/error contract; UI Task3.
- Auth / Session: unchanged UUID/email/token/session/provider references; fresh DTO response.
- Cache: nickname-only response identity-preserving.
- Routing: exact own PUT route; foreign routes/actor body grant vermez.
- Styling: yok.
- Security: own current active user+CSRF, whitelist fields, constraint-aware409/private no-store.
- Tests: domain/API/PostgreSQL duplicate barriers; photo/password/session/admin/OAuth regression.
### Checklist
- [x] 2.1 Existing3–32/Unicode/trim/case constraints, same-value no-op, typed own-only route and safe error mapping.
- [x] 2.2 Friendly duplicate check + authoritative unique flush409; two-user same-name race exactly one commit.
- [x] 2.3 Rename-vs-photo/password/stale write barrier; required minimum dirty-field protection, unrelated fields/roles retained.
- [x] 2.4401/CSRF403/foreign path/body/no mass assignment; current session, refresh and future email login valid, old migrations untouched.
### Definition of Done
- [x] Real PostgreSQL/API rename/no-op/invalid/duplicate/concurrency/auth tests pass; no profile/session collateral data loss.
- [x] New endpoint/error/DTO documented; no schema/auth architecture/dependency change introduced without concrete need.

## Task 3 — Account form, current session ve live nickname propagation

### Amaç
UI edit/save ve current-session live identity yüzeylerini reload olmadan güncelle.
### Neden bu sırada?
Task2 success/error/session contract tamamlandı.
### Prerequisite
Task2 DoD.
### Etkilenecek alanlar
- Backend: verified profile API/live projection behavior; gerekirse existing public summary mapper correction.
- Frontend: ProfileSection/proposed NicknameField/accountApi; existing Input/Button/form patterns.
- Auth / Session: sessionQueryKey update; userid-based owner keys unchanged.
- Cache: narrowly identity-dependent projections/private families/local selection labels.
- Routing: account route; rename navigation/logout üretmez.
- Styling: SettingsSection/tokens/TR-EN-DE/error associations/44px action.
- Security: actor/lifetime guarded late mutations; private cancellation isolation preserved.
- Tests: real rename DB/API/header/profile/member/team/invite/task/chat/search, account switch/late response.
### Checklist
- [x] 3.1 Input/dirty/cancel/validation/save busy/success/duplicate/server retry; unrelated email/photo/password drafts retained.
- [x] 3.2 Fresh DTO same-actor guarded session set + measured actual predicates invalidation; no clear-all/hard reload/logout.
- [x] 3.3 Dynamic user refs/local selection labels updated; immutable event/quote snapshots retained; next event new nickname.
- [x] 3.4 API→fresh prepared own DB→UI→persistence reload; rename keeps chat draft/reply/outbox/owner, other-account old response hidden.
### Definition of Done
- [x] Current username changes end-to-end and persists; all previously live nickname consumers have audit/result evidence.
- [x] Duplicate/invalid/late actor/retry/a11y/theme tests pass; no historical rewrite or private cache leak.

## Task 4 — Authenticated adjacent history policy ve controls

### Amaç
PDA arrows yalnız doğrulanmış adjacent workspace entry'ye geçsin.
### Neden bu sırada?
Current session/cache readiness contract Task3'te stabilize oldu; header focus behavior Task5'te bunun üstüne kurulacak.
### Prerequisite
Task3 DoD.
### Etkilenecek alanlar
- Backend: existing auth/resource guards; yeni history API yok.
- Frontend: workspace-history/types/store/hook/controls, shared route classifier.
- Auth / Session: active current principal, expired/pending/forced-password disable, pageshow freshness.
- Cache: stable external-store subscriptions; owner cleanup retained.
- Routing: actual native index±1 URLs, matchPath and actual `(app)` templates; query/hash/locale retained.
- Styling: current Buttons/Tooltip/aria descriptions; geometry unchanged.
- Security: fail closed boundary; no stack/interception/storage/private Next state.
- Tests: native policy fixtures + real authenticated/public/logout/external/locale/BFCache/chat E2E.
### Checklist
- [x] 4.1 Readonly native entries/url/index/capability and typed safe classifier; invalid/missing/unsupported distinct reasons.
- [x] 4.2 Current session+target fresh recheck → existing router.back/forward; subscriptions cleanup; route-set coverage and stable snapshots.
- [x] 4.3 Login→dashboard back disabled; app back/back/forward; public/external boundary, branch/replace/query/hash/locale/mixed browser inputs actual entries verified.
- [x] 4.4 Logout/login/B actor/BFCache stale frame guards; no-op/failed action keeps fullscreen; real logical traversal closes full, compact/bar persists.
### Definition of Done
- [x] PDA never deliberately traverses an unverified/public/auth/external adjacent entry; browser native behavior unchanged.
- [x] Real session/native routing tests pass; unavailable state does not falsely claim no history or grant authorization.

## Task 5 — Navbar auto-hide lifecycle, desktop ve touch

### Amaç
Up-scroll sonrası idle hide ve interaction-safe lifecycle.
### Neden bu sırada?
Task4 control/focus boundary ve current authenticated shell composition sabit.
### Prerequisite
Task4 DoD.
### Etkilenecek alanlar
- Backend: yok.
- Frontend: useAutoHide/AppHeader/AppShell drawer guard/search/popup interaction contracts.
- Auth / Session: mount/logout/current owner cleanup; no session effect.
- Cache: yok; UI-only timer state.
- Routing: navigation/unmount cancels timers/RAF/listeners; previous top behavior retained.
- Styling: centered header/reserve/reduced-motion unchanged.
- Security: focus/menu/data visibility guard; no auth change.
- Tests: real long-page bottom/up/idle, touch gestures, menu/hover/focus/drawer/search/rapid scroll/lifecycle.
### Checklist
- [x] 5.1 Fix reproduced missing re-arm; existing700ms/24/80 semantics, single scheduling/reset path and fresh guard evaluation.
- [x] 5.2 Touch idle700 enabled; sticky synthetic hover avoided; no forced blur/focus stealing.
- [x] 5.3 Open portals/search/account/notification/locale/theme/mobile drawer guards; interaction end resumes idle appropriately.
- [x] 5.4 Current page-top pointer behavior, rapid up/down, reduced motion, navigation/unmount RAF/listener/timer cleanup tested.
### Definition of Done
- [x] Bottom→up→visible→idle→hidden passes desktop and actual touch context.
- [x] Hover/focus/open interactions keep header accessible; geometry/reserve/chat/history/landing regression passes.

## Task 6 — Scoped blue vertical scrollbar theme

### Amaç
Root/sidebar/drawer scrollbar'ları blue palette ile tutarlı yap.
### Neden bu sırada?
Actual shell/interaction/scroll surfaces Task5 sonrasında net.
### Prerequisite
Task5 DoD.
### Etkilenecek alanlar
- Backend: yok.
- Frontend: AppShell actual nav/drawer scroller scope markers.
- Auth / Session: authenticated app root-only styling; public/auth/demo unchanged unless explicit shared scope intended.
- Cache: yok.
- Routing: document scroller kept; anchor/history restoration semantics unchanged.
- Styling: globals scoped tokens/scrollbar-color/width/WebKit pseudo/forced-colors/light-dark.
- Security: yok.
- Tests: scrollbar selectors/inheritance/computed style/visual/touch/wheel/keyboard and unrelated surface exclusions.
### Checklist
- [x] 6.1 Thumb alias→existing label-blue; track surface/transparent, hover palette, visible widths; no hardcoded random hex.
- [x] 6.2 Root viewport/body inheritance reset + sidebar/drawer exact boxes; no main reparent or custom scrollbar library.
- [x] 6.3 Exclude chat/code/textarea/select/popover/modal/table-horizontal; forced-colors system behavior.
- [x] 6.4 Chromium screenshot/computed styles across320/390/768/1024/1440/3 languages/2 themes; Firefox CSS fallback static/build plus real Firefox only if available suite.
### Definition of Done
- [x] Intended scrollbars visible blue/light-dark contrast; all input/scroll methods work and scrollbar exclusions proven.
- [x] Navbar idle, layout, document scroll restoration and native traversal regressions pass.

## Task 7 — Birleşik real data/session/navigation/a11y regression

### Amaç
Dört değişikliği aynı authenticated shell içinde birlikte doğrula.
### Neden bu sırada?
Task1–6 tamam; full gate öncesi cross-feature risks.
### Prerequisite
Task6 DoD.
### Etkilenecek alanlar
- Backend: all profile/User/Auth/photo/domain integration; DB direct prepared own UUID reads.
- Frontend: new nickname/navbar/history/scrollbar E2E + affected old suites.
- Auth / Session: A→logout→B, rename→refresh/login, expired/forced-password/BFCache.
- Cache: warm identity refs, late requests/mutations, invitation/notification isolation and chat drafts.
- Routing: safe native/boundary/locale/hash/filter/dialog traversal.
- Styling: all viewport/theme/motion/sidebar/drawer/portal scenarios and screenshots.
- Security:401/403/IDOR/unique race; backend SOT retained.
- Tests: actual Chromium+backend+PostgreSQL normal success; labelled failure/clock fixtures.
### Checklist
- [x] 7.1 Actual nickname transition/persistence/no-reload + duplicate/invalid/concurrent/foreign/session; before/after dynamic and snapshot evidence.
- [x] 7.2 Navbar desktop/touch idle matrix with all held guards; background/unmount/nav no leaked callbacks.
- [x] 7.3 Native app/public/login/logout/external/unsupported boundaries + account B no A profile/private frame; ordinary browser shortcuts unchanged.
- [x] 7.4 Blue scrollbar scope/exclusion/contrast; TR/EN/DE/light-dark/reduced-motion/320–1440/expanded-collapsed/drawer screenshot and keyboard tests.
- [x] 7.5 Chat/replies/reactions/outbox, invitations/notifications, new main task cards/dialog/board, account/photo/preferences/landing regressions; own QA cleanup only.
### Definition of Done
- [x] Cross-feature normal data chains pass with source/command/exit/artifact/DB evidence; mock contracts not counted as persistence proof.
- [x] All scoped blockers fixed/retested; no dependent full completion claim while missing acceptance.

## Task 8 — Full gate, docs ve ayrı implementation completion

### Amaç
Current source üzerinde full validation ve reviewable teslim.
### Neden bu sırada?
Task7 scoped regression tamam.
### Prerequisite
Task7 DoD.
### Etkilenecek alanlar
- Backend: full Maven clean verify/Testcontainers.
- Frontend: lint/TypeScript/production build/targeted+full Chromium.
- Auth / Session: endpoint/session/IDOR/error inventory; preserved policy review.
- Cache: validated predicates/snapshot/boundary documentation.
- Routing: classifier supported/unsupported boundary limits.
- Styling: token/scrollbar/auto-hide notes and scoped web checklist.
- Security: SECURITY §11 exact PUT inventory/Swagger; independent dependency debt reported separately.
- Tests: canonical root pre-push/Docker/3000/8080/Swagger/current source hashes.
### Checklist
- [x] 8.1 Current backend full, frontend lint/type/build/full Chromium; current runtime image/schema, failures/skips honestly recorded.
- [x] 8.2 Canonical `./pre-push/pre-push.cmd` exit0 incl backend; Docker build/start/health and final3000/8080/Swagger; own processes restore only, no limits/ENV weakening.
- [x] 8.3 Relevant API/auth/database/architecture/folder/design/checklist notes; global boxes not wholesale[x].
- [x] 8.4 Actual completion date separate `docs/compliation/YYYY-MM-DD-frontend-foundation-fixes.md`, README format and required final headings; API method/body/auth/status/error/safe example included.
- [x] 8.5 Final source/index/HEAD/user prompt protected; no commit/push/staging/pull/merge; QA own IDs cleanup, existing sharp/dev dependency follow-up re-measured but no unrelated update.
### Definition of Done
- [x] All earlier DoD + full regression/canonical gate PASSED; skipped backend/Testcontainers never PASS.
- [x] Separate completion/manual steps/changed files ready; only genuinely blocker-free verdict may say `Kalan blocker yok.`

## 5. Validation rotası — gelecekte çalıştırılacak

Yeni test sınıf/spec isimleri proposed'dır; mevcutmuş gibi PASS sunulmaz. Task1 sonunda actual scope/suites sabitlenir.

```powershell
Push-Location backend
.\mvnw.cmd '-Dtest=UserDomainTest,UserProfilePhotoApiIntegrationTest,UserPreferenceApiIntegrationTest' test
# Yeni nickname API/transaction/concurrency suites ve actual Auth tests eklenir.
.\mvnw.cmd clean verify
Pop-Location

Push-Location frontend
npm.cmd run lint
npx.cmd tsc --noEmit
npm.cmd run build
# Proposed nickname-editing/nav-auto-hide/authenticated-history/scrollbar specs,
# existing account/photo/preferences/native-history/workspace-history/chat/invitation/notification/task/landing packages.
npx.cmd playwright test --project=chromium
Pop-Location
.\pre-push\pre-push.cmd
```

Final implementation headings: Final verdict; Task checklist; Username editing; Username propagation / cache; Navbar auto-hide fix; PDA authenticated history boundary; Scrollbar theme; Auth / account isolation; Responsive / accessibility / theme; Changed files; Test results; Remaining issues.

## 6. Kapsam eşlemesi ve plan teslim sınırı

| Prompt kapsamı | Plan |
| --- | --- |
|A username/model/API/validation/duplicate/login/UI/consumers/cache |Source findings/contracts;Task1–3/7–8 |
|B navbar reproduction/timer/guards/top/touch |Approved touch decision;Task1/5/7 |
|C safe adjacent entries/locale/query/unsupported/logout/chat |Native readonly policy;Task1/4/7 |
|D scrollers/tokens/Firefox/exclusions/accessibility |Palette/cascade contracts;Task1/6/7 |
|Account boundary/i18n/a11y/theme/real-data rules |Task2–7 acceptance matrix |
|Git/full gate/separate completion/25 critical rules |Ordered workflow;Task1/8 |

**İlk plan tesliminin tarihsel sınırı:** İlk tur prompt/source incelemesi ve plan yazımıydı; implementation/full gate yoktu. Sonraki kullanıcı mesajı implementation onayını verdi. Güncel sonuçlar aşağıdaki verification kayıtlarında; ayrı implementation teslimi: [2026-10-07 completion](docs/compliation/2026-10-07-frontend-foundation-fixes.md).

## Implementation verification

### Task1 - 2026-10-07

HEADad1bc66/general-features/index/user prompt preserved;1815 tracked source hashes unchanged. Docker was stopped and started with volumes retained. Current backend/PostgreSQL healthy, JDK25.0.1/Node24.19.0/Docker29.8.1. Baseline45 User/Auth/OAuth/photo/preferences backend tests0 failure/error/skip; lint/type/build0;18 Chromium account/photo/native-history/private-cache/landing passed. New actual desktop and CDP touch bottom/up/idle scenarios produced expected red2 failures (idle re-hide assertions), not PASS. Task5 must close both.

Freeze: own PUT /users/me/profile, nickname-only request with unknown identity fields rejected;200 fresh AuthenticatedUser/no-store, invalid400 NICKNAME_INVALID, duplicate409 NICKNAME_TAKEN. Unicode White_Space trim in Java/JS, FEFF rejected, no casefold/NFC;3-32 regex codepoints and existing unique constraint retained. User mutable write lost-update barrier required before deciding minimum DynamicUpdate protection.

Consumers: live session/header/profile; Project members/squads/home, task detail/comment/activity/watcher/worklog/attachment/assignee, chat overview/member/message/reply sender identity are current UserAccounts projections; quoted content/time retained but chat has no persisted nickname column. Invitation manager/recipient/external preview display summaries are live. Notification statusChange/teamDeletion and stored event messages are immutable historical snapshots; future snapshots use fresh principal names. Chat ownerKey is userid/projectid and is not changed by rename. Proposed predicates only identity-bearing projections; source keys session, projects/{p}/{members,squads,home,chat,tasks}, tasks mine/pool and current-actor invitation/notification families. Globals actual root document/sidebar/drawer scrollers confirmed; no main reparent planned. Evidence .local/frontend-foundation/task1-*.

### Task2 - 2026-10-07

Own nickname-only PUT/controller/service, strict unknown-field rejection, Unicode normalization/domain validation and coded400/409 complete. Existing unique constraint preserved. Real blocked unique-index race commits one actor only. Stale photo barrier produced expected red1 failure0 errors; User DynamicUpdate fixed the actual lost nickname update. Added stale password/refresh/current-and-future email-login/forced-password/no-op/Unicode/case/IDOR/CSRF tests; final clean targeted60 tests0 failure/error/skip exit0 incl actual Admin/Auth/OAuth/photo/preferences. No migration/token/cookie/session/role policy change; exact own PUT matcher only. Evidence task2-stale-write-red.log/task2-final-backend.log.

### Task3 - 2026-10-07

Own account nickname form/save/cancel/dirty/validation/coded conflict/network failure handling and actor/lifetime subscription+abort guard complete. Fresh same-actor DTO cancels old session requests then updates session; authApi.me/useSession now forward AbortSignal. Actual identity-bearing predicates refresh live projections, not criteria/media/count/whole cache; immutable notification snapshots retained. Real prepared DB/current API/header/profile/team warm client navigation, same userid compact draft/document persistence, duplicate409 and late actual-response A->logout->B isolation passed. Original shared QA manager nickname restored in finally via actual own PUT. Existing Auth/photo/chat/invitation/cache regression package current lint/type/build0 and34 Chromium passed. Initial fixture confused bar/compact and unscoped alert; fixed/retested. Evidence task3-final-*.

### Task4 - 2026-10-07

Native readonly adjacent index/url and actual protected route allowlist implemented; route-set test compares all app-layout pages. Same-origin alone no longer grants an arrow; public/auth/external/unreadable/unsupported/pending/current-session-not-ready directions disabled with localized reason. Existing router back/forward remains action; fresh actor/query status/fetch readiness recheck before traversal. Persisted pageshow triggers existing session GET revalidation; contained mode neither subscribes nor enables session query. Real FAQ->login->dashboard shows native backtrue but PDA disabled; private/mixed browser/PDA navigation, locale/logged-out boundary, rapid/canceled traversal/project isolation, full-close and compact persistence pass. Final lint/type/build0 and17 Chromium passed; no history methods patched or custom stack/storage/URL execution. Native primitive capability tests retained separately from stricter app policy. Evidence task4-final-*.

### Task5 - 2026-10-07

One700ms timer/re-arm for show/reveal/up-scroll and owned interaction exits; pointer top/hover/focus/search/trigger attribute/drawer guards retained. Touch idle enabled as approved, synthetic touch hover ignored. MutationObserver, media change, focusout RAF and all listeners/timer clean up; disabled contained demo has no runtime controller. Drawer state narrow AppShell->AppHeader prop, viewport-centered placement/reserve unchanged. Both initial real red cases now pass; >idle hover/focus/popup/search and actual touch drawer holds/resumes tested. Current lint/type/build0 and22 Chromium passed with header/sidebar/notification/landing/history regressions. Evidence task5-final-*.

### Task6 - 2026-10-07

Actual root viewport/sidebar/drawer selectors and existing label-blue light/dark semantic alias implemented. Body/child inheritance resets exclude nested forms/chat/portals/tables; standard scrollbar-color/width plus WebKit paint fallback and forced-colors auto. Document scroll container retained. Current lint/type/build0 +19 Chromium passed; separate actual viewport paint1 passed, screenshot blue root/sidebar thumb verified in dark1440 and mobile form layouts/three-language variants. Computed intended colors/thin widths and textarea/pre/neutral scroll-box exclusions passed. Initial shared fixture session revoked by prior logout/history test; corrected independent actual login. Full-page capture hid viewport scrollbar; actual viewport captures retaken with visual browser flag exclusion. Firefox CSS syntax present/static support only, no real Firefox pass claim. Evidence task6-final-*/task6-paint-*.

### Task7 - 2026-10-07

Combined clean backend137 tests0 failure/error/skip; current lint/type/build0 and47 Chromium passed, exit0. Actual task createdByName/assignee and invitation live summaries update after own UI rename, prepared DB/current session correct, committed recipient team-deletion actor snapshot remains original. Current private account/late response, clipboard/Unicode/duplicate/profile/photo/chat reply/reaction/draft/new main task cards/dialog/board, authenticated adjacent/public/browsers/locale/full-close/compact persistence, desktop-touch idle/held guards and scoped scrollbar matrix regressions passed. Actual viewport blue thumb screenshots inspected; pure/failure/style probes explicitly distinct. Wrong task DTO fixture field in first run fixed before current final rerun; no failed test remains in targeted package. QA original names restored and own projects archived in finally. Evidence task7-backend.log/task7-final-*. Canonical full gate pending.


### Task8 - 2026-10-07

Canonical ./pre-push/pre-push.cmd PASSED exit0 on final current source: clean backend512 tests0 failure/error/skip, frontend lint/TypeScript/production build0, full Chromium291 passed+1 expected production-disabled crash-route skip, Docker build/start/health. First canonical512 backend PASS but288 Chromium+3 failures+1 expected skip; second512 backend PASS but290 Chromium+1 failure+1 expected skip. Safe traces confirmed actual setup login429; real auth rate policy/ENV unchanged. Four redundant new nickname setup logins removed, then three existing team setup logins replaced with actual shared storageState. Login/account-switch/new-user onboarding behavior assertions retained; no timeout/retry masking. Final correction lint/type/build0+11 Chromium PASS, then entire canonical rerun PASS; failed logs preserved separately.

Separate completion docs/compliation/2026-10-07-frontend-foundation-fixes.md and scoped API/SECURITY/database/architecture/folder/design/checklist notes ready. Final Next dev restored, frontend3000/backend8080/Swagger/API docs200, own profile schema present; Docker/PostgreSQL healthy. Initial private restore helper checked schema before fetch; corrected and verified already-started own dev without stopping another process. HEAD/index/user prompt protected;64 migration/ADR/package/lock/Compose/ENV/RolePolicy hashes unchanged, git diff --check0, unmerged0. QA original nicknames restored, own project IDs archived; user data/volumes retained. No commit/push/staging/pull/merge.

Current npm audit6 high/exit1 and production1 high/exit1: independent sharp0.35.4 advisory GHSA-wq5f-xc86-pv6w (patch0.35.5) plus existing ESLint/braces5 dev debt. No dependency update in this scope, no global blocker-free/release waiver. Functional foundation scope and quality gate closed. Evidence .local/frontend-foundation/pre-push.log, pre-push-first.log, pre-push-second.log, task8-budget-*, final-source.json and final-health.json.
