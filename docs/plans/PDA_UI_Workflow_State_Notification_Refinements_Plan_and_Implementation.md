# PDA — Project/Organization UX, Form Flows, Shared Pickers, Invitations & Notification Refinements

PDA içerisinde farklı modüllere dağılmış bir dizi UX, state consistency ve navigation iyileştirmesi yapılacak.

Kullanıcının ham talepleri:

1. Proje veya organizasyon oluştururken zorunlu/eksik bir bölüm atlandığında hata yalnız ilgili bölümde görünmemeli; formun alt/submit alanında da eksik bölüm bulunduğu açıkça belirtilmeli.
2. Proje düzenleme > Planlama bölümünde öncelik değiştirildiğinde yeni öncelik Projeler sayfasındaki kartta ve proje önizlemesinde doğru görünmeli.
3. Commit geçmişi düz liste yerine GitHub benzeri pagination ile gösterilmeli.
4. Organizasyonlar sayfasındaki organizasyon kartlarının boyutları, Projeler sayfasındaki proje kartlarıyla aynı görsel ölçülere sahip olmalı.
5. `Kriter Oluştur` popup/modal olmaktan çıkarılmalı; Proje Oluştur / Organizasyon Oluştur benzeri gerçek sayfa/form akışına dönüştürülmeli.
6. Proje silindikten sonra sidebar üzerinden silinen projeye ait sayfalara hâlâ girilebilmesi problemi çözülmeli.
7. Ekipler sayfasına kart/grid görünümü eklenmeli. Mevcut tablo görünümü korunmalı ve kullanıcı Grid ↔ Tablo arasında geçiş yapabilmeli.
8. `Proje Davetlerim` sayfasının frontend görünümü modernize edilmeli.
9. Proje davetlerinde `Proje bilgileri` açıldığında proje banner'ı mevcutsa önizlemede görünmeli.
10. `Üye Davet Et` popup/modal olmaktan çıkarılmalı ve ayrı bir form sayfası haline getirilmeli.
11. Ekip davetlerinde davet edilen kişi kabul veya reddettiğinde, ilgili yetkili kullanıcı için sidebar'daki `Ekip Davetleri` alanında `+1`, `+2` vb. yeni cevap/bildirim badge'i görünmeli.
12. `Bildirimler > Geçmiş` alanındaki bildirimler tek tek silinebilmeli; her history notification yanında çöp kutusu bulunmalı. Ayrıca history alanında `Tümünü sil` aksiyonu bulunmalı.
13. Görev etkinlik yorumlarında mevcut klavye davranışı tersine çevrilmeli:
   - `Enter` → yorumu gönder
   - `Ctrl + Enter` → yeni satır
14. `Sprint Oluştur` popup/modal olmaktan çıkarılmalı; diğer create sayfaları gibi gerçek form sayfasına dönüştürülmeli.
15. Takvim/anımsatıcı dahil uygulamadaki tarih ve saat seçimleri ortak component standardına taşınmalı:
   - Tarih için mevcut `components/date-picker.tsx`
   - Saat için bununla aynı tasarım dilinde yeni ortak `time-picker.tsx`
   kullanılmalı.

Bu maddeleri yazıldıkları sırayla körlemesine implement etme.

Önce repository'yi incele, gerçek dependency graph'ını çıkar ve taskları teknik bağımlılık sırasına göre oluştur.

Bir taskın Definition of Done'ı tamamlanmadan bağımlı task'a geçme.

---

# 1 — ÇALIŞMA MODELİ

İlk turda production kodu değiştirmeye başlama.

Önce audit yap.

Özellikle aşağıdaki alanları incele:

```text
Project create/edit
Organization create/edit
multi-section form validation
Project priority
Project cards
Project preview
Project delete/archive
selected project state
AppSidebar / ProjectSidebar
project route guards
criteria
team member invitation
sprint creation
Teams page
Project Invitations
Project Preview
project media/banner
commit history
Notification Service
notification history/read/delete
team invitation events
task activity/comments
Calendar
Reminders
date-picker.tsx
existing date/time inputs
shared UI components
TanStack Query keys/invalidation
TR/EN/DE
responsive behavior
Playwright
backend tests
Spring Modulith boundaries
```

Component/entity/service/route isimlerini tahmin etme.

Repository'deki gerçek yapıyı kullan.

---

# 2 — PERSISTENT PLAN

Repository root'unda:

```text
PDA_UI_WORKFLOW_STATE_NOTIFICATION_REFINEMENTS_PLAN.md
```

oluştur.

Bu dosya implementation boyunca source of truth olacak.

Taskları repository'nin gerçek dependency sırasına göre oluştur.

Her task şu formatta olmalı:

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
- Cache:
- Notification:
- Shared Components:
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

Implementation sırasında checkbox'lar gerçek zamanlı güncellenecek:

```text
[ ]
```

→

```text
[x]
```

Zorunlu yürütme sırası:

```text
implementation
→ targeted test
→ gerekli bug fix
→ targeted re-test
→ Definition of Done
→ checkbox [x]
→ sonraki bağımlı task
```

Bir taskın DoD'si tamamlanmadan sonraki bağımlı task'a geçme.

Kullanıcı plan dosyasındaki `[x]` ilerlemesini görebilmeli.


---

# 3 — ZORUNLU BRANCH-BASED IMPLEMENTATION WORKFLOW

Bu scope tek branch üzerinde topluca uygulanmayacak.

Repository'deki mevcut feature/domain branch ayrımı korunacak ve implementation **branch fazları** halinde yürütülecek.

## 3.1 Branch ownership

Ana task sahipliği aşağıdaki gibidir:

```text
general-features
→ Talep 1  — Project/Organization create validation summary
→ Talep 4  — Organization card dimensions / ProjectCard alignment
→ Talep 13 — Task activity Enter / Ctrl+Enter behavior
→ Talep 15 — Shared DatePicker / new TimePicker / cross-app migration

project-service-frontend
→ Talep 2  — Project priority list/preview consistency (frontend/cache side)
→ Talep 3  — Commit history pagination UI
→ Talep 5  — Criteria Create modal → full-page form
→ Talep 6  — Deleted-project sidebar/navigation cleanup (frontend/state side)
→ Talep 8  — Project Invitations frontend redesign
→ Talep 9  — Project invitation preview banner
→ Talep 14 — Sprint Create modal → full-page form

squad-service-backend
→ Talep 7  — Teams Grid ↔ Table
→ Talep 10 — Member Invite modal → full-page form
→ Talep 11 — Team invitation ACCEPTED/REJECTED response badge

notification-service
→ Talep 12 — Notification History single delete + Delete All

project-service-backend
→ Talep 2 / 3 / 6 için audit sırasında gerçekten backend eksikliği kanıtlanırsa
   yalnız gerekli backend prerequisite/fix'ler
```

Branch adı feature'ın yalnız backend veya yalnız frontend dosyası değiştireceği anlamına gelmez.

