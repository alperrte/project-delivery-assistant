# PDA — Username Rules, Public UI Polish, Theme Performance & Teams Member Cards

PDA içerisinde account/profile validation, public sayfa UI standardizasyonu, cookie consent yerleşimi, theme performansı ve Teams frontend görünümüyle ilgili bir dizi iyileştirme yapılacak.

Kullanıcının ham talepleri:

1. Kullanıcı adı değiştirme kuralları genel olarak gevşetilmeli. Kullanıcı adı için `_` veya `-` kullanma zorunluluğu olmamalı; normal boşluk (`space`) desteklenmeli. Kullanıcı `Hamza Taşbay` gibi doğal bir görünen kullanıcı adı yazabilmeli. `_` ve `-` de isteğe bağlı olarak kabul edilmeye devam etmeli. Register/profile edit/backend validation aynı kurala sahip olmalı.
2. Landing ve Login sayfalarındaki scrollbar renkleri PDA renk paletiyle uyumlu değil; mevcut uygulama scrollbar standardına getirilmeli.
3. Cookie consent/banner ekranın sol alt köşesinde değil, yatay olarak ortalanmış alt bölgede görünmeli. Landing'de footer'ın hemen üstünde; Login ekranında alt içerik bölgesinin üzerinde doğru ve responsive konumlanmalı.
4. Landing ve Login sayfalarında dark/light theme geçişi kasıyor. Gerçek sebep bulunmalı, ölçülmeli ve gerekiyorsa render/CSS/theme optimizasyonu yapılmalı.
5. Sidebar'daki Ekipler sayfasında ekip üyeleri görsel olarak yeniden düzenlenmeli:
   - üyeler yan yana profil fotoğraflarıyla gösterilmeli,
   - her profil fotoğrafının altında kullanıcının adı,
   - onun altında ekipteki pozisyonu/rolü (`Backend Developer`, `Frontend Developer` vb.)
   gösterilmeli.

Bu maddeleri yazıldıkları sırayla körlemesine implement etme.

Önce repository'yi incele, gerçek source-of-truth ve dependency graph'ını çıkar.

Her task:

```text
implementation
→ targeted test
→ gerekli bug fix
→ targeted re-test
→ Definition of Done
→ checkbox [x]
→ sonraki bağımlı task
```

akışıyla yürütülmeli.

Bir taskın DoD'si tamamlanmadan bağımlı task'a geçme.

---

# ÇALIŞMA MODELİ

İlk turda production kodu değiştirmeye başlama.

Önce audit yap.

Özellikle aşağıdaki alanları incele:

```text
User entity
nickname / username field
register validation
profile edit validation
backend DTO validation
database uniqueness constraint
normalization / trim behavior
login/session identity
frontend account/profile forms

Landing page
Login page
App/public layouts
globals.css
scrollbar styles
theme variables
light/dark theme provider
theme toggle
hydration
CSS transitions
React render boundaries

Cookie consent provider
Cookie banner
Cookie preferences
footer
public layouts
login layout
responsive safe areas

Teams page
Squad/Team DTOs
team member list
profile photo/avatar API
firstName/lastName/displayName
team position / role
member preview
Grid/Table/Schema views
N+1 risks
```

İsimleri tahmin etme.

Repository'deki gerçek entity, DTO, route, hook, component ve query key'lerini kullan.

---

# PERSISTENT PLAN

Repository root'unda:

```text
PDA_ACCOUNT_PUBLIC_UI_THEME_TEAMS_REFINEMENTS_PLAN.md
```

oluştur.

Plan implementation boyunca source of truth olacak.

Planın en üstünde:

```md
## Branch execution status

- [ ] Phase 0 — Global read-only audit
- [ ] Phase 1 — `general-features`
- [ ] Transition Gate 1 — user commit/push confirmation
- [ ] Phase 2 — `squad-service-backend`
- [ ] Transition Gate 2 — user commit/push confirmation
- [ ] Phase 3 — Final integrated verification
```

bulunsun.

Her task:

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
- Cache:
- Security:
- Performance:
- Shared Components:
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

