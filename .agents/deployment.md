# Kurulum ve deployment

## Merge öncesi devam ve migration sırası — 2026-10-11

Son kullanıcı kararı: bütün test fazları cleanup üzerinde, push/merge öncesinde tamamlanır; numaralandırma V1–V40 olur. Kullanıcı tam pre-push tekrarını istemedi; başarılı backend sınıfları korunarak kalan sınıflar ve canonical frontend/full-Chromium/Docker adımları devam ettirilir. Sonuçta kesintisiz pre-push.cmd PASS veya main üzerinde koşulmuş test sonucu varsayılmamalıdır; gerçek adım kanıtları final kayıt içindedir. Maven aşaması yalnız operatörden gelen MAIL_ENABLED ayarını false yapar; mail testleri kendi GreenMail ayarlarını sağlar, Docker öncesi özgün değer geri yüklenir. ENV dosyası/runtime mail politikası değişmez. Eski normal DB/media volume korunur; yeni V1–V40 imajı ayrı boş DB gerektirir.

## Disposable history consolidation — 2026-10-11

Kullanıcı `cleanup` branch'inde yalnız disposable development/test DB'ler için Flyway history rewrite onayladı. Runtime migrations 59→40'tır. Daha önce eski V1–V71 history uygulanan bir DB ile yeni imaj başlatılmaz: Flyway validation fail beklenir. `flyway repair`, `baseline-on-migrate`, validation bypass veya mevcut volume'ü otomatik silme yoktur. Yeni kurulum ayrı boş DB gerektirir; existing local PostgreSQL/media volume korundu. ENV contract, auth, CSRF ve API değişmedi. Schema/legacy mapping `PDA_MIGRATION_CONSOLIDATION_PLAN.md` içindedir. Phase 2 main + full canonical pre-push kullanıcı merge teyidinden sonra yürütülür.

## Organization görselleri (2026-10-04)

Organization logo/cover dosyaları private filesystem storage kullanır. `ORGANIZATION_MEDIA_STORAGE_PATH` Compose içinde `/app/organization-media` varsayılanına sahiptir; `pda_organization_media` named volume aynı yola bağlanır. Host Java çalıştırmada property varsayılanı `.local/organization-media`; testler ayrı geçici kök kullanır. Container kullanırken ENV mutlak container yolu olmalıdır. `down -v` bu görselleri de siler. DB metadata/reference ve volume birlikte yedeklenip geri yüklenmelidir; tek başına DB restore yeterli değildir. Bu adapter tek backend host içindir; çok host kurulumda ortak kalıcı storage adapter gerekir. Yeni S3/MinIO servisi eklenmez. Arşiv reference ve dosyayı korur, endpoint erişimini kapatır; replace/remove temizliği kalıcı lifecycle kayıtlarıyla tekrar denenir.

> Durum: development düzeni planlandı; production deployment mimarisi **TBD**. Frontend/backend hosting, domain ve subdomain, TLS/reverse proxy, container registry, deploy tetikleme, free-tier davranışı ve backup/restore henüz seçilmedi. Bu belge belirli bir sağlayıcıyı veya hazır production prosedürünü ilan etmez.

## Local development

