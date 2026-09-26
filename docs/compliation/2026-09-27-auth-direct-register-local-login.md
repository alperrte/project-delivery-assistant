# Auth — doğrudan register ve local login/logout

> **Güncel sözleşme:** [200 OK ve 8 karakter şifre kararı](2026-09-27-auth-200-and-password-8.md) bu kayıttaki eski başarı kodları ve 12 karakter alt sınırının yerini alır.

> **Sonraki değişiklik:** Bu teslim anında Swagger yolları deny-all kapsamındaydı. [Swagger bayrağı düzeltmesi](2026-09-27-swagger-api-docs-flag.md) açıkken UI/OpenAPI JSON erişimini açar; kapalıyken reddeder.

**Durum:** Tamamlandı, 27 Eylül 2026. Alper'in sonraki kararıyla `ALP-AUTH-04` doğrudan kayıt olarak güncellendi ve Faz 3 `ALP-AUTH-08`–`11` backend kapsamı uygulandı. E-posta doğrulaması frontend auth fazına ertelendi; Faz 4'e geçilmedi.

## Ön kontrol ve karar

- **Dependency:** Faz 1 User/UserSession şeması (`V2`), BCrypt ve mevcut JWT kütüphanesi hazırdı. Faz 2'nin `V3` email challenge migration'ı korunur; verify/resend backend hazırlığı public değildir.
- **Gerçek dosya alanı:** Yalnız `auth/**`, `user/**`, ilgili testler, Alper migration aralığındaki `V4` ve ilgili plan/durum belgeleri. Hamza'nın `project/**`/`squad/**` alanı ve `shared/**` değiştirilmedi.
- **ENV/config:** Yeni ENV/secret veya dependency eklenmedi. Mevcut `JWT_SECRET`, JWT süreleri, `FRONTEND_URL` ve `APP_ENV` kullanılır. `.env` okunmadı/değiştirilmedi. Kullanıcı onayıyla cookie politikası local HTTP'de host-only `SameSite=Lax`, `HttpOnly`, `Secure=false`; HTTPS/production'da `Secure=true` olarak belirlendi.
- **API/security:** Register artık mail veya ikinci doğrulama istemez. Hesap `ACTIVE`, email durumu `PENDING` olur; login bu geçişte e-posta durumunu engel saymaz. `DISABLED` hesap reddedilir. Login 15 dakikalık access ve 7 günlük refresh JWT'yi yalnız HttpOnly cookie ile verir. Logout refresh session'ı iptal eder; iptal sonrası eski access cookie de aktif session kontrolünden geçemez. CSRF ve açık CORS izni korunur; register/login ayrı ayrı IP başına 10 dakikada 5 istekle sınırlıdır.
- **Kabul:** Mail olmadan register → login → korumalı `/me` → logout → erişim reddi; eski pending local hesapların aktifleşmesi; token/hash/secret sızıntısı olmaması.

## Yapılanlar

