# PDA — Profile Photo Feature + Full Regression & Security Audit

PDA (**Project Delivery Assistant**) projesinde iki aşamalı bir çalışma yapılacak.

## Aşama 1
Kullanıcıların hesap ayarlarından profil fotoğrafı yükleyebilmesini sağla.

## Aşama 2
Bu özellik dahil olmak üzere son dönemde PDA üzerinde geliştirilen ana modüller ve akışlar için genel bir:

- regression kontrolü
- integration kontrolü
- authorization kontrolü
- security audit
- frontend/backend validation
- build/test doğrulaması

gerçekleştir.

Bu görevde yalnızca rapor çıkarma.

Bulduğun gerçek bug, güvenlik açığı, eksik validation veya regression'ları mevcut mimariyi bozmadan düzelt.

Ancak gereksiz feature creep yapma.

---

# 1. Önce Repository'yi İncele

Kod yazmadan önce mevcut repository'nin gerçek durumunu çıkar.

Özellikle incele:

- Auth / User
- Account Settings / Settings
- Navbar user menu
- Sidebar
- Project Service
- ProjectMembership
- Teams
- Project Invitations
- External Invitations
- Notification Service
- Calendar / Reminders
- Organizations
- Projects page
- Project settings
- Project preview
- Project banner desteği mevcutsa
- Theme / language / animation preferences
- file upload/storage altyapısı
- mevcut MinIO / S3 / local object storage abstraction'ı
- security configuration
- Spring Modulith boundaries
- Flyway migrations
- Next.js frontend architecture
- API client
- query/cache yapısı
- test altyapısı

Mevcut file upload çözümünü özellikle bul.

Profil fotoğrafı için ikinci bir storage sistemi oluşturma.

---

# AŞAMA 1 — PROFILE PHOTO

# 2. Amaç

Kullanıcı:

```text
Navbar
→ Ayarlar
→ Hesap / Profil
```

alanından kendisine bir profil fotoğrafı yükleyebilmeli.

Profil fotoğrafı kullanıcının hesabına ait global bir özelliktir.

Project'e özel olmamalıdır.

---

# 3. Ayarlar Sayfasına Profil Bölümü

Mevcut `Ayarlar` sayfasını incele.

Kullanıcı bilgileri/profil alanı varsa onun içerisinde profil fotoğrafı yönetimini ekle.

Örneğin:

```text
Profil

[ Avatar ]

Hamza Taşbay
hamza@example.com

[ Fotoğraf yükle ]
[ Fotoğrafı kaldır ]
```

Mevcut PDA design system'e uy.

Yeni ve tamamen ayrı bir account settings sayfası oluşturma.

---

# 4. Mevcut Navbar Avatar'ı ile Entegre Et

Navbar'da şu anda kullanıcının:

```text
H
HA
```

gibi baş harfi gösteriliyorsa:

Profil fotoğrafı varsa:

```text
profilePhotoUrl
→ image
```

göster.

Profil fotoğrafı yoksa mevcut initial fallback devam etsin.

Örnek:

```text
profile photo exists
→ photo

profile photo missing
→ H
```

Bu davranışı reusable avatar component içerisinde merkezi hale getirmeyi değerlendir.

Aynı avatar mantığını farklı yerlerde duplicate etme.

---

# 5. Proje / Team Üyelerinde de Kullanılabilsin

Profil fotoğrafı user-level bir özellik olduğundan mevcut user summary response'ları uygunsa:

- Team members
- Project member listeleri
- invitation sender
- project manager
- navbar

gibi yerlerde aynı avatar component kullanılabilsin.

Ancak bu task kapsamında bütün uygulamayı görsel olarak refactor etme.

Mevcut kullanıcı avatarı gösterilen yerlerde profile photo desteğini doğal şekilde entegre et.

Fallback yine initial olmalı.

---

# 6. User Model

Mevcut User/Profile modelini incele.

Profil fotoğrafı için uygun minimum alan ekle.

Örneğin:

```text
profileImageKey
```

veya:

