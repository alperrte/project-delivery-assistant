# PDA — Localized Routing, Organization UI, Project Technology Icons & Chat Mini Panel

Bu dosya iki aşamalı çalışma için hazırlanmıştır:

1. **Claude Opus + Plan Mode** → repository'yi inceleyip taskları teknik bağımlılık sırasına göre planlayacak.
2. **Claude Sonnet** → Opus'un hazırladığı checklist'i sırayla uygulayacak ve her tamamlanan maddeyi `[x]` olarak işaretleyecek.

---

# 1) Opus Plan Mode İçin Nihai Prompt

# PDA — Localized Routing, Organization UI, Project Technology Icons & Chat Mini Panel Planning

PDA (Project Delivery Assistant) projesinde birbiriyle ilişkili birkaç frontend/UI taskı yapılacak.

Şu an senden KOD YAZMANI İSTEMİYORUM.

Bu aşamada yalnızca repository'yi detaylı şekilde incele, mevcut routing/layout/chat/project overview mimarisini çöz, aşağıdaki dağınık gereksinimleri mantıklı tasklara ayır ve bunları teknik bağımlılık sırasına göre uygulanabilir bir plana dönüştür.

## En önemli çalışma kuralı

Kullanıcının verdiği sırayı doğrudan implementation sırası kabul etme.

Önce repository'yi incele ve şu soruyu cevapla:

> Hangi task diğerlerinin temelini oluşturuyor ve önce yapılmazsa sonraki tasklarda aynı route/component/layout dosyalarını tekrar tekrar değiştirmek gerekir?

Buna göre taskları mantıksal ve teknik bağımlılık sırasına koy.

Örneğin localized slug/routing yapısı Organization veya Messaging route'larını doğrudan etkiliyorsa önce routing altyapısını planla, ardından sayfa refactorlarını yap.

Ancak bu yalnız örnektir.

Gerçek repository analizine göre kesin sıralamayı sen belirle.

---

# Plan Formatı

Planı mutlaka checkbox formatında oluştur:

```md
## Task 1 — ...

- [ ] 1.1 ...
- [ ] 1.2 ...
- [ ] 1.3 ...

### Definition of Done
- [ ] ...
- [ ] ...
```

Her ana task için:

- amacı
- neden bu sırada olduğunu
- etkilenecek mevcut dosya/modülleri
- frontend değişikliklerini
- backend değişikliği gerekip gerekmediğini
- routing/i18n etkilerini
- edge-case'leri
- test/validation adımlarını

belirt.

Taskları gereksiz mikro parçalara bölme.

Ancak Sonnet'in sırayla uygulayabileceği kadar açık olmalı.

---

# Checklist Kalıcı Olsun

Plan tamamlandığında repository root'unda mümkünse:

```text
PDA_LOCALIZED_UI_CHAT_PLAN.md
```

oluştur.

Bu dosya Sonnet implementation aşamasında source of truth olacak.

Implementation sırasında:

```md
- [ ] yapılmadı
- [x] tamamlandı
```

kullanılacak.

Bir task tamamen bitmeden checkbox işaretlenmemeli.

Her ana task tamamlandıktan sonra `[x]` yapılacak ve ancak sonra sonraki taska geçilecek.

---

# Repository İncelemesi

Plan hazırlamadan önce özellikle şu alanları incele:

- Next.js routing yapısı
- App Router / route segment yapısı
- locale / i18n routing
- next-intl configuration
- language switcher
- localized navigation utilities
- Link wrappers / router helpers
- organization routes
- organization create/edit pages
- messaging/chat routes
- chat provider/state
- minimized / compact / fullscreen chat state
- selected project sidebar
- project overview page
- technology stack display
- technology icon mapping
- project DTO / API
- project technology model
- responsive layout
- translations (`tr`, `en`, `de`)
- route guards / permissions
- Playwright E2E tests

Mevcut reusable componentleri özellikle bul.

Yeni parallel navigation/routing sistemi kurma.

---

# Gereksinimler

Aşağıdaki maddeler kullanıcı tarafından dağınık şekilde verilmiştir.

Bunları birebir 4 ayrı task kabul etmek zorunda değilsin.

Önce ilişkilerini çöz, sonra mantıklı task/fazlara ayır.

---

# A — Organization Create Page Frontend Düzenlemesi

Mevcut organization create page frontend'i kullanıcı açısından yetersiz/dağınık görünüyor.

