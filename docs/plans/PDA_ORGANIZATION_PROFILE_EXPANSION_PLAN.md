# Organization Profile Expansion — Uygulama Planı

Plan tarihi: 2026-10-04. Tamamlanma: 2026-10-05. Durum: **Uygulama ve doğrulama tamamlandı.**

Final kapı: `PDA PRE-PUSH CHECK PASSED`. Backend 415/415; Chromium 180 passed + production kontrollü crash route için 1 expected skip. Geliştirme sunucusu 3000 portunda geri açıldı, backend UP ve media volume mount doğrulandı. Son referans/notes teslimi: `docs/compliation/2026-10-05-organization-reference-ui-notes.md`; ilk teslim kaydı `docs/compliation/2026-10-05-organization-profile-expansion.md`.

Kaynak promptun 919 satırının tamamı ve `frontend/CLAUDE.md` (`@AGENTS.md` yönlendirmesi dahil) okundu. Bu dosya uygulama aşamasının sıralı kontrol listesidir. Kullanıcı 2026-10-04 tarihinde uygulamayı başlattı. Commit, staging, push yapılmaz. Her task kendi testleri ve Definition of Done tamamlanınca işaretlenir; sonraki task bundan sonra başlar.

## Referans tasarım ve notes ek kapsamı — 2026-10-05

Kullanıcı ilk teslim sonrası referans görüntüye uygun UI ve kaydedilen opsiyonel `notes` alanını istedi. Bu yeni karar önceki notes kapsam dışı kararını genişletir. `description` kısa açıklama, `notes` 1000 karakter ek not olarak ayrı tutulur. V53 nullable kolon; create/edit API + DTO + validation + i18n + gerçek detail gösterimi eklenir. Önceki kapı sonucu ilk teslim içindir; yeni kapsamın kapısı ayrıca doğrulanır.

- [x] İkonlu form bölümleri, yan yana yükleme kutuları, geniş iki kolon, üç canlı preview ve yardım kartı.
- [x] Notes domain/DTO/API/V53 + frontend validation ve TR/EN/DE.
- [x] Notes persistence/migration/owner/1000 sınırı ve 33 hedefli Chromium testi.
- [x] Son tasarım ile tam pre-push, ekran görüntüsü incelemesi, geliştirme düzeninin geri açılması ve yeni teslim kaydı.

## 1. Uygulama öncesi koddan doğrulanan mimari

- Organization ayrı Spring Modulith kök modülü değildir; `com.pda.project.organization` Project modülünün altındadır. Entity, repository, service, request/response ve controller mevcut.
- `Organization`: `name` 160, `slug` 100, `description` 2000, değişmez `ownerUserId`, ACTIVE/ARCHIVED, created/updated/archived zamanları. Website/contactEmail/location/notes/görsel alanları yok.
- Organizasyon üyelik tablosu veya organizasyon admin rolü yoktur. Liste/detail/update/archive aktif organizasyonun sahibine açıktır. Global ADMIN ayrı platform rolüdür; burada örtük yetkisi yoktur.
- POST create 201; GET liste/detail 200; PUT metadata 200; POST archive 204. Gerçek organizasyon DELETE endpoint'i yok. Arşivlenmiş organizasyon normal detail/edit akışında 404 olur.
- `ProjectService.create` ve organizasyon değiştiren update sahibini denetler. Aynı organizasyona bağlı projeyi diğer proje yöneticisinin düzenlemesi korunur. Organizasyon proje listesi yalnız çağıranın üyeliği bulunan projeleri gösterir; organizasyon sahibi olmak projeye erişim sağlamaz.
- V21 organizations ve projects.organization_id FK'sini oluşturur. Şu an en yüksek migration V51; yeni numara uygulama başında tekrar doğrulanmalıdır.
- `ProjectLogoService`, `ProjectBannerService`, `UserProfilePhotoService` ayrı BYTEA tablolarını kullanır. **S3/MinIO/disk storage abstraction mevcut değildir.** Bunları organizasyon için doğrudan kopyalamak promptun DB'de binary tutmama şartını ihlal eder.
- Ortak `shared.ImageSniffer` PNG/JPEG/WebP magic byte ve header boyutlarını denetler: en fazla 6000 px kenar, 24 milyon piksel. Bu tam dosya decode/bütünlük doğrulaması değildir. Mevcut logo limiti 512 KiB, banner 2 MiB; multipart servlet limiti 11 MB.
- `SecurityBaselineConfiguration` GET organization yollarını, PUT metadata ve POST create/archive yollarını izin listesine alır; yeni PUT/DELETE logo/cover yollarını açıkça eklemek gerekir. Organization 401 entrypoint ve CORS kapsamı zaten mevcuttur.
- Frontend `OrganizationFormPage` create/edit için ortak RHF/Zod formudur; `PageContainer width="form"`, 7/5 kolon, gerçek `OrganizationCard` canlı önizlemesi ve `data-sticky-actions` alt çubuğu zaten vardır. Eski dar modal varsayımı kodda doğru değildir.
- Liste ve detail gerçek sayfalardır; detail proje tablosu ve PageHeader içerir. Kart initials fallback kullanır; logo/cover desteği yoktur.
- Organization query key factory/hooks yok; inline `["organizations", page]`, `["organizations", id]`, `["organizations", id, "projects", page]` kullanılır. Project create picker `["organizations", "picker"]` kullanır.
- Project create önce metadata, sonra ayrı logo ve banner upload yapar; başarısız görsel projeyi geri almaz. `usePickedImage` bu dosyanın içinde tanımlıdır; bağımsız paylaşılan hook değildir. Logo/banner picker metinleri Project namespace'ine bağlıdır.
- Edit formunun RHF `values` girdisi query verisinden gelir; media refetch'i kirli metni sıfırlayabilir. Yeni akışta bunu özellikle çözmek gerekir.