Örneğin `squad-service-backend` fazında Squad feature'ının gerektirdiği frontend entegrasyonu da aynı feature branch'inde yapılabilir.

Ancak `notification-service` gibi bağımsız domain işi başka feature branch'ine gizlice taşınmamalı.

---

## 3.2 Zorunlu branch sırası

Default execution sırası:

```text
Phase 0 — Read-only global preflight/audit
    ↓
Phase 1 — general-features
    ↓
Phase 2 — project-service-backend (YALNIZ audit backend prerequisite kanıtlarsa)
    ↓
Phase 3 — project-service-frontend
    ↓
Phase 4 — squad-service-backend
    ↓
Phase 5 — notification-service
    ↓
Phase 6 — final cross-branch verification / completion
```

`project-service-backend` için backend değişikliği gerekmiyorsa Phase 2:

```text
SKIPPED — no backend prerequisite proved
```

olarak plan dosyasına yazılır ve doğrudan `project-service-frontend` fazına geçilir.

Repository gerçek dependency graph'ı bu sırada zorunlu bir değişiklik gerektiriyorsa agent bunu implementation başlamadan açıkça raporlamalı; sessizce branch sırasını değiştirmemeli.

---

## 3.3 Branch completion gate — EN ÖNEMLİ KURAL

Agent bir branch fazına başladıktan sonra o branch'e ait planlanmış taskları sırayla tamamlar.

Branch fazı tamamlanınca:

1. İlgili taskların implementation'ı tamamlanmış olmalı.
2. İlgili targeted backend/frontend testleri geçmeli.
3. Branch-scoped lint / TypeScript / build gerekiyorsa geçmeli.
4. İlgili taskların Definition of Done checkbox'ları `[x]` olmalı.
5. Branch phase checkbox'ı `[x]` yapılmalı.
6. Agent **DURMALI**.
7. Agent kullanıcıya branch'in tamamlandığını açıkça söylemeli.
8. Agent commit / push / staging yapmamalı.
9. Agent kendiliğinden sonraki branch'e geçmemeli.
10. Kullanıcının commit edip pushladığını ve devam etmeye hazır olduğunu açıkça bildirmesini beklemeli.

Örnek:

```text
BRANCH COMPLETE — general-features

Tamamlanan talepler:
- [x] 1
- [x] 4
- [x] 13
- [x] 15

Targeted tests:
- ...
- ...

Git durumu:
- commit yapılmadı
- push yapılmadı
- staging yapılmadı

NEXT:
project-service-backend (conditional) veya project-service-frontend

ACTION REQUIRED:
Bu branch'i commit edip pushla.
Commit/push tamamlandığında bana haber ver.
Ben kullanıcı onayı olmadan başka branch'e geçmeyeceğim.

STOP.
```

Bu durma noktası zorunludur.

---

## 3.4 Branch geçişinde dependency doğrulaması

Kullanıcının:

```text
commit/push tamam
devam et
```

demesi tek başına prerequisite kodun yeni branch'te bulunduğu anlamına gelmeyebilir.

Özellikle:

```text
general-features
→ shared DatePicker / TimePicker
→ project-service-frontend Sprint Create
```

gibi cross-branch dependency vardır.

Bu nedenle sonraki branch'te implementation başlamadan önce agent read-only olarak doğrulamalı:

```text
current branch
HEAD
origin/main ref
required previous commit(s) reachable mı?
required shared files/contracts mevcut mu?
```

Önceki branch'in gerekli değişiklikleri yeni branch'te yoksa agent implementation'a başlamamalı.

Kullanıcıya açıkça şunu söylemeli:

```text
Bu branch önceki fazın prerequisite değişikliklerini henüz içermiyor.
Önce completed branch'i main'e merge etmen veya gerekli commitleri bu branch'e
merge/cherry-pick etmen ve branch'i güncellemen gerekiyor.
```

Agent kullanıcı açıkça istemeden:

```text
merge
rebase
cherry-pick
pull
branch switch
```

yapmamalı.

Kullanıcı branch'i kendisi değiştirebilir veya agent'a branch değiştirmesi için açık talimat verebilir.

---

## 3.5 Branch içindeki scope dışına çıkma yasağı

Örneğin agent `general-features` üzerindeyken:

```text
Notification History backend delete endpoint
```

implement etmeye başlamamalı.

Bunu plan içinde dependency/finding olarak kaydedip `notification-service` fazına bırakmalı.

Aynı şekilde `notification-service` fazında project/sprint UI refactor yapılmamalı.

Audit sırasında başka branch'e ait blocker bulunursa:

```text
CROSS-BRANCH PREREQUISITE
```

olarak kaydet.

Gerekirse mevcut branch'i güvenli noktada durdur ve kullanıcıya bildir.

---

## 3.6 Plan dosyasında branch phase checkbox'ları

Persistent planın üst kısmında ayrıca şu branch-level checklist bulunmalı:

```md
## Branch execution status

- [ ] Phase 0 — Global read-only preflight/audit
- [ ] Phase 1 — `general-features`
- [ ] Transition Gate 1 — user commit/push confirmation
- [ ] Phase 2 — `project-service-backend` (conditional)
- [ ] Transition Gate 2 — user commit/push confirmation / skipped if no backend work
- [ ] Phase 3 — `project-service-frontend`
- [ ] Transition Gate 3 — user commit/push confirmation
- [ ] Phase 4 — `squad-service-backend`
- [ ] Transition Gate 4 — user commit/push confirmation
- [ ] Phase 5 — `notification-service`
- [ ] Transition Gate 5 — user commit/push confirmation
- [ ] Phase 6 — Cross-branch final verification / completion
```

Bir Transition Gate yalnız kullanıcı ilgili branch'i commit/push ettiğini açıkça doğruladıktan sonra `[x]` yapılmalı.

Agent kendi yaptığı implementation bitti diye transition gate'i işaretleyemez.

---

## 3.7 Phase 0 audit bütün repository'yi okuyabilir, fakat değiştiremez

Phase 0 sırasında tüm talepler için repository incelenebilir.

Ama production/test/config/schema dosyalarında değişiklik yapılmaz.

Phase 0 çıktısı:

```text
task → owning branch
dependency
backend prerequisite var/yok
existing implementation
target tests
decision gates
```

haritası olmalı.

Sonra yalnız Phase 1 implementation başlar.


---

# PART A — PREFLIGHT / GERÇEK DAVRANIŞ AUDIT

## A1. Mevcut create form mimarisini çıkar

Proje ve organizasyon oluşturma ekranlarında:

```text
sections
steps
required fields
validation schema
submit handler
validation errors
scroll/focus behavior
sticky/footer submit controls
```

nasıl çalışıyor belirle.

Amaç yeni bir validation sistemi kurmak değil; mevcut sistemi doğru UX ile tamamlamak.

## A2. Modal/form envanteri

