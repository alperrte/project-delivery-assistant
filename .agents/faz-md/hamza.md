# PDA — Hamza Çalışma Planı

> **Sahip:** Hamza Taşbay  
> **Ana alan:** Project Service / Project Management  
> **Proje:** PDA — Project Delivery Assistant  
> **Çalışma modeli:** Modular Monolith içinde servis sahipliği mantığı  
> **Tarih:** 26 Eylül 2026  
> **Durum:** Uygulama planı — task task ilerle, bir task bitmeden sonraki bağımlı task'a geçme.

---

## 0. Bu dosyanın amacı

Bu dosya Hamza'nın sahip olduğu **Project Service** alanını tek yerde toplar. Amaç, mikroservis projesindeki servis sahipliği mantığını PDA'nın mevcut **Spring Modulith / modular monolith** mimarisine uygulamaktır.

Project Service aşağıdaki ana ürün yeteneklerinden sorumludur:

- Organization oluşturma ve temel yönetimi
- Project oluşturma, görüntüleme, düzenleme ve archive etme
- Project ana sayfası / genel süreç görünümü
- Project kriterleri ve başarı kriterleri
- ProjectMembership
- Project'e kullanıcı arama ve davet etme
- Project içindeki rol atamaları
- Squad oluşturma ve squad üyelerini yönetme
- Project lifecycle / status yönetimi
- Public GitHub repository bağlama
- Project ana sayfasında son commitleri gösterme
- Project'e özel mail/bildirim use-case'leri
- Project seviyesinde authorization kontrolleri

Bu dosya aşağıdaki konularda önceki planın ilgili kısımlarını günceller:

- Project Service'in sahibi artık **Hamza**'dır ve backend + frontend + test + E2E dikey olarak aynı owner tarafından tamamlanır.
- `project` ve `squad` paketleri Hamza'nın ana çalışma alanıdır.
- `Organization` V1 kapsamına eklenir; yeni ayrı mikroservis değildir, Project Service'in parçasıdır.
- Eski `OWNER / MANAGER / MEMBER / VIEWER` modelinin yerine Auth Service'te tanımlanan yeni project-role modeli kullanılacaktır.
- Yeni project rollerinde `PROJECT_MANAGER` ve `MODERATOR` yetki rolleri ile developer/tester/analyst rollerinin project membership'e atanması desteklenir.
- Project'e public GitHub repository bağlama ve son commitleri gösterme V1'e eklenir.
- Private repository, GitHub App, webhook, PR/CI entegrasyonu V2'ye bırakılır.
- Project için V1 silme davranışı hard delete değil **archive** olacaktır.
- Project'e özel mail ve notification ayrı deploy edilen servis yapılmaz; ilgili Project use-case'inin parçası olarak ele alınır. Ortak taşıma/teknik adapter varsa reuse edilir.

> **Önemli:** Bu dosya yalnızca yukarıdaki ürün/sahiplik kararlarını günceller. Güvenlik, modular monolith, PostgreSQL/Flyway, API hata standardı, backend authorization source-of-truth, secret yönetimi ve modül sınırı kuralları geçerliliğini korur.

---

# 1. Project Service sınırı

## 1.1 Hamza'nın ana backend paketleri

Repo mevcut yapısı doğrulandıktan sonra ana çalışma alanı:

```text
backend/src/main/java/com/pda/
├── project/    # HAMZA
├── squad/      # HAMZA
└── shared/     # ORTAK — yalnız gerçekten ortak teknik ihtiyaç varsa
```

### Organization path kararı

Mevcut root package yapısında `organization` modülü bulunmuyorsa Codex kendiliğinden yeni bir root Spring Modulith modülü açmayacaktır.

V1'de Organization **Project Service'in parçasıdır**. Varsayılan olarak gerçek repo yapısına uygun şekilde `project` altında konumlandırılır:

```text
com.pda.project.organization
```

veya mevcut `project` katman standardına uygun eşdeğer alt paket.

Yeni root:

```text
com.pda.organization
```

ancak açık mimari kararla eklenebilir.

`shared` Hamza'ya ait bir servis değildir. Project tarafından kullanılabilir ancak Project/Organization/Squad domain kodu `shared` içine taşınmaz.

## 1.2 Project Service neyi yönetecek?

### Organization

- Organization oluşturma
- Organization görüntüleme
- Organization temel bilgilerini düzenleme
- Organization archive etme
- Project'i organization altında oluşturma/taşıma kuralları
- Organization altında project listesi

V1 Organization hafif bir gruplama/container modelidir; ayrı enterprise organization permission matrix oluşturulmaz.

### Project

- Project create
- Project detail
- Project update
- Unique slug
- Project settings
- Project status/lifecycle
- Project archive
- Project ana sayfası
- Project başarı kriterleri
- Project repository bağlantısı

### Membership

- ProjectMembership oluşturma
- Üye listeleme
- Üye çıkarma
- Project role atama/değiştirme
- Bir kullanıcının farklı projelerde farklı rollere sahip olması
- En az bir Project Manager garantisi

### Invitation

- Nickname/email ile kullanıcı arama
- Kayıtlı kullanıcıya davet
- Kayıtsız kullanıcıya email daveti
- Invitation create/resend/accept/reject/cancel/expire
- Invitation token güvenliği
- Invitation sırasında başlangıç rolü seçebilme

### Squad

- Squad create/update/archive
- Squad üyelerini yönetme
- Yalnız project member'ların squad'a eklenmesi
- Squad'ın task assignment için zorunlu olmaması

### Project Overview

- Project metadata
- Team member / squad sayıları
- Project kriter ilerlemesi
- Task durum özeti
- Due/overdue özetleri
- Açık issue özeti
- Son aktiviteler
- Son GitHub commitleri

Task/Issue/Activity verileri Project repository'sinden üretilmez. Work Service hazır olduğunda public read/query contract üzerinden alınır.

---

# 2. Project Service dışı sınırlar

Project Service aşağıdaki business logic'i **sahiplenmez**:

- Local register/login/logout
- JWT üretimi/refresh rotation
- User password/session yönetimi
- Google/GitHub ile kullanıcı login'i
- Global ADMIN authentication
- Auth role/permission tanımlarının canonical kaynağı
- Task entity/business logic
- TaskAssignment persistence
- Task workflow/history
- Issue business logic
- TestReport business logic
- Comment business logic
- Work Service activity persistence

Örnek sınır:

```text
Auth Service:
PROJECT_MANAGER / MODERATOR / developer/tester rollerinin canonical tanımını ve security policy'sini bilir.

Project Service:
User X'in Project Y içinde hangi role/rollere sahip olduğunu membership üzerinden tutar.

Work Service:
Task oluşturma/atama/status gibi işlemlerde Project Service'in public access contract'ından role bilgisini sorgular.
```

Modüller birbirinin repository'sine veya persistence entity'sine doğrudan erişmez.

---

# 3. Organization kararları