İncelenen ana kodlar: `backend/src/main/java/com/pda/project/organization/**`, `ProjectService`, logo/banner servisleri ve controller'ları, `shared/ImageSniffer`, `SecurityBaselineConfiguration`, V21/V34/V47/V49/V51; `frontend/src/features/organizations/**`, project create/picker bileşenleri, `globals.css`, frontend paket scriptleri ve organization domain/service/repository/API/E2E testleri.

## 2. Veri modeli ve ürün kararları

| Alan | Karar ve doğrulama |
| --- | --- |
| name | Mevcut alan; trim sonrası zorunlu, en çok 160 |
| description | Mevcut alan; opsiyonel, en çok 2000, düz metin |
| website | Yeni nullable VARCHAR(2048); mutlak http/https URL, host zorunlu, userinfo ve kontrol karakterleri yasak; dış URL backend tarafından fetch edilmez |
| contactEmail | Yeni nullable VARCHAR(254); backend email validation + uzunluk; iletişim bilgisi, hesap/davet kimliği olarak kullanılmaz |
| location | Yeni nullable VARCHAR(200); trim, düz metin; geocoding yok |
| notes | Eklenmeyecek: mevcut 2000 karakter açıklamadan farklı bir ürün amacı/erişim kapsamı yok; ikinci serbest metin alanı veri ve UX tekrarına yol açıyor |
| logo/cover | Binary/base64 yok; DB'de yalnız server-generated key/reference, doğrulanmış content type, byte size ve version |

Opsiyonel boş/yalnız boşluk alanları null olarak normalize edilir. Backend/domain ve frontend karakter sayımı mevcut Java/JS UTF-16 uzunluk standardını paylaşır. URL ve email uzunlukları normalize etmeden önce de sınırlanır; eski client'ın eksik yeni alanları null kabul edilir. PUT metadata tam değiştirme semantiğinde kalır; görsel alanları metadata isteğine alınmaz. Media mutation yalnız kendi alanını değiştirir.

İletişim alanları owner-only organization ekranında görünür; "public contact" ifadesi internetten anonim erişim açmak anlamına gelmez. Yeni public profil, üyelik veya admin modeli eklenmez.

## 3. Storage kararı ve onay sınırı

**Kullanıcı kararı (2026-10-04):** private dosya storage + Docker persistent volume; V1'de S3/MinIO eklenmeyecek. Storage path ENV ile configurable olacak. Abstraction ileride S3/MinIO adapter eklenmesine izin verecek. Upload validation, authorization, replace/delete cleanup ve container restart sonrası kalıcılık test edilecek. Backend/DB yalnız metadata ve internal object reference tutacak.

Organization için şu an BYTEA görsel tablosu veya mevcut görsel verisi yok; dolayısıyla taşınacak organization binary verisi bulunmuyor. Yeni organization görselleri doğrudan dosya storage kullanacak. Mevcut Project/User BYTEA görsellerinin taşınması bu kararın kapsamına alınmaz.

