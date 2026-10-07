# PDA — Squad Service Modernization Planı

Tarih: 2026-10-06. Durum: **Tasks1-10 complete; canonical full gate PASSED.**

Source of truth: `.agents/PDA_Squad_Service_Modernization_Plan_and_Implementation.md` dosyasının çalışma modeli, 1–43 bölümleri ve 29 kritik kuralının tamamı. `frontend/CLAUDE.md` tamamen okundu; `frontend/AGENTS.md` yönlendirmesi, root AGENTS/security/core belgeleri, frontend workflow/design token kuralları ve installed Next `use-client.md` incelendi. Bu dosya sonraki implementation'ın source of truth'udur. Kullanıcı planı onaylamadan production/test/config implementation yapılmaz.

Her task için: **implementation → targeted test → bug fix ve gerekli yeniden test → Definition of Done → ilgili checkbox [x] → sonraki bağımlı task**. İlk plan tesliminde bütün implementation kutuları açıktı; kullanıcı onayı sonrası güncel kanıtlarla kapatıldı. Eski completion ve checklist sayıları yeni özelliğin PASS kanıtı değildir.

## 1. Git ve güncel main temeli

- Branch `squad-service-backend`; HEAD `faa61df95c3ab59e1d421872fa475ffbd43b2098`.
- Kullanıcının yeni main pushlarını incelemek için `git fetch origin main` çalıştırıldı. Fetch sonrası `origin/main` aynı SHA; HEAD↔origin/main ahead/behind **0/0**, source diff boş. Pull/merge/branch değişimi yapılmadı.
- Başlangıçta yalnız kullanıcının Squad prompt'u untracked; index boş. 1778 tracked dosyanın hash'leri, HEAD/index ve prompt hash'i `.local/squad-modernization-plan/baseline.json` içine kaydedildi. Bu özel kayıt Git dışıdır.
- Alper'in `2b81532` değişikliği: SIMPLE görevlerde de pool assignment/claim/release. `e8c0059`: ortak priority göstergeleri, self-assignment ve quick deadlines. `6a88387`, main tip `faa61df`: SIMPLE progress ve aktif project manager notification recipients; **V56 task status notification snapshots**. İlgili gerçek source ve commit diff'leri incelendi.
- En yüksek migration **V56**. Önerilen yeni migration **V57**; implementation preflight sırasında remote/source/migration sırası tekrar kontrol edilir. V25/V31/V32/V36/V38/V56 değiştirilmez.

## 2. Başlangıçtaki gerçek source bulguları

| Alan | Gerçek kaynak ve davranış | Plan etkisi |
| --- | --- | --- |
| Lifecycle | `squad/domain/entity/Squad.java`: `archivedAt`, `updatedBy`; physical delete/reopen yok | Üründe Sil, mevcut alanla güvenli soft-delete; eski ID/history korunur |
| Delete | `SquadService.archive`: manager, active team, children/orphan guard, pending invite cancellation, archive | Sadece label değişmez: kilit/snapshot/event/idempotent etki ve UX birlikte tamamlanır |
| Authority | `ProjectAccess` + `RolePolicy`: SQUAD_MANAGE yalnız aktif PROJECT_MANAGER; team üyeliği rol vermez | Founder olmak ayrı delete şartı değildir; ADMIN bypass yok |
| Membership | V25/V32/V36: `squad_members.project_membership_id`, unique team+membership; project removal sync listener team rows'u temizler | Delete ProjectMembership'i kaldırmaz; archived team membership rows retained, active queries dışlar |
| FK/history | parent same-project composite FK; invitations.team_id ve tasks.pool_team_id squads'a FK | Hard DELETE/cascade/history kaybı uygulanmaz |
| Pool | `TaskPoolService.claim`: archived target artık pool'u kısıtlamaz; target UUID ve task/assignment/history retained | Kullanıcı onayıyla mevcut davranış korunur; SIMPLE/ADVANCED birlikte test edilir |
| Team list | `SquadService.views`, `findNewestMembers`: window query ile newest5, batch count/member/updater lookup | Preview altyapısı yeniden kurulmaz; yalnız eksik safe identity alanları batch eklenir |
| Identity | User entity firstName/lastName nullable; `UserAccounts.AuthenticatedUser`, `ProjectMemberView`, `TeamView.UserRef` nickname/photoVersion taşır | Ad/soyad DB'den alınır; nickname'den gerçek isim uydurulmaz |
| Team UI | `team-card.tsx` mevcut `AvatarStack` ile fotoğraf/+N gösterir; altında isim baş harfi yok | Ekip kartına scoped avatar+initial preview; diğer kartların görünümü korunur |
| Invitations | `InvitationsPage`: gerçek server tabs/page20; PENDING/ACCEPTED/REJECTED/CANCELLED/EXPIRED, status badge, mobile cards/desktop table, retry, principal keys | UI modernization mevcut create/resend/cancel/expiry/account-isolation business logic'ini korur |
| Invite DTO | First/last/email external target için mevcut; registered nickname; invitedBy UUID, takım adı; inviter display/photo yok | Gösterilmeyen veriyi uydurma. Gerekirse mevcut authorized list DTO'ya batch inviter summary ekle |
| Notification DB/API | `Notification`, `NotificationService/Controller/Repository`: persistent own list/count/read/read-all; V56 nullable statusChange | Aynı modül genişletilir; read ile popup presentation ayrılır |
| Delivery | `NotificationEventListener` AFTER_COMMIT; `NotificationWriter` REQUIRES_NEW; Spring Modulith publication registry | Public Squad event, deletion rollback'ta fanout yok; replay dedup zorunlu |
| Frontend notification | `AppHeader.NotificationsMenu` yalnız placeholder empty state; `features/notifications`/API/cache/polling mevcut değil | Bildirim merkezi ve session owner önce gerçek backend'e bağlanmalı; hazır polling varmış gibi davranılmaz |
| UI primitives | ConfirmDialog/Base UI Dialog, Sonner/Toaster, Phosphor, semantic tokens mevcut | Yeni library/socket eklenmez; navbar mevcut viewport-centered konumda kalır |
| Cache | `teamsKey(p)=[projects,p,squads]`; invitation keys principal scoped; TeamsPage listAll server pages100 getirip list12/chart yapar | Gerçek fetched dataset korunur; yeni fake count veya member GET/card eklenmez |

Bu bulgular static source incelemesidir. Bu tur baseline testleri, runtime audit, yeni npm audit veya full gate çalıştırılmadı; servisler başlatılmadı/durdurulmadı. Önceki source-map-js remediation ve açık ESLint/braces dev borcu implementation preflight'ta güncel olarak raporlanır; bu feature için paket değişikliği planlanmaz.

