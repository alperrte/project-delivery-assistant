# Frontend Foundation Fixes

## Final verdict

2026-10-07. Onaylı A–D kapsamı ve Task1–8 sırası uygulandı. **Canonical pre-push PASSED, exit0:512 backend0 failure/error/skip;291 Chromium passed+1 expected skip;lint/TypeScript/production build/Docker build/start/health PASS.** Bu kayıt ayrı implementation teslimidir; [plan](../../PDA_FRONTEND_FOUNDATION_FIXES_PLAN.md) ve [.agents prompt](../../.agents/PDA_Frontend_Foundation_Fixes_Plan_and_Implementation.md) esas alındı.

Branch `general-features`, HEAD `ad1bc66`; index ve kullanıcı prompt'u korundu. Commit/push/staging/pull/merge/branch değişimi yapılmadı. Migration, package/lock, Compose, ENV ve mevcut role policy değiştirilmedi.

Bağımsız npm dependency follow-up açık: full audit6 high, production1 high (`sharp`); bu kapsam dependency security remediation veya release waiver değildir.

## Task checklist

Task1 preflight → Task2 own nickname backend → Task3 account UI/cache → Task4 authenticated history → Task5 navbar idle → Task6 scrollbar → Task7 birleşik regression → Task8 full gate/docs. Her task implementation → targeted test → fix/retest → DoD → checkbox → next task sırasıyla tamamlandı. Kanıtlar planın verification kayıtlarında; eski completion sayıları kullanılmadı.

## Username editing

Gerçek alan `User.nickname`; yeni ayrı username/displayName modeli yok. Own account formunda düzenle/kaydet/iptal, dirty/busy/validation ve hata feedback'i var. Mevcut3–32 Unicode harf/sayı/underscore ve case-sensitive DB unique constraint korundu. Java/JS Unicode White_Space trim eşleşir; FEFF, combining-mark ve izin verilmeyen karakterler reject edilir. Casefold/NFC/backfill yok; same-value save no-op.

Yeni own endpoint: **PUT `/api/v1/users/me/profile`**, nickname-only JSON; aktif session+CSRF, principal UUID üzerinden yalnız caller. Güvenli örnek `{"nickname":"Nisa_Camci"}`.200 fresh AuthenticatedUser, `private, no-store`;400 `NICKNAME_INVALID`,409 `NICKNAME_TAKEN`,401 session,403 CSRF/forced-password/foreign-route. Unknown identity fields400; başka kullanıcı ID'si alınmaz. Existing email login, UUID token subject, cookie/session/authorization modeli korunur.

Row lock + gerçek unique-index race tek kullanıcıyı commit eder. Stale photo update gerçek kırmızı testte yeni nickname'i geri yazıyordu; User `DynamicUpdate` ile yalnız değişen kolonları yazdırarak düzeltildi. Stale password/photo ve existing auth/photo/preferences regressions geçti. Şema/migration yok.

Swagger kontrolü: `http://localhost:8080/swagger-ui/index.html`, `/v3/api-docs`; login/CSRF ile own PUT. SECURITY §11 inventory güncellendi; raw credentials/token/cookie yayınlanmadı.

## Username propagation / cache

Successful own save fresh aynı-user DTO ile session'ı günceller; eski in-flight session GET iptal edilir. Yalnız live identity-bearing project members/squads/home/chat/task, tasks mine/pool ve current-actor invitation/notification query aileleri invalidate edilir. Hard reload/logout/login gerekmez; email/photo/password drafts ve chat user/project ownerKey korunur.

Warm team/header/account/chat/task/invitation projections gerçek backend/PostgreSQL ile doğrulandı. Notification `statusChange`/`teamDeletion` ve committed actor messages tarihsel snapshot olarak kalır; eski isimler rewrite edilmez. Future event fresh identity kullanır. Diğer cihazlarda anında push güncelleme garantisi verilmez.

## Navbar auto-hide fix

