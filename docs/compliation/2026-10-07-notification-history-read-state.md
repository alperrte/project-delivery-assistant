# Notification History & Read State

## Final verdict

2026-10-07. Onaylı Notification read/history kapsamı Task1–8 dependency sırasıyla uygulandı. **Canonical pre-push PASSED, exit0; 522 backend0 failure/error/skip, 310 Chromium passed+1 expected skip; lint/TypeScript/build/Docker PASS**. [Plan](../../PDA_NOTIFICATION_HISTORY_AND_READ_STATE_PLAN.md) implementation source of truth; [.agents prompt](../../.agents/PDA_Notification_History_and_Read_State_Plan_and_Implementation.md) tamamen esas alındı. Bu kayıt ayrı implementation teslimidir.

Branch `notification-service`, HEAD `d82fcb0`; index ve kullanıcı prompt'u korundu. Commit/push/staging/pull/merge/branch değişimi yok. Package/lock, migrations, ENV/Compose, role/permission/cookie/session/CSRF/CORS modeli değişmedi. Bağımsız npm dev dependency borcu sürüyor; global release waiver veya blocker-free güvenlik onayı verilmedi.

## Task checklist

Task1 baseline/contracts → Task2 additive server filter/mevcut read doğrulaması → Task3 query/API/lifetime → Task4 Yeni/Geçmiş → Task5 actions/cache/focus → Task6 account/polling/popup → Task7 birleşik gerçek regression → Task8 full gate/docs. Plan checkbox ve DoD kayıtları gerçek targeted test/fix/retest kanıtlarına bağlıdır. İlk plan teslimi ve eski full gate sayıları yeni başarı kanıtı sayılmadı.

## Notification read model

DB `notifications.is_read` ve `read_at` persistent source of truth. Read aynı row/ID/content/createdAt/resource/snapshot'ı korur; physical move/archive/delete yok. Nullable GET `read` filter eklendi; read=false yalnız unread, read=true yalnız history, omitted eski unreadOnly/all davranışını korur. read=true+unreadOnly=true400. Existing type/page/size/createdAt DESC,id DESC korunur.

Gerçek PostgreSQL barrier, stale individual reader'ın bulk işlemin ilk committed readAt'ini yeniden yazdığını gösterdi: expected red1 failure0 errors. Dar own/unread conditional UPDATE ve fresh entity readback ile düzeltildi. Concurrent individual/bulk/read-all ve new-event-after-bulk doğrulandı; yeni infrastructure/entity/migration yok.

## Active notifications

Mevcut nonmodal bell Popover'da Yeni default tab; server page20, yalnız unread. Skeleton/loading, failure/retry ve “Yeni bildiriminiz yok” ayrı. Empty active sonrası Geçmiş erişimi sürer. Close/reopen Yeni/page0; account remount local tab/page/error/pending state'i temizler.

## Notification history

Geçmiş server-filtered read rows'u aynı content/snapshot/time ile gösterir; popup-presented kriteri kullanılmaz. Lazy tab fetch ve bağımsız page cursor; bütün history client'a indirilip filter edilmez. 41+ gerçek task-event dataset'i,20-size requests, stable tied-time backend pages ve last-page shrink/clamp doğrulandı. History rows yeni read/unread/delete action sunmaz.

Mevcut project permanent-delete use-case'i o projenin notification rows'unu temizler; bu bağımsız lifecycle politikası değiştirilmedi. Read işlemi içerik silmez; sonsuz retention veya deleted resource access garantisi verilmez.

## Individual mark-as-read

Existing own PATCH reused. Native44px Check/Button, tooltip ve title description; keyboard Enter/Space ve gerçek touch. Server success sonrası Yeni'den çıkar, warm Geçmiş/count fresh olur. Önceden görünen row'da focus varsa next/previous action veya named empty section'a gider; kullanıcı focus'u taşımışsa geri çalınmaz. Approved **Görevi açınca okundu** davranışı ve existing task URL/dialog/finalFocus suppression korunur.

## Mark-all-as-read

Existing header Checks action current principal'ın **bütün unread** rows'unu kapsar; current page/type subset değil. Gerçek22-row bulk acceptance; empty/unknown/pending state disabled. Synchronous shared guard same-frame double submit'i durdurur. Response `{count}` değişen row sayısıdır; remaining unread sayısı olarak kullanılmaz. Bulk statement sonrası oluşan yeni notification doğru şekilde unread kalır.

## Unread count / badge