formatında yazılmalı.

Tamamlandıkça `[ ]` → `[x]` yapılmalı.

---

# BRANCH OWNERSHIP

Bu scope iki ana branch fazında uygulanacak.

## Phase 1 — `general-features`

Bu branch'e ait talepler:

```text
1 — Username/nickname validation
2 — Landing/Login scrollbar palette
3 — Cookie consent bottom-center placement
4 — Landing/Login theme-switch performance
```

## Phase 2 — `squad-service-backend`

Bu branch'e ait talep:

```text
5 — Teams member card/member presentation redesign
```

Branch adı yalnız backend değişikliği yapılacağı anlamına gelmez.

Teams/Squad feature'ının gerektirdiği frontend değişiklikleri de `squad-service-backend` feature branch'inde yapılabilir.

---

# BRANCH STOP GATE

`general-features` taskları tamamlandığında agent:

```text
BRANCH COMPLETE — general-features
```

diye rapor vermeli ve DURMALI.

Şunları açıkça yazmalı:

```text
Tamamlanan tasklar:
- [x] Username rules
- [x] Public scrollbar
- [x] Cookie banner placement
- [x] Theme performance

Git:
- commit yapılmadı
- push yapılmadı
- staging yapılmadı

SONRAKİ BRANCH:
squad-service-backend

ACTION REQUIRED:
general-features değişikliklerini commit edip pushla.
squad-service-backend branch'ine geç.
Hazır olduğunda bana "devam et" de.
```

Kullanıcı commit/push yaptığını ve branch'i değiştirdiğini açıkça söylemeden `squad-service-backend` implementation'ına geçme.

Agent kendi kendine:

```text
commit
push
merge
rebase
cherry-pick
pull
branch switch
```

yapmamalı.

Yeni branch'te önceki prerequisite commitlere ihtiyaç varsa mevcut olduklarını read-only doğrula.

---

# PART A — USERNAME / NICKNAME CONTRACT

## A1. Gerçek alanı belirle

Önce sistemde kullanıcının gördüğü "kullanıcı adı" alanının gerçekten:

```text
username
nickname
displayName
```

hangisi olduğunu source'tan belirle.

Terminolojiyi tahmin etme.

## A2. Mevcut validation'ı çıkar

Aşağıdaki bütün yüzeyleri kontrol et:

```text
registration
profile/account edit
backend request DTO
service validation
database constraint
frontend regex/schema
i18n validation messages
E2E fixtures
```

Frontend ve backend farklı kurallar uygulamamalı.

## A3. Yeni username/nickname contract

Mevcut kullanıcı adı karakter kısıtları genel olarak gevşetilmeli.

Kullanıcı adı oluştururken veya değiştirirken `_` ya da `-` kullanma zorunluluğu OLMAMALI.

Normal boşluk (`space`) karakteri desteklenmeli.

Aşağıdakilerin tamamı geçerli örneklerdir:

```text
Hamza
Hamza Taşbay
Hamza_Taşbay
Hamza-Taşbay
Hamza Taşbay 27
Hamza_Taşbay-27
Çağrı Öztürk
Yağız Çelik
```

Kullanıcı kendi görünen kullanıcı adını doğal bir isim/display-name gibi yazabilmeli.

Frontend ve backend validation kullanıcıyı kelimeleri `_` veya `-` ile birleştirmeye zorlamamalı.

İç boşluklar korunmalı:

```text
Hamza Taşbay
→ Hamza Taşbay
```

Baştaki ve sondaki gereksiz boşluklar trimlenebilir:

```text
  Hamza Taşbay  
→ Hamza Taşbay
```

Birden fazla ardışık boşluğun normalize edilip edilmeyeceği mevcut domain davranışına göre belirlenmeli; kullanıcı metnini sessizce ve gereksiz yere değiştirme.

Unicode/Türkçe karakter desteği korunmalı.

`_` ve `-` isteğe bağlı olarak desteklenmeye devam etmeli; bunlar zorunlu ayraç değildir.

Ancak güvenlik ve veri bütünlüğü için aşağıdaki girdiler yine reddedilebilir:

```text
control characters
newline / carriage return
null byte
HTML/script injection amacı taşıyan geçersiz input
görünmez abuse karakterleri
```

Bu güvenlik sınırları normal boşluk, `_`, `-`, Türkçe karakterler veya doğal isim kullanımını engellememeli.

## A4. Length

Mevcut min/max length contract'ını önce doğrula.

Güvenlik veya UX gerekçesi olmadan değiştirme.

## A5. Uniqueness

Username/nickname unique ise:

```text
case sensitivity
normalization
trim
database unique constraint
race condition
409 conflict
```

davranışlarını doğrula.

## A6. Account identity

Nickname/username değişikliği login identity, JWT/session subject, user UUID, permissions ve memberships alanlarını değiştirmemeli.

Eğer login email üzerinden çalışıyorsa nickname rename login identity'yi etkilememeli.

## A7. Cache propagation

Kullanıcı adını değiştirdikten sonra hard reload olmadan account page, navbar/avatar menu, team member presentation ve project/invitation surfaces gibi ilgili cached yüzeyler yeni değeri göstermeli.

Global query clear kullanma.

---

# PART B — LANDING / LOGIN SCROLLBAR STANDARDIZATION

## B1. Mevcut scrollbar standardını bul

Authenticated app içerisinde zaten kullanılan:

```text
scrollbar-color
::-webkit-scrollbar
::-webkit-scrollbar-thumb
semantic color token
```

standardını incele.

Landing/Login için ikinci bağımsız palette oluşturma.

## B2. Public pages

Landing ve Login sayfalarındaki root/page scrollbar light/dark theme ile PDA palette uyumlu olmalı.

## B3. Scope

Scroll styling yanlışlıkla textarea, code block, popover, modal, table horizontal scrollbar veya chat gibi farklı semantic scrollbar'ları bozmasın.

## B4. Browser compatibility

En az Chromium/WebKit ve Firefox davranışını dikkate al.

Scrollbar'ı tamamen gizleme.

---

# PART C — COOKIE CONSENT POSITION

## C1. Mevcut component'i reuse

Cookie Consent sistemini yeniden tasarlama.

Sadece gerçek mevcut banner/preferences implementation'ını kullan.

Consent semantics:

```text
default analytics OFF
accept
reject
manage preferences
withdraw
```

aynen korunmalı.

## C2. Yeni görsel konum

Cookie banner sol alt köşede olmamalı.

Desktop hedefi horizontal center + bottom region olmalı.

Landing page'de footer'ın hemen üstünde, Login'de login içeriğinin alt bölgesinde horizontal centered görünmeli.

## C3. Footer overlap

Banner footer links, Cookie Policy, Contact, buttons ve form controls alanlarını erişilemez hale getirmemeli.

Footer yüksekliği/responsive layout gerçek runtime'da ölçülmeli.

Hard-coded tek bir `bottom` değeri ancak tüm layoutlarda gerçekten doğruysa kullanılmalı.

## C4. Mobile

320 / 390 / 768 / 1024 / 1440 viewportlarda kontrol et.

Mobile'da left/right safe spacing ve bottom safe area korunmalı.

## C5. Preferences dialog

Cookie preference modal/dialog konumu değişmek zorunda değil.

Talep ana consent/banner yerleşimi içindir.

---

# PART D — LANDING / LOGIN THEME PERFORMANCE

Bu taskta "animasyonu azaltıp geçti" yaklaşımı kullanma.

Önce gerçek sebebi ölç.

## D1. Reproduction

Gerçek browser'da:

```text
Landing light → dark
Landing dark → light
Login light → dark
Login dark → light
```

geçişini gözlemle.

Şunları ayır:

```text
click latency
main-thread stall
layout/reflow
paint
CSS transition
React rerender
hydration
image/media redraw
theme provider update
storage write
```

## D2. Profiling

Mümkün olduğunca browser/React profiling ile belirle:

```text
hangi componentler rerender oluyor?
kaç kez rerender oluyor?
hangi DOM subtree gereksiz invalidated?
theme değişiminde layout shift var mı?
global transition rule var mı?
heavy backdrop/filter/shadow repaint var mı?
```

