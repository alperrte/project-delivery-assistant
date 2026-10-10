# Klasör yapısı kısa rehberi

## Invitations remediation — 2026-10-06

Frontend `features/invitations/query-keys.ts`, `invalidation.ts`, `external-preview-error.ts`; protected scopes, successful legacy membership refresh ve status-aware public preview error ayrımı. Tests `e2e/invitation-remediation.spec.ts`, `invitation-db.ts` (QA prepared UUID read/expiry fixture), `invitations-cache.spec.ts`, `invitations-errors.spec.ts`. Backend existing invitation repository/service ve ProjectAccessService etkin expiry filtrelerini taşır; ProjectInvitationServiceTest fresh SQL ve deterministic two-reinvite barrier kapsar. Private artifacts `.local/invitations-remediation/`.

## 2026-10-06 Chat action menu / workspace history

`components/layout/workspace-history.ts` salt okunur capability adapter, `use-workspace-history.ts` SSR-safe external-store hook, `workspace-history-controls.tsx` header Button/Tooltip pair içerir. Ortak responsive reserve `app/globals.css`; `message-actions.tsx` tek chevron/menu lifecycle handoff, `emoji-picker.tsx` mevcut composer ile controlled anchored reaction kullanımını paylaşır. Gerçek browser regresyonları `e2e/{native-history,workspace-history,workspace-history-context,chat-action-menu}.spec.ts`; menu locator helper `e2e/chat-actions.ts`. QA artifacts `.local/chat-action-nav-implementation/` Git dışındadır.
## Organization profili (2026-10-04)

Backend `project/organization/{api,application,domain,infrastructure}` profil alanlarını ve media controller/service/ledger repository'sini barındırır. `shared/{MediaStorage,FileSystemMediaStorage}` teknik port/adaptördür; V52 migration `db/migration` altındadır. Frontend `features/organizations` contract, query factory, form, card ve ortak profile header'ı içerir. Nötr image picker/mark/cover `components/common`, validation ve picked-image hook `lib/media` altındadır; Project wrapper'ları aynı bileşenleri kendi çevirileriyle kullanır. `.local/` özel host storage ve QA çıktıları için Git dışında tutulur.

## Herkese açık landing page (2026-10-03)

2026-10-04 Product Story UI düzeltmesi: `features/landing/demo/{pda-demo-workspace,landing-pda-demo-provider,demo-data}` gerçek `AppShellView`, `AppHeader`, `ProjectSidebarNav`, `ProjectCreatePage`, `ProjectDetail`, `TeamDetailPage`, `TaskFormBody` ve `TasksPage` bileşenlerini statik verilerle kullanır. Ortak query client yalnız bu gösterimde sorguları kapatır ve mutation fonksiyonlarını reddeder; uygulamanın auth/API client’ları değişmez. `.workspace-preview` globals.css içindeki mevcut Titanium token bloğunu paylaşır; `.app-shell` landing köküne eklenmez. CSS contain ve orantılı viewport ölçeği uygulamanın fixed navbar’ını demo içinde tutar; form kamerası içerik alanının gerçek scrollTop değerini kullanır. Yeni iframe/public demo rotası yoktur. Görsel karşılaştırmalar `e2e/landing-real-ui.spec.ts` içindedir.

`frontend/src/app/page.tsx` oturumsuz ziyaretçiye `features/landing/landing-page.tsx` sayfasını gösterir. `PDA_SESSION` yalnız `/dashboard` hedefini seçer; gerçek oturumu AppShell/API doğrular. Yeni akış Welcome → ProductStory (`product-story.tsx`, `product-demo.tsx`) → OpenSourceScene (`open-source-scene.tsx`, `command-sequence.ts`) → final CTA → `landing-footer.tsx` şeklindedir. HTML demo backend çağrısı yapmaz; görev akışı ortak Task enum ve status stillerini kullanır, TESTING adımını korur. GSAP/ScrollTrigger native scroll üzerinde çalışır; genişlik ≥1024 ve yükseklik ≥800 px olduğunda CSS sticky sahneler etkinleşir. Mobil, kısa ekran, reduced-motion ve JS yokluğunda tüm hikâye normal akışta okunur. Stil `features/landing/landing.module.css`, metinler `i18n/landing/{tr,en,de}.json` içindedir. Global palet değiştirilmez. Eski screenshot assetleri ve ortak SiteFooter landing varyantı kaldırıldı; auth/default footer korunur. `e2e/landing-page.spec.ts` public test paketindedir. Metadata/canonical/sitemap/robots sözleşmesi korunur.

## Özel hata ekranları (2026-10-02)

`frontend/src/features/errors/` ortak 404/403/500/503 içeriğini, tam sayfa çerçevesini ve `PageFailure` API hata eşlemesini tutar. `app/not-found.tsx`, `app/error.tsx`, `(app)/error.tsx` gerçek hata sınırlarıdır; `app/global-error.tsx` kök layout hatasında provider'sız bir belge üretir. `/errors/[code]` güvenli tasarım önizlemesidir (HTTP 200, noindex); `/dev/error-test` kontrollü hata üretir ve yalnız development modunda çalışır. `i18n/errors/{tr,en,de}.json` normal next-intl mesajlarına eklenir ve global fallback tarafından bağımsız okunur. Host/proxy için dış kaynaksız `public/errors/503.html`, `scripts/build-maintenance-page.mjs` ile token ve metinlerden üretilir; host eşlemesi ayrıca yapılmalıdır. Kontroller `e2e/error-pages.spec.ts`, `playwright.public.config.ts` ve `scripts/check-global-error.mjs` içindedir. API istemcisi ve backend yetki kuralları değişmedi; AppShell yalnız 401'de login'e yönlenir, geçici oturum servisi hatasında veri göstermeden hata ekranını sunar.