- [User](../../backend/src/main/java/com/pda/user/domain/entity/User.java) ve [UserAccountService](../../backend/src/main/java/com/pda/user/application/service/UserAccountService.java): yeni local kayıt `ACTIVE/PENDING` üretir; login BCrypt ile email/şifreyi ve aktif hesap durumunu doğrular. Auth, User entity/repository'sine doğrudan bağlanmaz; [UserAccounts](../../backend/src/main/java/com/pda/user/UserAccounts.java) facade'ını kullanır.
- [AuthRegistrationController](../../backend/src/main/java/com/pda/auth/api/AuthRegistrationController.java) ve [RegistrationWorkflow](../../backend/src/main/java/com/pda/auth/application/service/RegistrationWorkflow.java): register mail göndermeden 202 döner. Verify/resend controller yolları kaldırıldı ve security allowlist dışında bırakıldı. Challenge, HMAC ve SMTP kodu ileride etkinleştirmek üzere pasif tutuldu; `V3` silinmedi.
- [LocalLoginService](../../backend/src/main/java/com/pda/auth/application/service/LocalLoginService.java), [JwtTokens](../../backend/src/main/java/com/pda/auth/application/service/JwtTokens.java) ve [AuthSessionController](../../backend/src/main/java/com/pda/auth/api/AuthSessionController.java): login, JWT doğrulama, `/me`, logout. JWT secret yok, kısa veya örnek placeholder ise backend fail-fast davranır.
- [UserSessions](../../backend/src/main/java/com/pda/user/UserSessions.java) ve [UserSessionService](../../backend/src/main/java/com/pda/user/application/service/UserSessionService.java): refresh JWT'nin yalnız SHA-256 hash'i veritabanına yazılır, aktif session sorgulanır, logout revoke eder. Access JWT session ID'ye bağlıdır.
- [AuthCookies](../../backend/src/main/java/com/pda/auth/infrastructure/config/AuthCookies.java), [JwtCookieAuthenticationFilter](../../backend/src/main/java/com/pda/auth/infrastructure/config/JwtCookieAuthenticationFilter.java), [SecurityBaselineConfiguration](../../backend/src/main/java/com/pda/auth/infrastructure/config/SecurityBaselineConfiguration.java) ve [AuthRateLimitFilter](../../backend/src/main/java/com/pda/auth/infrastructure/config/AuthRateLimitFilter.java): cookie kapsamı, backend authentication, CSRF, CORS, public allowlist, deny-all, güvenli 401/403 ve hız sınırı.
- [V4__activate_pending_local_accounts.sql](../../backend/src/main/resources/db/migration/V4__activate_pending_local_accounts.sql): önceki sürümdeki local `PENDING_VERIFICATION/PENDING` hesapları `ACTIVE/PENDING` yapar. `email_verified_at` değişmez. Migration numarası Alper'e ayrılan V1–V20 aralığındadır.
- [alper.md](../../.agents/faz-md/alper.md), `.agents/authentication.md`, `.agents/api.md`, `.agents/architecture.md` ve `.agents/folder-structure.md` geçiş kararına göre güncellendi. [Önceki Faz 2 kaydı](2026-09-27-auth-faz-2.md) tarihsel davranış olarak işaretlendi.

## Endpoint sözleşmesi

`GET /api/v1/auth/csrf` ile gelen okunabilir `XSRF-TOKEN` cookie değeri tüm POST isteklerinde `X-XSRF-TOKEN` header'ında gönderilir. CORS yalnız `FRONTEND_URL` origin'ine açıktır. Public endpoint'lerde proje rolü aranmaz; `/me` geçerli access cookie ve aktif session ister, global USER veya ADMIN olabilir.

| Yöntem / endpoint | Kimlik ve istek | Başarı | Önemli hatalar |
| --- | --- | --- | --- |
| `GET /api/v1/auth/csrf` | Public; body yok | `200`, `XSRF-TOKEN` cookie ve header adı | — |
| `POST /api/v1/auth/register` | Public + CSRF; `email`, `nickname`, `password`, `confirmPassword`. Güvenli örnek: `member@example.test`, `member_1`; şifre ve teyit 12–128 karakter ve eşleşmeli | `202`; hesap hemen `ACTIVE/PENDING` | `400` alan/eşleşme hatası, `403` CSRF, `409` çakışma, `429` hız sınırı |
| `POST /api/v1/auth/login` | Public + CSRF; `email`, `password`. Güvenli örnek email: `member@example.test`; şifre değeri belgede gösterilmez | `204`; `PDA_ACCESS` ve `PDA_REFRESH` HttpOnly cookie | `400` alan hatası, `401` yanlış kimlik/disabled, `403` CSRF, `429` hız sınırı |
| `GET /api/v1/auth/me` | Access cookie ve aktif session; body yok | `200`; `id`, `email`, `nickname`, `globalRole` | `401` eksik/geçersiz token veya revoked session |
| `POST /api/v1/auth/logout` | Public, idempotent + CSRF; refresh cookie varsa kullanılır | `204`; refresh session revoke ve iki cookie temizliği | `403` CSRF |