Prompt organizasyon logo/cover desteğini açıkça kapsıyor. SECURITY §18 ve §19 gereği yeni disk storage güvenlik mimarisi kullanıcıya bildirilir ve seçim kesinleştirilir; ENV ekleme/değiştirme için §3'ün ayrıca somut onay gereksinimi uygulanır. Plan aşamasında `.env`, `.env.example`, Compose veya SECURITY değiştirilmez.

Karar: `shared` içinde yalnız teknik `MediaStorage` portu ve private filesystem adapter; organization use-case/lifecycle Project modülünde kalır. Java NIO ile yeni dependency gerektirmez. Dosyalar web public klasörüne veya container'ın geçici writable layer'ına yazılmaz. Planlanan ENV `ORGANIZATION_MEDIA_STORAGE_PATH`; Spring property `pda.organization.media.storage-path`, host default `.local/organization-media`, Compose container default `/app/organization-media`. Named volume `pda_organization_media`, aynı configured container path'e mount edilir; environment değeri ile mount hedefi aynı olmalıdır. Bu yeni ENV'nin amacı kullanıcı tarafından açıkça onaylanan configurable storage path'tir. Uygulama Task 1'de exact diff'i gösterip config tutarlılığını doğrular; gerçek `.env` dosyasına içerik yazılması gerekiyorsa ayrıca somut onay alınır. Testler ayrı geçici kök kullanır; mevcut secret konfigürasyonu değişmez.

Local volume tek backend instance için uygundur; çok host deployment veya ephemeral hosting için kalıcı paylaşılan storage gerekir. Production hosting henüz TBD. İleride S3/MinIO seçilirse port korunur; adapter/config/dependency/credential kararları o görevin kapsamında alınır. Proje logo/banner ve profil fotoğrafı BYTEA'dan taşınmaz; mevcut davranışlarının regresyonu test edilir.

### Güvenli lifecycle

1. Actor/aktif organization kontrolü ve validation; key yalnız sunucuda UUID ile üretilir.
2. Yeni object için DB'de PENDING kayıt ayrı kısa transaction ile kalıcılaştırılır; sonra media kayıt kilidi altında geçici dosyaya bounded write ve aynı filesystem'de atomic publish yapılır. Cleanup `SKIP LOCKED` ile devam eden IO işlemini atlar.
3. Organization row lock altında güncel actor/aktiflik yeniden kontrol edilir; yeni key/version ACTIVE yapılır, önceki key aynı transaction'da DELETE_PENDING olur. Eşzamanlı logo/cover ve metadata güncellemeleri veri kaybetmez.
4. Commit sonrası eski object kaldırılır. Delete başarısızsa kalıcı DELETE_PENDING işinde retry yapılır; başarılı yeni görsel geri alınmaz.
5. Upload/publish/DB commit hatasında eski reference korunur; yeni object PENDING üzerinden temizlenir. Süreç crash'inde kalıcı kayıt ve bounded süreli sweeper sahipsiz objectleri temizler; halen devam eden upload lease'i ve canlı reference silinmez.
6. Remove reference/version'ı atomik temizler, object deletion işini kalıcı kaydeder; tekrar silme idempotent. Scheduler sadece kayıtlardaki güvenli server key'leriyle çalışır, kullanıcının path'ini taramaz.

Önerilen `organization_media_objects` tablosu object key, organization UUID, kind LOGO/COVER, MIME, size, lifecycle state, created/updated/lease zamanlarını tutar. Final kolon/constraint isimleri Task 2'de tanımlanır. DB ve dosya sistemi tek ACID transaction değildir; yalnız after-commit callback cleanup için yeterli değildir. Crash/rollback/retry testleri zorunludur.

Arşiv **silme değildir**: mevcut arşiv davranışı korunur; medya DB referansıyla tutulur, aktif organization API üzerinden erişilemez. Referanslı arşiv medyası orphan değildir. Bu task yeni hard-delete endpoint'i eklemez. Media DELETE ve replace cleanup uygulanır; gelecekte hard-delete eklendiğinde organization silinmeden kalıcı deletion işi yazılması gerekir. SQL cascade tek başına disk dosyası silmez. Deployment dokümanı DB + volume birlikte backup/restore gereksinimini açıklar.

## 4. Planlanan API sözleşmesi

Kök: `/api/v1/organizations`. Actor yalnız authenticated principal'dan; owner ID ve storage key request'ten kabul edilmez. Görsel okumaları da aktif organizasyon sahibine ait, anonymous public URL yok.