Server `/unread-count` ile reconcile; gerçek2→1→0 ve other-tab polling doğrulandı. Kör optimistic0 veya guessed page count yok. Count unavailable durumunda eski count success gibi sunulmaz. Current actor'un badge'i server count ile karşılaştırıldı; late previous actor count yeni badge'e yazılmadı.

## Cache and account isolation

Existing actor family genişletildi: list/read/page/size/type keys, ayrı count. Successful mutation eski list/count GET'lerini cancel edip bütün own list scopes/pages + count invalidate/refetch eder. Unrelated application queries resetlenmez. Read/readAll AbortSignal, current actor/lifetime checks ve unmount/session abort; automatic mutation retry yok.

Mutation failure optimistic move/count üretmez. **Committed success + refresh failure** ayrı inline message ve GET-only retry; DB success geri alınmış gibi gösterilmez. Actual delayed read/read-all/list/count responses ile B→A→B→A same-document switch ve fresh DB/foreign404 kanıtlı. Marker preserved, old IDs/errors/list/badge görünmedi; callbacks eski account'a bağlı kaldı. Cache unit probes ayrı TEST-ONLY.

Mevcut count30 sn/current open list15 sn ve foreground claim30 sn/focus/online modeli korundu. Two-context individual/bulk read diğer tabda existing foreground polling ile göründü. Yeni socket/provider/broker/storage yok. `popupPresentedAt != readAt`; claim/show/close automatic read değildir. Presented unread Yeni'de; explicit read Geçmiş'te aynı marker/snapshot ile kalır, repeat grant yok.

## Authorization / IDOR

Principal UUID backend source of truth. Legacy/new list filters SQL recipient predicate'i korur. Foreign ID404, session401 (CSRF-valid mutation), CSRF/forced-password403; invalid/conflicting read/type/page/UUID400. No global ADMIN/project manager notification bypass. Crafted read-all body actor seçmedi; yalnız current principal'ın rows'u değişti.

### API / Swagger

Base `/api/v1`, existing cookie auth; mutations CSRF; private/no-store. New route yok.

| Method/path | Input / scope | Success | Önemli hatalar |
| --- | --- | --- | --- |
| GET /notifications | Own principal; read?,legacy unreadOnly?,type?,page,size1–100 |200 server page, newest createdAt/id |400 invalid/conflict/paging,401,403 forced-password |
| GET /notifications/unread-count | Own principal; body yok |200 `{count}` own remaining unread |401/403 |
| PATCH /notifications/{id}/read | Own UUID; body yok+CSRF |200 same NotificationResponse read/readAt |400 UUID,401,403,404 missing/foreign |
| PATCH /notifications/read-all | Own principal,body yok+CSRF |200 `{count}` changed rows |401/403 |
| POST /notifications/team-deletions/claim | Existing own bodyless+CSRF |200 one grant/204; read unchanged |400 nonempty body,401/403 |

Safe GET `?read=true&page=0&size=20`; PATCH only own QA notification UUID, no credentials in examples. Swagger `http://localhost:8080/swagger-ui/index.html`, `/v3/api-docs`, normal login/CSRF. SECURITY §11 inventory güncellendi; docs/security flags unchanged.

## Responsive / accessibility / i18n

TR/EN/DE labels/states,320/390/768/1024/1440,light/dark,160-character structured snapshots, reduced motion/explicit motion-off ve actual touch kabulü geçti. Base UI Tabs manual activation: arrows focus, Enter/Space select. Native buttons/ARIA state/title description,44px targets, overflow/Escape/focus ve snapshots korundu; Yeni/Geçmiş screenshots incelendi. Navbar viewport-centered konumu/reserve ve chat/landing inert/history semantiği değişmedi. Global checklist boxes topluca[x] yapılmadı.

## Changed files

- Backend: [NotificationController](../../backend/src/main/java/com/pda/notification/api/NotificationController.java), [NotificationService](../../backend/src/main/java/com/pda/notification/application/NotificationService.java), [NotificationRepository](../../backend/src/main/java/com/pda/notification/infrastructure/NotificationRepository.java); schema/entity/authorization modeli aynı.
- Frontend: [NotificationCenter](../../frontend/src/features/notifications/components/notification-center.tsx), [use-notification-read](../../frontend/src/features/notifications/hooks/use-notification-read.ts), existing API/query-keys;TR/EN/DE catalogs.
- Tests: [NotificationReadStateIntegrationTest](../../backend/src/test/java/com/pda/notification/NotificationReadStateIntegrationTest.java); notification-history/context/visual specs, prepared notification-db + real notification-fixture helpers; notification-cache, team-deletion notification locator ve existing session expiry response wait.
- Docs: root plan; scoped SECURITY/API/database/architecture/folder/design/web checklist ve bu kayıt. Original prompt ve eski completion'lar korundu.

