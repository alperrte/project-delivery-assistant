# PDA — Squad Service: Team Deletion, Member Notifications, Invitation UX & Team Cards

PDA içindeki Squad / Ekip sisteminde kapsamlı fakat kontrollü bir geliştirme yapılacak.

Ana istekler:

1. Mevcut **Ekip Arşivleme** davranışı ürün seviyesinde kaldırılacak ve **Ekip Silme** olarak değiştirilecek.
2. Bir ekip proje lideri / yetkili kullanıcı tarafından silindiğinde ekip üyeleri bilgilendirilecek:
   - persistent Notification Service bildirimi,
   - kullanıcı aktifse veya sonraki girişinde modern in-app popup/toast/modal bilgilendirmesi.
3. Ekip Davetleri sayfası modernize edilecek; roller daha düzenli ve ikonlu gösterilecek.
4. Ekip kartlarında ekip üyelerinin profil fotoğrafları gösterilecek; fotoğraf altında isim-soyisim baş harfleri gösterilecek:
   - `Alper Temiz → A.T`
   - `Nisa Camcı → N.C`

EN ÖNEMLİ ÇALIŞMA KURALI:

> Bu istekleri yazıldıkları sıraya göre körlemesine uygulama.

Önce repository'yi incele ve gerçek teknik dependency graph'ı çıkar. Hangi task'ın diğerlerinden önce yapılması gerekiyorsa taskları o sıraya koy. Kesin task sırasını repository analizinden sonra sen belirle.

---

# ÇALIŞMA MODELİ

Önce repository'yi incele. Şu aşamada doğrudan production kodu yazmaya başlama.

Özellikle incele:

- Squad / Team domain
- SquadService / SquadController / SquadRepository / SquadMembership
- Team/Squad archive lifecycle
- ProjectMembership, project roles / permissions
- Project leader / manager authorization
- Notification Service, notification entity / DTO / controller / cache
- mevcut popup/toast/dialog sistemi
- AppShell / authenticated layout / login-session lifecycle
- profile photo API/model ve user summary DTO
- team cards / team detail
- invitations page
- role enums / role icons
- i18n TR / EN / DE
- existing E2E/backend tests
- Flyway migrations

Mevcut isimleri tahmin etme. Repository'deki gerçek isimleri kullan.

---

# PLAN DOSYASI

Repository root'unda:

```text
PDA_SQUAD_SERVICE_MODERNIZATION_PLAN.md
```

oluştur.

Bu dosya implementation süresince **source of truth** olacak.

Taskları teknik dependency sırasına göre grupla.

Her task şu formatta olsun:

```md
## Task 1 — ...

### Amaç
...

### Neden bu sırada?
...

### Etkilenecek alanlar
- Backend:
- Database:
- Frontend:
- Notification:
- Cache:
- Security:
- Tests:

### Checklist
- [ ] 1.1 ...
- [ ] 1.2 ...
- [ ] 1.3 ...

### Definition of Done
- [ ] ...
- [ ] ...
```

Implementation sırasında tamamlanan her madde `[x]` yapılacak. Ben bu checkbox'ları görebilmeliyim.

Bir task'ın Definition of Done maddeleri tamamlanmadan ana taskı bitmiş sayma.

Akış zorunlu:

```text
implementation
→ targeted test
→ bug fix
→ Definition of Done
→ checkbox [x]
→ sonraki task
```

Bir task bitmeden sonraki bağımlı task'a geçme.

---

# 1. MEVCUT SQUAD LIFECYCLE'I ÇIKAR

Önce mevcut sistemi gerçek koddan çıkar:

- ekip nasıl oluşturuluyor?
- ekip nasıl arşivleniyor?
- archivedAt/status var mı?
- arşivlenen ekip üyelikleri ne oluyor?
- task/team ilişkileri ne oluyor?
- invitation kayıtları ne oluyor?
- archived ekip tekrar açılabiliyor mu?
- physical delete var mı?
- FK/cascade davranışı nedir?

Final planı buna göre oluştur.

---

# 2. “ARŞİVLE” → “SİL” ÜRÜN DAVRANIŞI

UI ve ürün dilinde artık `Ekibi Arşivle` yerine `Ekibi Sil` kullanılacak.

Ancak sadece label değiştirme. Gerçek lifecycle semantics'i incele.

“Sil” denildi diye DB satırını körlemesine physical DELETE yapma.

Önce:

- team memberships
- tasks
- invitations
- historical references
- notifications
- reports

ilişkilerini incele.

