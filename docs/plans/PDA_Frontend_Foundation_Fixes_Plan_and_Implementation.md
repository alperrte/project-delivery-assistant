# PDA — Frontend Foundation Fixes: Username Editing, Navbar Lifecycle, Safe History & Scrollbar Theme

PDA frontendinde birbirinden bağımsız görünen fakat ortak layout/session/profile altyapısına dokunan dört iyileştirme yapılacak.

Kullanıcı istekleri ham haliyle şunlardır:

1. Sayfanın en altındayken yukarı doğru scroll yapıldığında navbar yeniden görünüyor fakat kullanıcı scroll'u bıraktıktan sonra bir süre geçmesine rağmen navbar kaybolmuyor ve ekranda sabit kalıyor. Mevcut navbar auto-hide davranışı düzeltilmeli.

2. Sistemde username/kullanıcı adı alanı mevcut ancak kullanıcı bunu düzenleyemiyor. Username'in backend, profile/settings, session, DTO, cache ve UI'da bağlı olduğu bütün noktalar incelenmeli ve uçtan uca düzenlenebilir hale getirilmelidir.

3. Sidebar ve sayfa içerisindeki ana dikey scrollbar'lar PDA renk paletine uygun mavi tonlu hale getirilmelidir.

4. Navbar'daki PDA geri/ileri gezinme okları kullanıcının authenticated uygulama alanından çıkmasına, login ekranına dönmesine veya logout olmuş duruma geçmesine neden olmamalıdır. Bu oklar yalnız giriş yapılmış PDA uygulaması içindeki güvenli ileri/geri geçmişinde çalışmalıdır.

En önemli çalışma kuralı:

> Bu maddeleri yazıldıkları sırayla körlemesine uygulama.

Önce repository'yi incele, gerçek dependency graph'ını çıkar ve taskları teknik olarak en mantıklı sıraya koy.

Bir task'ın prerequisite'i tamamlanmadan bağımlı task'a geçme.

---

# ÇALIŞMA MODELİ

İlk aşamada doğrudan production kodu değiştirmeye başlama.

Önce özellikle şu alanları incele:

- AppShell
- AppHeader / Navbar
- sidebar
- workspace history controls
- existing `router.back()` / `router.forward()` integration
- Navigation API / history capability adapter
- navbar auto-hide / scroll listener / timer logic
- focus / hover / open-menu lifecycle
- authenticated route layout
- login/logout/session lifecycle
- route guards
- locale routing `/tr`, `/en`, `/de`
- profile/settings pages
- user/account entity
- username / nickname / displayName alanları
- auth/session DTO'ları
- user update endpointleri
- frontend account/profile API
- TanStack Query keys/invalidation
- chat/header/notification/avatar/user presentation consumers
- globals.css ve scrollbar styling
- semantic color tokens
- dark/light theme
- mevcut Playwright/backend tests

İsimleri veya mevcut sistemi tahmin etme.

Repository'deki gerçek source'u inceleyerek ilerle.

---

# PERSISTENT PLAN

Repository root'unda:

```text
PDA_FRONTEND_FOUNDATION_FIXES_PLAN.md
```

oluştur.

Bu dosya implementation boyunca source of truth olacak.

Repository analizinden sonra taskları dependency sırasına koy.

Her task şu formatta olsun:

```md
## Task N — Task adı

### Amaç
...

### Neden bu sırada?
...

### Prerequisite
...

### Etkilenecek alanlar
- Backend:
- Frontend:
- Auth / Session:
- Cache:
- Routing:
- Styling:
- Security:
- Tests:

### Checklist
- [ ] N.1 ...
- [ ] N.2 ...
- [ ] N.3 ...

### Definition of Done
- [ ] ...
- [ ] ...
```

Implementation sırasında tamamlanan her madde `[ ]` durumundan `[x]` durumuna getirilmeli.

Kullanıcı bu checkbox ilerlemesini görebilmeli.

Zorunlu çalışma sırası:

```text
implementation
→ targeted test
→ bulunan bugların düzeltilmesi
→ targeted re-test
→ Definition of Done
→ checkbox [x]
→ sonraki bağımlı task
```

Bir task'ın DoD maddeleri tamamlanmadan sonraki bağımlı task'a geçme.

---

# A — USERNAME / KULLANICI ADI UÇTAN UCA DÜZELTME

