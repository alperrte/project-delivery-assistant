# PDA — GitHub-Style Organization ↔ Project Architecture Audit & Remediation Plan

PDA projesindeki `Organization` ve `Project` yapılarının birbirleriyle gerçekten doğru şekilde bağlı olup olmadığını inceleyeceğiz.

Bu çalışma yalnızca frontend görünüm kontrolü değildir.

Amaç:

> PDA'daki Organization ↔ Project ilişkisinin GitHub'daki Organization ↔ Repository modeline benzer şekilde gerçekten çalışıp çalışmadığını backend, database, API, authorization, frontend, cache ve kullanıcı akışları seviyesinde doğrulamak.

Şu an senden production kodu yazmanı istemiyorum.

Önce repository'yi detaylı incele, mevcut sistemi gerçek koddan çıkar, aşağıdaki hedef modelle karşılaştır, eksikleri raporla ve gerekiyorsa teknik bağımlılık sırasına göre uygulanabilir bir remediation planı oluştur.

Tahmin etme.

Mevcut plan/checklist/completion dosyalarına bakıp “yapılmış” kabul etme.

Gerçek production code, migration, controller, service, repository, frontend API ve runtime davranışı source of truth olsun.

---

# 1. Hedef Ürün Modeli — GitHub Benzeri Organization / Repository Mantığı

PDA'da:

```text
Project ≈ GitHub Repository
Organization ≈ GitHub Organization
```

mantığı hedefleniyor.

Bir Project iki farklı şekilde yaşayabilmeli:

## A — Bağımsız Project

```text
Project
organizationId = null
```

Project herhangi bir organization'a bağlı olmadan oluşturulabilmeli ve normal şekilde kullanılabilmeli.

Örneğin:

```text
Hamza
└── PDA
```

Bu proje standalone'dır.

## B — Organization Altındaki Project

Project opsiyonel olarak bir Organization'a bağlanabilmeli.

Örneğin:

```text
Organization: x-etc
├── Project A
├── Project B
└── Project C
```

Burada:

```text
Project A.organizationId = x-etc
Project B.organizationId = x-etc
Project C.organizationId = x-etc
```

mantığı bulunabilir.

---

# 2. Cardinality

Beklenen ilişki:

```text
Organization 1 ---- 0..N Project
Project      0..1 -- Organization
```

Yani:

- Bir Organization sıfır project içerebilir.
- Bir Organization bir project içerebilir.
- Bir Organization birden fazla project içerebilir.
- Bir Project en fazla bir Organization'a bağlı olabilir.
- Bir Project hiçbir Organization'a bağlı olmayabilir.

Bu ilişkinin gerçekten database ve domain seviyesinde uygulanıp uygulanmadığını doğrula.

---

# 3. Organization Project'in Sahibi Değildir

GitHub benzeri modelde önemli ayrım:

Organization ilişkisi ile Project membership/authorization ilişkisini birbirine karıştırma.

Bir project'in Organization'a bağlı olması:

> Organization içindeki herkes otomatik olarak Project üyesidir

anlamına gelmemeli, mevcut ürün modeli bunu açıkça tanımlamıyorsa.

Repository'deki gerçek membership modelini incele.

PDA'nın mevcut:

- ProjectMembership
- Project roles
- permissions
- Organization ownership

yapılarını çıkar.

Organization ↔ Project association ile Project access control birbirinden ayrılmış mı doğrula.

---

# 4. Mevcut Database Modelini İncele

Özellikle Flyway migration'ları ve entity'leri incele.

Kontrol et:

```text
organizations
projects
projects.organization_id
```

gibi yapı gerçekten var mı?

Şunları doğrula:

- `organization_id` nullable mı?
- gerçek FK var mı?
- FK hangi tabloya bağlı?
- delete/archive semantics nedir?
- organization archive olunca project ne oluyor?
- standalone project mümkün mü?
- existing standalone project migration sonrası bozuluyor mu?
- organization içindeki project sayısı sınırsız mı yoksa yanlış bir uygulama limiti var mı?