Sebebi kanıtlamadan büyük refactor yapma.

## D3. Common causes

Özellikle kontrol et:

```text
transition: all
global color/background transition
large blur/backdrop-filter
multiple fixed layers
large shadows
theme toggle state duplication
unnecessary context consumers
theme-dependent JS calculations
full page remount
hydration mismatch workaround
```

Ancak bunlardan birini suçlu varsayma.

## D4. Beklenen sonuç

Theme toggle route navigation yapmamalı, full page remount yapmamalı, noticeable freeze oluşturmamalı ve input/focus state kaybetmemeli.

## D5. Animation policy

Theme change sırasında renk geçişi kullanılacaksa short, targeted ve GPU/paint friendly olmalı.

`transition: all` gibi geniş transition'lardan kaçın.

Reduced-motion preference korunmalı.

## D6. No flash

Optimization sonrası FOUC, wrong-theme flash veya hydration warning oluşmamalı.

## D7. Public + authenticated regression

Shared theme infrastructure değiştiriliyorsa authenticated application theme davranışı da smoke test edilmeli.

---

# PART E — TEAMS MEMBER PRESENTATION

Bu task `squad-service-backend` branch'inde uygulanacak.

## E1. Mevcut Teams views

Önce Teams sayfasındaki gerçek Grid, Table ve Schema / org tree görünümlerini çıkar.

Mevcut view switcher korunmalı.

## E2. İstenen üye görsel yapısı

Team/Grid presentation içerisinde üyeler:

```text
[Avatar] [Avatar] [Avatar]
  Ad       Ad       Ad
 Pozisyon Pozisyon Pozisyon
```

mantığında yan yana gösterilmeli.

Her üye için:
1. Profil fotoğrafı
2. Adı / display name
3. Pozisyonu

görünmeli.

## E3. Position source

Pozisyon metnini uydurma.

Repository'de gerçek source'u araştır:

```text
team role
project role
job title
position
member role
profession
```

`Backend Developer`, `Frontend Developer` gibi bilgiler hangi gerçek modelden geliyorsa onu kullan.

Eğer sistemde gerçek "position/job title" alanı bulunmuyorsa:

```text
MISSING DATA CONTRACT
```

olarak raporla.

Team role'ü sessizce job title gibi göstermeden önce semantiğini doğrula.

## E4. Backend data shape

Team list endpoint'i gerekli üye verisini zaten taşıyorsa yeni API oluşturma.

Eksikse N+1 üretmeden minimal batch/list DTO genişletmesi değerlendir.

## E5. N+1 yasağı

Her card için team → member list → each member profile şeklinde onlarca request üretme.

Existing member preview/batch identity infrastructure varsa reuse et.

## E6. Avatar

Profil fotoğrafı varsa gerçek fotoğraf.

Yoksa mevcut PDA Avatar fallback standardı kullanılmalı.

İsimden initials üretilecekse existing helper'ı reuse et.

## E7. Uzun isim / pozisyon

Çok uzun isim, uzun position, çok üye, fotoğrafsız kullanıcı ve Unicode isim test edilmeli.

Card yüksekliği kontrolsüz büyümemeli.

## E8. Fazla üye

Bir team çok kalabalıksa bütün üyeleri tek satıra zorlayıp layout'u bozma.

Repository design'ına göre wrap, bounded preview, +N veya scroll yaklaşımından en uygun olanı seç.

## E9. Table/Schema

Grid redesign Table ve Schema görünümlerini kaldırmamalı.

---

# PART F — SECURITY / DATA INTEGRITY

## F1. Username XSS

Yeni `_` / `-` desteği HTML/script injection riski oluşturmamalı.

Display her yerde React/plain-text semantics ile yapılmalı.

## F2. User rename authorization

Kullanıcı yalnız kendi nickname/username'ini değiştirebilmeli.

Client userId göndererek başka account rename edememeli.

## F3. Team member privacy

Teams endpoint'i yalnız kullanıcının zaten görmeye yetkili olduğu member identity/profile bilgilerini expose etmeli.