Veri bütünlüğü/history için soft-delete daha doğruysa kullanıcı deneyiminde “Sil”, backend'de güvenli soft-delete lifecycle kullanılabilir. Bunu planda açıkça belirt.

Physical hard delete ancak gerçekten güvenli ve mevcut architecture ile uyumluysa kullanılmalı.

---

# 3. EKİP SİLME YETKİSİ

Backend source of truth olmalı.

Gerçek permission/policy'i bul. Ekip silme işlemini yalnız mevcut ürün modeline göre yetkili kişiler yapabilmeli.

Test et:

- proje lideri / manager
- normal ekip üyesi
- normal project member
- non-member
- removed member
- başka project's team ID'si
- global admin varsa mevcut policy

Frontend'de butonun gizli olması güvenlik kontrolü sayılmaz.

---

# 4. SİLME CONFIRMATION UX

Silme destructive action olduğu için modern confirmation dialog kullan:

```text
Ekibi sil

"Frontend Ekibi" ekibini silmek üzeresiniz.

Bu ekip artık proje içerisinde kullanılamayacak ve ekip üyeleri
ekibin proje lideri tarafından silindiği konusunda bilgilendirilecek.

[İptal] [Ekibi Sil]
```

Existing destructive dialog/component varsa reuse et. Yeni dialog library ekleme.

Double-click/double-submit engellensin. Loading/error state olsun.

---

# 5. EKİP SİLİNDİĞİNDE BİLDİRİM

Bir ekip silindiğinde, silme anında ekipte bulunan kullanıcılara notification oluştur.

Örnek:

```text
PDA adlı projesinde üyesi olduğunuz Frontend Ekibi adlı ekip
proje lideri tarafından silinmiştir. Bilginize.
```

Notification minimum şu bilgileri taşıyabilmeli:

```text
projectId
projectName
teamId
teamName
actor / deletedBy
event type
createdAt
```

Gerçek Notification Service modeline göre adapte et.

---

# 6. NOTIFICATION RECIPIENT SNAPSHOT

Bu çok önemli.

Ekip silindikten sonra membership kayıtları kaybolabilir/deaktive olabilir. Recipient listesi silme lifecycle'ından **önce** güvenli şekilde belirlenmeli.

Kavramsal akış:

```text
authorized delete
→ current team members snapshot
→ team/project metadata snapshot
→ delete/soft-delete team
→ persistent notifications create
→ transaction commit
→ real-time/in-app delivery
```

Exact transaction/event düzenini repository mimarisine göre tasarla.

Silme rollback olursa kullanıcılara “ekip silindi” bildirimi gitmemeli.

---

# 7. SİLEN KİŞİYE BİLDİRİM

Önerilen davranış:

> Silen actor'a “ekibiniz silindi” bildirimi gönderme; diğer ekip üyelerini bilgilendir.

Repository/product yapısı başka davranış gerektiriyorsa plan içinde açıkça belirt.

---

# 8. PERSISTENT NOTIFICATION

Notification sadece popup olmamalı. Existing Notification Service'e persist edilmeli.

Kullanıcı o anda online değilse, popup'ı kaçırırsa, başka sayfadaysa veya sonra login olursa Notification Center / Bildirimler alanında olay kalmalı.

Existing read/unread semantics'i reuse et. Yeni paralel notification sistemi kurma.

---

# 9. LOGIN / ACTIVE SESSION POPUP

Ek olarak modern in-app bilgi popup'ı istiyorum:

```text
Ekip silindi

"PDA" projesinde üyesi olduğunuz "Frontend Ekibi"
proje lideri tarafından silindi.

Bilginize.
```

Kullanıcı uygulamadaysa mümkünse event sonrası göster.

Kullanıcı offline ise:

```text
sonraki login/session initialization
→ unread/unseen team-deleted notification
→ popup
```

gösterilebilir.

---

# 10. POPUP TEKRARLAMA SEMANTICS

Popup her page refresh'te tekrar tekrar çıkmamalı.

Persistent notification history'de kalmalı fakat popup presentation için gerekirse ayrı `seen/displayed` semantics kullan.

Existing Notification Service'te eşdeğeri varsa reuse et.

Kavramsal hedef:

```text
Notification Center:
kalıcı

Popup:
bir kez / kontrollü
```

---

# 11. POPUP UI

Modern ve rahatsız etmeyen mevcut dialog/toast/banner primitive'lerinden en uygun olanını kullan.

Critical blocking modal olmak zorunda değil.