## Test results

| Stage / command | Result |
| --- | --- |
| Task1 clean Notification/TeamDeletion/TaskProgress baseline |22 backend0 failure/error/skip;24 Chromium;lint/type/build0 |
| Stale individual-vs-bulk readAt barrier |Expected red1 failure0 errors; fix sonrası PASS |
| Task2 clean targeted Maven |29 tests0 failure/error/skip,exit0 |
| Task3 current backend+cache/task/notification/session target |17 Chromium passed;lint/type/build0 |
| Task4 real history/server-page/demo target |21 Chromium passed;lint/type/build0 |
| Task5 action/DB/focus/failure target +last-page/bulk target |18 passed +separate1 passed;final TypeScript0 |
| Task6 initial/fixture fix/final context |Initial14 pass+1 timeout; boundary1 PASS; final enhanced context2 PASS |
| Task7 combined backend |51 JUnit0 failure/error/skip,exit0; post-exit fork shutdown diagnostic separately recorded |
| Task7 combined frontend +fixed keyboard visual +final captures/touch |33 passed+1 fixture expectation failure; corrected visual1 PASS; final visual/captures/touch1 PASS;lint/type/build0 |
| Canonical ./pre-push/pre-push.cmd |Canonical pre-push PASSED, exit0; 522 backend0 failure/error/skip, 310 Chromium passed+1 expected skip; lint/TypeScript/build/Docker PASS |
| Current full/production npm audit |Full5 high dev/exit1; production0/exit0; package/lock unchanged |
| Final Docker/3000/8080/Swagger health |Next dev restored; Docker/PostgreSQL healthy;3000/8080/Swagger/API docs200; read filter schema verified |

İlk session fixture heading/network sample yarışında real refresh200/projects200 vardı; aynı HTTP200 assertion gerçek completion'ı bekleyecek şekilde düzeltildi. Initial page clamp Effect lint hatası conditional state adjustment ile giderildi. Late-response fixture account menu önce açık notification popup'ı dismiss ediyordu; explicit close sonra logout, timeout artırılmadı. Visual test automatic activation varsaydı; actual primitive manual keyboard modeli doğrulandı. Failed attempts PASS sayılmadı.

Normal successful acceptance actual frontend/backend/PostgreSQL; route.fulfill yalnız açık TEST-ONLY actual-response relay için, fake success body yok. Error/latency/style/cache/reference fixtures ayrı sınıflandırıldı. Own QA UUID projects API archive ile temizlendi; failed attempt'in exact QA project/owner kimliği doğrulanıp archive204 yapıldı. Kullanıcı records/volumes silinmedi; QA account/archived metadata kalabilir. Final HEAD/index/prompt preserved;66 protected migration/ADR/package/lock/ENV/Compose/security matcher/RolePolicy hashes unchanged, git diff --check0. Source/JUnit/audit/command/exit/screenshots `.local/notification-history/` Git dışı kayıtlarında; raw auth/session traces yayımlanmadı.

## Remaining issues

Approved notification read/history scope ve final quality gate kapalı. Independent ESLint/braces5 high dev debt açık; production audit0. bu feature dependency/release waiver değildir. Offset pagination concurrent inserts/state changes sırasında boundaries'i değiştirebilir; stable unchanged dataset order + fresh reconciliation/page clamp kullanılır. Other tab sync existing15/30-second foreground polling kadar gecikebilir; immediate realtime garantisi yok. Project hard-delete cleanup retains its existing policy. Browser matrix Chromium; diğer browserlara test geçti denmez.

### Kullanıcı kontrolü

1. QA recipient hesabında Yeni'den bir bildirimi okundu yap: row Geçmiş'e geçsin, badge azalsın, reload/login sonrası aynı ID/content korunsun.
2. QA hesabında >20 unread varken son sayfadan Tümünü okundu: tüm own unread rows Geçmiş'te, Yeni empty/badge0; yalnız görünen sayfa değil. Yeni event gelirse yeni unread görünmesi doğru.
3. Yeni/Geçmiş server pages, keyboard arrows+Enter/Space, touch, focus ve üç dil/light-dark/320px davranışını kontrol et.
4. Team-deletion popup kapat: explicit read yapılana kadar Yeni'de kalsın. Görevi aç: read-on-open ve task dialog/resource authorization korunsun.
5. Bu completion ve planı incele. Commit/push/staging kullanıcıya bırakıldı; independent dev security follow-up ayrı konudur.