## 3.1 Organization opsiyoneldir

Project bir Organization altında olmak zorunda değildir.

Desteklenen iki kullanım:

```text
Standalone Project
organizationId = null
```

ve:

```text
Organization
├── Project A
├── Project B
└── Project C
```

Bu sayede küçük/öğrenci ekipleri organization kurmadan doğrudan project oluşturabilir.

## 3.2 V1 Organization kapsamı

Önerilen temel alanlar:

```text
id
name
slug
description
ownerUserId
status
createdAt
updatedAt
archivedAt
```

### V1'de var

- Create
- View
- Update
- Archive
- Organization altındaki projectleri listeleme
- Project oluştururken organization seçme

### V1'de yok

- Ayrı Organization role matrix
- Enterprise department hierarchy
- Organization-wide billing
- Organization-wide SSO
- Nested organization
- Organization bazlı özel permission designer

Project erişiminin source-of-truth'u ProjectMembership olmaya devam eder.

---

# 4. Project core kararları

## 4.1 Project oluşturma

Project oluşturabilen project-scope kullanıcı **PROJECT_MANAGER** olur.

Yeni project oluşturan authenticated kullanıcı otomatik olarak ilk `PROJECT_MANAGER` membership'ini alır.

Project oluşturma sırasında minimum:

```text
Name
Description (optional)
Organization (optional)
```

Sistem:

- unique slug üretir/doğrular
- creator'ı ProjectMembership ile bağlar
- creator'a PROJECT_MANAGER atar
- Project status başlangıç değerini verir
- audit/activity için gerekli business event'i üretir

## 4.2 Project temel alanları

V1 başlangıç modeli:

```text
id
name
slug
description
organizationId (nullable)
status
priority
startDate (nullable)
targetEndDate (nullable)
projectGoal (nullable)
techStack (nullable / uygun model)
visibility
createdBy
createdAt
updatedAt
archivedAt
```

### Status

```text
PLANNING
ACTIVE
ON_HOLD
COMPLETED
ARCHIVED
```

### Priority

```text
LOW
MEDIUM
HIGH
CRITICAL
```

### Visibility

V1'de başlangıç davranışı:

```text
PRIVATE
```

Public project discovery ayrı feature olarak eklenmez.

## 4.3 Project silme davranışı

V1'de Project için hard delete yapılmaz.

UI'da kullanıcı “Projeyi Sil” aksiyonu görse bile backend business sonucu:

```text
ACTIVE / ...
   ↓
ARCHIVED
```

olacaktır.

Kurallar:

- Yalnız gerekli yetkiye sahip Project Manager archive edebilir
- Confirmation zorunlu
- Archive edilmiş project normal aktif listelerde görünmez
- History/task/membership verisi yanlışlıkla yok edilmez
- Permanent purge V1 kapsamı dışındadır

## 4.4 En az bir Project Manager kuralı

Project aktifken en az bir `PROJECT_MANAGER` bulunmalıdır.

Bu nedenle:

- Son Project Manager'ın rolü kaldırılamaz
- Son Project Manager project'ten çıkarılamaz
- Son Project Manager kendisini üyelikten çıkaramaz
- Project archive edilmeden yönetimsiz project bırakılamaz

---

# 5. Rol ve yetki entegrasyonu

Canonical project role tanımları Auth Service'e aittir.

Project Service bunları membership üzerinde kullanır.

## 5.1 Project roller

```text
PROJECT_MANAGER
MODERATOR
BACKEND_DEVELOPER
FRONTEND_DEVELOPER
FULL_STACK_DEVELOPER
AI_ML_DEVELOPER
UI_UX_DEVELOPER
TESTER
ANALYST
```

Aynı kullanıcı farklı projectlerde farklı role/role setlerine sahip olabilir.

## 5.2 PROJECT_MANAGER

Project Manager Project Service içinde şunları yapabilir:

- Project oluşturma
- Project bilgilerini düzenleme
- Project settings değiştirme
- Project lifecycle/status yönetme
- Project archive etme
- Organization seçimi/değişikliği (kurallar izin veriyorsa)
- Üye arama
- Üye davet etme
- Üye çıkarma
- Project role atama/değiştirme
- Başka kullanıcıyı PROJECT_MANAGER yapma
- MODERATOR atama
- Squad oluşturma/düzenleme/archive
- Squad üyelerini yönetme
- Project kriterlerini oluşturma/düzenleme/tamamlama
- Repository bağlantısını ayarlama/değiştirme
- Project Home verilerini görüntüleme

Task tarafındaki yetkiler Auth policy + Project membership üzerinden Work Service tarafından uygulanır:

- Task oluşturma
- Task atama
- Deadline verme
- Priority/status yönetimi
- Task kapatma/reopen

Project Service task repository'sine erişmez.

## 5.3 MODERATOR

Moderator Project Service içinde:

### Yapabilir

- Project detayını görüntüleme
- Project Home görüntüleme
- Üye listesini görüntüleme
- Squad bilgisini görüntüleme
- Work Service task operasyonlarında Auth policy tarafından izin verilen task yönetimi

### Yapamaz

- Project oluşturma
- Project archive/silme
- Project temel ayarlarını değiştirme
- Organization yönetme
- Üye davet etme
- Üye çıkarma
- Project role değiştirme
- Project Manager atama
- Moderator atama
- Squad oluşturma/düzenleme
- Repository bağlantısını değiştirme
- Project kriterlerini yönetme

## 5.4 Contributor roller

```text
BACKEND_DEVELOPER
FRONTEND_DEVELOPER
FULL_STACK_DEVELOPER
AI_ML_DEVELOPER
UI_UX_DEVELOPER
TESTER
ANALYST
```

Project Service açısından temel davranış:

- Üyesi olduğu project'i görüntüleyebilir
- Project Home'ı görüntüleyebilir
- Üye/squad bilgilerini izin verilen ölçüde görüntüleyebilir
- Project settings / membership / role mutation yapamaz

Task/TestReport gibi özel capability Work Service tarafından uygulanır.

---

# 6. ProjectMembership kararları

ProjectMembership Project Service'in persistence sorumluluğudur.

Minimum kavramsal veri:

```text
id
projectId
userId
roles
joinedAt
invitedBy (uygunsa)
status
```

Kurallar:

- Aynı user aynı project'e duplicate active membership alamaz
- Project erişimi yalnız membership üzerinden doğrulanır
- Cross-project resource erişimi engellenir
- Kullanıcı project'ten çıkarıldığında mevcut permission hemen geçersiz olmalıdır
- Role değişimi JWT yenilemeye bağımlı olmamalıdır
- Role assignment backend tarafından doğrulanır
- Frontend gizleme security boundary değildir

## 6.1 Auth Service ile contract

Project Service User entity/repository'sine doğrudan erişmez.

Gerekli public contract örnek sorumlulukları:

```text
findUserForProjectSearch(...)
getUserSummary(userId)
validateRoleCode(...)
```