Şunların mevcut implementation'ını çıkar:

```text
Kriter Oluştur
Üye Davet Et
Sprint Oluştur
```

Her biri için:

```text
component
route var mı?
modal state
mutation
validation
query invalidation
success redirect
cancel davranışı
permission
```

belirle.

## A3. Project selection/sidebar lifecycle

Proje silme sonrasında:

```text
selectedProject
current pathname
sidebar cache
project list cache
route params
localStorage/sessionStorage
```

nasıl davrandığını incele.

Silinmiş projeye neden hâlâ navigation yapılabildiğini source seviyesinde kanıtla.

## A4. Tarih/saat component inventory

Repository genelinde ara:

```text
DatePicker
date-picker.tsx
input type="date"
input type="time"
datetime-local
Calendar
Popover calendar
hour select
minute select
reminder date
reminder time
deadline
start date
end date
due date
sprint dates
task dates
```

Tek tek inventory oluştur.

## A5. Invitation / Notification semantics

Özellikle ayır:

```text
project invitation pending count
team invitation pending count
team invitation accepted/rejected response
notification unread count
notification history
```

Bunları aynı count gibi ele alma.

---

# PART B — CREATE FORM VALIDATION SUMMARY

## B1. Problem

Proje veya organizasyon oluşturulurken kullanıcı bir bölümü eksik bırakırsa mevcut sistem ilgili field/section içinde hata gösteriyor olabilir.

Ancak kullanıcı submit alanında neden create işleminin gerçekleşmediğini anlayamıyor.

## B2. Beklenen davranış

Inline field validation korunmalı.

Ek olarak formun alt kısmında veya submit alanına yakın yerde anlamlı bir validation summary gösterilmeli.

Örnek:

```text
Proje oluşturulamadı.
Lütfen eksik veya hatalı alanları kontrol edin.

Eksik bölümler:
• Planlama
• Proje bilgileri
```

Exact metin PDA diline göre düzenlenebilir.

## B3. Invalid section navigation

Create form section/tab/accordion yapısındaysa validation summary kullanıcıyı hatalı bölüme yönlendirebilmeli.

Mümkünse:

```text
click error
→ invalid section açılır
→ first invalid field focus/scroll
```

davranışı sağlanmalı.

Yeni form library ekleme.

## B4. Project + Organization aynı standardı kullanmalı

İki create flow aynı UX kuralına sahip olmalı.

Birinde summary olup diğerinde olmaması kabul edilmez.

## B5. Accessibility

Validation summary `aria-live`, `aria-describedby` ve focus management ile erişilebilir olmalı.

Screen reader yalnız kırmızı border'a güvenmemeli.

---

# PART C — PROJECT PRIORITY CONSISTENCY

## C1. Reproduction

Gerçek runtime'da doğrula:

```text
Project Settings/Edit
→ Planning
→ Priority değiştir
→ save
→ Projects page
→ Project Preview
```

Yeni priority nerede stale kalıyor belirle.

## C2. Source of truth

Kontrol et:

```text
backend response
DTO
Project list response
Project preview response
TanStack Query cache
mutation response
query invalidation
optimistic update
```

Sorunun backend mi frontend cache mi olduğu kanıtlanmadan random invalidate ekleme.

## C3. Beklenen sonuç

Priority değişikliğinden sonra hard reload olmadan:

```text
Project edit
Project card
Project preview
```

aynı güncel değeri göstermeli.

## C4. Account/project isolation

Project A priority değişikliği Project B cache'ini yanlışlıkla mutate etmemeli.

---

# PART D — PROJECT DELETE → SIDEBAR / ROUTE INTEGRITY

## D1. Ana kural

Bir proje silindikten sonra kullanıcı sidebar, direct internal navigation veya cached navigation item üzerinden artık silinen projeye girememeli.

## D2. Silme sonrası state temizliği

Başarılı delete sonrasında ilgili:

```text
project list cache
selected project
project-specific queries
sidebar navigation state
project-local storage state
```

gerektiği kadar temizlenmeli.

Global cache'i gereksiz yere komple temizleme.

## D3. Current route deleted project ise

Örnek:

```text
/projects/pda/settings
→ delete PDA
```

sonrasında kullanıcı deleted route üzerinde bırakılmamalı.

Repository UX'ine göre güvenli route'a yönlendir:

```text
/projects
```

veya gerçek dashboard/projects route.

## D4. Stale direct route

Silinmiş project slug/id ile URL açılırsa `not found / inaccessible` davranışı doğru olmalı.

Sidebar'ın stale cache yüzünden route üretmesi engellenmeli.

---

# PART E — SHARED FULL-PAGE FORM PATTERN

Aşağıdaki üç modal ayrı ayrı rastgele tasarlanmayacak:

```text
Kriter Oluştur
Üye Davet Et
Sprint Oluştur
```

Önce mevcut `Proje Oluştur` ve `Organizasyon Oluştur` sayfa/form düzenlerini incele.

Ortak PDA create-form pattern'i çıkar.

## E1. Ortak form yapısı

Mümkün olduğunca:

```text
page title
description
back/cancel
form content
validation
sticky or standard submit actions
loading
success
error
```

aynı davranış standardını kullanmalı.

---

# PART F — KRİTER OLUŞTUR → SAYFA

## F1. Modal kaldırılmalı

`Kriter Oluştur` modal/popup üzerinden açılmamalı.

Gerçek route/page oluşturulmalı.

Örneğin repository routing yapısına göre `.../criteria/new` benzeri olabilir.

Exact route mevcut route conventions'tan çıkarılmalı.

## F2. Mevcut business behavior korunmalı

Modal içinde mevcut fields, validation, permissions, mutation, API, cache invalidation ve success behavior korunmalı.

Feature yeniden yazılmamalı.

## F3. Cancel/back

Cancel kullanıcıyı doğru criteria/list context'ine geri götürmeli.

Browser Back davranışı bozulmamalı.

---

# PART G — ÜYE DAVET ET → SAYFA

## G1. Modal kaldırılmalı

`Üye Davet Et` gerçek page/form olmalı.

Mevcut invitation backend/API tekrar kullanılmalı.

## G2. Project/team context kaybolmamalı

Hangi proje/ekibe davet gönderildiği route veya güvenilir state üzerinden belirlenmeli.

Client arbitrary foreign project/team scope göndererek permission bypass edememeli.

## G3. Existing invitation behavior korunmalı

Mevcut:

```text
user/email target
roles
team
external invite
validation
duplicate checks
expiry
```

davranışlarını bozma.

---

# PART H — SPRINT OLUŞTUR → SAYFA

## H1. Modal kaldırılmalı

Sprint create flow diğer create sayfalarıyla aynı page-form standardına taşınmalı.

## H2. Existing sprint contract korunmalı

Mevcut name, goal, dates, project scope, validation, permissions, mutation ve query invalidation korunmalı.

## H3. DatePicker standardıyla uyum

