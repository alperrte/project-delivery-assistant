# PDA — Invitations End-to-End Integration Audit

PDA projesindeki davet sisteminin gerçekten uçtan uca çalışıp çalışmadığını inceleyeceğiz.

Kapsam:

1. Sidebar'daki global `Davetler` sayfası
2. Seçili proje içindeki ekip/proje davetleri
3. Gerekirse bunlara bağlı external/project invitation akışları

Amaç:

> Davet oluşturma, listeleme, kabul etme, reddetme, ilgili projeye/ekibe eklenme, rol atama ve davet durumlarının frontend ↔ API ↔ backend ↔ database ↔ cache ↔ UI zincirinde gerçekten bağlı ve işlevsel olup olmadığını doğrulamak.

Şu an senden production kodu yazmanı istemiyorum.

Önce repository'yi, migration'ları, controller/service/repository yapılarını, frontend API/hook/cache'lerini, mevcut testleri ve mümkünse gerçek runtime davranışını incele.

Eğer bir bug, eksik entegrasyon, security sorunu, cache problemi, mock/fake bağlantı veya UX mismatch bulursan:

1. problemi kanıtla,
2. severity/classification ver,
3. minimum düzeltme önerisini yaz,
4. ardından DUR ve kullanıcıya sor.

Kullanıcı açıkça onaylamadan remediation implementation'a geçme.

---

# 1. Önce Davet Sisteminin Gerçek Modelini Çıkar

Repository'den gerçek invitation domain modelini bul.

Özellikle ara:

- ProjectInvitation
- Invitation
- ExternalProjectInvitation
- ProjectMembership
- Team / TeamMembership
- ProjectRole
- invite token
- invitation status
- inviter
- invitee
- email
- projectId
- teamId varsa
- role
- message
- accepted/rejected/expired state

İsimleri tahmin etme.

Gerçek entity/DTO/service/controller/migration adlarını raporla.

---

# 2. Global `Davetler` Sayfasını İncele

Sidebar'daki `Davetler` sayfasının gerçek davranışını çıkar.

Şunları doğrula:

- hangi route?
- hangi component?
- hangi API hook?
- hangi endpoint?
- hangi response DTO?
- pagination var mı?
- pending/accepted/rejected filtreleri var mı?
- sadece mevcut kullanıcıya ait davetleri mi gösteriyor?
- project/team bilgisi nasıl geliyor?
- davet sahibinin bilgisi nasıl geliyor?
- cache/query key ne?
- accept/reject sonrası UI nasıl güncelleniyor?

Frontend'de local/mock data var mı ara.

---

# 3. Seçili Proje İçindeki Ekip Davetlerini İncele

Seçili proje altında kullanıcı davet etme akışını bul.

Özellikle:

- project settings
- teams page
- members/team management
- invitation modal/drawer
- invite form

nerede ise gerçek source'u çıkar.

Şunları doğrula:

```text
frontend form
→ API client
→ controller
→ service
→ repository
→ DB
→ response
→ cache
→ UI
```

---

# 4. Davet Oluşturma Akışı

Davet oluştururken hangi alanlar gönderiliyor doğrula.

Örneğin gerçek modelde varsa:

- email
- firstName
- lastName
- role
- team
- optional message
- projectId

Request DTO ile frontend body birebir uyumlu mu?

Şunları kontrol et:

- frontend alan adı backend ile aynı mı?
- boş/null handling doğru mu?
- validation iki tarafta uyumlu mu?
- message length sınırı uyumlu mu?
- role enum uyumlu mu?
- team ID scope kontrolü var mı?

---

# 5. Existing User vs Unregistered User

Davet sistemi iki durumu destekliyorsa ayrı ayrı doğrula:

## A — Sistemde zaten hesabı olan kullanıcı

```text
invite
→ Davetler sayfasında görünür
→ accept
→ ProjectMembership oluşur
→ gerekli TeamMembership/role oluşur
```

## B — Sistemde hesabı olmayan email

```text
invite
→ external invitation/token
→ email link
→ registration
→ token consume
→ project membership
→ team/role
```