Gerçek method isimleri implementasyon sırasında belirlenir.

---

# 7. Kullanıcı arama ve Project Invitation

## 7.1 Üye arama

Project Manager “Add Member” akışında:

```text
Nickname / email ile ara
```

Arama Auth/User public contract üzerinden yapılır.

Project Service başka modülün user repository'sine doğrudan erişmez.

Search sonucu minimum safe summary:

```text
userId
nickname
safe display name (varsa)
avatar URL (varsa)
```

Email gizlilik nedeniyle yalnız uygun akışta gösterilir; frontend'e gereksiz kişisel veri açılmaz.

## 7.2 Kayıtlı kullanıcı daveti

```text
Search user
   ↓
Select user
   ↓
Select initial project role(s)
   ↓
Create invitation
   ↓
In-app notification / email (uygunsa)
   ↓
Accept
   ↓
ProjectMembership
```

## 7.3 Kayıtsız kullanıcı daveti

```text
Email gir
   ↓
Secure invitation oluştur
   ↓
Mail gönder
   ↓
User register/login
   ↓
Invitation doğrula
   ↓
Accept
   ↓
ProjectMembership
```

## 7.4 Invitation persistence

Minimum kavramsal alanlar:

```text
id
projectId
invitedUserId (nullable)
email (gerektiğinde)
invitedBy
tokenHash
expiresAt
status
createdAt
acceptedAt
cancelledAt
initialRoles
```

### Status

```text
PENDING
ACCEPTED
REJECTED
CANCELLED
EXPIRED
```

### Güvenlik

- Invitation token plaintext persist edilmez
- Expired token kabul edilmez
- Kullanılmış token tekrar kabul edilmez
- Duplicate aktif invitation kontrol edilir
- Cross-project accept engellenir
- Unauthorized resend/cancel engellenir
- Token/secret loglanmaz
- Invitation endpointleri rate-limit/throttling açısından değerlendirilir

---

# 8. Project'e özel mail ve notification

Mail ve notification ayrı deploy edilen servis değildir.

Project Service aşağıdaki use-case'leri sahiplenir:

- Project invitation bildirimi
- Invitation resend bildirimi
- Membership accepted bildirimi
- Project'e üye eklendi bildirimi
- Role değişimi bildirimi (uygunsa)
- Squad membership değişimi bildirimi (uygunsa)
- Project lifecycle/archive bildirimi (gerekirse)

## 8.1 Mail transport

Project domain doğrudan SMTP/Brevo implementasyonuna bağımlı olmamalıdır.

Varsa ortak mail transport/adapter reuse edilir.

Yoksa yeni ayrı business service açmak yerine uygun application port + infrastructure adapter kullanılır.

## 8.2 Notification

Project'e ait in-app notification üretimi Project use-case'iyle ilişkilidir.

Mevcut root `notification` / `mail` package'ları varsa Codex bunları audit etmeden silmez, taşımaz veya yeniden mimarileştirmez.

Yeni servis sınırı kararıyla çelişen mevcut placeholder/plan bulunursa önce raporlanır.

---

# 9. Squad kararları

Squad Project Service'in parçasıdır.

## 9.1 Squad modeli

Minimum:

```text
id
projectId
name
description
createdBy
createdAt
updatedAt
archivedAt
```

Squad member relation:

```text
squadId
projectMembershipId / userId (uygun domain contract'a göre)
addedBy
addedAt
```

## 9.2 Squad kuralları

- Squad yalnız bir project'e aittir
- Yalnız project member squad'a eklenebilir
- Project dışı kullanıcı squad'a eklenemez
- Aynı kullanıcı aynı squad'a duplicate eklenemez
- Squad task assignment için zorunlu değildir
- Squad kendi başına authorization rolü vermez
- Project role ile Squad üyeliği farklı kavramlardır
- Project Manager squad yönetir
- Moderator/developer varsayılan olarak squad membership mutation yapamaz

---

# 10. Project Settings ve kriterler

Project Settings, Project Manager tarafından düzenlenir.

## 10.1 Temel Project Settings

- Name
- Description
- Organization
- Status
- Priority
- Start Date
- Target End Date
- Project Goal
- Tech Stack
- Repository connection

## 10.2 Project Success Criteria

Project'in proje-seviyesi başarı/kapanış kriterleri olacaktır.

Bu yapı task değildir.

Örnek:

```text
Project Goal:
Ücretsiz ve self-host edilebilir project/task management platformu geliştirmek.

Success Criteria:
[✓] Authentication tamamlandı
[✓] Project management tamamlandı
[ ] Task management tamamlandı
[ ] Critical E2E testleri geçti
[ ] V1 release hazır
```

Önerilen `ProjectCriterion` kavramı:

```text
id
projectId
title
description (nullable)
completed
sortOrder
createdBy
createdAt
completedBy (nullable)
completedAt (nullable)
```

Kurallar:

- Yalnız PROJECT_MANAGER create/update/delete/reorder/complete edebilir
- Criteria project-scoped olur
- Criteria task yerine geçmez
- Project progress calculation ile karıştırılmaz

---

# 11. Project lifecycle ve progress

## 11.1 Lifecycle

Başlangıç statüleri:

```text
PLANNING
ACTIVE
ON_HOLD
COMPLETED
ARCHIVED
```

Geçiş kuralları feature implementasyonunda testli şekilde sabitlenir.

Minimum beklenti:

- ARCHIVED project mutation'a kapalı/çok sınırlı olur
- Archive geri açma davranışı ürün kararı gerekiyorsa task sırasında raporlanır
- COMPLETED ile ARCHIVED aynı kavram değildir

## 11.2 Progress

Project genel progress'i elle girilen rastgele yüzde olmamalıdır.

Work Service hazır olduğunda task durumlarından hesaplanan özet kullanılmalıdır.

Örnek başlangıç hesabı:

```text
completedTaskCount / totalTaskCount
```

ancak gerçek progress formülü Work Service contract'ı netleştiğinde belirlenir.

Project Service task repository/entity'sine erişmez.

---

# 12. Project Home / genel süreç takibi

Project'in ana sayfası:

```text
/projects/{slug}
```

olacaktır.

## 12.1 Project Home bölümleri

### Project Header

- Name
- Status
- Priority
- Project Manager(s)
- Organization
- Start / target end date
- Repository link

### Progress

- Genel progress
- Success Criteria ilerlemesi

### Team

- Member count
- Squad count
- Project Manager / Moderator bilgisi

### Work Summary

Work Service public query contract üzerinden:

- Total tasks
- TODO
- IN_PROGRESS
- IN_REVIEW
- TESTING
- DONE
- Due Soon
- Overdue
- Open issues

### Recent Activity

Work/Activity public read contract üzerinden, hazır olduğunda.

### Repository Activity

- Repo adı
- Default branch
- Son commitler
- Son repository activity zamanı