| Method / yol | Girdi | Başarı | Kapsam |
| --- | --- | --- | --- |
| POST / | name, description?, website?, contactEmail?, location? JSON | 201 genişletilmiş OrganizationResponse | authenticated; actor owner olur; CSRF |
| GET /, GET /{id} | mevcut pagination / UUID | 200 metadata + logoVersion/coverVersion nullable | mevcut owner scope |
| PUT /{id} | metadata JSON; null opsiyoneli temizler | 200 güncel response | aktif owner + CSRF |
| PUT /{id}/logo | multipart `file`, PNG/JPEG/WebP, 524288 byte | 204 | aktif owner + CSRF |
| PUT /{id}/cover | multipart `file`, PNG/JPEG/WebP, 2097152 byte | 204 | aktif owner + CSRF |
| DELETE /{id}/logo, /{id}/cover | body yok | 204, yoksa da idempotent | aktif owner + CSRF |
| GET /{id}/logo, /{id}/cover | `?v=<version>` cache busting | 200 doğrulanmış image MIME | aktif owner |
| POST /{id}/archive | mevcut body yok | 204 | mevcut owner + CSRF |

Response storage key/path ve binary döndürmez. Yeni key opaque UUID version olarak kullanılabilir; final version türü Task 3'te backend/frontend birlikte sabitlenir. Null means yok. Görsel GET `nosniff`, sabit inline filename, sandbox CSP ve `Cache-Control: private, no-store` kullanır; account/logout sonrası uzun süre cache'den özel görsel gösterilmez. Version query eşleşmeyen istekte güncel resource/no-store davranışı açık testle sabitlenir.

Medya hataları ProblemDetail + sabit `ORGANIZATION_MEDIA_*` code; URL/email/text metadata doğrulaması mevcut generic ProblemDetail/invalidFields sözleşmesini korur. 400 validation; 401 session; 403 foreign owner/CSRF; 404 unknown/archived/no media; 409 yarış veya sürüm çakışması; 503 storage geçici unavailable; servlet limiti aşımında mevcut 400 handling korunur (koddan doğrulanan davranış). Dosya path/secret/stack trace döndürülmez. Safe örnek: `{"name":"PDA Ekibi","website":"https://example.com","contactEmail":"iletisim@example.com","location":"İstanbul, Türkiye"}`.

## 5. Bağımlılık sırası

`Karar/config → domain/schema → metadata API → storage/media API → backend güvenlik/persistence gate → frontend contract/cache → ortak picker/form/header/card → create → edit/detail/list → hedefli E2E → full regression/belgeler`.

Her task'ın alt işleri ve DoD testleri kendi içinde yapılır; bütün testler sona ertelenmez. Aşağıdaki dosyalar önerilen yeni dosyalar dahil uygulama hedefidir, mevcut oldukları iddia edilmez.

## Task 1 — Storage ve sözleşme kararlarını sabitle

Amaç/sıra: DB tasarımından önce kabul edilen storage/erişim/lifecycle kararının exact config sözleşmesi. Prerequisite: kullanıcının alınmış persistent volume/configurable path kararı.
Dosyalar: bu plan; önerilen config diff taslağı, ilgili SECURITY/deployment bölümleri uygulama aşamasında.
Backend/DB/frontend: henüz kod değişikliği yok. Güvenlik: yeni storage/ENV onay sınırı.

- [x] 1.1 Kabul edilmiş filesystem/volume kararını uygulama başlangıcında doğrula; S3/MinIO dependency/servis ekleme.
- [x] 1.2 ORGANIZATION_MEDIA_STORAGE_PATH/property/default/host test kökü, Docker named volume/mount ve container yazma izinlerinin exact diff'ini hazırla; path/ENV ve mount hedefi tutarlılığını test et. Gerçek `.env` dosyasına yazılması gerekiyorsa somut onay al.
- [x] 1.3 Owner-only read/write, archive retention, metadata limitleri ve notes kapsam dışı kararını sabitle.
- [x] 1.4 Crash cleanup, backup/restore ve tek instance sınırını deployment tasarımına bağla.

### Definition of Done
- [x] Uygulayıcının storage/ENV güvenlik kararını tahmin etmesi gerekmiyor; bekleyen onay yok.
- [x] Kabul edilen tasarım DB binary yasağına ve mevcut owner policy'ye uyuyor.

## Task 2 — Domain ve Flyway genişletmesi

