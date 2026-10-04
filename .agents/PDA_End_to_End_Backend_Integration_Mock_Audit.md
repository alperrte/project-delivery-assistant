# PDA — End-to-End Backend Integration & Mock Audit

PDA projesinde son iki büyük task tamamlandı.

Şimdi senden yeni feature geliştirmeni istemiyorum.

Amacım:

> Son yapılan Organization Profile Expansion / Organization Create-Edit geliştirmeleri ile hemen önceki chat persistence + project settings logo fixlerinin gerçekten backend'e bağlı olup olmadığını, gerçek API endpointleri kullanıp kullanmadığını, mock/fake/local-only implementation kalıp kalmadığını ve frontend ile backend sözleşmesinin gerçekten çalıştığını doğrulamak.

Repository'yi detaylı şekilde incele ve gerçek kanıtlarla audit yap.

Kod yazmaya hemen başlama.

Önce mevcut implementation'ı analiz et, sonra bulguları raporla.

Sadece gerekli ve kesin bir bug/integration eksikliği bulursan düzeltme öner.

---

# İncelenecek Kapsam

## A — Organization Profile Expansion

Şunların gerçekten backend'e bağlı olup olmadığını doğrula:

- organization name
- description
- notes
- website
- contact email
- location
- logo
- cover image
- create organization
- update/edit organization
- organization detail
- organization list/card
- organization preview
- logo replace/remove
- cover replace/remove

Her bir alan için şunu kanıtla:

```text
Frontend input/state
→ frontend API call
→ HTTP method + endpoint
→ backend controller
→ request DTO
→ service/application layer
→ entity/repository
→ database column/table
→ response DTO
→ frontend query/cache
→ rendered UI
```

Zincirde kopuk bir halka varsa açıkça belirt.

---

# B — Organization API Endpoint Audit

Repository'den gerçek endpointleri çıkar.

Örneğin varsa:

```text
POST   /api/v1/organizations
GET    /api/v1/organizations
GET    /api/v1/organizations/{id}
PUT    /api/v1/organizations/{id}

PUT    /api/v1/organizations/{id}/logo
GET    /api/v1/organizations/{id}/logo
DELETE /api/v1/organizations/{id}/logo

PUT    /api/v1/organizations/{id}/cover
GET    /api/v1/organizations/{id}/cover
DELETE /api/v1/organizations/{id}/cover
```

Ancak tahmin etme.

Gerçek controller mapping'lerinden çıkar.

Final raporda her endpoint için:

- method
- path
- auth requirement
- request type
- response type
- frontend'de nereden çağrıldığı
- gerçekten kullanılıyor mu
- dead/unreferenced mı

yaz.

---

# C — Database Persistence Audit

Organization için eklenen yeni alanların gerçekten DB'ye persist edildiğini doğrula.

Kontrol et:

- Flyway migration
- table/column names
- nullable/constraint yapısı
- entity mappings
- repository persistence
- update behavior
- old organization records compatibility

Özellikle şunları doğrula:

```text
website
contact_email
location
notes
logo reference
cover reference
```

Frontend'de görünen ama DB'de olmayan alan varsa bunu kritik bulgu olarak işaretle.

---

# D — Media Storage Audit

Organization logo ve cover için:

- BYTEA mı kullanılıyor?
- filesystem mi?
- persistent Docker volume mı?
- local temp path mi?
- public/static folder mı?
- in-memory/mock mı?

gerçek implementation'ı bul.

Şunları kanıtla:

```text
frontend upload
→ multipart request
→ backend endpoint
→ validation
→ storage abstraction
→ filesystem adapter
→ persistent path
→ DB media metadata/reference
→ frontend GET/render
```

Ayrıca:

- replace cleanup
- remove cleanup
- restart persistence
- orphan cleanup
- storage path ENV
- Docker volume mapping

gerçekten uygulanmış mı kontrol et.

Plan dosyasına bakıp "uygulanması gerekiyordu" deme.

Gerçek kodu kontrol et.

---

# E — Mock / Fake / Placeholder Audit

Repo genelinde son tasklarla ilgili şu kalıntıları ara:

```text
mock
fake
dummy
placeholder
hardcoded
TODO
FIXME
temporary
stub
sample
preview-only
local-only
setTimeout
Math.random
```

Ama string aramasıyla yetinme.

Şu tip durumları da incele:

- frontend'in API yerine local state'ten data uydurması
- preview'nin hardcoded veri göstermesi
- upload'ın sadece `URL.createObjectURL` ile görünüp server'a gitmemesi
- success toast gösterilip gerçek request yapılmaması
- settings page'in gerçek API yerine cached/mock object kullanması
- organization card'ın fake logo/cover kullanması
- backend endpoint var ama frontend hiç çağırmıyor
- frontend çağrı yapıyor ama endpoint yok
- endpoint var ama DB'ye persist etmiyor

Bulduğun her mock/fake davranışı sınıflandır:

```text
INTENTIONAL
DEV-ONLY
TEST-ONLY
UNINTENTIONAL / BUG
```

---

# F — Frontend API Integration

Organization frontend dosyalarında:

- api client
- hooks
- React Query
- mutation
- query keys
- cache invalidation
- form submit handlers
- image upload handlers

incele.

Şunları doğrula:

```text
Create form
→ real POST

Edit form
→ real PUT/PATCH

Logo upload
→ real multipart request

Cover upload
→ real multipart request

Remove logo
→ real DELETE

Remove cover
→ real DELETE
```

Eğer herhangi biri sadece UI state değiştiriyorsa bunu açıkça belirt.

---

# G — React Query / Cache Audit

Mutation sonrası doğru cache'lerin güncellendiğini doğrula.

Özellikle:

- organizations list
- organization detail
- organization card
- organization picker
- organization settings
- sidebar/header varsa
- logo/cover version/source

stale kalıyor mu kontrol et.

Sadece invalidate çağrısı var diye yeterli sayma.

Gerçek query key'lerle eşleşiyor mu kontrol et.

---

# H — Project Settings Logo Fix Audit

Önceki tasktaki:

```text
Projects
→ project card edit icon
→ Project Settings
→ existing logo visible
```

fix'ini doğrula.

Kontrol et:

- settings page gerçekten backend'den mevcut project logo bilgisini alıyor mu
- sadece Projects page'deki local state'i mi kullanıyor
- logo URL gerçek API endpointinden mi geliyor
- fallback doğru mu
- logo update sonrası settings/card/header güncelleniyor mu
- reload sonrası logo hâlâ görünüyor mu

Reload testi özellikle önemli.

Eğer logo sadece client cache'de görünüyorsa bug say.

---

# I — Minimized Chat Persistence Audit

Önceki tasktaki chat persistence fixini doğrula.

Kontrol et:

```text
open chat
→ minimize
→ navigate inside same project
→ minimized chat remains
```

Şunları incele:

- ChatProvider mount location
- layout ownership
- route change behavior
- selected project change behavior
- explicit close behavior
- logout
- websocket lifecycle
- duplicate connection/subscription

Bunun yalnız UI trick olmadığını doğrula.

Örneğin:

```text
sessionStorage/local state hack
```

kullanılıyorsa bunun doğru lifecycle ile uyumlu olup olmadığını incele.

---

# J — Endpoint ↔ Frontend Mapping Table

Final raporda zorunlu olarak tablo oluştur.

Örnek format:

| Feature | Frontend file | API call | Backend endpoint | DB persistence | Status |
|---|---|---|---|---|---|
| Org create | ... | POST ... | ... | yes | CONNECTED |
| Org notes | ... | ... | ... | ... | ... |
| Org logo | ... | ... | ... | ... | ... |
| Org cover | ... | ... | ... | ... | ... |
| Project settings logo | ... | ... | ... | ... | ... |
| Chat persistence | ... | n/a | provider/layout | n/a | ... |

Status sadece şu değerlerden biri olsun:

```text
CONNECTED
PARTIAL
MOCK
BROKEN
DEAD CODE
TEST-ONLY
```

---

# K — Runtime Verification

Mümkünse sadece static code inspection ile yetinme.

Mevcut local test ortamını kullanarak gerçek runtime doğrulama yap.

Özellikle:

## Organization Create

```text
create organization
→ fill all metadata
→ upload logo
→ upload cover
→ submit
→ reload page
→ data still present
```

## Organization Edit

```text
open existing org
→ update notes/location
→ replace logo
→ save
→ reload
→ changes still present
```

## Remove Media

```text
remove logo
→ save
→ reload
→ fallback visible
```

## Project Settings Logo

```text
open settings
→ logo visible
→ hard reload
→ still visible
```

## Chat Persistence

```text
open chat
→ minimize
→ Tasks
→ Calendar
→ Teams
→ still visible
→ close X
→ navigate
→ does not reappear
```

---

# L — Network-Level Verification

Playwright veya mevcut test infrastructure izin veriyorsa request-level assertion yap.

