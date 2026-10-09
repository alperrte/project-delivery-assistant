# PDA — Notification History & Read State Planı

Tarih: 2026-10-07. Durum: **Tasks1?2 complete; Task3 in progress.**

Source of truth: `.agents/PDA_Notification_History_and_Read_State_Plan_and_Implementation.md` çalışma modeli, 1–42 bölümleri, final teslim formatı ve 32 kritik kuralının tamamı. Prompt ve `frontend/CLAUDE.md` tamamen okundu; CLAUDE → AGENTS yönlendirmesi, repository/security/auth/API rehberleri, frontend workflow/design kuralları, globals.css ve ilgili installed Next dokümanı incelendi. Kullanıcı onayıyla bu plan implementation source of truth olarak kullanıldı.

Her task: **implementation → targeted test → gerekli bug fix/retest → Definition of Done → ilgili checkbox `[x]` → sonraki bağımlı task**. DoD bitmeden bağımlı taska geçilmez. İlk plan tesliminde kutular açıktı; güncel implementation/gate kanıtı verification kayıtlarındadır. Agent commit/push/staging/pull/merge yapmadı.

## 1. Güncel temel ve kaynak bulguları

Başlangıçta `notification-service` eski `f853a5c` HEAD'indeydi; inceleme sırasında **kullanıcı main'i pull ederek** güncelledi. Plan eski branch'e göre hazırlanmadı. Güncel branch `notification-service`, HEAD `d82fcb0987114198eba086e61bfbcdedc1a2900a`; yerel `origin/main` ile ahead/behind **0/0**. Agent fetch/pull/merge/branch değişimi yapmadı. Güncelleme sonrası başlangıç status'unda yalnız kullanıcının notification prompt'u untracked; index'te kullanıcı değişikliği yok. Güncellik yerel ref karşılaştırmasıdır; ayrıca remote fetch yapıldığı iddia edilmez.

| Alan | Gerçek kaynak / davranış | Plan etkisi |
| --- | --- | --- |
| Read modeli | `notification/domain/Notification.java`: `read` → DB `is_read`, nullable `readAt`; `markRead()` zaten read ise no-op | Yeni state/entity veya physical move yok; aynı kayıt read filtresiyle Geçmiş'te görünür |
| Schema | V31 own/newest index ve unread partial index; V56 task snapshot, V57 team deletion/presentation; en yüksek migration V58 | Eski migrations değişmez; başlangıçta yeni migration gerekmiyor |
| Liste | `NotificationService.list` + `NotificationRepository.list`: recipient predicate, `unreadOnly`, optional type, server page; `createdAt DESC,id DESC` | `unreadOnly=false` **tümü** demek; history-only filtresi eksik |
| Existing API | `NotificationController`: list/count, PATCH own ID/read, PATCH read-all; private/no-store | Endpointleri yeniden yazma; aynı GET'e additive filter ekle |
| Mutasyonlar | Own ID lookup; `markAllRead` tek SQL UPDATE: recipient + `read=false`; read-all response `count` = değişen row sayısı | Count response'u remaining unread sayısı sanma; mevcut concurrency/idempotency gerçek testle doğrulansın |
| Presentation | `claimTeamDeletion` unread/unpresented row'u atomic SKIP LOCKED ile claim eder; `popupPresentedAt` set, read değişmez; entity DynamicUpdate | At-most-once popup/read ayrımı korunur; claim/fanout/recovery yeniden tasarlanmaz |
| Center | `features/notifications/components/notification-center.tsx`: Base UI nonmodal Popover, server page 20, individual Check ve header Checks action mevcut; tek karışık liste | Yeni/Geçmiş Tabs ve ayrı server scopes; mevcut actions/state rendering geliştirilir |
| API/cache | `notifications/api.ts`: liste read filter göndermiyor; GET/claim AbortSignal var, read/readAll yok. Keys actor/list/page ve actor/count | Filter key'e girer; read mutations için signal/lifetime/synchronous guard gerekir |
| Owner/polling | `notification-owner.tsx`: actor lifetime, foreground claim 30 sn/focus/online; center count 30 sn, açık liste 15 sn | Aynı owner/polling kullanılır; yeni socket veya paralel provider yok |
| Auth boundary | AppShell actor-keyed NotificationOwner; login/register/logout/session-end clearPrivateNotifications cancel/remove/toast cleanup | Mevcut izolasyon iki liste ve late mutation'a genişletilir; unrelated private cache modelini değiştirme |
| Task link | Center “Görevi aç” click'i unread item için read mutation yapıp task dialog URL'sine gider; finalFocus suppression mevcut | **Kullanıcı kararı: bu davranış korunacak** |
| Types | 21 mevcut NotificationType; DTO nullable statusChange/teamDeletion/popupPresentedAt | Payload/title/message/time/resource korunur; generic read/history davranışı bütün türlere uygulanır |
| Project hard delete | `ProjectDeletionCleanup` mevcut `ProjectDeletedEvent` ile project notification rows'unu siler | Read işlemi kayıt silmez. Bağımsız, mevcut project hard-delete cleanup politikası bu taskta değişmez; sonsuz retention sözü verilmez |
| Tests | NotificationIntegrationTest, TeamDeletionNotificationIntegrationTest, TaskProgressNotificationApiIntegrationTest; frontend team-deletion-notifications, notification-cache, my-task-cards | Existing business/snapshot/popup/navigation assertions korunur; eski karışık liste locator'ları tab flow'una uyarlanır |