Amaç/sıra: metadata/media servislerinin kalıcı veri temeli. Prerequisite: Task 1.
Dosyalar: `project/organization/domain/Organization.java`, yeni media entity/repository, `OrganizationRepository`, yeni `V52__organization_profile_and_media.sql` (numara tekrar kontrol edilecek), domain/repository testleri.
Backend: normalize/validation ve row lock sözleşmesi. Frontend: yok. DB: nullable metadata/reference + lifecycle tablosu; binary yok. Güvenlik: internal keys client'tan alınmaz.

- [x] 2.1 website/contact_email/location nullable alanları ve domain kurallarını ekle; name/description/slug/owner/status davranışını koru.
- [x] 2.2 logo_key/cover_image_key nullable reference ve object metadata/lifecycle tablosunu tanımla; size/type/kind/state CHECK ve cleanup taraması için gerekli indeksleri ekle.
- [x] 2.3 Metadata/media yarışında lost update önlemi için aynı organization row lock stratejisini uygula; owner sabit, archived object etkinleştirilmez.
- [x] 2.4 Eski V51 şemasına örnek organization ekle → yeni migration çalıştır → eski kayıt/null alanlar ve create/read/update round trip'i PostgreSQL üzerinde doğrula.

### Definition of Done
- [x] Domain ve repository Testcontainers testleri geçer; `ddl-auto=validate` başarılıdır.
- [x] Eski migration değiştirilmedi; mevcut kayıt, project FK ve nullable eski client uyumu korundu.

## Task 3 — Metadata API ve validation

Amaç/sıra: frontend ve upload response'un sabit sözleşmesi. Prerequisite: Task 2.
Dosyalar: `CreateOrganizationRequest`, `UpdateOrganizationRequest`, `OrganizationResponse`, `OrganizationController`, `OrganizationService`, Project API error handler ve organization/API testleri.
Backend: yeni metadata; DB: Task 2 kullanılır. Frontend: henüz yok. Güvenlik: owner checks ve input validation.

- [x] 3.1 Create/update/detail/list DTO ve mapper'ları genişlet; response'ta version ver, storage path/key verme.
- [x] 3.2 Domain + Jakarta validation uyumunu kur; HTTP(S) host/credential/control validation, email ve nullable normalization testlerini yaz.
- [x] 3.3 Yeni ProblemDetail code'larını ve OpenAPI örneklerini ekle; foreign owner/global ADMIN reddini koru.
- [x] 3.4 Metadata PUT'ın media reference'ını ezmediğini; eski name/description body'nin kabulünü test et.

### Definition of Done
- [x] Metadata create/update/read ve invalid URL/email/length/anonymous/CSRF/foreign owner testleri geçer.
- [x] Başarı/error/response version türü frontend için net ve geriye uyumludur.

## Task 4 — Private storage, media endpoints ve cleanup

Amaç/sıra: frontend görsel alanlarından önce gerçek upload backend. Prerequisite: Task 3.
Dosyalar: önerilen `shared/MediaStorage.java`, teknik filesystem adapter; `project/organization/application/OrganizationMediaService`, cleanup job; media controller/repository; `SecurityBaselineConfiguration`, `application.properties`, onaylı Compose/Docker config; yeni storage/media testleri.
DB: Task 2 lifecycle kayıtları. Frontend: yok. Güvenlik: private root, MIME, bounded bytes, traversal/symlink, owner + CSRF.

- [x] 4.1 Backend path resolve server key allowlist + normalize/root containment ile çalışsın; client filename/URL/path kullanma, symlink kaçışını reddet; yeni dosyaları atomic publish et.
- [x] 4.2 `ImageSniffer` reuse; boş/type/byte/dimension limitlerini enforce et. Bozuk/truncated görsel testleriyle header doğrulama sınırını göster; mevcut media validator'ını değiştirmek gerekirse ayrı regresyon kapsamıyla değerlendir.
- [x] 4.3 PUT/DELETE/GET logo ve cover endpointlerini uygula; security matcher'larına yalnız exact method/path ekle; mevcut organization 401/CORS davranışını doğrula.
- [x] 4.4 PENDING → ACTIVE → DELETE_PENDING, commit/rollback/crash recovery, lease ve tekrar cleanup lifecycle'ını uygula. Canlı veya aktif upload object'i cleanup tarafından silinmesin.
- [x] 4.5 Storage hata/izin/disk dolu durumunu kontrollü ProblemDetail'a çevir; eski görsel/reference korunmalı. Restart/recreate'da volume verisi kalmalı.
- [x] 4.6 Private image serving headers/fallback/version behavior; archive sonrası erişim engeli ve referanslı retention testleri.