## 3. Ürün ve lifecycle sözleşmesi

### 3.1 Silme

`DELETE /api/v1/projects/{projectId}/teams/{teamId}` mevcut yol/body yok; başarı204. Service `deleteTeam` veya eşdeğer açık isim taşır; legacy `/squads/{id}/archive` ve eski Java çağrıları aynı use-case'e compatibility adapter olarak yönlenebilir. Ürün UI'sinde archive action kalmaz. Legacy route'un kaldırılması/deprecation rollout'u bu scope'ta breaking change yapılmaz.

- DB'de `archived_at` güvenli soft-delete marker olarak reuse edilir; yeni parallel deleted flag zorunlu değildir. Team/name/parent/membership/history rows ve referans UUID'leri tutulur. Reopen/hard-delete/otomatik cascade yok.
- Aktif alt ekip varsa409 `TEAM_HAS_CHILDREN`; önce taşı/sil. Üye başka aktif ekipte kalmayacaksa mevcut409 `TEAM_ARCHIVE_WOULD_ORPHAN` korunur; UI bunu silme diliyle açıklar. Otomatik General Team/üyelik transferi/projeden çıkarma eklenmez.
- Live pending invitations CANCELLED, elapsed physical PENDING EXPIRED olur; accepted/rejected/history korunur. Archived team'e yeni invite/resend/accept geçerli grant oluşturamaz.
- İlk başarılı delete tek event üretir. Önceden silinmiş/unknown/foreign scoped team404; concurrent duplicate'ta bir204, diğer404 kabul edilir. İkinci event/notification yok; idempotent etki204-repeat garantisiyle karıştırılmaz.
- Kullanıcı **mevcut pool davranışını koru** seçimini onayladı. Tasklar/assignment/status/comments/activities silinmez; retained team-target UUID geçmişte kalır, artık archived target pool'u kısıtlamaz. Açık teklif proje üyelerine mevcut permission ile görünür/alınabilir; claimed task release mevcut akışı sürdürür. Bu davranış confirmation/helper metninde saklanmaz; Task yetki modeli değiştirilmez.

### 3.2 Transaction ve race sınırı

Delete önce existing active project permission, sonra tutarlı sırada team write locks, ardından **current active ProjectMembership'e bağlı team recipients + project/team/actor display snapshot** alır. Actor dışlanır. Aynı transaction pending invitations'ı finalize eder, marker'ı yazar ve immutable public `SquadLifecycleEvents.TeamDeleted` yayınlar. Snapshot metadata sonraki rename'den bağımsızdır; entity/repository nesnesi event'e girmez.

Delete, move/child create, add/remove, project-member removal ve invitation create/resend/accept race'leri deterministik test edilir. Existing `lockActiveProjectTeams` UUID sırasından başlanır; invitation→team lock sırası da aynı contract'a uymalıdır. TeamDirectory portuna scoped shared/write validation lock eklenmesi gerekiyorsa public interface + Squad adapter kullanılır. Notification veya Squad başka modülün repository'sini import etmez. Kilit sırası Task/Project'in yeni mevcut lock'larıyla karşılaştırılır; invitation-row→team ve team→invitation ters sırası bırakılmaz. Deadlock/timeouts test edilmeden kilit stratejisi frozen sayılmaz.

Notification fanout mevcut AFTER_COMMIT / REQUIRES_NEW düzenini izler. Publication kaydı deletion transaction'ıyla bağlıdır. Deletion rollback'ta event/notification/popup yok. After-commit writer failure deletion'ı geri almaz: incomplete publication + idempotent retry ve UI reconciliation gerekir; request error'ı rollback olmuş gibi raporlanmaz. Otomatik registry replay mevcut source'ta doğrulanmadığı için varmış gibi garanti verilmez; Task4 mevcut registry'nin recovery yolunu ve gerekiyorsa dar retry mekanizmasını somutlaştırır, yeni broker kurmaz.

### 3.3 Persistent notification ve tek popup

Yeni notification type **SQUAD_DELETED**, resourceType **SQUAD**. Existing IDs/read/unread alanları kalır. Additive nullable `teamDeletion` DTO snapshot: `{projectName,teamName,actorNickname,occurredAt}`; projectId/resourceId/actorUserId existing envelope'dadır. İsimler plain text, server limits'e uygun; deleted team detail GET'i veya render başına name lookup gerekmez.

Önerilen V57 `notifications` extension: `source_event_id UUID NULL`, team deletion display snapshot kolonları, `popup_presented_at TIMESTAMPTZ NULL`; subset consistency CHECK ve non-null event/recipient unique dedup index. V56 task snapshot CHECK korunur; team actor display için separate column kullanılabilir. Legacy rows null kalır; migration eski bildirimleri silmez veya yeniden popup'a dönüştürmez. Dedup `(source_event_id,recipient_user_id)` replay'de aynı event'e ikinci kayıt oluşmasını engeller. Recipients immutable snapshot'tan batch yazılır; kısmi fanout/replay güvenliği test edilir.

Somut kolon önerisi: `team_deleted_project_name VARCHAR(160)`, `team_deleted_team_name VARCHAR(120)`, `team_deleted_actor_nickname VARCHAR(32)`, `team_deleted_at TIMESTAMPTZ`; tümü legacy için nullable. SQUAD_DELETED satırında project/team/occurredAt/sourceEvent zorunlu, actor nickname unavailable olabilir; diğer türlerde bu snapshot ve presentation marker null. Claim için ölçümle `(recipient_user_id, created_at, id) WHERE type='SQUAD_DELETED' AND is_read=FALSE AND popup_presented_at IS NULL` partial index önerilir. REST'e nullable `teamDeletion` ve `popupPresentedAt` eklenir. Notification title sabit bounded event başlığı; uzun isimler message/snapshot sınırlarında tutulur.

Kullanıcı **atomik tek gösterim hakkı + kalıcı notification history** seçimini onayladı:

- Yeni dar own endpoint önerisi: `POST /api/v1/notifications/team-deletions/claim`; body yok, actor principal. Auth+CSRF; own unread SQUAD_DELETED ve presented=null kayıtlar arasından oldest createdAt/id sırasıyla **en fazla1** satır atomik claim edilir, presentedAt DB'de set edilir;200 NotificationResponse veya yoksa204.
- Recipient-scoped lock/SKIP LOCKED veya eşdeğer atomic SQL; kullanıcı/type filtresi SQL'de. Foreign ID/actor body kabul edilmez. Claim read/readAt'i değiştirmez; history ve unread count korunur. Existing read/read-all ayrı kalır.
- Aynı notification iki tab/cihazda claim edilemez. Semantics **at-most-once presentation grant**; server commit sonrası response kaybolursa popup kaçabilir, event history'de kalır. Exactly-once görsel gösterim garantisi veya lease/ACK eklenmez. Mutation automatic retry ile görünmez şekilde sonraki kaydı tüketmez.
- Authenticated foreground AppShell'de initialization, focus/reconnect ve önerilen30s bounded polling. Hidden/logged-out/contained demo claim etmez. Unread count için mevcut GET; history için mevcut server pagination. Aynı tabda bir outstanding claim ve bir aktif ekip-silindi toast; kapanmadan yeni queue item claim edilmez.
- Mevcut Sonner ile nonblocking, okunabilir, close button'lı bilgi toast; otomatik focus çalmaz. Team-deleted kayıtları full metadata/history olarak zil panelinde kalır. Silinmiş takım URL'sine link verilmez; mevcut project erişimi kanıtlıysa yalnız yaşayan proje/ekip listesine güvenli link sunulabilir.
- Notification keys `notifications/actor/{userId}` ailesinde; AbortSignal, lifetime guards ve logout/login/register/account-switch cleanup. Eski principal'ın response/toast/history'si yeni principal'a gösterilmez. Tarayıcı storage'a auth/private notification listesi yazılmaz. Navbar konumu/header reserve/chat history davranışları korunur; chat socket kullanılmaz.

## 4. Member preview / invitations UI sözleşmesi

- Team preview newest5 ve tie-break ordering reuse edilir. Önerilen `TeamMemberPreview={userId,nickname,firstName?,lastName?,profilePhotoVersion}`; yalnız memberPreview genişler, global AuthenticatedUser/email/global-role response'u gereksiz genişletilmez.
- `UserAccounts` public safe batch profile summary method'u, User module implementation/projection'ı eklenebilir. Önce authorized team membership IDs resolve edilir, sonra yalnız scoped user IDs batch lookup. Yeni global directory/media endpoint yok. Missing/disabled profile için güvenli fallback; manager-only member email semantics korunur.
- Existing `profilePhotoSrc` ve Avatar loading/error fallback reuse;5 avatar altında initials, `+N=max(memberCount-shown,0)`. N+1 members GET veya per-user REST identity lookup yok. Shared AvatarStack'in diğer consumers'ını değiştirmek yerine scoped reusable team-member preview tercih edilir.
- Reusable initials: gerçek firstName+lastName meaningful tokens'in ilk ve son grapheme'i, locale-aware uppercase, araya nokta; `Alper Temiz→A.T`, `Nisa Camcı→N.C`, `Mehmet Ali Yılmaz→M.Y`. Tek meaningful token→tek initial; whitespace/Unicode/Türkçe/combining marks test edilir. Gerçek isim yoksa nickname fallback, o da yoksa localized unknown/`?`; nickname'den soyad uydurulmaz. İsim/email tek bölünmüş string varsayılmaz.
- Invitations desktop mevcut semantic table/card yüzeyi, mobile gerçek responsive card; avatar/target, mevcut email privacy, takım, çoklu roles, status, tarih, inviter summary **DTO gerçekten sağlıyorsa**. InvitedBy UUID'yi isim diye sunma. Gerekiyorsa existing manager-authorized list mapper'ında distinct inviter IDs tek batch summary; absent/deactivated nickname localized fallback. Resend/cancel/token/expiry kuralları UI için yeniden yazılmaz.
- Role presentation tek reusable mapping, mevcut `roles` i18n keys + Phosphor icon: PROJECT_MANAGER/Crown, BACKEND_DEVELOPER/BracketsCurly, FRONTEND_DEVELOPER/Code, FULL_STACK_DEVELOPER/Stack, AI_ML_DEVELOPER/Brain, UI_UX_DEVELOPER/Palette, TESTER/Flask, ANALYST/ChartLine. Installed exports/type-check doğrulanır; enum8 için exhaustive mapping. Icon decorative, label metni erişilebilir; renk permission kanıtı değildir.
- PENDING/ACCEPTED/REJECTED/CANCELLED/EXPIRED existing status badge tokens; skeleton/error/retry/empty/server page+filter/URL korunur. Yeni client-only fake count/filter yok. Çoklu role wrap, long email/name/TR-EN-DE,320px ve touch44 kontrol edilir.

## 5. Teknik dependency sırası

```text
Task1 Preflight/contracts/current baseline
 → Task2 Notification additive schema/domain foundation
 → Task3 Team delete lifecycle/locking/snapshot event
 → Task4 Persistent fanout/replay dedup/own presentation claim API
 → Task5 Notification center/session owner/popup
 → Task6 Team delete UX/cache/remote disappearance navigation
 → Task7 Team member batch identity + avatar/initial preview
 → Task8 Invitation modernization + reusable role presentation
 → Task9 Combined real security/data/browser/performance regression
 → Task10 Full gate/docs/separate implementation completion
```

Notification frontend placeholder olduğu için Task5, deletion UX'ten önce gelir. Preview mevcut batch mekanizması üstünde ilerler. Task7/8 bağımsız sunum işleri olabilse de bu source-of-truth doğrulama sırası implementation'da korunur; prerequisites ve DoD atlanmaz.

## Task 1 — Preflight ve contract freeze

### Amaç
Güncel main/source/runtime ile yukarıdaki kararları implementation sözleşmesine dönüştür.
### Neden bu sırada?
Prerequisite yok; sonraki bütün taskların migration/lock/event/UX temelidir.
### Etkilenecek alanlar
- Backend: Squad/Project/Task/User/Notification public contracts, installed Modulith APIs.
- Database: migrations/constraints ve yeni V57 boşluk kontrolü.
- Frontend: AppShell/header/primitives/cache; tokens ve existing invitations source.
- Notification: current AFTER_COMMIT/registry recovery; V56 legacy compatibility.
- Cache: gerçek teams/member/invitation/tasks/session keys envanteri.
- Security: SECURITY/API/auth ADR; yeni own claim exact matcher tasarımı.
- i18n/a11y: mevcut TR/EN/DE/delete/toast/role labels, centred navbar korunması.
- Edge cases: source drift, unrelated user changes, stale runtime, mevcut npm debt.
- Tests: mevcut SquadDomainTest/SquadServiceTest/SquadApiIntegrationTest/NotificationIntegrationTest, task pool/progress ve teams/invitations baseline.
### Checklist
- [x] 1.1 HEAD/index/worktree/source hashes ve fetched main tekrar kontrolü; kullanıcı dosyalarını koru.
- [x] 1.2 Notification snapshot/dedup/presentation DTO+SQL; delete/invite lock order ve recovery contract freeze.
- [x] 1.3 Onaylı popup/pool kararları ve preserved children/last-team policy'yi implementation notuna sabitle.
- [x] 1.4 Güncel backend/image/ports/Docker/JDK/Maven/Node ve hedefli baseline testlerini doğrula; tests/logs/skips kaydet.
### Definition of Done
- [x] Implementasyonu engelleyen zorunlu karar/contract belirsizliği yok; freeze sonrası değişiklik gerekirse kullanıcıya somut fark sunuldu.
- [x] Current baseline/source/runtime kanıtı mevcut; eski completion PASS diye kullanılmadı.