## 12.2 Dependency davranışı

Work Service henüz hazır değilse Project Service:

- sahte Work repository/entity oluşturmaz
- başka modül tablosuna SQL yazmaz
- fake production data bırakmaz

Project Home önce project-only bilgilerle çalışabilir; Work summary contract hazır olunca entegrasyon task'ı tamamlanır.

---

# 13. GitHub Public Repository Integration — V1

Bu özellik **Project Service** kapsamındadır ve kullanıcı GitHub Login akışından ayrıdır.

Auth Service'teki “GitHub ile giriş yap” ile repo entegrasyonu aynı OAuth yetkisini paylaşmak zorunda değildir.

## 13.1 V1 kapsamı

Project Settings'ten public GitHub repo bağlanabilir.

Örnek:

```text
https://github.com/alperrte/project-delivery-assistant
```

Sistem güvenli biçimde parse eder:

```text
provider = GITHUB
owner = alperrte
repository = project-delivery-assistant
defaultBranch = main
repositoryUrl = canonical GitHub URL
```

Project Home'da son commitler gösterilir.

Minimum commit bilgisi:

```text
short SHA
commit message
author/display identity
date/time
commit URL
branch context
```

Başlangıçta son 5-10 commit yeterlidir.

## 13.2 Güvenlik

Backend kullanıcıdan gelen arbitrary URL'yi doğrudan fetch etmez.

V1 için allowlist:

```text
github.com
api.github.com
```

Repository URL parse edilir, `owner/repo` doğrulanır ve backend güvenli canonical API URL'sini kendi oluşturur.

Böylece SSRF benzeri riskler azaltılır.

## 13.3 V1 davranışı

- Public repo only
- Read-only
- Repo clone yok
- Git push yok
- Issue oluşturma yok
- PR oluşturma yok
- Webhook yok
- Realtime zorunlu değil
- Manual refresh desteklenir
- Project sayfası açıldığında kontrollü fetch yapılabilir
- GitHub API başarısızsa project sayfasının tamamı fail olmaz
- Timeout/error ayrı repository card state olarak gösterilir
- Rate limit cevabı güvenli işlenir

## 13.4 V2'ye kalanlar

```text
Private repository
GitHub App installation
Selected repository permissions
Webhook
PR list/status
Issue sync
CI/check status
Branch analytics
Commit → task linking automation
```

---

# 14. Admin entegrasyonu

Global ADMIN Auth Service'e aittir.

Project Service admin panel için public contract/API sağlayabilir:

- Project list summary
- Project detail summary
- Project status
- Organization
- Member count
- Archive/deactivate administrative action (ürün politikasına uygun)

Auth/Admin modülü Project repository'sine doğrudan erişmez.

Admin'in normal project workflow'unda Project Manager gibi davranması gerekmez.

---

# 15. Uygulama fazları

Her faz kendi branch/PR/task'ı ile ilerler. Bir fazın acceptance kriterleri geçmeden sonraki bağımlı faz tamamlanmış sayılmaz.

---

## FAZ 0 — Repo ve gerçek kod durumu keşfi

### HMZ-PROJ-00 — Source-of-truth audit

**Amaç:** Kod yazmadan önce repo içindeki Project/Squad yapısını ve gerçek implementasyonu doğrulamak.

Codex şu dosyaları önce okumalıdır:

```text
AGENTS.md
.agents/SECURITY.md
.agents/architecture.md
.agents/folder-structure.md
.agents/api.md
.agents/database.md
.agents/er-diagram.md
.agents/authentication.md
.agents/decisions/0001-modular-monolith.md
.agents/decisions/0002-postgresql.md
.agents/decisions/0003-cookie-auth.md
```

Ayrıca:

```text
backend/src/main/java/com/pda/project/**
backend/src/main/java/com/pda/squad/**
backend/src/main/java/com/pda/auth/**       # yalnız contract sınırını anlamak için
backend/src/main/java/com/pda/user/**       # yalnız public contract mevcut mu diye
backend/src/main/java/com/pda/shared/**     # yalnız ortak altyapı ihtiyacı varsa
backend/src/test/java/com/pda/**
backend/src/main/resources/db/migration/**
frontend/**
docs/compliation/**
```

mevcut durum için incelenmelidir.

Ayrıca root'taki mevcut:

```text
mail/
notification/
activity/
dashboard/
search/
```

package'larının gerçek kod mu placeholder mı olduğu raporlanmalıdır; yeni Project Service kararına göre kendiliğinden silinmez/taşınmaz.

**Çıktı:**

- Gerçek mevcut Project/Squad dosya ağacı
- Placeholder/.gitkeep alanları
- Mevcut Project/ProjectMembership/Squad kodu
- Mevcut role/permission modeli
- Mevcut invitation kodu
- Mevcut migration son numarası
- Auth/User public contract'ları
- Frontend project yapısı
- HTTP client altyapısı var mı?
- GitHub integration için yeni dependency gerekip gerekmediği
- Mail/notification ortak adapter durumu
- Work Service public read contract'ı var mı?
- Conflict riski

**Acceptance:** Kod değişikliği yok. Önce keşif raporu ve HMZ-PROJ-01 için gerçek file scope çıkar.

---

## FAZ 1 — Project Core + Organization Persistence

### HMZ-PROJ-01 — Project domain/persistence

**Kapsam:**

- Project identity
- Name
- Unique slug
- Description
- Status
- Priority
- Dates
- Goal
- Tech stack model kararı
- Visibility
- Archive fields
- CreatedBy/timestamps

**Test:**

- Repository tests
- Unique slug
- Validation
- Archive filtering

### HMZ-PROJ-02 — Organization domain/persistence

**Kapsam:**

- Organization
- Unique slug
- Owner user id
- Basic metadata
- Archive
- Optional Project → Organization relation

**Kural:** Yeni root Modulith module oluşturma; önce Project altındaki doğru path'i belirle.

### HMZ-PROJ-03 — Project/Organization Flyway migration

- Mevcut son migration'ı doğrula
- Alper'in paralel auth migration'larıyla numara conflict'i kontrol et
- PostgreSQL/Flyway standardına uy
- `ddl-auto=validate` uyumlu

### HMZ-PROJ-04 — Project CRUD API

- Create
- Detail
- Update
- List/pagination baseline
- Archive
- Slug lookup

Project create işlemi ilk Project Manager membership'iyle transactional olarak birlikte ele alınmalıdır; membership Faz 2 ile tamamlanınca gate kapanır.

### HMZ-PROJ-05 — Organization API

- Create
- Detail
- Update
- Archive
- Organization project list

**FAZ 1 Gate:** Persistence + migration + temel Project/Organization API testleri yeşil.

---

## FAZ 2 — ProjectMembership + Role Assignment

### HMZ-PROJ-06 — ProjectMembership persistence

**Kapsam:**

- Project + User association
- Project-scoped role assignment
- joinedAt/status
- Duplicate membership engeli