```text
profilePhotoPath
```

veya mevcut media/storage abstraction'ına uygun model.

Mümkünse database'de full hardcoded public URL saklama.

Storage key/object path saklamak daha doğruysa onu kullan.

Mevcut proje standardına uy.

---

# 7. Storage

Mevcut projede:

- MinIO
- S3-compatible storage
- file service
- media service

varsa onu kullan.

Yeni disk tabanlı veya Base64 DB storage çözümü oluşturma.

Profil fotoğrafını database BLOB olarak saklama, mevcut architecture açıkça öyle çalışmıyorsa.

---

# 8. Upload API

Mevcut API convention'a uygun endpoint oluştur.

Kavramsal olarak:

```http
POST /api/v1/users/me/profile-photo
```

veya mevcut `/me`, `/profile`, `/account` standardına uygun path.

Authenticated user backend tarafından belirlenmeli.

Request içerisinde:

```text
userId
```

alma.

Kullanıcı yalnızca kendi profil fotoğrafını değiştirebilmeli.

---

# 9. Delete Profile Photo

Profil fotoğrafını kaldırma desteği ekle.

Örneğin:

```http
DELETE /api/v1/users/me/profile-photo
```

Fotoğraf kaldırıldığında:

- DB referansı temizlenmeli
- storage object gerekiyorsa temizlenmeli
- frontend initial fallback'e dönmeli

---

# 10. Replace Davranışı

Kullanıcı yeni bir profil fotoğrafı yüklediğinde eski fotoğraf orphan olarak storage'da kalmamalı.

Güvenli akış:

```text
upload new
→ validate
→ persist new reference
→ delete old object
```

veya mevcut storage transaction davranışına uygun güvenli eşdeğer çözüm.

Yeni upload başarısızsa mevcut profil fotoğrafını kaybetme.

---

# 11. Desteklenen Dosya Türleri

Profil fotoğrafında yalnız güvenli image türlerini kabul et.

Örneğin:

```text
image/jpeg
image/png
image/webp
```

SVG kabul etme.

SVG aktif içerik/XSS riski oluşturabileceğinden profile photo için destekleme.

Client filename extension'a güvenme.

Backend:

- MIME type
- gerçek content/signature

kontrolünü mevcut upload altyapısının imkanları dahilinde doğrulasın.

---

# 12. Boyut Limiti

Profil fotoğrafı için makul maksimum file size belirle.

Örneğin:

```text
5 MB
```

Mevcut upload config standardına daha uygun limit varsa onu kullan.

Frontend kullanıcı deneyimi için önceden kontrol edebilir.

Backend kesin olarak enforce etmelidir.

---

# 13. Image Dimensions

Aşırı büyük resolution'lı image uploadlarına karşı koruma değerlendir.

Örneğin:

```text
10000x10000
```

gibi görüntüler memory/processing problemi yaratmamalı.

Mevcut image processing altyapısı varsa dimension validation ekle.

Yoksa sırf bunun için ağır image-processing dependency ekleme; ancak file size ve content validation kesin olsun.

---

# 14. File Name Güvenliği

Kullanıcının verdiği raw filename'i storage object adı olarak doğrudan kullanma.

Örneğin:

```text
../../evil.png
```

gibi path traversal girişimlerine karşı güvenli ol.

Server-generated unique object key kullan.

Örneğin UUID/random key.

---

# 15. Cache

Profil fotoğrafı değiştirildiğinde eski görsel browser/CDN cache yüzünden görünmeye devam etmemeli.

Mevcut media URL yaklaşımına göre:

- object key değişimi
- version parameter
- cache invalidation

gibi temiz bir çözüm kullan.

---

# 16. Frontend Upload UX

Ayarlar ekranında:

```text
Fotoğraf seç
```

aksiyonu olsun.

Dosya seçildikten sonra mümkünse küçük preview göster.

Kullanıcı yüklemeyi onayladığında API çağrısı yapılsın.

Mevcut design system'e göre modal veya inline UI kullan.