Sprint create form tarih alanı içeriyorsa PART Q'daki ortak DatePicker standardını kullanmalı.

---

# PART I — COMMIT HISTORY PAGINATION

## I1. Liste + pagination

Commit geçmişi GitHub benzeri list presentation ile gösterilmeli.

Pagination:

```text
Previous
1
2
3
...
Next
```

veya repository mevcut pagination primitive'ine göre eşdeğer olabilir.

## I2. Server-side pagination

Backend commit API zaten pagination destekliyorsa reuse et.

Desteklemiyorsa bütün commit geçmişini frontend'e indirip client-side slice yapmadan önce mevcut integration'ı incele.

Büyük repository histories için server-side/page-based yaklaşım tercih edilmeli.

## I3. Stable ordering

Commit sırası deterministik olmalı.

Örneğin:

```text
committedAt DESC
+
stable secondary key
```

mevcut provider/API'nin sağladığı contract'a göre korunmalı.

## I4. Page state

Loading sırasında eski liste yanlış sayfa olarak gösterilmemeli.

Repository/project switch page'i uygun şekilde resetlemeli.

---

# PART J — ORGANIZATION CARD DIMENSIONS

## J1. ProjectCard görsel source-of-truth

Organizasyon kartlarının width, height/min-height, padding, cover/banner area, content spacing ve grid behavior ölçüleri Proje kartlarıyla aynı görsel ritme gelmeli.

## J2. İçerik farklılığı korunmalı

Aynı boyut aynı içeriğe sahip olacakları anlamına gelmez.

Organization'a özgü bilgiler korunmalı.

Sadece card shell/layout ölçüleri hizalanmalı.

## J3. Responsive

Aşağıdakilerde project/org kartları karşılaştır:

```text
320
390
768
1024
1440
```

Uzun organizasyon/proje isimleri layout'u büyütüp grid'i bozmamalı.

---

# PART K — TEAMS GRID / TABLE TOGGLE

## K1. İki görünüm

Ekipler sayfasında:

```text
Grid
Table
```

iki presentation mode bulunmalı.

Mevcut table kaldırılmamalı.

## K2. Aynı data source

Grid ve Table ayrı ayrı API çağırıp farklı state üretmemeli.

Aynı query, filters, search, pagination ve permissions üzerinden render edilmeli.

## K3. Grid card

Team card mevcut PDA card language ile uyumlu olmalı.

Mümkün olan gerçek bilgiler:

```text
team name
member preview
member count
role/context
actions
```

mevcut model ne sağlıyorsa kullanılmalı.

Yeni N+1 member request üretme.

## K4. Toggle state

Repository'de benzer card/table toggle persistence pattern'i varsa reuse et.

Yoksa minimum local/user preference yaklaşımı kullan.

Account switch'te private data sızıntısı oluşturmamalı.

## K5. Responsive table

Mobile'da tablo yatay overflow veya mevcut responsive davranışıyla çalışmalı.

Grid küçük ekranda tek sütuna düşebilmeli.

---

# PART L — PROJECT INVITATIONS FRONTEND REDESIGN

Mevcut sayfada aşağıdaki bilgiler ve davranışlar korunmalı:

```text
Bekleyen / Tümü
Project
Team
Invitation
Roles
Inviter
Invitation date
Status
Project information
Accept
Reject
Pagination
pending count
```

## L1. Modernize et, feature eksiltme

Current table frontend'i PDA'nın güncel design language'ına getir.

Exact visual composition repository'deki diğer modern list/table/card sayfalarından çıkarılmalı.

## L2. Desktop

Desktop'ta tablo kullanılabilir ancak visual hierarchy, spacing, badges, actions ve readability iyileştirilmeli.

Action'lar sıkışık görünmemeli.

## L3. Mobile

Dar viewport'ta dev yatay tablo zorlamak yerine mevcut PDA responsive pattern'ine uygun responsive row veya card representation kullanılabilir.

Ancak desktop/table semantics kaybolmamalı.

## L4. Existing behavior

Accept/reject/project preview/current pending badge/cache isolation gibi daha önce düzeltilmiş invitation behavior'ları bozulmamalı.

---

# PART M — PROJECT INVITATION PREVIEW BANNER

## M1. Reproduction

Current:

```text
Proje Davetlerim
→ Proje bilgileri
→ preview
```

akışını gerçek project banner bulunan bir project ile test et.

## M2. Banner gösterimi

Project'in banner'ı varsa preview üst bölümünde gerçek banner görünmeli.

Solid/default cover yalnız banner yoksa fallback olmalı.

## M3. Existing project media reuse

Yeni duplicate image storage veya endpoint oluşturma.

Mevcut project banner endpoint, bannerVersion, media URL helper, EntityCover, ProjectCard / Project Preview gibi gerçek infrastructure neyse reuse et.

## M4. Cache/version

Banner değiştirilmişse preview eski cached resmi sonsuza kadar göstermemeli.

Mevcut media version/cache-busting sistemini kullan.

## M5. Error fallback

Banner load fail olursa preview tamamen bozulmamalı.

Default cover/fallback gösterilmeli.

---

# PART N — TEAM INVITATION RESPONSE BADGE

Bu madde kritik.

Şu iki sayıyı birbirine karıştırma:

```text
A) hala PENDING olan team invitation sayısı
B) yeni ACCEPTED / REJECTED invitation response bildirim sayısı
```

Kullanıcının burada istediği:

```text
B — yeni davet cevabı
```

badge'idir.

Örnek:

```text
Ekip Davetleri   +1
```

## N1. Existing events'i incele

Davet edilen kişi accept veya reject yaptığında mevcut backend event/notification/inviter-manager notification üretiyor mu kontrol et.

## N2. Existing Notification Service varsa reuse

Eğer zaten `TEAM_INVITATION_ACCEPTED`, `TEAM_INVITATION_REJECTED` veya anlam olarak eşdeğer notification/event bulunuyorsa ikinci response subsystem oluşturma.

Sidebar badge mümkünse existing unread response state'ten türesin.

## N3. Pending count ile overload etme

Accepted invitation artık PENDING olmadığı için `pendingCount + 1` gibi sahte mantık kurma.

Response badge'in semantiği ayrı olmalı.

## N4. Badge lifecycle

Tercih edilen semantics:

```text
relevant response notification unread
→ Ekip Davetleri +N

notification read
→ count decrements
```

Global Notification Center read/history state'i mevcutsa bununla tutarlı davran.

Sadece `Ekip Davetleri` sayfasını açmak global notification'ı otomatik read yapmıyorsa yeni davranışla bunu değiştirme.

Repository'de farklı mevcut semantics varsa audit sonucunda plan içinde açıkça yaz.

## N5. Project scope

Birden çok proje varsa response badge doğru selected project ile scope edilmeli.

Project A response'u Project B sidebar count'una taşınmamalı.

## N6. Account isolation

