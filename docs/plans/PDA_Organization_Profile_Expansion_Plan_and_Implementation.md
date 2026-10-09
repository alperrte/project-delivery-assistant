# PDA — Organization Profile Expansion & Create Page Redesign

Bu dosya iki aşamalı çalışma için hazırlanmıştır:

1. **Claude Opus + Plan Mode** → repository'yi inceleyip teknik bağımlılık sırasına göre plan oluşturacak.
2. **Claude Sonnet** → Opus'un oluşturduğu planı source of truth kabul edip sırayla implement edecek.

---

# 1) Opus Plan Mode İçin Nihai Prompt

# PDA — Organization Profile Expansion & Create Page Redesign

PDA (Project Delivery Assistant) projesindeki Organization özelliğini genişleteceğiz.

Bu çalışma yalnızca frontend redesign değildir.

Yeni Organization Create tasarımında kullanılacak bazı alanların şu anda backend/database desteği bulunmuyor. Bu yüzden önce repository'yi tamamen incele, mevcut Organization domain modelini, API'lerini, file upload/storage altyapısını ve frontend akışını analiz et.

Şu an KOD YAZMA.

Önce bütün işi teknik bağımlılıklarına göre tasklara ayır ve uygulanabilir bir implementation planı oluştur.

Plan daha sonra Claude Sonnet tarafından sırayla uygulanacak.

## En Önemli Çalışma Kuralı

Taskları aşağıdaki gereksinimlerin yazılma sırasına göre körlemesine uygulama.

Önce repository'yi incele ve dependency graph çıkar.

Örneğin:

```text
Database/domain model
↓
Backend DTO/API
↓
Logo/cover upload API
↓
Frontend API contract
↓
Create Organization UI
↓
Preview
↓
Edit Organization
↓
Cache/state
↓
Tests
```

mantıklı olabilir.

Ancak repository'nin gerçek mimarisine göre kesin sıralamayı sen belirle.

Bir task tamamen bitmeden sonraki taska geçilmemeli.

## Plan Dosyası

Repository root'unda:

```text
PDA_ORGANIZATION_PROFILE_EXPANSION_PLAN.md
```

oluştur.

Bu dosya Sonnet implementation aşamasında source of truth olacak.

Her task checkbox formatında olmalı:

```md
## Task 1 — ...

- [ ] 1.1 ...
- [ ] 1.2 ...
- [ ] 1.3 ...

### Definition of Done
- [ ] ...
- [ ] ...
```

Implementation sırasında tamamlanan maddeler:

```md
- [x]
```

olarak güncellenecek.

## Mevcut Organization Mimarisini İncele

Backend tarafında şunları araştır:

- Organization entity/domain
- Organization repository
- Organization service/application layer
- Organization controller
- create/update DTO'ları
- response DTO'ları
- Organization membership modeli
- organization owner/admin yetkileri
- validation
- Flyway migrations
- file/media storage altyapısı
- project logo upload altyapısı
- profile photo upload altyapısı
- MinIO/S3/local storage abstraction varsa
- authorization policies
- organization delete/update davranışı

Frontend tarafında şunları araştır:

- Organizations list page
- Organization create page
- Organization edit/settings page
- Organization card component
- organization API client
- React Query hooks/query keys
- image/media URL helper
- upload components
- project create page
- project logo/cover upload componentleri
- form validation
- i18n translations
- responsive layout
- light/dark theme

Mümkün olduğunca mevcut Project Create altyapısını ve reusable componentleri kullan.

Aynı upload/form/preview sisteminin ikinci bir kopyasını oluşturma.

## Yeni Organization Veri Modeli

Organization şu alanları desteklemeli.

### Zorunlu: name

Organizasyon adı. Mevcut name alanı varsa reuse et.

### Opsiyonel: description

Organizasyonun kısa açıklaması. Mevcut description alanı varsa reuse et.

### Opsiyonel: logo