Repository'deki mevcut `/organizations/new` ve varsa organization edit page'i incele.

Amaç:

- PDA design system ile uyumlu
- spacing/hierarchy düzgün
- form section'ları anlaşılır
- responsive
- gereksiz modal/dialog kalıntısı olmayan

daha temiz bir organization form page oluşturmak.

Bu görev backend organization business logic'i değiştirmek değildir.

Mevcut API ve validation'ı reuse et.

Daha önce Organization popup kaldırıldıysa eski popup'a bağlı dead UI kodu kalıp kalmadığını kontrol et.

---

# B — Messaging Page Frontend Düzenlemesi

Mesajlaşma sistemi functional olarak çalışıyor olsa da full chat page/panel frontend görünümü iyileştirilecek.

Mevcut fullscreen chat, conversation list, project group, direct chats, message list, message composer, unread badge ve compact/minimized panel yapısını incele.

Amaç:

- daha temiz görsel hiyerarşi
- daha iyi spacing
- aktif konuşmanın net seçilmesi
- conversation list'in daha okunaklı olması
- message composer'ın daha düzgün görünmesi
- profile avatar/project logo kullanımının tutarlı olması
- light/dark theme uyumu
- responsive davranış

sağlamaktır.

Bu task sırasında mevcut messaging backend veya WebSocket davranışını gereksiz yere değiştirme.

---

# C — Localized Slugs / Route Segments

Kullanıcı sayfa URL'lerinin seçilen dile göre çevrilmesini istiyor.

Örneğin Türkçe locale'de `/projects`, `/organizations`, `/settings`, `/messages` gibi route segmentleri İngilizce kalmamalı.

Önce mevcut locale routing modelini incele.

Amaç örneğin:

```text
TR
/projeler
/organizasyonlar
/ayarlar
/mesajlasma

EN
/projects
/organizations
/settings
/messaging

DE
/projekte
/organisationen
/einstellungen
/nachrichten
```

benzeri localized segment desteği olabilir.

Gerçek slug isimlerini translations/product terminolojisine göre belirle.

Bu örnekler zorunlu final değer değildir.

---

# D — Localized Slug Mimarisinde Tek Source of Truth

Localized route segmentlerini componentlerin içine hardcode etme.

Merkezi route mapping oluşturmayı değerlendir.

Örneğin kavramsal:

```text
projects:
  tr: projeler
  en: projects
  de: projekte
```

Ama mevcut next-intl / routing config başka bir standarda sahipse onu kullan.

Amaç:

- tek source of truth
- type-safe navigation mümkünse
- Link/router helpers aynı mapping'i kullansın
- sidebar active state localized URL ile bozulmasın
- breadcrumbs varsa bozulmasın
- direct URL girişleri çalışsın
- locale switch current page'i doğru localized route'a taşısın

---

# E — Route Compatibility / Redirect

Localized slug değişikliği mevcut bookmark/link'leri bozmamalıdır.

Eski canonical/legacy route'ların davranışını planla.

Örneğin `/tr/projects` gibi eski bir URL gerekiyorsa `/tr/projeler` adresine redirect edilebilir.

Mevcut routing architecture'a göre en temiz yaklaşımı seç.

404 üretme ama duplicate route chaos oluşturma.

---

# F — Dynamic Segments Localized Olmamalı

Project slug/id gibi dynamic değerleri tercüme etmeye çalışma.

Örneğin:

```text
/tr/projeler/pda-backend
/en/projects/pda-backend
```

olabilir.

Sadece sabit route segmentleri localized olmalıdır.

Project'in gerçek slug'ını locale'e göre değiştirme.

---

# G — Locale Switch Davranışı

Kullanıcı dil değiştirirken aynı logical sayfada kalmalı.

Örneğin:

```text
/tr/projeler/pda-backend/ekipler
```

üzerindeyken English seçerse:

```text
/en/projects/pda-backend/teams
```

adresine geçmeli.

Ana sayfaya atmamalı.

Query params gerekiyorsa korunmalı.

Selected project context kaybolmamalı.

---

# H — Sidebar / Active State

Localized slug değişikliği şu alanları bozmamalıdır:

- global sidebar
- selected project sidebar
- Teams
- Calendar
- Messaging
- Settings
- Invitations
- Organization
- Project Settings edit icon

Active state artık pathname içinde İngilizce hardcoded segment aramamalı.