Gereksiz image editor/cropper özelliği ekleme.

---

# 17. Loading / Error

Upload sırasında:

- button loading
- double submit prevention

sağla.

Hata durumlarında kullanıcıya anlaşılır mesaj göster.

Örneğin:

```text
Dosya türü desteklenmiyor.
Dosya en fazla 5 MB olabilir.
Profil fotoğrafı yüklenemedi.
```

Backend teknik exception mesajını direkt kullanıcıya basma.

---

# 18. User Summary

Frontend'in kullanıcı fotoğrafını gösterebilmesi için mevcut user summary contractlarında gerektiği kadar:

```text
profilePhotoUrl
```

veya eşdeğer read-only alan döndür.

Hassas storage metadata expose etme.

Örneğin internal bucket/key'e frontend doğrudan ihtiyaç duymuyorsa onu expose etme.

---

# 19. Authorization

Profil fotoğrafı endpointleri:

```text
current authenticated user
```

üzerinden çalışmalı.

Normal kullanıcı başka kullanıcı için:

```http
POST /users/{otherUserId}/profile-photo
```

benzeri bir açık endpoint üzerinden fotoğraf değiştirememeli.

ADMIN için ayrıca böyle bir ihtiyaç mevcut değilse ekleme.

---

# 20. Profile Photo Security Tests

En az şu senaryoları test et:

- valid JPEG upload
- valid PNG upload
- valid WebP upload
- oversized file reject
- unsupported file reject
- SVG reject
- fake extension reject
- unauthenticated upload reject
- başka user'ın fotoğrafını değiştirme girişimi reject
- replace düzgün çalışır
- delete düzgün çalışır
- delete sonrası initial fallback
- old object cleanup
- upload failure eski fotoğrafı bozmaz

---

# AŞAMA 2 — FULL SYSTEM REGRESSION & SECURITY AUDIT

# 21. Amaç

Son dönemde PDA üzerinde geliştirilen ana feature'ların birlikte düzgün çalıştığını doğrula.

Yalnız happy-path test yapma.

Şunları kontrol et:

```text
authorization
authentication
cross-project isolation
IDOR
role escalation
input validation
file upload
XSS
duplicate operations
race conditions
token handling
data exposure
frontend route guards
backend permission enforcement
```

---

# 22. Auth / User Audit

Kontrol et:

- register
- login
- logout
- refresh/session
- password hashing
- email uniqueness
- user data exposure
- profile photo
- authenticated `/me` davranışı

Password/token response'larda yanlışlıkla expose edilmiyor mu kontrol et.

---

# 23. IDOR Testleri

Özellikle aşağıdaki kaynaklarda başka user/project ID'si verilerek veri erişiminin engellendiğini doğrula:

- Project
- ProjectMembership
- Team
- TeamMembership
- Invitation
- Reminder
- Profile Photo
- Project settings
- Project preview

Örneğin:

```text
User A → Project A member

User A tries:
Project B teamId
Project B reminderId
User B invitationId
User B profile resource
```

Backend erişimi reddetmelidir.

Frontend gizleme yeterli değildir.

---

# 24. Project Authorization Audit

Mevcut ProjectPermission sistemini kontrol et.

Özellikle:

```text
PROJECT_MANAGER
normal member
```

ayrımı.

Test et:

- project update
- project settings
- team create/edit/delete
- member role update
- project member removal
- invitation create/cancel
- PROJECT reminder create/edit/delete

Normal user request'i elle manipüle ederek manager operasyonu yapamamalı.

---

# 25. Role Escalation

Client'tan gelen role bilgisine gereksiz güveniliyor mu kontrol et.

Özellikle invitation kabulünde:

```text
invited role
```

backend'deki invitation kaydından gelmelidir.

User request body'de:

```text
PROJECT_MANAGER
```

göndererek kendini yükseltememelidir.

Project role update endpoint'inde actor permission doğrulaması olmalıdır.

---

# 26. Teams Regression

Kontrol et:

- General Team
- custom teams
- nested teams
- team members page
- add member
- remove from team
- remove from project
- role editing

Kurallar:

```text
Remove from Team ≠ Remove from Project
```

olmalı.

Circular hierarchy engellenmeli.

Başka project member'ı team'e eklenememeli.

---

# 27. Invitation Regression

Hem:

```text
registered user invitation
```

hem:

```text
external invitation
```

akışını test et.

Kontrol et:

- global Invitations page
- project invitation management
- accept
- reject
- rejection message
- resend
- cancel
- project preview
- invitation message
- selected role
- team/general team behaviour

---

# 28. Invitation Token Security

External invitation tokenları için kontrol et:

- secure entropy
- DB'de raw token yok
- expiration
- single-use
- cancelled token reject
- accepted token reuse reject
- invalid token reject

Raw token:

- loglarda
- exception'da
- frontend analytics'te

sızmamalı.

---

# 29. External Registration Security

Invitation üzerinden kayıt sırasında:

- invitation email doğrulanmalı
- firstName/lastName mevcut requirement'a göre doğrulanmalı
- existing account race case yönetilmeli
- duplicate account oluşmamalı
- signup password validation bypass edilmemeli
- role invitation kaydından gelmeli
- project membership otomatik doğru oluşturulmalı
- General Team membership oluşmalı

---

# 30. Reminder Security & Regression

Kontrol et:

## PERSONAL

- yalnız creator görür
- yalnız creator edit/delete eder

## PROJECT

- tüm project members görebilir
- yalnız gerekli management permission ile create/edit/delete

Normal user:

```json
{
  "scope": "PROJECT"
}
```

göndererek authorization bypass edememeli.

---

# 31. Reminder Cross-Project Isolation

Şu senaryoyu test et:

```text
Project A Reminder R

GET /projects/B/reminders/R
```

başarısız olmalı.

Aynı kontrol update/delete için de yapılmalı.

---

# 32. Calendar Regression

Kontrol et:

- reminder doğru tarihte
- icon doğru type
- reminder varsa date number yerine icon davranışı
- hover title
- multiple reminder behaviour
- home calendar
- main calendar
- timezone/date-only davranışı

Date-only değerlerin timezone nedeniyle bir gün kaymadığını doğrula.

---

# 33. Notification Regression

Notification Service için en az:

- unread count
- read
- read-all
- pagination
- recipient isolation
- project invitation notifications
- task assignment notifications
- role change notifications

mevcut implementasyon kadar test et.

Başka user'ın notification'ı read edilememeli.

---

# 34. Task Regression

Task Service mevcut completed feature olduğu için temel regression yap.

Özellikle:

- task creation
- assignment
- multiple assignee
- only project members assigned
- assignment notification
- unauthorized access
- cross-project access

Task behaviour'ını bu audit sırasında refactor etme; gerçek bug varsa minimum fix yap.

---

# 35. Organizations Regression

Organization popup kaldırma/refactor sonrası:

- create organization
- edit organization
- navigation
- archive/delete mevcutsa
- authorization

çalışıyor mu kontrol et.

Eski dialog'a bağlı dead code kalmadığını doğrula.

---

# 36. Navbar / Sidebar Regression

Kontrol et:

- navbar bütün authenticated sayfalarda tutarlı
- fixed/sticky behaviour
- sidebar global navigation
- selected project navigation
- global Invitations
- Settings
- Project Settings edit icon
- Teams active route
- Calendar
- collapsed sidebar

Route active state hatalarını kontrol et.

---

# 37. Settings Regression

Yeni Settings sayfasında:

- language
- theme
- animations
- profile photo

çalışmalı.

Persistence davranışını test et.

Refresh sonrası tercihlerin mevcut tasarıma göre korunması gerekiyorsa korunmalı.

---

# 38. Theme Security / Stability

Theme switching security konusu olmaktan çok stability konusudur.

Kontrol et:

- hydration mismatch
- flashing
- circular transition
- reduced motion
- animation disabled
- System theme
- Light
- Dark