Yeni UI library ekleme.

---

# 12. NOTIFICATION REAL-TIME

Mevcut Notification Service polling/WebSocket/cache invalidation/event delivery mekanizması kullanıyorsa reuse et.

Chat socket'e bağlama.

Notification Service kendi source of truth'ı olsun.

---

# 13. DELETED TEAM SONRASI UI

Team silindikten sonra:

- Teams listesi
- project overview team count varsa
- selected team
- team detail
- invitations
- member lists
- relevant sidebar state

stale kalmamalı.

Kullanıcı silinen team detail sayfasındaysa uygun şekilde teams listesine yönlendir.

404 loop veya stale cache bırakma.

---

# 14. TEAM TASK / DATA RELATIONS

Takımın task ilişkileri varsa incele.

Team silme:

- task'ları silmemeli
- project'i bozmamalı
- historical data'yı gereksiz yok etmemeli

Tasklarda `teamId` gibi ilişki varsa deletion semantics'i açıkça planla.

---

# PART B — EKİP DAVETLERİ SAYFASI MODERNİZASYONU

# 15. MEVCUT SAYFAYI İNCELE

Mevcut Team Invitations / Ekip Davetleri sayfasını incele:

- layout
- card/table
- invitation status
- role gösterimi
- invitee info
- team info
- inviter
- actions
- resend/cancel
- pagination
- loading/error/empty
- mobile davranışı

Existing functionality'yi koru.

Bu task UI modernization'dır; çalışan backend invitation sistemi yeniden tasarlanmamalı.

---

# 16. MODERN DAVET KARTLARI / TABLOSU

Mevcut design system'e uygun modern yapı oluştur.

Uygun olan bilgiler düzenli görünmeli:

```text
Avatar / initials
Ad Soyad
email
Team
Role / Roles
Status
Invited by
Date
Actions
```

Gerçek DTO'nun taşımadığı veriyi frontend'de uydurma.

---

# 17. ROLE VISUAL DESIGN

Roller daha düzenli gösterilmeli.

Mümkünse mevcut icon setini kullan.

Kavramsal örnek:

```text
PROJECT_MANAGER → Crown/UserGear
FRONTEND_DEVELOPER → Code
BACKEND_DEVELOPER → BracketsCurly/Database
TESTER → Flask/CheckCircle
DESIGNER → Palette
```

Ama gerçek ProjectRole enum'larını repository'den çıkar. Olmayan role uydurma.

Yeni icon library ekleme.

---

# 18. ROLE ICON MAPPING

Role icon mapping tek reusable yerde olsun.

Örneğin:

```text
getProjectRolePresentation(role)
```

ve `label + icon` üretsin.

TR/EN/DE label'ları mevcut i18n üzerinden gelsin.

Hardcoded Turkish mapping yapma.

---

# 19. STATUS DESIGN

Invitation status'leri gerçekte hangileri varsa consistent badge ile gösterilsin.

Renkler mevcut semantic design tokens üzerinden gelsin.

Hardcoded random renk kullanma.

---

# 20. LOADING / EMPTY / ERROR

Ekip Davetleri sayfasında modern:

- skeleton/loading
- empty state
- error
- retry

olmalı.

Server pagination/filter varsa korunmalı.

Client-side fake count/filter yapma.

---

# PART C — TEAM CARDS MEMBER PREVIEW

# 21. EKİP KARTLARI

Teams listesinde her ekip kartında üyelerin profil görselleri gösterilsin.

Örnek:

```text
Frontend Ekibi

👤 👤 👤 👤 +3

A.T  N.C  K.K  H.T
```

Exact visual design'i mevcut card yapısına göre iyileştir.

---

# 22. PROFİL FOTOĞRAFLARI

Gerçek profile photo varsa kullan.

Existing profile photo API/cache/image URL mekanizmasını reuse et.

Profile photo yoksa mevcut Avatar fallback sistemini kullan.

Yeni image endpoint oluşturma, gerçekten gerekmedikçe.

---

# 23. INITIAL FORMAT

Fotoğraf/avatar altında baş harfleri göster:

```text
Alper Temiz        → A.T
Nisa Camcı         → N.C
Kerem Kalyoncu     → K.K
Hamza Taşbay       → H.T
```

Initial formatter reusable olsun.

Edge-case'ler:

- tek isim
- birden fazla isim
- birden fazla soyisim
- boş isim
- Unicode / Türkçe karakterler

Önerilen davranış: first meaningful name token first char + last meaningful name token first char.