Mevcut helper'ları localized routing'e uyarlamayı planla.

---

# I — Project Overview Technology Stack UI

Project Overview içindeki teknoloji yığını plain text yerine icon tabanlı hale getirilmeli.

Örneğin:

```text
[React icon] [Node icon] [PostgreSQL icon] [Docker icon]
```

Her teknoloji kendi mevcut/uygun logosuyla gösterilmelidir.

---

# J — Technology Hover Tooltip

Kullanıcı teknoloji logosunun üzerine geldiğinde teknoloji adı görünmelidir.

Örneğin:

```text
[React logo]
hover
→ React
```

Mevcut tooltip component'i varsa reuse et.

Yeni tooltip sistemi oluşturma.

Mobile/touch için accessible label veya tap/aria davranışı olsun.

---

# K — Technology Icon Mapping

Technology isimlerini farklı componentlerde tekrar tekrar icon'a map etme.

Merkezi/reusable mapping kullan.

Mevcut project card/banner/preview teknoloji icon sistemi zaten varsa kesinlikle reuse et.

Aynı mapping'in ikinci kopyasını oluşturma.

---

# L — Bilinmeyen Teknoloji Fallback

Project technology listesinde icon mapping'i olmayan bir teknoloji varsa UI bozulmamalıdır.

Generic technology icon + tooltip ile gerçek teknoloji adı gibi bir fallback kullan.

Teknolojiyi tamamen gizleme.

---

# M — Mini Chat'te Kişi Seçilemiyor Bug'ı

Mevcut chat davranışında:

```text
Fullscreen chat
→ kişi seçiliyor
→ chat minimize ediliyor
→ selected kişinin konuşması compact panelde açılıyor
```

Ancak minimized/compact moddayken başka bir konuşmaya geçilemiyor.

Bu davranış düzeltilmelidir.

---

# N — Compact Chat Conversation Switcher

Compact / sağ-alt açık sohbet penceresinde kullanıcı conversation değiştirebilmelidir.

LinkedIn tarzı davranışa uygun çözüm tasarla.

Örneğin compact pencerede aktif konuşma header'ı, conversation list toggle, kişi seçme dropdown/paneli veya ikinci küçük conversations paneli gibi bir çözüm olabilir.

Repository'deki mevcut ChatProvider/state mimarisine en uygun olanı seç.

Amaç:

```text
Compact chat
→ Alper
→ conversation selector
→ Nisa
→ aynı compact window içinde Nisa chat'i
```

olmalıdır.

Fullscreen'e dönmek zorunda kalmamalı.

---

# O — Project Group da Seçilebilir Olmalı

Compact conversation switcher yalnız direct kullanıcıları değil Project Group konuşmasını da seçebilmelidir.

Yani compact mode'da:

```text
Project Group
Alper
Nisa
Kerem
```

arasında geçiş yapılabilmeli.

---

# P — Conversation State Koruma

Compact mode'da conversation değiştirirken:

- ChatProvider bozulmamalı
- unread state doğru güncellenmeli
- draft davranışı mevcut modele uygun kalmalı
- websocket subscription leak olmamalı
- duplicate fetch olmamalı

Selected conversation tek source of truth olmalıdır.

Fullscreen ve compact iki farklı selected conversation state tutmamalı.

---

# Q — Minimized Bar vs Compact Window

Mevcut üç durum korunmalı:

```text
Fullscreen
↓
Minimized Bar
↓ click
Compact Window
```

Compact Window içinden:

```text
→ başka conversation seç
→ minimize
→ fullscreen
→ close
```

yapılabilmeli.

Bu task yalnız compact mode'a conversation switcher eklemek için mevcut üç-state modelini bozmasın.

---

# R — Unread Badge Davranışı

Compact conversation switcher'da diğer konuşmaların unread count'u varsa göster.

Örneğin:

```text
Alper      2
Nisa       1
Project    4
```

Bir konuşma açıldığında mevcut read-state mantığına göre count güncellensin.

Sidebar unread badge ile tutarlı olmalı.

---

# S — Responsive Chat

Conversation switcher desktop'ta compact window içinde rahat kullanılmalı.

Mobile'da mevcut full-screen single-column davranışını bozma.

---

# Task Gruplandırma

Yukarıdaki maddeleri birebir ayrı tasklara bölme.

Repository analizine göre mantıklı ana fazlar oluştur.