Bu tur static source/doküman incelemesidir. Yeni test, runtime probe, npm audit veya canonical gate çalıştırılmadı; servisler durdurulmadı/başlatılmadı. Eski completion sayıları bu feature'ın kanıtı değildir. Sharp/source-map-js security teslimleri tarihsel; mevcut dev dependency borcu implementation preflight'ta tekrar ölçülür, paket güncellemesi bu taskın kapsamı değildir.

## 2. Kesin ürün ve teknik sözleşme

### 2.1 API / persistence

Aktif/Yeni = **`read=false`**, Geçmiş = **`read=true`**. Aynı row/ID/content/createdAt/resource/snapshot kalır; read/readAt kalıcı güncellenir. Yeni notification delete, archive, mark-unread veya restore API'si yok.

Mevcut GET `/api/v1/notifications` için önerilen additive **nullable boolean `read`** parametresi:

| Girdi | Sonuç |
| --- | --- |
| read omitted, unreadOnly omitted/false | Eski all-records davranışı |
| read omitted, unreadOnly=true | Eski unread-only davranışı |
| read=false | Yalnız unread; unreadOnly=true ile de uyumlu |
| read=true, unreadOnly omitted/false | Yalnız read/history |
| read=true, unreadOnly=true | Çelişen filtre → 400 |
| Invalid boolean/type/page/size | Mevcut ProblemDetail 400 |

Own recipient predicate her durumda SQL/JPA sorgusunda kalır; type filtresi ve content/total/count aynı koşulları kullanır. Page size default 20, izinli 1–100; newest sırası `createdAt DESC,id DESC`. History `readAt` sırasına sessizce çevrilmez. Eski Java list çağrıları gerekiyorsa compatible overload ile korunur; eski GET callers all davranışı almaya devam eder. Schema/DTO/sort/security matcher değişikliği başlangıçta gerekmiyor.

PATCH `/{id}/read` ve `/read-all` mevcut source of truth. Sequential repeat first readAt'i korur; concurrent read/read-all/claim için bounded PostgreSQL testleri yazılır. Somut readAt/state kaybı görülürse aynı use-case içinde dar conditional update/row serialization düzeltmesi yapılır ve tekrar test edilir; yeni lock infrastructure/notification lifecycle kurulmaz. Read mutation title/message/snapshot/popupPresentedAt'i değiştirmez.

Mark-all visible page/type subset değil, **principal'ın bütün current unread** kayıtlarıdır. `{count}` changed-row count'tur; badge `/unread-count` ile reconcile edilir. Kontrollü testsiz “response.count = remaining unread” veya kör `badge=0` yazılmaz. Bulk statement sonrası yeni event gelirse yeni unread kayıt doğrudur; onu toplu read'e dahil olmuş gibi göstermeme.

Offset paging'in stable sort'u korunur. Aynı dataset'te eşit createdAt tie-break ID ile deterministik; concurrent insert/read nedeniyle sayfa sınırları değişebilir. Refetch/page clamp ve ID-keyed render kullanılır; cursor/history stack veya tüm veriyi indirip client `.filter()` yok. V31 mevcut index'leri önce ölçülür; yeni index/migration ancak gerçek query-plan ihtiyacı kanıtlanırsa ayrıca açıklanır, V58 veya eski migration'lar edit edilmez.

### 2.2 Panel ve actions

- Mevcut bell/nonmodal Popover içinde ortak başlık, üst sağ **Tümünü okundu**, altında mevcut Base UI Tabs: **Yeni / Geçmiş**. Navbar viewport-centered yerleşimi, header reserve, chat inert/history davranışı korunur.
- Yeni default tab; tab başına page state ayrı tutulur. Panel tekrar açılınca Yeni/page 0; account değişince eski tab/page/error/pending state temizlenir. History ilk sayfa yalnız tab açılınca fetch; tüm history veya bütün sayfalar preload edilmez.
- Mevcut server page 20/pagination reuse. Key en az actor + list + read scope + page + size ve kullanılan type içerir; count ayrı actor scope. Tab switch sırasında diğer tabın cached content'i placeholder olarak gösterilmez.
- Her tabın kendi loading/error/retry/empty durumu; Yeni boşken Geçmiş erişilebilir. Count fetch hatası “0 unread” gibi sunulmaz; mark-all unavailable/pending/0 state'te disabled. Header action iki tabda da aynı principal'ın Yeni kayıtlarını hedefler.
- Unread row belirgin; history daha sakin ama token contrast korunur. Gövde plain text, generic/i18n fallback ve structured snapshots mevcut rendering'den gelir. Mobile read action sürekli erişilebilir, minimum 44px target; yeni icon/component library yok.
- Individual read gerçek Button + Check/tooltip/accessible label. Mark-all existing Checks/Button. History rows yeni read action taşımaz; yeni “okunmadı yap” action yok.
- **Onaylı karar:** “Görevi aç” mevcut read-on-open davranışını sürdürür; existing task URL/dialog/nav/focus contract'ı korunur. Resource erişimi task API'sinde yeniden enforce edilir; eski/deleted task failure UI bypass edilmez. SQUAD_DELETED'a dead team link eklenmez.

### 2.3 Mutation, cache, focus ve account güvenliği