Organization logo. Project logo/profile photo upload altyapısı varsa aynı storage abstraction'ını kullan. Database'e raw image/blob yazma. Tercihen storage object key/reference tutulmalı.

### Opsiyonel: coverImage

Organization cover/banner image. Project cover image mekanizması varsa reuse et.

### Opsiyonel: website

Valid URL olmalı. Backend ve frontend validation bulunmalı.

### Opsiyonel: contactEmail

Organization'ın public/contact bilgisidir; login/member email değildir. Valid email format kontrolü olmalı.

### Opsiyonel: location

Plain-text konum. Örnek: `İstanbul, Türkiye`. Maps/geocoding veya lat/long ekleme.

### Opsiyonel: notes

Description'dan ayrı ek bilgi/not alanı olarak değerlendir. Repository/product modeline göre gerçekten gerekli değilse sırf mockup'ta vardı diye ekleme; plan içinde kararını gerekçelendir.

## Database Migration

Yeni backend alanları mevcut değilse Flyway migration oluştur.

İhtiyaca göre:

```text
logo_key
cover_image_key
website
contact_email
location
notes
```

gibi kolonlar eklenebilir.

Kurallar:

- mevcut DB naming convention'ı kullanılmalı
- backward compatible olmalı
- mevcut organization kayıtlarını bozmamalı
- optional alanlar nullable olmalı
- uygun string length constraint'leri olmalı
- logo/image binary DB'ye yazılmamalı

## Backend Domain / Entity

Organization entity yeni alanları desteklemeli.

Domain validation kurallarını mevcut mimariye uygun şekilde ekle:

- name boş olamaz
- website invalid URL olamaz
- contactEmail invalid email olamaz
- text alanları max length aşamaz

Validation sadece frontend'e bırakılmamalı.

## API Contract

Organization create/update/detail API'lerini incele ve gerekli DTO'ları genişlet.

Kavramsal metadata örneği:

```json
{
  "name": "x-etc",
  "description": "Yazılım projelerimizi yönetiyoruz.",
  "website": "https://example.com",
  "contactEmail": "iletisim@example.com",
  "location": "İstanbul, Türkiye",
  "notes": "..."
}
```

Logo/cover upload multipart ise ana JSON request'e base64 ekleme. Mevcut Project upload pattern'ini takip et.

## Organization Logo Upload

Organization logo upload desteği ekle.

Mevcut reusable media service/storage kullan.

Repository architecture uygunsa kavramsal olarak:

```text
POST /api/.../organizations/{organizationId}/logo
DELETE /api/.../organizations/{organizationId}/logo
```

gibi endpointler olabilir; final endpoint mevcut API naming convention'a göre belirlenmeli.

Kurallar:

- yalnız yetkili organization owner/admin değiştirebilmeli
- PNG/JPEG/WebP gibi mevcut güvenli formatlar
- SVG mevcut sistem açıkça güvenli desteklemiyorsa eklenmemeli
- size limiti mevcut Project logo standardıyla uyumlu olmalı
- MIME type sadece client header'a güvenilerek doğrulanmamalı
- storage key server tarafından oluşturulmalı
- yeni logo yüklenince eski object temizlenmeli

## Organization Cover Image Upload

Project cover image sistemi varsa mümkün olduğunca reuse et.

Kavramsal olarak:

```text
POST /api/.../organizations/{organizationId}/cover
DELETE /api/.../organizations/{organizationId}/cover
```

Formatlar PNG/JPEG/WebP olabilir. Boyut limiti repository standardına göre belirlenmeli. Server-generated object key kullanılmalı. Replace işleminde eski object temizlenmeli.

## Authorization

Logo, cover ve organization profile alanlarının update edilmesi yalnız owner/admin veya mevcut permission modelindeki eşdeğer yetkiyle mümkün olmalı.

IDOR açıkları bırakma. Kullanıcı başka Organization UUID'si göndererek update/upload/delete yapamamalı. Backend source of truth olmalı.

