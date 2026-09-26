# ALP-AUTH-00 — Auth source-of-truth audit

**Durum:** Faz 0 tamamlandı (26 Eylül 2026). Kapsam yalnız Alper'in Auth Service alanının keşfi ve sonraki task için handoff'tur. Ürün kodu, migration, bağımlılık ve ortam dosyası değiştirilmedi.

## Yapılanlar ve gerçek durum

- `backend/src/main/java/com/pda/auth`, `user`, `admin` klasörlerinin her birinde 13 `.gitkeep` ve sıfır Java dosyası var. `api`, `application`, `domain`, `infrastructure`, `contract` alt klasörleri yer tutucu. User, UserSession, OAuth identity entity/repository, facade, controller ve security config henüz yok.
- Auth, user ve admin test klasörlerinin her birinde 5 `.gitkeep` var; gerçek auth testi yok. Yalnız `backend/src/test/java/com/pda/backend` altında context ve Testcontainers iskelet testleri var.
- `frontend/src/features/auth`, `users`, `admin` klasörlerinin her birinde 6 `.gitkeep` var. `frontend/src/app/page.tsx` ve `layout.tsx` varsayılan Next.js sayfası/düzenidir. Login, register, profil, admin route'u veya auth API client'ı yok. `frontend/src/lib/api` de yer tutucu.
- `backend/src/main/resources/db/migration` içindeki tek SQL dosyası `V1__spring_modulith_event_publication.sql`; yalnız event publication tablosunu kuruyor. `auth`, `user`, `admin` alt klasörleri `.gitkeep`. User ve UserSession tablosu yok.
- `backend/src/main/java/com/pda/backend/BackendApplication.java` tek giriş sınıfı. `com.pda.backend` paketindeki varsayılan `@SpringBootApplication` taraması, `com.pda.auth`, `com.pda.user`, `com.pda.admin` kardeş paketlerini kapsamaz. Uygulama kodu eklenmeden önce bu ortak bootstrap noktası koordine edilmeli.
- `backend/src/main/resources/application.properties` datasource, Flyway, JPA validate ve Swagger ayarlarını içeriyor. SecurityFilterChain, BCrypt encoder, CSRF/CORS, cookie veya ProblemDetail implementasyonu yok. Spring Security dependency'si mevcut olduğundan framework varsayılanları geçerli; istenen PDA auth davranışı henüz uygulanmış değil.
- `backend/pom.xml` içinde Spring Security, Validation, JPA, Mail, Testcontainers PostgreSQL, Spring Security Test, JJWT ve Springdoc var. Spring OAuth2 client dependency'si yok. Google/GitHub login safhasında dependency ve provider config kararı gerekecek; Faz 0'da değiştirilmedi.
- `com.pda.mail` ve `com.pda.shared` yalnız `.gitkeep` barındırıyor. Mail transport abstraction/adapter yok. Email verification için Spring Mail dependency'si var, çalışan gönderim akışı yok.
- `.env.example` içinde `JWT_SECRET`, SMTP alanları, `ADMIN_EMAIL`, `ADMIN_INITIAL_PASSWORD`, `MAIL_ENABLED`, `MAIL_PROVIDER`, `MAIL_FROM` ve `API_DOCS_ENABLED` anahtarları mevcut. OAuth client bilgileri, access/refresh TTL ve `ALLOWED_ORIGINS` örnek sözleşmede yok. `application.properties`, `API_DOCS_ENABLED` için varsayılan `true` kullanıyor; production'da varsayılan kapalı olma güvenlik hedefi karşılanmıyor. Bu alanlarda değişiklik yapılmadan önce açık onay gerekli. **27 Eylül düzeltmesi:** Bu satırın ilk sürümü mevcut admin/mail/API docs anahtarlarını yanlışlıkla eksik raporlamıştı.
- `docs/compliation` içinde bu kayıt öncesinde yalnız README vardı; önceki Auth teslimi yok. Git çalışma ağacı keşif öncesinde temizdi.

## Kararlar, bağımlılıklar ve riskler