İlk tercih **server-confirmed mutation**, optimistic read/count yok. Normal mutation başarısızsa row/count/history önceden değişmemiş olur; localized inline feedback ve tekrar deneme mümkün. Server success'ten sonra current actor list/count in-flight GET'leri cancel/reconcile edilir; **list prefix bütün scopes/pages** invalidate edilerek active/history/count fresh okunur. Warm inactive history de stale işaretlenir; hard reload yok.

Mutation success ile sonraki refresh failure ayrıdır: committed read'i “mutation failed/geri alındı” diye gösterme. Confirmed DTO state korunur; refresh error/retry sun, stale unread row veya tahmini badge'i başarı gibi sunma. Backend read-all count'u page count/toplam/history toplamı olarak kullanılmaz.

Read/readAll API signal alır; owner/current actor kontrolü **dispatch öncesi ve completion/error sonrası** yapılır. Bir synchronous in-flight guard individual/read-all çakışması ve aynı-frame double submit'i durdurur; state pending tek başına yeterli sayılmaz. Unmount/logout/session change abort eder; geç commit olmuş old-actor mutation DB'de geri alınmış sayılmaz, yeni actor UI/cache/toast'a yazmaz. Mutation automatic retry yok; mevcut CSRF/401 refresh behavior korunur. Shared API renewal modelini feature için yeniden yazma.

Read sonrası kaybolan row'da odak vardıysa ve kullanıcı başka yere taşımadıysa odak sıradaki/önceki action'a; row kalmadıysa current panelin named empty heading'ine gider. Mark-all sonrası empty panel focus stabil; auto History switch veya popup focus steal yok. Tab keyboard/arrows/Enter/Space modeli existing primitive'e bırakılır. Navigation close finalFocus eski task trigger'a yarışarak dönmez; Escape paneli kapatıp bell'e döner.

Existing `notificationKeys.actor(userId)` ve clearPrivateNotifications reuse; bütün list/count variants ve read controllers aynı lifetime'a bağlıdır. Storage'a private list/token/history yazılmaz. Polling sayıları korunur: foreground owner claim 30 sn, badge 30 sn, açık current list 15 sn; hidden/background/contained/logout behavior mevcut kalır. Other tab mutation current tabda existing focus/poll refetch ile görünür; yeni realtime/broker/socket/BroadcastChannel kurulmaz.

### 2.4 Popup ve retention sınırı

`popupPresentedAt != readAt`; popup claim/show/close/read-all birbirinden farklıdır. Gösterilip kapanmış ama explicit read yapılmamış team deletion **Yeni**'de kalır. Read yapılınca Geçmiş'te aynı event/snapshot/presentation timestamp kalır. Read-before-claim row claim edilemez; popup gösterildikten sonra read yapılması ikinci grant üretmez. Aktif toast'ın kapanışı kendiliğinden mark-read değildir; bu task toast queue/claim/replay semantics'ini yeniden tasarlamaz.

Mevcut project permanent-delete transaction'ı o project's notifications'ı temizler. Bu ayrı lifecycle davranışı korunur; test cleanup retention proof'tan **sonra** yapılır. Read sırasında veya bu feature için notification delete eklenmez.

## 3. Dependency sırası

```text
Task1 Güncel contract/baseline
 → Task2 Additive server read filter + mevcut read/read-all doğrulaması
 → Task3 Actor-scoped frontend API/query/mutation lifecycle
 → Task4 Yeni/Geçmiş paneli + gerçek server pagination/states
 → Task5 Read/read-all actions + cache/focus/task-link entegrasyonu
 → Task6 Account/polling/popup/concurrency entegrasyonu
 → Task7 Birleşik gerçek security/data/visual regression
 → Task8 Full gate/docs/ayrı implementation completion
```

Backend read/read-all hazır olduğu için ayrı yeni mutation endpoint taskları yok. Task2 mevcut mutasyonları test eder; yalnız kanıtlanan sorun varsa minimum düzeltir.

## Task 1 — Preflight, contracts ve current baseline

### Amaç
Güncel source/runtime ve yukarıdaki kararları uygulanabilir başlangıç sözleşmesine dönüştür.

### Neden bu sırada?
Source drift, eski image ve account/session fixture sorunları sonraki feature testlerini yanlış yönlendirmemeli.

### Prerequisite
Yok; kullanıcı implementation onayı.

### Etkilenecek alanlar
- Backend: controller/service/repository/entity ve event/cleanup contracts.
- Database: V31/V56/V57/V58 indexes/constraints; mevcut read/presentation kolonları.
- Frontend: Center/Owner/API/cache, task-link ve shell/demo.
- Cache: actor/list/count ve boundary cleanup inventory.
- Security: SECURITY §11/auth ADR; own principal+CSRF/forced-password.
- i18n: current notifications labels TR/EN/DE.
- Accessibility: Popover/Tabs/focus/44px ve navbar guards.
- Tests: existing Notification/TeamDeletion/TaskProgress suites ve browser baseline.