### Definition of Done
- [x] Owner upload/read/remove, foreign org IDOR, anonymous, missing CSRF, spoof MIME, SVG/GIF, empty/size/dimensions ve traversal testleri geçer.
- [x] Replace/remove eski object'i temizler; silme hatası restart sonrası retry edilir; rollback, eşzamanlı upload/archive ve crash senaryolarında canlı dosya kaybolmaz.
- [x] DB'de binary yok; static/public storage yok; ENV/config yalnız onaylanan kapsamda.

## Task 5 — Backend tamamlanma kapısı

Amaç/sıra: frontend'i değişken/eksik backend'e bağlamamak. Prerequisite: Task 4.
Dosyalar: organization unit/repository/API/media testleri, mevcut Project integration ve ModularityTest.
Backend/DB: hata düzeltmeleri; frontend yok. Güvenlik: matrix doğrulaması.

- [x] 5.1 Organization testleri, PostgreSQL migration testleri ve gerçek temp directory storage fault testlerini çalıştır.
- [x] 5.2 Project organization ilişkisi, diğer project manager update, invitations, project logo/banner, profile photo testlerini çalıştır.
- [x] 5.3 ModularityTest ve backend build; storage domain bağımsız kalsın, modüller arası repository/entity import eklenmesin.

### Definition of Done
- [x] Hedefli Maven test/build başarılı, izin verilen endpointler ve error code'ları doğrulandı.
- [x] Frontend task'larını engelleyen API/storage blocker kalmadı.

## Task 6 — Frontend contract, query/cache ve ortak upload altyapısı

Amaç/sıra: form/kartın güvenilir veri ve ortak picker temeli. Prerequisite: Task 5.
Dosyalar: organizations `types.ts`, `api.ts`, `schemas.ts`, yeni `queries.ts`/`hooks.ts`; `components/common` ortak image picker/initial mark; paylaşılan `usePickedImage`; project create logo/banner wrapper'ları ve ilgili testler.
Backend/DB: yok. Güvenlik: mevcut `apiRequest` cookie/CSRF yolu; browser check kaynak değil.

- [x] 6.1 Organization metadata/version/media URL/upload/remove API yardımcıları; metadata JSON'una File/base64 göndermeme.
- [x] 6.2 Typed query key factory: root/list/detail/projects/picker; create/update/media/archive invalidation list/detail/picker'ı kapsasın, diğer owner/session cache izolasyonu korunsun.
- [x] 6.3 `usePickedImage` ortak hook'a çıkar; replace/remove/unmount revoke, error/disabled/drag/keyboard durumlarını ortak picker ile reuse et. Project metinleri wrapper'da, Organization metinleri kendi namespace'inde.
- [x] 6.4 ProjectMark'ın initials/image presentation'ını nötr ortak bileşene ayır veya ortak API ile genişlet; Organization Project entity/helper'ına bağımlı olmasın. Cover validation parametreli ortak image policy kullansın.
- [x] 6.5 Zod trim/limits/URL/email/null serialization backend ile eşlensin; boş dosya ve aynı dosyayı tekrar seçme doğrulansın.

### Definition of Done
- [x] Lint + `npx tsc --noEmit` geçer; project create/logo/banner picker hedefli regresyonu geçer.
- [x] Preview URL cleanup ve query invalidation doğrulanmış; ikinci upload sistem kopyası yok.

## Task 7 — Ortak Organization form/presentation

Amaç/sıra: create ve edit aynı alan/preview üzerinden kurulur. Prerequisite: Task 6.
Dosyalar: `organization-form-page.tsx`, yeni ortak form sections/media draft hook/header; `organization-card.tsx`, EntityCard mevcut slotları; TR/EN/DE messages.
Backend/DB: yok. Güvenlik: contact linkleri allowlisted scheme, düz metin render.

- [x] 7.1 Genel Bilgiler / Kimlik ve Görsel / İletişim ve Bağlantılar sections; notes bölümü yok. RHF kontrollü başlangıç verisi edit kirli alanlarını refetch'te ezmesin.
- [x] 7.2 Existing PageContainer form, lg 7/5 grid, sticky preview, mobile stack ve `data-sticky-actions` çubuğunu koru; Project Create bölüm hiyerarşisine uyum sağla.
- [x] 7.3 Gerçek OrganizationCard logo/cover presentation + ortak OrganizationProfileHeader oluştur; preview aynı presentation'ı gerçek form state'iyle kullansın. Preview link/action inert, sahte ekip/proje sayısı veya navigation yok.
- [x] 7.4 Opsiyonel yardım paneli ve fallback/validation/error/success/loading metinlerinin tümünü üç dilde ekle; long DE metinleri ve uzun URL/ad taşmasını çöz.
- [x] 7.5 Label/description/error bağlantıları, focus ilk hata, keyboard upload, decorative cover ve meaningful logo erişilebilirliğini uygula; mevcut tema token'ları/reduced motion davranışı korunur.