Örnek:

```text
Mehmet Ali Yılmaz → M.Y
```

---

# 24. MEMBER COUNT LIMIT

Kartta tüm üyeleri gösterme.

UI yoğunluğuna göre ilk 4–5 üye + `+N` compact preview kullan.

Ama tüm üye listesini almak için N+1 request üretme.

---

# 25. TEAM CARD API / DATA MODEL

Mevcut teams list endpoint'ini incele:

- memberCount taşıyor mu?
- member summaries taşıyor mu?
- avatar/photoVersion var mı?
- her kart frontend ayrı members GET mi yapıyor?

N+1 request oluşturma.

Gerekirse minimum preview DTO ekle:

```text
memberPreview: [
  {
    userId,
    firstName,
    lastName,
    photoVersion
  }
]
memberCount
```

Exact DTO repository architecture'a göre belirlenmeli.

---

# 26. PRIVACY / AUTHORIZATION

Team card member preview yalnız kullanıcının zaten görmeye yetkili olduğu project/team scope içinde gösterilmeli.

Yeni global user directory endpoint oluşturma.

Profile photo veya isim bilgisi authorization'ı bypass etmemeli.

---

# 27. TEAM CARD PERFORMANCE

100 team × members şeklinde N+1 query oluşturma.

Gerekirse batch summary/projection/bounded preview query kullan.

Team list page size ile query count lineer büyümemeli.

---

# PART D — TESTLER / GÜVENLİK

# 28. TEAM DELETE BACKEND TESTLERİ

En az:

- authorized manager delete
- unauthorized member reject
- foreign project team reject
- already deleted team
- deleted team detail inaccessible
- siblings/project unaffected
- member snapshot correct
- actor notification policy
- rollback → no notification
- concurrent delete double-submit

test et.

---

# 29. NOTIFICATION TESTLERİ

En az iki team member ile:

```text
Manager deletes Team X
→ Member A notification persisted
→ Member B notification persisted
→ actor excluded if policy says so
```

Notification history'de kalmalı.

Popup bir kez gösterilmeli.

Refresh sonrası aynı popup tekrar spam olmamalı.

Read/unread mevcut contract ile uyumlu olmalı.

---

# 30. LOGIN POPUP E2E

Senaryo:

```text
Member offline/logged out
→ manager deletes team
→ member login
→ popup appears
→ closes popup
→ Notification Center still contains event
→ refresh
→ popup does not spam again
```

Gerçek backend kullan.

Normal success flow'da `route.fulfill` kullanma.

---

# 31. ACTIVE USER E2E

Kullanıcı online iken:

```text
member logged in
manager deletes team
→ notification becomes available
→ popup/in-app notification appears
```

Mevcut notification delivery real-time değilse gereksiz yeni infra ekleme.

---

# 32. TEAM CARD E2E

Test:

```text
Team has:
Alper Temiz
Nisa Camcı
Kerem Kalyoncu
Hamza Taşbay
...
```

Card:

- profile photos/fallbacks visible
- A.T / N.C / K.K / H.T doğru
- overflow `+N` doğru
- member count doğru

Detail sayfasına girmeden görünmeli.

---

# 33. INVITATIONS UI REGRESSION

Mevcut çalışan:

- create invitation
- resend
- cancel
- status
- roles
- selected team
- pagination
- permissions

bozulmamalı.

UI modernization business logic'i bozmamalı.

---

# 34. CACHE INVALIDATION

Team delete sonrası gerçek kullanılan query keys için uygun invalidation/update yap:

```text
teams list
team detail
project team count
members
invitations
notifications
```

Member add/remove/invite accept sonrası kart preview/count güncellenmeli.

Hard reload çözüm olmasın.

---

# 35. i18n

Yeni tüm UI metinleri TR / EN / DE kataloglarında olmalı.

Hardcoded Türkçe production string bırakma.

---

# 36. ACCESSIBILITY

Kontrol et:

- delete dialog keyboard/focus
- destructive action aria
- popup screen-reader
- role icon text labels
- avatar alt text
- invitation actions keyboard
- tooltip
- contrast
- notification close/focus

---

# 37. RESPONSIVE / THEME

320 / 390 / 768 / 1024 / 1440 px; light/dark/reduced-motion doğrula.

Team cards ve invitation page taşmamalı.

---

# 38. MOCK / FAKE YASAĞI

Normal başarılı E2E akışlarında gerçek frontend → backend → PostgreSQL kullan.

Production relation'ı fake data ile kanıtlama.