### Checklist
- [x] 1.1 HEAD/branch/index/worktree/prompt/source hashes al; kullanıcı dosyalarını koru; d82fcb0'dan drift varsa gerçek diff'i incele.
- [x] 1.2 API filter compatibility, confirmed mutation/focus, approved task-link ve read/popup/cleanup sınırlarını freeze et.
- [x] 1.3 Runtime image/schema/3000/8080/Docker/Node/JDK uygunluğu; mevcut frontend dependencies/API typings ile baseline doğrula; eski image PASS sayılmasın.
- [x] 1.4 Targeted backend + notification/cache/my-task-cards/header/landing baseline çalıştır; command/exit/pass-fail-skip, gerçek vs TEST-ONLY scope kaydet.

### Definition of Done
- [x] Implementation'ı engelleyen contract belirsizliği yok; değişiklik gerekirse somut fark kullanıcıya sunuldu.
- [x] Current source/runtime/baseline kayıtlı; eski feature/gate sayıları yeni başarı iddiasına dönüştürülmedi.

## Task 2 — Read/history backend filter ve mevcut mutations

### Amaç
Gerçek history-only server sayfalama ekle; mevcut own read/read-all/presentation davranışını doğrula.

### Neden bu sırada?
Frontend Geçmiş doğru content/total için server read filtresine bağımlı.

### Prerequisite
Task1 DoD.

### Etkilenecek alanlar
- Backend: NotificationController/Service/Repository; conditional mutation fix yalnız kanıt varsa.
- Database: mevcut rows/indexes; yeni schema yok, readAt/state transaction ölçümü.
- Frontend: downstream query contract; production UI Task4.
- Cache: additive list read scope sözleşmesi.
- Security: recipient predicate, validation400/IDOR/CSRF/own bulk scope.
- i18n: existing ProblemDetail → frontend mapping; yeni domain metni yok.
- Accessibility: downstream tab content/count doğruluğu.
- Tests: NotificationIntegrationTest; proposed NotificationReadStateIntegrationTest ve mevcut TeamDeletion/TaskProgress.

### Checklist
- [x] 2.1 Nullable read parameter + legacy unreadOnly compatibility matrix ve service callers korunmuş; filtered page/count/type/sort aynı predicate.
- [x] 2.2 Fresh PostgreSQL rows ile read=false/read=true/all/type/page/tied-time ordering; body actor seçemez, foreign ID404 ve size/type/boolean400.
- [x] 2.3 Individual repeat/read-all repeat, concurrent same-ID/two bulk/individual-vs-bulk, first readAt ve content/snapshot/presentation retention; bounded futures/barriers. Bug varsa dar fix ve retest.
- [x] 2.4 Read-before/after claim ve new-event-vs-bulk; GET read-only, no notification DELETE. Existing indices/query plans ile bounded pagination kontrolü.

### Definition of Done
- [x] Own read/history server totals/sort ve legacy callers doğru; endpoint/schema/auth yeniden tasarlanmadı.
- [x] Security/persistence/concurrency/claim/V56 regressions gerçek PostgreSQL'de geçti; skip PASS sayılmadı.

## Task 3 — Frontend API/query keys ve mutation lifetime

### Amaç
Yeni server scopes'u existing actor cache'e bağla; read operation'larını account lifetime'a bağla.

### Neden bu sırada?
Tabs/action UI güvenli query ve mutation altyapısı ister.

### Prerequisite
Task2 DoD.

### Etkilenecek alanlar
- Backend: Task2 contracts; bu aşamada yeni use-case yok.
- Database: Task2 persistent query/mutation contract korunur.
- Frontend: notifications API/keys; küçük shared hook/helper gerekirse notification feature içinde.
- Cache: actor/list/read/page/size/type, prefix invalidation/cancel/remove.
- Security: AbortSignal/current owner dispatch-completion guard; existing auth boundaries.
- i18n: failure/refresh/pending labels hazırlığı.
- Accessibility: pending/error state hooks; focus UI Task5.
- Tests: notification-cache spec, API query encoding ve lifetime tests.

### Checklist
- [x] 3.1 Typed read scopes ve default/all compatibility; read/readAll signal forwarding; current owner check ve synchronous submit guard.
- [x] 3.2 Query key filters tam; all pages/scopes list-prefix invalidation + count reconcile; unrelated caches temizlenmesin.
- [x] 3.3 Logout/unmount/actor change abort ve late response/error yeni actor'a yazmasın; existing clearPrivateNotifications tüm variants'ı kapsasın.
- [x] 3.4 Unit/cache tests + gerçek scoped request regression; lint/type/build ve existing notification-owner behaviors.

### Definition of Done
- [x] API ile key filter aynı; no global cache reset/storage/custom provider.
- [x] Pending/late actor/cancellation mekanizması testli; production tab semantics henüz tamamlandı sayılmadı.

## Task 4 — Yeni/Geçmiş IA, server pagination ve states

### Amaç
Mevcut NotificationCenter'ı iki anlaşılır read-state sekmesine ayır.

### Neden bu sırada?
Action entegrasyonu ayrı listelerin doğru query/sayfa/empty davranışı üstünde yapılmalı.

### Prerequisite
Task3 DoD.

### Etkilenecek alanlar
- Backend: existing filtered GET ve totals.
- Database: server filtre/sayfa predicate; UI için fake data yok.
- Frontend: NotificationCenter, existing Tabs/Popover/Button/Skeleton/Tooltip; catalog labels.
- Cache: per-tab page/query, enabled/lazy/history state.
- Security: same expected actor; contained no live requests.
- i18n: TR/EN/DE Yeni/Geçmiş/list/empty/loading/error/retry.
- Accessibility: named Tabs/tabpanels, keyboard and readable state text.
- Tests: proposed notification-history.spec; existing center/landing/header regression.