Manager A'nın response badge'i logout sonrası Manager B'ye hiçbir frame'de görünmemeli.

---

# PART O — NOTIFICATION HISTORY DELETE

## O1. Scope

Silme yalnız `History / read notifications` için isteniyor.

Unread/New notification'lara bu task kapsamında delete özelliği ekleme.

## O2. Tek notification silme

Her history notification'ın sağında çöp kutusu aksiyonu bulunmalı.

Click:

```text
delete
→ backend persistence
→ row disappears
→ history count/page reconciles
```

olmalı.

Frontend-only gizleme yapma.

## O3. Tümünü sil

History görünümünün sağ üstünde `Tümünü sil` aksiyonu bulunmalı.

Bu current principal'ın tüm READ/HISTORY notification kayıtları için geçerli olmalı.

Unread/New notification'ları silmemeli.

## O4. Backend authorization

Notification ID client'tan gelse bile kullanıcı yalnız kendi notification'ını silebilmeli.

Foreign recipient notification için IDOR kapalı olmalı.

## O5. Physical vs soft delete

Mevcut Notification modelini incele.

Eğer notification rows güvenle physical delete edilebiliyorsa gereksiz soft-delete schema ekleme.

Ancak başka domain audit/history FK bağı varsa önce raporla.

## O6. Confirmation

Single delete için küçük destructive confirmation mevcut PDA pattern'ine göre değerlendirilebilir.

`Tümünü sil` mutlaka açık confirmation istemeli.

Örnek:

```text
Geçmiş bildirimlerin tamamı silinecek.
Bu işlem geri alınamaz.
```

## O7. Cache/pagination

Son item silinince boş page üzerinde bırakma.

Gerekirse bir önceki valid page'e reconcile et.

Hard reload kullanma.

---

# PART P — TASK ACTIVITY COMMENT KEYBOARD

## P1. Yeni contract

Desktop keyboard:

```text
Enter
→ comment submit

Ctrl + Enter
→ newline
```

olmalı.

Mevcut davranışın tam tersi.

## P2. Empty submit

Empty/whitespace comment Enter ile gönderilmemeli.

## P3. IME

IME composition sırasında Enter yanlışlıkla comment submit etmemeli.

`isComposing` benzeri gerçek browser semantics dikkate alınmalı.

## P4. Mobile

Mobile keyboard behavior bozulmamalı.

Mobil kullanıcı için mevcut send button korunmalı.

## P5. Existing multiline behavior

Shift+Enter gibi repository'de zaten tanımlı davranış varsa audit et ve gereksiz yere bozma.

Kullanıcının açık talebi olan:

```text
Enter = send
Ctrl+Enter = newline
```

kesin olarak sağlanmalı.

---

# PART Q — SHARED DATE PICKER + TIME PICKER

Bu task yalnız reminder popup'ını düzeltmek değildir.

Kullanıcı uygulamadaki tarih ve saat seçimlerinin ortak component standardını kullanmasını istiyor.

## Q1. DatePicker source-of-truth

Mevcut:

```text
components/date-picker.tsx
```

önce tamamen incelensin.

Mevcut görsel davranış örneği:

```text
title
month selector
year selector
previous/next month
calendar grid
selected day
Today
Clear
```

Bu component mevcut PDA tarih seçici standardının source-of-truth'u olacak.

## Q2. TimePicker oluştur

Aynı design language ile:

```text
components/time-picker.tsx
```

oluştur.

Mevcut design system/primitives'i reuse et.

## Q3. TimePicker minimum contract

Repository ihtiyaçlarına göre en az:

```text
value
onChange
disabled
clear
minute granularity
24-hour/localized display
validation
```

desteklemeli.

Prop isimleri mevcut component convention'larına göre belirlenmeli.

## Q4. Date/time pairing

Reminder gibi hem tarih hem saat kullanılan alanlarda:

```text
DatePicker
+
TimePicker
```

birbiriyle görsel ve state olarak uyumlu çalışmalı.

## Q5. Tüm kullanım alanlarını migrate et

Audit'te bulunan gerçek tarih/saat selector'ları incelenmeli.

Uygun olanlar ortak DatePicker/TimePicker'a taşınmalı.

Örnek:

```text
Calendar reminder
Task due date
Sprint start/end
Project planning dates
Criteria dates if any
other schedule/deadline forms
```

Repository'de gerçekten varsa.

Olmayan ekran uydurma.

## Q6. Native semantics

Backend'e gönderilen date, time, datetime ve timezone contract'larını sırf UI component değişti diye bozma.

## Q7. Timezone

Calendar/reminder scheduling sırasında mevcut timezone contract korunmalı.

Local UI value ile server persisted instant/date semantics birbirine karıştırılmamalı.

## Q8. Range constraints

DatePicker/TimePicker ihtiyaç duyulan yerlerde min, max, disabled dates, start <= end ve past/future rules gibi mevcut validation contract'larını korumalı.

## Q9. Localization

TR / EN / DE month, weekday, Today, Clear, time labels ve accessibility labels tamamlanmalı.

## Q10. Accessibility

Date/time picker keyboard, Escape, focus return, arrow navigation where existing, screen reader label, selected state ve disabled state açısından test edilmeli.

---

# PART R — CACHE / NAVIGATION / STATE RULES

## R1. Hard reload yok

Aşağıdakiler için hard reload çözüm olarak kullanılmamalı:

```text
priority update
project delete
invitation response badge
notification delete
team view toggle
banner preview
```

## R2. Query invalidation minimum scope

Global `queryClient.clear()` gibi geniş çözümlerden kaçın.

İlgili domain root/key'lerini güncelle.

## R3. Account boundaries

Private projects, teams, invitations ve notifications cache'leri actor identity ile güvenli kalmalı.

Account switch sırasında eski state flash etmemeli.

---

# PART S — I18N / ACCESSIBILITY / RESPONSIVE

## S1. TR / EN / DE

Yeni/değişen tüm metinler:

```text
validation summary
create pages
Grid/Table
invitation UI
notification delete
delete-all confirmation
picker labels
pagination
comment helper text
```

TR / EN / DE olmalı.

## S2. Responsive matrix

Minimum:

```text
320
390
768
1024
1440
```

kontrol et.

Özellikle organization cards, teams grid/table, project invitation UI, full-page forms, date/time pickers ve notification history.

## S3. Themes

Light/dark uyumlu olmalı.

Fixed screenshot renkleri hard-code etme.

Mevcut semantic design token'larını kullan.

---

# PART T — REAL TEST MATRIX

## T1. Missing create section

```text
Create Project
→ required section empty
→ submit
→ inline error
→ bottom validation summary
→ navigate/focus invalid section
```

Aynısı Organization için.

## T2. Priority

```text
Project priority LOW
→ edit HIGH
→ save
→ project list HIGH
→ preview HIGH
→ no reload
```

## T3. Project deletion

```text
open Project A
→ delete Project A
→ redirected safely
→ sidebar Project A absent
→ old internal Project A route inaccessible
```