Up-scroll reveal eski idle timer'ı yeniden kurmuyordu. Tek700ms timer bütün reveal/up-scroll ve interaction-exit yollarında yeniden kurulur. Desktop pointer top-zone/hover, focus, search/menu/drawer açıkken navbar korunur; kapanınca idle sürer. Kullanıcının kararıyla mobile/touch da scroll durunca aynı idle süresiyle gizlenir. Synthetic touch hover guard'ı yanlış hold yaratmaz; timer/observer/listener/RAF cleanup uygulanır. Navbar eski viewport-centered konumunda; header reserve değişmedi.

## PDA authenticated history boundary

Native Navigation readonly `entries/currentEntry/index/url/capability` üzerinden yalnız **hemen komşu**, aynı-origin ve actual authenticated workspace route kabul edilir. Allowlist testte gerçek protected app-layout page set'iyle karşılaştırılır. Login/logout/public/external/unknown/unreadable/unsupported/session-pending entry yönü disabled ve localized reason taşır. Fresh click-time native capability + current actor/session readiness recheck yapılır.

Actual action mevcut router.back/forward; browser arrows/Alt/mouse doğal kalır. Custom URL stack, storage, classic-history override veya private Next state mutation yok. BFCache persisted pageshow existing session GET'i yeniden doğrular. Contained demo live session/history controller kurmaz. Gerçek logical traversal full chat→closed; compact/bar aynı owner scope'ta persistent; no-op/failed traversal chat'i kapatmaz.

## Scrollbar theme

Gerçek root viewport/sidebar/drawer scroller'ları mevcut semantic `label-blue` palette ile styled. Standard scrollbar-color/width ve WebKit fallback; forced-colors auto. Body/child inheritance reset ile chat/form/modal/table/code-block scroller'larına yayılmaz. Document scrolling değiştirilmedi; scrollbar gizlenmedi. Actual dark1440 root/sidebar blue thumbs ve mobile viewport captures incelendi. Firefox standard CSS mevcut/static doğrulandı; live Firefox test koşuldu iddiası yok.

## Auth / account isolation

Own principal backend guard, CSRF/IDOR/unique concurrency testleri geçti. UI abort/lifetime/current-user guards sayesinde logout→başka account sırasında eski real response yeni session/form/toast'a yazmaz. Existing invitation/notification actor cache ve auth boundaries regressions geçti. Permission/cookie/CORS/session/JWT modeli genişletilmedi; yalnız exact own PUT matcher eklendi.

## Responsive / accessibility / theme

TR/EN/DE labels/errors/reasons, light/dark,320/390/768/1024/1440px, actual touch/keyboard/focus ve no-overflow kontrol edildi. Nickname label/aria-describedby/error alert ve44px save/cancel; navbar focus/search/popups/drawer guards; history native disabled açıklamaları korundu. Targeted screenshots incelendi. Scoped design/web checklist notları güncellendi; global boxes topluca[x] yapılmadı.

## Changed files

- Backend: [UserProfileController](../../backend/src/main/java/com/pda/user/api/UserProfileController.java), UserProfileService/NicknameTakenException, NicknameRules, User/UserRepository, UserApiErrorHandler ve exact security matcher.
- Frontend: [NicknameField](../../frontend/src/features/account/components/nickname-field.tsx), account normalization/cache predicates/API/ProfileSection; auth API/useSession AbortSignal; authenticated route/history adapter/controls; use-auto-hide/AppHeader/AppShell; globals.css;TR/EN/DE catalogs.
- Tests: UserProfileApiIntegrationTest; nickname-editing/authenticated-history/navbar-auto-hide/workspace-scrollbars; existing account/native/history assertions. Team deletion/invitation fixture'ları mevcut gerçek shared session'ı kullanır; business assertions korunur.
- Docs: plan; scoped SECURITY/API/database/architecture/folder/design/web checklist ve bu ayrı kayıt. Original prompt ve önceki completion'lar korundu.

## Test results