## Footer ve herkese açık bilgi sayfaları (2026-10-02)

Ortak footer `frontend/src/components/layout/site-footer.tsx` içinde; AuthShell kompakt auth düzenini, `(public)/layout.tsx` sade alt bağlantı düzenini kullanır. AppShell footer içermez; uygulama içinden bilgi sayfalarına ve iletişime `app-header.tsx` hesap menüsündeki Bilgi ve destek grubundan ulaşılır. Oturum istemeyen `/faq`, `/kvkk`, `/privacy`, `/accessibility` rotaları `(public)` altındadır. İçerik render ve metadata `features/public-info/info-page.tsx`, iletişim/GitHub bağlantıları `site-info.ts`, metinler üç dilde `i18n/messages/{tr,en,de}.json` içindedir. KVKK/gizlilik içerikleri yayın öncesi inceleme taslağıdır; veri sorumlusu ve hosting/saklama kararları kesinleşmeden hukuki sonlandırma sayılmaz. Backend gerektirmeyen footer kontrolü `playwright.public.config.ts` ve `e2e/footer-public-pages.spec.ts` kullanır.

## Mesajlaşma yolları (2026-10-03)

Backend `com.pda.chat` ayrı bir Spring Modulith modülüdür: `api/` (`ChatController`, `ChatApiErrorHandler`, `dto/`), `application/service/` (`ChatService`, `ChatSendRateLimiter`, `ChatViews`, gerçek zamanlı iletim portu `ChatDelivery`), `domain/` (`ChatConversation`, `ChatMessage`, `ChatReadState`, `ChatException`) ve `infrastructure/` (`repository/` ile `websocket/`: `ChatWebSocketConfiguration`, `ChatHandshakeInterceptor`, `ChatHandshakeHandler`, `ChatChannelInterceptor`, `StompChatDelivery`). Başka modüllerden yalnız `com.pda.project.ProjectAccess` ve `com.pda.user.UserAccounts` public sözleşmelerini kullanır. Tablolar `V51__project_chat.sql` dosyasındadır; testler `backend/src/test/java/com/pda/chat/` altındadır (`ChatDomainTest`, `ChatApiIntegrationTest`, `ChatWebSocketIntegrationTest`).

Frontend `frontend/src/features/chat/` altındadır: `types.ts`, `api.ts` (REST ve `chatSocketUrl`), `cache.ts` (sorgu anahtarları ve önbellek yardımcıları), `hooks.ts` (TanStack Query), `use-chat-socket.ts` (`@stomp/stompjs`), `limits.ts` (2000 karakter ve doğrulama aynası), `format.ts`, `chat-provider.tsx` (panel durumu, etkin konuşma, giden kutusu, taslaklar; `components/layout/app-shell.tsx` içinde bağlanır) ve `components/` (`chat-nav-item`, `chat-root`, `chat-panel`, `chat-dock`, `conversation-list`, `conversation-view`, `message-list`, `message-composer`, `person-avatar`). Kenar çubuğunun daralma durumu `components/layout/sidebar-collapse.ts` içindedir (uygulama kabuğu ve sohbet paneli aynı değeri okur). E2E `frontend/e2e/17-project-chat.spec.ts`.

## Task genişletmesi yolları (2026-10-02)

`task/api/` altında `TaskController`, `MyTasksController`, `TaskChecklistController` (+claim/release), `TaskCommentController`, `TaskRelationController`, `TaskWatcherController`, `TaskWorklogController`, `TaskAttachmentController`, `LabelController`; `task/application/` altında ilgili `*Service` sınıfları, `TaskDeadlineScheduler/Service`, `AttachmentPolicy`, `TaskSupport`, `TaskViewAssembler`; sprint ayrı alt pakettedir (`task/sprint/{api,application,domain,infrastructure}`). `project/ProjectSummaryView` yeni public sözleşmedir. Migration'lar `V37`–`V46` (`task_*`, `project_labels`, `sprints`). Testler `backend/src/test/java/com/pda/task/` altında `TaskTestBase` etrafındadır.

## Teams ve davet ekranları (2026-09-30)