Browser unsupported View Transition API durumunda fallback düzgün olmalı.

---

# 39. XSS / Text Input Audit

Kullanıcı tarafından girilebilen metin alanlarını incele:

- project name
- project description
- invitation message
- rejection message
- reminder title
- reminder description
- team name
- organization data
- display name / nickname

Şunları test et:

```html
<script>alert(1)</script>
<img src=x onerror=alert(1)>
```

Next.js/React escaping'i bypass eden:

```text
dangerouslySetInnerHTML
```

kullanımları varsa özellikle incele.

Rich text ihtiyacı yoksa raw HTML render etme.

---

# 40. SQL Injection

Spring Data/JPA kullanımını kontrol et.

Native query/dynamic SQL kullanılan yerleri özellikle incele.

User input string concatenation ile SQL oluşturulmamalı.

Mevcut prepared/JPA query yaklaşımını koru.

---

# 41. File Upload Security

Hem:

- profile photo
- project banner

upload akışlarını audit et.

Kontrol et:

- MIME validation
- extension spoofing
- file size
- path traversal
- overwrite
- unauthorized upload
- unauthorized delete
- object enumeration
- executable/SVG content

---

# 42. Project Banner Regression

Banner feature mevcutsa:

- upload
- replace
- remove
- project detail
- project preview
- invitation project preview
- authorization
- storage cleanup

test et.

Profile photo ve project banner storage kodlarının güvenlik davranışı tutarlı olmalı.

---

# 43. Sensitive Data Exposure

Backend DTO'larını incele.

Frontend'e gereksiz:

- password hash
- reset tokens
- invitation token hash
- refresh tokens
- internal storage key
- internal security metadata

dönmediğini doğrula.

---

# 44. API Error Leakage

Production response'larda:

- stack trace
- SQL query
- internal path
- class names
- secrets

gereksiz expose edilmemeli.

Mevcut global exception handler'ı kontrol et.

---

# 45. CORS / CSRF / Session

Mevcut authentication modeline göre incele.

JWT Bearer ise CORS configuration'ı kontrol et.

Cookie auth varsa:

- Secure
- HttpOnly
- SameSite
- CSRF strategy

mevcut mimariye göre değerlendir.

Mevcut auth architecture'ını sırf audit için baştan yazma.

---

# 46. Rate Limiting

Mevcut rate limiting altyapısı varsa özellikle:

- login
- register
- invitation token validation
- external registration
- upload endpoints

üzerinde doğru kullanıldığını kontrol et.

Rate limiter yoksa bu audit kapsamında devasa yeni infrastructure ekleme.

Raporla; kritik ve kolay çözüm varsa minimum fix yap.

---

# 47. Pagination / Resource Exhaustion

List endpointlerini kontrol et:

- projects
- invitations
- notifications
- teams
- members
- reminders

Aşırı büyük:

```text
size=1000000
```

request'lerin engellendiğinden emin ol.

Mevcut maximum page size standardı varsa kullan.

---

# 48. Validation

DTO validation'ı genel olarak kontrol et.

Özellikle:

- max lengths
- blank values
- invalid enums
- malformed UUID
- invalid dates
- 100 char invitation message
- reminder title
- file size

Frontend validation backend validation yerine geçmemeli.

---

# 49. Database Constraints

Application logic ile korunması gereken kritik invariant'ların DB seviyesinde de korunduğunu kontrol et.

Örneğin:

```text
project_id + user_id unique membership
team_id + membership_id unique
duplicate pending invitation
```

Reminder için gerekli constraintler varsa kontrol et.

Duplicate/race condition risklerini değerlendir.

---

# 50. Spring Modulith Architecture

Architecture tests çalıştır.

Özellikle:

```text
project → auth repository
project → notification repository
project → task repository
```

gibi illegal internal dependency oluşmadığını doğrula.

Cross-module iletişim mevcut public contract/event yaklaşımıyla çalışmalı.

Profile Photo Auth/User alanında doğru ownership altında bulunmalı.

---

# 51. Frontend Route Security