Özellikle:

- create sırasında gerçek POST görülüyor mu
- edit sırasında gerçek PUT görülüyor mu
- logo/cover multipart request gidiyor mu
- DELETE medya çağrısı gidiyor mu
- 200/201/204 response geliyor mu

Frontend'in yalnız başarılıymış gibi UI göstermediğini doğrula.

---

# M — Backend Test Verification

Mevcut testleri incele.

Şunlar gerçekten var mı ve geçiyor mu:

- organization metadata persistence
- notes persistence
- logo upload
- cover upload
- replace
- remove
- authorization
- IDOR
- invalid media
- storage failure
- migration compatibility
- project settings logo
- chat persistence E2E

Plan dosyasında checkbox `[x]` olması testin gerçekten var olduğu anlamına gelmez.

Gerçek test dosyasını ve test case'i doğrula.

---

# N — No New Feature Rule

Bu audit sırasında yeni feature geliştirme.

Ama:

- frontend API çağrısı eksik
- endpoint eksik
- persistence kopuk
- mock production'da kalmış
- upload yalnız local preview
- cache bug
- gerçek regression

gibi kesin integration bug'ı bulursan:

1. önce raporda belirt
2. root cause yaz
3. gerekli minimum fix'i tanımla

Kullanıcı istemeden geniş refactor yapma.

---

# O — Severity

Her bulguyu şu severity ile sınıflandır:

```text
CRITICAL
HIGH
MEDIUM
LOW
INFO
```

Örnek:

```text
CRITICAL:
Frontend Organization logo upload UI exists but no backend request is sent.

HIGH:
Backend endpoint exists but upload is written to container ephemeral filesystem instead of persistent volume.

MEDIUM:
Cache invalidation misses organization picker.

LOW:
Dead helper remains unused.
```

---

# P — Final Verdict

Finalde net tek sonuç ver.

Şu formatta:

```text
Overall integration status:

FULLY CONNECTED
veya
MOSTLY CONNECTED
veya
PARTIALLY CONNECTED
veya
MOCK / INCOMPLETE
```

Ardından nedenini kısa özetle.

---

# Q — Final Rapor Formatı

Final cevabını tam olarak şu sırayla ver:

## 1. Executive Summary

Genel sonuç.

## 2. Overall Integration Verdict

FULLY CONNECTED / MOSTLY CONNECTED / PARTIALLY CONNECTED / MOCK-INCOMPLETE

## 3. Endpoint Inventory

Gerçek backend endpointlerinin listesi.

## 4. Frontend ↔ Backend Mapping

Feature mapping tablosu.

## 5. Database Persistence

Gerçek persist edilen alanlar.

## 6. Media Storage

Logo/cover storage lifecycle.

## 7. Mock / Fake Audit

Bulunan production mock/fake/stub kalıntıları.

## 8. Project Settings Logo Audit

Sonuç.

## 9. Chat Persistence Audit

Sonuç.

## 10. Runtime / E2E Evidence

Çalıştırılan testler ve gerçek sonuçları.

## 11. Findings by Severity

CRITICAL/HIGH/MEDIUM/LOW/INFO.

## 12. Missing Connections

Varsa frontend-backend kopuklukları.

## 13. Dead Code

Varsa.

## 14. Final Recommendation

Tamam mı, fix gerekir mi?

---

# R — Kritik Kurallar

1. Plan dosyasına güvenip "yapılmıştır" deme.
2. Gerçek production code'u incele.
3. Gerçek controller mapping'lerini çıkar.
4. Gerçek frontend API call'larını bul.
5. Gerçek DB migration/entity/repository persistence'ı doğrula.
6. Local preview ile gerçek upload'ı karıştırma.
7. Mock/test fixture ile production data flow'u karıştırma.
8. Hard reload sonrası persistence'ı doğrula.
9. Network request kanıtı varsa kullan.
10. Endpoint var ama frontend çağırmıyorsa CONNECTED sayma.
11. Frontend çağırıyor ama backend persist etmiyorsa CONNECTED sayma.
12. UI'da görünmesi tek başına başarı değildir.
13. DB'de olması tek başına başarı değildir.
14. Full chain çalışıyorsa CONNECTED de.
15. Yeni feature ekleme.
16. Gereksiz refactor yapma.
17. Bulgu yoksa uydurma.
18. Her önemli iddiayı dosya/endpoint/test kanıtıyla destekle.
19. Runtime doğrulama yapılamadıysa bunu açıkça yaz.
20. Sonuçta net verdict ver.