### Definition of Done
- [x] Create/edit ortak form sections ve gerçek kart/header preview kullanıyor; name/description/logo/cover state anında yansıyor.
- [x] Lint/typecheck ve hedefli form/preview Chromium kontrolleri geçer; light/dark ve 390 px'te overflow yok.

## Task 8 — Create orchestration ve partial failure

Amaç/sıra: gerçek metadata/upload tamamlandıktan sonra uçtan uca create. Prerequisite: Task 7.
Dosyalar: Organization form orchestration/hooks, i18n ve organization E2E.
Backend/DB: mevcut yeni API. Güvenlik: created ID yalnız server response'tan.

- [x] 8.1 POST metadata → ID → seçilmiş logo upload → seçilmiş cover upload; double-submit kilidi ve açık saving durumları.
- [x] 8.2 Metadata hatasında upload başlatma; metadata başarı sonrası saved ID sakla, tekrar denemede yeni organizasyon oluşturma.
- [x] 8.3 Logo/cover ayrı sonuçlarını tut; başarısız dosyalar ve local preview korunur; yalnız başarısız upload tekrar denenebilir veya kullanıcı detail'a devam edebilir. Başarılı metadata/logo geri alınmaz.
- [x] 8.4 Tam başarıda query invalidation sonrası mevcut organization detail route'una localized router ile git; partial success alan bazında açık bildirilir.
- [x] 8.5 beforeunload dirty koruması; kaydedilmiş metadata ve kalan upload taslağını doğru ayır; cancel file URL'lerini bırakır.

### Definition of Done
- [x] Full metadata+logo+cover create E2E başarılı; logo başarısı/cover hatası, tersi, iki upload hatası ve retry duplicate create üretmez.
- [x] Metadata tek başına çalışan eski create ve localized success/cancel akışları korunur.

## Task 9 — Edit, detail ve liste entegrasyonu

Amaç/sıra: yeni alanların create dışında kalmaması. Prerequisite: Task 8.
Dosyalar: organization form/detail/list/card/hooks, project organization picker, messages/E2E.
Backend/DB: mevcut yeni API. Güvenlik: owner edit gate yalnız UX; backend enforcement korunur.

- [x] 9.1 Edit'te saved metadata ve mevcut logo/cover göster; yeni file seçimi yalnız local draft, Save ile metadata → media işlemleri. Remove açık confirmation ile işaretlenir ve Save sırasında uygulanır; cancel server'a media mutation göndermez.
- [x] 9.2 Partial save sonrası başarılı alanları baseline'a al, başarısız dosyayı/draft'ı koru; refetch kirli metni resetlemesin. Retry yalnız bekleyen işlemleri gönderir.
- [x] 9.3 Gerçek detail header'da cover/logo/name/description; website/contactEmail/location boş değilse sade iletişim alanı. Kartta yalnız logo/cover/name/description ve mevcut status/date; iletişim yığını yok.
- [x] 9.4 Versioned source ve broken/missing image initials/plain-cover fallback; kaydetme sonrası list/detail/picker adı/görseli taze olsun.
- [x] 9.5 Organization archive ve mevcut project tablosu/erişim/navigasyon davranışını koru; sonradan public/profile/member yönetimi ekleme.

### Definition of Done
- [x] Edit metadata, replace/remove, cancel, partial retry ve dirty/refetch E2E geçer; gerçek list/detail anında tutarlı.
- [x] Foreign owner/global ADMIN edit/upload/delete reddi ve archive 404 davranışı doğrulanmıştır.

## Task 10 — Frontend QA ve bütünleşik regresyon

Amaç/sıra: tüm yüzey tamamlandıktan sonra ürün kabulü. Prerequisite: Task 9.
Dosyalar: `e2e/13-organizations.spec.ts`, yeni organization media/failure specs; ilgili mevcut project/logo/banner/profile/localized/chat specs.
Backend/DB: yalnız testte bulunan hata düzeltmeleri. Güvenlik: gerçek API güvenlik testleri mock'la değiştirilmez.