Yeni DTO ile email/private account metadata ekleme.

---

# PART G — I18N / A11Y / RESPONSIVE

Yeni/değişen metinler TR / EN / DE olmalı.

Cookie banner ve theme toggle keyboard/focus davranışı korunmalı.

Team member cards screen-reader açısından anlamlı isim/position ilişkisine sahip olmalı.

Viewportlar:

```text
320
390
768
1024
1440
```

ile doğrulanmalı.

Light / dark / reduced motion test edilmeli.

---

# REAL TEST MATRIX

## Test 1 — Username

Register ve profile edit için gerçek backend validation ile en az:

```text
Hamza
→ accepted

Hamza Taşbay
→ accepted

hamza_tasbay
→ accepted

hamza-tasbay
→ accepted

Hamza Taşbay 27
→ accepted

Hamza_Taşbay-27
→ accepted

Çağrı Öztürk
→ accepted
```

Ayrıca:

```text
  Hamza Taşbay  
→ trim sonrası geçerli davranış
```

doğrulanmalı.

Normal iç boşluk frontend veya backend tarafından `_` / `-` karakterine zorla dönüştürülmemeli.

Invalid/security edge cases ayrı test edilmeli.

## Test 2 — Rename cache

```text
User old nickname
→ change nickname
→ backend success
→ navbar/account/team relevant surface new nickname
→ no hard reload
```

## Test 3 — Scrollbars

Landing/Login light ve dark görsel screenshot/inspection ile palette uyumu doğrulanmalı.

## Test 4 — Cookie placement

Landing:

```text
fresh consent state
→ banner centered bottom
→ footer visible/accessible
```

Login:

```text
fresh consent state
→ banner centered bottom
→ login form/buttons not blocked
```

320–1440 test edilmeli.

## Test 5 — Theme performance

Landing ve Login üzerinde light/dark multiple toggles çalıştır.

No visible freeze / remount / focus loss.

Fix öncesi problem ve fix sonrası davranış mümkün olduğunca ölçülebilir evidence ile raporlanmalı.

## Test 6 — Teams

Gerçek backend data:

```text
open Teams
→ Grid
→ team members visible
→ avatar
→ name
→ position
```

Table/Schema view switch korunmalı.

## Test 7 — Teams edge cases

```text
photo
no photo
long name
long position
many members
0 members
```

responsive kontrol edilmeli.

---

# TASK DEPENDENCY ORDER

Repository gerçekleri aksini göstermiyorsa plan şu mantıksal sırayla ilerlesin:

```text
Phase 0 — Global read-only audit

Phase 1 — general-features

Task 1 — Username validation contract
         backend + frontend + cache propagation

Task 2 — Shared/public scrollbar palette

Task 3 — Cookie consent responsive bottom-center placement

Task 4 — Theme performance profiling + root-cause fix

Task 5 — general-features integrated regression

STOP
→ user commit/push

Phase 2 — squad-service-backend

Task 6 — Teams member data contract audit
Task 7 — Teams avatar/name/position card presentation
Task 8 — Teams responsive / N+1 / view-mode regression

STOP
→ user commit/push

Phase 3 — Final integrated regression / completion
```

BU SIRA REPOSITORY AUDIT SONUCUNA GÖRE TASK İÇİNDE DEĞİŞEBİLİR.

Ama branch ownership korunmalı.

---

# GENERAL-FEATURES STOP GATE

`general-features` tamamen bitince:

```text
BRANCH COMPLETE — general-features
```

raporu ver.

Minimum:

```md
### Tamamlanan tasklar
- [x] Username
- [x] Landing/Login scrollbar
- [x] Cookie placement
- [x] Theme performance

### Testler
...

### Git
commit yapılmadı
push yapılmadı
staging yapılmadı

### Sonraki branch
`squad-service-backend`

### ACTION REQUIRED
general-features değişikliklerini commit edip pushla.
squad-service-backend branch'ine geç.
Hazır olduğunda bana "devam et" de.

STOP.
```

Kullanıcı onayı olmadan devam etme.

---