## Task 2 — Additive notification schema ve domain foundation

### Amaç
Delete snapshots, replay dedup ve presentation marker'ını kalıcılaştır.
### Neden bu sırada?
Prerequisite Task1; event consumer ve popup claim gerçek persistence ister.
### Etkilenecek alanlar
- Backend: Notification entity/type, yeni scalar snapshot DTO, factory foundation.
- Database: yeni V57, subset CHECK, event/recipient unique ve claim query ihtiyacına göre partial index.
- Frontend: downstream wire sözleşmesi; UI Task5.
- Notification: SQUAD_DELETED/resource SQUAD; V56 statusChange retained.
- Cache: additive wire defaults; presentation flag read flag değildir.
- Security: recipient ownership kolonları; name/plain-text limits.
- i18n/a11y: localized rendering için structured snapshot; mevcut title/message uyumu.
- Edge cases: legacy rows, event JSON, duplicate recipient, nullable actor, max-length names.
- Tests: proposed TeamDeletionNotificationMigrationTest/FactoryTest + TaskStatusNotificationMigrationTest/FactoryTest.
### Checklist
- [x] 2.1 Boş ve V56 legacy DB upgrade; old rows/readAt/statusChange retained, immutable older migrations.
- [x] 2.2 Snapshot/type mapping/default null; constraint ve dedup conflict tests.
- [x] 2.3 Claimed marker alanı eski/non-team bildirimlere yanlış uygulanmasın; indeksler gerçek SQL'e dayansın.
### Definition of Done
- [x] PostgreSQL migration/entity validate/round-trip ve legacy task snapshot regression geçti.
- [x] Schema/domain contract net; production delete/popup henüz tamamlandı işaretlenmedi.

## Task 3 — Safe team deletion lifecycle ve recipient snapshot

### Amaç
Authorized soft-delete, exact recipients ve tek public event'i transaction içinde uygula.
### Neden bu sırada?
Prerequisite Task2; notification tüketimi doğru committed event'e dayanır.
### Etkilenecek alanlar
- Backend: SquadService/entity/controllers/repositories, SquadLifecycleEvents, gerekirse ProjectTeamDirectory/ProjectAccess public snapshot contract.
- Database: mevcut marker/FK/member/invitation rows; row locks ve event publication transaction.
- Frontend: Task6 için DELETE/errors contract; legacy product labels sonraki aşama.
- Notification: immutable eventId/recipient IDs/projectName/teamName/actor/occurredAt snapshot.
- Cache: team disappearance contract; current pool semantics retained.
- Security: active member/SQUAD_MANAGE; principal actor; no ADMIN/founder bypass.
- i18n/a11y: error codes compatibility, UI'ye silme dili için güvenli detay.
- Edge cases: children/last-team, removed user, duplicate request, invite accept/resend, project archive/removal race, rollback.
- Tests: SquadServiceTest/SquadApiIntegrationTest + deterministic TeamDeletionConcurrencyTest; ProjectInvitationServiceTest/task pool regression.
### Checklist
- [x] 3.1 Delete use-case + legacy adapters; retained rows/history/marker; duplicate404/tek event.
- [x] 3.2 UUID-ordered locks; active member snapshot actor hariç; metadata public-contract lookup.
- [x] 3.3 Pending cancel/elapsed expiry + team inactive validation; invite/child/membership races gerçek barrier ile test.
- [x] 3.4 Authorization/CSRF/IDOR/rollback; siblings/project/tasks/roles unchanged; preserved SIMPLE/ADVANCED pool davranışını doğrula.
### Definition of Done
- [x] Fresh DB/API lifecycle ve recipient snapshot doğru; orphan/child/authorization guard bypass yok.
- [x] Concurrency tests bounded tamamlandı; rollback publication üretmez, committed duplicate event yok.

## Task 4 — Persistent fanout, replay dedup ve own popup claim API

### Amaç
Her recipient'a kalıcı bildirim ve bir kez presentation grant sağla.
### Neden bu sırada?
Prerequisite Task3; UI'nin gerçek endpointleri ve retry/replay garantileri burada oluşur.
### Etkilenecek alanlar
- Backend: NotificationEventListener/Writer/Factory/Service/Repository/Controller, dar security matcher.
- Database: V57 event+recipient dedup, claim atomic SQL; notification fanout batch.
- Frontend: response/error/header contract; UI Task5.
- Notification: existing AFTER_COMMIT + REQUIRES_NEW, publication recovery ve replay.
- Cache: own list/count/read + nullable teamDeletion/presentedAt response.
- Security: POST claim session+CSRF/private no-store; actor yalnız principal; no new public endpoint.
- i18n/a11y: snapshot plain text/localizable; read/unread independent.
- Edge cases: A/B members actor excluded, partial write failure, duplicate replay,204, network lost response, multi-tab/device, read before claim.
- Tests: NotificationIntegrationTest, proposed TeamDeletionNotificationIntegrationTest/PopupClaimApiIntegrationTest + V56 TaskProgressNotificationApiIntegrationTest.
### Checklist
- [x] 4.1 Two-member fanout/all recipients, batch writes/idempotent dedup; actor suppression.
- [x] 4.2 Incomplete publication recovery route somut; writer failure/replay/atomic recipient persistence ve old events tests.
- [x] 4.3 Own atomic oldest claim200/204; presented marker persists, read unchanged; concurrent requests aynı kaydı alamaz.
- [x] 4.4 Foreign/user body/anonymous/CSRF/type bounds ve cache headers; new exact authenticated matcher, deny-all retained.
### Definition of Done
- [x] Delete sonrası notification persistent/reload-visible; rollback hiçbir kayıt üretmez; replay double notification yok.
- [x] At-most-once grant ve its lost-response tradeoff kanıtlı; own read/count/V56 regressions geçti.

## Task 5 — Notification center ve session-scoped popup