### HMZ-PROJ-07 — Project creator → PROJECT_MANAGER

Project create sırasında creator'ın membership'i ve `PROJECT_MANAGER` rolü garanti edilir.

**Test:**

```text
create project → membership exists → role = PROJECT_MANAGER
```

### HMZ-PROJ-08 — Role assignment use-cases

- Role add/change/remove
- PROJECT_MANAGER assignment
- MODERATOR assignment
- Developer/tester/analyst assignment
- Invalid role rejection

Auth Service canonical role contract'ı mevcutsa onu kullan; role enum'u iki modülde bağımsız şekilde drift ettirme.

### HMZ-PROJ-09 — Last Project Manager protection

- Son PM remove edilemez
- Son PM role downgrade edilemez
- Son PM project'ten ayrılamaz

### HMZ-PROJ-10 — Membership API

- Members list
- Member detail/summary
- Remove member
- Assign/change roles

### HMZ-PROJ-11 — Project access public contract

Work Service ve diğer modüller için küçük public contract/facade:

- isMember
- rolesForUserInProject
- canAccessProject benzeri küçük use-case'ler

Gerçek method isimleri task sırasında belirlenir.

**FAZ 2 Gate:** Project Manager / Moderator / contributor membership davranışları backend authorization testleriyle doğrulanır.

---

## FAZ 3 — User Search + Project Invitation

### HMZ-PROJ-12 — Auth/User search contract integration

- Nickname arama
- Gerektiğinde email lookup
- Safe user summary
- Başka modül repository/entity'sine erişim yok

Auth tarafında gerekli public contract yoksa doğrudan kod yazıp boundary'yi delme; integration change olarak raporla.

### HMZ-PROJ-13 — ProjectInvitation persistence

- Project
- invited user/email
- invitedBy
- tokenHash
- expiry
- status
- initialRoles
- timestamps

### HMZ-PROJ-14 — Invitation create/resend/cancel/reject/expire

- Duplicate active invite
- Unauthorized invite
- Expired token
- Cancelled token
- Resend rules

### HMZ-PROJ-15 — Invitation accept → membership

```text
valid invitation
   ↓
authenticated/verified user
   ↓
accept
   ↓
ProjectMembership
   ↓
initial role assignment
```

Transactional davranış testli olmalıdır.

### HMZ-PROJ-16 — Project invitation mail/notification

- Project-specific application port
- Mevcut transport adapter reuse
- Secret/token loglama yok
- Mail disabled ise core membership akışı bozulmamalı

**FAZ 3 Gate:** Registered + unregistered invitation senaryoları integration testli.

---

## FAZ 4 — Squad

### HMZ-PROJ-17 — Squad persistence

- Project-scoped squad
- Name/description
- Archive fields
- Creator/timestamps

### HMZ-PROJ-18 — Squad membership

- Yalnız project member eklenebilir
- Duplicate engeli
- Cross-project user engeli

### HMZ-PROJ-19 — Squad API

- Create
- List
- Detail
- Update
- Archive
- Add/remove member

### HMZ-PROJ-20 — Squad authorization tests

- PM manage
- Moderator/contributor unauthorized mutation
- Project dışı user denied

**FAZ 4 Gate:** Squad lifecycle gerçek ProjectMembership ile çalışır.

---

## FAZ 5 — Project Settings + Criteria + Lifecycle

### HMZ-PROJ-21 — Project Settings API

- Name
- Description
- Organization
- Priority
- Dates
- Goal
- Tech stack
- Status

### HMZ-PROJ-22 — ProjectCriterion persistence

- title
- description
- completed
- sortOrder
- actor/timestamps

### HMZ-PROJ-23 — Project criteria API

- Create
- Update
- Delete
- Reorder
- Complete/uncomplete

Yalnız PROJECT_MANAGER mutate eder.

### HMZ-PROJ-24 — Lifecycle / archive rules

- PLANNING
- ACTIVE
- ON_HOLD
- COMPLETED
- ARCHIVED
- Archive confirmation backend semantics
- Archived project mutation policy

### HMZ-PROJ-25 — Project lifecycle tests

- Unauthorized lifecycle transition
- Archived behavior
- PM-only settings mutation

**FAZ 5 Gate:** Project Settings + Success Criteria + archive davranışı tamam.

---

## FAZ 6 — GitHub Public Repository Integration

### HMZ-PROJ-26 — Repository connection model

Project'e public repository metadata bağlanır.

Minimum:

```text
provider
repositoryUrl
repositoryOwner
repositoryName
defaultBranch
connectedAt
```

### HMZ-PROJ-27 — GitHub repository URL validation

- Yalnız public GitHub V1
- URL normalize
- Owner/repo parse
- github.com allowlist
- Arbitrary URL fetch yok
- SSRF-safe davranış

### HMZ-PROJ-28 — GitHub public REST client

Önce mevcut HTTP client/dependency'leri kontrol et.

- Repo metadata doğrulama
- Default branch öğrenme
- Latest commits fetch
- Timeout
- Safe error mapping
- Rate limit response handling

> Yeni dependency gerekiyorsa önce raporla; gereksiz dependency ekleme.

### HMZ-PROJ-29 — Latest commits API

Project frontend'e safe DTO:

```text
shortSha
message
author
authorAvatar (safe/optional)
committedAt
commitUrl
```

### HMZ-PROJ-30 — Repository disconnect/update

- Connection update
- Disconnect
- Project data silinmez

### HMZ-PROJ-31 — GitHub integration tests

- Invalid URL
- Non-GitHub URL
- Not-found repo
- API failure
- Rate limit
- Happy path DTO mapping

**FAZ 6 Gate:** Public repo bağlama + son commitler read-only çalışır. Private repo yok.

---

## FAZ 7 — Project Home / Overview Backend

### HMZ-PROJ-32 — Project Home base DTO/API

Project-only data:

- Header
- Status/priority
- Organization
- Managers
- Team count
- Squad count
- Criteria progress
- Repository summary

### HMZ-PROJ-33 — Work Service summary contract integration

Work Service hazırsa public query contract ile:

- Task counts by status
- Due Soon
- Overdue
- Open issues
- Progress

Work Service hazır değilse doğrudan repository erişme veya duplicate task model yazma.

### HMZ-PROJ-34 — Recent activity integration

Hazır public contract varsa Project Home'a recent activity eklenir.

Yoksa bu subtask dependency olarak açık bırakılır; Project Service kendi sahte Activity DB'sini oluşturmaz.

### HMZ-PROJ-35 — Repository activity integration

- Latest commits card data
- Last repository activity
- GitHub unavailable state

### HMZ-PROJ-36 — Admin Project overview contract

Auth/Admin modülü için safe project summary contract.

**FAZ 7 Gate:** Project Home backend, hazır bağımlılıkları güvenli contract'larla aggregate eder.

---

## FAZ 8 — Frontend Organization / Project / Membership

