# PDA — Project Service: Sidebar Invitation Navigation, Pending Badges, Banner Preview & Invitation Context

PDA Project Service ve ilgili frontend/navigation/notification yüzeylerinde dört bağlantılı geliştirme yapılacak.

Kullanıcının ham istekleri:

1. Sidebar'daki `Ekip Davetleri` doğrudan her zaman görünen bağımsız bir seçenek olmamalı. `Ekipler` menüsüne basıldığında açılan bir alt seçenek/dropdown olarak görünmeli.
2. Davet geldiğinde kullanıcı bunu sidebar ve ilgili Davetler ekranında sayı badge'i ile görebilmeli. Örneğin kullanıcının 1 bekleyen daveti varsa `Davetler 1`, 2 bekleyen daveti varsa `Davetler 2` benzeri modern bir badge görünmeli.
3. Proje oluşturma ekranında banner seçildiğinde, proje henüz oluşturulmadan önce banner önizlemesi gösterilmeli.
4. Proje davetiyle ilgili notification metninde davetin hangi projeden geldiği açıkça belirtilmeli. Organizasyon davetleri için de aynı bağlam isteniyor; ancak önce sistemde gerçekten organizasyon daveti domain/API/UI akışı bulunup bulunmadığı araştırılmalı.

En önemli çalışma kuralı:

> Bu maddeleri yazıldıkları sırayla körlemesine uygulama.

Önce repository'yi incele, gerçek dependency graph'ını çıkar ve taskları teknik olarak en mantıklı sıraya koy.

Her task tamamlanmadan bağımlı task'a geçme.

---

# ÇALIŞMA MODELİ

İlk turda doğrudan production kodu değiştirmeye başlama.

Önce özellikle şu alanları incele:

- AppSidebar / project sidebar
- selected-project navigation
- Ekipler / Teams navigation
- Ekip Davetleri / Invitations section
- global Davetler route/page
- project invitation frontend API/query keys
- ProjectInvitation backend
- pending invitation count
- accept/reject/cancel/resend/expiry lifecycle
- project membership
- notification service
- invitation-related notification types
- project name snapshots / DTO'lar
- Organization domain
- Organization membership
- Organization invitation entity/controller/service/API varsa
- organization notification types
- project create form
- project banner/logo upload
- media/image preview helpers
- project settings banner implementation
- i18n TR / EN / DE
- mobile/sidebar responsive behavior
- Playwright/backend tests

İsimleri tahmin etme.

Repository'deki gerçek entity, service, endpoint, component ve query key'lerini kullan.

---

# PERSISTENT PLAN

Repository root'unda:

```text
PDA_PROJECT_SERVICE_INVITATIONS_AND_CREATE_UX_PLAN.md
```

oluştur.

Bu plan implementation boyunca source of truth olacak.

Taskları repository'nin gerçek dependency sırasına göre oluştur.

Her task şu formatta olsun:

```md
## Task N — ...

### Amaç
...

### Neden bu sırada?
...

### Prerequisite
...

### Etkilenecek alanlar
- Backend:
- Database:
- Frontend:
- Navigation:
- Notification:
- Cache:
- Security:
- i18n/a11y:
- Tests:

### Checklist
- [ ] N.1 ...
- [ ] N.2 ...
- [ ] N.3 ...

### Definition of Done
- [ ] ...
- [ ] ...
```

Implementation sırasında tamamlanan her madde `[ ]` durumundan `[x]` durumuna geçirilmeli.

Kullanıcı bu checkbox ilerlemesini görebilmeli.

Zorunlu akış:

```text
implementation
→ targeted test
→ gerekli bug fix
→ targeted re-test
→ Definition of Done
→ checkbox [x]
→ sonraki bağımlı task
```

DoD tamamlanmadan sonraki bağımlı task'a geçme.

---

# PART A — MEVCUT DAVET MODELİNİ ÖNCE ÇIKAR

## 1. Project invitation modelini doğrula

Önce mevcut project invitation modelini çıkar.

Gerçek source'tan belirle:

- incoming invitation
- outgoing/project-managed invitation
- team invitation
- invitation status
- recipient
- inviter
- projectId
- projectName
- teamId/teamName
- roles
- expiresAt
- notification/event ilişkisi
- global Davetler page
- selected-project Ekip Davetleri page

Daha önce çalışan invitation lifecycle'ını yeniden tasarlama.

Özellikle mevcut `create / accept / reject / resend / cancel / expiry / external registration` davranışları korunmalı.