## Organization Create Akışı ve Upload Sırası

Organization create edilmeden `organizationId` bulunmayabilir.

Şu modelleri repository'ye göre değerlendir:

```text
Create organization metadata
→ organization ID oluşur
→ logo upload
→ cover upload
```

veya mevcut sistem destekliyorsa temporary upload/session mekanizması.

Gereksiz temporary-upload altyapısı oluşturma. Mevcut Project Create nasıl çözüyor incele ve mümkünse aynı yaklaşımı reuse et.

Partial failure senaryolarını planla. Örneğin organization create olup logo başarılı, cover başarısızsa UI doğru bilgi vermeli ve organization bozuk state'te kalmamalı.

## Organization Create Page Redesign

Frontend'i referans tasarıma benzer kaliteye getir.

Project Create sayfasını görsel ve yapısal referans olarak kullan.

Mevcut boş ve dar organization formunu kaldır.

Desktop yaklaşık:

```text
Main content
├── Left: form
└── Right: live preview
```

şeklinde olmalı.

Sayfa genişliği Project Create ile uyumlu olmalı.

## Header

```text
← Tüm organizasyonlar

Yeni organizasyon
Ekibinizi, projelerinizi ve çalışma alanınızı bir organizasyon altında toplayın.
```

Mevcut localized routing/navigation helpers kullan. Hardcoded URL kullanma.

## Genel Bilgiler

```text
Genel Bilgiler
Organizasyonunuzun temel bilgilerini tanımlayın.
```

Alanlar:

- Ad
- Açıklama
- backend ile aynı character limit/count

## Kimlik ve Görsel

```text
Kimlik ve Görsel
Organizasyonunuzun görsel kimliğini belirleyin.
```

İki upload alanı:

- Logo yükle
- Kapak görseli yükle

Mevcut Project upload componentlerini mümkünse reuse/refactor et.

Seçim yapıldığında submit öncesinde local preview görünmeli. `URL.createObjectURL` kullanılıyorsa cleanup yapılmalı.

## İletişim ve Bağlantılar

```text
İletişim ve Bağlantılar
Bu bilgiler organizasyon sayfanızda görünecektir.
```

Alanlar:

- Web sitesi
- E-posta
- Konum

Desktop'ta email/location yan yana, mobile'da stack olabilir.

## Detaylar

Gerekliyse opsiyonel notes textarea ekle. Domain analizinde gereksizse ekleme ve nedenini plan içinde belirt.

## Live Preview

Sağ taraftaki preview gerçek form state'iyle canlı güncellensin.

Hardcoded mock data kullanma.

Preview şunları gösterebilir:

- cover image
- logo
- organization name
- description
- status

Name boşsa `Organizasyon adı`, description boşsa `Henüz açıklama eklenmedi.` gibi fallback kullan.

Logo yoksa mevcut initials/fallback sistemi kullanılmalı.

## Preview Card

Organization list page'deki gerçek karta mümkün olduğunca yakın preview oluştur.

Mümkünse gerçek `OrganizationCard` presentation componentini preview mode/reusable presentation üzerinden kullan. Ayrı sahte tasarım oluşturma.

## Organization Page Header Preview

Repository'de gerçek Organization Detail Page/header architecture varsa cover + logo + organization name + description görünümünü de preview et.

Yoksa sırf mockup'ta vardı diye fake navigation üretme; future scope olarak belirt.

## “Organizasyon nedir?” Bilgi Paneli

Sağ tarafta kısa yardım paneli olabilir. İçerik i18n dosyalarından gelmeli; hardcoded Türkçe text bırakma.

## Create Button

Bottom action area Project Create ile uyumlu olmalı:

```text
Vazgeç                                  Organizasyon oluştur
```

Create sırasında loading/disabled/double-submit prevention olmalı.

Başarı sonrası mevcut ürün akışına uygun list/detail route'una yönlendir.