## Mevcut modeli önce çıkar

Önce aşağıdaki kavramların repository'deki gerçek karşılıklarını belirle:

```text
username
nickname
displayName
firstName
lastName
email
login identifier
```

Bunları birbirine karıştırma.

Özellikle username'in:

- authentication için kullanılıp kullanılmadığını,
- login identifier olup olmadığını,
- unique constraint taşıyıp taşımadığını,
- immutable kabul edilip edilmediğini,
- profile/session DTO'sunda nasıl taşındığını,
- hangi UI'larda gösterildiğini

gerçek koddan çıkar.

User isteği:

> Kullanıcı kendi username'ini profile/settings üzerinden düzenleyebilmeli.

Ancak bunu sadece bir input açarak çözme.

---

## Username update backend contract

Mevcut account/profile update endpoint'i destekliyorsa onu genişlet.

Gereksiz yeni endpoint oluşturma.

Gerçek ihtiyaç varsa minimal endpoint tasarla.

Update yalnız current authenticated user üzerinde çalışmalı.

Client'tan başka bir `userId` göndererek başka kişinin username'i değiştirilememeli.

Kontrol et:

- authentication
- CSRF
- ownership
- validation
- normalization
- uniqueness
- transaction
- error mapping

---

## Username validation

Mevcut domain kuralları varsa onları kullan.

Yoksa repository'nin mevcut kullanıcı adı davranışına göre minimum güvenli contract belirle.

Kontrol edilmesi gerekenler:

```text
min/max length
boş değer
yalnız whitespace
case sensitivity
Unicode
Türkçe karakterler
trim
normalization
reserved values varsa
duplicate username
```

Frontend ve backend validation birbirine uyumlu olmalı.

Backend source of truth olmalı.

---

## Duplicate username

Aynı username başka kullanıcıdaysa doğru conflict davranışı olmalı.

Örneğin gerçek API standardına göre `409 Conflict` veya repository'nin mevcut hata modeli.

DB unique constraint varsa application validation'ın yanında korunmalı.

Concurrent rename race de değerlendir.

---

## Username authentication etkisi

Bu kritik.

Username authentication/login identifier ise username değiştirilmesinin:

- current session,
- refresh/session endpoint,
- authentication principal,
- future login

üzerindeki etkisini incele.

Session'ın bozulmasına veya kullanıcının kendi hesabından istemeden çıkmasına neden olma.

Eğer sistem email ile login oluyor ve username yalnız profile identifier ise bunu raporda açıkça belirt.

---

## Frontend profile/settings

Username profile/settings ekranında gerçek form alanı olmalı.

Minimum UX:

```text
Kullanıcı adı
[current username]

Kaydet
```

Gerekliyse dirty state, validation, loading, success, duplicate error, server error ve retry mevcut form pattern'lerine uygun olsun.

Yeni form library ekleme.

---

## Username bağlı alanların genel audit'i

Repository genelinde username/nickname kullanımını ara.

Özellikle:

- AppHeader account menu
- profile page
- teams
- invitations
- notifications
- chat
- project members
- activity/history
- task assignee
- avatar tooltip
- user search
- user cards

Username update sonrası yeni değer mevcut kullanıcı oturumu içerisinde görünmeli.

Hard reload veya logout/login zorunlu olmamalı.

---

## Username cache/session refresh

Mutation success sonrası gerekli gerçek query key'leri güncelle/invalidate et.

Örneğin repository'de gerçekten kullanılıyorsa:

```text
session/currentUser
profile
account
project members
user summaries
```

Ancak tüm cache'i körlemesine clear etme.

Actor-scoped/private cache izolasyonunu bozma.

---

# B — NAVBAR AUTO-HIDE BUG

## Mevcut davranışı yeniden üret

Özellikle şu senaryoyu test et:

```text
uzun bir sayfa aç
→ sayfanın en altına scroll et
→ navbar gizli
→ yukarı doğru scroll yap
→ navbar görünür
→ scroll'u bırak
→ bekle
```

Bug:

> navbar görünür kalıyor ve mevcut auto-hide timeout sonrasında tekrar gizlenmiyor.

Önce gerçek root cause'u bul.

Tahmin ederek timer ekleme.

İncele:

- scroll direction state
- lastScrollY
- timer lifecycle
- debounce/throttle
- effect dependency
- clearTimeout
- hover
- focus
- focus-within
- open dropdown/menu
- mobile menu
- reduced motion
- page top behavior

---

## İstenen navbar davranışı

Navbar yukarı scroll yapıldığında görünmeli.

Kullanıcı scroll'u bıraktıktan sonra mevcut ürünün auto-hide süresi dolunca navbar tekrar gizlenmeli.

Ancak navbar hover, keyboard focus/focus-within, dropdown/menu açık, search aktif, account menu açık, notification menu açık, locale/theme menu açık veya mobile drawer interaction durumlarında yanlışlıkla gizlenmemeli.

Existing product semantics'i inceleyip koru.

---

## Page top davranışı

Sayfanın tepesinde navbar mevcut tasarım gereği sürekli görünüyorsa bunu bozma.

Bug yalnız scroll ile tekrar açılmış navbar'ın idle sonrası ekranda sonsuza kadar kalması olarak ele alınmalı.

---

## Timer lifecycle

Tekrarlanan scroll sırasında birden çok kontrolsüz timer üretme.

Yeni interaction olduğunda timer doğru reset edilmeli.

Unmount/navigation sonrası timer/listener leak olmamalı.

Fixed magic timeout eklemek yerine mevcut auto-hide token/constant varsa reuse et.

---

# C — PDA BACK / FORWARD OKLARI AUTHENTICATED HISTORY SINIRI

Bu task önceki same-origin navigation davranışının daha sıkı bir ürün kuralıdır.

Yeni kural:

> Navbar'daki PDA geri/ileri okları kullanıcıyı authenticated PDA workspace'inden çıkaramaz.

Yani PDA okları Dashboard → Project → Tasks → Calendar → Settings gibi login içindeki geçmişte çalışabilir.

Ancak authenticated app → login/register/logout sonucu public page/landing/external site sınırlarını geçemez.

---

## Browser'ın kendi navigation davranışına dokunma

Bu kural yalnız PDA navbar okları içindir.

Browser back/forward, mouse back/forward ve Alt+Left/Alt+Right intercept edilmemeli.

Browser kendi native history davranışını sürdürmeli.

---

## Custom history stack oluşturma

İlk tercih olarak bağımsız route-name/history stack oluşturma.

Aşağıdakileri yapma:

```text
manual visited URL array
localStorage history
sessionStorage navigation stack
history.pushState monkey patch
history.replaceState monkey patch
private Next router state mutation
```

Önce mevcut Navigation API / browser history capability yaklaşımını incele.

---

## Adjacent history entry güvenliği

Browser destekliyorsa mevcut/native history entries üzerinden önce hedef entry'nin güvenli olup olmadığını belirle.

PDA back/forward butonu yalnız adjacent history entry:

1. PDA same-origin ise
2. authenticated application route ise
3. public/login/logout boundary değilse

aktif olsun.

Örnek:

```text
/tr/projects/123/tasks
→ /tr/projects/123
```

ALLOW.

Ama:

```text
/tr/dashboard
→ /tr/login
```

PDA Back için DENY / disabled.

---

## Locale desteği

Authenticated route classification `/tr/...`, `/en/...`, `/de/...` ile çalışmalı.

Locale değiştirilmiş history entry'leri de doğru sınıflandır.

Hardcoded yalnız `/tr` kontrolü yapma.

---

## Query/hash history

Authenticated route içindeki `?section=`, `?tab=` ve `#...` entry'leri güvenli ise PDA history ile kullanılabilmeli.

---

## Unsupported browser

Adjacent entry güvenliğini kesin olarak belirleyemediğin browser/runtime'da PDA oku disabled olsun.

Tahmin ederek login/logout boundary'yi geçme.

Browser'ın native okları kullanılabilir.

Disabled state için doğru tooltip/aria açıklaması göster.

---

## Logout sonrası stale history

`login → Dashboard → Project → logout → login` gibi geçmişlerde eski authenticated entry/session verisi nedeniyle PDA okları private stale state göstermemeli.

Current authentication state ve route guard source of truth olmaya devam etmeli.

Auth/cache güvenliğini history feature için gevşetme.

---

## Fullscreen chat interaction

Existing davranışı koru:

Gerçek authenticated page traversal olduğunda `FULLSCREEN chat → CLOSED`.

Same context içinde `compact / bar → persistent`.