Bu ikinci akış gerçekten varsa incele.

Yoksa feature uydurma.

---

# 6. Davet Kabul Etme

Global Davetler sayfasından `Accept` tıklanınca gerçek zinciri çıkar.

Kontrol et:

- endpoint
- auth
- request body
- invitation status
- membership insert
- duplicate membership davranışı
- role assignment
- team assignment
- general/default team assignment varsa
- invitation consumed state
- transaction sınırı

Kabul sonrası kullanıcı gerçekten project'e erişebiliyor mu?

---

# 7. Davet Reddetme

Reject akışını incele.

Varsa optional rejection message desteğini doğrula.

Kontrol et:

- frontend input
- backend DTO
- persistence
- max length
- invitation status
- tekrar accept engeli
- UI cache invalidation

Reject edilmiş davet tekrar kabul edilebiliyor mu?

Beklenen product behavior neyse onu gerçek koddan çıkar.

---

# 8. Davet Durumları

Gerçek status enum/state machine'i çıkar.

Örneğin `PENDING`, `ACCEPTED`, `REJECTED`, `EXPIRED`, `CANCELLED` ama isimleri tahmin etme.

Her status için hangi operation izinli?

Illegal transition testleri var mı?

---

# 9. Duplicate Invitation

Aynı project + email/user için birden fazla pending invitation oluşturulabiliyor mu?

Kontrol et:

- DB unique constraint
- service check
- race condition
- resend davranışı

Şu durumları incele:

```text
same email + same project
same user + same project
same email + different project
same user + different project
```

Duplicate bug varsa severity ver.

---

# 10. Project Membership ile Invitation Uyumu

Accept sonrası gerçekten `ProjectMembership` oluşuyor mu?

Sadece invitation status değişip kullanıcı project'e eklenmiyorsa BROKEN say.

Membership role invitation role ile uyumlu mu, default role fallback var mı, enum mapping doğru mu kontrol et.

---

# 11. Team Membership ile Invitation Uyumu

Seçili proje içindeki “ekip daveti” gerçekten belirli Team'e bağlıysa:

```text
Invitation
→ ProjectMembership
→ TeamMembership
```

zincirini doğrula.

Eğer mevcut ürün önce project'e davet edip sonra General Team'e ekliyorsa bunu gerçek koddan çıkar.

Şunları kontrol et:

- teamId gerçekten requestte gidiyor mu?
- backend team project scope kontrolü yapıyor mu?
- başka project'in teamId'si gönderilebilir mi?
- General Team auto-add varsa çalışıyor mu?
- duplicate team membership engelleniyor mu?

---

# 12. Role / Permission

Davet gönderebilen kullanıcı kim?

Gerçek permission/policy'i bul.

Owner, manager, normal member, non-member, global admin varsa ve removed member senaryolarını test et.

Frontend button gizleme tek başına security sayılmaz.

Backend permission zorunlu.

---

# 13. IDOR / Scope

Manuel request ile başka project'e invitation oluşturulabilir mi?

Cross-project ve cross-team IDOR senaryolarını test et.

---

# 14. Invitation Ownership / Recipient Scope

Global Davetler endpoint'i başka kullanıcının davetlerini göstermemeli.

Manuel invitation ID değiştirerek başka kullanıcının daveti okunabiliyor mu, accept/reject edilebiliyor mu test et.

---

# 15. Email / Identity Matching

Invitation email bazlı ise case sensitivity, normalization, spaces, registered account email match ve invite token registration email mismatch edge-case'lerini incele.

---

# 16. External Invitation Token

External registration invite varsa token güvenliğini incele:

- raw token DB'de mi?
- hash tutuluyor mu?
- single-use mu?
- expiry var mı?
- consumed_at var mı?
- replay engeli var mı?
- brute-force/rate limit var mı?
- token wrong project/user scope'a taşınabiliyor mu?

---

# 17. Registration Completion

Unregistered user invite ile kayıt olduğunda user create → invitation verify → membership create → role/team → consume akışı transactional mı doğrula.

---

# 18. Email Sending