## Form Validation

Frontend ve backend tutarlı olmalı:

- name required
- description max length
- website valid URL
- email valid email
- location max length
- notes max length
- logo type/size
- cover type/size

Frontend validation backend'in yerine geçmez.

## Organization Edit / Settings

Yeni alanlar yalnız create sayfasında kalmamalı.

Mevcut Organization Edit/Settings varsa şu alanlar yönetilebilmeli:

- name
- description
- logo
- cover
- website
- contactEmail
- location
- notes (planda kaldıysa)

Create ve Edit mümkün olduğunca ortak reusable form/sections kullanmalı. Duplicate implementation oluşturma.

## Organization Cards

Organizations list page'de yeni model destekliyorsa logo/cover/name/description uygun şekilde kullanılabilir. Kartı gereksiz kalabalıklaştırma; website/email/location her kartta görünmek zorunda değil.

## Image Serving ve Security

Mevcut media serving helper/pattern'ini kullan.

Kontrol et:

- allowed MIME types
- actual content/type validation
- max file size
- server-generated filename/key
- path traversal engeli
- SVG güvenliği
- unauthorized upload/delete engeli

Original client filename'i storage key olarak kullanma.

## Cleanup

Organization silinince logo ve cover objectlerinin cleanup davranışını mevcut media strategy ile uyumlu yap. Orphan file bırakma.

## Query / Cache Consistency

Create/edit/logo/cover işleminden sonra ilgili React Query cache'leri güncellenmeli/invalidate edilmeli:

- organization detail
- organizations list
- organization card
- navbar/sidebar organization data varsa

Mevcut query key factory varsa kullan.

## Localization

Tüm yeni UI metinleri mevcut i18n sistemine eklenmeli. Product gerçekten TR/EN/DE destekliyorsa üçü de eksiksiz olmalı.

## Theme / Responsive / Accessibility

Yeni UI:

- dark/light theme uyumlu
- design token kullanmalı
- desktop iki kolon, küçük ekranda responsive stack
- horizontal overflow olmamalı
- label/input association düzgün
- keyboard navigation çalışmalı
- upload controls accessible olmalı
- image alt text ve focus/error states doğru olmalı

## Backend Testleri

En az:

- organization create with new metadata
- update metadata
- invalid URL rejected
- invalid email rejected
- unauthorized update rejected
- logo upload authorized
- logo upload unauthorized
- invalid image rejected
- oversized image rejected
- cover upload
- replace image cleans old media
- delete image
- cross-organization IDOR rejected

## Flyway / Persistence Tests

- existing organization still loads
- nullable new fields work
- create/read/update round trip works

## Frontend / Playwright

Mevcut Playwright altyapısını kullan.

En az şu E2E:

```text
Login
→ Organizations
→ Create Organization
→ enter name
→ enter description
→ website
→ email
→ location
→ select logo
→ select cover
→ live preview updates
→ submit
→ organization created
→ organization card shows correct logo/name
```

Ayrıca:

```text
Open Organization Settings
→ existing values visible
→ change logo
→ save
→ UI immediately reflects new logo
```

ve invalid website validation senaryosu.

## Existing Functionality Regression

Şunlar bozulmamalı:

- organization membership
- project → organization relationship
- invitations
- organization permissions
- organizations list
- project creation
- project logo/cover upload
- profile photo upload
- localized routes
- sidebar navigation
- authentication

## Spring Modulith / Architecture

Backend Spring Modulith kullanıyorsa Organization module boundary'lerini bozma. Media/storage başka modüldeyse public contract üzerinden kullan. Modularity tests geçmeli.

## Task Sıralaması

Plan sonunda kesin implementation order oluştur.

Örnek:

```text
1. Existing architecture analysis
2. Organization domain/schema expansion
3. Backend API/validation
4. Organization media upload backend
5. Backend tests/security
6. Frontend API/types/query integration
7. Reusable Organization form architecture
8. Organization Create redesign
9. Live preview
10. Organization Edit integration
11. Organization list/card integration
12. i18n/theme/responsive/accessibility
13. Playwright/regression
14. Final cleanup
```