Frontend route açılması security sayılmaz.

Ancak unauthorized kullanıcı:

- project settings
- team management
- invitation management

route'larına manuel URL ile gittiğinde UX düzgün olmalı.

Backend yine kesin erişimi reddetmeli.

---

# 52. Dependency Audit

Mevcut package manager üzerinden desteklenen dependency vulnerability audit varsa çalıştır.

Örneğin repo npm kullanıyorsa mevcut standarda göre:

```text
npm audit
```

veya:

```text
pnpm audit
```

Ancak dependency'leri kör şekilde major version'a yükseltme.

Bulunan vulnerability'leri:

```text
direct
transitive
severity
production/dev
```

olarak değerlendir.

Güvenli ve küçük patch mümkünse uygula.

Breaking upgrade gerekiyorsa raporla.

---

# 53. Secret Scan

Repository'de yanlışlıkla commit edilmiş olabilecek:

- API key
- password
- JWT secret
- SMTP credential
- object storage secret

gibi değerleri kontrol et.

`.env.example` placeholder içermeli.

Gerçek secret'ları output'a yazma.

Bir secret bulursan değeri final raporda tekrar etme.

Sadece dosya/konum ve remediation belirt.

---

# 54. Tests

Yeni testleri mevcut test mimarisine uygun yaz.

Her şeyi yalnız manual kontrol ile bırakma.

Backend için uygun yerlerde:

- unit
- repository
- integration
- security
- architecture

testleri ekle.

Frontend için:

- component
- hook
- page
- interaction
- E2E

mevcut altyapı kadar kullan.

---

# 55. E2E Critical User Journeys

Mevcut Playwright veya E2E altyapısı varsa en kritik akışları test et.

## Journey 1

```text
Register/Login
→ Settings
→ Profile photo upload
→ Navbar avatar changes
→ refresh
→ photo persists
```

## Journey 2

```text
Manager
→ invite registered user
→ user Invitations
→ project preview
→ accept
→ membership
```

## Journey 3

```text
Manager
→ external invite
→ email/token
→ register
→ correct role
→ General Team
```

## Journey 4

```text
Manager
→ project reminder
→ normal member calendar
→ reminder visible
```

## Journey 5

```text
normal member
→ personal reminder
→ another user
→ reminder NOT visible
```

## Journey 6

```text
manager
→ create team
→ add member
→ role management
```

---

# 56. Static Analysis

Mevcut tooling ile:

- lint
- TypeScript type-check
- Java compile warnings
- tests

çalıştır.

Unused/dead imports ve yeni feature'dan kalan stale code'u temizle.

---

# 57. Test Verisini Production'a Karıştırma

Security/regression testi için oluşturulan:

- users
- projects
- invitations
- reminders

yalnız test environment/database üzerinde çalışmalı.

Gerçek production DB üzerinde destructive security testing yapma.

---

# 58. Destructive Security Testing Yapma

Bu bir güvenlik doğrulaması olsa da:

- DoS
- destructive fuzzing
- data corruption
- credential brute force

yapma.

Test environment üzerinde güvenli validation yap.

---

# 59. Bulunan Sorunları Sınıflandır

Audit sırasında bulduğun sorunları severity ile sınıflandır:

```text
CRITICAL
HIGH
MEDIUM
LOW
```

Ancak gereksiz şekilde her küçük UI bug'ını security issue olarak etiketleme.

---

# 60. Fix Önceliği

Şu sırayı kullan:

```text
1. Authentication / Authorization vulnerability
2. Data leak / IDOR
3. Role escalation
4. Token / upload vulnerability
5. Data integrity
6. Functional regression
7. UI regression
8. Cleanup
```

Bir kritik güvenlik sorunu bulursan önce onu düzelt.

---

# 61. Mevcut Kullanıcı Kodunu Kaybetme

Repository'de staged/unstaged mevcut kullanıcı değişikliklerini koru.

Bu audit sırasında:

```text
git reset --hard
git checkout .
```

gibi destructive komutlar kullanma.

