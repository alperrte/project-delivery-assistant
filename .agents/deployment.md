# Kurulum ve deployment

> Durum: development düzeni planlandı; production deployment mimarisi **TBD**. Frontend/backend hosting, domain ve subdomain, TLS/reverse proxy, container registry, deploy tetikleme, free-tier davranışı ve backup/restore henüz seçilmedi. Bu belge belirli bir sağlayıcıyı veya hazır production prosedürünü ilan etmez.

## Local development

Planlanan Docker Compose düzeni üç servisten oluşur: Next.js `frontend`, Spring Boot `backend` ve PostgreSQL `postgres`. Uygulama container'ları Dockerfile ile üretilir. Gerçek ayarlar commit edilen YAML'a yazılmadan `.env` üzerinden verilir. Compose dosyası, Dockerfile'lar ve `.env.example` repoda hazır olduğunda başlangıç akışı:

```sh
cp .env.example .env
# .env içindeki gerekli değerleri yerel ortam için doldurun.
docker compose --env-file .env up --build -d
docker compose ps
docker compose logs --follow backend
```

Windows PowerShell'de ilk komut için `Copy-Item .env.example .env` kullanılabilir. Compose portları ve health check tanımları gerçek dosyadan okunmalıdır; bu planda henüz sabitlenmemiştir. Durdurmak için `docker compose down` kullanın. Veri silinmesi istenmiyorsa volume silme seçeneğini eklemeyin.

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