Öneri olarak şu ilişkileri değerlendir:

```text
Localized routing foundation
↓
Sidebar / page route migration
↓
Organization + Messaging page UI refactor
```

ve:

```text
Technology mapping reuse
↓
Project Overview technology icons
```

ve:

```text
Chat state analysis
↓
Compact conversation switcher
↓
Unread/state regression
```

Ancak gerçek repository'ye göre son sıralamayı sen belirle.

---

# Task Bağımlılıkları

Plan sonunda taskların neden o sırada olduğunu açıkça belirt.

Özellikle:

- localized routes page refactorlardan önce mi yapılmalı?
- organization/messaging page route'ları localized mapping'e taşınmalı mı?
- chat compact selector mevcut provider/state refactor gerektiriyor mu?
- technology icon mapping zaten var mı?

bunları repository analiziyle cevapla.

---

# Her Task İçin Definition of Done

Her ana task için net `Definition of Done` oluştur.

Sonnet bu maddeler bitmeden taskı `[x]` yapmamalı.

---

# Test Planı

Planın sonunda task bazlı validation yaz.

Özellikle:

## Localized routing
- TR route
- EN route
- DE route
- locale switch same logical page
- dynamic project slug preservation
- old URL redirect
- sidebar active state
- direct URL reload / no 404

## Organization
- create page renders
- validation
- submit
- responsive
- localized URL

## Messaging page
- full screen render
- conversation selection
- localized URL
- layout regression

## Technology stack
- correct icons
- tooltip
- fallback icon
- dark/light
- responsive

## Compact chat
- switch direct conversation
- switch project group
- unread count
- minimize/restore
- fullscreen transition
- project change reset
- websocket state

---

# Playwright

Mevcut Playwright altyapısını kullan.

Özellikle:

```text
TR → /projeler
language switch → EN → /projects
same project retained
```

ve:

```text
compact chat
→ open Alper
→ switch to Nisa
→ send message
→ Nisa conversation active
```

senaryolarını kapsa.

---

# Git Güvenliği

Mevcut staged/unstaged kullanıcı değişikliklerini kaybetme.

Şunları kullanma:

```text
git reset --hard
git checkout .
```

Plan dışı değişiklikleri revert etme.

Conflict çıkarsa gerekli iki tarafı da koru.

---

# Opus Final Çıktısı

Final cevabında şu sırayla ver:

## 1. Repository Analizi
## 2. Dependency / Ordering Kararı
## 3. Implementation Checklist
## 4. Etkilenecek Dosyalar / Modüller
## 5. Backend Gerektiren Tasklar
## 6. Riskler
## 7. Validation Plan

---

# Kritik Kurallar

1. Bu aşamada production kodu yazma.
2. Önce repository'yi incele.
3. Taskları kullanıcının verdiği sıraya göre körlemesine sıralama.
4. Teknik bağımlılık sırasını kendin belirle.
5. Localized slug çözümünü merkezi yap; component bazlı string hack yapma.
6. Dynamic project slug/id değerlerini tercüme etme.
7. Language switch aynı logical page'i korumalı.
8. Eski linkleri mümkünse redirect ile koru.
9. Sidebar active state localized routes ile bozulmamalı.
10. Organization frontend refactor mevcut API davranışını bozmamalı.
11. Messaging frontend refactor WebSocket/backend davranışını bozmamalı.
12. Technology icon mapping mevcutsa reuse et.
13. Unknown technology için fallback olmalı.
14. Compact chat'te conversation değiştirmek mümkün olmalı.
15. Compact chat project group + direct chats arasında geçiş desteklemeli.
16. Fullscreen ve compact iki ayrı selectedConversation state tutmamalı.
17. Unread/read state bozulmamalı.
18. Project değişiminde eski chat state leak olmamalı.
19. Mevcut kullanıcı değişikliklerini kaybetme.
20. Her task checkbox + Definition of Done içermeli.
21. Plan Sonnet tarafından sırayla uygulanabilir olmalı.
22. Plan sonunda kesin implementation sırasını açıkça yaz.

---

# 2) Sonnet Implementation Prompt

Repository'de Opus tarafından hazırlanmış `PDA_LOCALIZED_UI_CHAT_PLAN.md` dosyasını oku.

Bu plan implementation için source of truth'tur.

Şimdi planı IMPLEMENT ET.

## Çalışma Düzeni

Taskları plandaki sırayla uygula.