> Frontend gerçek klasör yapısı Faz 0'da doğrulanmadan yeni path uydurulmaz.

### HMZ-PROJ-37 — Organization UI

- Organization create
- List/detail
- Edit
- Archive
- Organization project list

### HMZ-PROJ-38 — Project create/list/detail UI

- Create form
- Project list
- Project detail shell
- Slug routing
- Loading/empty/error

### HMZ-PROJ-39 — Project members UI

- Member list
- Role badges
- Remove member
- Role assignment
- PM protection states

### HMZ-PROJ-40 — Invite Member UI

- Nickname/email search
- Search results
- Initial role selection
- Send invite
- Pending invitation list
- Resend/cancel
- Accept/reject flow

### HMZ-PROJ-41 — Squad UI

- Squad list/detail
- Create/edit/archive
- Add/remove project members

**FAZ 8 Gate:** Organization → Project → Member/Invite → Squad temel browser flow gerçek backend ile çalışır.

---

## FAZ 9 — Frontend Project Settings / Home / Repository

### HMZ-PROJ-42 — Project Settings UI

- Name/description
- Organization
- Status
- Priority
- Dates
- Goal
- Tech Stack
- Archive action + confirmation

### HMZ-PROJ-43 — Project Criteria UI

- Criteria list
- Create/edit/delete
- Complete/uncomplete
- Reorder (UI standardı uygunsa)
- Progress summary

### HMZ-PROJ-44 — Repository Settings UI

- Public GitHub repo URL
- Connect
- Validate
- Current repo summary
- Disconnect/change
- Private repo için V2 açıklaması gerekiyorsa sade UI mesajı

### HMZ-PROJ-45 — Project Home UI

Project Home minimum:

- Header
- Project status/priority
- Goal
- Deadline
- Criteria progress
- Members/squads
- Task summary (contract hazırsa)
- Issues summary (contract hazırsa)
- Recent activity (contract hazırsa)
- Repository card

### HMZ-PROJ-46 — Latest Commits Widget

- Son 5-10 commit
- Short SHA
- Message
- Author
- Time
- Commit link
- Refresh
- Loading/error/rate-limit states

**FAZ 9 Gate:** Project management ana ekranı responsive, gerçek API ile ve mock bırakmadan çalışır.

---

## FAZ 10 — Authorization / Security / Edge Cases

### HMZ-PROJ-47 — Project authorization matrix tests

Minimum:

- PM project mutation allowed
- Moderator project settings denied
- Moderator membership mutation denied
- Contributor settings mutation denied
- Cross-project access denied
- Non-member denied
- Last PM protection

### HMZ-PROJ-48 — Invitation security tests

- Token hash
- Expired/reused token
- Unauthorized resend/cancel
- Cross-user/cross-project accept
- Rate limit baseline

### HMZ-PROJ-49 — Repository integration security tests

- SSRF-safe URL handling
- Unsafe host rejected
- Redirect behavior güvenli
- GitHub error body internal detail leak yok
- No GitHub credential/token logging

### HMZ-PROJ-50 — Validation / ProblemDetail pass

- Validation errors
- 401
- 403
- 404
- 409
- Safe external integration error
- Consistent ProblemDetail

**FAZ 10 Gate:** Security ve authorization suite yeşil.

---

## FAZ 11 — E2E / Regression / Documentation Gate

### HMZ-PROJ-51 — Backend regression

- Unit
- Service
- Repository
- Validation
- Security
- MockMvc/API
- Integration
- Testcontainers PostgreSQL
- Modulith architecture tests

### HMZ-PROJ-52 — Project E2E

Minimum gerçek akışlar:

```text
Login → Create Organization → Create Project → creator becomes PROJECT_MANAGER
Create Project → Edit Settings → Add Criteria → Complete Criterion
Search User → Invite → Accept → Membership
PROJECT_MANAGER → Assign Role → Member sees project
PROJECT_MANAGER → Create Squad → Add Member
MODERATOR → Project Settings change denied
Contributor → Membership mutation denied
PROJECT_MANAGER → Connect Public GitHub Repo → Latest Commits visible
PROJECT_MANAGER → Archive Project
```

Work Service hazırsa:

```text
Project Home → Task summary / Issue summary / Progress
```

akışı da E2E'ye eklenir.

### HMZ-PROJ-53 — Frontend final pass

- Build
- Lint
- Type-check
- Responsive
- Loading/empty/error
- Confirmation dialog
- Role-sensitive UI
- Accessibility basics
- TR/EN integration mevcut proje standardına göre

### HMZ-PROJ-54 — Docs / handoff

Gerçek tamamlanan implementasyona göre:

- Project docs güncelle
- API docs güncelle
- ER/database docs gerekiyorsa güncelle
- Yeni ENV varsa yalnız onay sonrası `.env.example`
- Swagger kontrol adımları
- GitHub public integration davranışı
- V2 private repo sınırı
- `docs/compliation/YYYY-MM-DD-project-service.md`
- Test sonuçları
- Açık risk/borç

**Final Gate:** pre-push quality gate başarılı olmadan push önerilmez.

---

# 16. Git / branch çalışma standardı

Örnek:

```text
feature/HMZ-PROJ-01-project-persistence
feature/HMZ-PROJ-02-organization
feature/HMZ-PROJ-06-project-membership
feature/HMZ-PROJ-13-invitation-persistence
feature/HMZ-PROJ-17-squad
feature/HMZ-PROJ-22-project-criteria
feature/HMZ-PROJ-26-repository-connection
feature/HMZ-PROJ-32-project-home-api
feature/HMZ-PROJ-38-project-ui
feature/HMZ-PROJ-46-latest-commits-ui
```

Kurallar:

- Bir PR mümkün olduğunca tek task ID
- Unrelated refactor yok
- Shared/high-conflict dosya değişikliği önceden raporlanır
- Migration numarası Alper'in paralel auth migration'larıyla çakıştırılmaz
- Auth role/public contract değişikliği önce contract sahibiyle koordine edilir
- Work Service public contract hazır olmadan repository boundary delinmez
- PR öncesi ilgili test/build suite çalıştırılır
- Push/merge insan geliştirici tarafından yapılır

---

# 17. Codex için zorunlu çalışma kuralları

Codex her taskta aşağıdaki sırayı uygular.

## Task öncesi

1. `AGENTS.md` oku.
2. `.agents/SECURITY.md`, `.agents/architecture.md`, `.agents/folder-structure.md` oku.
3. Task Project/Squad/Organization ise ilgili database/API/ER/ADR belgelerini oku.
4. `hamza.md` dosyasını oku.
5. Plan belgesini uygulanmış kod kabul etme; gerçek source tree'yi incele.
6. Doğru path'i kendin bul; var olmayan klasör/dosya uydurma.
7. Dependency'leri doğrula.
8. Dokunulacak dosyaları listele.
9. Migration gerekip gerekmediğini söyle.
10. API contract etkisini söyle.
11. Auth/User public contract etkisini söyle.
12. Work Service dependency etkisini söyle.
13. Shared/config conflict riskini söyle.
14. Test planını yaz.
15. Acceptance criteria'yı yaz.
16. Onay gereken mimari/config değişikliği varsa kodlama yapmadan dur.

