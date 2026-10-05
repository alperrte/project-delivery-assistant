# Organization reference UI and persisted notes

## Teslim ve kapsam

Tarih: 2026-10-05. Durum: **Tamamlandı; tam pre-push başarılı.** Kullanıcının gönderdiği tasarım referansı ve sonrasında istediği kalıcı notes alanı uygulandı. Önceki organization profile teslimini genişletir; frontend + backend + V53 migration içerir. Commit/push/staging yapılmadı.

## Görsel düzen

- Geniş 7/5 kolon, solda tek form yüzeyi; ikonlu Genel Bilgiler / Kimlik ve Görsel / İletişim ve Bağlantılar / Detaylar.
- Logo ve kapak yan yana tile picker. Mobilde tek kolon; mevcut validation, preview/revoke, onaylı kaldırma ve retry akışı korunur. Ortak picker'ın yeni tile varyantı Project'in mevcut görünümünü değiştirmez.
- Sağda centered profile overview, yatay gerçek OrganizationCard ve gerçek ProfileHeader preview; yardım kartı.
- Token tabanlı mavi/violet/amber vurgu ve mavi oluşturma düğmesi. Varsayılan dekoratif SVG cover upload seçilince değişir; ayrı dosya veya upload edilmiş gibi veri üretmez. Bu fallback Organization'a özeldir; Project'in mevcut fallback'i korunur.
- Organization liste kartı aynı yatay identity presentation'ını kullanır; gerçek kart link/date ile, form preview'si inert gösterilir. ProfileHeader detail ve preview'de ortaktır.
- Description kısa açıklama olarak kalır. Notes ayrı, opsiyonel ve kaydedilen alandır; create/edit formunda ve gerçek detail'da gösterilir. Özel notlar kart preview'sine taşınmaz.

## Notes sözleşmesi

`V53__organization_notes.sql`: nullable `organizations.notes VARCHAR(1000)`. V52 değiştirilmedi. Domain, Create/Update DTO, response, service/controller, frontend schema/serializer ve TR/EN/DE güncellendi. Trim ve whitespace→null uygulanır; 1000 karakter sınırı hem domain/DTO hem istemcidedir. Notes düz metin render edilir. Mevcut owner/CSRF kapsamı korunur. Metadata PUT tam profil semantiğinde olduğundan eksik/boş notes null yapar; media mutation notes'a dokunmaz.

API: POST `/api/v1/organizations` JSON name/description?/website?/contactEmail?/location?/notes? → 201; PUT `/api/v1/organizations/{id}` aynı JSON → 200; GET list/detail notes'ı nullable döner. Auth cookie + organization owner; mutation CSRF. 400 validation (`invalidFields`), 401 session, 403 owner/CSRF, 404 missing/archived. Güvenli örnek: `{"name":"Example Studio","description":"Short summary","notes":"Additional information"}`. Swagger mevcut `API_DOCS_ENABLED=true` ayarında `/swagger-ui/index.html` / `/v3/api-docs`; bu görev gerçek .env ayarını değiştirmedi. Medya API sözleşmesi önceki teslim ve SECURITY §11'deki gibi korunur.

## Dosyalar

- `organization-form-page.tsx`, `organization-card.tsx`, `organization-profile-header.tsx`, yeni `organization-cover.tsx`, `organization-detail.tsx`.
- `components/common/image-picker.tsx` (tile), `entity-cover.tsx` (opsiyonel fallback).
- Organization types/schema/API, TR/EN/DE, ilgili E2E seçicileri.
- Organization entity/service/request/response/controller, V53; domain/repository/API/migration testleri.
- İlgili SECURITY/API/database/design ve etkilenmiş web checklist kapsam notu.

## Doğrulama

- Notes domain/repository/migration/API + Modularity hedefli Maven: geçti. 1000 kabul / 1001 reddi, trim/blank, description bağımsızlığı, gerçek DB roundtrip (EntityManager.clear), V51→V52→V53 legacy korunumu, foreign owner reddi doğrulandı.
- 33 hedefli Chromium testi: geçti (organizations, yeni profile/notes, project create ve banner). Actual success backend ile; mock yalnız upload failure injection için.
- Son tam kapı: `cmd /c pre-push\pre-push.cmd` → `PDA PRE-PUSH CHECK PASSED`. Backend 415 test, 0 fail/error/skip; Chromium 180 passed + 1 expected skip (production controlled crash route kapalı). Log `.local/organization-reference-pre-push.log` Git dışındadır.
- Final lint/typecheck/production build: geçti.
- Chromium screenshot: son koyu/açık görseller incelendi. TR/EN/DE, light/dark, 320/390/768/1280/1440 px, keyboard/reduced motion ve partial retry kontrolleri. 1536×1024 referans görünümü ayrıca incelendi.
- Servisler: backend UP; Next dev 3000 portunda geri açıldı, `/tr` HTTP 200. Kalıcı volume korundu.
- `git diff --check`: temiz. Ben staging işlemi yapmadım; son kontrol index'te önceden stage edilmiş değişiklikler olduğunu gösterdi. Index korundu. Son UI/notes düzeltmelerinin bir kısmı unstaged, V53/cover/yeni rapor untracked durumda; commit öncesi son dosyalar ayrıca gözden geçirilmeli.

İlk yeni notes testinde eksik `assertNull` import'u temiz derleme sırasında bulundu ve düzeltildi; başarısız sonuç final gate olarak sayılmaz.

## Sınırlar

Firefox/WebKit ve gerçek cihaz testleri çalıştırılmadı. Dekoratif cover, kullanıcı yüklemesi değildir; default artwork'tür. Mevcut organization erişimi owner-only'dir; üyelik/rol/public profil modeli eklenmedi. API/storage mimarisi, kalıcı volume ve güvenlik modeli önceki teslimdeki gibidir.

## Manuel kontrol

1. Yeni organization sayfasını dark/light açın; referans düzenindeki dört bölüm, yan yana picker, sağdaki üç preview ve mavi oluşturma düğmesini kontrol edin.
2. Ad/description ve logo/cover değiştirin; üç preview anında değişmeli. Mobilde alanlar taşmamalı ve kaydetme düğmesi erişilebilir olmalı.
3. Ek notlar yazıp oluşturun. Detail'da ayrı görünmeli; edit açınca aynı notes gelmeli. Description'dan bağımsız değiştirip Save edin, sayfayı yeniden yükleyin.
4. Edit'te notes değiştirip Vazgeçin: kayıt değişmemeli. Boşaltıp Save edin: notes null olmalı. Counter ve 1000 sınırını kontrol edin.
5. Görsel değiştir/kaldır/onay/vazgeç ve kısmi upload retry akışlarını kontrol edin. Mevcut Project oluşturma görünümü ve sohbet dock/Save yerleşimi korunmalı.