| Command / stage | Result |
| --- | --- |
| Task1 baseline backend / Chromium |45 backend0 failure/error/skip;18 Chromium;lint/type/build0 |
| Navbar original desktop+CDP touch reproduction |Expected red2 idle assertions;PASS sayılmadı |
| Stale photo nickname lost-update barrier |Expected red1 failure0 errors;fix sonrası passed |
| Task2 clean targeted Maven |60 tests0 failure/error/skip,exit0 |
| Task3 real account/cache/chat/invitation target |34 Chromium;lint/type/build0 |
| Task4 native/private history target |17 Chromium;lint/type/build0 |
| Task5 desktop/touch/header/notification/landing target |22 Chromium;lint/type/build0 |
| Task6 scrollbar matrix / actual paint |19 Chromium +separate paint1;lint/type/build0 |
| Task7 clean targeted backend +combined frontend |137 backend0/0/0 +47 Chromium;lint/type/build0 |
| Final fixture correction target |11 Chromium;lint/type/build0 |
| Canonical `./pre-push/pre-push.cmd` |**PASSED exit0;512 backend0/0/0;291 Chromium+1 expected skip;lint/type/build/Docker health** |
| `npm audit --json`; `npm audit --omit=dev --json` |6 high /1 high,both exit1;independent debt |

İlk full gate512 backend PASS,288 Chromium+3 failures+1 expected skip; ikinci512 backend PASS,290 Chromium+1 failure+1 expected skip. Failure trace'leri gerçek login429 gösterdi. Gereksiz fixture setup login'leri existing real storageState ile azaltıldı; gerçek login/account-switch/new onboarding testleri korundu. Kota/ENV/security policy değiştirilmedi, retry/timeout ile maskelenmedi;11 targeted tekrar geçti ve canonical tamamı yeniden koşuldu. Başarısız denemeler PASS sayılmadı.

Normal feature successes gerçek backend+PostgreSQL; pure policy/CSS probes ve late real-response/failure injection açık TEST-ONLY. QA nicknames restore, own project UUID archive cleanup; kullanıcı data/volume silinmedi. Backend Testcontainers skip0; Chromium expected skip yalnız production controlled crash route disabled. Final Next dev3000/backend8080/Swagger/API docs HTTP200; own profile schema verified. HEAD/index/prompt preserved;64 protected migration/ADR/package/lock/Compose/ENV/RolePolicy files unchanged. Final Git/hash/index ve runtime health kanıtı `.local/frontend-foundation/` özel kayıtlarında; secrets rapora alınmadı.

## Remaining issues

Bağımsız `sharp@0.35.4` HIGH, [GHSA-wq5f-xc86-pv6w](https://github.com/advisories/GHSA-wq5f-xc86-pv6w), patch0.35.5; current production audit1 high. Existing ESLint/braces5 high dev debt sürüyor. Bu kapsam package/lock değiştirmedi; ayrı security remediation kararı gerekir. Bu rapor global blocker-free veya release güvenlik onayı değildir. Source-map-js1.2.2 retained. Browser native API desteklenmiyorsa PDA arrows disabled; browser arrows kullanılabilir. Live Firefox/BFCache tüm browser sürümleri için garanti verilmez.

### Kullanıcı kontrolü

1. Hesapta own kullanıcı adını değiştir: header/account ve sıcak ekip/task/davet görünümü reload olmadan güncellensin. Duplicate/invalid feedback'i kontrol et; QA ismini eski haline döndür.
2. Sayfanın altına scroll→yukarı scroll→navbar görünür→interaction yokken700ms sonra gizli; touch da aynı. Hover/focus/search/menu/drawer açıkken gizlenmesin.
3. Public→login→workspace'te PDA geri login/public'e dönmesin. Private routes/query/locale arasında back/forward çalışsın; browser arrows doğal kalsın. Full chat traversal'da kapansın, compact/bar draft korunsun.
4. Light/dark desktop/mobile root/sidebar/drawer blue scrollbar; form/chat/modal/code scrollbar'ları etkilenmesin.
5. Bu completion ve planı incele. Commit/push kullanıcıya bırakıldı; bağımsız sharp advisory ayrı karar bekliyor.