### Checklist
- [x] 4.1 Header + Yeni(default)/Geçmiş Tabs; task/status/team payload rendering korunmuş; read actions history'de yok, mark-all header korunmuş.
- [x] 4.2 Unread/history real server pages20; separate page state, lazy history, close/open/account reset; no client all-download filter.
- [x] 4.3 Her tabda loading/error/retry/empty; active empty sonrası history erişimi, count unknown ve long content overflow doğru.
- [x] 4.4 Panel viewport bounds/Tab/arrow/Escape; contained demo disabled/no backend traffic; targeted real list/pagination + lint/type/build.

### Definition of Done
- [x] Yeni yalnız unread, Geçmiş yalnız read; actual server totals/pages/content aynı dataset'e ait.
- [x] Separate states/i18n/demo/navigation sağlam; action persistence acceptance Task5'te kapanır.

## Task 5 — Individual read, mark-all ve warm-cache/focus

### Amaç
Gerçek mutation sonrası kayıt read/history/count zincirini reload olmadan tamamla.

### Neden bu sırada?
Artık iki listede mutation sonuçları ve focus somut olarak doğrulanabilir.

### Prerequisite
Task4 DoD.

### Etkilenecek alanlar
- Backend: existing PATCH response.
- Database: committed state/fresh UUID reads.
- Frontend: row Check/readAll Checks controls, inline feedback/retry; task link compatibility.
- Cache: current actor active/history all pages/count reconciliation, page clamp.
- Security: owner/pending/abort guards; no fake successful read.
- i18n: labels, save failure versus post-success refresh failure.
- Accessibility: 44px/buttons/tooltip, row-removal focus/current user focus korunması.
- Tests: individual/bulk real E2E; my-task-cards task dialog/open/read regressions.

### Checklist
- [x] 5.1 N1/N2 unread→N1 explicit read: one PATCH, fresh DB readAt, same ID/history/content, N2 unread, count2→1; warm tabs/reload/login persistence.
- [x] 5.2 >20 unread→mark-all: all own rows read, current page ile sınırlı değil, controlled count0/history pages; zero/pending/error/double-submit states.
- [x] 5.3 Last unread page shrink/clamp, inactive history invalidation, old GET late return, confirmed success+refresh failure ayrımı; no optimistic false move/count.
- [x] 5.4 Approved Görevi aç/read-on-open ve real dialog route/focus korunsun; error/failed mutation retry ve disappearing row focus testleri; lint/type/build.

### Definition of Done
- [x] Real DB state + two tabs + badge + warm navigation doğru; no row deletion/hard reload.
- [x] Individual/all/task-link/failure/double-click/focus targeted tests geçti; business assertions silinmedi.

## Task 6 — Account, polling, popup ve concurrency entegrasyonu

### Amaç
Read/history değişimini mevcut owner/claim/session davranışlarıyla birlikte güvenli tut.

### Neden bu sırada?
Tam UI/action chain hazır; account ve concurrent stale results artık gerçekçi test edilir.

### Prerequisite
Task5 DoD.

### Etkilenecek alanlar
- Backend: existing own query/read/bulk/claim use-cases.
- Database: transactions ve snapshots.
- Frontend: Owner/Center/auth cleanup yalnız somut regression gerektirirse dar değişiklik.
- Cache: both tab keys/count/pending/error/toast across A→B and A→logout→A.
- Security: foreign ID/401/CSRF/forced password, server actor remains principal.
- i18n: popup/history/read state distinction three languages.
- Accessibility: no toast/navigation focus steal, stale focus cancelled.
- Tests: team-deletion-notifications, notification-cache,08-session-expiry + proposed read/history concurrency cases.

### Checklist
- [x] 6.1 A unread/history/count warm→logout→B; delayed real old list/count/read/read-all completion/error B'ye sızmasın; pending controls/account tab state reset.
- [x] 6.2 Read in tab1→tab2 focus/poll fresh state; simultaneous individual/two mark-all; same notification one row/no duplicated side effect.
- [x] 6.3 Presented unread team deletion Yeni'de; explicit read→Geçmiş, popup timestamp aynı; claim before/after read and replay absence; task snapshot payload retained.
- [x] 6.4 Hidden/logout/contained no claim/live UI traffic; existing intervals/focus/renewal/CSRF unchanged; ordinary new event after bulk remains unread.

### Definition of Done
- [x] Old account data/responses/actions new account UI'yi etkilemiyor; server IDOR ve CSRF gates sağlam.
- [x] Atomic popup/read separation ve current polling/renewal/multi-tab regressions gerçek tests'te geçti.

## Task 7 — Birleşik gerçek data/security/visual regression

### Amaç
Prompt acceptance chains ve responsive/a11y matrix'i aynı current source üzerinde doğrula.

### Neden bu sırada?
Tüm surfaces hazır; full gate öncesi scope bugları çözülür.

### Prerequisite
Task6 DoD.