Conflict varsa iki tarafın gerekli kodunu koruyarak çöz.

---

# 62. Build Doğrulaması

Finalde mevcut projedeki ilgili tüm doğrulamaları çalıştır.

## Backend

- compile/build
- unit tests
- integration tests
- security tests
- architecture tests

## Frontend

- lint
- type-check
- unit/component tests
- E2E mevcutsa
- production build

Hataları yalnız raporlayıp bırakma.

Scope dahilindeki gerçek hataları düzelt.

---

# 63. Final Security Regression Pass

Fixlerden sonra testleri tekrar çalıştır.

Bir güvenlik problemi düzeltilirken başka feature'ın bozulmadığını doğrula.

Özellikle tekrar kontrol et:

```text
Auth
Projects
Teams
Invitations
Reminders
Notifications
Settings
Profile Photo
Project Banner
```

---

# 64. Görev Sonunda Teknik Rapor

Finalde aşağıdaki formatta rapor ver.

## Profile Photo

- backend modeli
- upload endpoint
- delete endpoint
- storage yaklaşımı
- frontend entegrasyonu
- avatar fallback

## Regression Test Summary

Kontrol edilen modülleri listele.

## Security Audit Summary

Aşağıdaki tablo formatını kullan:

```text
Severity | Area | Finding | Fix | Status
```

Secret/token gibi hassas değerleri yazma.

## Fixed Issues

Audit sırasında düzelttiğin gerçek sorunları listele.

## Remaining Issues

Bilerek çözülmeyen veya breaking-change gerektiren sorunları açıkla.

Yoksa:

```text
Kalan bilinen kritik/high güvenlik sorunu yok.
```

de.

## Backend Tests

Çalıştırılan test/build komutları ve sonuçları.

## Frontend Tests

Çalıştırılan lint/type-check/test/build sonuçları.

## E2E

Çalıştırılan kritik user journey'leri belirt.

## Database

Eklenen/değiştirilen migration varsa belirt.

## Changed Files

Önemli dosyaları listele.

## Architecture

Spring Modulith test sonucunu belirt.

---

# Kritik Kurallar

1. Önce repository'yi incele.
2. Profile Photo için mevcut storage altyapısını reuse et.
3. Profile photo user-level/global olmalı.
4. Kullanıcı yalnız kendi profil fotoğrafını değiştirebilmeli.
5. Navbar profile photo varsa onu göstermeli, yoksa initial fallback kullanmalı.
6. SVG profile photo kabul etme.
7. File type yalnız extension üzerinden doğrulanmamalı.
8. File size backend'de enforce edilmeli.
9. Raw filename storage path olarak kullanılmamalı.
10. Replace sırasında eski photo orphan bırakılmamalı.
11. Upload başarısızsa mevcut fotoğraf kaybolmamalı.
12. Profile photo user summary ile güvenli şekilde expose edilmeli.
13. Audit yalnız frontend kontrolü olmamalı; backend authorization kontrol edilmeli.
14. IDOR testleri mutlaka yapılmalı.
15. Cross-project isolation test edilmeli.
16. Role escalation test edilmeli.
17. Invitation token security test edilmeli.
18. Reminder PERSONAL / PROJECT visibility test edilmeli.
19. File upload security profile photo + project banner için test edilmeli.
20. XSS/input validation kontrol edilmeli.
21. Sensitive data exposure kontrol edilmeli.
22. Spring Modulith architecture testleri çalıştırılmalı.
23. Dependency vulnerability audit mümkünse çalıştırılmalı.
24. Secrets output'a yazılmamalı.
25. Gerçek production environment üzerinde destructive security test yapma.
26. Test sırasında kullanıcı kodunu resetleme veya kaybetme.
27. Bulunan gerçek bug/security problemlerini scope dahilinde düzelt.
28. Gereksiz büyük architecture refactor yapma.
29. Finalde fixlerden sonra full regression tekrar çalıştır.
30. Backend/frontend build tamamen geçmeden görevi tamamlanmış sayma.
