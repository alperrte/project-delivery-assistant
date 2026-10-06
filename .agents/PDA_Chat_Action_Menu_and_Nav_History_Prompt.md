# PDA — Chat Message Action Menu & Workspace Back/Forward Navigation

PDA'da iki ayrı UX geliştirmesi yapılacak:

1. Chat mesajlarında mevcut Reply/React hover kontrollerinin yerleşimini değiştirmek.
2. Sidebar'ın hemen yanında uygulama içi geri/ileri navigation butonları eklemek.

Şu aşamada önce repository'yi incele.

Mevcut:

- ChatProvider / ChatRoot
- message-list
- message bubble
- MessageActions
- ReactionChips
- EmojiPicker
- ReplyPreview
- compact/full/bar chat modları
- AppShell
- sidebar
- workspace layout/header
- localized routing
- next-intl navigation helper'ları
- browser history / router kullanımı
- responsive/mobile layout
- Playwright testleri

üzerinden gerçek mevcut yapıyı çıkar.

Mevcut çalışan reply/reaction/backend/WebSocket sistemini yeniden tasarlama.

Bu task esas olarak UX/navigation taskıdır.

---

# PLAN DOSYASI

Repository root'unda:

```text
PDA_CHAT_ACTION_MENU_AND_NAV_HISTORY_PLAN.md
```

oluştur.

Her task:

```md
## Task N — ...

- [ ] ...
- [ ] ...

### Definition of Done
- [ ] ...
```

formatında olsun.

Implementation sırasında:

```text
implementation
→ targeted test
→ Definition of Done
→ [x]
→ next task
```

sırası korunsun.

---

# PART A — CHAT MESSAGE ACTION UX

## 1. Mevcut Problem

Şu anda kullanıcı mesajın üzerine hover yaptığında `Reply` ve `React` kontrolleri mesaj balonunun altında/çevresinde ayrı satır olarak ortaya çıkıyor.

Mesaja daha önce emoji reaction bırakılmışsa `👍 1` gibi reaction chip'leri bu hover action alanı nedeniyle mesajdan gereğinden fazla aşağıda kalıyor.

Bu durum reaction'ın hangi mesaja ait olduğunun görsel olarak anlaşılmasını zorlaştırıyor.

Mevcut reaction persistence veya backend davranışı problem değil.

Sorun frontend layout/interaction tasarımıdır.

---

# 2. Yeni Message Action Tasarımı

Desktop'ta mesajın üzerine hover/focus geldiğinde mesaj balonunun sağ üst tarafında küçük bir dropdown/action trigger görünsün.

Örneğin:

```text
              ˅
┌────────────────────┐
│ Mesaj içeriği      │
└────────────────────┘
  👍 1
```

veya own/other bubble yönüne göre uygun mirrored konum.

Trigger için küçük chevron-down veya mevcut icon setindeki eşdeğer temiz ikon kullan.

Yeni icon library ekleme.

---

# 3. Dropdown İçeriği

Chevron/action trigger tıklanınca küçük menu açılsın.

Minimum seçenekler:

```text
↩ Yanıtla
🙂 Emoji ile tepki ver
```

Mevcut Reply/React işlevlerinin kendisi değişmesin.

Yalnız interaction entry point değişsin.

---

# 4. Reaction Chips Mesaja Yakın Kalmalı

Reaction chip'ler mesaj balonunun hemen altında kalmalı.

Örneğin:

```text
┌────────────────────┐
│ Mesaj              │
└────────────────────┘
 👍 1   ❤️ 2
```

Reaction'larla message bubble arasında gereksiz dikey boşluk oluşmamalı.

Message action menu layout flow içinde ekstra satır/height oluşturmamalı.

Tercihen action trigger `position: absolute` veya mevcut design system'e uygun overlay yaklaşımıyla bubble layout'unu büyütmeden gösterilsin.

Ama clipping/z-index/scroll container problemleri oluşturma.

---

# 5. Mesajın Reaction'ı Yoksa

Reaction bulunmayan mesajlarda da action menu aynı yerde çalışmalı.

Menu açıldığında bubble yüksekliği zıplamamalı.

Layout shift olmamalı.

---

# 6. Own vs Other Message

Hem current user's message hem other user's message için doğru positioning yap.

Bubble sağa yaslıysa chevron mesajın uygun dış/üst kenarında; bubble sola yaslıysa mirrored yerleşim kullanılabilir.

Ama kullanıcı hangi tarafta olursa olsun menu viewport dışında taşmamalı.

---

# 7. Reply Davranışı

Menu'den `Yanıtla` seçilince mevcut Reply flow aynen kullanılmalı:

```text
message
→ Reply
→ composer reply preview
→ send
→ backend replyToMessageId
```

Yeni ayrı reply sistemi oluşturma.

Existing reply draft / retry / persistence / WebSocket davranışlarını bozma.

---

# 8. Reaction Davranışı

Menu'den `Emoji ile tepki ver` seçilince mevcut 6 reaction emoji picker açılsın.

Mevcut canonical reaction sistemi korunmalı:

```text
👍 ❤️ 😂 😮 😢 🙏
```

Yeni reaction API oluşturma.

Mevcut PUT/DELETE reaction + reactionVersion + WebSocket REACTIONS akışını reuse et.

---

# 9. Menu → Reaction Picker UX

Kullanıcı:

```text
Chevron
→ Emoji ile tepki ver
```

seçtiğinde action menu kapanmalı ve reaction picker açılmalı.

Focus davranışı düzgün olmalı.

Escape sırası:

```text
reaction picker open
→ Esc
→ picker closes

action menu open
→ Esc
→ menu closes
```

Panel minimize/close davranışına event yanlışlıkla propagate olmamalı.

---

# 10. Mobile / Touch

Mobile'da hover olmadığı için action trigger erişilebilir kalmalı.

Uygun yaklaşımı repository yapısına göre seç:

- bubble yanında görünür küçük trigger
- tap ile action menu
- gerekirse existing mobile message action yaklaşımı

Long-press zorunlu yapma.

Native text selection davranışını bozma.

---

# 11. Keyboard Accessibility

Action trigger gerçek button olmalı, aria-label taşımalı, Tab ile focus almalı, Enter/Space ile açılmalı ve Escape ile kapanmalı.

Menu item'ları keyboard ile kullanılabilmeli.

Örneğin:

```text
Mesaj seçenekleri
Yanıtla
Emoji ile tepki ver
```

i18n kataloglarından gelsin.

---

# 12. Reaction Chip Layout

Özellikle şu edge-case'leri kontrol et:

```text
1 reaction
multiple reactions
long message
short message
emoji-only message
reply message
own message
other-user message
compact chat
fullscreen chat
mobile width
```

Reaction chips bubble ile görsel bağını kaybetmemeli.

Wrap gerekiyorsa kontrollü şekilde wrap olabilir.

---

# 13. Existing Chat Behavior Korunmalı

Şunları bozma:

- group chat
- direct chat
- reply persistence
- reaction persistence
- reactionVersion
- unread
- read state
- history pagination
- reconnect
- reaction resync
- duplicate event protection
- message outbox
- failed send retry
- compact
- minimized bar
- fullscreen
- project/account isolation

Bu task backend chat mimarisini yeniden tasarlamamalı.

---

# PART B — WORKSPACE BACK / FORWARD NAVIGATION

# 14. Amaç

PDA'nın workspace arayüzünde sidebar'ın hemen yanında `← →` navigation butonları istiyorum.

Bunlar browser'daki geri/ileri butonlarının uygulama içindeki karşılığı gibi çalışmalı.

Örneğin:

```text
Projects
→ Project A
→ Tasks
→ Calendar
```

kullanıcı `←` basınca Tasks sayfasına dönmeli; tekrar `←` basınca Project A'ya dönmeli; sonra `→` ile ileri gidebilmeli.

---

# 15. Yerleşim

Butonlar sidebar'ın hemen yanında, ana content/header başlangıcında konumlanmalı.

Kavramsal:

```text
┌──────────── Sidebar ───────────┐ |  ←  →   Page Header
│                               │ |
│                               │ |
```

Mevcut AppShell/header yapısını incele.

Yeni ayrı floating toolbar oluşturmak yerine mevcut shell/header composition'a doğal şekilde entegre et.

---

# 16. Browser History Source of Truth

Kendi paralel custom navigation history stack'ini gereksiz yere oluşturma.

Önce mevcut Next.js / next-intl routing yapısını incele.

Mümkünse browser history/router'ın gerçek back/forward semantiğini kullan.

Localized routes ve project routes doğru çalışmalı.

---

# 17. Localized Routes

PDA'daki `/tr/...`, `/en/...`, `/de/...` ve localized slug yapısını koru.

Back/forward:

- locale'i yanlışlıkla değiştirmemeli
- localized pathname mapping'i bozmamalı
- browser'ın gerçek history entry'sine dönmeli

Locale switch'in oluşturduğu history davranışını da incele.

---

# 18. Query / Section Navigation

PDA'da bazı sayfalar `?section=` gibi query parametreleriyle mantıksal alt sayfa değiştiriyor.

Browser history gerçekten entry oluşturuyorsa back/forward bunu da takip etmeli.

Örneğin:

```text
Settings?section=general
→ Settings?section=members
```