### Amaç
Navbar placeholder'ını gerçek existing Notification Service'e bağla; online/login toast göster.
### Neden bu sırada?
Prerequisite Task4; olmayan frontend notification katmanının tamamlanması delete UX acceptance için gereklidir.
### Etkilenecek alanlar
- Backend/Database: Task4 REST+persistence; bu aşama frontend consumer.
- Frontend: proposed `features/notifications/{api,types,query-keys,hooks,notification-owner,components}`; AppHeader bell/AppShell/auth boundary; Sonner.
- Notification: current own center list/count/read/read-all; foreground claim/poll.
- Cache: actor keys, query/mutation abort+generation, cleanup/toast dismissal.
- Security: session-only mount; old account data isolation; contained demo disabled.
- i18n/a11y: TR/EN/DE center/toast labels, polite announcement, close/keyboard/focus; existing navbar position.
- Edge cases: offline-login, refresh, multi-tab, failed claim response, hidden tab,401, newer account, >20 backlog.
- Tests: proposed team-deletion-notifications.spec.ts/notification-cache.spec.ts; existing account/session/landing/header/history tests.
### Checklist
- [x] 5.1 Existing APIs/server pagination ile bell history/unread badge/read actions; loading/error/retry/empty, unknown old types defensive handling.
- [x] 5.2 V56 statusChange consumption korunur; teamDeletion structured TR/EN/DE rendering, deleted team'e dead link yok.
- [x] 5.3 AppShell foreground initialization/focus/reconnect/30s loop,one outstanding claim/one toast; hidden/demo/logout disabled.
- [x] 5.4 Atomik grant toast→dismiss→history persists; refresh/relogin aynı event'i spam etmez; >20 backlog client first-page discovery'ye bağlı kalmaz.
- [x] 5.5 Account switch/late REST/late mutation cleanup; old user's toast/keys/list yeni user'a sızmaz.
### Definition of Done
- [x] Gerçek A/B online ve offline-login popup + persistent center + read/unread + refresh/multi-tab testleri geçti.
- [x] Navbar/header reserve/chat/landing/a11y regressions sağlam; parallel notification sistemi/socket yok.

## Task 6 — Team delete confirmation, cache ve navigation

### Amaç
Ürün action'ını Sil yap; local/remote deletion sonrası stale detail/list/selection bırakma.
### Neden bu sırada?
Prerequisite Task5; confirmation'ın bildirim vaadi gerçek fanout/UI ile çalışır.
### Etkilenecek alanlar
- Backend/Database: Task3 lifecycle/error semantics; fresh DB verification.
- Frontend: ArchiveTeamButton→DeleteTeamButton, team-card/detail/chart/Form preview adapters; existing ConfirmDialog.
- Notification: actor local success toast; recipients existing owner loop; event-driven affected team refresh.
- Cache: teamsKey all/list/detail/members/candidates, project team count mevcutsa, actor invitations, notifications; pool keys current broadening için.
- Security: canManage UI hint; server errors/authorization retained; 403 ve404 ayrı.
- i18n/a11y: delete/child/orphan/pool helper TR/EN/DE; destructive dialog/focus/44px.
- Edge cases: double-submit/same-frame click, server failure after commit reconciliation, detail edited while deleted, deleted last-page dataset, member olmayan project user.
- Tests: proposed team-deletion.spec.ts + teams-page.spec.ts/invitation-remediation/task-planning-assignment/chat/navigation regressions.
### Checklist
- [x] 6.1 Sil icon/labels/dialog; named confirmation, notification+pool effects açık; in-flight synchronous guard/pending/errors.
- [x] 6.2 Local mutation targeted family invalidation; current detail404→localized living Teams route replace; draft cleanup yalnız deleted scope.
- [x] 6.3 Recipient delete notice affected cache update; team detail foreground bounded refresh/refocus ile non-recipient viewer'a da deletion ulaşır;404 loop yok.
- [x] 6.4 Non-recipient manager/project viewer için fresh query/focus davranışı; invitations/roster/list/count/pool stale state ve pagination shrink tests; hard reload fix değil.
### Definition of Done
- [x] Üründe arşivleme action'ı yok; real DELETE204/DB marker/notification chain kanıtlı.
- [x] Local/remote deleted detail ve sıcak cache doğru; children/last-team conflict açık; task/project history retained.

## Task 7 — Batch member identity ve avatar/initial preview

### Amaç
Mevcut newest5 preview'yi gerçek isim/fotoğraf ve avatar altında initials ile tamamla.
### Neden bu sırada?
Prerequisite Task6; list/membership/delete cache sözleşmesi artık stabil.
### Etkilenecek alanlar
- Backend: UserAccounts safe batch identity projection, UserAccountService/repository; SquadService.views/TeamView/TeamController DTO.
- Database: existing users.first_name/last_name ve membership data; preview query/index measured.
- Frontend: Team types/card/preview/form demo; reusable initials + scoped team-member preview; existing Avatar/photo URL.
- Notification: değişen membership sonraki preview/cache'yi tazeler; popup flow korunur.
- Cache: list/detail after add/remove/accept/profile version refresh; no card-specific members GET.
- Security: project/team scope önce; no email/global directory expansion; disabled/removed identity fallback.
- i18n/a11y: full name accessible label/tooltip; Unicode/localized uppercase; fallback text.
- Edge cases: zero/one/>5 members, first+last multiple tokens, empty real names, Turkish/combining characters, photo404/broken image, stale version.
- Tests: SquadServiceTest/SquadApiIntegrationTest/User batch test, query-count regression, proposed team-member-preview.spec.ts/initials test.
### Checklist
- [x] 7.1 Additive memberPreview identity contract + batch lookup; legacy missing names gracefully null; newest5 deterministic order.
- [x] 7.2 30/100 team page query count ve100-team real API request ölçümü; per-card/per-member DB or identity REST yok.
- [x] 7.3 Photo/fallback+initials underneath, actual +N/count; plain text full name; parent chart/form preview/demos compatible.
- [x] 7.4 Fresh DB→API→card before detail; add/remove/invite accept warm-cache update, photo-version errors and Unicode edge tests.
### Definition of Done
- [x] Gerçek named users A.T/N.C/K.K/H.T, multi-token M.Y, empty fallback ve photos/+N verified.
- [x] Privacy/IDOR/performance/mobile/theme tests geçti; existing generic AvatarStack consumers bozulmadı.

## Task 8 — Invitation UI modernization ve role presentation