Birleşik Teams bölümü `frontend/src/features/projects/components/project-detail.tsx` içinde; ekip üyeleri route'u `frontend/src/app/(app)/projects/[slug]/teams/[teamId]/members/page.tsx`, sayfa ve ekip API bileşenleri `frontend/src/features/squads/` altındadır. Kullanıcı davet sayfası `frontend/src/app/(app)/invitations/page.tsx` içindedir (varsayılan "Bekleyen" sekmesi `?status=PENDING` ister, "Tümü" geçmişi gösterir; liste her açılışta taze okunur). Arayüz ayarları `frontend/src/app/(app)/settings/page.tsx` ve `frontend/src/features/settings/` altındadır (dil, görünüm, animasyon; sidebar'daki "Ayarlar"); hesap bilgileri ve şifre ayrı `/account` sayfasındadır (`frontend/src/app/(app)/account/page.tsx`, `frontend/src/features/account/`; navbar'daki hesap menüsünden "Hesap ayarları"); cihaz tercihleri `frontend/src/lib/preferences/motion.ts` içindedir. Organizasyon oluşturma/düzenleme `organizations/new` ve `organizations/[organizationId]/edit` sayfalarındadır (`features/organizations/components/organization-form-page.tsx`). Profil fotoğrafı arayüzü `features/account/components/profile-photo-field.tsx` ve API yardımcıları `features/account/api.ts` içindedir; paylaşılan görsel doğrulaması (tür, boyut sınırı) backend'de `com.pda.shared.ImageSniffer` dosyasındadır (logo, banner, profil fotoğrafı ve görev eki görselleri kullanır). Ortak sayfa genişliği ve ayar bölümü bileşenleri `components/common/page-container.tsx` ve `settings-section.tsx` dosyalarındadır. Proje sidebar tanımı `frontend/src/features/projects/project-sections.ts` ve nested route seçimi `frontend/src/components/layout/project-sidebar-nav.tsx` dosyalarındadır.

## Teams refactor yolu (2026-09-30)

`project/ProjectCreatedEvent`, `ProjectInvitationEvents`, `ProjectMemberView` ve genişleyen `ProjectAccess` modüller arası public sözleşmedir. `project/api/MyProjectInvitationController` alıcının davet listesini/yanıtını; `squad/api/TeamController` yeni `/teams` API'sini sunar. Squad entity/repository/service eski `/squads` ile aynı veriyi kullanır. `V32__project_teams_and_registered_invitations.sql` General Team ve membership backfill yapar.

Bu belge gezinme haritasıdır; gerçek dosya ve klasörler değişmiş olabilir. Görev sırasında ilgili yolu doğrula.

| Yol | İçerik / yerleştirme kuralı |
| --- | --- |
| `AGENTS.md` | Ajanın ilk okuyacağı kök yönerge ve belge rotası |
| `.agents/` | Güvenlik, mimari, klasör, API, auth, veri ve deployment rehberleri |
| `.agents/decisions/` | Kabul edilmiş mimari karar kayıtları; ilgili değişiklikte oku |
| `backend/src/main/java/com/pda/` | Backend modülleri ve kök `BackendApplication` giriş sınıfı |
| `backend/src/main/resources/db/migration/` | Sıralı Flyway SQL migration'ları |
| `backend/src/test/java/com/pda/` | Backend testleri; modül ve use-case'e yakın tut |
| `frontend/src/app/` | Next.js App Router sayfaları, layout ve global stil |
| `frontend/src/styles/shadcn-compat.css` | CLI paketi olmadan kullanılan yedi UI durum varyantı; MIT attribution ve globals.css import'u |
| `frontend/public/` | Statik frontend varlıkları |
| `frontend/src/features/projects/components/project-mark.tsx` | Kart, oluşturma, proje başlığı ve ayarların ortak logo/ilk harf renderer'ı |
| `frontend/src/features/projects/components/project-logo-field.tsx` | Ayarlarda bağımsız logo upload/remove; mevcut projects query invalidation |
| `frontend/src/features/projects/logo-validation.ts` | Oluşturma ve ayarların ortak PNG/JPEG/WebP, boş dosya ve 512 KB ön kontrolü |
| `docs/` | Proje ve faz belgeleri |
| `docs/compliation/` | Gerçekten tamamlanan faz/servis teslim kayıtları ve kullanıcı kontrol adımları |
| `assets/` | Repo görselleri |
| `pre-push/` | Yerel push öncesi kalite kapısı |
| `docker-compose.yml`, `.env.example` | Yerel servis düzeni ve örnek ortam sözleşmesi; değişiklikte `SECURITY.md` onay kuralı geçerli |

Backend modül iskeletleri `admin`, `auth`, `user`, `project`, `squad`, `task`, `issue`, `testreport`, `comment`, `notification`, `mail`, `activity`, `dashboard`, `search` ve `shared` altında düzenlenir. Modül içinde amaçlanan katmanlar `api` (controller/DTO), `application` (use-case/service/mapper), `domain`, `infrastructure` ve dışa açık `contract` olarak ayrılır. Yalnız mevcut klasör adına bakıp işlevin tamamlandığını varsayma; `.gitkeep` dosyaları yer tutucudur. `shared` sadece alan bağımsız ortak teknik altyapı içindir.

Task backend `task/api/TaskController` ve `TaskApiErrorHandler`, `task/application/TaskService`, `task/domain` entity/enum'ları, `task/infrastructure` repository ve atomik key sayacı altında bulunur. Public olaylar `task/TaskEvents.java` içindedir. V28–V30 migration'ları core/assignment/history tablolarını oluşturur. Project public facade'ı Task için context ve batch üyelik bakışı sağlar; üyelik çıkarma olayı Project tarafından yayımlanır.

`user/domain/entity` içinde User ve UserSession, `user/infrastructure/repository` içinde repository arayüzleri, `user/UserAccounts.java` ve `user/UserSessions.java` içinde Auth tarafından kullanılan public facade'lar bulunur. `auth/api` register/login/logout/me/refresh HTTP katmanını (`AuthSessionController`) ve aktif oturum yönetimini (`AuthSessionManagementController`); `auth/application` kayıt, JWT ve login akışlarını; `auth/infrastructure/config` cookie, CSRF, CORS, JWT filtresi ve IP hız sınırını içerir. `auth/domain/entity` doğrulama challenge'ı ve `auth/infrastructure/mail` SMTP adapter'ı frontend auth fazına kadar pasiftir. Auth şemaları kök Flyway dizinindeki `V2__auth_user_session.sql`, `V3__email_verification_challenges.sql` ve pending local hesapları aktifleştiren `V4__activate_pending_local_accounts.sql` ile refresh rotation için `V5__user_session_refresh_rotation.sql` ve Google kimlikleri için `V6__user_oauth_identities.sql` dosyalarındadır. Faz 5: `user/domain/entity/UserOAuthIdentity`, `user/OAuthProvider`, `auth/application/service/OAuthLoginService`, `auth/api/AuthOAuthController`, `auth/infrastructure/config/{OAuthProvidersConfiguration,OAuthLoginHandlers,LinkAwareAuthorizationRequestRepository}`. Faz 7: kanonik rol/permission tipleri `user/{GlobalRole,ProjectRole,ProjectPermission,PlatformPermission,RolePolicy}` (Project modülü bunları kullanır; eski `project/domain/enums/ProjectRole` ve `user/domain/enums/GlobalRole` buraya taşındı) ve `project/ProjectAccess` (`hasPermission`, `permissionsForUserInProject`). Faz 6: `auth/infrastructure/config/GitHubOAuth2UserService` (GitHub'ın primary+verified email'ini `/user/emails` ile alır); `OAuthProvidersConfiguration` Google ve GitHub kayıtlarını birlikte üretir (eski `GoogleOAuthConfiguration` bu sınıfa dönüştü). Faz 8: `user/UserAdministration` (admin bootstrap, kullanıcı listesi/durumu, sayaçlar) ve `project/ProjectOverview` (yalnız özet metadata) facade'ları; `admin/api/{AdminUserController,AdminSystemController,AdminApiErrorHandler}`, `admin/application/service/{AdminAuthorization,SystemStatusService}`, `admin/infrastructure/bootstrap/AdminBootstrapRunner`; `auth/api/AuthPasswordController` (şifre değiştirme); migration `V7__user_must_change_password.sql`. Diğer modüllerin yer tutucu durumunu gerçek kod olarak yorumlama.

Yeni özellikte ilgili modülün gerçek kodunu ve testini kendi alanına yerleştir. Yapı değişirse bu haritayı kısa ve güncel tut; tam dosya ağacı dökümü ekleme.

Notification Service `notification/api`, `application`, `domain`, `infrastructure` altındadır; V31 migration ve `notification/NotificationIntegrationTest` ile doğrulanır. Project ve Squad public üyelik eventleri kök paketlerindeki `ProjectMembershipEvents` ve `SquadMembershipEvents` sınıflarındadır; Task eventleri `TaskEvents` içinde kalır.

Project Service kodu `project/api`, `project/application`, `project/domain`, `project/infrastructure` ve `project/organization` alt paketlerindedir. Organization ayrı root modül değildir. `project/domain/entity/ProjectMembership` ve `project/infrastructure/repository/ProjectMembershipRepository` Faz 1 create işleminin ilk yönetici üyeliğini tutar. Project SQL şeması `V21__project_organization_initial.sql`, `V22__project_initial_membership.sql`, `V23__project_membership_lifecycle_roles.sql` ve davet için `V24__project_invitations.sql` migration dosyalarındadır. `project/ProjectAccess.java` diğer modüllere açılan küçük okuma sözleşmesidir (`hasPermission`, `permissionsForUserInProject` dahil); `project/api/ProjectMembershipController.java` üyelik ve kullanıcı arama (`GET .../members/search`) HTTP işlemlerini, `project/api/ProjectInvitationController.java` davet create/resend/cancel/reject/accept işlemlerini sunar. `project/application/service/ProjectInvitationService.java` davet use-case'lerini, `project/infrastructure/mail/SmtpProjectInvitationMailAdapter.java` best-effort davet mailini (mevcut `MAIL_ENABLED`/`SMTP_*` sözleşmesiyle, yeni ENV yok) taşır. `project/domain/entity/ProjectCriterion.java` (Faz 5, `V26__project_criteria.sql`) proje başarı kriterleri checklist'idir — task değildir, progress hesaplamasına karışmaz; `project/application/service/ProjectCriterionService.java` (`ProjectPermission.CRITERIA_MANAGE`, PM-only) ve `project/api/ProjectCriterionController.java` (`/api/v1/projects/{projectId}/criteria/**`, create/update/delete/complete/uncomplete/reorder) bunu sunar. `Project.changeStatus(...)` PLANNING/ACTIVE/ON_HOLD/COMPLETED arasında geçiş yapar; ARCHIVED yalnız `archive()` ile mümkündür (un-archive V1'de yok). Faz 6: `project/domain/entity/ProjectRepositoryConnection.java` (V27 migration, tek public GitHub repo/project) ve `project/application/service/GitHubRepositoryUrlParser.java` (yalnız `github.com`, SSRF-safe — kullanıcı URL'sini hiç fetch etmez, sadece `java.net.URI` ile parse eder) yer alır. `project/application/service/GitHubRepositoryClient.java` public contract'ı `project/infrastructure/github/GitHubRestRepositoryClient.java` (mevcut Spring `RestClient`, yeni dependency yok, unauthenticated public GitHub REST) ile uygulanır. `ProjectRepositoryConnectionService` (`ProjectPermission.REPOSITORY_MANAGE`, PM-only connect/disconnect; görüntüleme ve son commitler tüm üyelere açık) ve `project/api/ProjectRepositoryController.java` (`/api/v1/projects/{projectId}/repository/**`) bunu sunar. GitHub hatası (`GitHubIntegrationException`) yalnız ilgili endpoint'i etkiler, projenin geri kalanını bozmaz. Faz 7: `project/application/service/ProjectHomeService.java` (`ProjectPermission.PROJECT_VIEW`) header/status/priority/organization/manager listesi/üye sayısı/criteria progress/repository özetini tek istekte birleştirir; `project/api/dto/response/ProjectHomeResponse.java` ile `project/api/ProjectController.java#home` (`GET /api/v1/projects/{projectId}/home`) sunar. Squad count kasıtlı olarak dahil değildir (Squad zaten `ProjectAccess` üzerinden Project'e bağımlı olduğu için tersi yön modüler monolit döngüsü yaratır); task counts ve recent activity Work Service/Activity için henüz sahte veri üretilmeden açık bırakılmıştır.

Squad Service kodu `squad/api`, `squad/application/service`, `squad/domain/entity` ve `squad/infrastructure/repository` alt paketlerindedir; Project'in kendi repository/entity'lerine değil yalnız `project.ProjectAccess` public contract'ına bağımlıdır (ayrı Spring Modulith modülü). `Squad`/`SquadMembership` entity'leri ve `squad_members` join tablosu `V25__squads.sql` migration'ındadır. `SquadService` (`ProjectPermission.SQUAD_MANAGE` ile PM-only mutation; sadece aktif project member squad'a eklenebilir) ve `squad/api/SquadController.java` (`/api/v1/projects/{projectId}/squads/**`) squad lifecycle ve üyelik HTTP işlemlerini sunar. Squad kendi başına authorization rolü vermez.

## Dashboard ve uygulama kabuğu (2026-09-29)

`/dashboard`, `frontend/src/features/dashboard/dashboard.tsx` ile gerçek proje listesi/Project Home verilerini gösterir. `components/layout/app-shell.tsx` bütün oturum içi sayfaların navbar, 240 px sidebar ve mobil çekmecesini; `project-search.tsx` Ctrl+K aramasını sağlar. `components/layout/project-sidebar-nav.tsx`, proje detay bölümlerini bu ortak sidebar içinde bütün sayfalarda gösterir; kullanıcıya özgü son proje slug'ını oturum boyunca korur ve seçim yoksa ilk projeye yönlendirir. Bölüm tanımları ve URL eşlemesi `features/projects/project-sections.ts` içindedir; `features/projects/components/project-detail.tsx` bölüm içeriğini gösterir, ayrı sidebar oluşturmaz. Varsayılan giriş sonrası sayfa dashboard’dur. Görev/bildirim/sprint servisleri bu teslimde uygulanmaz. Oturum içi palet DESIGN.md Titanium referansından gelir; auth tasarımı ayrı kalır.

## Görev yönetimi frontend (2026-10-02)

- `frontend/src/features/tasks/`: `api.ts`, `types.ts`, `schemas.ts`, `hooks.ts`, `workflow.ts`, `deadline.ts`, `filters.ts`, `my-filters.ts`, `mentions.ts`, `permissions.ts`; `components/` (liste, pano, havuz, form, Görevlerim) ve `components/detail/` (görev detayı bölümleri).
- `frontend/src/features/sprints/` ve `frontend/src/features/labels/`: `api.ts`, `hooks.ts`, `schemas.ts`, `types.ts`, `components/`.
- Rotalar: `frontend/src/app/(app)/projects/[slug]/{tasks,sprints,labels}/**` ve `frontend/src/app/(app)/tasks/page.tsx`.
- `frontend/src/components/layout/tasks-nav-link.tsx`: sidebar'daki Görevler bağlantısı ve rozeti.
- `frontend/e2e/09-tasks.spec.ts`: görev yönetimi E2E.

## Yerelleştirilmiş frontend rota sınırı (2026-10-04)

- `frontend/src/i18n/routing.ts`: TR/EN/DE sayfa rota tablosu, `buildPath`/`matchPath`/`switchLocale`.
- `frontend/src/i18n/navigation.tsx`: yerelleştirilmiş Link/router ve mantıksal pathname yardımcıları.
- `frontend/src/proxy.ts`: canonical 308, oturum ipucu kontrolü ve mevcut App Router ağacına rewrite.
- `frontend/e2e/localized-routing.spec.ts`: URL, dil, eski bookmark, 404 ve metadata regresyonu.


## Basit / gelişmiş görev backend'i (2026-10-05)

- Project public `TaskManagementMode` ve genişleyen `ProjectTaskContext`/`ProjectSummaryView`/`ProjectAccess`: modül dışı politika/lock sözleşmesi.
- `project/api/dto/request/TaskManagementModeRequest` ve `ProjectController#taskManagementMode`: yalnız kurucunun ayrı PATCH işlemi; archive conflict sınıflaması `project/domain/exception/ProjectTaskModeConflictException`.
- `task/domain/TaskCreationMode`, `task/api/TaskUpdateRequest`: kalıcı tür ve gönderilmeyen gelişmiş alanları koruyan update payload.
- `V54__task_creation_modes.sql`, `task/TaskModesApiIntegrationTest` ve `TaskModesMigrationTest`: migration, politika/yetki/veri koruma ve eşzamanlılık testleri. Frontend bu teslimde değişmez.

## Basit / gelişmiş görev frontend'i (2026-10-05)

- `frontend/src/features/tasks/task-model.ts`: proje politikasına göre görünürlük ve varsayılan görev türü.
- `features/tasks/components/task-mode-picker.tsx`: ortak tür seçici, bilgi dialogu, tür rozeti ve salt okunur uyarı.
- `features/projects/components/task-model-setting.tsx`: ilk kurucu seçimi ve proje ayarlarındaki aynı tercih kontrolü.
- `features/tasks/schemas.ts`: yalnız görünür türün doğrulanması, gönderilmeyen gelişmiş alanların korunması, değişmeyen atama/havuz/deadline koruması.
- `frontend/e2e/21-task-models.spec.ts`: proje politikası, form/taslak, detay, yorumlar, URL filtresi, dönüşüm/veri koruma, yetki ve responsive/i18n kontrolleri.

## Chat V55 geni?lemesi (2026-10-05)

Backend: application/service `ChatReactionService`, `ChatReactionViewReader`, `ChatReactionRateLimiter`; domain/enums `ChatReactionCode`, domain/entity `ChatMessageReaction`; infrastructure/repository `ChatReactionRepository`; V55 migration, `chat/integration/ChatReplyReactionMigrationTest`. Frontend chat: `reactions.ts`, `reaction-resync.ts`, `pending.ts`, `emoji-catalog.ts`; components `reply-preview`, `message-actions`, `reaction-chips`, `emoji-picker`. Kabul edilen workspace link intent `components/layout/workspace-link.tsx`. E2E `chat-cache.spec.ts`, `chat-replies-reactions.spec.ts`, `chat-responsive.spec.ts`; navigation/renewal mevcut `17-project-chat.spec.ts`.

Organization–Project remediation: `features/projects/query-invalidation.ts` invalidates projects plus affected old/new organization projects page prefixes; `project-settings-form` uses the existing safe Home summary. `organization-detail` owns its separate projects query loading/error/retry and page clamp. Acceptance E2E: `organization-project-association.spec.ts`; QA-only direct PostgreSQL read helper `organization-project-db.ts` uses prepared UUID SQL inside the local PostgreSQL container, without exposing credentials.


## Task form date picker (2026-10-06)

`frontend/src/components/ui/date-picker.tsx` is the shared optional-date calendar dropdown; task form Controllers live in `features/tasks/components/task-form-page.tsx`. The existing deadline.ts owns local time/ISO conversion. Browser coverage is `frontend/e2e/task-date-picker.spec.ts`; no new package or backend path.


Task UI update (2026-10-06): tasks/task-model.ts also exposes allowsPool for configured policies; shared PriorityIndicator in task-badges.tsx renders the token colors and critical alert icon across form/preview/list/board/detail/filter. Pool remains an assignment feature when advanced sidebar entries are hidden. Quick calendar-day deadlines are shared by both form modes.


## Task progress notification backend (2026-10-06)

- backend/src/main/java/com/pda/notification/domain/TaskStatusChange.java: optional immutable notification snapshot.
- backend/src/main/resources/db/migration/V56__task_status_notification_snapshots.sql: additive nullable snapshot columns and CHECK.
- backend/src/test/java/com/pda/task/TaskProgressNotificationApiIntegrationTest.java: short/simple and advanced flows, manager recipients, access/rollback/concurrency and legacy events.
- backend/src/test/java/com/pda/notification/TaskStatusNotificationMigrationTest.java and TaskStatusNotificationFactoryTest.java: V55 upgrade/data retention, constraints and maximum-length snapshots.
- Existing ProjectAccess, TaskService/TaskEvents and Notification listener/writer/factory/controller own the behavior; no frontend file is changed in this backend delivery.

## Squad modernization additions - 2026-10-06

- Backend public contracts: `project/ProjectTeamContext`, `squad/SquadLifecycleEvents`; notification `domain/TeamDeletion`, `application/TeamDeletionNotificationStore`, `TeamDeletionPublicationRecovery`; Flyway V57.
- Frontend `features/notifications/{api,types,query-keys,notification-owner,components/notification-center}`; `squads/{cache,initials,components/delete-team-button,components/team-member-preview}`; shared `projects/role-presentation`.
- Real QA E2E: team-deletion, team-deletion-notifications, notification-cache, team-member-preview, member-initials, team-invitations-modernization and prepared DB helpers. Private logs/screenshot artifacts stay in ignored `.local/squad-modernization/`.

## My tasks cards frontend (2026-10-06)

- features/tasks/components/my-task-card.tsx: square personal card and shared TaskProgressAction.
- features/tasks/components/my-task-dialog.tsx: URL-controlled task detail inside My tasks; task-detail-page exports the existing shared TaskDetailBody.
- features/tasks/components/status-confirmation.tsx: common pending/error-safe status confirmation; status-menu and board-page consume it.
- features/notifications/{api.ts,notifications-menu.tsx}: own notification API and the real navbar menu.
- e2e/my-task-cards.spec.ts: real task/comment/status/manager notification/board/pagination and responsive localization scenarios. Existing 09-tasks assertions follow the new personal cards.

2026-10-06 merge: `features/notifications/notifications-menu.tsx` delegates to `components/notification-center.tsx`; api.ts re-exports the shared types.ts Notification contract. There is one session-scoped polling/cache/popup family.

## Frontend foundation additions - 2026-10-07

Backend UserProfileController/UserProfileService/NicknameTakenException/`com.pda.user.NicknameRules` (module root public API since 2026-10-10; was `domain`), existing User/Repository/error handler and exact own security matcher. Frontend account nickname-field/nickname validation and identity predicates; layout authenticated-route, extended native history and single lifecycle auto-hide controller. Existing AppShell nav/drawer carry data-workspace-scroll scope markers; globals owns scoped scrollbar aliases. New real nickname/authenticated-history/navbar-auto-hide/workspace-scrollbars tests and UserProfileApiIntegrationTest. Private evidence `.local/frontend-foundation/`, never a public auth trace.

Notification read/history extension (2026-10-07): existing Controller/Service/Repository own filter and conditional read; no entity/schema replacement. frontend/features/notifications/hooks/use-notification-read.ts owns shared submit/abort/current-actor guard; API/query-keys/NotificationCenter reuse existing owner. Tests: NotificationReadStateIntegrationTest; notification-history, notification-history-context, notification-history-visual specs and scoped notification-fixture/notification-db helpers.

## Project invitation/create additions - 2026-10-08

Notification domain: `InvitationContext`; Flyway V60 nullable snapshot. Frontend: `features/invitations/hooks.ts` distinct private count hooks/keys and shared `components/pending-invitation-badge.tsx`; `components/layout/teams-sidebar-menu.tsx` expanded disclosure/collapsed nonmodal flyout. Existing create BannerPickField/ImagePicker/image-validation implement opt-in decode without a separate preview subsystem. New real E2E: invitation-pending-contract, invitation-badges, invitation-notification-context, project-banner-lifecycle and repository-read; prepared own-QA DB helpers kept under e2e.

## Cookie consent, analytics, contact and admin dashboard (2026-10-09)

Backend: `com.pda.analytics` (public `AnalyticsReporting`; `api` ingest controller and error handler, `application.service` ingest/classifier/reporting, `domain` sessions and page views, `infrastructure.repository` incl. `AnalyticsReportQueries`), `com.pda.contact` (public `ContactReporting`; `ContactController`, `ContactService`, `ContactMessage` validation, `ContactDuplicateGuard`, `infrastructure.mail.SmtpContactMailAdapter`), `com.pda.admin` `AdminAnalyticsController` + `AdminAnalyticsService`, `com.pda.auth.infrastructure.config.PublicBodyLimitFilter` (body limits). Modules expose only base-package types to each other (`ModularityTest`). Tests: `analytics/`, `contact/`, `admin/integration/AdminAnalyticsIntegrationTest`, GreenMail for mail.

Frontend: `features/consent/` (contract, store, banner, dialog, provider, manage button), `features/analytics/` (identifiers, route template, transport, tracker), `features/contact/` (api, schema, form, page), `features/admin/` (api, query keys, guard, users page, analytics page, charts), routes `(public)/cookies`, `(public)/contact`, `(app)/admin/{users,analytics}`. E2E: `consent-state.ts` (default visitor who already decided), `db.ts`, `mailpit.ts`, `cookie-consent`, `analytics-collection`, `contact-form`, `contact-delivery`, `admin-users`, `admin-analytics`, `privacy-regression` specs. Root: `docker-compose.e2e.yml` (Mailpit + relaxed limits), `PDA_COOKIE_ANALYTICS_ADMIN_CONTACT_PLAN.md` (plan and progress).

## Bildirim geçmişi silme (2026-10-10)

- Backend `notification/{api/NotificationController,application/NotificationService,infrastructure/NotificationRepository}` silme yolları; test `notification/NotificationDeletionIntegrationTest`.
- Frontend `features/notifications/{api.ts,hooks/use-notification-read.ts,components/notification-center.tsx}`; `components/common/confirm-dialog.tsx` `finalFocus`.
- E2E `notification-history-delete.spec.ts`.

## Ekipler / üye daveti / yanıt rozeti (2026-10-10)

- `features/squads/components/team-table.tsx` (tablo görünümü), `teams-page.tsx` (Kart | Tablo | Şema).
- Rota `app/(app)/projects/[slug]/team-invitations/new/page.tsx` → `features/squads/components/invite-member-page.tsx` (`add-team-member-dialog.tsx` kaldırıldı).
- Backend `notification/{api/NotificationController,application/NotificationService,infrastructure/NotificationRepository}`: `projectId` + çoklu `type` filtresi.
- Frontend `features/notifications/hooks/use-invitation-responses.ts`, `features/invitations/components/{invitation-response-badge,invitation-response-strip}.tsx`.
- E2E: `teams-view-toggle`, `invite-member-page`, `team-invitation-response-badge`.

## Proje frontend iyileştirmeleri (2026-10-10)

- Rotalar: `app/(app)/projects/[slug]/criteria/{new,[criterionId]/edit}`, `app/(app)/projects/[slug]/sprints/{new,[sprintId]/edit}`; formlar `features/criteria/components/criterion-form-page.tsx`, `features/sprints/components/sprint-form-page.tsx` (dialoglar kaldırıldı).
- `components/common/cursor-pagination.tsx` (toplamsız sayfalama), `lib/api/client.ts` `apiRequestWithHeaders`, `features/repository/api.ts` `commitsPage`.
- `features/projects/hooks/use-selected-project.ts` `forgetSelectedProject`; `components/common/entity-card.tsx` `cornerStart` yuvası.
- `features/invitations/components/my-invitations-page.tsx` (URL'de filtre/sayfa, xl tablo / altında kart), `invitationsApi.bannerUrl`.
- E2E: `project-priority`, `project-delete-navigation`, `criteria-pages`, `sprint-pages`, `commit-pagination`, `my-invitations-redesign`, `invitation-preview-banner`.

## Commit sayfalama ve davet banner'ı — backend (2026-10-10)

- `project/application/service/GitHubRepositoryClient.java`: `CommitPage` kaydı; `project/infrastructure/github/GitHubRestRepositoryClient.java`: `Link` ayrıştırma (`hasNextPage`); `project/api/ProjectRepositoryController.java`: `X-Has-Next-Page` (`HAS_NEXT_PAGE_HEADER`).
- `project/api/MyProjectInvitationController.java`: `GET /project-invitations/{id}/banner`; `project/application/service/ProjectInvitationService.java`: `previewBannerMine`, preview `bannerVersion`.
- Testler: `project/infrastructure/github/GitHubRestRepositoryClientTest`, `project/integration/ProjectRepositoryApiIntegrationTest`, `ProjectInvitationApiIntegrationTest`.

## Ortak seçiciler ve form kabuğu (2026-10-09)

- `frontend/src/components/ui/time-picker.tsx`: `DatePicker` ile aynı dilde ortak saat seçici; `date-picker.tsx` opsiyonel `min`/`max` alır.
- `frontend/src/components/common/form-error-summary.tsx` (`FormErrorSummary`, `focusFormSection`) ve `sticky-form-actions.tsx` (`StickyFormActions`): tam sayfa formların doğrulama özeti ve yapışkan eylem çubuğu.
- `frontend/src/components/common/entity-card.tsx` artık ortak `EntityCardSkeleton` da içerir; `features/organizations/components/organization-card.tsx` `EntityCard` kabuğunu kullanır.
- `frontend/src/hooks/use-touch-primary-input.ts`: dokunmatik birincil giriş algılayan SSR-güvenli hook (görev yorumu Enter davranışı).
- E2E: `e2e/time-picker.spec.ts`, `create-validation-summary.spec.ts`, `organization-card-dimensions.spec.ts`, `task-comment-keyboard.spec.ts`; `e2e/helpers.ts` `chooseTime()`.
- Çok fazlı plan ve ilerleme: kökte `PDA_UI_WORKFLOW_STATE_NOTIFICATION_REFINEMENTS_PLAN.md`.

## Frontend/main public-page integration ? 2026-10-09

Public routes now include `(public)/about` and `(public)/license` beside cookies/contact. `features/public-info/` retains about-page, apache-license, page-contents and shared info-page/site-info; `lib/seo/` provides JSON-LD/alternates and `app/llms.txt` the discovery text. Contributor CV/team media stays under source-controlled public asset paths. Existing consent/analytics/contact/admin feature directories are preserved. QA global-setup owns shared ignored `.auth` state renewal/cleanup; no production auth provider added. Details: conflict-resolution completion.

## Kullanıcı adı sözleşmesi, oturumsuz sayfa render ipucu ve tema performansı (2026-10-10)

- Backend: `backend/src/main/java/com/pda/user/NicknameRules.java` kullanıcı adı kuralının tek kaynağıdır (`REGEX`, `normalize`, `valid`, `hasConsecutiveSpaces`). `user/domain` içinden modül köküne (User modülünün public API'si) taşındı: Auth DTO'ları (`RegisterRequest`, `InvitationRegisterRequest`) `user.domain` iç paketine bağımlı olmadan kullanabilsin diye (Spring Modulith). `User` entity'si, `UserProfileService`, `UserProfileController` ve `UserAccountService.nicknameBase` (OAuth üretici) aynı sınıfı kullanır. Testler: `src/test/java/com/pda/user/NicknameRulesTest.java`, `src/test/java/com/pda/user/application/service/UserAccountServiceNicknameTest.java`.
- Frontend kullanıcı adı: `features/account/nickname.ts` istemci doğrulayıcısı ve rename önbellek yüklemi (`nicknameIdentityQuery`); `features/auth/schemas.ts`, `features/invitations/components/external-invitation-registration.tsx`, `features/account/components/nickname-field.tsx`, `features/tasks/mentions.ts` buna bağlıdır.
- `frontend/src/lib/rendering.ts`: yazılım render tespiti (`detectSoftwareRendering`, `applyRenderer`) ve root layout'ta inline çalışan `RENDERER_BOOT_SCRIPT`; `frontend/src/components/layout/rendering-probe.tsx`: `AuthShell` içindeki `RenderingProbe` (görünmez, `<html data-renderer="software">` yazar). Stil kuralları `app/globals.css` içindedir (`.auth-neon`, `.auth-shell`, döngü duraklatma, scrollbar, `--cookie-banner-offset`).
- E2E: `e2e/nickname-contract.spec.ts`, `e2e/public-scrollbars.spec.ts`, `e2e/theme-switch-performance.spec.ts`; genişletilenler `cookie-consent.spec.ts`, `workspace-scrollbars.spec.ts`, `nickname-editing.spec.ts`. `playwright.public.config.ts` `public-scrollbars.spec.ts`i `testMatch` listesine ekler.
- Çok fazlı plan ve ilerleme: kökte `PDA_ACCOUNT_PUBLIC_UI_THEME_TEAMS_REFINEMENTS_PLAN.md`; teslim kaydı `docs/compliation/2026-10-10-general-features-account-public-ui-theme.md`.
