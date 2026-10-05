# Organization backend — branch hazırlığı

## Teslim ve durum

2026-10-05. Organization profile/media/notes backend geliştirmesi `project-service-backend` worktree'sinde commit için stage edildi. Commit/push/pull/merge yapılmadı. Frontend kodu aktarılmadı; branch HEAD değişmedi. Kullanıcının frontend branch'inde yaptığı backend değişiklikleri tam yedekten aktarıldı.

## Kapsam ve dosyalar

- `project/organization/{api,application,domain,infrastructure}` metadata, notes, logo/cover API ve lifecycle ledger.
- `shared/{MediaStorage,FileSystemMediaStorage}` private filesystem port/adapter; future adapter sınırı korunur.
- V52 organization profile/media ledger, V53 optional notes; testleri ve mevcut security/error handler integration.
- `docker-compose.yml` persistent media volume; `.env.example` güvenli storage path örneği; `.gitignore` private `.local/`.
- `.agents/{SECURITY,api,architecture,database,deployment,folder-structure}.md` ilgili contract/storage bilgileri. Mimari/klasör özeti frontend branch'inde de ortak belge olarak bulunur; backend'in önceki frontend/landing metni korunmuştur.

## Doğrulama

Aktarılan backend kaynak/config içeriği yedekle karşılaştırıldı; staged içerik hazır, unresolved conflict yok, frontend değişikliği yok. `git apply --3way` doküman context farkı yalnız folder-structure'da çözüldü. Bu işlem kod düzeltmesi değildir; testler tekrar çalıştırılmadı.

Son staged whitespace kontrolünde V53'ün mevcut CRLF satır sonu uyarısı LF ile temizlendi; SQL içeriği değişmedi. Son `git diff --cached --check` temiz.

Önceki birleşik kaynak audit'inde OrganizationDomainTest/ServiceTest/RepositoryTest/ProfileMigrationTest, ProjectApiIntegrationTest, FileSystemMediaStorageTest ve ChatApiIntegrationTest/WebSocketIntegrationTest toplam 66 hedefli test; tam gate 415 backend ve 182 Chromium testi + 1 expected skip geçti. Browser/DB/medya byte hash'leri ve gerçek container force-recreate kanıtı alındı. Bu branch eski frontend'i içerdiği için önceki 182 Chromium sonucu bu worktree'nin tek başına yeniden test edildiği anlamına gelmez.

## API / Swagger

SECURITY §11 endpoint matrisi `.agents/SECURITY.md` Organization profile and media bölümündedir. `POST /api/v1/organizations` → 201 JSON; `GET /organizations` ve `GET /organizations/{id}` → 200; `PUT /organizations/{id}` → 200; `/organizations/{id}/logo` ve `/cover` için PUT multipart `file`/DELETE → 204, authenticated GET → MIME bytes200. Mutations cookie session + CSRF, metadata/media active-owner kapsamı; validation400, anonymous401, owner/CSRF403, missing404, media conflict409/storage503. Mevcut archive POST204 ve organization projects GET200 korunur; projects listesi aktif organization + proje üyeliği filtresini kullanır.

Güvenli body: `{"name":"Example Studio","description":"Kısa açıklama","notes":"Ek not","website":"https://example.com","contactEmail":"team@example.com","location":"İstanbul"}`. Notes <=1000, description <=2000; full PUT optional blank/missing→null, media refs korunur. Logo512KiB/cover2MiB PNG/JPEG/WebP; DB metadata/reference, bytes private volume. Swagger mevcut izinli ayarda `/swagger-ui/index.html` ve `/v3/api-docs`, normal login/CSRF; ENV veya yetki gevşetilmedi.

## Açık konular / kullanıcı kontrolü

Sonraki pre-push fazı tamamlandı: backend kapısı 415 Maven + 139 Chromium, frontend final kapısı 404 Maven + 182 Chromium; her birinde 1 expected skip, PASSED. Kaynak seçimi, ilk frontend429 engeli ve mevcut npm dependency uyarıları [pre-push kaydında](2026-10-05-backend-branch-pre-push.md) açıklanır. Bu kaydın önceki test-tekrar-yok cümlesi ilk ayırma anını anlatır.

- Frontend bu branch'te eski sürümdür; yeni frontend diğer branch'tedir. İlgili değişiklikler birleşmeden tam ürün entegrasyonu bu checkout'ta mevcut sanılmamalı.
- Gerçek `.env` bu worktree'ye kopyalanmadı ve stage edilmedi; çalışma zamanı servislere dokunulmadı. Yeni storage binary dosyaları Git dışında, DB ve volume backup birlikte gerekli.
- Bu dizinde `git branch --show-current` → `project-service-backend`; `git diff --cached --name-only` backend/config/docs göstermeli. Hazır dosyaları kullanıcı commit ve push eder; yeniden `git add .` gerekmez.
- Yedek ana worktree `.local/branch-split/2026-10-05-020849/` içindedir. Commit/push doğrulanmadan worktree veya yedek kaldırılmamalı.