### Amaç
Gerçek DTO içeriğini düzenli ikonlu roles/status/action layout'uyla sun.
### Neden bu sırada?
Prerequisite Task7; shared identity/role visual ihtiyaçları bilinir, stable invitation business contract korunur.
### Etkilenecek alanlar
- Backend: yalnız gerçekten gerekli batch inviter display summary mevcut authorized list mapper'ında; business use-cases retained.
- Database: existing invitation/team/user rows; yeni fake identity/persistence yok.
- Frontend: InvitationsPage/InviteFields/AddTeamMemberDialog, shared project role presenter, status badge tokens.
- Notification: current center/invitation events regression.
- Cache: existing principal-scoped invitation queries/filter/status/page20, refresh prefixes.
- Security: manager-only controls, target email privacy, foreign/deleted team enforcement; former INV-AUD003 isolation retained.
- i18n/a11y:8 real enum labels+icons TR/EN/DE,semantic table/mobile cards,action keyboard/tooltip/44px.
- Edge cases: many roles,long email,name missing,inactive inviter,expired resend/no team error,page shrink/offline failure.
- Tests: global-invitations-preview/10-global-invitations/invitation-remediation/invitations-errors and proposed team-invitations-modernization.spec.ts.
### Checklist
- [x] 8.1 Exhaustive reusable8-role mapping,installed exports; create role selector ve list role badges coherent,permissions unchanged.
- [x] 8.2 Real target/team/roles/status/date/action; inviter yalnız safe DTO varsa; page batch enrich gerekiyorsa no N+1.
- [x] 8.3 Skeleton/error/retry/empty/server filter/pagination preserved; stale mixed success/error rendered together olmasın.
- [x] 8.4 Real create/accept/reject/resend/cancel/expiry/team selection + unauthorized/account-switch tests;320–1440/light-dark/3-language acceptance.
### Definition of Done
- [x] UI modernization server business modelini değiştirmedi; no DTO fabrication/fake filtering/count.
- [x] Targeted real invitation persistence/cache/permission/a11y tests geçti.

## Task 9 — Birleşik security, runtime, performance ve UX regression

### Amaç
Delete→DB/event→notification→popup→cache ve member/invite chains birlikte doğrulansın.
### Neden bu sırada?
Prerequisite Task8; tüm surfaces birlikte çalışır, full gate öncesi scope bugs çözülür.
### Etkilenecek alanlar
- Backend/Database: all targeted suites + direct prepared QA UUID reads; migration/transaction/concurrency.
- Frontend: real multi-user Chromium/new specs + existing relevant regressions.
- Notification: offline/online/replay/multi-tab/claim/read ve V56 task snapshot birlikte çalışması.
- Cache: owner boundary/late response, warm list/detail/preview/invitation/pool flows.
- Security: manager/normal member/project non-team member/nonmember/removed/disabled/ADMIN, wrong project/team, CSRF/IDOR.
- i18n/a11y: 320/390/768/1024/1440 px, TR/EN/DE, light/dark/reduced-motion; screenshots, manual focus ve contrast.
- Edge cases: delete-add/remove/move/invite/claim races, rollback, deleted-team links, refresh, page boundaries, failed delivery, hidden/logout/background.
- Tests: yeni integration/UI suites + Squad/Notification/TaskProgress/TaskModes/TaskPool/Invitations/chat/header/history/landing.
### Checklist
- [x] 9.1 A/B gerçek team members + actor backup teams; DELETE → fresh DB retained team/membership/invitation state; her recipient için tek notification.
- [x] 9.2 B offline-login popup → close → center history → refresh sonrası tekrar yok; A foreground poll → toast; actor'a bildirim yok; multi-tab/device aynı event için tek grant.
- [x] 9.3 Rollback/no-op/duplicate/replay/after-commit failure recovery + deterministic race evidence; rejected request state unchanged.
- [x] 9.4 Profile photo/initials/overflow, count/bounded batch query + 101 team server pagination ve invitation page boundary; gerçek API, normal başarı akışında route.fulfill yok.
- [x] 9.5 Warm mutation navigation, fallback/error states ve visual/a11y matrix; hard reload çözüm olarak kullanılmadı; yalnız kendi QA ID'leri temizlendi, kullanıcı kayıtları/volume'leri korundu.
### Definition of Done
- [x] All acceptance chains pass with command/exit/count/source/artifact/DB evidence; TEST-ONLY failures distinctly labelled.
- [x] Scope bugs fixed/retested; unresolved blocker varsa Task10 tamamlandı işaretlenmez.

## Task 10 — Full gate, belgeler ve ayrı implementation teslimi

### Amaç
Güncel source üzerinde bütün kalite kapıları ve reviewable implementation completion.
### Neden bu sırada?
Prerequisite Task9; eski plan/audit/test sayıları release evidence değildir.
### Etkilenecek alanlar
- Backend/Database: full Maven suite, Testcontainers migration/concurrency/V56 regressions.
- Frontend: lint/TypeScript/production build/targeted+full Chromium.
- Notification/Cache/Security: full contract &scope review; SECURITY §11 method/auth/errors/Swagger inventory.
- i18n/a11y: scoped web checklist/design notes; global boxes topluca tamamlanmaz.
- Edge cases: stale image/port conflict, expected skip vs Docker unavailable, service restoration, independent dependency debt.
- Tests: canonical `./pre-push/pre-push.cmd`; backend + frontend + Docker build/start/health.
### Checklist
- [x] 10.1 Güncel source üzerinde backend full tests, `npm run lint`, TypeScript, production build, targeted ve full Chromium PASS; skip nedenleri kaydedildi.
- [x] 10.2 Root canonical pre-push exit0; Docker build/start/current health, 3000/8080/Swagger; yalnız doğrulanan proje süreçleri temporary stop/restore, ENV/security limits gevşetilmedi.
- [x] 10.3 api/database/architecture/folder/frontend-design ve etkilenen web checklist scoped notes; task kutuları yalnız kanıt sonrası [x].
- [x] 10.4 `docs/compliation/YYYY-MM-DD-squad-service-modernization.md` gerçek bitiş tarihinde README formatıyla; endpoint/method/body/auth/status/errors/safe examples/Swagger ve prompt final headings.
- [x] 10.5 Final diff/HEAD/index/source/hash; commit/push/staging yok; kullanıcı verileri/volume'ler korundu, QA own IDs cleanup ve bağımsız npm borcu açıkça raporlandı.
### Definition of Done
- [x] Önceki bütün DoD ve kabul senaryoları gerçek kanıtla tamam; full regression + canonical gate PASSED; Testcontainers SKIP, PASS sayılmadı.
- [x] Ayrı implementation completion/manual checks ve changed files hazır; yalnız gerçekten blocker yoksa `Kalan blocker yok.` yazıldı.

## 6. Uygulanan validation rotasi

Task1-9 targeted command/count/exit evidence is in the verification entries below and private logs. Final root canonical gate runs current backend clean verify, frontend lint/type/build/full Chromium and Docker build/start/health together:

```powershell
.\pre-push\pre-push.cmd
```