Disabled/no-op PDA arrow fullscreen chat'i kapatmamalı.

---

# D — SCROLLBAR THEME

Sidebar ve ana uygulama sayfalarındaki dikey scrollbar'lar PDA design palette ile uyumlu mavi tona getirilecek.

Ama global olarak her scrollbar'ı körlemesine değiştirme.

Önce gerçek scroll containers'ı çıkar.

Özellikle sidebar, main page/content ve gerekiyorsa drawer.

---

## Styling

Existing semantic design tokens kullan.

Hardcoded rastgele hex mavi kullanma.

Mümkünse mevcut primary/accent token'ın uygun scrollbar varyantını kullan.

Chromium/WebKit ve Firefox destekle.

Gerekirse:

```css
scrollbar-color
::-webkit-scrollbar
::-webkit-scrollbar-thumb
::-webkit-scrollbar-track
```

kullan.

---

## Visual davranış

Thumb PDA mavi paletiyle uyumlu olsun.

Track transparent veya mevcut surface token'ına uyumlu olsun.

Hover/active state mevcut palette göre slightly stronger olabilir.

Scrollbar aşırı kalın veya dikkat dağıtıcı olmamalı.

---

## Dark / light

Light ve dark mode'da yeterli kontrast sağla.

Dark modda aynı sabit açık mavi hex'i körlemesine kullanma.

Semantic token yaklaşımı tercih et.

---

## Scope

Code blocks, textarea, select/menu popup, chat internal scroll, modal internal scroll ve data table horizontal scroll yüzeylerini istemeden bozma.

Ana istek sidebar + normal page vertical scrollbar.

---

## Accessibility

Scrollbar görünürlüğünü sıfırlama.

`scrollbar-width: none` veya `::-webkit-scrollbar { display:none }` kullanma.

Keyboard/wheel/touch scrolling korunmalı.

---

# TASK SIRALAMASI

Yukarıdaki bölümleri doğrudan dört task yapmak zorunda değilsin.

Repository dependency graph'ına göre mantıklı tasklar üret.

Beklenen kaba dependency modeli örneğin şöyle olabilir:

```text
Task 1 — Preflight / architecture / current behavior baselines
Task 2 — Username domain + backend/profile contract
Task 3 — Username frontend/session/cache integration
Task 4 — AppHeader auto-hide lifecycle fix
Task 5 — Authenticated-only PDA history controls
Task 6 — Sidebar/page scrollbar theme
Task 7 — Integrated responsive/a11y/session/navigation regression
Task 8 — Full gate + implementation completion
```

BU SIRA SADECE ÖRNEKTİR.

Gerçek source incelemesine göre daha mantıklı sıra oluşturabilirsin ancak prerequisite ilişkilerini plan dosyasında açıkça yaz.

---

# TEST MATRİSİ

## Username

Gerçek kullanıcılarla en az:

```text
current username visible
→ edit
→ save
→ API/DB updated
→ current session new value
→ header/profile/related surfaces new value
→ reload
→ new value persists
```

Ayrıca duplicate username, invalid username, unauthorized foreign-user mutation, concurrent duplicate ve session after rename test et.

Normal success flow gerçek backend/PostgreSQL kullanmalı.

---

## Navbar auto-hide

Test:

```text
bottom
→ upward scroll
→ navbar visible
→ idle
→ navbar hides
```

Ayrıca top of page, hover, focus, open menu, search, mobile, rapid scroll up/down ve route navigation regression testleri yap.

---

## PDA history

En az:

```text
login
→ Dashboard
→ Projects
→ Project
→ Tasks
```

sonrasında PDA Back / Back / Forward doğru route'lara gitmeli.

Boundary:

```text
login → dashboard
```

durumunda Dashboard'dayken PDA Back disabled olmalı ve login ekranına götürmemeli.

Ayrıca public route boundary, logout/login history, external-origin boundary, query/section entry, locale entry, browser Back → PDA Forward, PDA Back → browser Forward ve unsupported Navigation API kontrol et.

---

## Scrollbars

Visual acceptance:

```text
sidebar
main vertical page
light
dark
TR/EN/DE
320
390
768
1024
1440
```

Chromium + Firefox support kodunu doğrula.

Playwright Chromium visual/layout regression yeterli olabilir; Firefox-specific CSS static/build düzeyinde kontrol edilebilir, repo Firefox E2E kullanıyorsa gerçek test ekle.