---

## 2. İki farklı davet sayacını birbirine karıştırma

Repository'deki gerçek UX'i inceleyerek aşağıdaki kavramları ayır:

### A — Kullanıcıya gelen davetler

Kullanıcının kabul veya reddetmesini bekleyen `incoming PENDING invitations`.

Global/sidebar `Davetler` badge'i bunun sayısını göstermeli.

Örnek:

```text
Davetler      2
```

Bu sayı current authenticated user'a ait olmalı.

### B — Seçili proje içindeki Ekip Davetleri

Eğer `Ekip Davetleri` sayfası proje yöneticisinin gönderdiği/pending project-team invitation'ları yönetiyorsa burada gösterilen sayı `selected project pending invitations` olmalı.

Bu iki count aynı şey değilse tek cache/query/count altında birleştirme.

Repository'deki gerçek semantics'i raporla ve planı buna göre kur.

---

# PART B — SIDEBAR: EKİPLER → EKİP DAVETLERİ DROPDOWN

## 3. Mevcut navigation yapısını incele

Selected-project sidebar'da mevcut `Ekipler` ve `Ekip Davetleri` route/section yapısını çıkar.

İstenen UX:

```text
Ekipler        ▸
```

normal durumda yalnız parent görünür.

Parent açıldığında:

```text
Ekipler        ▾
  Ekipler
  Ekip Davetleri
```

veya mevcut PDA navigation yapısına daha uygun eşdeğer nested navigation gösterilebilir.

Exact tasarımı mevcut sidebar component modeline göre belirle.

## 4. Ekipler parent davranışı

`Ekipler` satırının davranışını repository'nin mevcut navigation pattern'lerine göre çöz.

Kullanıcı parent'a bastığında submenu açılmalı ve mevcut team list erişimi kaybolmamalı.

Gerekirse parent row `label + chevron`, alt item'lar `Ekipler` ve `Ekip Davetleri` şeklinde olabilir.

Aynı label kötü UX oluşturuyorsa mevcut sidebar pattern'lerine uygun daha temiz çözüm kullan.

Yeni navigation library ekleme.

## 5. Route state ile dropdown state

Kullanıcı zaten `Ekipler` veya `Ekip Davetleri` sayfasındaysa parent açık görünmeli.

Submenu state yalnız local click state olmamalı.

Current route/section seçimi parent'ın expanded state'ini gerektiğinde açmalı.

Navigation sonrası yanlış selected state bırakma.

## 6. Sidebar persistence

Sidebar expanded, collapsed ve mobile drawer modlarında kontrol edilmeli.

Collapsed sidebar'da nested item tasarımını mevcut PDA sidebar davranışına göre çöz.

Tooltip/popover/flyout gerekiyorsa mevcut primitive'i reuse et.

---

# PART C — INVITATION BADGES

## 7. Badge source of truth

Badge frontend'de statik veya local state ile üretilmemeli.

Source of truth gerçek backend pending invitation state olmalı.

Global incoming badge:

```text
current authenticated user
+
effective PENDING incoming invitation count
```

Selected project team invitation badge gerekiyorsa:

```text
selected project
+
effective PENDING invitation count
```

olmalı.

## 8. Effective pending semantics

Daha önce düzeltilmiş invitation expiry lifecycle'ını bozma.

Expired, accepted, rejected ve cancelled invitation'lar badge'e dahil olmamalı.

Gerçek service'in effective-pending semantics'ini reuse et.

## 9. Count endpoint / mevcut API

Önce mevcut endpointleri incele.

Eğer mevcut list endpoint'inin `totalElements` bilgisi yeterliyse yeni endpoint oluşturma.

Selected-project tarafında mevcut server total count kullanılabiliyorsa reuse et.

Sadece gerçekten gerekli ise minimal count endpoint düşün.

## 10. Sidebar badge tasarımı

Badge modern, küçük ve okunaklı olsun.

Örnek:

```text
Davetler     [2]
```

99'dan büyük değerler için `99+` gibi bounded presentation kullanılabilir.

Gerçek count server'da korunmalı.

## 11. Page içi badge

İlgili Davetler başlığında da pending count göster.

Örnek:

```text
Davetler  [2]
```

Selected project Ekip Davetleri için anlamlıysa:

```text
Ekip Davetleri  [3]
```

Incoming count ile project-managed pending count farklı ise doğru count'u doğru yerde kullan.

## 12. Badge lifecycle