## T4. Criteria page

```text
Criteria
→ Create
→ full page form
→ validation
→ submit
→ real API/DB
→ back/list contains criterion
```

Modal açılmamalı.

## T5. Member invite page

```text
Team
→ Invite Member
→ full page
→ invite
→ real invitation created
→ cache/list correct
```

## T6. Sprint page

```text
Sprints
→ Create Sprint
→ full page
→ shared DatePicker
→ submit
→ DB
```

## T7. Commit pagination

Gerçek pagination data:

```text
page 1
→ page 2
→ Previous
→ correct deterministic commits
```

## T8. Teams view

```text
Table
→ Grid
→ same team dataset
→ Grid
→ Table
```

Filters/search/page semantics korunmalı.

## T9. Project invitation preview

Project with real banner:

```text
Project Invitations
→ Project information
→ banner visible
```

Banner olmayan project fallback göstermeli.

## T10. Team invitation response badge

```text
Manager invites User B
→ User B accepts
→ relevant manager/project sidebar Ekip Davetleri +1
```

Reject de test edilmeli.

Response notification read olduktan sonra badge semantics plan kararına göre güncellenmeli.

Pending count ile response count karışmamalı.

## T11. Notification delete

```text
History has 3 notifications
→ delete one
→ DB row gone
→ history 2
```

Then:

```text
History has 2
New has 4
→ Delete All History
→ history 0
→ New remains 4
```

## T12. Foreign notification

User A notification ID'sini User B delete etmeye çalışır:

```text
→ denied/not found
→ A row remains
```

## T13. Comment keyboard

```text
type comment
→ Enter
→ submit once
```

```text
type first line
→ Ctrl+Enter
→ newline
→ second line
→ Enter
→ submit multiline comment
```

IME composition ayrıca doğrulanmalı.

## T14. Date/time components

Reminder:

```text
create reminder
→ DatePicker
→ TimePicker
→ select date/time
→ save
→ exact expected persisted value
```

Aynı component standardına migrate edilen diğer forms da smoke/regression test edilmeli.

---

# TASK GRUPLANDIRMA VE BRANCH FAZLARI

Bu scope tek bir 10-task listesi halinde aynı branch'te uygulanmayacak.

Tasklar branch ownership + dependency sırasına göre aşağıdaki fazlarda yürütülecek.

## Phase 0 — Global read-only preflight / audit

Branch değişikliği veya production değişikliği yapmadan önce tüm 15 talep incelenir.

### Checklist
- [ ] 0.1 Mevcut implementation/reproduction çıkarıldı.
- [ ] 0.2 Her talebin owning branch'i doğrulandı.
- [ ] 0.3 Talep 2/3/6 için backend prerequisite gerekip gerekmediği kanıtlandı.
- [ ] 0.4 Shared DatePicker/TimePicker consumer inventory tamamlandı.
- [ ] 0.5 Team response event/notification semantics doğrulandı.
- [ ] 0.6 Notification delete FK/audit etkisi doğrulandı.
- [ ] 0.7 Commit pagination mevcut backend/provider contract'ı doğrulandı.

### DoD
- [ ] Branch/task dependency haritası net.
- [ ] Açık decision gate dışında implementation belirsizliği yok.
- [ ] Production/test/schema/config değişikliği yapılmadı.

---

## Phase 1 — `general-features`

Bu branch'te yalnız aşağıdaki ana talepler yapılır:

```text
1  — Project/Organization create validation summary
4  — Organization card dimensions
13 — Task activity Enter / Ctrl+Enter behavior
15 — Shared DatePicker + new TimePicker + uygun cross-app consumers
```

### Dependency order

```text
Shared Date/Time inventory
→ shared TimePicker / DatePicker compatibility
→ consumers migration
→ create validation summary
→ organization card alignment
→ comment keyboard behavior
→ integrated responsive/i18n/a11y regression
```

Repository gerçekleri daha doğru bir local sıra gösterirse plan içinde gerekçelendir.

### Branch completion DoD
- [ ] Talep 1 tamamlandı/test edildi.
- [ ] Talep 4 tamamlandı/test edildi.
- [ ] Talep 13 tamamlandı/test edildi.
- [ ] Talep 15 tamamlandı/test edildi.
- [ ] General-features targeted regression geçti.
- [ ] Branch-scoped lint/type/build geçti.
- [ ] Kullanıcı değişiklikleri korundu.
- [ ] Commit/push/staging yapılmadı.

### STOP GATE

Bu branch DoD tamamlanınca agent:

```text
BRANCH COMPLETE — general-features
```

raporu verir ve DURUR.

Kullanıcının commit/push onayını bekler.

---

## Transition Gate 1 — kullanıcı commit/push

- [ ] Kullanıcı `general-features` değişikliklerini commit ettiğini doğruladı.
- [ ] Kullanıcı push ettiğini doğruladı.
- [ ] Sonraki branch'in prerequisite commitleri içerdiği doğrulandı.

Bu üç koşul olmadan sonraki implementation fazına geçme.

---

## Phase 2 — `project-service-backend` — CONDITIONAL

Bu faz yalnız Phase 0 audit şu talepler için backend eksikliği kanıtlarsa açılır:

```text
2 — Priority persistence/DTO/API prerequisite
3 — Commit pagination/provider/API prerequisite
6 — Deleted project backend access/list predicate prerequisite
```

Backend eksikliği kanıtlanmadıysa:

```text
Phase 2 — SKIPPED
Reason: no backend prerequisite proved
```

yaz.

Frontend sorunu backend'e taşımak için gereksiz endpoint/schema oluşturma.

### Conditional DoD
- [ ] Yalnız kanıtlanmış backend prerequisite'ler uygulandı.
- [ ] Targeted backend tests geçti.
- [ ] Existing Project Service security/lifecycle regress olmadı.
- [ ] Commit/push/staging yapılmadı.

### STOP GATE

Bu faz gerçekten kullanıldıysa tamamlandığında agent:

```text
BRANCH COMPLETE — project-service-backend
```

raporu verir ve DURUR.

Kullanıcı commit/push yapmadan frontend fazına geçme.

---

## Transition Gate 2

Backend fazı kullanıldıysa:

- [ ] Kullanıcı backend commit/push tamamlandığını doğruladı.
- [ ] `project-service-frontend` gerekli backend contract'ını içeren güncel base'i görüyor.

Backend fazı SKIPPED ise bu gate:

```text
[x] Transition Gate 2 — backend phase skipped; no prerequisite commit
```

şeklinde işaretlenebilir.

---

## Phase 3 — `project-service-frontend`

Bu branch'in ana talepleri:

```text
2  — Project priority list/preview consistency
3  — Commit history pagination UI
5  — Criteria Create → full-page form
6  — Deleted project sidebar/navigation cleanup
8  — Project Invitations redesign
9  — Project invitation preview banner
14 — Sprint Create → full-page form
```