---

# CACHE / ACCOUNT BOUNDARY

Özellikle username ve history değişiklikleri previous fixed account-isolation davranışlarını bozmamalı.

Test et:

```text
User A login
→ private data loaded
→ logout
→ User B login
```

B:

- A username/profile cache'ini görmemeli
- A invitation/notification cache'ini görmemeli
- stale history action ile A'nın private sayfası görüntülenmemeli
- late response yeni kullanıcıyı overwrite etmemeli

Existing actor-scoped cache modelini koru.

---

# i18n

Yeni kullanıcı-visible bütün metinler TR / EN / DE catalog'larında olmalı.

Özellikle Username, username validation/errors, history unavailable ve back/forward disabled reason.

Hardcoded production Türkçe string bırakma.

---

# ACCESSIBILITY

Doğrula:

- username form label/error association
- save loading/disabled
- history button aria-label
- disabled explanation
- navbar focus
- auto-hide sırasında focused element gizlenmemesi
- keyboard tab order
- scrollbar visibility
- contrast
- reduced motion

Navbar focus altındayken auto-hide focus kaybına neden olmamalı.

---

# RESPONSIVE / THEME

En az 320 / 390 / 768 / 1024 / 1440 viewportlarında kontrol et.

Ayrıca light, dark, reduced-motion, expanded sidebar, collapsed sidebar ve mobile drawer regression yap.

---

# MOCK / FAKE KURALI

Normal başarılı entegrasyon senaryolarında frontend → real API → backend → PostgreSQL kullan.

Username update veya auth/history behavior'ını `route.fulfill` ile başarılı sayma.

Failure injection gerekiyorsa TEST-ONLY olarak açıkça işaretle.

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

Ardından repository'nin canonical:

```text
./pre-push/pre-push.cmd
```

veya gerçek eşdeğerini çalıştır.

Backend gate'i atlama.

Docker build/start/health varsa doğrula.

3000/8080/Swagger health repository standardının parçasıysa finalde kontrol et.

---

# IMPLEMENTATION COMPLETION

Implementation tamamen bittikten sonra plan dosyasından ayrı completion kaydı oluştur.

Final rapor şu başlıkları içersin:

## Final verdict
## Task checklist
## Username editing
## Username propagation / cache
## Navbar auto-hide fix
## PDA authenticated history boundary
## Scrollbar theme
## Auth / account isolation
## Responsive / accessibility / theme
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

1. Önce repository'yi incele ve gerçek dependency sırasını belirle.
2. Persistent checkbox planı oluştur.
3. Her tamamlanan checklist ve DoD maddesini `[x]` yap.
4. Bir task bitmeden bağımlı task'a geçme.
5. Username, nickname ve displayName kavramlarını tahmin ederek birleştirme.
6. Username değişikliğini yalnız frontend input açarak çözme; backend/session/cache zincirini doğrula.
7. Username foreign-user IDOR'a izin vermemeli.
8. Username update sonrası logout/login veya hard reload gerekmemeli.
9. Navbar auto-hide bug'ının root cause'unu bul; rastgele timer ekleyip geçme.
10. Navbar focus/menu açıkken yanlışlıkla gizlenmemeli.
11. PDA history okları login/logout/public/external boundary'yi geçemez.
12. Browser'ın kendi geri/ileri davranışını intercept etme.
13. Login geçmişine gitmeyi engellemek için browser'ın global history'sini silme veya rewrite etme.
14. Custom URL history stack/localStorage stack oluşturma; native capability tercih et.
15. Hedef entry güvenliği doğrulanamıyorsa PDA arrow disabled olsun.
16. Existing localized routing `/tr`, `/en`, `/de` korunmalı.
17. Existing fullscreen/compact chat navigation semantics bozulmamalı.
18. Scrollbar styling semantic PDA palette kullanmalı.
19. Scrollbarları gizleme.
20. Sidebar ve page scrollbar isteğini code block/chat/modal gibi unrelated scroll surfaces'a kontrolsüz yayma.
21. Dark/light/mobile/a11y tamamlanmalı.
22. Existing account-private cache isolation korunmalı.
23. Normal success E2E'lerde mock kullanma.
24. Full regression ve canonical pre-push geçmeden tamamlandı sayma.
25. Commit/push/staging yapma.