Test-only failure injection ayrı belirtilmeli.

---

# 39. GİT GÜVENLİĞİ

Kullanıcı değişikliklerini kaybetme.

Kullanma:

```text
git reset --hard
git checkout .
```

Plan dışı dosyaları revert etme.

Commit/push/staging yapma.

---

# 40. TASK GRUPLANDIRMA

Yukarıdaki maddeleri tek tek task yapma.

Gerçek dependency graph'a göre anlamlı tasklar oluştur.

Muhtemel sıra:

```text
Task 1 — Preflight / current Squad + Notification architecture
Task 2 — Team delete lifecycle + authorization + DB/domain semantics
Task 3 — Team deletion persistent notifications
Task 4 — Login/active-session deletion popup + seen semantics
Task 5 — Team delete frontend UX/cache/navigation
Task 6 — Team card member preview backend contract/performance
Task 7 — Team card avatar/initial UI
Task 8 — Team Invitations modernization + role presentation
Task 9 — Combined security/runtime/E2E regression
Task 10 — Full gate + completion
```

BU SIRA SADECE ÖRNEKTİR.

Repository analizine göre daha mantıklı sıra varsa onu kullan.

En önemli şart: bağımlı task'ı prerequisite task tamamlanmadan başlatma.

---

# 41. HER TASK İÇİN

Her task'ta mutlaka yaz:

- Amaç
- Neden bu sırada
- Prerequisite
- Backend
- Database
- Frontend
- Notification
- Cache
- Security
- i18n/a11y
- Edge cases
- Tests
- Definition of Done
- Checkbox listesi

---

# 42. FINAL VALIDATION

Implementation bittikten sonra:

```text
backend targeted tests
backend full tests
frontend lint
TypeScript
production build
targeted Playwright
full Chromium Playwright
```

çalıştır.

Ardından canonical:

```text
./pre-push/pre-push.cmd
```

veya repository'deki gerçek eşdeğeri çalıştır.

Backend gate'i atlama.

Docker build/start/health varsa doğrula.

---

# 43. IMPLEMENTATION COMPLETION

İş tamamen bittikten sonra ayrı completion kaydı oluştur.

Audit/plan dosyasını completion yerine kullanma.

Final rapor başlıkları:

## Final verdict
## Task checklist
## Team deletion lifecycle
## Notification persistence
## Login / active-session popup
## Team card member previews
## Profile photo / initials behavior
## Team invitations modernization
## Role icon mapping
## Authorization / security
## Cache behavior
## Changed files
## Test results
## Remaining issues

Sadece gerçekten blocker kalmadıysa:

```text
Kalan blocker yok.
```

yaz.

---

# KRİTİK KURALLAR

1. Önce repository'yi incele, sonra task sırasını belirle.
2. Kullanıcının yazdığı sırayı teknik sıra sanma.
3. Checkbox'lı persistent plan oluştur.
4. Her tamamlanan maddeyi `[x]` yap.
5. Task DoD tamamlanmadan sonraki bağımlı task'a geçme.
6. “Archive” label'ını sadece “Delete” diye rename edip geçme; gerçek lifecycle semantics'i incele.
7. Physical delete'i körlemesine uygulama.
8. Team delete authorization backend'de enforce edilmeli.
9. Notification recipients deletion'dan önce güvenli snapshot edilmeli.
10. Rollback olan deletion için notification gönderilmemeli.
11. Persistent Notification Service source of truth olmalı.
12. Popup persistent notification'ın yerine geçmemeli.
13. Popup refresh/login boyunca spam olmamalı.
14. Notification history'de kalmalı.
15. Existing Notification Service varken paralel notification sistemi kurma.
16. Team card üyeleri için N+1 frontend/API request oluşturma.
17. Profile photo için mevcut photo infrastructure'ı reuse et.
18. Initials formatter reusable olmalı.
19. Team invitations modernization business logic'i değiştirmemeli.
20. Role icon mapping gerçek enum'lardan oluşturulmalı.
21. Yeni icon/component library ekleme.
22. Existing invite/create/resend/cancel/accept semantics bozulmamalı.
23. ProjectMembership / SquadMembership güvenliği korunmalı.
24. Cross-project/team IDOR test edilmeli.
25. TR/EN/DE tamamlanmalı.
26. Dark/light/mobile/a11y tamamlanmalı.
27. Normal success E2E'lerde mock kullanma.
28. Full regression + canonical pre-push geçmeden tamamlandı sayma.
29. Commit/push/staging yapma.