Final raporda gerçek schema'yı yaz.

---

# 5. Project Entity / Domain Audit

Project entity/domain modelini incele.

Şunları doğrula:

- `organizationId` veya eşdeğeri gerçekten var mı?
- nullable mı?
- create sırasında opsiyonel mi?
- update sırasında değiştirilebiliyor mu?
- organization'dan çıkarılabiliyor mu?
- başka organization'a taşınabiliyor mu?
- validation hangi service/domain katmanında?

Frontend'de organization seçeneği görünmesi tek başına yeterli değildir.

Gerçek persistence zinciri bulunmalı.

---

# 6. Project Create Akışı

Şu iki akışın ikisini de doğrula.

## Standalone

```text
Create Project
→ Organization seçme
→ "Yok / Bağımsız"
→ POST
→ organizationId = null
→ project gerçekten DB'de standalone
```

## Organization project

```text
Create Project
→ Organization seç
→ POST
→ organizationId = selected organization
→ backend doğrular
→ DB FK persist edilir
```

Frontend'in yalnız organization adını local state'te göstermediğini kanıtla.

---

# 7. Project Settings / Move Akışı

Mevcut Project Settings'i incele.

Bir project için:

```text
Standalone
→ Organization A
```

geçişi mümkün mü?

Ve:

```text
Organization A
→ Standalone
```

mümkün mü?

Ve ürün izin veriyorsa:

```text
Organization A
→ Organization B
```

mümkün mü?

Bunların backend'de gerçekten validate/persist edildiğini doğrula.

Sadece frontend dropdown değişikliği olmamalı.

---

# 8. Organization Seçme Yetkisi

Kullanıcı Project create/settings sırasında yalnız erişmeye/yönetmeye yetkili olduğu organization'ları seçebilmeli.

Kontrol et:

- Organization picker hangi API'yi kullanıyor?
- sadece owned organizations mı?
- tüm organizations mı?
- paginated mı?
- daha önce düzeltilen `allOwned` benzeri helper gerçekten kullanılıyor mu?
- 100+ organization sınırı tamamen çözülmüş mü?

Kullanıcı başka bir kullanıcının Organization UUID'sini manuel request ile gönderirse backend bunu reddediyor mu?

Frontend filtreleme güvenlik kontrolü sayılmaz.

---

# 9. Backend Authorization

Özellikle Project create/update sırasında backend şunu doğrulamalı:

```text
organizationId != null
→ organization exists
→ active
→ actor bu organization'ı project association için kullanmaya yetkili
```

Kontrol et.

IDOR testi zorunlu:

```text
User A
→ User B'nin organization UUID'sini request'e koyar
→ request rejected
```

---

# 10. Organization Detail → Projects

Organization detail sayfasındaki Project listesi gerçek backend association üzerinden gelmeli.

Kontrol et:

```text
Organization
→ GET organization projects
→ ProjectService / repository
→ projects.organization_id
→ frontend table/card
```

Mock/local filtering olmamalı.

Endpoint gerçek controller mapping'inden çıkarılmalı.

Örneğin mevcutsa:

```text
GET /api/v1/organizations/{id}/projects
```

ama tahmin etme.

Gerçek endpoint'i bul.

---

# 11. Visibility vs Membership

Özellikle şu soruyu gerçek koddan cevapla:

> Organization sahibi, organization'a bağlı her project'i otomatik görebiliyor mu?

Bu davranışı GitHub'dan körlemesine kopyalama.

PDA'daki mevcut ProjectMembership modeline göre değerlendir.

Eğer endpoint organization altındaki projectleri:

```text
organization_id = X
AND current user has project membership
```

şeklinde filtreliyorsa bunu açıkça raporla.

Bu ürün kararı bilinçliyse bug sayma.

