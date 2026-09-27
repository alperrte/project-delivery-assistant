# Klasör yapısı kısa rehberi

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
| `frontend/public/` | Statik frontend varlıkları |
| `docs/` | Proje ve faz belgeleri |
| `docs/compliation/` | Gerçekten tamamlanan faz/servis teslim kayıtları ve kullanıcı kontrol adımları |
| `assets/` | Repo görselleri |
| `pre-push/` | Yerel push öncesi kalite kapısı |
| `docker-compose.yml`, `.env.example` | Yerel servis düzeni ve örnek ortam sözleşmesi; değişiklikte `SECURITY.md` onay kuralı geçerli |

Backend modül iskeletleri `admin`, `auth`, `user`, `project`, `squad`, `task`, `issue`, `testreport`, `comment`, `notification`, `mail`, `activity`, `dashboard`, `search` ve `shared` altında düzenlenir. Modül içinde amaçlanan katmanlar `api` (controller/DTO), `application` (use-case/service/mapper), `domain`, `infrastructure` ve dışa açık `contract` olarak ayrılır. Yalnız mevcut klasör adına bakıp işlevin tamamlandığını varsayma; `.gitkeep` dosyaları yer tutucudur. `shared` sadece alan bağımsız ortak teknik altyapı içindir.

`user/domain/entity` içinde User ve UserSession, `user/infrastructure/repository` içinde repository arayüzleri, `user/UserAccounts.java` ve `user/UserSessions.java` içinde Auth tarafından kullanılan public facade'lar bulunur. `auth/api` register/login/logout/me/refresh HTTP katmanını (`AuthSessionController`) ve aktif oturum yönetimini (`AuthSessionManagementController`); `auth/application` kayıt, JWT ve login akışlarını; `auth/infrastructure/config` cookie, CSRF, CORS, JWT filtresi ve IP hız sınırını içerir. `auth/domain/entity` doğrulama challenge'ı ve `auth/infrastructure/mail` SMTP adapter'ı frontend auth fazına kadar pasiftir. Auth şemaları kök Flyway dizinindeki `V2__auth_user_session.sql`, `V3__email_verification_challenges.sql` ve pending local hesapları aktifleştiren `V4__activate_pending_local_accounts.sql` ile refresh rotation için `V5__user_session_refresh_rotation.sql` ve Google kimlikleri için `V6__user_oauth_identities.sql` dosyalarındadır. Faz 5: `user/domain/entity/UserOAuthIdentity`, `user/OAuthProvider`, `auth/application/service/OAuthLoginService`, `auth/api/AuthOAuthController`, `auth/infrastructure/config/{OAuthProvidersConfiguration,OAuthLoginHandlers,LinkAwareAuthorizationRequestRepository}`. Faz 6: `auth/infrastructure/config/GitHubOAuth2UserService` (GitHub'ın primary+verified email'ini `/user/emails` ile alır); `OAuthProvidersConfiguration` Google ve GitHub kayıtlarını birlikte üretir (eski `GoogleOAuthConfiguration` bu sınıfa dönüştü). Diğer modüllerin yer tutucu durumunu gerçek kod olarak yorumlama.

Yeni özellikte ilgili modülün gerçek kodunu ve testini kendi alanına yerleştir. Yapı değişirse bu haritayı kısa ve güncel tut; tam dosya ağacı dökümü ekleme.

Project Service kodu `project/api`, `project/application`, `project/domain`, `project/infrastructure` ve `project/organization` alt paketlerindedir. Organization ayrı root modül değildir. `project/domain/entity/ProjectMembership` ve `project/infrastructure/repository/ProjectMembershipRepository` Faz 1 create işleminin ilk yönetici üyeliğini tutar. Project SQL şeması `V21__project_organization_initial.sql`, `V22__project_initial_membership.sql` ve `V23__project_membership_lifecycle_roles.sql` migration dosyalarındadır. `project/ProjectAccess.java` diğer modüllere açılan küçük okuma sözleşmesidir; `project/api/ProjectMembershipController.java` üyelik HTTP işlemlerini sunar.