### Etkilenecek alanlar
- Backend: all targeted Notification/TeamDeletion/TaskProgress.
- Database: fresh prepared DB reads.
- Frontend: new read/history spec, existing notification/cache/task/header/chat/history/landing tests.
- Cache: current actor warm scopes/page boundaries/fault recovery.
- Security: owner/non-owner/anonymous/disabled/session/CSRF/IDOR; payload plain text.
- i18n: TR/EN/DE, long strings and generic/structured type bodies.
- Accessibility: 320/390/768/1024/1440, light/dark, keyboard/touch/reduced motion/contrast/focus.
- Tests: normal successes actual event→API→PostgreSQL→UI; negative latency/abort fixtures labelled TEST-ONLY.

### Checklist
- [x] 7.1 A N1/N2 and B N3 real event dataset; individual/bulk/cross-user DB read/readAt/count/content/snapshot retention and reload/login.
- [x] 7.2 >20/>40 server history pages, tied timestamps deterministic backend fixture, last active-page shrink; no whole-history fetch/fake filtering/query per row.
- [x] 7.3 Actual failure/network/retry/refresh separation, late list/count/mutations, mark-all creation race, popup/read and project deletion cleanup compatibility.
- [x] 7.4 Both tabs/individual/all/list/pagination/empty/error screenshots and actual focus review; all sizes/themes/languages/motion, header autohide/full chat/demo regressions.
- [x] 7.5 Scope fixes retest; command/exit/count/source/artifact recorded; own QA UUID cleanup only, user data/volumes preserved.

### Definition of Done
- [x] Acceptance matrix real persistence and browser evidence complete; mock/pure/reference evidence not counted as success-chain proof.
- [x] No open scope bug; screenshots alone or old full gate not PASS; next task may proceed only after targeted gates.

## Task 8 — Full gate, documents ve ayrı completion

### Amaç
Current implementation source üzerinde bütün kalite kapıları ve reviewable ayrı teslim.

### Neden bu sırada?
Task7 tamamlanmış source'u doğrular; plan feature completion yerine geçmez.

### Prerequisite
Task7 DoD.

### Etkilenecek alanlar
- Backend: full Maven, filter/mutation/snapshot/presentation/cleanup regressions.
- Database: Testcontainers ve persistent state verification.
- Frontend: lint/TypeScript/build/targeted/full Chromium/current runtime image.
- Cache: final actor/filter scope diff.
- Security: SECURITY §11 inventory/Swagger ve API scope.
- i18n: scoped catalog/design notes.
- Accessibility: scoped checklist notes, global boxes unchanged unless fully proven.
- Tests: canonical root pre-push, Docker build/start/health;3000/8080/Swagger restore.

### Checklist
- [x] 8.1 Current backend full tests, frontend lint/type/build, targeted + full Chromium PASS; skip/failure causes recorded; no stale image/auth fixtures counted PASS.
- [x] 8.2 Canonical ./pre-push/pre-push.cmd exit0 including backend and Docker; final health3000/8080/Swagger, verified project processes restore; no quota/ENV weakening.
- [x] 8.3 API/security/database/architecture/folder/design scoped notes; filter compatibility/changed-row count/retention/popup limits clear; web checklist relevant notes only.
- [x] 8.4 Actual completion date `docs/compliation/YYYY-MM-DD-notification-history-read-state.md`, README format and required final headings; safe API examples/manual checks/remaining limits.
- [x] 8.5 Final source/HEAD/index/prompt/worktree compare; no commit/push/staging/pull/merge; original user data and independent dependency debt reported.

### Definition of Done
- [x] All previous DoD and full regression/canonical pre-push PASSED; backend/Testcontainers skips never counted PASS.
- [x] Separate implementation completion ready; only genuinely blocker-free verdict says `Kalan blocker yok.`

## 4. API / Swagger hedef inventory

Base `/api/v1`; cookie session, own current principal; mutations CSRF. Private/no-store mevcut. No new matcher/permission/body actor/ADMIN bypass.

| Method/path | Request | Success | Önemli hatalar |
| --- | --- | --- | --- |
| GET /notifications | read?,legacy unreadOnly?,type?,page,size |200 server page; Yeni read=false,Geçmiş read=true |400 invalid/conflicting filter/paging,401 session,403 existing forced-password gate |
| GET /notifications/unread-count | Body yok |200 `{count}` remaining own unread |401/403 |
| PATCH /notifications/{id}/read | Own notification UUID,body yok |200 same NotificationResponse with read/readAt |400 malformed UUID,401 session,403 CSRF/forced-password,404 missing/foreign |
| PATCH /notifications/read-all | Body yok; actor principal |200 `{count}` changed rows |401/403 |
| POST /notifications/team-deletions/claim | Mevcut body yok contract |200 one claim or204; read unchanged |400 nonempty body,401/403 |

Safe GET `?read=true&page=0&size=20`; safe read PATCH own QA notification UUID, no auth credentials in examples. Swagger `http://localhost:8080/swagger-ui/index.html`, `/v3/api-docs`, normal session+CSRF. Production docs toggle/security unchanged.

## 5. Validation rotası — henüz çalıştırılmadı

Proposed test adları mevcut dosya gibi sunulmaz; implementation sırasında actual isimlerle sabitlenir. Baseline/current builds önce source ve backend image ile eşleştirilir. Test-only fixtures quota budget'a uygun gerçek shared sessions kullanır; actual login/account-switch assertions korunur.