### Dependency order

Önerilen local sıra:

```text
backend prerequisite verification
→ priority/cache consistency
→ deleted-project state/navigation cleanup
→ shared full-page pattern
→ Criteria Create
→ Sprint Create
→ commit pagination
→ invitations redesign
→ preview banner
→ integrated project frontend regression
```

Sprint formu shared DatePicker/TimePicker'a bağımlıysa Phase 1 prerequisite'in branch'te gerçekten mevcut olduğu doğrulanmalı.

### Branch completion DoD
- [ ] Talep 2 tamamlandı/test edildi.
- [ ] Talep 3 tamamlandı/test edildi.
- [ ] Talep 5 tamamlandı/test edildi.
- [ ] Talep 6 tamamlandı/test edildi.
- [ ] Talep 8 tamamlandı/test edildi.
- [ ] Talep 9 tamamlandı/test edildi.
- [ ] Talep 14 tamamlandı/test edildi.
- [ ] Targeted Playwright + lint/type/build geçti.
- [ ] Gerekli backend contract'ları real API/PostgreSQL ile doğrulandı.
- [ ] Commit/push/staging yapılmadı.

### STOP GATE

Tamamlanınca:

```text
BRANCH COMPLETE — project-service-frontend
```

raporu ver ve DUR.

---

## Transition Gate 3

- [ ] Kullanıcı `project-service-frontend` commit/push tamamlandığını doğruladı.
- [ ] `squad-service-backend` branch'i gerekli shared prerequisites'i içeriyor.

---

## Phase 4 — `squad-service-backend`

Bu branch'in ana talepleri:

```text
7  — Teams Grid ↔ Table
10 — Member Invite modal → full-page form
11 — Team invitation ACCEPTED/REJECTED response badge
```

Frontend dosyalarına dokunulması bu feature branch'inde kabul edilir; feature owner Squad'dır.

### Dependency order

```text
existing Squad invitation event audit
→ Teams shared data/view toggle
→ Member Invite full-page flow
→ response notification/badge semantics
→ project/actor cache isolation
→ real multi-user regression
```

Task 11 için existing Notification Service event/type reuse edilmelidir.

Sırf badge için ayrı event store kurulmaz.

### Branch completion DoD
- [ ] Talep 7 tamamlandı/test edildi.
- [ ] Talep 10 tamamlandı/test edildi.
- [ ] Talep 11 tamamlandı/test edildi.
- [ ] Pending count ile response badge karışmıyor.
- [ ] Real accept/reject multi-user flow geçti.
- [ ] Actor/project isolation geçti.
- [ ] Commit/push/staging yapılmadı.

### STOP GATE

Tamamlanınca:

```text
BRANCH COMPLETE — squad-service-backend
```

raporu ver ve DUR.

---

## Transition Gate 4

- [ ] Kullanıcı `squad-service-backend` commit/push tamamlandığını doğruladı.
- [ ] `notification-service` sonraki faz için güncel prerequisite tabanı içeriyor.

---

## Phase 5 — `notification-service`

Bu branch'te yalnız ana talep:

```text
12 — Notification History single delete + Delete All
```

### Dependency order

```text
notification FK/audit check
→ delete contract
→ backend own-recipient authorization
→ frontend single-delete
→ Delete All History
→ pagination/cache reconciliation
→ IDOR/read-vs-unread regression
```

### Branch completion DoD
- [ ] Single History delete persistent.
- [ ] Delete All yalnız read/history kayıtlarını siliyor.
- [ ] New/unread kayıtlar korunuyor.
- [ ] Foreign recipient delete IDOR kapalı.
- [ ] Pagination/cache hard reload olmadan reconciled.
- [ ] Targeted backend/frontend notification tests geçti.
- [ ] Commit/push/staging yapılmadı.

### STOP GATE

Tamamlanınca:

```text
BRANCH COMPLETE — notification-service
```

raporu ver ve DUR.

---

## Transition Gate 5

- [ ] Kullanıcı `notification-service` commit/push tamamlandığını doğruladı.

---

## Phase 6 — Final cross-branch verification / completion

Bu faz yeni feature geliştirme fazı değildir.

Önce kullanıcıdan tüm branch değişikliklerinin hedef integration branch/main üzerinde birleştiği veya doğrulama yapılabilecek ortak bir commit graph oluşturduğu teyit edilir.

Gerekli branchler birbirinin değişikliklerini içermiyorsa fake "full regression passed" iddiasında bulunma.

Final verification:

```text
all relevant backend targeted tests
backend full verify
frontend lint
TypeScript
production build
all targeted Playwright packages
full Chromium
canonical pre-push
Docker build/start/health if canonical
```

çalıştırılır.

### Final DoD
- [ ] Tüm branch phase checkbox'ları `[x]`.
- [ ] Tüm transition gate'ler kullanıcı tarafından doğrulandı.
- [ ] Cross-branch integration gerçekten mevcut.
- [ ] Full regression PASS.
- [ ] Canonical pre-push PASS.
- [ ] Separate implementation completion hazır.
- [ ] Agent commit/push/staging yapmadı.

Bu final faz tamamlanmadan bütün 15 talep global olarak `COMPLETED` ilan edilmez.

---

# BRANCH STOP RAPORU FORMAT

Her branch sonunda kullanıcıya minimum şu formatta rapor ver:

```md
## BRANCH COMPLETE — <branch>

### Tamamlanan tasklar
- [x] ...

### Targeted test sonuçları
- ...

### Değişen alanlar
- ...

### Git durumu
- commit: yapılmadı
- push: yapılmadı
- staging: yapılmadı

### Sonraki branch
`<next-branch>`

### Dependency notu
Önceki branch'in hangi commit/değişikliklerinin sonraki branch'te bulunması gerektiğini belirt.

### ACTION REQUIRED
Bu branch'i commit edip pushla.
Hazır olduğunda haber ver.
Kullanıcı onayı olmadan sonraki branch'e geçmeyeceğim.
```

---

# DECISION GATES

Aşağıdaki durumlarda kendi kendine büyük yeni subsystem oluşturma.

## 1. Team invitation response event yoksa

Önce raporla:

```text
accept/reject event var mı?
notification type var mı?
recipient kim?
project scope mevcut mu?
unread state var mı?
```

Existing Notification Service ile çözüm mümkünse onu kullan.

Sırf sidebar badge için bağımsız event store tasarlama.

## 2. Notification physical delete başka sistemi bozuyorsa

FK/audit/publication dependency bulunursa otomatik schema redesign yapma.

Minimum güvenli çözümü planla ve gerekirse kullanıcıya karar sor.

## 3. Commit API pagination desteklemiyorsa

Mevcut Git provider integration'ını raporla.

Bütün repository commitlerini memory'ye çekmeyi varsayılan çözüm yapma.

## 4. DatePicker bazı özel use-case'leri desteklemiyorsa