- [x] 10.1 Create metadata/media/local preview/card; edit existing/replace/remove; invalid URL/email ve file; partial failure/retry; missing/broken media testleri.
- [x] 10.2 TR/EN/DE, light/dark, 320/390/768/1280/1440 px; keyboard-only/focus/errors, sticky actions/chat dock overlap, reduced motion ve browser console kontrolü.
- [x] 10.3 Organization owner scope, project ilişki/davet, project create logo/banner, profile photo, session expiry/CSRF, localized routes ve sidebar regresyonu.
- [x] 10.4 `npm run lint`, `npx tsc --noEmit`, `npm run build`, hedefli Playwright; görselleri Chromium screenshot ile incele.

### Definition of Done
- [x] Yeni kritik senaryolar gerçek backend ile geçer; mock yalnız hata enjeksiyonu için kullanılır ve başarı API gate'inin yerine geçmez.
- [x] UI QA bulguları giderilmiş; çalıştırılmayan tarayıcı/senaryolar raporda açık.

## Task 11 — Full gate, kalıcı belgeler ve teslim

Amaç/sıra: bitmiş implementation'ın kanıtlı teslimi. Prerequisite: Task 10.
Dosyalar: bu plan, ilgili SECURITY/API/database/architecture/folder/deployment/design belgeleri, master checklist'in etkilenen bölümü; `docs/compliation/README.md` biçiminde tarihli completion kaydı.

- [x] 11.1 Full backend Maven tests/build + ModularityTest ve full frontend Playwright; ardından gerçek `pre-push/pre-push.cmd` kalite kapısı.
- [x] 11.2 Servis/port kullanımını incele; QA servisi yeniden başlatacaksa mevcut session yetkisini kontrol et, gerekli somut onayı al; test sonrası dev düzenini geri getir.
- [x] 11.3 Volume backup/restore ve container recreate persistence kanıtı; production çok host/deployment sınırlarını belgeye yaz.
- [x] 11.4 SECURITY §11 method/path/body/auth/scope/success/errors ve Swagger kontrolünü, §18 onaylı organization storage kararını güncelle; `.env` dosyasına izinsiz dokunma.
- [x] 11.5 Master checklist yalnız etkilenen responsive/states/validation/keyboard/focus/alt-text noktaları açısından gözden geçirilir; kısmi doğrulama proje geneli maddeyi tamamlamaz.
- [x] 11.6 Completion kaydına kapsam/dosyalar/komutlar/gerçek sonuçlar/kalan işler/manuel create-edit-media-archive kontrolünü yaz; kullanıcıya kayıt yolunu ver.

### Definition of Done
- [x] Full gate açıkça `PDA PRE-PUSH CHECK PASSED` verir; blocker/test hatası kalmamış veya teslim tamamlanmadı olarak açık yazılmıştır.
- [x] Bütün checkbox'lar yalnız gerçek implementation/test kanıtıyla güncellenmiştir; commit/push/staging yapılmamıştır.

## 6. Doğrulama komutları ve plan aşaması raporu

Uygulama aşamasında repo kökünden: `mvn -f backend/pom.xml test` ve gerekli backend package/verify kapısı; Java/Maven yoksa mevcut pre-push Docker test mekanizması kullanılır. ModularityTest gerçek sınıf yolu incelenerek çalıştırılır. Testcontainers Docker erişimi ve özel temp storage test ayarları production volume'den ayrı tutulur.

Frontend dizininde: `npm run lint`, `npx tsc --noEmit`, `npm run build`, `npx playwright test e2e/13-organizations.spec.ts` + eklenecek organization media specs; finalde `npx playwright test`. Repo kökünden `cmd /c pre-push\pre-push.cmd` (gerçek dizin `pre-push`, `.pre-push` değil).

İlk plan aşamasında test/build veya servis restart yapılmadı; henüz uygulanmamış kodun doğrulandığı iddia edilmez. İlk git durumu yalnız kullanıcı promptu untracked; mevcut branch `project-service-frontend`. Teslim frontend + backend + DB/config içerir; tek frontend değişikliği değildir. Uygulama sonunda kullanıcının branch/commit ayırma tercihine göre raporlanır; plan aşamasında branch taşınmaz.

### Karar durumu

- [x] Kullanıcı private filesystem + persistent volume + ENV configurable path seçti; V1 S3/MinIO kapsam dışında. Bu işaret yalnız alınmış ürün kararını gösterir; implementation task'ları tamamlanmış değildir.
- Planı engelleyen storage kararı kalmadı. Uygulama kullanıcı tarafından başlatıldı.