Sıralamayı değiştirme.

Akış:

```text
Task 1
→ implement
→ test
→ Definition of Done kontrolü
→ checkbox [x]
→ Task 2
```

Bir ana task tamamen bitmeden sonraki taska geçme.

---

# Checkbox Takibi Zorunlu

Her tamamlanan alt task için:

```md
- [ ]
```

değerini:

```md
- [x]
```

olarak güncelle.

Task bitmediyse `[x]` yapma.

Blocker varsa:

```md
- [ ] ... — BLOCKED: sebep
```

yaz.

Ben ilerlemeyi bu dosyadan takip edeceğim.

---

# Her Ana Task Sonrası

1. Kod değişikliklerini tamamla.
2. Plandaki ilgili testleri çalıştır.
3. Hataları düzelt.
4. Definition of Done maddelerini doğrula.
5. Checkbox'ları güncelle.
6. Kısa progress özeti yaz.
7. Sonraki taska geç.

Benden arada onay bekleme.

---

# Routing İçin Özel Kurallar

Localized slug implementasyonunda:

- route mapping tek source of truth olmalı
- TR/EN/DE desteklenmeli
- dynamic project slug korunmalı
- locale switch aynı logical page'de kalmalı
- query paramlar gerekiyorsa korunmalı
- eski URL'ler gerekiyorsa redirect edilmeli
- sidebar active state hardcoded English pathname'e bağlı kalmamalı

404 regression bırakma.

---

# Organization / Messaging UI

Organization create frontend ve Messaging frontend'i plan doğrultusunda düzenle.

Backend business logic'i gereksiz değiştirme.

Responsive, dark/light, i18n ve existing design system'e uy.

---

# Technology Stack

Project Overview teknoloji yığını alanında:

- plain text yerine icon
- hover tooltip ile teknoloji adı
- mevcut mapping reuse
- unknown technology fallback

uygula.

---

# Compact Chat

Compact/right-bottom chat window içinde conversation değiştirme desteğini ekle.

Kullanıcı:

```text
Alper
→ Nisa
→ Project Group
```

arasında fullscreen'e dönmeden geçiş yapabilmeli.

Existing:

```text
Fullscreen
Minimized Bar
Compact Window
```

state modelini koru.

Tek selected conversation source of truth kullan.

Unread state ve WebSocket subscription davranışını bozma.

---

# Testler

Her task sonrası ilgili testleri çalıştır.

Finalde:

Frontend:
- lint
- type-check
- tests
- Playwright
- production build

Backend'e dokunulduysa:
- backend tests
- integration tests
- architecture tests
- build

çalıştır.

---

# Git Güvenliği

Plan dışı staged/unstaged kullanıcı kodunu kaybetme.

Şunları kullanma:

```text
git reset --hard
git checkout .
```

Conflict çıkarsa iki tarafın gerekli değişikliklerini koruyarak çöz.

---

# Final Rapor

## Checklist
Planın final `[x]` durumunu göster.

## Localized Routing
TR/EN/DE route yaklaşımını özetle.

## Organization UI
Nelerin değiştiğini yaz.

## Messaging UI
Nelerin değiştiğini yaz.

## Technology Stack
Icon/tooltip/fallback davranışını yaz.

## Compact Chat
Conversation switcher ve state davranışını açıkla.

## Changed Files
Önemli dosyaları listele.

## Tests
Çalıştırılan test/build komutları ve sonuçlarını yaz.

## Remaining Issues
Bir şey kaldıysa açıkça belirt.

Yoksa:

```text
Kalan blocker yok.
```

yaz.

---

# Kritik Kurallar

1. Opus planı source of truth.
2. Taskları sırayla uygula.
3. Bir task bitmeden sonraki taska geçme.
4. Checkbox'ları gerçek zamanlı güncelle.
5. Definition of Done tamamlanmadan `[x]` yapma.
6. Localized route mapping'i dağıtma.
7. Dynamic slugları tercüme etme.
8. Locale switch logical page'i korusun.
9. Organization ve Messaging UI refactorlarında business logic bozma.
10. Compact chat conversation switcher fullscreen'e bağımlı kalmamalı.
11. Chat state duplicate edilmemeli.
12. Unread/read/WebSocket davranışı korunmalı.
13. Kullanıcı kodunu resetleme/revert etme.
14. Final full regression geçmeden işi bitmiş sayma.
