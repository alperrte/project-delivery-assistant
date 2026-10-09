# Kurulum ve deployment

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
| Mail | `MAIL_ENABLED`, `MAIL_PROVIDER` |
| SMTP | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `SMTP_FROM_ADDRESS` |
| Brevo | `BREVO_API_KEY` |
| Log ve bootstrap | `LOG_LEVEL`, `ADMIN_EMAIL`, `ADMIN_INITIAL_PASSWORD` |

`MAIL_ENABLED=false` iken uygulama çalışmaya devam eder. Mail açıksa `MAIL_PROVIDER=smtp` veya `brevo` seçilir; otomatik SMTP → Brevo fallback V1 kapsamında değildir. Development/test ortamında Swagger açık, production'da varsayılan kapalıdır; `API_DOCS_ENABLED` ile yönetilir.

## Production'a çıkmadan önce

1. Frontend/backend hostlarını, domain topolojisini, HTTPS/TLS ve reverse proxy düzenini karara bağlayıp bu belgeye kaydedin.
   Mesajlaşma WebSocket kullanır (`/api/v1/ws`): reverse proxy `Upgrade`/`Connection` başlıklarını iletmeli, uzun ömürlü bağlantıya (en az birkaç dakika boşta) izin vermeli ve tarayıcının `Origin` başlığını değiştirmemelidir; `FRONTEND_URL` aynı zamanda WebSocket için izinli kaynaktır. HTTPS'te `wss://` kullanılır (`NEXT_PUBLIC_API_URL` şemasından türetilir).
2. Cookie `Secure=true`, uygun `SameSite`/`Domain`/`Path`, CSRF akışı ve açık CORS origin listesini gerçek topolojiyle birlikte doğrulayın.
3. Production PostgreSQL bağlantısını (varsayılan Neon) en az yetkili kullanıcıyla kurun; bağlantı secret'larını secret store/ENV içinde tutun. Flyway migration'larını çalıştırın ve Hibernate şema doğrulamasını `ddl-auto=validate` ile yapın.
4. Veritabanı backup/restore beklentisini ve uygulama sürümüyle migration uyumluluğunu belirleyin; bir restore denemesi yapın.
5. `ADMIN_EMAIL` ve güçlü `ADMIN_INITIAL_PASSWORD` ile ilk admin oluşturma, ilk girişte şifre değiştirme ve tekrar başlatmada hesabın değişmemesini doğrulayın.
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

`docker-compose.e2e.yml` is an override for LOCAL browser tests only: `docker compose -f docker-compose.yml -f docker-compose.e2e.yml up -d --build`. It adds Mailpit (`axllent/mailpit:v1.31.4`, UI/API on `127.0.0.1:8025`, SMTP only on the compose network), points the backend at it (`MAIL_ENABLED=true`, `SMTP_HOST=mailpit`, `SMTP_PORT=1025`, `SMTP_AUTH=false`, `SMTP_STARTTLS=false`, `MAIL_FROM=pda-e2e@example.test`) and raises the per-address rate limits. No test mail can reach a real mailbox. Never use it for a deployment.

New optional settings (defaults are the production values; names only in `.env.example`): `CONTACT_RECIPIENT` (fixed contact inbox, default `pdassistant@gmail.com`), `ANALYTICS_RATE_LIMIT_MAX_REQUESTS` (600), `CONTACT_RATE_LIMIT_MAX_REQUESTS` (5). Contact mail uses the existing `MAIL_*`/`SMTP_*` settings; without `MAIL_ENABLED=true` the contact form answers `503 CONTACT_UNAVAILABLE`. Behind a reverse proxy set `TRUSTED_PROXY_CIDRS`, otherwise all visitors share one rate-limit bucket.