## Özellikle DUR ve onay iste

Aşağıdakilerden biri gerekiyorsa:

- `.env` değişikliği
- `.env.example` değişikliği
- Yeni secret/env variable
- Yeni root `com.pda.organization` Modulith modülü açmak
- Auth Service role enum/policy contract'ını değiştirmek
- Auth/User repository/entity'sine doğrudan erişmek
- Work/Task repository/entity'sine doğrudan erişmek
- `shared` içine domain logic taşımak
- Global security config değiştirmek
- `pom.xml` dependency eklemek/değiştirmek high-conflict yaratıyorsa
- Flyway migration numarası paralel branch ile çakışabilecekse
- Project hard delete eklemek
- Private GitHub repo/token/GitHub App eklemek
- Arbitrary external URL fetch etmek
- Mail/notification root package'larını silmek/taşımak
- Mimari plandan başka bir sapma gerekiyorsa

## Task sonrası

Codex şu raporu üretir:

```text
Task ID:
Durum:
Tamamlanan değişiklikler:
Değişen dosyalar:
Migration:
ENV etkisi:
API/endpointler:
Auth/role gereksinimleri:
Cross-module contract etkisi:
GitHub integration etkisi:
Çalıştırılan testler:
Sonuçlar:
Açık risk/borç:
Sonraki task için handoff:
```

---

# 18. CODEX MASTER PROMPT

Aşağıdaki prompt yeni bir Codex oturumunun başında kullanılabilir.

```text
PDA — Project Delivery Assistant üzerinde çalışıyorsun.

Ben Hamza'yım ve Project Service'in sahibiyim. Bu projede mikroservis gibi servis sahipliği kullanıyoruz ancak gerçek mimari Modular Monolith + Spring Modulith'tir. Ayrı deploy edilen project microservice oluşturma.

BENİM ANA SCOPE'UM:
- backend/src/main/java/com/pda/project/**
- backend/src/main/java/com/pda/squad/**
- bu alanların backend testleri
- ilgili frontend organization/project/member/invitation/squad/settings/home feature'ları
- gerekli Project Service Flyway migration'ları

Organization V1'de Project Service'in parçasıdır. Mevcut root organization package yoksa kendiliğinden com.pda.organization diye yeni Spring Modulith module oluşturma. Önce gerçek yapıyı incele ve organization'ı project altında konumlandır.

shared/** ortak alandır; Project domain kodunu oraya taşıma ve gereksiz değişiklik yapma.

ÖNCE MUTLAKA OKU:
1. AGENTS.md
2. .agents/SECURITY.md
3. .agents/architecture.md
4. .agents/folder-structure.md
5. .agents/api.md
6. .agents/database.md
7. .agents/er-diagram.md
8. .agents/authentication.md
9. .agents/decisions/0001-modular-monolith.md
10. .agents/decisions/0002-postgresql.md
11. docs/compliation/ içindeki ilgili önceki teslimler
12. hamza.md

Plan dosyalarını uygulanmış kod sanma. Önce gerçek repo tree'sini ve mevcut kodu incele. Doğru dosya yollarını kendin bul. Var olmayan path, class veya config uydurma.

YENİ KİLİTLİ PROJECT SERVICE KARARLARI:
- Project Service = project + squad + project altındaki organization/invitation/membership/repository integration alanları.
- Organization V1'de opsiyoneldir; standalone project oluşturulabilir.
- Organization hafif container'dır; V1'de ayrı enterprise organization permission matrix yoktur.
- Project create/edit/view/settings/lifecycle/archive Project Service kapsamındadır.
- Project hard delete V1'de yok; delete UX sonucu archive semantics kullanır.
- Project creator otomatik PROJECT_MANAGER olur.
- Aktif project en az bir PROJECT_MANAGER tutar.
- ProjectMembership Project Service persistence sorumluluğudur.
- Canonical role definitions Auth Service'e aittir; Project Service user-project role assignment'ını tutar.
- Kullanıcı arama Auth/User public contract üzerinden yapılır; User repository/entity'sine doğrudan erişme.
- ProjectInvitation kayıtlı/kayıtsız kullanıcıyı membership'e taşır; token plaintext persist edilmez.
- Squad Project Service'in parçasıdır; yalnız project member squad'a eklenebilir; squad authorization rolü vermez.
- Project Settings; name, description, organization, status, priority, dates, goal, tech stack ve repository connection içerir.
- Project Success Criteria project-level checklist olarak yönetilir; task değildir.
- Project Home genel süreç takibini gösterir.
- Task/Issue/Activity verisi Work Service public contract üzerinden okunur; repository/entity'sine doğrudan erişme.
- Public GitHub repository bağlantısı V1'dedir.
- Project Home son 5-10 public GitHub commitini gösterebilir.
- GitHub integration read-only'dir.
- Private repository, GitHub App, webhook, PR/CI entegrasyonu V2'dir.
- GitHub kullanıcı login'i Auth Service konusudur; repository integration ile karıştırma.
- Arbitrary URL fetch etme; public GitHub URL'lerini allowlist + parse ile doğrula.
- Project'e özel mail/notification use-case'leri Project Service içinde ele alınır; ayrı deploy edilen service oluşturma. Ortak transport adapter varsa reuse et.

PROJECT ROLLERİ AUTH SERVICE'TE CANONICALDIR:
- PROJECT_MANAGER
- MODERATOR
- BACKEND_DEVELOPER
- FRONTEND_DEVELOPER
- FULL_STACK_DEVELOPER
- AI_ML_DEVELOPER
- UI_UX_DEVELOPER
- TESTER
- ANALYST

PROJECT_MANAGER:
- project create/settings/lifecycle/archive
- member invite/remove
- role assignment
- squad management
- project criteria management
- repository connection management
- task management yetkisi Work Service tarafından project membership contract ile doğrulanır

MODERATOR:
- task operasyonlarında PM yardımcısıdır
- project create/archive/settings/member/role/squad/repository/criteria yönetemez

CONTRIBUTOR ROLLER:
- project view/home access
- project management mutation yapamaz
- Work Service kendi task/test capability kurallarını uygular

GÜVENLİK:
- Backend authorization source-of-truth'tur.
- Deny-by-default.
- Cross-project erişimi engelle.
- User input'u SQL'e concat etme.
- JPA/parameterized query kullan.
- Secret/token loglama.
- Invitation token hash sakla.
- ProblemDetail standardını koru.
- GitHub arbitrary URL fetch yapma; SSRF-safe allowlist kullan.
- External API hatalarında internal detay leak etme.

ÖNEMLİ ONAY KURALI:
.env/.env.example, yeni ENV/secret, yeni root Modulith module, Auth role contract değişikliği, Work/Auth repository boundary ihlali, shared/high-conflict dosya, Project hard delete, private GitHub repo/GitHub App veya yeni dependency gerektiğinde önce raporla ve kullanıcı onayı almadan değiştirme.

Git push, merge, release veya GitHub repo ayarı yapma.

HER TASK ÖNCESİ ŞUNU ÇIKAR:
- Task ID / amaç
- Dependency hazır mı?
- Mevcut kod durumu
- Dokunulacak gerçek dosyalar
- Migration ihtiyacı
- ENV/config etkisi
- API contract etkisi
- Auth/User contract etkisi
- Work Service dependency etkisi
- Security etkisi
- Conflict riski
- Test planı
- Acceptance criteria

Sonra yalnız o task'ın scope'unda implementasyon yap.

HER TASK SONRASI ŞUNU ÇIKAR:
- Tamamlananlar
- Değişen dosyalar
- Migration
- ENV etkisi
- Endpointler ve auth/role gereksinimleri
- Cross-module contract etkisi
- GitHub integration etkisi
- Test komutları ve sonuçları
- Açık riskler
- Bir sonraki task handoff'u

Şu anda sadece bana verdiğim task ID üzerinde çalış. Sonraki faza kendiliğinden geçme.
```