```powershell
Push-Location backend
.\mvnw.cmd '-Dtest=NotificationIntegrationTest,TeamDeletionNotificationIntegrationTest,TeamDeletionNotificationMigrationTest,TeamDeletionPublicationRecoveryTest,TaskProgressNotificationApiIntegrationTest,TaskStatusNotificationMigrationTest' clean test
# Proposed NotificationReadStateIntegrationTest oluşturulunca targeted pakete eklenir.
.\mvnw.cmd clean verify
Pop-Location

Push-Location frontend
npm.cmd run lint
npx.cmd tsc --noEmit
npm.cmd run build
npx.cmd playwright test e2e/team-deletion-notifications.spec.ts e2e/notification-cache.spec.ts e2e/my-task-cards.spec.ts e2e/08-session-expiry.spec.ts --project=chromium
# Proposed notification-history.spec.ts oluşturulunca targeted pakete eklenir.
npx.cmd playwright test --project=chromium
Pop-Location
.\pre-push\pre-push.cmd
```

Final implementation headings: Final verdict; Task checklist; Notification read model; Active notifications; Notification history; Individual mark-as-read; Mark-all-as-read; Unread count / badge; Cache and account isolation; Authorization / IDOR; Responsive / accessibility / i18n; Changed files; Test results; Remaining issues.

| Prompt kapsamı | Plan karşılığı |
| --- | --- |
|1–3,15–17 |Source audit,nullable read filter,server paging/sort,Task1–4 |
|4–14,25–28,34–35 |Tabs/states/actions/count/focus/i18n,Task3–5/7 |
|18–24,31–33 |Owner/session/IDOR/concurrency/polling/popup distinction,Task2/3/6/7 |
|29–30,38 |Real event/DB/browser individual/bulk acceptance,Task5–7 |
|36–37 |No notification DELETE/mark-unread,existing project cleanup boundary |
|39–42 +32 critical rules |Ordered DoD/checklist,Git preservation/full gate/separate completion,Task1/8 |

**İlk plan tesliminin tarihsel sınırı:** Bu tur yalnız kaynak/doküman incelemesi ve bu root plan yazımıdır. Branch güncellemesini kullanıcı yaptı. Production/backend/frontend/migration/test/config/package/lock kaynakları değişmedi; servisler ve veri değiştirilmedi; test/gate çalıştırılmadı; implementation completion oluşturulmadı. Kullanıcı onayı sonrası Task1'den başlanır.


## Implementation verification

### Task1 - 2026-10-07

HEAD d82fcb0/notification-service/index/user prompt preserved;1836 tracked hashes unchanged. Current backend image build/start/health, Node24.19.0/JDK25.0.1/Docker29.8.1 confirmed. Clean targeted Notification/TeamDeletion/TaskProgress/PostgreSQL baseline22 tests0 failure/error/skip,exit0; lint/TypeScript/build0 and24 Chromium baseline passed. Pure cache/reference/failure cases remain TEST-ONLY, not feature persistence proof. Existing project Next dev temporarily stopped after owner verification; restore required at final. Nullable read filter compatibility, server-confirmed mutation/focus, approved task-open read behavior and distinct popup/read/cleanup contracts frozen. Current npm audit5 high dev/exit1,production0/exit0; package/lock unchanged. Evidence .local/notification-history/task1-*; no feature implementation claim.


### Task2 - 2026-10-07

Additive nullable read filter and legacy unreadOnly/all/type/page compatibility implemented on the existing GET; recipient predicate and createdAt DESC/id DESC preserved. Real PostgreSQL stale individual/bulk barrier first produced expected red1 failure0 errors: stale JPA reader replaced the first committed readAt. Narrow conditional UPDATE (only own unread row) plus fresh entity readback fixed it; no schema/domain/auth/claim/event redesign. Final clean targeted29 tests0 failure/error/skip,exit0, includes7 new filter/IDOR/CSRF/own bulk/41-row stable paging/concurrent individual+bulk/new-event-after-bulk/popup snapshot cases and existing V56/V57/TaskProgress/registry regressions. Existing recipient ordering index and bounded history query reviewed; no new migration. Evidence task2-stale-read-red.log/task2-backend.log. Task3 may proceed; feature/full gate not complete.


### Task3 - 2026-10-07

Filter-aware actor/list/read/page/size/type keys and matching typed URL query added; legacy all list remains compatible. Read/readAll AbortSignal and one synchronous useNotificationRead guard reuse existing TanStack mutation; current owner checked before dispatch/completion/error, session boundary abort+unmount cleanup, no automatic retry. Reconciliation cancels late own list/count requests then invalidates all own scopes/pages only. Current backend image updated; lint/TypeScript/build0. First target16 PASS+1 existing expiry assertion race: trace real refresh200/projects200 but heading assertion sampled status before final network completion. Same200 assertion now polls actual response, no auth/quota changes; final whole target17 Chromium passed,exit0 (3 cache/path cases plus real notifications/task/session). Evidence task3-*/task3-final-ui.log. No tab/history feature completion yet.


### Task4 - 2026-10-07

Existing Popover now has controlled Base UI New/History tabs, separate server read filters/page cursors, lazy history and current-filter loading/error/retry/empty states. Read rows have no read action; header mark-all remains available and bounded. Close/open resets to New/page0; account owner remount isolates local state. Real41 task assignment event dataset verified20-size requests, independent pages, history-only payload, real fault recovery and New-empty/History access; no normal fake responses. Existing popup explicit-read locator updated to switch to History after disappearance, persistence/presentation checks retained. Initial lint rejected Effect state clamp; corrected conditional server-result clamp and hidden stale pager on errors. Final lint/type/build0 and21 Chromium passed (real history/notification/task plus cache/demo/reference regressions). Evidence task4-retest-*; no failed target remains. Task5 actions/focus/full gate pending.