Email invitation gerçekten gönderiliyorsa service, template, link generation, locale, expiry, From config ve failure handling'i incele.

---

# 19. Frontend Form Validation

Project/team invite UI için email, role, team, message max length, loading, success, failure, retry ve disabled state davranışlarının backend ile uyumunu doğrula.

---

# 20. Global Invitations UI

Global Davetler sayfasında loading, empty, error, retry, accept/reject pending state, duplicate click prevention, project preview, inviter ve metadata akışlarını incele.

Gerçek backend response'u kullanıyor mu?

---

# 21. Project Preview

Davetler sayfasındaki Project Preview varsa invitation-specific safe preview contract kullanılıyor mu doğrula.

---

# 22. Cache Invalidation

Accept sonrası invitations list, projects list, selected project accessibility, memberships, teams/general team ve sidebar project list gibi gerekli cache'ler güncelleniyor mu?

Reject sonrası invitations list/count güncelleniyor mu?

Hard reload gerektiriyorsa cache bug olarak raporla.

---

# 23. Notification / Badge

Sidebar'daki Davetler için unread/pending count badge varsa gerçek backend kaynağını incele. Yoksa feature uydurma.

---

# 24. Project Invitation List

Project içinde gönderilmiş davetleri listeleyen ekran varsa pending invites, status, invitee, role, team, inviter ve resend/cancel davranışlarını gerçek koddan çıkar.

---

# 25. Cancel / Revoke Invitation

Mevcut sistemde invitation cancel/revoke özelliği varsa doğrula; yoksa zorunlu feature gibi yazma.

---

# 26. Expiry

Invitation expiry varsa backend source of truth olmalı, frontend yalnız presentation olmalı ve expired invite accept edilememeli.

---

# 27. Database Constraints

Gerçek invitation schema'sını çıkar ve FK, indexes, unique constraints, nullability, cascade/delete behavior'ı incele.

---

# 28. Transaction Integrity

Accept flow'da invitation accepted + membership create + team membership aynı transaction içinde mi?

Yarı tamamlanmış state riski var mı?

---

# 29. Concurrency / Idempotency

Double accept ve accept-vs-reject race senaryolarını değerlendir.

---

# 30. Runtime Verification

Static code inspection ile yetinme.

Mümkünse gerçek backend + PostgreSQL + browser ile test et.

- Existing user invite → accept → membership → project visible
- Reject → no membership
- Team assignment varsa accept → TeamMembership
- Unauthorized inviter rejected
- Foreign invitation ID rejected
- Duplicate pending invitation gerçek davranışı doğrulansın

---

# 31. Direct DB Verification

Runtime'da yalnız UI'ya güvenme.

QA invitation/membership kayıtlarını doğrudan DB'den doğrula.

---

# 32. Network Verification

Browser'da gerçek request body/status'u kaydet.

Normal successful flows'ta mock/fake response kullanma.

---

# 33. Mock / Fake Audit

Production source'ta mock invitation, fake invite, local-only accept, static preview, hardcoded cards, placeholder role, TODO/stub ve frontend-only status mutation ara.

---

# 34. API Inventory

Gerçek controller'lardan invitation-related endpoint inventory çıkar.

Her endpoint için:

| Method | Path | Auth | Request | Response | Permission | DB Effect |
|---|---|---|---|---|---|---|

---

# 35. Frontend ↔ Backend Mapping

Aşağıdaki her feature için component → hook/API client → HTTP → controller → service → repository → DB → response → cache → UI zincirini çıkar:

- invite create
- global invitations list
- accept
- reject
- team invite
- project preview
- external invite registration varsa
- invitation cancellation varsa

---

# 36. Mapping Status

Final raporda şu statülerden birini kullan:

```text
CONNECTED
PARTIAL
BROKEN
MOCK
MISSING
DEAD CODE
```

Zorunlu tablo:

| Feature | Frontend | API | Backend | DB | Authorization | Status |
|---|---|---|---|---|---|---|
| Global invitations list | | | | | | |
| Project invite create | | | | | | |
| Team invite | | | | | | |
| Accept | | | | | | |
| Reject | | | | | | |
| Membership creation | | | | | | |
| Team membership | | | | | | |
| Project preview | | | | | | |
| External registration | | | | | | |