Final result: PASSED exit0;506 backend0 failure/error/skip,272 Chromium+1 expected skip, lint/type/build/Docker health PASS. Final frontend/backend/Swagger/OpenAPI200 and own claim/teamDeletion schema verified. See `docs/compliation/2026-10-06-squad-service-modernization.md`.

## 7. Prompt kapsamı ve teslim sınırı

| Prompt | Plan karşılığı |
| --- | --- |
|1–4,14 |Source lifecycle/FK/pool policy;Task1/3/6/9 |
|5–8 |Predelete snapshot,actor excluded,public event,after-commit persistence/dedup;Task2–4/9 |
|9–12 |Onaylı atomikpresentation,own claim API,real center+foreground polling;Task4/5/9 |
|13,34 |Actual cache families,remote disappearance/detail redirect,membership previewrefresh;Task5–9 |
|15–20 |Real invitation DTO/status/server pages,reusable icons,states;Task8/9 |
|21–27 |Existing batch5/photo infra,safe identity,initials/performance/privacy;Task7/9 |
|28–33,35–38 |Backend/real browser security/persistence/concurrency/TR-EN-DE/a11y/theme/normal-success no mocks;Task3–9 |
|39–43 +critical rules |Git preservation/ordered checklist+DoD/fullgate/separatecompletion;Task1/10 |

Final implementation başlıkları: Final verdict; Task checklist; Team deletion lifecycle; Notification persistence; Login / active-session popup; Team card member previews; Profile photo / initials behavior; Team invitations modernization; Role icon mapping; Authorization / security; Cache behavior; Changed files; Test results; Remaining issues.

**İlk plan tesliminin tarihsel sınırı:** İlk tur yalnız source/doküman/commit diff incelemesi, izinli fetch ve plan yazımıydı. Sonraki kullanıcı mesajı implementation onayı verdi. Güncel doğrulama ve task durumu aşağıdadır; full gate tamamlanmadan implementation completion oluşturulmaz.

## Implementation verification

### Task1 — 2026-10-06

HEAD faa61df/index/user prompt korunmuş; Docker Desktop kapalıydı, kullanıcı volume'leri silinmeden başlatıldı. JDK25.0.1, Node24.19.0, Docker29.8.1. Güncel backend image build/start/health, frontend lint/TypeScript/build exit0. Hedefli backend **63 passed, failure/error/skip0, exit0**; baseline Chromium **18 passed, exit0**. Existing teams UI fixture'ları backend lifecycle acceptance kanıtı yerine kullanılmaz; yeni feature success flows Task9'da real backend/DB ile doğrulanır. Güncel npm audit5 high dev/exit1, production0/exit0; package/lock değişmedi. Kanıt `.local/squad-modernization/task1-*`.

Lock freeze: mevcut ProjectMembershipService `ProjectRepository.lockActive` kullanır. Aynı mevcut project row lock public ProjectAccess contract üzerinden Squad mutation'larına, ProjectInvitationService mutation'larına project→ordered teams→invitation sırasıyla uygulanacak. Invitation token/own lookup önce read-only scope resolve, sonra project lock, sonra locked invitation revalidation yapacak; issuer/team aktifliği lock altında tekrar kontrol edilecek. Böylece team→invitation ve invitation→team ters kilit bırakılmayacak; Task mevcut shared project lock'uyla koordinasyon korunacak. Yetki matrisi/pool davranışı değişmeyecek. Deterministik concurrency kanıtı Task3'te alınır.

Recovery freeze: installed Modulith2.1.1 `IncompleteEventPublications.resubmitIncompletePublications(Predicate<EventPublication>)` ve EventPublication event/date/retry erişimi javap exit0 ile doğrulandı. Task4 fixed bounded scheduler yalnız incomplete TeamDeleted publications için age/retry guard ile bu existing API'yi kullanacak; diğer Task events resubmission davranışı değişmez, yeni broker/ENV yok. Writer unique event/recipient dedup ve batch transaction ile tekrar işlemeyi güvenli yapacak.

### Task2 — 2026-10-06

V57 additive migration; SQUAD_DELETED/TeamDeletion scalar snapshot ve Notification factory/entity mapping uygulandı. Eski migrations/V56 CHECK aynı. PostgreSQL V56→V57 legacy read/readAt/task snapshot retention, constraints, event-recipient duplicate rejection, recipient-independent records ve presentation/read separation doğrulandı. Ayrı JPA save/read transaction round-trip ve mevcut Notification integration testleri geçti. Final targeted **10 tests, failure/error/skip0, exit0**, `.local/squad-modernization/task2-final-backend.log`. İlk9-test koşumu da geçti; ek JPA kanıtından sonra current source10-test paketi tekrar koşuldu. Henüz deletion fanout/claim/popup consumer tamamlanmadı.

### Task3 — 2026-10-06

Public project context + existing project write lock, ordered team locks, fresh invitation revalidation, immutable TeamDeleted snapshot ve delete/legacy adapter tamamlandı. Retained rows/FKs, pending cancellation/elapsed expiry, children/last-team constraints, actor exclusion ve current pool semantics korundu. Real barriers duplicate delete, delete-before-accept, child create/move, member add/project removal, committed rename, stale external preview ve manager demotion'u kapsar. Demotion probe **expected red1 failure0 errors**: eski JPA role cache yetkiyi sürdürebiliyordu; aynı RolePolicy üzerinde fresh scalar active-role lookup ile düzeltildi, permissions genişlemedi. Eski reinvite test lock-chain beklentisi yeni project-first sıraya uyarlandı. Yeni pool probe package typo'su ve IDE timestamp/incremental class diagnostic sonrası **clean targeted Maven**: **77 tests, failure/error/skip0, exit0**, current-source11 TeamDeletionConcurrency scenarios dahil. `.local/squad-modernization/task3-clean-backend.log`. SIMPLE/ADVANCED team-target tasks delete sonrası retained UUID ile project pool claim/release yaptı; no task/history/assignment cascade. Fanout/presentation consumer Task4'te; feature full completion henüz yok.

### Task4 — 2026-10-06

REQUIRES_NEW single fanout transaction, JDBC chunks500, source-event/recipient ON CONFLICT dedup ve AFTER_COMMIT consumer uygulandı. Existing registry yalnız aged TeamDeleted publications için60s recovery/max50 guard ile kullanılır. Own POST claim oldest pending row'u SKIP LOCKED atomic statement ile tüketir;200/204, no actor body, session/CSRF/private no-store; read unchanged. DynamicUpdate read mutation'ın concurrent native presentation marker'ını eski JPA state'inden resetlemesini engeller. Gerçek after-commit partial-write TEST-ONLY failure→transaction rollback→registry replay→dedup; two-recipient persistence/actor suppression/rollback/duplicate, multi-tab grant, read-before-claim, stale-read race,21-row backlog ve gerçek503-recipient fanout boundary kanıtlı. Final clean targeted **37 tests, failure/error/skip0, exit0**, V56/Task3/modularity dahil; `.local/squad-modernization/task4-final-backend.log`. Frontend center/popup Task5'te; canonical full gate henüz çalışmadı.