New invitation, accept, reject, cancel, resend, expiry ve external acceptance gibi ilgili olaylardan sonra count hard reload olmadan güncellenmeli.

## 13. Yeni invitation geldiğinde badge

Kullanıcı uygulamadayken yeni invitation geldiğinde mevcut polling/refetch/notification mekanizması hangisiyse reuse et.

Yeni socket/broker yalnız badge için ekleme.

## 14. Account isolation

User A'nın badge/count/cache verisi logout sonrası User B'ye hiçbir frame'de görünmemeli.

Incoming invitation query/count actor-scoped olmalı.

Late response yeni kullanıcıya yazmamalı.

---

# PART D — PROJECT CREATE BANNER PREVIEW

## 15. Mevcut project create form'u incele

Proje oluşturma ekranındaki logo, banner, file input, image validation, create request, upload sırası ve project settings media implementation'ını çıkar.

Project Settings içindeki banner preview/replace sistemi varsa mümkün olduğunca reuse et.

## 16. Banner seçildiğinde anlık preview

Akış:

```text
Banner seç
→ local validation
→ preview oluştur
→ kullanıcı preview'yu görür
→ formu gönder
→ mevcut gerçek create/upload flow çalışır
```

Preview upload başarılı olmuş gibi davranmamalı.

## 17. Preview lifecycle

Banner replace/remove/cancel/unmount/success durumlarında object URL/memory leak bırakmamalı.

`URL.createObjectURL` kullanılıyorsa `URL.revokeObjectURL` doğru lifecycle'da çağrılmalı.

## 18. Banner validation

Frontend validation mevcut backend/media validation ile uyumlu olmalı.

MIME type, size, extension gerekiyorsa, corrupted image ve image load failure kontrol edilmeli.

Backend source of truth olmalı.

## 19. Banner visual layout

Preview mevcut Project Card / Project Header banner aspect ratio'suna mümkün olduğunca yakın gösterilmeli.

`object-fit` production banner görüntüsüyle uyumlu olsun.

## 20. Mobile / responsive

320 / 390 / 768 / 1024 / 1440 viewportlarda preview taşmamalı.

---

# PART E — PROJECT INVITATION NOTIFICATION CONTEXT

## 21. Mevcut notification event'ini incele

Project invitation oluşturulduğunda gerçek Notification Service event'i oluşuyor mu?

Varsa NotificationType, title, message, projectId, projectName, actor, resource ve snapshot alanlarını çıkar.

Proje adı zaten payload'da olup UI kullanmıyorsa backend'e gereksiz alan ekleme.

## 22. Project invitation notification metni

Beklenen anlam:

```text
Proje daveti aldınız: PDA
```

veya daha doğal:

```text
"PDA" projesine davet edildiniz.
```

TR / EN / DE doğal çevirileri kullanılmalı.

Project name plain-text render edilmeli, HTML inject edilmemeli.

## 23. Notification title/message ayrımı

Structured payload destekleniyorsa `type/projectId/projectName` gibi context structured tutulabilir.

Existing notification architecture server-side snapshot text kullanıyorsa mevcut modelle tutarlı kal.

Notification sistemini bu feature için yeniden tasarlama.

## 24. Project rename semantics

Invitation oluşturulduktan sonra proje adı değişirse hangi ismin gösterileceğini mevcut notification architecture'a göre belirle.

Tercihen event anındaki proje adı snapshot olabilir, fakat mevcut model live lookup ise sessizce farklı modele geçme.

## 25. Deleted/archived project

Notification history'de kalabilir ancak dead/broken project link verilmemeli.

Erişim backend tarafından tekrar enforce edilmeli.

---

# PART F — ORGANIZATION INVITATION AUDIT

## 26. Önce gerçekten var mı kontrol et

Repository genelinde OrganizationInvitation / organization membership invitation / invite token / notification / frontend forms ve testleri ara.

## 27. Organizasyon daveti gerçekten varsa

Gerçek flow'u uçtan uca doğrula:

```text
organization owner/authorized actor
→ invite user
→ recipient sees invitation
→ accept/reject
→ organization membership
```

Notification metninde organization name göster:

```text
"X-ETC" organizasyonuna davet edildiniz.
```

## 28. Organizasyon daveti yoksa

Kendi kendine yeni Organization Invitation feature'ı implement etmeye başlama.

Bunu `MISSING FEATURE` olarak raporla.

Şunları belirt:

- bugün organization'a kullanıcı nasıl ekleniyor?
- invite entity/API var mı?
- token var mı?
- accept/reject var mı?
- UI var mı?
- notification var mı?

