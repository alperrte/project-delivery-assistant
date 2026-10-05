# Organization Profile Expansion

## Teslim ve durum

Tamamlanma tarihi: 2026-10-05. Durum: **Tamamlandı; final pre-push kapısı başarılı.**

Kapsam frontend + backend + V52 migration + yerel Compose/storage config + dokümantasyondur. Çalışma branchi `project-service-frontend`; commit, staging ve push yapılmadı. Gerçek `.env` değiştirilmedi.

## Yapılanlar

- Website, iletişim e-postası ve konum nullable metadata olarak eklendi; mevcut name/description/owner/status/slug davranışı korundu. Notes alanı, public organization profili veya organization üyelik/rol modeli eklenmedi.
- Logo ve cover DB binary yerine özel filesystem storage'a gider. `MediaStorage` portu ileride adapter eklenmesine uygundur; V1'de S3/MinIO yoktur. Organization'da eski BYTEA görsel olmadığından taşıma/backfill gerekmedi; Project/User BYTEA görselleri korunur.
- Dosya adı/path kullanıcıdan alınmaz; UUID key, containment/symlink kontrolleri, sınırlı byte okuma, geçici dosya + atomic rename kullanılır. PNG/JPEG/WebP imza/header/dimension doğrulaması; logo 512 KiB, cover 2 MiB, 6000 px kenar ve 24 milyon piksel sınırı.
- Lifecycle ledger PENDING/ACTIVE/DELETE_PENDING kayıtlarını korur. Row lock ile eşzamanlı replace/read/metadata koordine edilir. Yarım kalan upload ve silme hataları tekrar temizlenir; başarısız yeni upload önceki görseli korur. Archive referansları retention için korunur, API erişimi kapanır.
- Create/edit üç bölüm, ortak gerçek kart/header önizlemesi, dosya seçme/drop/klavye, yerel preview ve object URL cleanup kullanır. Mevcut token'lar ve Project media bileşenleri paylaşılır.
- Metadata kaydedildikten sonra upload başarısızsa aynı ID korunur; retry yalnız başarısız işlemi gönderir. Logo hatası, cover hatası ve ikisinin birlikte hatası ikinci organization oluşturmaz. Edit'te silme onaydan sonra draft'tır; Save uygular, Vazgeç sunucu medyasını değiştirmez. Refetch kirli alanları sıfırlamaz.
- Liste/detail versioned görselleri ve fallback gösterir; iletişim bilgileri sade detail alanındadır. TR/EN/DE çevirileri eklendi.
- QA'da 320 px uzun retry metni taşması düzeltildi. Full gate'in bulduğu mevcut takvim seçicisinin yalnız ilk 100 projeyi getirme sorunu sayfalı `projectsApi.allVisible` ile düzeltildi; sonraki sayfadaki proje ve sohbet bağlamı korunur.

### Önemli dosyalar

- [V52 migration](../../backend/src/main/resources/db/migration/V52__organization_profile_and_media.sql)
- [OrganizationMediaService](../../backend/src/main/java/com/pda/project/organization/application/OrganizationMediaService.java), [OrganizationMediaController](../../backend/src/main/java/com/pda/project/organization/api/OrganizationMediaController.java), [FileSystemMediaStorage](../../backend/src/main/java/com/pda/shared/FileSystemMediaStorage.java)
- [Organization form](../../frontend/src/features/organizations/components/organization-form-page.tsx), [profile header](../../frontend/src/features/organizations/components/organization-profile-header.tsx), [card](../../frontend/src/features/organizations/components/organization-card.tsx)
- [Shared image picker](../../frontend/src/components/common/image-picker.tsx), [picked-image hook](../../frontend/src/lib/media/use-picked-image.ts), [organization E2E](../../frontend/e2e/organization-profile.spec.ts)
- [Compose](../../docker-compose.yml), [.env.example](../../.env.example), [.gitignore](../../.gitignore)
- SECURITY §11/18, API, database, architecture, folder-structure, deployment, frontend-design-rules ve web master checklist'in etkilenmiş kapsam notu güncellendi.