### Task5 — 2026-10-06

Own REST bell center/server pagination/read/count, actor cache keys+cancel/remove, session-scoped foreground claim owner ve once-only Sonner popup uygulandı. Navbar viewport-centred konumu/reserve korunur; contained demo canlı data/polling owner kurmaz. TR/EN/DE structured TeamDeleted/V56 snapshots ve eski generic bodies lokalize. Offline login→popup→close→reload→no second grant→center/read, foreground two-context single grant/no focus steal, same-document B logout/C login latency gate ve late-cache cancellation kanıtlı.320/390/768/1440 light/dark/three-language popup bounds/Escape/focus/retry screenshots incelendi. Setup'taki olmayan member-create path gerçek invitation accept'e düzeltildi; visual-reference TEST-ONLY mock notification contract ve mobile/desktop bell geometry düzeltildi; exact account-menu locator'ın nickname içeren accessible name'i regex ile yakalandı. Final current-source lint/type/build exit0; **22 Chromium passed, exit0**, `.local/squad-modernization/task5-verified-*`. Başarılı notification senaryoları gerçek backend+DB; network latency/abort ve existing visual reference açık TEST-ONLY. Screenshot'taki eski English generic body tespit edilip kataloglarla giderildikten sonra paket tekrar koşuldu. Full canonical gate henüz tamamlanmadı.

### Task6 verification

Delete-specific UI/dialog/labels, synchronous double-submit guard, accessible inline errors, current-principal guard, confirmed deletion cache families and bounded foreground detail/list refresh completed. Remote/stale detail404 replaces to living Teams route once; account boundary clears private team caches. Real DELETE and prepared DB retained rows/notification, warm same-document list, other-user detail redirect, actor suppression, child/last-team rejection and non-manager403 passed. Existing hidden edit-mode action moved to manager header; cancel label localized. Header diagnostic showed sequential rectangle samples mixing responsive transitions; same strict geometry assertion now uses one synchronous snapshot. Final current-source lint/type/build0 +25 Chromium passed, exit0; task6-final logs. No navbar reposition or pool policy change. Full gate pending.

### Task7 verification

Real batch identity profiles and scoped five-avatar/initial preview completed. Actual onboarding A.T/N.C/M.Y plus PostgreSQL K.K/H.T fixtures, real photo upload/decode and TEST-ONLY image failure fallback passed. Warm UI removal returned to the list without document reload; six real members show five previews +1. Real 101-team API pages0/1 use no card/member requests. Prepared SQL size30=11 and size100=11, after fixing growing role batch queries with the existing authorized membership fetch. Scoped team grid min-width overflow corrected; TR/EN/DE, light/dark,320/390/768/1024/1440 screenshots inspected. Final lint/type/build exit0;16 Chromium passed; clean backend58 tests0 failure/error/skip exit0. Initial Docker registry DNS, fixture breadcrumb timeout, responsive min-width red and transient Maven clean file lock recorded separately; none counted as PASS. Evidence task7-final-* and task7-final-backend-retry.log. Task8 pending; no full gate claim.

### Task8 verification

Existing manager-authorized invitation page now consumes additive real batch inviter nickname/photo-version and target photo-version; no email/global-directory expansion or business lifecycle redesign. Exhaustive8-role Phosphor presenter reused by selector and badges; existing status/server pages/filter/account keys retained. Error hides stale rows; shrinking pages clamp to a live page. Real form201/eight roles, resend fresh ID/cancel, registered acceptance with exact PostgreSQL roles/team, previous account/expiry/legacy/external429 regressions passed. TR/EN/DE, two themes,320/390/768/1024/1440 screenshots inspected. Checkbox tick overcount fixture fixed; German fixed-height role badge clipping found visually, fixed only in new presenter and retested with bounds assertion. Final clean backend38 tests0 failure/error/skip; lint/type/build0 and14 Chromium passed, exit0. Evidence task8-backend.log/task8-final-*. Full combined/gate remain pending.

### Task9 verification

Combined clean backend132 tests0 failure/error/skip, lint/type/build0 and56 Chromium passed, exit0. Actual DELETE/fresh PostgreSQL retained rows and exact recipients; offline/foreground/multi-context once-only grant, history/read, late account boundary, UI member add/remove warm navigation, named/photo/fallback preview,101 actual server team rows, real8-role invitation/create/resend/cancel/accept and prior expiry/account/429 regressions. Existing SIMPLE/ADVANCED pool and chat/header/native history remained correct. New HTTP security matrix includes ADMIN nonmember, active non-team viewer, removed/disabled accounts, wrong project and missing CSRF; all rejected deletes retain DB rows and create no notification.21-invitation page dataset is explicitly TEST-ONLY prepared own-template fixture due unchanged10-create quota; actual server pages/cancel/clamp/no document reload passed. Screenshot clipping/overflow checks passed. Eight failed-setup own QA leftovers verified against exact QA owner/project IDs and archived through the real API; successful cases archive own project in finally. User rows/volumes retained. Evidence task9-backend.log/task9-ui-* and qa-cleanup-result.json. Canonical full gate pending.

### Task10 verification

Canonical pre-push PASSED exit0: full clean verify506 backend0 failure/error/skip; frontend lint/TypeScript/production build0; full Chromium272 passed+1 expected disabled crash-route skip, retries0; Docker build/start/health. Final Docker backend running/PostgreSQL healthy; Next dev started hidden after gate and frontend3000/backend8080/Swagger/OpenAPI200; claim/teamDeletion schema verified. Final HEADfaa61df/branch/index/prompt preserved,60 protected tracked hashes unchanged (older migrations/package/lock/Compose/RolePolicy). No commit/push/staging. Scoped docs plus separate actual implementation completion created; own QA cleanup verified. Evidence pre-push.log/final-health.json/final-source.json.

Independent current dependency follow-up: full npm6 high/production1 high, both audit exit1; new sharp0.35.4 GHSA-wq5f-xc86-pv6w, reviewed2026-10-06, patched0.35.5. Runtime exploit not reproduced; classification alone is not proof. Source-map-js1.2.2 and existing5 high dev debt retained. No dependency update in this feature scope; separate patch decision required and no global release waiver. Completion: `docs/compliation/2026-10-06-squad-service-modernization.md`.
