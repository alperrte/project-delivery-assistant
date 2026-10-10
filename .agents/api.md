# API rehberi

## Invitations remediation — 2026-10-06

Endpoint/path/auth/request model değişmedi. Manager invitation GET PENDING yalnız expiresAt>now; EXPIRED filtresi physical EXPIRED veya logical elapsed PENDING döndürür; all response etkin status gösterir. POST resend live pending veya expired invitation için fresh ID/token; team active/same-project doğrulanır. DELETE expired invitation204 ile EXPIRED state retained/no grant, live pending→CANCELLED. Başka final state409; expired token accept/reject kapalı. Create expired target row lock+expire/flush sonrası fresh pending INSERT; duplicate current pending409 ve existing DB unique constraint korunur. Client preview404/token-field validation expired;429/network/server separate retry. Legacy membership mutation invalidation reload gerektirmez.

## Organization profili ve görselleri (2026-10-04)

2026-10-05 ek kapsam: POST/PUT ve response'a nullable `notes` eklendi (en fazla 1000, trim, whitespace→null). Description ayrı kalır. PUT tam metadata semantiği notes için de geçerlidir; görsel mutation notes'a dokunmaz. Notes sadece owner'a açık profile/list response'unda, düzenleme formunda ve detail'ın ek notlar bölümünde görünür.


Mevcut organization POST/PUT JSON'una opsiyonel `website`, `contactEmail`, `location` eklenir; boş/whitespace değerler null olur. PUT tam profil güncellemesidir; gönderilmeyen opsiyonel metadata temizlenir, logo/cover korunur. Response opaque `logoVersion`/`coverVersion` içerir; storage yolu ve byte'lar JSON'a girmez. `/api/v1/organizations/{id}/logo` ve `/cover`: GET görsel, PUT multipart `file`, DELETE kaldırma. Active owner kontrolü bütün işlemlerde, CSRF mutation'larda uygulanır; global ADMIN owner olmayan organizasyona erişemez. Görseller private/no-store'dur; `v` cache-buster'ıdır, GET güncel görseli döner. PNG/JPEG/WebP; logo 512 KiB, cover 2 MiB. Method/body/status/error ve Swagger matrisi `SECURITY.md` §11 Organization profil bölümündedir.

## Proje mesajlaşması (2026-10-03)