Ve implementation'a devam etmeden kullanıcıya sor:

```text
Organizasyon daveti sistemi mevcut değil. Bunu bu task kapsamında
proje davetleriyle aynı seviyede yeni bir feature olarak eklememi ister misin?
```

Kullanıcı açık onay vermeden yeni organization invitation domain/migration/API/UI oluşturma.

## 29. Organizasyon daveti kısmen varsa

Backend var frontend yok veya membership add var invitation/token yok gibi durumları `PARTIAL` olarak sınıflandır.

Eksik kısmı otomatik scope'a dahil etme.

Önce kullanıcıya somut farkı bildir.

---

# PART G — SECURITY / DATA INTEGRITY

## 30. Invitation count IDOR

Incoming count yalnız current principal için olmalı.

Project pending count yalnız permission verilen selected project için erişilebilir olmalı.

Client'tan arbitrary recipient ID kabul etme.

## 31. Organization audit security

Organization invitation varsa foreign organization invite, foreign recipient, unauthorized inviter, duplicate invite, expired invite ve accept/reject race kontrol edilmeli.

## 32. Notification privacy

Notification payload'ı yalnız UX için gerekli safe context'i expose etmeli.

---

# PART H — CACHE / POLLING

## 33. Invitation badge query keys

Global incoming count actor identity ile, selected project count actor + projectId ile scope edilmeli.

Existing query key factories'i reuse et.

## 34. Mutation invalidation

Create/accept/reject/cancel/resend/external acceptance sonrası uygun count/list cache'lerini güncelle.

Client clock source of truth olmasın.

## 35. No hard reload

Invitation badge, accept/reject, sidebar nested navigation, notification context veya banner preview için hard reload çözüm olmasın.

---

# PART I — UI / RESPONSIVE / A11Y

## 36. Sidebar dropdown accessibility

Parent `Ekipler` control gerçek button/link semantics, `aria-expanded`, keyboard Enter/Space, focus order ve current child indication desteklemeli.

## 37. Badge accessibility

Screen reader yalnız sayı duymamalı.

Anlamlı accessible text olmalı: `1 bekleyen davet` gibi.

## 38. Banner preview accessibility

Image preview, remove/change button ve validation error erişilebilir olmalı.

## 39. Responsive matrix

320 / 390 / 768 / 1024 / 1440; expanded/collapsed sidebar; mobile drawer; light/dark/reduced-motion; TR/EN/DE doğrulanmalı.

---

# PART J — REAL TEST MATRİSİ

## 40. Incoming invitation badge

```text
User B has 0 pending
→ sidebar badge absent/0

User A invites B
→ DB PENDING
→ B refresh/poll
→ sidebar badge 1
→ page heading badge 1

B accepts
→ DB ACCEPTED + membership
→ badge 0
```

Reject de doğrulanmalı.

## 41. Multiple invitations

```text
B receives Project A invite
B receives Project B invite
→ badge 2

accept one
→ badge 1

reject second
→ badge 0
```

Expired invitation count'a dahil olmamalı.

## 42. Account switch

```text
User A badge 3
→ logout
→ User B badge 0
```

Delayed old response test et.

## 43. Selected project team invitation count

Mevcut UI bunu destekliyorsa:

```text
Project P pending invites 2
→ Ekipler expanded
→ Ekip Davetleri [2]
```

## 44. Sidebar nested navigation

Parent closed/open/current child/collapsed/mobile variants gerçek route ile test edilmeli.

## 45. Banner preview

Choose/replace/remove/reselect/submit flow; invalid type/size ve cleanup test edilmeli.

## 46. Project notification context

User A, User B'yi PDA projesine davet eder → B notification UI text'i `PDA` içermeli.

DB/API payload ve frontend render ayrı doğrulanmalı.

## 47. Organization invitation

Yalnız gerçek feature varsa gerçek organization membership acceptance flow test edilmeli.

Feature yoksa test oluşturulmaz; audit sonucu kullanıcıya sunulur.

## 48. Normal success mock yasağı

Normal success acceptance gerçek frontend → API → backend → PostgreSQL zinciriyle çalışmalı.

`route.fulfill` success proof olarak kullanılmamalı.

---

# TASK GRUPLANDIRMA

Yukarıdaki bölümleri 48 ayrı task yapma.

Gerçek dependency graph'a göre grupla.

Kaba örnek:

```text
Task 1 — Preflight / invitation + organization capability audit
Task 2 — Pending invitation count contracts and actor/project cache scopes
Task 3 — Sidebar Teams nested navigation + invitation badges
Task 4 — Project create banner preview lifecycle
Task 5 — Project invitation notification context
Task 6 — Organization invitation integration IF existing / decision gate IF missing
Task 7 — Combined security/cache/responsive/real E2E
Task 8 — Full gate + implementation completion
```

BU SIRA SADECE ÖRNEKTİR.

Repository gerçekleri farklı dependency gösteriyorsa daha doğru sırayı kullan.

Özellikle Organization Invitation yoksa Task6 implementation'a otomatik girme; kullanıcı decision gate oluştur.

---

# GİT GÜVENLİĞİ

Kullanıcı değişikliklerini koru.

Kullanma:

```text
git reset --hard
git checkout .
```

Plan dışı kullanıcı değişikliklerini revert etme.

Commit/push/staging/pull/merge yapma.

---

# FINAL VALIDATION

Implementation bittikten sonra en az:

```text
backend targeted Project/Invitation/Notification tests
backend full tests

frontend lint
TypeScript
production build

targeted Playwright:
- sidebar navigation
- invitation badges
- project create banner
- invitation notification context
- account isolation

full Chromium Playwright
```

çalıştır.

Ardından canonical:

```text
./pre-push/pre-push.cmd
```

veya repository'deki gerçek eşdeğerini çalıştır.

Backend gate'i atlama.

Docker build/start/health repository standardının parçasıysa doğrula.

---

# IMPLEMENTATION COMPLETION

Implementation tamamen bittiğinde plan dosyasından ayrı completion oluştur.

Final rapor başlıkları:

## Final verdict
## Task checklist
## Invitation domain audit
## Sidebar Teams navigation
## Global incoming invitation badge
## Project team invitation badge
## Project creation banner preview
## Project invitation notification context
## Organization invitation capability
## Cache / polling behavior
## Authorization / account isolation
## Responsive / accessibility / i18n
## Changed files
## Test results
## Remaining issues

Eğer organization invitation sistemi mevcut değil ve kullanıcı henüz yeni feature'a onay vermediyse bunu blocker değil `Pending product decision` olarak açıkça belirt.

Sadece onaylı scope için gerçekten blocker kalmadıysa:

```text
Kalan blocker yok.
```

yaz.

---

# KRİTİK KURALLAR

1. Önce Project Invitation ve Organization Invitation gerçek modelini incele.
2. Organizasyon daveti varmış gibi varsayma.
3. Organization Invitation yoksa yeni domain/API/migration/UI oluşturmadan kullanıcıya sor.
4. Incoming user invitation count ile selected-project pending invitation count'u birbirine karıştırma.
5. Badge server-side effective pending state'ten gelmeli.
6. Expired invitation badge'e dahil olmamalı.
7. Badge account-scoped olmalı.
8. Account switch'te eski badge görünmemeli.
9. Hard reload badge çözümü değildir.
10. Ekip Davetleri, Ekipler altında nested/dropdown navigation olmalı.
11. Current child route parent'ı açık tutmalı.
12. Collapsed/mobile sidebar ayrıca doğrulanmalı.
13. Banner preview project create işleminden önce görünmeli.
14. Banner preview persistence başarısı gibi davranmamalı.
15. Object URL/memory cleanup yapılmalı.
16. Existing banner validation/media infrastructure reuse edilmeli.
17. Project invitation notification proje adını açıkça göstermeli.
18. Organization invitation mevcutsa organization adını göstermeli.
19. Notification context plain text/güvenli render edilmeli.
20. Notification authorization bypass oluşturmamalı.
21. Existing invitation accept/reject/resend/cancel/external-registration behavior bozulmamalı.
22. Existing invitation cache-isolation fixes korunmalı.
23. Existing Notification Service read/history/popup semantics bozulmamalı.
24. Yeni socket/broker yalnız badge için eklenmemeli.
25. TR/EN/DE tamamlanmalı.
26. Light/dark/mobile/a11y tamamlanmalı.
27. Normal success E2E gerçek backend/PostgreSQL kullanmalı.
28. Persistent checkbox planı oluştur.
29. Taskları gerçek dependency sırasına koy.
30. Her task sonrası targeted tests + DoD + `[x]`.
31. DoD tamamlanmadan bağımlı task'a geçme.
32. Full regression + canonical pre-push geçmeden tamamlandı sayma.
33. Commit/push/staging yapma.