sonrası `←` doğru önceki section'a dönebilmeli.

Manuel route-name listesi oluşturma.

---

# 19. Disabled State

Geri gidilecek history yoksa `← disabled`, ileri gidilecek history yoksa `→ disabled` olmalı.

Disabled state:

- görsel olarak anlaşılır
- keyboard focus semantics doğru
- yanlış navigation üretmez

olmalı.

---

# 20. History Capability Problemi

Browser API doğrudan “forward entry var mı?” bilgisini güvenilir şekilde vermiyorsa bunu analiz et.

Sahte state üretme.

Repository/router yapısına göre minimum ve güvenilir bir capability tracking yaklaşımı gerekiyorsa planla.

Ama kendi uygulama URL listesini browser history'den bağımsız paralel bir history sistemi haline getirme.

Back/forward sonucu browser ile tutarlı kalmalı.

---

# 21. Browser'ın Kendi Back/Forward'u ile Senkronizasyon

Şunlar aynı history state'i kullanmalı:

```text
browser back button
browser forward button
mouse back/forward
Alt+Left / Alt+Right (browser destekliyorsa)
PDA ← →
```

Uygulamadaki oklar ayrı navigation evreni oluşturmamalı.

---

# 22. Fullscreen Chat ile Etkileşim

Daha önce tanımlanan kural korunmalı:

```text
FULLSCREEN chat
+ page navigation
→ chat CLOSED
```

Dolayısıyla kullanıcı PDA `←` veya `→` butonuyla farklı bir sayfaya giderse bu da normal page navigation sayılmalı.

Fullscreen chat açıksa kapanmalı.

Ancak compact/bar chat aynı project/context içinde persistent kalmalı.

Bu yeni navigation butonları mevcut chat navigation semantics'ini bypass etmemeli.

---

# 23. Project / Account Context

History ile `Project A → Project B → back` gibi akışlarda mevcut project context cleanup/re-init düzgün çalışmalı.

Eski project'in chat/cache/state'i yanlış project'e sızmamalı.

Account/logout boundary korunmalı.

Logout sonrası eski private route history entry'sine dönüldüğünde mevcut authentication guard doğru davranmalı.

---

# 24. External History

History'de PDA dışı bir sayfa varsa browser back'in doğal davranışını zorla override etme.

Security açısından:

- javascript URL
- custom arbitrary URL execution
- manual URL string injection

oluşturma.

---

# 25. UI Tasarımı

Butonlar mevcut PDA design system ile uyumlu olsun.

Mevcut icon setindeki ChevronLeft/ChevronRight veya ArrowLeft/ArrowRight ikonlarını kullan.

Yeni icon package ekleme.

Hover'da tooltip, subtle background ve existing radius/token kullan.

Dark/light theme uyumlu olsun.

---

# 26. Responsive

Desktop'ta sidebar yanında görünmeli.

Tablet/mobile layout'ta mevcut header/navigation alanını incele.

Butonlar:

- content'i gereksiz daraltmamalı
- sidebar hamburger ile çakışmamalı
- 320px width'te taşmamalı

Gerekirse mobile'da daha kompakt layout kullan.

Ama özelliği keyfi olarak tamamen kaybetme.

---

# 27. Accessibility

Navigation butonlarında TR/EN/DE `aria-label` karşılıkları olmalı.

Native disabled semantics kullan.

Tooltip tek başına label yerine geçmesin.

---

# 28. Loading / Rapid Navigation

Kullanıcı hızlıca `← ← →` basarsa:

- duplicate router corruption
- stale selected project
- chat state race
- loading overlay deadlock

oluşmamalı.

Mevcut navigation transition modelini incele.

Gereksiz debounce ekleme.

---

# 29. Navigation E2E

En az:

```text
Projects
→ Project
→ Tasks
→ Calendar
←
→ Tasks
←
→ Project
→
→ Tasks
```

doğrula.

Ayrıca:

```text
Tasks
→ Calendar
browser back
→ Tasks
PDA forward
→ Calendar
```

senkronizasyonunu test et.

---

# 30. Query History E2E

Varsa gerçek history entry üreten section navigation'ı back/forward ile doğrula.

---

# 31. Chat + Navigation E2E

Fullscreen chat ile page navigation gerçekleştiğinde chat kapanmalı.

Compact/bar chat aynı project context'te back/forward sırasında korunmalı.

---

# 32. Route History State

Mevcut Next.js/next-intl kullanımını incele.

Back/forward implementation `router.back()`, `router.forward()`, `history.back()`, `history.forward()` veya repository'ye en uygun abstraction üzerinden yapılabilir.

Exact yöntemi repository analizinden sonra seç.