`/api/v1/projects/{projectId}/chat` altında proje kapsamlı mesajlaşma sunulur: `GET /conversations` (proje grubu — ilk kullanımda oluşur —, çağıranın birebir konuşmaları, son mesaj önizlemesi ve okunmamış sayıları, `totalUnread`), `GET /members` (diğer aktif üyeler; e-posta yoktur), `POST /direct/{userId}` (birebir konuşmayı bul veya oluştur), `GET /conversations/{id}/messages?before&after&limit` (imleç sayfalama; `after` yeniden bağlanma telafisi içindir), `POST /conversations/{id}/messages` (`{content}`, en çok 2000 karakter, kullanıcı başına dakikada 30) ve `POST /conversations/{id}/read`. Gönderen her zaman oturumdaki kullanıcıdır; istekte gönderen alanı yoktur. Hata kodları `CHAT_*` (`CHAT_FORBIDDEN`, `CHAT_NOT_FOUND`, `CHAT_RECIPIENT`, `CHAT_SELF`, `CHAT_MESSAGE_EMPTY|TOO_LONG|INVALID`, `CHAT_RATE_LIMITED`, `CHAT_INVALID_REQUEST`, `CHAT_CONFLICT`). Gerçek zamanlı iletim `GET /api/v1/ws` (STOMP over WebSocket; çerez ile kimlik doğrulanır, yalnız `/user/queue/chat` dinlenir, gönderim REST'tedir) üzerindendir. Yöntem, yetki ve hata matrisi ile WebSocket güvenlik modeli `SECURITY.md` §11 "Project chat"dedir; tablolar `database.md` V51'dedir.

## Task Service genişletmesi (2026-10-02)

Task API'si Linear/Jira düzeyine genişletildi: sunucu tarafı liste filtreleri (`status`, `priority`, `assigneeId`, `unassigned`, `q`, `labelId`, `sprintId`/`backlog`, `pool`, `parentId`/`topLevel`, `overdue`, `blocked`), `dueDate` yerine saatli `deadlineAt`, alt görevler, checklist, yorum + `@[userId]` bahsetme, birleşik aktivite akışı (`filter=ALL|COMMENTS|EVENTS`), etiketler (`/projects/{id}/labels`), tahmin puanı ve süre tahmini, ilişkiler (`BLOCKS|RELATES|DUPLICATES`), izleyiciler, dosya ekleri (multipart `file`), sprintler (`/projects/{id}/sprints`), zaman kayıtları ve görev havuzu (`claim`/`release`). Projeler arası uçlar: `GET /api/v1/tasks/mine` (Görevlerim; `scope=OPEN|DONE|ALL` büyük harfli, kimlik yalnız oturumdan), `GET /api/v1/tasks/counts`, `GET /api/v1/tasks/pool`. Enum sorgu değerleri büyük/küçük harfe duyarlıdır. Hata gövdesi `ProblemDetail` + sabit `code` alanıdır; kod listesi ve yetki matrisi `SECURITY.md` §11'dedir. Deadline hatırlatmaları `TaskDeadlineScheduler` ile gelir (`pda.task.deadline-scan-interval`, varsayılan `PT5M`). Worklog `workDate` en fazla UTC bugün + 1 gün olabilir (UTC'nin ilerisindeki kullanıcı "bugün"ü kaydedebilsin diye).

## Proje takvim anımsatıcıları (2026-10-01)

`/api/v1/projects/{projectId}/reminders` altında tarih aralığıyla liste (`from`, `to`), detay, oluşturma, `PATCH` ile düzenleme ve silme sunulur. Anımsatıcı bir göreve değil takvime aittir; kapsamı oluşturulurken sabitlenir: `PERSONAL` yalnız yaratıcıya, `PROJECT` tüm aktif üyelere görünür ve yalnız `PROJECT_MANAGER` (`REMINDER_MANAGE`) oluşturur/düzenler/siler. Yöntem, body, yetki ve hata matrisi `SECURITY.md` §11'dedir; tablo `database.md` V35'tedir.

## Teams ve alıcı davetleri (2026-09-30)

Uygulanan yeni proje kapsamlı API `/api/v1/projects/{projectId}/teams` altında ekip listeleme (üye önizlemesi, son güncelleyen, son katılan), detay, create (`includeCreator`)/update/parent taşıma/archive, ekip üyeliği ve `GET /{teamId}/candidates?q=` aday aramasıdır. Otomatik General Team yoktur: proje ekipsiz başlar, her üye en az bir ekipte kalır ve davetler `teamId` taşır. Hatalar `ProblemDetail.code` ile döner (`TEAM_*`, `PROJECT_OWNER_PROTECTED`, `LAST_PROJECT_MANAGER`). Kullanıcı tercihleri `GET|PUT /api/v1/users/me/preferences` ile okunur ve kaydedilir (yalnız çağıran kullanıcının; PUT dört alanı birden değiştirir: `locale` `tr|en|de`, `theme` `system|light|dark`, `motion` `system|on|off`, `themeTransition` boolean; hiç kaydedilmediyse GET alanları boş döner; PUT CSRF ister, geçersiz değer 400). Ekip üyeleri listesinde (`GET /projects/{id}/teams/{teamId}/members`) `email` yalnız üye yönetimi yetkisi (`MEMBER_MANAGE`, yani Project Manager) olan istekte dolu gelir; diğer üyeler yalnız takma adı görür. Görev kişi referansları (`assignees`, izleyiciler, yorum `mentions`) ve yorum yazarı (`authorPhotoVersion`) da `profilePhotoVersion` taşır. Kimliği doğrulanmış her yanıt `X-Access-Token-Expires-In` başlığıyla erişim jetonunun kalan geçerlilik süresini (ms) bildirir (CORS ile istemciye açıktır; mesajlaşma soketini jeton bitmeden yenilemek için kullanılır). Mesajlaşma gönderim denemeleri (geçersizler dahil) kullanıcı başına dakikada 30 ile sınırlıdır (`chat.send.*` ile ayarlanabilir, bkz. `.env.example`). Profil fotoğrafı yalnız çağıranın hesabı için `PUT|DELETE|GET /api/v1/users/me/profile-photo` ile yönetilir (multipart `file`, PNG/JPEG/WebP, en çok 5 MB, en çok 6000 px kenar; yazma CSRF ister, istekte kullanıcı kimliği yoktur) ve `GET /api/v1/users/{userId}/profile-photo` ile giriş yapmış herkes tarafından avatar olarak okunur; fotoğrafın kendisi hiçbir DTO'da dönmez, yalnız `GET /auth/me`, proje üyeleri, ekip üyeleri, kart/ekip önizlemeleri ve davet gönderen alanı `profilePhotoVersion` (`?v=` için epoch ms; fotoğraf yoksa yok) taşır (hata kodları `PROFILE_PHOTO_INVALID_TYPE|TOO_LARGE|EMPTY|DIMENSIONS`; logo ve banner da artık `*_DIMENSIONS` döner). Proje banner'ı `PUT|DELETE|GET /api/v1/projects/{projectId}/banner` (multipart `file`, PNG/JPEG/WebP, en çok 2 MB; yükleme/silme `PROJECT_UPDATE` + CSRF, okuma `PROJECT_VIEW`) ile sunulur; `ProjectResponse` `bannerVersion` taşır (banner yalnız Projeler listesi kartında kullanılır, davet önizlemesinde yoktur); proje listesi ayrıca her kart için `canEdit` (`PROJECT_UPDATE` var mı) döner, yalnız arayüzdeki kalem ikonu için ipucudur, ayar uç noktaları yetkiyi kendisi denetler (hata kodları `PROJECT_BANNER_INVALID_TYPE|TOO_LARGE|EMPTY`). `/api/v1/project-invitations/me` yalnız alıcının davetlerini (isteğe bağlı `?status=PENDING` yalnız hâlâ yanıtlanabilen davetleri döner; süresi geçmiş bekleyen davet yanıtta `EXPIRED` görünür, veritabanında yazılmaz; arşivli projenin adı döndürülmez); `/{invitationId}/accept|reject` yalnız o hesabın yanıtını sunar. `GET /api/v1/projects/{projectId}/invitations/all?status=` yöneticinin durum filtreli geçmişini ve ret mesajını döner. Mevcut üyelik/rol endpointleri Project yetkisinde kalır; `/squads` uyumluluk yolu devam eder. Yöntem, body, yetki ve hata matrisi `SECURITY.md` §11'de, uçtan uca örnekler teslim kaydındadır.

> Durum: teknik plan kararı. Endpoint adları, DTO alanları ve feature davranışları ilgili geliştirme planında kesinleştirilir. Bu belge henüz yayımlanmış bir API sözleşmesi değildir.

## Temel sözleşme

- Backend, Spring MVC ile REST API sunar. İlk major sürümün kökü `/api/v1` olur.
- Yeni bir feature, tek başına `/api/v2` gerektirmez. Yeni major yol yalnız geriye uyumsuz değişiklik için açılır. Geçiş döneminde iki sürüm birlikte çalışabilir; mümkün olduğunda aynı application/domain mantığını kullanır.
- Backend, kimlik ve yetki kontrolünün esas sahibidir. Frontend görünürlüğü güvenlik sınırı değildir.
- İstek doğrulaması backend'de Jakarta Validation ile yapılır. Client'a stack trace, SQL hatası veya altyapı sırrı dönülmez.
- Büyük listelerde sayfalama zorunludur. Sayfalama parametreleri, sıralama ve filtre alanları endpoint geliştirilirken belirlenip OpenAPI'ye eklenir.
- Swagger/OpenAPI development ve test ortamlarında `API_DOCS_ENABLED=true` ile açılır. Production'da varsayılan kapalıdır; `API_DOCS_ENABLED=true|false` ile kontrol edilir. Gerçek doküman URL'si uygulama konfigürasyonundan doğrulanmalıdır.

## V1 kaynak alanları

Task backend sözleşmesi (`/api/v1/projects/{projectId}/tasks`, create/list/detail/basic update/replace assignees/status/blocked/history/archive) F5 ile uygulanmıştır. Gerçek roller için `TASK_MANAGE` ve atanmış kullanıcıda `TASK_WORK` kullanılır; endpoint ayrıntıları ve Swagger kontrol yolu `SECURITY.md` §11 Task tablosundadır. Liste `page`, `size` ve izinli `sort` alanlarıyla sayfalanır.

Notification backend sözleşmesi `/api/v1/notifications` altında liste (`page`, `size`, `unreadOnly`, `type`), unread count, tekli read ve read-all işlemlerini sunar. Tüm işlemler authenticated user's own scope içindedir; PATCH için CSRF zorunludur. Ayrıntı ve Swagger kontrolü `SECURITY.md` §11 Notification tablosundadır.

| Alan | Planlanan kapsam |
| --- | --- |
| Authentication | Signup, login, logout, access/refresh akışı |
| User | Temel hesap ve profil yönetimi |
| Project | Oluşturma, düzenleme, görüntüleme ve üyelik yönetimi |
| Squad | Proje içi ekip ve üye yönetimi |
| Task | Oluşturma, düzenleme, durum/tarih takibi ve çoklu atama |
| Issue | Proje veya task problemi takibi |
| TestReport | Tamamlanan iş için tester sonucu |
| Notification | Kalıcı bildirim, okundu/okunmadı ve okunmamış sayı |
| Admin | Temel instance, kullanıcı ve proje yönetimi |

Bu tablo URL, HTTP yöntemi veya yanıt şeması taahhüdü değildir. Her endpoint için uygulama sırasında en az şunları belgeleyin: yol/yöntem, istek/yanıt örneği, doğrulama, kimlik ve proje rolü gereksinimi, olası hata durumları, sayfalama ve geriye uyumluluk etkisi.

## Kimlik ve erişim

Access ve refresh JWT'leri ileriki fazlarda `HttpOnly` cookie ile taşınacaktır. Faz 2'de CSRF için okunabilir `XSRF-TOKEN` cookie'si ve `X-XSRF-TOKEN` header'ı kullanılır. Auth token cookie isimleri henüz belirlenmemiştir; ayrıntılar [authentication.md](authentication.md) içindedir.

27 Eylül 2026 geçiş sözleşmesinde public endpoint'ler `GET /api/v1/auth/csrf`, `POST /api/v1/auth/register`, `POST /api/v1/auth/login` ve `POST /api/v1/auth/logout` olarak uygulanmıştır; POST isteklerinde CSRF zorunludur. `GET /api/v1/auth/me` access cookie ve aktif session gerektirir. Register doğrudan `ACTIVE` hesap üretir, email durumu `PENDING` kalır. Verify/resend yolları kapalıdır ve frontend auth fazına ertelenmiştir. Faz 4 ile public `POST /api/v1/auth/refresh` (CSRF zorunlu) ve access cookie isteyen `GET /api/v1/auth/sessions`, `POST /api/v1/auth/sessions/{sessionId}/revoke`, `POST /api/v1/auth/sessions/revoke-others` eklenmiştir; ayrıntı ve örnekler `SECURITY.md` §11 ve `docs/compliation` Faz 4 kaydındadır. Faz 5 ile Google OAuth yolları (`GET /api/v1/auth/oauth2/authorization/google`, `GET /api/v1/auth/oauth2/callback/google`; yalnız Google yapılandırıldıysa public) ve access cookie isteyen `GET /api/v1/auth/oauth/identities`, `POST /api/v1/auth/oauth/google/link`, `POST /api/v1/auth/oauth/google/unlink` eklenmiştir; ayrıntı `SECURITY.md` §11'dedir. Faz 6 ile aynı yollar GitHub için de eklenmiştir (`GET /api/v1/auth/oauth2/authorization/github`, `GET /api/v1/auth/oauth2/callback/github`; yalnız GitHub yapılandırıldıysa public) ve link/unlink `POST /api/v1/auth/oauth/{provider}/link|unlink` biçimine genelleştirilmiştir. Faz 9 ile public `POST /api/v1/auth/password/forgot` (`{email}`, her zaman `202`, hesap var/yok sızdırmaz) ve `POST /api/v1/auth/password/reset` (`{email, code, newPassword, confirmPassword}`, doğru koddan sonra hesabın tüm oturumlarını iptal eder) eklenmiştir; ikisi de CSRF ve register/login ile aynı IP hız sınırını taşır, ayrıntı `SECURITY.md` §11 Faz 9'dadır. Docker/pre-push smoke kontrolü için yalnız `GET /actuator/health` public'tir (detay göstermez, başka actuator yolu yoktur). Diğer API yolları deny-all kuralında kalır. `API_DOCS_ENABLED=true` iken yalnız Swagger UI ve OpenAPI dokümantasyonunun GET yolları public olur; `false` iken bu yollar da kapalıdır. Varsayılan `false` üretimde güvenli başlangıç sağlar; `.env.example` development için `true` örneği taşır. Swagger UI: `/swagger-ui/index.html`, JSON: `/v3/api-docs`. POST denemeleri için önce `/api/v1/auth/csrf` çağrısıyla `XSRF-TOKEN` cookie'si alınır; Springdoc UI standart `X-XSRF-TOKEN` header'ını ekler.

Global `ADMIN` PDA instance operatörüdür (platform yönetimi; proje üyeliği değildir, projelerde örtük yetkisi yoktur). Proje bazlı roller `PROJECT_MANAGER`, `BACKEND_DEVELOPER`, `FRONTEND_DEVELOPER`, `FULL_STACK_DEVELOPER`, `AI_ML_DEVELOPER`, `UI_UX_DEVELOPER`, `TESTER`, `ANALYST` olup kanonik tanım ve rol→permission matrisi `com.pda.user.RolePolicy`'dedir (`.agents/SECURITY.md` §11 Faz 7). Bir kullanıcının aynı projede birden çok rolü ve farklı projelerde farklı rolleri olabilir.

## Uygulama kontrol listesi

1. Endpoint sözleşmesini OpenAPI anotasyonları/şemalarıyla güncelleyin.
2. Başarılı, doğrulama hatalı, kimliksiz ve yetkisiz davranışları MockMvc/integration testleriyle doğrulayın.
3. Kullanıcıya veya projeye özel veri için erişim kapsamını backend'de test edin.
4. Breaking change ise geçiş ve kaldırma planını sürüm notunda belirtin.

İlgili kararlar: [0001](decisions/0001-modular-monolith.md), [0003](decisions/0003-cookie-auth.md).


## Basit / gelişmiş görev modeli — backend (2026-10-05)

Project GET/list/by-slug `taskManagementMode` taşır: yeni projede null, eski projede BOTH. Ayrı `PATCH /api/v1/projects/{projectId}/task-management-mode` endpoint'i `{mode:SIMPLE|ADVANCED|BOTH}` kabul eder; yalnız aktif kurucu, cookie + CSRF ile değiştirir. Mevcut createdBy alanı UI kurucu ipucudur; canEdit genel proje yetkisidir, bu ayarı değiştirme yetkisi değildir.

Task POST/PATCH ve bütün TaskView'larda kalıcı `creationMode:SIMPLE|ADVANCED` vardır. POST'ta eksik tür legacy ADVANCED varsayar; yeni projede politika seçilmemişse 409. Liste `creationMode` filtresini DB'de sayfalamadan önce uygular. PATCH temel alanlarda mevcut değiştirme semantiğini korur; gönderilmeyen parent/sprint/tahminler korunur, açık null temizler. Atama/etiket/havuz null veya eksikse korunur. Basit görev gelişmiş alan kullanamaz; yükseltme proje politikasına, basite dönüş gelişmiş veri kontrolüne bağlıdır. Yorumlar/mention, durum, arşiv ve geçmiş ortaktır.

Task pool assignment is common to SIMPLE and ADVANCED tasks (2026-10-06, explicitly approved). POST/PATCH accepts pool{open,teamId} for either type; TASK_MANAGE, membership, CSRF, active-team and no-assignee guards remain. Claim/release keeps TASK_WORK, atomic row locking, team membership and sole-claimant checks. Global pool lists/counts include every configured project policy; unconfigured policies remain blocked. Retained tasks can use the pool after a policy change, and conversion preserves pool/team/claim state. Estimates, parent/subtasks, sprint, labels and other advanced mutations remain restricted; existing advanced data stays readable under SIMPLE. Full contract: SECURITY.md section 11.
Projects switched to SIMPLE retain readable advanced records and basic mutations. Advanced mutations and label/sprint management remain restricted; common pool assignment and claim/release stay available under configured policies. Existing data is retained. See SECURITY.md section 11 for the endpoint, permission and error matrix.

## Chat reply/reaction (2026-10-05)

Conversation base alt?nda `PUT|DELETE /messages/{messageId}/reactions/{emojiCode}` idempotent actor-owned reaction, `GET /messages/reactions?messageIds=...` en ?ok 50 loaded ID i?in personalized snapshot sa?lar. Message `replyTo` (null veya id/sender/140-code-point preview), decimal-string `reactionVersion` ve aggregate `reactions` ta??r. Personalized message/snapshot private/no-store. `REACTIONS` WS olay? ayn? snapshot'? al?c?ya ?zg? mine flag'leriyle iletir; unread/son mesaj de?i?mez. Reconnect ve cached reopen ortak concurrency2 ile batch50 resync; yaln?z yeni version uygulan?r. Ba??ms?z reaction kotas? 60 attempt/min/user; yeni ENV yok. Scope/body/status/hata/Swagger matrisi SECURITY ?11'de.

## Organization–Project association remediation (2026-10-05)

Project POST optional organizationId→null; full PUT omitted/null clears, same preserves, changed non-null requires active owned target. Existing owner row lock serializes new association with archive; project membership/permissions stay independent. Org archive retains FK; Home200 organization:null is the non-throwing absent/archived branch. Active Home summary adds safe `canViewOrganization` navigation hint; owner-only profile/media authorization remains backend-enforced. UI none sentinel never goes on the wire; settings explicit null maps to standalone. Full method/body/status/error/Swagger contract is in SECURITY §11 and remediation completion.


## Task progress and manager notifications (2026-10-06, backend)

Existing PATCH /api/v1/projects/{projectId}/tasks/{taskId}/status keeps TASK_MANAGE or assigned TASK_WORK, active-project membership, cookie and CSRF requirements. SIMPLE additionally allows BACKLOG -> IN_PROGRESS and IN_PROGRESS -> DONE; TODO -> IN_PROGRESS and DONE -> IN_PROGRESS remain supported. ADVANCED retains the review/testing workflow. Repeating the current status is a no-op with no extra history, activity or notification.

A successful IN_PROGRESS or DONE transition adds this project's active PROJECT_MANAGER memberships to the existing assignee/watcher recipients, deduplicated and excluding the actor. Other transitions retain follower-only delivery. Events publish in the status transaction and notifications are written AFTER_COMMIT. The public event carries status names as strings and immutable task/nickname display snapshots; consumers do not import Task persistence types or internal enums.

Notification type remains TASK_STATUS_CHANGED. GET /api/v1/notifications and PATCH /api/v1/notifications/{notificationId}/read add nullable statusChange{previousStatus,newStatus,taskKey,taskTitle,actorNickname}; old records/events have null. actorUserId/projectId/resourceId remain unchanged. Snapshot text does not follow subsequent task renames. Existing English title/message also describe started/completed work, and the frontend can localize from statusChange. No new endpoint, role, dependency or environment setting.

## Squad modernization API contracts - 2026-10-06

- Existing `DELETE /api/v1/projects/{p}/teams/{t}`: active PROJECT_MANAGER/SQUAD_MANAGE + CSRF, no body,204. Existing legacy squad archive routes delegate to the same delete use-case. Missing/deleted/wrong-project404; children/orphan409 (`TEAM_HAS_CHILDREN`, `TEAM_ARCHIVE_WOULD_ORPHAN`); unauthorized/CSRF403. Retained rows/FKs, pending invitations CANCELLED or elapsed EXPIRED, no project/task/membership cascade. Existing archived-target pool claim/release semantics retained.
- Own `POST /api/v1/notifications/team-deletions/claim`: cookie session+CSRF, no body/actor/ID;200 one NotificationResponse or204. Nonempty body400; unauthenticated401; CSRF403. Private/no-store. Oldest unread/unpresented SQUAD_DELETED row gets an atomic presentation timestamp; read/unread stays separate. This grants at-most-once presentation, not guaranteed visual delivery after a lost response.
- Existing own notification list/count/read/read-all contracts remain. Additive nullable `teamDeletion={projectName,teamName,actorNickname,occurredAt}` and `popupPresentedAt`; SQUAD_DELETED/resource SQUAD.
- Authorized team `memberPreview` adds nullable real firstName/lastName; bounded newest5 batch data, no email/global directory expansion. Each preview item also carries `roles` (array of `ProjectRole` names in enum order, first = primary; 2026-10-10), taken from the same member batch query (no extra query, no email). Manager invitation list adds nullable invitedByNickname/invitedByPhotoVersion/profilePhotoVersion from one authorized page batch; no token in list responses.
- Swagger: `/swagger-ui/index.html`, `/v3/api-docs`; normal login/CSRF. Safe inputs: create team `{"name":"Example Team","includeCreator":true}`; delete/claim have no body.

## Frontend foundation own nickname API - 2026-10-07

PUT `/api/v1/users/me/profile`, authenticated active principal+CSRF, body `{"nickname":"Yeni_ad"}` only; unknown identity/role/email fields400. Returns200 existing own AuthenticatedUser/private,no-store. Invalid request400 codeNICKNAME_INVALID; exact duplicate409 NICKNAME_TAKEN. Foreign /users/{id}/profile deny-all403; session401/CSRF403 and existing forced-password restriction retained. Existing /auth/me returns fresh name; UUID/email/session/token/provider identity unchanged. Unicode White_Space trim, letters/numbers/underscore3-32 codepoints, existing case-sensitive unique constraint; no NFC/casefold/reserved list/backfill. Swagger existing `/swagger-ui/index.html` and `/v3/api-docs`, normal session/CSRF.
## Kalıcı proje silme (2026-10-07)

- `DELETE /api/v1/projects/{projectId}`: çerez oturumu + CSRF, gövde yok, `204`. Yalnız projenin kurucusu (`createdBy`, hâlâ aktif `PROJECT_MANAGER`) silebilir; eş yönetici, üye, üye olmayan ve CSRF'siz istek `403`, oturumsuz `401`, bilinmeyen veya arşivli proje `404`. Silme geri alınamaz: görevler, ekipler, davetler, sohbetler, sprintler, kriterler, hatırlatıcılar, depo bağlantısı, logo/banner ve projenin bildirimleri gider. Aynı adla yeni proje oluşturulabilir.
- `POST /api/v1/projects/{id}/archive` backend'de durur; arayüz artık kullanmaz.
- `PUT /api/v1/projects/{id}` tam güncellemedir: arayüz `projectGoal` alanını artık düzenlemez ama kayıtlı değeri aynen geri gönderir.
- Swagger: `/swagger-ui/index.html` (`API_DOCS_ENABLED=true`), normal giriş + `GET /api/v1/auth/csrf`; güvenli deneme için önce kendi açtığınız bir deneme projesini silin.

## Notification read/history filter - 2026-10-07

GET /api/v1/notifications adds optional nullable read: false=unread, true=history, omitted retains legacy unreadOnly/all behavior. read=true with unreadOnly=true returns400; existing type/page/size and createdAt DESC,id DESC remain. Same own principal, cookie/CSRF/private no-store contracts and PATCH/read/count routes. read-all response count is changed rows, not remaining unread. Conditional own-unread UPDATE plus fresh readback preserves first committed readAt under stale individual/bulk races; content/snapshots/popupPresentedAt unchanged. No new endpoint/migration/permission.
## GitHub depo yönetimi ve commit bildirimleri (2026-10-07)

- `GET /api/v1/projects/{projectId}/repository/branches` → `{branches:[{name,isDefault,isProtected,headShortSha}],truncated}`; varsayılan dal başta, en çok 100 dal (`truncated`).
- `GET /api/v1/projects/{projectId}/repository/commits?branch=&author=&page=&limit=` → `[{sha,shortSha,message,author,authorLogin,authorAvatarUrl,committedAt,commitUrl}]`. `branch` yoksa varsayılan dal; `limit` 1..50 (varsayılan 10), `page` 1..10; `author` GitHub kullanıcı adıdır. Eski istemci için geriye uyumludur (iki yeni alan eklendi).
- `GET /api/v1/projects/{projectId}/repository/compare?branch=` → `{base,branch,aheadBy,behindBy,unmergedCommits[],truncated}`; `unmergedCommits` dalın ana dala girmemiş commit'leridir (en çok 100, `truncated`). Varsayılan dal için sıfır/boş.
- Hata kodları: `400` geçersiz dal/yazar ya da `REPOSITORY_PRIVATE`; `404` dal/depo bulunamadı; `429` `REPOSITORY_READ_LIMIT` ya da GitHub sınırı (`Retry-After`); `503` GitHub erişilemiyor.
- Bildirim: `type=REPOSITORY_COMMITS_PUSHED`, `resourceType=PROJECT`, `resourceId=projectId`, `repositoryCommits:{projectName,repositoryFullName,branch,commitCount,truncated,headMessage,headAuthor}`.
- Swagger: `/swagger-ui/index.html` (`API_DOCS_ENABLED=true`), normal giriş + `GET /api/v1/auth/csrf`; `GET` uçları CSRF istemez.

## GitHub depo takip modu ve bildirim anahtarı (2026-10-07)

- `POST /api/v1/projects/{projectId}/repository` gövde `{repositoryUrl, trackingMode?, notifyOnCommits?}` → `201`. Varsayılan `trackingMode=BASIC`, `notifyOnCommits=true`.
- `PATCH /api/v1/projects/{projectId}/repository` gövde `{trackingMode, notifyOnCommits}` → `200` güncel bağlantı. `REPOSITORY_MANAGE` + CSRF. `404` bağlı depo yok, `400` geçersiz mod.
- `GET /api/v1/projects/{projectId}/repository` yanıtı `trackingMode` ve `notifyOnCommits` ile genişledi. `GET /api/v1/projects/{projectId}/home` içindeki `repository` nesnesi de `trackingMode` (bağlı değilse `null`) ve `notifyOnCommits` taşır; kenar çubuğu ve genel bakış şeridi bundan okur.
- `BASIC` modda `GET .../repository/branches`, `.../compare` ve ana dal dışı ya da `author` süzgeçli `GET .../repository/commits` → `409` + `code=REPOSITORY_ADVANCED_REQUIRED`. Mevcut bağlantılar V60 ile `ADVANCED` olur.
- Swagger: `/swagger-ui/index.html` (`API_DOCS_ENABLED=true`), normal giriş + `GET /api/v1/auth/csrf`; `POST`/`PATCH`/`DELETE` CSRF ister.

## Project invitation count/context and create preview - 2026-10-08

Existing own GET `/api/v1/project-invitations/me?status=PENDING&page=0&size=1` now excludes archived projects in the shared page/count predicate; omitted status retains history, including archived physical PENDING rows. Manager GET `/api/v1/projects/{id}/invitations/all?status=PENDING&page=0&size=1` remains project/active-manager scoped and uses effective expiry. No new count endpoint. Existing own NotificationResponse adds nullable `invitationContext:{projectName}` for Created/Accepted/Rejected, captured at mutation time; legacy null remains safe. Read/read-all/claim APIs and `popupPresentedAt != readAt` unchanged. Existing project POST201 and multipart banner PUT204/GET200/DELETE204 remain the persistence flow; local preview never uploads by itself. Organization invitations remain MISSING FEATURE / Pending product decision outside this scope.

## Cookie consent, analytics, contact and admin analytics API - 2026-10-09

| Endpoint | Auth | Input | Success | Errors |
| --- | --- | --- | --- | --- |
| `POST /api/v1/analytics/events` | Public + CSRF; 600 / 10 min / address; body <= 2 KB | `{type: PAGE_VIEW or ENGAGEMENT, visitorId, sessionId (UUIDs), path (route template), referrerHost?, utmSource?, utmMedium?, utmCampaign?, engagedSeconds? (0..600, ENGAGEMENT), consentVersion}` | `204` | `400 ANALYTICS_INVALID`, `404 ANALYTICS_SESSION_UNKNOWN`, `403` CSRF, `411`/`413`, `429` |
| `POST /api/v1/contact` | Public + CSRF; 5 / 10 min / address; body <= 16 KB | `{firstName (<=80), lastName (<=80), email (ASCII address <=254), message (10..5000)}`; other properties ignored | `200 {"status":"SENT"}` after the mail server accepted the message | `400 CONTACT_INVALID` (+ `invalidFields`), `409 CONTACT_DUPLICATE`, `503 CONTACT_UNAVAILABLE`, `503 CONTACT_DELIVERY_FAILED`, `413`, `429` |
| `GET /api/v1/admin/users?page&size&search&status` | ADMIN (`USER_MANAGE`) | `search` <= 100 chars (email/nickname substring, case-insensitive); `status` ACTIVE, DISABLED or PENDING_VERIFICATION | `200` page | `400` unknown status / long search, `401`, `403` |
| `POST /api/v1/admin/users/{id}/disable` / `enable` | ADMIN + CSRF | none | `200` | `404 USER_NOT_FOUND`, `409 ADMIN_SELF_DENIED`, `409 ADMIN_LAST_ADMIN` |
| `GET /api/v1/admin/analytics?from&to&zone` | ADMIN (`SYSTEM_VIEW`) | ISO dates (inclusive, default last 30 days, at most 366 days), IANA `zone` (default UTC) | `200 {range, traffic{visits, uniqueSessions, uniqueVisitors, averageEngagedSeconds, daily[], sources[], topReferrers[], topCampaigns[]}, registrations{inRange, daily[]}, accounts{total, active, terminated, pendingVerification, admins}, contactRequests{inRange, total, daily[]}}` | `400` bad zone/range, `401`, `403` |

Swagger check path (`API_DOCS_ENABLED=true`): `GET /api/v1/auth/csrf`, then call the two public POSTs with the returned token header; log in as an administrator for the admin calls. Local mail can be read in Mailpit (`http://localhost:8025`) when the stack is started with `docker-compose.e2e.yml`.

## Administrator sign-in and the administrator-verified session - 2026-10-10

Full rules and the ticket model: `.agents/SECURITY.md`, last section. Swagger check path (`API_DOCS_ENABLED=true`): `GET /api/v1/auth/csrf`, then the calls below with the returned `X-XSRF-TOKEN` header; the ticket cookies are kept by the browser or Swagger UI between calls (an authenticator code is needed for the last step).

| Endpoint | Auth | Input | Success | Errors |
| --- | --- | --- | --- | --- |
| `POST /api/v1/auth/admin/login` | Public + CSRF; 5 / 10 min / address | `{email, password}` | `200 {"status":"TWO_FACTOR_REQUIRED"}` + cookie `PDA_ADMIN_MFA` (path `/api/v1/auth/admin/login/2fa`, 5 min) or `200 {"status":"TWO_FACTOR_ENROLLMENT_REQUIRED"}` + cookie `PDA_ADMIN_ENROLL` (path `/api/v1/auth/admin/2fa`, 10 min); no session | `401` identical for unknown / wrong password / not an ADMIN / disabled, `503 two_factor_unavailable`, `429` |
| `POST /api/v1/auth/admin/2fa/setup` | Public + CSRF + `PDA_ADMIN_ENROLL`; 5 / 10 min | none | `200 {secret, otpauthUri}`, `no-store` (the only response that ever carries the secret) | `401 two_factor_session_expired`, `503`, `429` |
| `POST /api/v1/auth/admin/2fa/enable` | Public + CSRF + `PDA_ADMIN_ENROLL`; 5 / 10 min | `{code}` (6 digits) | `200 {"status":"SIGNED_IN","recoveryCodes":[10]}` + `PDA_ACCESS`/`PDA_REFRESH` cookies; two-factor on; ticket used up | `400 two_factor_code_invalid` (two-factor stays off), `401 two_factor_session_expired`, `429 two_factor_locked` / rate limit |
| `POST /api/v1/auth/admin/login/2fa` | Public + CSRF + `PDA_ADMIN_MFA`; 5 / 10 min | `{code}` (6 digits or a backup code) | `200 {"status":"SIGNED_IN"}` + `PDA_ACCESS`/`PDA_REFRESH` cookies; ticket used up | `400 two_factor_code_invalid`, `401 two_factor_session_expired`, `429 two_factor_locked` / rate limit, `503` |

Changed behaviour of existing routes:

- `POST /api/v1/auth/login` and the Google/GitHub sign-in answer an `ADMIN` account like a wrong password (`401`, redirect `/login?oauth_error=provider_error`); `POST /api/v1/auth/login/2fa` also refuses an administrator.
- `GET /api/v1/auth/me` additionally returns `adminVerified` (`true` only for an `ADMIN` session opened by the administrator sign-in).
- `/api/v1/admin/**` needs `ROLE_ADMIN` and an administrator-verified session: anonymous `401`, `USER` `403`, `ADMIN` with an older session `403` `{"code":"admin_reauthentication_required"}`.
- `POST /api/v1/auth/2fa/disable` is `403` `{"code":"admin_two_factor_required"}` for an `ADMIN` account; a missing or changed `TOTP_ENCRYPTION_KEY` is `503` `{"code":"two_factor_unavailable"}` on every second-step route (never `500`).
- `POST /api/v1/auth/logout` also clears `PDA_MFA`, `PDA_ADMIN_MFA` and `PDA_ADMIN_ENROLL`.