Shared component'i minimum backward-compatible props ile genişlet.

Her ekran için ayrı picker oluşturmaya devam etme.

---

# NORMAL SUCCESS MOCK YASAĞI

Ana acceptance mümkün olduğunca:

```text
browser
→ real frontend
→ real API
→ backend
→ PostgreSQL
```

üzerinden doğrulanmalı.

Özellikle:

```text
priority persistence
project deletion
criteria creation
member invitation
sprint creation
team invitation response
notification deletion
reminders
```

normal success için frontend mock ile kanıtlanmamalı.

---

# GİT VE BRANCH GÜVENLİĞİ

Kullanma:

```text
git reset --hard
git checkout .
```

Plan dışı kullanıcı değişikliklerini revert etme.

Agent:

```text
commit
push
staging
pull
merge
rebase
cherry-pick
```

yapmamalı.

Her branch fazı sonunda DURMALI ve kullanıcının commit/push yapmasını beklemeli.

Kullanıcı commit/push tamamlandığını açıkça doğrulamadan sonraki branch implementation'ına geçme.

Branch değiştirme yalnız:

```text
1. kullanıcı branch'i kendisi değiştirdiyse
veya
2. kullanıcı agent'a açıkça branch değiştirme talimatı verdiyse
```

yapılabilir.

Yeni branch'te prerequisite commitlerin varlığı implementation başlamadan doğrulanmalı.

Prerequisite eksikse kod yazmaya başlama; kullanıcıdan branch integration/güncelleme iste.

Bir branch'in tasklarını başka branch'e "kolay olsun" diye taşımak yasaktır; cross-branch finding plan içinde owning branch'e yönlendirilmelidir.

---

# FINAL VALIDATION

Implementation sonunda minimum:

```text
Backend targeted:
- Project update/delete
- invitation
- notification
- sprint
- criteria
- reminder/calendar
- authorization/IDOR

Backend full:
mvn clean verify

Frontend:
lint
TypeScript
production build

Targeted Playwright:
- create validation summary
- priority propagation
- deleted project navigation
- criteria create page
- member invitation page
- sprint create page
- commit pagination
- organization card dimensions
- team grid/table
- project invitation redesign
- preview banner
- team invitation response badge
- notification single/delete-all
- task comment keyboard
- date/time pickers

Full Chromium suite

Canonical:
./pre-push/pre-push.cmd
```

Repository'nin gerçek Windows command/path'lerini kullan.

Docker build/start/health canonical gate'in parçasıysa çalıştır.

---

# IMPLEMENTATION COMPLETION

Implementation tamamen bittikten sonra plan dosyasından ayrı completion dokümanı oluştur.

Final rapor başlıkları:

## Final verdict
## Task checklist
## Create form validation summary
## Project priority consistency
## Deleted project navigation cleanup
## Criteria create page
## Member invitation page
## Sprint create page
## Commit history pagination
## Organization card alignment
## Teams grid/table
## Project Invitations redesign
## Project invitation banner preview
## Team invitation response badge
## Notification History deletion
## Task comment keyboard behavior
## Shared DatePicker / TimePicker
## Cache / navigation / account isolation
## Responsive / accessibility / i18n
## Backend / database changes
## Changed files
## Test results
## Remaining issues
## Pending product decisions

Sadece gerçekten onaylanan scope için blocker kalmadıysa:

```text
Kalan blocker yok.
```

yaz.

---

# KRİTİK KURALLAR

1. Önce 15 talebin mevcut implementation'ını audit et.
2. Taskları yazıldıkları sıraya göre değil dependency sırasına göre oluştur.
3. Project/Organization create inline validation korunmalı; ayrıca submit-level summary gelmeli.
4. Priority update sonrası list ve preview aynı güncel değeri göstermeli.
5. Hard reload cache çözümü değildir.
6. Deleted project selected/sidebar/navigation state'ten temizlenmeli.
7. Deleted project internal routes erişilemez olmalı.
8. Criteria Create modal olmayacak; gerçek form page olacak.
9. Member Invite modal olmayacak; gerçek form page olacak.
10. Sprint Create modal olmayacak; gerçek form page olacak.
11. Mevcut backend business logic page migration sırasında yeniden yazılmamalı.
12. Commit history GitHub benzeri pagination kullanmalı.
13. Büyük commit history client-side komple indirilmemeli.
14. Organization card shell ProjectCard ölçüleriyle hizalanmalı.
15. Teams Grid + Table iki görünüm de korunmalı.
16. Grid/Table aynı query/data source'u kullanmalı.
17. Project Invitations redesign existing accept/reject/preview/pagination davranışını bozmamalı.
18. Project invitation preview gerçek banner'ı göstermeli.
19. Banner yoksa güvenli fallback kullanılmalı.
20. Team invitation PENDING count ile ACCEPTED/REJECTED response badge birbirine karıştırılmamalı.
21. Existing Notification Service response eventleri varsa reuse edilmeli.
22. Team response badge project ve actor scoped olmalı.
23. Notification delete yalnız History/read notifications için uygulanmalı.
24. `Delete All History` unread notifications'ı silmemeli.
25. Notification delete backend persistence üzerinden yapılmalı.
26. Foreign notification delete IDOR engellenmeli.
27. Enter comment gönderir.
28. Ctrl+Enter newline oluşturur.
29. IME composition yanlış submit üretmemeli.
30. Existing `components/date-picker.tsx` tarih seçiminin source-of-truth'u olmalı.
31. Aynı design language ile shared `time-picker.tsx` oluşturulmalı.
32. Uygun tüm date/time consumers ortak componentlere migrate edilmeli.
33. Date/time backend/timezone semantics bozulmamalı.
34. TR/EN/DE tamamlanmalı.
35. Light/dark/mobile/a11y tamamlanmalı.
36. Private cache/account boundaries korunmalı.
37. Existing invitation/notification fixes regress olmamalı.
38. Normal success E2E gerçek backend/PostgreSQL kullanmalı.
39. Persistent checkbox planı oluştur.
40. Her task implementation → targeted test → fix/retest → DoD → `[x]` akışıyla ilerlemeli.
41. DoD tamamlanmadan bağımlı task'a geçilmemeli.
42. Full regression ve canonical pre-push geçmeden tamamlandı sayılmamalı.
43. Commit/push/staging yapma.
44. Implementation branch fazları halinde yürütülmeli.
45. Her branch fazı bittiğinde agent DURMALI ve kullanıcıya haber vermeli.
46. Kullanıcı commit/push onayı vermeden sonraki branch'e geçilmemeli.
47. Branch geçişinde önceki prerequisite commitlerin yeni branch'te mevcut olduğu doğrulanmalı.
48. Agent kullanıcı açıkça istemeden merge/rebase/cherry-pick/pull/branch switch yapmamalı.
49. Tüm branchler ortak integration graph'ında doğrulanmadan global full-completion iddiası yapılmamalı.