Ancak frontend “organization içindeki tüm projectler” diyerek gerçekte yalnız membership filtresini gösteriyorsa UX mismatch olarak belirt.

---

# 12. Project Listesi

Global Projects sayfasını incele.

Hem standalone projects hem de organization projects aynı Project sistemi içinde düzgün görünmeli.

Organization'a bağlı project ayrı bir sahte entity/type olmamalı.

Kontrol et:

- aynı ProjectResponse mı?
- organization metadata geliyor mu?
- organization name/logo gösteriliyor mu?
- standalone için fallback/null davranışı doğru mu?

---

# 13. Project Home / Organization Bilgisi

Project organization'a bağlıysa Project Home veya project header'da organization bilgisi gösteriliyorsa:

```text
Project
→ backend response/home aggregate
→ organization id/name
→ UI
```

zincirini doğrula.

Standalone project için:

```text
organization = null
```

durumunda UI kırılmamalı.

Daha önce düzeltilen organization rename cache invalidation'ın gerçekten hâlâ doğru çalıştığını regression olarak kontrol et.

---

# 14. Organization Rename

Organization adı değişirse:

- Organization detail
- Organization list
- Project Home
- Project Settings organization picker
- Project create picker
- varsa Project Card/header

eski organization adını cache'den göstermemeli.

Query key/invalidation zincirini incele.

---

# 15. Organization Archive

Organization archive edildiğinde organization'a bağlı projectlerin davranışını gerçek koddan çıkar.

Aşağıdakilerden hangisi mevcut?

```text
A) Projectler standalone olur
B) Projectler association'ı korur ama organization inactive olur
C) Archive engellenir
D) Başka davranış
```

Tahmin etme.

Mevcut product/domain davranışını raporla.

Data loss oluşturan cascade olmamalı, ürün özellikle istemiyorsa.

---

# 16. Project Delete / Archive

Project silinir/archive edilirse Organization'ın kendisi etkilenmemeli.

Örnek:

```text
Organization
├── A
├── B
└── C
```

A kaldırılınca:

```text
Organization
├── B
└── C
```

kalabilmeli.

Organization lifecycle project lifecycle'a yanlış şekilde bağlı olmamalı.

---

# 17. API Inventory

Gerçek controller'lardan Organization ve Project endpoint inventory çıkar.

Özellikle:

## Organization
- create
- list
- detail
- update
- archive
- projects listing

## Project
- create
- detail
- update/settings
- list
- home
- organization assignment/removal

Her endpoint için:

| Method | Path | Auth | Request | Response | Organization etkisi |
|---|---|---|---|---|---|

oluştur.

---

# 18. Frontend ↔ Backend Mapping

Her önemli feature için şu zinciri çıkar:

```text
Frontend component
→ hook/API client
→ HTTP request
→ controller
→ service
→ repository
→ DB
→ response
→ query cache
→ UI
```

Özellikle:

- standalone project create
- organization project create
- organization assign
- organization remove
- organization change
- organization detail project listing
- project home organization info
- organization picker

---

# 19. Mapping Status Tablosu

Final raporda şu tablo zorunlu:

| Feature | Frontend | Backend API | DB persistence | Authorization | Status |
|---|---|---|---|---|---|
| Standalone Project | ... | ... | ... | ... | CONNECTED |
| Project → Organization | ... | ... | ... | ... | ... |
| Organization → Projects list | ... | ... | ... | ... | ... |
| Remove Organization | ... | ... | ... | ... | ... |
| Move Organization | ... | ... | ... | ... | ... |
| Rename propagation | ... | ... | ... | ... | ... |

Status sadece:

```text
CONNECTED
PARTIAL
BROKEN
MOCK
MISSING
DEAD CODE
```

olsun.

---

# 20. Mock / Fake Audit

Organization ↔ Project ilişkisinde:

- hardcoded organization list
- fake organization project count
- local-only relation
- static preview
- client-side project filtering pretending to be server relation
- API response yerine cache/local object kullanımı
- placeholder project list
- TODO/stub