## Doğrulama

| Komut/kontrol | Sonuç |
|---|---|
| Organization domain/repository, V51→V52 migration testleri | Geçti; eski nullable alanlar ve metadata korunuyor |
| `mvn -f backend/pom.xml '-Dtest=Organization*Test,ProjectApiIntegrationTest,ProjectLogo*Test,ProjectBanner*Test,UserProfilePhoto*Test,ProjectInvitation*Test,ModularityTest,FileSystemMediaStorageTest' test -q` | Geçti |
| `mvn -f backend/pom.xml -DskipTests package -q` | Geçti |
| Lint, `npx tsc --noEmit`, `npm run build` | Geçti |
| `npx playwright test e2e/organization-profile.spec.ts` | İlk 8 test geçti; final pakette genişletilmiş 10 senaryo |
| `cmd /c pre-push\pre-push.cmd` | `PDA PRE-PUSH CHECK PASSED`; Maven 413 test / 0 fail / 0 error / 0 skip, Chromium 180 passed + 1 expected skip |
| Gerçek API upload → `docker compose up -d --force-recreate backend` → tekrar GET | Aynı logo byte'ları döndü; silme/archive cleanup tamamlandı |
| Salt okunur media volume → tar yedeği → ayrı QA volume restore → SHA-256 karşılaştırma | 26/26 dosya eşleşti; geçici volume'ler temizlendi |
| Chromium light/dark, TR/EN/DE, 320/390/768/1280/1440 px, klavye ve reduced motion | Organization hedefli testleri geçti; screenshot incelendi |
| Sohbet barı / organization sticky Save | 320/390/1280 px overlap yok; mevcut sohbet regression testine eklendi |
| `git diff --check`, staging kontrolü | Geçti; staged değişiklik yok |

İlk full gate takvim seçicisindeki proje sayfalaması nedeniyle başarısız oldu (168 passed, 1 failed, serial bağımlılıklar çalışmadı). Sorun giderildi ve final kapı yeniden çalıştırıldı; bu ilk sonuç başarılı kapı olarak sayılmadı. Final koşuda takvim/sohbet testi ve tüm yeni organization testleri geçti. Beklenen tek skip: `error-pages.spec.ts` kontrollü crash route production'da kapalıdır. Log: `.local/organization-pre-push-final.log` (Git dışında). Önceki dar QA'da bulunan mobil retry taşması da giderildi.

API güvenlik testleri anonymous 401, foreign owner ve foreign global ADMIN 403, CSRF reddi, archive/no-image 404, dosya type/size/empty/dimension kontrolleri, yazma/silme fault recovery, stale version ve eşzamanlı replacement kapsar. Gerçek success akışları backend'e gider; Playwright mock yalnız hata enjeksiyonu içindir.

## API ve Swagger

Kimlik cookie oturumundan alınır. Profil/media yalnız aktif organization owner kapsamındadır; global ADMIN bypass yoktur. Mutation'lar mevcut CSRF header/cookie mekanizmasını kullanır.

| Method/path | İstek | Başarı | Önemli hatalar |
|---|---|---|---|
| POST `/api/v1/organizations` | JSON name, description?, website?, contactEmail?, location? | 201 profil + Location | 400 validation, 401, 403 CSRF |
| PUT `/api/v1/organizations/{id}` | Aynı tam metadata JSON | 200 profil | 400, 401, 403 owner/CSRF, 404 |
| GET `/api/v1/organizations` | page/size | 200 owned page | 400, 401 |
| GET `/api/v1/organizations/{id}` | UUID | 200 metadata + nullable logoVersion/coverVersion | 401, 403, 404 |
| PUT `/api/v1/organizations/{id}/logo` ve `/cover` | multipart `file` | 204 | 400 dosya, 401, 403, 404, 409 conflict, 503 storage |
| GET `/api/v1/organizations/{id}/logo` ve `/cover` | UUID, opsiyonel v cache-buster | 200 detected MIME + bytes | 401, 403, 404, 503 |
| DELETE `/api/v1/organizations/{id}/logo` ve `/cover` | UUID, body yok | 204, idempotent | 401, 403, 404 |