Bu yalnız örnektir. Gerçek repository bağımlılıklarına göre final sıra senin kararın olmalı.

Her task için:

- amaç
- neden bu sırada
- prerequisite
- değişecek dosyalar
- backend değişiklikleri
- frontend değişiklikleri
- DB migration
- security etkisi
- edge cases
- test planı
- Definition of Done

belirt.

## Git Güvenliği

Mevcut staged/unstaged kullanıcı değişikliklerini kaybetme.

Kullanma:

```text
git reset --hard
git checkout .
```

Plan dışı değişiklikleri revert etme.

## Opus Final Çıktısı

Final cevabını şu sırayla ver:

1. Existing Architecture Analysis
2. Data Model Decision
3. API / Upload Architecture
4. Dependency / Implementation Order
5. Implementation Checklist
6. Database Changes
7. Backend Changes
8. Frontend Changes
9. Security Risks
10. Validation / Test Plan

## Kritik Kurallar

1. Şu an implementation yapma; önce plan hazırla.
2. Repository'yi okumadan architecture varsayma.
3. Yeni Organization alanlarının backend/database karşılığı olmadan frontend fake field oluşturma.
4. Mevcut Project logo/cover/media altyapısını mümkün olduğunca reuse et.
5. Image'ı base64 olarak organization JSON'una koyma.
6. Image binary'yi doğrudan Organization tablosuna yazma.
7. Upload security backend'de zorunlu.
8. Organization authorization backend'de enforce edilmeli.
9. IDOR koruması zorunlu.
10. Create sırasında image upload sırasını doğru tasarla.
11. Partial failure senaryolarını hesaba kat.
12. Organization Create ve Edit mümkün olduğunca ortak form altyapısı kullanmalı.
13. Preview gerçek form state'inden beslenmeli.
14. Fake/mock preview data bırakma.
15. Logo/cover yoksa düzgün fallback kullan.
16. React Query cache tutarlı güncellenmeli.
17. TR/EN/DE i18n eksiksiz olmalı.
18. Dark/light ve responsive davranış test edilmeli.
19. Existing Organization/Project functionality regression oluşturmamalı.
20. Spring Modulith boundaries bozulmamalı.
21. Her task checkbox formatında olmalı.
22. Her task için Definition of Done olmalı.
23. Sonnet taskları sırayla uygulayabilmeli.
24. Bir task tamamlanmadan checkbox `[x]` yapılmamalı.
25. Final full regression tamamlanmadan iş bitmiş sayılmamalı.

---

# 2) Sonnet Implementation Prompt

Repository root'undaki:

```text
PDA_ORGANIZATION_PROFILE_EXPANSION_PLAN.md
```

dosyasını tamamen oku.

Bu dosya implementation için source of truth'tur.

Şimdi planı IMPLEMENT ET.

## Çalışma Kuralı

Taskları Opus'un belirlediği sırayla uygula.

Sıralamayı değiştirme.

Bir task tamamen bitmeden sonraki taska geçme.

Her alt task tamamlandığında:

```md
- [ ]
```

checkbox'ını:

```md
- [x]
```

olarak güncelle.

Definition of Done tamamlanmadan ana taskı `[x]` yapma.

Blocker varsa:

```md
- [ ] ... — BLOCKED: sebep
```

şeklinde açıkça bırak.

Benden tasklar arasında onay bekleme.

## Backend

Plan doğrultusunda Organization modelini genişlet.

Gerekli Flyway migration'larını ekle.

Metadata alanları, logo ve cover image desteğini backend'de gerçek şekilde uygula.

Mevcut media/storage abstraction'ını reuse et.

Authorization ve IDOR kontrollerini backend'de enforce et.

Image upload'larda:

- güvenli MIME/content doğrulaması
- size limit
- server-generated key
- replace cleanup
- delete cleanup

uygula.

## Frontend

Organization Create sayfasını yeni tasarıma göre uygula.

Project Create sayfasının kalite seviyesini ve mevcut design system'i referans al.

Beklenen ana yapı:

```text
Yeni organizasyon

LEFT
- Genel Bilgiler
- Kimlik ve Görsel
- İletişim ve Bağlantılar
- Detaylar (planda kaldıysa)

RIGHT
- Live organization preview
- Organization card preview
- gerekiyorsa organization page/header preview
- Organizasyon nedir? yardım alanı
```

Preview form state ile gerçek zamanlı güncellensin.

Logo ve cover seçildiğinde submit öncesinde de local preview görülebilsin.

## Create / Edit Reuse

Organization Create ve Organization Edit/Settings aynı reusable form sections/componentlerini mümkün olduğunca kullansın.

Duplicate form oluşturma.

Yeni Organization alanları Settings/Edit ekranında da gösterilmeli ve düzenlenebilmelidir.

## API / Cache

Yeni metadata ve media API contractlarını frontend types/API client/query hooks'a ekle.

Mutation sonrası ilgili organization query/cache'lerini invalidate/update et.

Stale logo/cover/name bırakma.

## i18n / Theme / Responsive

Yeni bütün UI metinlerini mevcut translation sistemine ekle.

TR/EN/DE tamamlanmalı.

Dark/light theme uyumlu olmalı.

Desktop iki kolon, küçük ekranlarda responsive stack olmalı.

## Test Akışı

Her ana task sonrası ilgili testleri çalıştır.

Backend'e dokunulan aşamalarda:

- unit tests
- integration tests
- authorization/security tests
- Flyway/persistence tests
- ModularityTest
- backend build

Frontend aşamalarında:

- lint
- type-check
- production build
- ilgili Playwright specs

çalıştır.

En son full regression çalıştır.

## Checkbox Disiplini

Her task sonrası:

1. implementation
2. test
3. hata düzeltme
4. Definition of Done doğrulama
5. checkbox `[x]`
6. sonraki task

sırasını kullan.

Test geçmeden taskı tamamlandı işaretleme.

## Git Güvenliği

Kullanıcının mevcut staged/unstaged kodunu kaybetme.

Kullanma:

```text
git reset --hard
git checkout .
```

Plan dışı değişiklikleri revert etme.

## Final Rapor

Finalde:

### Checklist

Plan dosyasındaki final `[x]` durumunu göster.

### Database

Eklenen migration ve alanları yaz.

### Backend

Organization metadata + logo/cover upload + security değişikliklerini özetle.

### Frontend

Create/Edit/Preview değişikliklerini özetle.

### Media

Logo/cover lifecycle'ını açıkla.

### Security

Authorization, IDOR ve file validation sonuçlarını yaz.

### Changed Files

Önemli dosyaları listele.

### Tests

Çalıştırılan tüm test/build komutları ve sonuçları yaz.

### Remaining Issues

Bir şey kaldıysa açıkça belirt.

Hiçbir blocker kalmadıysa:

```text
Kalan blocker yok.
```

yaz.

## Kritik Kurallar

1. Opus planı source of truth.
2. Taskları sırayla uygula.
3. Bir task bitmeden diğerine geçme.
4. Checkbox'ları gerçek durumla güncelle.
5. Backend olmadan fake frontend feature bırakma.
6. Organization media için mevcut storage sistemini reuse et.
7. Upload security'yi atlama.
8. IDOR/authorization backend'de enforce edilmeli.
9. Create/Edit formlarını gereksiz duplicate etme.
10. Preview gerçek state kullanmalı.
11. Cache stale kalmamalı.
12. Existing Organization/Project davranışlarını bozma.
13. Modulith boundaries bozma.
14. Full regression geçmeden işi bitmiş sayma.