---

# 19. İlk çalışma promptu — bugün başlamak için

Önce yalnız **FAZ 0 / HMZ-PROJ-00** çalıştırılması önerilir.

```text
PDA repo'sunda hamza.md dosyasını ve AGENTS.md tarafından işaret edilen zorunlu belgeleri oku.

Sadece HMZ-PROJ-00 — Source-of-truth audit görevini yap.

Henüz kod değiştirme.

Şunları doğrula ve raporla:
1. backend/src/main/java/com/pda/project gerçek içeriği
2. backend/src/main/java/com/pda/squad gerçek içeriği
3. project altında organization/membership/invitation/repository integration için mevcut yapı olup olmadığı
4. mevcut Project / ProjectMembership / Squad entity veya migration olup olmadığı
5. backend/src/main/resources/db/migration içindeki son gerçek migration
6. mevcut project role/authorization modeli
7. Auth/User tarafında Project Service'in kullanabileceği public contract/facade olup olmadığı
8. Work/Task tarafında Project Home summary için kullanılabilecek public read contract olup olmadığı
9. frontend içindeki mevcut organization/project/member/invitation/squad/settings/home yapı ve gerçek path'ler
10. mevcut HTTP client / RestClient / WebClient benzeri altyapı ve GitHub public REST entegrasyonu için yeni dependency gerekip gerekmediği
11. mevcut mail/notification package'larının gerçek kod mu placeholder mı olduğu
12. Project invitation için kullanılabilecek ortak mail transport/adapter olup olmadığı
13. yeni ENV ihtiyacı olup olmadığı — public GitHub V1 için secret gerektirmeyen yaklaşımı önceliklendir
14. shared/high-conflict dosyalara dokunma gereksinimi
15. Alper'in auth migration/contract çalışmasıyla conflict riski
16. eski plan belgeleriyle hamza.md arasındaki bilinçli supersede edilen noktalar
17. HMZ-PROJ-01 için önerilen gerçek dosya scope'u ve test planı

.env, .env.example, pom.xml, global security config veya migration üzerinde değişiklik yapma. Yeni root organization modülü oluşturma. Mail/notification package'larını silme/taşıma. Yalnız keşif raporu ver ve HMZ-PROJ-01 başlamadan önce benden onay bekle.
```

---

# 20. Definition of Done — Project Service

Project Service tamamlandı denebilmesi için minimum:

- [ ] Organization create/view/update/archive çalışıyor
- [ ] Organization opsiyonel; standalone project çalışıyor
- [ ] Project create/list/detail/update çalışıyor
- [ ] Unique slug çalışıyor
- [ ] Project creator otomatik PROJECT_MANAGER oluyor
- [ ] Project hard delete yerine archive uygulanıyor
- [ ] Project status/priority/date/settings yönetimi çalışıyor
- [ ] ProjectMembership çalışıyor
- [ ] Duplicate membership engelli
- [ ] Last Project Manager protection çalışıyor
- [ ] Auth role contract ile project role assignment çalışıyor
- [ ] PROJECT_MANAGER authorization testli
- [ ] MODERATOR project-management kısıtları testli
- [ ] Contributor mutation kısıtları testli
- [ ] Cross-project access engelli
- [ ] Nickname/email kullanıcı arama contract üzerinden çalışıyor
- [ ] Registered user invitation çalışıyor
- [ ] Unregistered email invitation çalışıyor
- [ ] Invitation token plaintext persist edilmiyor
- [ ] Invite accept membership üretiyor
- [ ] Squad CRUD/archive çalışıyor
- [ ] Yalnız project member squad'a ekleniyor
- [ ] Squad role/authorization kaynağı değil
- [ ] Project Success Criteria çalışıyor
- [ ] Project lifecycle/archive çalışıyor
- [ ] Project Home temel verileri çalışıyor
- [ ] Work Service hazırsa task/issue/progress summary public contract ile çalışıyor
- [ ] Public GitHub repository bağlama çalışıyor
- [ ] GitHub URL allowlist/SSRF güvenliği testli
- [ ] Son 5-10 commit UI'da gösteriliyor
- [ ] GitHub API error/rate-limit UI state'i mevcut
- [ ] Private repo/GitHub App V1'e sızmamış
- [ ] Project invitation mail/notification core akışı bozmayacak şekilde entegre
- [ ] Organization/Project/Member/Invite/Squad frontend gerçek backend ile çalışıyor
- [ ] Project Settings/Criteria/Home/Repository frontend çalışıyor
- [ ] Loading/empty/error/confirmation states mevcut
- [ ] Backend regression yeşil
- [ ] Frontend build/lint/type-check yeşil
- [ ] Kritik Playwright E2E akışları yeşil
- [ ] Swagger/API davranışı güncel
- [ ] Completion/handoff dokümanı yazılmış
- [ ] Pre-push quality gate başarılı

---

## Son kural

**Tek seferde bütün Project Service'i yazma.**

Sıra:

```text
FAZ 0
→ FAZ 1 Project + Organization
→ FAZ 2 Membership + Roles
→ FAZ 3 User Search + Invitation
→ FAZ 4 Squad
→ FAZ 5 Settings + Criteria + Lifecycle
→ FAZ 6 GitHub Public Repo
→ FAZ 7 Project Home Backend
→ FAZ 8 Frontend Core
→ FAZ 9 Frontend Home/Repository
→ FAZ 10 Security
→ FAZ 11 E2E / Regression / Docs
```

Her faz sonunda test + kullanıcı kontrolü + handoff yapılır. Onay olmadan bağımlı sonraki faza geçilmez.