- `.agents/authentication.md`, `.agents/api.md` ve `.agents/SECURITY.md` içindeki eski project role adları (`BACKEND_ENGINEER`, `FRONTEND_ENGINEER`, `UI_DESIGNER` vb.) ile `.agents/faz-md/alper.md` ve `.agents/faz-md/hamza.md` içindeki yeni canonical roller çelişiyor. Yeni ürün rol kararları Alper/Hamza planlarında eşleşiyor; güvenlik ilkeleri ve kabul edilmiş ADR'ler yürürlükte. İlgili uygulama task'ında belgeler ve public contract birlikte uyumlu hale getirilmeli.
- Hamza `project`/`squad` ve ProjectMembership persistence sahibidir. Bu alanlarda henüz gerçek Java kodu yok. Auth'un project rollerini tanımlaması, üyeliği kendi tablosunda tutacağı anlamına gelmez. User arama ve project authorization için public contract gerekecek; başka modülün entity/repository'sine doğrudan erişilmeyecek.
- İlk Auth migration numarası, Hamza'nın paralel Project migration sırasıyla çakışabilir. Migration yazma task'ında ortak sıra koordine edilmeli.
- `pom.xml`, application bootstrap/config, `.env.example`, global security ve frontend ortak API client yüksek conflict alanları. `.env`/`.env.example`, yeni ENV/secret, OAuth config, güvenlik mimarisi veya shared/high-conflict dosya değişikliği önceden raporlanıp onaylanmalı.
- Admin bootstrap için ENV anahtarları mevcut olsa da uygulama kodu yoktur. OAuth giriş için provider ENV sözleşmesi ve kodu yoktur; eksik secret veya config uydurulmadı. **27 Eylül düzeltmesi:** İlk sürüm admin ENV anahtarlarının bulunmadığını ima ediyordu.

## ALP-AUTH-01 handoff

**Amaç:** User identity domain/persistence. Başlangıç için gerçek yerler `backend/src/main/java/com/pda/user/domain/entity`, `domain/enums`, `infrastructure/repository` ve yakın test yerleri `backend/src/test/java/com/pda/user/repository`, `application` olabilir. Dosya/sınıf adları implementation sırasında kesinleştirilmeli. Auth veya admin paketine, Hamza'nın alanına ve shared domain alanına bu task için dokunulmamalı.

**Bağımlılık:** User için gerçek şema bulunmadığından repository testleri migration olmadan çalışamaz. Plan ALP-AUTH-03'te migration öngörüyor; ALP-AUTH-01'in persistence kabul kriteri ile bu sıra gerilimli. ALP-AUTH-01 başlamadan migration sırası ve bootstrap tarama değişikliği koordine edilmeli.

**Test planı:** PostgreSQL Testcontainers üzerinde unique email/nickname ve persistence testleri; email/nickname validasyon sınırları; password hash saklama davranışı (BCrypt kullanım yeri netleştirilerek); mevcut `ddl-auto=validate` ile migration uyumu. Spring Modulith sınır testi ilgili aşamada eklenmeli. ALP-AUTH-01 için henüz test çalıştırılmadı.

**Acceptance:** User kimlik alanları, benzersizlik, durum ve doğrulama statüsü, created/updated zamanları tanımlı; plaintext password persist edilmiyor; Testcontainers repository/validation testleri yeşil; ProjectMembership Auth içine taşınmıyor. ALP-AUTH-01'e bu audit kapsamında başlanmadı.

## Doğrulama ve kullanıcı kontrolü

- Çalıştırılan komutlar: `rg --files --hidden` ile kaynak/test/frontend envanteri; `rg -n` ile security/auth referansları; `Get-ChildItem` ile migration ve `.gitkeep` sayımı; `git status --short --untracked-files=all` ile başlangıç çalışma ağacı kontrolü. Sonuçlar yukarıdaki envanterle uyumlu.
- Build veya test çalıştırılmadı: Faz 0 kod ve davranış değişikliği içermeyen keşif task'ı. Ürün kodu değişmedi.
- Kullanıcı kontrolü: Bu rapordaki paket/test/migration envanterini repo ile karşılaştırın; özellikle component scan, production Swagger varsayılanı, eski rol belgeleri ve Hamza migration koordinasyonunu inceleyin. Sonraki task yalnız `ALP-AUTH-01` için ayrıca başlatılmalıdır.