`POST /api/v1/auth/verify-email` ve `/resend-verification` kapalıdır (`403`). Diğer yollar deny-all kalır. Swagger anotasyonları vardır; onaylı deny-all kuralı `/swagger-ui/index.html` ve `/v3/api-docs` yollarını da kapattığından UI üzerinden canlı kontrol şimdilik yapılamaz. JWT/cookie/şifre değerleri API body, ProblemDetail ve loglara konmaz.

## Doğrulama

- Docker PostgreSQL ile `backend` dizininde `mvn -Djava.version=24 clean test`: **28 test, 0 failure, 0 error, 0 skipped; BUILD SUCCESS**. Repo Java 25 hedefliyor; bu makinede JDK 24 olduğu için yalnız test çalıştırmada override kullanıldı.
- Testler: mail konfigürasyonu olmadan `MAIL_ENABLED=true` bağlamında register/login/logout, `ACTIVE/PENDING` durumu, BCrypt, yanlış şifre ve disabled hesap reddi, access/refresh amaç ayrımı, JWT placeholder fail-fast, refresh hash persistence, bozulmuş JWT reddi, logout sonrası eski access reddi, production `Secure/HttpOnly/SameSite=Lax` cookie, CSRF/CORS/deny-all/401/403, iki endpointte IP limiti, Spring Modulith sınırları ve V3→V4 eski hesap geçişi.
- `git diff --check` hatasızdı. Git push, merge veya release yapılmadı.

## Açık konular ve sonraki handoff

- Refresh cookie üretilir fakat `/refresh` ve rotation henüz yoktur; access süresi dolunca yeniden login gerekir. Refresh rotation, replay politikası ve aktif session liste/revoke API'si **Faz 4** işidir. Bu faz kendiliğinden başlatılmadı.
- E-posta doğrulamasının yeniden açılması frontend auth fazına ertelendi. O aşamada yeni kayıtlara doğrulama zorunluluğu ve mevcut `ACTIVE/PENDING` hesapların geçiş kuralı ayrıca kararlaştırılmalıdır. `V3` migration ve pasif backend hazırlığı bu yüzden korunur.
- In-memory IP limiti instance'lar arasında paylaşılmaz ve doğrudan bağlantı IP'sini kullanır. Reverse proxy/çoklu instance topolojisi netleştiğinde yeniden tasarlanmalıdır.
- Yerel `.env` içinde mevcut `JWT_SECRET` gerçek rastgele en az 32 baytlık değer olmalıdır; `.env.example` placeholder'ı ile backend bilinçli olarak başlamaz. Kullanıcının gerçek secret'ı kendisinin sağlaması gerekir. Production domain/HTTPS yerleşimi ve cookie davranışı dağıtımda ayrıca doğrulanmalıdır.

## Kullanıcı kontrolü

1. Yerel `.env` içindeki mevcut `JWT_SECRET` için güçlü rastgele değer sağlayın; secret'ı Git'e veya mesaja koymayın. `FRONTEND_URL` değerini kullanılan frontend origin'iyle eşleştirin. Register/login için SMTP veya `EMAIL_VERIFICATION_HMAC_KEY` gerekmez.
2. Docker Desktop açıkken uygun JDK ile `backend` dizininde `mvn clean test` çalıştırın; tüm testlerin geçmesini bekleyin.
3. Çalışan backend'de `GET /api/v1/auth/csrf` ile cookie alın. Bu değeri `X-XSRF-TOKEN` header'ında göndererek register isteği yapın; `202` bekleyin, e-posta kodu istenmemeli. Aynı email/şifreyle login yapın; `204` ve iki HttpOnly cookie bekleyin.
4. Access cookie ile `GET /api/v1/auth/me` çağrısında `200`, logout sonrası aynı cookie ile `401` bekleyin. Verify/resend yollarının kapalı olduğunu kontrol edin. Swagger UI onaylı deny-all kuralıyla `403` döner.