Server/client component boundary'lerini bozma.

---

# 33. i18n

Yeni metinler:

```text
Message actions
Reply
React
Back
Forward
Open message actions
```

gerekiyorsa mevcut TR/EN/DE kataloglarında olmalı.

Existing çevirileri duplicate etme.

---

# 34. Tests

Chat tarafında:

- action trigger hover
- action trigger keyboard
- reply
- reaction picker
- reaction chips spacing
- no layout shift
- own/other message
- mobile
- compact/fullscreen
- dark/light

Navigation tarafında:

- back
- forward
- disabled state
- browser sync
- query history
- project switch
- chat full close
- chat compact/bar persist
- auth boundary

test edilmeli.

---

# 35. Visual Regression

Özellikle chat'te screenshot/manual visual check yap.

Şu mevcut kötü durumu kabul etme:

```text
message

Reply React


👍 1
```

Yeni hedef:

```text
              ˅
message
👍 1
```

Reaction'ın hangi mesaja ait olduğu görsel olarak açık olmalı.

---

# 36. Backend

Bu task için chat reply/reaction backend contract'ında değişiklik beklenmiyor.

Yeni backend endpoint/schema/migration ekleme, zorunlu gerçek ihtiyaç yoksa.

Navigation da frontend concern olmalı.

Eğer repository analizi backend değişikliği gerektiğini gösterirse önce sebebini açıkça raporla.

---

# 37. NPM / Dependency

Yeni emoji/menu/navigation library ekleme.

Mevcut Base UI, icon set ve design primitives'i reuse et.

Önceki npm security debt'i nedeniyle gereksiz dependency eklenmemeli.

---

# 38. Git Güvenliği

Kullanıcı değişikliklerini koru.

Kullanma:

```text
git reset --hard
git checkout .
```

Plan dışı dosyaları revert etme.

Commit/push/staging yapma.

---

# 39. Task Gruplandırma

Yukarıdaki maddeleri tek tek task yapma.

Repository dependency graph'a göre mantıklı fazlar oluştur.

Muhtemel yapı:

```text
Task 1 — Existing architecture/preflight
Task 2 — Message action menu + reaction spacing
Task 3 — Touch/keyboard/a11y/i18n
Task 4 — Workspace back/forward shell integration
Task 5 — Browser history synchronization
Task 6 — Chat/navigation interaction
Task 7 — Responsive/visual/E2E regression
Task 8 — Full gate + completion
```

Ancak gerçek sıra repository analizine göre kesinleşsin.

---

# 40. Final Validation

Implementation sonrası:

```text
frontend lint
TypeScript
production build
targeted Playwright
full Chromium Playwright
```

çalıştır.

Mevcut canonical pre-push gate varsa full final gate'i çalıştır.

Backend değişmediyse bile pre-push'ın mevcut backend gate'ini atlama.

---

# 41. Completion Record

İş tamamen bittikten sonra audit/plan yerine ayrı implementation completion kaydı oluştur.

Final raporda:

## Final verdict
## Chat message action changes
## Reaction chip layout
## Reply / reaction behavior
## Back / forward navigation
## Browser history synchronization
## Chat navigation interaction
## Accessibility / responsive / theme
## Changed files
## Test results
## Remaining issues

başlıklarını kullan.

Blocker kalmadıysa:

```text
Kalan blocker yok.
```

yaz.

---

# Kritik Kurallar

1. Mevcut reply/reaction backend mimarisini yeniden yazma.
2. Reply/React inline hover controls mesajın altında layout yüksekliği oluşturmamalı.
3. Bunları mesajın sağ üstündeki tek action trigger/menu içine taşı.
4. Reaction chips mesaj balonuna yakın kalmalı.
5. Menüden Reply mevcut reply sistemini kullanmalı.
6. Menüden React mevcut reaction sistemini kullanmalı.
7. Yeni reaction API oluşturma.
8. Mobile ve keyboard interaction korunmalı.
9. Yeni npm dependency ekleme.
10. Back/forward için browser/router history source of truth olsun.
11. Gereksiz paralel custom history stack oluşturma.
12. Browser back/forward ile PDA okları senkronize çalışmalı.
13. Localized route/query navigation bozulmamalı.
14. FULLSCREEN chat + navigation → CLOSED kuralı korunmalı.
15. COMPACT/BAR + aynı context navigation → persistent kalmalı.
16. Project/account isolation bozulmamalı.
17. Auth guard/history edge-case'lerini test et.
18. TR/EN/DE tamamlanmalı.
19. Dark/light/mobile/accessibility tamamlanmalı.
20. Full regression/pre-push geçmeden tamamlandı sayma.
21. Commit/push/staging yapma.