# SQUAD-SERVICE-BACKEND STOP GATE

Teams taskları bitince:

```text
BRANCH COMPLETE — squad-service-backend
```

raporu ver ve yine DUR.

Commit/push kullanıcı tarafından yapılacak.

---

# GİT GÜVENLİĞİ

Agent:

```text
commit
push
stage
pull
merge
rebase
cherry-pick
branch switch
```

yapmamalı.

Kullanıcı açıkça istemedikçe branch değiştirme.

Kullanma:

```text
git reset --hard
git checkout .
```

Plan dışı kullanıcı değişikliklerini revert etme.

---

# FINAL VALIDATION

Minimum:

```text
Backend targeted:
- user/profile validation
- rename/uniqueness/security
- teams/member DTO if changed

Backend full:
mvn clean verify

Frontend:
lint
TypeScript
production build

Targeted Playwright:
- username registration/edit
- username cache propagation
- landing/login scrollbar
- cookie placement
- theme switching
- Teams member presentation
- Teams Grid/Table/Schema regression

Full Chromium suite

Canonical:
./pre-push/pre-push.cmd
```

Docker build/start/health canonical gate'in parçasıysa çalıştır.

---

# IMPLEMENTATION COMPLETION

Final completion ayrı doküman olmalı.

Başlıklar:

## Final verdict
## Task checklist
## Username contract
## Username rename/cache behavior
## Public scrollbar styling
## Cookie banner placement
## Theme performance root cause
## Theme performance fix/evidence
## Teams member data source
## Teams member card presentation
## N+1 / performance
## Responsive / accessibility / i18n
## Backend/database changes
## Changed files
## Test results
## Remaining issues
## Pending product decisions

---

# KRİTİK KURALLAR

1. Önce gerçek username/nickname contract'ını audit et.
2. `_` veya `-` kullanmak zorunlu olmayacak.
3. Normal boşluk (`space`) geçerli kullanıcı adı karakteri olacak; `Hamza Taşbay` kabul edilmeli.
4. `_` ve `-` isteğe bağlı olarak kabul edilmeye devam etmeli.
7. Türkçe/Unicode harf desteği korunmalı.
8. Frontend/backend aynı validation contract'ını kullanmalı.
7. Nickname rename login identity/user UUID'yi değiştirmemeli.
8. Username render plain-text/XSS-safe olmalı.
9. Rename sonrası ilgili cache'ler hard reload olmadan güncellenmeli.
10. Landing/Login scrollbar mevcut PDA palette/token sistemini reuse etmeli.
11. Scrollbar gizlenmemeli.
12. Cookie consent semantics değiştirilmemeli.
13. Cookie banner bottom-center konumlandırılmalı.
14. Landing'de footer'ı erişilemez hale getirmemeli.
15. Login formunu kapatmamalı.
16. Theme kasmasının nedeni ölçülmeden random optimization yapılmamalı.
17. `transition: all` ve gereksiz full-page rerender gibi problemler araştırılmalı.
18. Theme fix FOUC/hydration regression oluşturmamalı.
19. Reduced-motion korunmalı.
20. Teams üye presentation profil fotoğrafı + isim + pozisyon göstermeli.
21. Pozisyon bilgisi gerçek domain source'tan gelmeli; uydurulmamalı.
22. Team member rendering N+1 oluşturmamalı.
23. Table/Schema gibi mevcut Teams görünümleri kaldırılmamalı.
24. TR/EN/DE tamamlanmalı.
25. 320/390/768/1024/1440 test edilmeli.
26. Light/dark/mobile/a11y tamamlanmalı.
27. Persistent checkbox planı oluşturulmalı.
28. Her task implementation → test → fix/retest → DoD → `[x]` akışıyla yürümeli.
29. `general-features` tamamlanınca agent DURMALI.
30. Kullanıcı commit/push yapmadan `squad-service-backend`e geçilmemeli.
31. `squad-service-backend` tamamlanınca agent tekrar DURMALI.
32. Full regression + canonical pre-push geçmeden global completion ilan edilmemeli.
33. Commit/push/staging yapılmamalı.