ara.

Preview/mock olması bilinçli UI preview ise bunu production persistence ile karıştırma.

---

# 21. Runtime Verification

Static inspection ile yetinme.

Mümkünse gerçek browser + backend + PostgreSQL ile doğrula.

## Senaryo A — Standalone Project

```text
Create project
→ organization seçme
→ save
→ reload
→ DB organization_id NULL
→ Project Home/Settings çalışıyor
```

## Senaryo B — Organization Project

```text
Create Organization A
→ Create Project
→ select Organization A
→ save
→ DB organization_id = A
→ Organization A detail
→ project visible
```

## Senaryo C — Multiple Projects

```text
Organization A
→ Project 1
→ Project 2
→ Project 3
```

Organization detail hepsini gerçek backend'den göstermeli.

## Senaryo D — Remove Association

```text
Project 1
→ Settings
→ Organization = none
→ save
→ DB NULL
→ Organization A listesinde artık yok
→ project standalone çalışıyor
```

## Senaryo E — Move

Ürün/model destekliyorsa:

```text
Project 2
A → B
→ DB B
→ A listesinden çıkar
→ B listesine girer
```

## Senaryo F — Unauthorized Organization

```text
User B organization
→ User A request içinde UUID gönderir
→ backend reject
```

---

# 22. Network Verification

Browser testlerinde gerçek requestleri doğrula.

Örneğin:

```text
POST Project
organizationId = null
```

ve:

```text
POST/PUT Project
organizationId = UUID
```

gerçek body'lerini kontrol et.

Mock `route.fulfill` normal başarı senaryosunda kullanılmamalı.

---

# 23. Direct DB Verification

Runtime testinde sadece UI'ya güvenme.

QA project kayıtlarını PostgreSQL'den doğrudan kontrol et:

```sql
SELECT id, organization_id
FROM projects
WHERE id = ?;
```

Gerçek schema/table naming neyse onu kullan.

---

# 24. Existing Tests

Şunları ara ve değerlendir:

- ProjectService tests
- Project API integration tests
- Organization repository/service/API tests
- organization-project migration tests
- Project create E2E
- Project settings E2E
- Organization detail E2E

Mevcut testler bu GitHub-style ilişkiyi gerçekten kapsıyor mu?

Yoksa eksik regression senaryolarını planla.

---

# 25. GitHub Benzeri Semantik Karşılaştırma

GitHub'ı birebir kopyalamaya çalışma.

Ancak şu temel semantiklerle PDA'yı karşılaştır:

| GitHub-benzeri hedef | PDA |
|---|---|
| Repository standalone olabilir | ? |
| Repository organization altında olabilir | ? |
| Organization birden fazla repository içerebilir | ? |
| Repository yalnız bir organization'a bağlıdır | ? |
| Association opsiyoneldir | ? |
| Repository erişimi organization association'dan ayrı olabilir | ? |
| Repository organization'dan çıkarılabilir | ? |
| Repository başka organization'a taşınabilir | ? |
| Organization archive/delete repo verisini yanlışlıkla yok etmez | ? |

Her satır için:

```text
SUPPORTED
PARTIAL
NOT SUPPORTED
DIFFERENT BY DESIGN
```

ver.

---

# 26. Eksik Özellik vs Bug Ayrımı

Bulduğun şeyleri şu sınıflara ayır:

```text
BUG
MISSING FEATURE
UX MISMATCH
SECURITY ISSUE
CACHE ISSUE
DATA MODEL ISSUE
DIFFERENT BY DESIGN
INFO
```

Örneğin Project başka Organization'a taşınamıyorsa:

- mevcut ürün açıkça bunu yasaklıyorsa DIFFERENT BY DESIGN
- UI seçenek sunuyor ama backend yapamıyorsa BUG
- hiç tasarlanmamışsa MISSING FEATURE

---

# 27. Severity

Her gerçek bulgu:

```text
CRITICAL
HIGH
MEDIUM
LOW
INFO
```

olarak sınıflandırılmalı.

---

# 28. Remediation Plan

Eğer sistem hedef modeli zaten tam karşılıyorsa:

> Gereksiz kod değişikliği planlama.

Ama eksik/broken noktalar varsa teknik bağımlılık sırasına göre task planı oluştur.

Örneğin:

```text
DB/domain integrity
↓
Backend authorization/service
↓
API contracts
↓
Frontend API/types
↓
Create/Settings
↓
Organization detail/list
↓
Cache invalidation
↓
E2E/security regression
```

Ancak final sıra gerçek repository analizine göre belirlenmeli.

---

# 29. Checkbox Planı

Eksik düzeltme gerekiyorsa repository root'unda:

```text
PDA_ORGANIZATION_PROJECT_INTEGRATION_PLAN.md
```

oluştur.

Format:

```md
## Task 1 — ...

- [ ] 1.1 ...
- [ ] 1.2 ...

### Definition of Done
- [ ] ...
- [ ] ...
```

Tasklar teknik dependency sırasına göre olmalı.

Sonnet implementation sırasında:

```text
implement
→ test
→ DoD
→ [x]
→ next task
```

akışını kullanabilmeli.

---

# 30. Backend Değişikliği Gerekiyorsa

Mevcut architecture'ı koru.

Özellikle:

- nullable organization association
- gerçek FK
- ProjectMembership
- Project permissions
- Organization owner validation
- Spring Modulith boundaries

bozulmamalı.

Organization'ın Project erişimini dolaylı olarak genişletme.

---

# 31. Frontend Değişikliği Gerekiyorsa

Frontend:

- Organization picker
- Project Create
- Project Settings
- Organization Detail
- Projects List
- Project Home/Header

arasındaki data model aynı backend source of truth'ı kullanmalı.

Aynı relation için farklı local state modelleri oluşturma.

---

# 32. Cache

Şunları özellikle incele:

```text
["organizations"]
["projects"]
project detail
project home
organization projects
organization picker
```

ve gerçek query key factory'leri.

Association değiştiğinde ilgili cache'ler tutarlı invalidate/update edilmeli.

Örneğin:

```text
Project A:
Organization A → null
```

sonrası:

- Project Detail güncel
- Project Home güncel
- Organization A projects list güncel
- global Projects güncel
- Settings picker güncel

olmalı.

---

# 33. Security Tests

En az:

- unauthorized organization assignment
- foreign organization UUID
- archived organization assignment
- non-existent organization UUID
- standalone create
- owned organization assignment
- remove relation
- cross-organization move
- unauthorized move
- project membership still enforced

testlerini değerlendir.

---

# 34. Data Integrity

Database veya service race condition düşün:

```text
Organization archive
+
Project organization assignment
```

eşzamanlı olursa inactive organization'a project bağlanabilir mi?

Gerçek risk varsa planla.

Gereksiz concurrency complexity ekleme; ama mevcut lock/transaction modelini incele.

---

# 35. Performance

Organization detail projects endpoint:

- pagination kullanıyor mu?
- N+1 organization/project member query var mı?
- 100 project sonrası kırılıyor mu?
- frontend tüm sayfaları yanlışlıkla ilk 100 ile sınırlandırıyor mu?

kontrol et.

---

# 36. i18n / UX

Standalone seçim kullanıcı açısından açık olmalı.

Örneğin:

```text
Organizasyon yok
Bağımsız proje
```

gibi label mevcutsa terminoloji tutarlı mı incele.

Project bir organization'a bağlıysa kullanıcı bunu anlayabilmeli.

Ama Organization association'ı zorunluymuş gibi UX yaratma.

---

# 37. Final Verdict

Audit sonunda tek bir verdict ver:

```text
FULLY ALIGNED
MOSTLY ALIGNED
PARTIALLY ALIGNED
NOT ALIGNED
```

Anlamları:

```text
FULLY ALIGNED
→ hedef GitHub-style temel ilişki backend/frontend/runtime olarak eksiksiz

MOSTLY ALIGNED
→ temel model doğru, küçük ikincil sorunlar

PARTIALLY ALIGNED
→ data model var ama önemli akış/authorization/frontend bağlantıları eksik

NOT ALIGNED
→ temel standalone/organization project modeli gerçek sistemde yok veya yanlış
```

---

# 38. Final Rapor Formatı

Final cevabı şu sırada ver:

## 1. Executive Summary
## 2. Overall Verdict
## 3. Current Data Model
## 4. GitHub-Style Semantic Comparison
## 5. Endpoint Inventory
## 6. Backend Integration
## 7. Frontend Integration
## 8. Frontend ↔ Backend Mapping
## 9. Authorization & IDOR
## 10. Database Persistence
## 11. Cache Consistency
## 12. Runtime / E2E Evidence
## 13. Mock / Fake Audit
## 14. Findings by Severity
## 15. Bugs vs Missing Features vs Different-by-Design
## 16. Remediation Plan
## 17. Final Recommendation

Net olarak:
- sistem zaten doğru mu,
- küçük fix mi gerekiyor,
- yoksa gerçek architecture değişikliği mi gerekiyor?

---

# 39. Kritik Kurallar

1. GitHub modelini kavramsal referans olarak kullan; birebir özellik kopyalama.
2. Project organization'a bağlı olmadan yaşayabilmeli.
3. Project en fazla bir organization'a bağlı olmalı.
4. Organization 0..N project içerebilmeli.
5. Association backend/database'te gerçek olmalı.
6. Frontend-only organization relation kabul edilmez.
7. Organization association ile ProjectMembership'i karıştırma.
8. Organization üyeliği/ownership Project access'i otomatik genişletmesin, mevcut ürün açıkça öyle tasarlanmadıysa.
9. organizationId IDOR backend'de engellenmeli.
10. Standalone create gerçek runtime/DB ile doğrulanmalı.
11. Organization project create gerçek runtime/DB ile doğrulanmalı.
12. Organization detail project list gerçek backend relation kullanmalı.
13. Association remove/move mevcut ürün destekliyorsa gerçek persistence ile çalışmalı.
14. Project Home/Settings/List cache tutarlı olmalı.
15. Plan/checklist geçmişini başarı kanıtı sayma.
16. Mock/test fixture ile production ilişkiyi karıştırma.
17. Runtime doğrulanamadıysa açıkça yaz.
18. Gereksiz refactor önerme.
19. Eksik yoksa implementation taskı uydurma.
20. Bulgu varsa dependency sıralı checkbox planı oluştur.
21. Bu aşamada commit/push yapma.
22. Mevcut kullanıcı değişikliklerini reset/revert etme.

---

# Sonnet Implementation Prompt

Eğer Opus audit sonucunda gerçekten eksik bulur ve `PDA_ORGANIZATION_PROJECT_INTEGRATION_PLAN.md` oluşturursa, bu dosyayı source of truth olarak kullan ve planı task sırasını değiştirmeden uygula.

Her task için:

```text
implementation
→ targeted test
→ Definition of Done
→ checkbox [x]
→ sonraki task
```

akışını koru.

Ana hedef:

- standalone Project gerçek backend/DB desteğiyle çalışmalı,
- Project opsiyonel olarak tek bir Organization'a bağlanabilmeli,
- Organization 0..N Project içerebilmeli,
- Organization association ile ProjectMembership birbirine karıştırılmamalı,
- authorization/IDOR backend source of truth olmalı,
- create/settings/detail/list/home/cache akışları aynı gerçek relation'ı kullanmalı,
- association kaldırma/taşıma planda varsa gerçek DB persistence ile çalışmalı.

Full backend + frontend + E2E + security + pre-push doğrulaması geçmeden işi bitmiş sayma.

Commit/push yapma.