### Task5 - 2026-10-07

Server-confirmed individual/read-all UI, shared synchronous guard, inline mutation versus committed-refresh errors, GET-only recovery, title-described accessible Check/tooltip and conditional focus restoration completed. Approved task link still starts own read then opens the existing task URL/dialog; denied duplicate dispatch does not navigate. Real UI2->1->0, warm tabs/badge/document, fresh prepared DB rows/readAt, reload/new login, network pre-dispatch failure, real commit+GET failure and same-frame single PATCH passed. Existing task/popup regressions retained. First target18 Chromium passed, lint/type/build0; extra server last-page21->20 clamp then22-own-row bulk (not visible-page-only)1 PASS, final TypeScript0. Combined evidence19 targeted passes, not a fabricated single-run count. Names/project QA only, no deletes/roles/session changes. Evidence task5-*/task5-page-*; Task6/full gate pending.


### Task6 - 2026-10-07

Real private-session B->A->B->A same-document switches held actual committed read/read-all responses and both actual refreshed list/count responses; old IDs/errors/badges absent in the new actor's active/history scopes, direct foreign read404 retained, fresh DB old-actor commits retained. Two contexts reconciled individual/bulk read through existing15s list/30s count foreground polling; no socket/provider/timer redesign. Initial target14 passed+1 fixture timeout: opening account menu while notification popup was open only dismissed the first popup, so logout locator waited. Fixture explicitly closes center before opening account menu; timeout unchanged. Boundary1 retest PASS; final strengthened count+late-boundary and two-tab target2 PASS, lint/type/build0 from unchanged production source. Existing popup timestamp/read/history separation and session expiry targets passed. Evidence task6-*/task6-boundary-*/task6-final-*. QA failed-attempt project may need own-ID cleanup in final audit; never user data deletion. Task7/full gate pending.


### Task6 - 2026-10-07

Real private-session B->A->B->A same-document switches held actual committed read/read-all responses and both actual refreshed list/count responses; old IDs/errors/badges absent in the new actor's active/history scopes, direct foreign read404 retained, fresh DB old-actor commits retained. Two contexts reconciled individual/bulk read through existing15s list/30s count foreground polling; no socket/provider/timer redesign. Initial target14 passed+1 fixture timeout: opening account menu while notification popup was open only dismissed the first popup, so logout locator waited. Fixture explicitly closes center before opening account menu; timeout unchanged. Boundary1 retest PASS; final strengthened count+late-boundary and two-tab target2 PASS. Existing popup timestamp/read/history separation and session expiry targets passed. Production lint/type/build0; current source quality is also covered by Task7. Evidence task6-*/task6-boundary-*/task6-final-*. QA failed-attempt project needs own-ID cleanup in final audit; never user data deletion. Task7/full gate pending.


### Task7 - 2026-10-07

Clean combined Notification/claim/read/snapshot/Project API/V58 cleanup/modularity backend51 tests0 JUnit failure/error/skip,exit0. Surefire post-System.exit(0) fork-shutdown diagnostic recorded separately, not a test failure or skipped Testcontainers proof. Current lint/type/build0; combined frontend33 passed+1 visual fixture keyboard expectation failed. Existing Tabs uses manual activation: ArrowRight focuses History, Enter activates; expectation corrected, no primitive/UI semantics changed. Visual1 retest PASS, then final two-tab screenshot capture/real touch1 PASS. All320/390/768/1024/1440,TR/EN/DE,light/dark,reduced/explicit motion-off,long160 structured snapshots,44px touch,overflow/Escape/focus and current chat/history/demo/task regressions verified. Mark-all pre-dispatch failure added to real persistence acceptance; no normal fake response. New/History screenshots inspected. Exact failed Task6 QA project resolved by own fixture identity and archived204 via own owner session; users/volumes retained. Evidence task7-*, visual-*,failed-qa-cleanup.json. Current source full gate remains pending.


### Task8 - 2026-10-07

Canonical ./pre-push/pre-push.cmd PASSED exit0 on current source: clean backend522 tests0 JUnit failure/error/skip; frontend lint/TypeScript/production build0; full Chromium310 passed+1 expected production-disabled crash-route skip; Docker build/start/health. No full-gate failure/retry or quota/ENV change. Final current audit5 high dev/exit1,production0/exit0; independent ESLint/braces debt retained, package/lock unchanged. Next dev restored; frontend3000/backend8080/Swagger/API docs200 and additive read filter schema verified. HEAD/index/user prompt preserved;66 protected migration/ADR/package/lock/ENV/Compose/security matcher/RolePolicy hashes unchanged, git diff --check0. Scoped docs/checklist notes updated, global boxes unchanged. Separate completion docs/compliation/2026-10-07-notification-history-read-state.md ready. Own QA projects archived (including exact failed-attempt fixture); no users/volumes deleted, QA metadata may remain. No commit/push/staging/pull/merge. Functional notification scope closed; no global dependency/release waiver. Evidence .local/notification-history/pre-push.log,final-health.json,final-source.json,task8-audit*.json.