Safe JSON: `{"name":"Example Studio","website":"https://example.com","contactEmail":"team@example.com","location":"İstanbul"}`. Optional boş/eksik metadata null olur; PUT media alanlarını değiştirmez. Name 160, description 2000, website 2048, email 254, location 200. Website HTTP/HTTPS, host zorunlu, credentials/control character yasak; remote fetch yoktur.

Görsel GET: private/no-store, nosniff, sandbox CSP ve sabit inline filename. Version eski olsa da güncel görsel döner. Media ProblemDetail kodları `ORGANIZATION_MEDIA_EMPTY|INVALID_TYPE|TOO_LARGE|DIMENSIONS|CONFLICT|UNAVAILABLE`; her suffix aynı prefix taşır. Metadata hataları mevcut generic ProblemDetail/invalidFields sözleşmesindedir; servlet limit reddi mevcut 400 davranışını korur.

Swagger yalnız mevcut `API_DOCS_ENABLED=true` ayarında `/swagger-ui/index.html` ve `/v3/api-docs` üzerinden açıktır. Normal oturum + CSRF ile create/update/upload/delete uçlarını kontrol edin. Swagger için mevcut ayarı değiştirmek bu teslimde yapılmadı; gerçek credential dokümana yazılmaz.

## Sınırlar / açık konular

- Filesystem adapter tek host local deployment içindir. S3/MinIO ve çok host production adapter kapsam dışıdır.
- Production backup seti PostgreSQL + media volume ile tutarlı alınmalıdır. Test volume byte restore'unu doğruladı; çalışan veritabanına production restore yapılmadı. `docker compose down -v` kalıcı verileri siler.
- ImageSniffer tam decode/bütünlük taraması yapmaz; mevcut güvenli MIME/header/pixel politikası korunur.
- Chromium çalıştırıldı; Firefox/WebKit ve gerçek cihaz testleri çalıştırılmadı. Proje genelindeki checklist maddeleri yalnız bu görev kanıtıyla tamamlandı sayılmadı.
- Next.js dev sunucusu 3000 portunda geri açıldı; `/tr` HTTP 200. Backend health UP; `project-delivery-assistant_pda_organization_media` → `/app/organization-media` mount korundu.

## Kullanıcının manuel kontrolü

1. `/tr/organizasyonlar/yeni` açın; ad, açıklama, website, e-posta, konum ve logo/cover seçin. Kart/header preview anında değişmeli; Kaydet gerçek detail'a gitmeli.
2. Liste ve detail'da görselleri/metadata'yı kontrol edin. Edit'te alanlar dolu gelmeli; dosya replace sadece Kaydet ile uygulanmalı.
3. Kaldır → onay → Vazgeç: mevcut görsel korunmalı. Kaldır → onay → Kaydet: initials/cover fallback görünmeli.
4. JavaScript URL, hatalı e-posta, SVG, boş/çok büyük dosya seçin; açıklayıcı hata olmalı, önceki geçerli görsel kaybolmamalı.
5. Light/dark ve TR/EN/DE kontrolü yapın. Mobilde action bar kullanılabilir, sohbet dock'u Save'i örtmemeli.
6. Organization'ı archive edin; listeden çıkmalı, eski detail/görsel adresleri artık 404 dönmeli. Proje üyeliği/yetkileri organization ownership ile genişlememeli.
7. Container yeniden oluştururken named volume'ü koruyun; görseller kalmalı. `ORGANIZATION_MEDIA_STORAGE_PATH` container içi mutlak yoldur; varsayılan `/app/organization-media` kullanılır. Gerçek `.env` için değişiklik yapılmadı.