---

# 37. Findings Classification

Bulduğun her konuyu `BUG`, `SECURITY ISSUE`, `CACHE ISSUE`, `DATA INTEGRITY ISSUE`, `MISSING FEATURE`, `UX MISMATCH`, `DIFFERENT BY DESIGN`, `INFO` olarak sınıflandır.

---

# 38. Severity

Her bulgu için `CRITICAL`, `HIGH`, `MEDIUM`, `LOW`, `INFO` ver.

---

# 39. Final Verdict

Audit sonunda şu verdict'lerden birini ver:

```text
FULLY CONNECTED
MOSTLY CONNECTED
PARTIALLY CONNECTED
NOT CONNECTED
```

---

# 40. Eğer Sorun Bulursan DUR

Bu audit'in en önemli kuralı:

> Sorun bulduğunda production fix uygulama.

Önce final raporla.

Her bulgu için:

- ID
- severity
- classification
- kanıt
- root cause
- kullanıcı etkisi
- security/data impact
- minimum öneri

yaz.

Ardından kullanıcıya açıkça sor:

```text
Bu bulguları minimum kapsamla düzeltmemi ister misin?
```

Kullanıcı onay vermeden production code, migration, frontend, backend, test source veya config değiştirme.

---

# 41. Sorun Yoksa

Eğer gerçekten sorun bulunmazsa remediation plan uydurma, gereksiz refactor önerme ve `Kalan blocker yok.` yaz.

---

# 42. Runtime / Test Scope

Audit sırasında mümkünse backend targeted tests, frontend targeted Playwright, real Chromium, PostgreSQL direct verification ve API/network capture kullan.

Ama audit sırasında bug fix yapma.

---

# 43. Git Güvenliği

Kullanıcı değişikliklerini koru.

Kullanma:

```text
git reset --hard
git checkout .
```

Commit/push/staging/pull/merge yapma.

---

# 44. Final Rapor Formatı

## 1. Executive Summary
## 2. Overall Verdict
## 3. Invitation Domain Model
## 4. API Inventory
## 5. Global Invitations Integration
## 6. Project / Team Invitation Integration
## 7. Accept Flow
## 8. Reject Flow
## 9. Membership / Team Membership Persistence
## 10. Authorization / IDOR
## 11. External Invitation / Registration
## 12. Database Integrity
## 13. Cache Consistency
## 14. Runtime / E2E Evidence
## 15. Mock / Fake Audit
## 16. Frontend ↔ Backend Mapping
## 17. Findings by Severity
## 18. Bugs vs Missing Features vs Different-by-Design
## 19. Final Recommendation

Sonunda sorun yoksa `Kalan blocker yok.`; sorun varsa kullanıcı onayı iste ve DUR.

---

# Kritik Kurallar

1. Audit-only çalış.
2. Kullanıcı onayı olmadan remediation yapma.
3. Global Davetler ve selected-project invite akışlarını ayrı ayrı incele.
4. Frontend görünmesi backend connection kanıtı değildir.
5. Accept sonrası gerçek ProjectMembership oluşmalı.
6. Team invite varsa gerçek TeamMembership oluşmalı.
7. Invitation status tek başına success sayılmaz.
8. Cross-user invitation IDOR test et.
9. Cross-project/team IDOR test et.
10. Permission backend source of truth olmalı.
11. Duplicate invite ve double-accept concurrency değerlendir.
12. External invite varsa token security incele.
13. Runtime başarılı akışlarda mock kullanma.
14. Direct DB ile kritik state'leri doğrula.
15. Cache invalidation/hard reload ihtiyacını kontrol et.
16. Preview/demo/test fixture'ı production persistence ile karıştırma.
17. Sorunları severity + classification ile raporla.
18. Bulgu varsa düzeltmeye başlamadan bana sor.
19. Sorun yoksa gereksiz task üretme.
20. Commit/push/staging yapma.