Docker Compose yalnız iki servis çalıştırır: Spring Boot `backend` ve PostgreSQL `postgres`. Next.js frontend Docker dışında, doğrudan Node.js ile çalışır (`frontend/Dockerfile` ileride production imajı için duruyor, compose'da kullanılmıyor). Gerçek ayarlar commit edilen YAML'a yazılmadan `.env` üzerinden verilir. Başlangıç akışı:

```sh
cp .env.example .env
# .env içindeki gerekli değerleri yerel ortam için doldurun.
docker compose --env-file .env up --build -d
docker compose ps
docker compose logs --follow backend

cd frontend
npm install
npm run dev   # http://localhost:3000
```

Frontend API adresini `NEXT_PUBLIC_API_URL` ile alır; tanımlı değilse `http://localhost:8080/api/v1` kullanılır. Kök `.env` dosyası Next.js tarafından okunmaz; farklı bir adres gerekirse `frontend/.env.local` kullanılır. `INTERNAL_API_URL` ve `FRONTEND_PORT` compose'da artık kullanılmıyor.

Windows PowerShell'de ilk komut için `Copy-Item .env.example .env` kullanılabilir. Compose portları ve health check tanımları gerçek dosyadan okunmalıdır; bu planda henüz sabitlenmemiştir. Durdurmak için `docker compose down` kullanın. Veri silinmesi istenmiyorsa volume silme seçeneğini eklemeyin.

`DB_PORT` veya `DB_URL` değiştiğinde Docker Desktop'ı ya da mevcut container'ı yeniden başlatmak eski container komutunu değiştirmez. Port değerlerinin eşleştiğini kontrol edip `docker compose up -d --build --force-recreate postgres backend` çalıştırın; bu işlem named PostgreSQL volume'ünü silmez. Ardından `docker compose ps` ve `/actuator/health` ile doğrulayın. `down -v` kullanmayın; volume içindeki veriyi siler.

## Konfigürasyon

Backend profilleri `application-dev.yml`, `application-test.yml`, `application-prod.yml` ve ortak `application.yml` olarak planlanmıştır. Secret değerler bu dosyalara girilmez. Production'da zorunlu secret veya ayar eksikse uygulama fail-fast davranmalıdır.

| Grup | Planlanan değişkenler |
| --- | --- |
| Uygulama | `APP_ENV` |
| Veritabanı | `DB_URL`, `DB_USERNAME`, `DB_PASSWORD` |
| JWT | `JWT_SECRET`, `JWT_ACCESS_TOKEN_EXPIRATION`, `JWT_REFRESH_TOKEN_EXPIRATION` |
| API dokümantasyonu | `API_DOCS_ENABLED` |
| Frontend ve CORS | `FRONTEND_URL`, `ALLOWED_ORIGINS` |
| Mail | `MAIL_ENABLED`, `MAIL_PROVIDER` (yalnız `smtp`), `MAIL_FROM` |
| SMTP | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `SMTP_AUTH`, `SMTP_STARTTLS` |
| İletişim formu | `CONTACT_RECIPIENT`, `CONTACT_MIN_FILL_TIME`, `CONTACT_MAX_FORM_AGE`, `CONTACT_REQUIRE_STARTED_AT`, `CONTACT_RATE_LIMIT_MAX_REQUESTS` |
| Saklama süreleri | `RETENTION_CRON`, `RETENTION_BATCH_SIZE`, `RETENTION_ANALYTICS_MONTHS`, `RETENTION_USER_SESSIONS_DAYS`, `RETENTION_CONTACT_MONTHS`, `RETENTION_AUDIT_MONTHS` |
| Log ve bootstrap | `LOG_LEVEL`, `ADMIN_EMAIL`, `ADMIN_INITIAL_PASSWORD` |

`MAIL_ENABLED=false` iken uygulama çalışmaya devam eder. Mail açıksa `MAIL_PROVIDER=smtp` olmalıdır: kodda yalnız SMTP adaptörleri vardır (kayıt/şifre/hesap silme, proje daveti ve iletişim formu) ve başka bir `MAIL_PROVIDER` değeri açılışta reddedilir. Brevo/Resend gibi sağlayıcılar kendi SMTP röle bilgileriyle `SMTP_*` üzerinden kullanılır; ayrı bir Brevo API adaptörü (`BREVO_API_KEY`) yoktur ve otomatik sağlayıcı fallback'i V1 kapsamında değildir. Development/test ortamında Swagger açık, production'da varsayılan kapalıdır; `API_DOCS_ENABLED` ile yönetilir.

## Production'a çıkmadan önce

1. Frontend/backend hostlarını, domain topolojisini, HTTPS/TLS ve reverse proxy düzenini karara bağlayıp bu belgeye kaydedin.
   Mesajlaşma WebSocket kullanır (`/api/v1/ws`): reverse proxy `Upgrade`/`Connection` başlıklarını iletmeli, uzun ömürlü bağlantıya (en az birkaç dakika boşta) izin vermeli ve tarayıcının `Origin` başlığını değiştirmemelidir; `FRONTEND_URL` aynı zamanda WebSocket için izinli kaynaktır. HTTPS'te `wss://` kullanılır (`NEXT_PUBLIC_API_URL` şemasından türetilir).
2. Cookie `Secure=true`, uygun `SameSite`/`Domain`/`Path`, CSRF akışı ve açık CORS origin listesini gerçek topolojiyle birlikte doğrulayın.
3. Production PostgreSQL bağlantısını (varsayılan Neon) en az yetkili kullanıcıyla kurun; bağlantı secret'larını secret store/ENV içinde tutun. Flyway migration'larını çalıştırın ve Hibernate şema doğrulamasını `ddl-auto=validate` ile yapın.
4. Veritabanı backup/restore beklentisini ve uygulama sürümüyle migration uyumluluğunu belirleyin; bir restore denemesi yapın.
5. `ADMIN_EMAIL` ve güçlü `ADMIN_INITIAL_PASSWORD` ile ilk admin oluşturma, `/pd-admin` girişinde zorunlu şifre değişimi olmadan ilk Authenticator kaydı (QR) ve tekrar başlatmada hesabın değişmemesini doğrulayın; ayrıntı `.agents/SECURITY.md` son bölüm.
6. `/actuator/health`, liveness/readiness ve uygun Docker health check'lerini kontrol edin. Loglarda password, cookie, JWT veya secret olmadığını doğrulayın.
7. GitHub Actions üzerinden backend test/build, frontend build/lint/type-check, JaCoCo, SonarQube Cloud ve Docker build kontrollerini geçirin. Gerçek deploy workflow'u hosting kararı verilince eklenir.

## Açık karar kaydı

| Karar | Durum |
| --- | --- |
| Frontend hosting | TBD |
| Backend hosting | TBD |
| Production PostgreSQL | Neon varsayılanı; sağlayıcı bağımsız uygulama |
| Domain/subdomain | TBD |
| TLS/reverse proxy | TBD |
| Container registry | TBD |
| Deploy tetikleme/workflow | TBD |
| Free-tier limitleri/sleep davranışı | TBD |
| Backup/restore | TBD |

Seçim ölçütleri: ücretsiz veya düşük maliyet, Spring Boot + Docker uyumu, HTTPS ve güvenli secret yönetimi, PostgreSQL bağlantı güvenilirliği, mail stratejisiyle uyum ve açık kaynak kullanıcılar için tekrarlanabilir kurulum.

## E2E stack with a mail sink, and new settings (2026-10-09)

`docker-compose.e2e.yml` (Mailpit mail sink and raised rate limits for local browser tests) was removed on 2026-10-10. The Playwright specs that read mail from Mailpit need an equivalent override before they can run again. The stack now always uses the real `MAIL_*`/`SMTP_*` settings.

New optional settings (defaults are the production values; names only in `.env.example`): `CONTACT_RECIPIENT` (fixed contact inbox, default `pdassistant.info@gmail.com` since 2026-10-10), `ANALYTICS_RATE_LIMIT_MAX_REQUESTS` (600), `CONTACT_RATE_LIMIT_MAX_REQUESTS` (5). Contact mail uses the existing `MAIL_*`/`SMTP_*` settings; without `MAIL_ENABLED=true` the contact form answers `503 CONTACT_UNAVAILABLE`. Behind a reverse proxy set `TRUSTED_PROXY_CIDRS`, otherwise all visitors share one rate-limit bucket.

## Canonical smoke and long serial browser suites ? 2026-10-09

Pre-push frontend smoke targets canonical `/tr/ana-sayfa`; legacy `/tr` still redirects308 and Windows PowerShell treats that redirect as an error. The working page must still answer200. Browser suite shared test accounts renew their saved sessions every5min through the existing real CSRF/login API without mounting app UI; snapshot replacement is atomic and timer/browser/pending cleanup belongs to global-setup teardown. This affects ignored QA artifacts only, not token lifetimes or deployment ENV. Final merged gate:649 backend0 failure/error/skip +555 Chromium/1 expected skip, lint/type/build/Docker PASS. See `docs/compliation/2026-10-09-auth-frontend-main-conflict-resolution.md`.

## Retention, contact traps and audit (2026-10-10)

All optional; the defaults are the published retention periods and need no `.env` change (names only in `.env.example`).

- `RETENTION_CRON` (default `0 30 3 * * *`, UTC, Spring six-field cron; `-` switches every purge off), `RETENTION_BATCH_SIZE` (1000 rows per delete statement), `RETENTION_ANALYTICS_MONTHS` (12; sessions by last activity, page views, CTA clicks and client errors follow by `ON DELETE CASCADE`), `RETENTION_USER_SESSIONS_DAYS` (30; revoked or expired sessions only), `RETENTION_CONTACT_MONTHS` (12; `contact_requests` and stored `support_requests`), `RETENTION_AUDIT_MONTHS` (24; `admin_audit_events`). Each purge is its own job (`retention.analytics`, `retention.user-sessions`, `retention.contact`, `retention.audit`), idempotent and logs counts only. With several backend instances every instance runs the purge; this is harmless (the deletes only remove expired rows).
- Contact form bot traps: `CONTACT_MIN_FILL_TIME` (`PT3S`), `CONTACT_MAX_FORM_AGE` (`PT24H`) and `CONTACT_REQUIRE_STARTED_AT` (`false` while the deployed frontend does not send the form timestamp yet; set `true` afterwards so a submission without it is treated as a bot).
- The administrator system status (`GET /api/v1/admin/system/status`) lists every background job with its last run and outcome, the active session count, 4xx/5xx counts of the last 24 hours and whether `TOTP_ENCRYPTION_KEY` is set. Job runs and error counters live in memory of the process (a restart empties them; with several instances each reports its own).
- The audit trail needs no setting; it is written to `admin_audit_events` (V70).

## Auth hardening settings (2026-10-10)

- `TOTP_ENCRYPTION_KEY` — Base64 of 32 random bytes (`openssl rand -base64 32`), different from every other key. Without it two-step verification reports itself unavailable. Losing or changing it makes stored authenticator secrets unreadable: users would have to set 2FA up again.
- `EMAIL_VERIFICATION_HMAC_KEY` — now required for registration too (it hashes the mailed codes).
- `MAIL_ENABLED=true` with working `SMTP_*` is required: registration, password reset/change and account deletion all send mail, and registration answers `503` without creating an account when mail is off. Gmail needs an app password (2-step verification on).
- To try real mail locally, run plain `docker compose up -d` with the `SMTP_*` values in `.env`.
