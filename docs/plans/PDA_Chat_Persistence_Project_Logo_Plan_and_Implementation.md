# PDA — Persistent Minimized Chat + Project Settings Logo Fix

Bu dosya iki aşamalı çalışma için hazırlanmıştır:

1. **Claude Opus + Plan Mode** → repository'yi inceleyip taskları teknik bağımlılık sırasına göre planlayacak.
2. **Claude Sonnet** → Opus'un hazırladığı checklist'i sırayla uygulayacak ve tamamlanan maddeleri `[x]` olarak işaretleyecek.

---

# 1) Opus Plan Mode İçin Nihai Prompt

# PDA — Persistent Minimized Chat + Project Settings Logo Fix Planning

PDA (Project Delivery Assistant) projesinde iki frontend bug/task ele alınacak.

Şu an senden KOD YAZMANI İSTEMİYORUM.

Önce repository'yi incele, iki problemi gerçek nedenleriyle analiz et, tasklara ayır ve teknik bağımlılık sırasına göre uygulanabilir bir plan oluştur.

En önemli kural:

> Taskları benim verdiğim sıraya körlemesine göre değil, repository analizi sonucunda teknik bağımlılığa göre sırala.

Her task checkbox formatında olmalı ve Sonnet implementation sırasında sırayla uygulanabilmeli.

Plan sonunda mümkünse repository root'unda:

```text
PDA_CHAT_PERSISTENCE_PROJECT_LOGO_PLAN.md
```

oluştur.

Bu dosya implementation source of truth olacak.

---

# Problem 1 — Minimized Chat Başka Sayfalara Geçince Kayboluyor

Mevcut davranış:

```text
Mesajlaşma
→ chat açılır
→ sağ alta minimize edilir
→ selected project sidebar içinde başka sayfaya geçilir
→ chat bazen kaybolur
```

Şu anda sağ-alt minimized chat yalnız belirli selected-project sayfalarında kalıyor.

Kullanıcı beklentisi:

> Kullanıcı chat'i manuel olarak çarpıya basıp tamamen kapatmadığı sürece, minimized chat görünmeye devam etsin.

Bu davranış navigation sırasında korunmalı.

Özellikle şu sayfalara geçişlerde chat kaybolmamalı:

- Genel Bakış
- Kriterler
- Ekipler
- Depo
- Görevler
- Takvim
- proje içindeki diğer mevcut sayfalar

Eğer selected project context aynıysa minimized chat korunmalı.

Chat ancak şu durumlarda kapanmalı:

- kullanıcı explicit close / X ile kapatırsa
- selected project değişirse
- project context tamamen terk edilirse ve mevcut ürün davranışı gereği chat kapanması gerekiyorsa
- kullanıcı logout olursa

---

# Chat State İçin İncelenecekler

Özellikle repository'de şunları incele:

- ChatProvider
- chat shell
- fullscreen / minimized / compact state
- selected conversation state
- selected project state
- route/layout hierarchy
- project layout
- global authenticated layout
- sidebar navigation
- route transitions
- component mount/unmount davranışı
- React Query cache
- local state / context state
- session storage/local storage kullanımı varsa
- WebSocket subscription lifecycle

Amaç chat'in neden bazı route'larda unmount olup state kaybettiğini bulmak.

Page-specific mount yerine daha üst ortak layout/provider seviyesinde tutulması gerekiyorsa bunu planla.

Ancak gereksiz global refactor yapma.

---

# Persistent Chat Beklenen Davranış

Aynı project içinde:

```text
Fullscreen Chat
→ Minimized Bar
→ Tasks
→ Calendar
→ Teams
```

geçişlerinde minimized chat sağ altta kalmalı.

Ayrıca:

- active conversation korunmalı
- unread badge korunmalı
- draft mümkünse korunmalı
- WebSocket bağlantısı gereksiz yeniden kurulup kapanmamalı
- duplicate subscription oluşmamalı

Compact/minimized/fullscreen state tek source of truth kullanmalı.

---

# Project Değişimi

Project A chat'i açıkken Project B'ye geçilirse:

- Project A chat görünmeye devam etmemeli
- Project A conversation state temizlenmeli
- Project A WebSocket/subscriptions kapanmalı
- Project B için temiz chat context açılmalı

Cross-project chat state leak kesinlikle olmamalı.

---

# Explicit Close Davranışı

Kullanıcı sağ alttaki chat bar/panel üzerindeki X'e basarsa:

```text
chatOpen = false
```

mantığında gerçekten kapansın.

Sonraki navigationlarda otomatik yeniden görünmesin.

Ancak sidebar'daki `Mesajlaşma`ya tekrar basılırsa yeniden açılabilsin.

---

# Problem 2 — Project Settings Sayfasında Logo Görünmüyor

Mevcut davranış:

```text
Projects
→ project card
→ sağ üst kalem icon
→ Project Settings
```

Project'in logosu mevcut olduğu halde Project Settings sayfasında görünmüyor.

Bu bug'ın gerçek kaynağını incele.

Olası alanlar:

- project detail DTO logo alanı taşımıyor
- settings page yanlış query kullanıyor
- image URL mapping eksik
- cache eski
- logo component fallback'e düşüyor
- edit form defaultValues içinde logo yok
- project settings route yeni fetch'te media field kayboluyor

Tahmin ederek düzeltme yapma; gerçek data flow'u analiz et.

---

# Project Logo Beklenen Davranış

Project'in logosu varsa Project Settings sayfasında görünmeli.

Örneğin:

```text
[ mevcut proje logosu ]

Logo değiştir
Logo kaldır
```

veya mevcut settings UI standardına uygun eşdeğer yapı.

Eğer logo yoksa mevcut fallback/initial kullanılmalı.

Project card ile settings page aynı source of truth / media mapping'i kullanmalı.

Aynı logo URL logic'ini ikinci kez duplicate etme.

---

# Logo State / Cache

Logo değiştirildiğinde:

- settings page anında güncellenmeli
- projects page card güncellenmeli
- project header güncellenmeli
- stale cache kalmamalı

Mevcut query invalidation standardını kullan.

Yeni paralel cache mekanizması kurma.

---

# Task Sıralaması

Plan sonunda taskları teknik bağımlılığa göre sırala.

Muhtemel yaklaşım:

```text
Task 1 — Chat state persistence / layout ownership
Task 2 — Chat regression tests
Task 3 — Project settings logo data flow fix
Task 4 — Logo regression/cache tests
```

Ama bu yalnız örnektir.

Gerçek repository analizine göre final sıralamayı kendin belirle.

---

# Plan Formatı

Mutlaka şu formatta yaz:

```md
## Task 1 — ...

- [ ] 1.1 ...
- [ ] 1.2 ...
- [ ] 1.3 ...

### Definition of Done
- [ ] ...
- [ ] ...
```

Her task için:

- amaç
- neden bu sırada
- etkilenecek dosyalar
- frontend değişiklikleri
- backend gerekiyor mu
- edge-case'ler
- testler

yaz.

---

# Test Planı

## Chat Persistence

En az şu senaryoları test et:

```text
Open chat
→ minimize
→ Tasks
→ chat remains
```

```text
Open chat
→ minimize
→ Calendar
→ chat remains
```

```text
Open chat
→ minimize
→ Teams
→ chat remains
```

```text
Open chat
→ minimize
→ close with X
→ navigate
→ chat does NOT reappear
```

```text
Project A minimized chat
→ switch to Project B
→ Project A chat disappears
→ no stale conversation
```

```text
minimized
→ compact
→ fullscreen
→ navigate
→ state preserved
```

Unread count ve active conversation da korunmalı.

---

## WebSocket Regression

Navigation sırasında:

- duplicate WebSocket açılmamalı
- orphan subscription kalmamalı
- unnecessary reconnect olmamalı
- project switch eski subscription'ı kapatmalı

---

## Project Settings Logo

En az:

```text
project has logo
→ open Project Settings
→ logo visible
```

```text
project has no logo
→ fallback visible
```

```text
change logo
→ settings page updates
→ project card updates
```

```text
remove logo
→ fallback appears
```

---

# Playwright

Mevcut Playwright altyapısını kullan.

Özellikle şu iki E2E senaryoyu ekle veya genişlet:

## Chat Persistence E2E

```text
Login
→ open project
→ open messaging
→ minimize
→ navigate Tasks
→ minimized chat visible
→ navigate Calendar
→ still visible
→ close chat
→ navigate Teams
→ chat absent
```

## Project Logo E2E

```text
Project with logo
→ Projects
→ click edit pencil
→ Project Settings
→ logo visible
```

---

# Git Güvenliği

Mevcut staged/unstaged kullanıcı değişikliklerini kaybetme.

Şunları kullanma:

```text
git reset --hard
git checkout .
```

Plan dışı değişiklikleri revert etme.

Conflict olursa iki tarafın gerekli değişikliklerini koru.

---

# Opus Final Çıktısı

Final cevabında şu sırayla ver:

## 1. Repository Analizi
## 2. Root Cause Tahminleri
## 3. Dependency / Ordering Kararı
## 4. Implementation Checklist
## 5. Etkilenecek Dosyalar / Modüller
## 6. Backend Gereken Değişiklikler
## 7. Riskler
## 8. Validation Plan

---

# Kritik Kurallar

1. Bu aşamada production kodu yazma.
2. Önce repository'yi incele.
3. Chat persistence problemini page-level hack ile çözme.
4. Aynı project içinde minimized chat navigation boyunca korunmalı.
5. Explicit close sonrası otomatik yeniden açılmamalı.
6. Project değişince eski chat state temizlenmeli.
7. Cross-project chat leak olmamalı.
8. WebSocket subscription lifecycle bozulmamalı.
9. Selected conversation tek source of truth olmalı.
10. Project Settings mevcut logo varsa göstermeli.
11. Logo mapping mevcut reusable media/avatar/project componentlerinden reuse edilmeli.
12. Logo update sonrası stale cache kalmamalı.
13. Backend gerekmiyorsa backend'e dokunma.
14. Her task checkbox formatında olmalı.
15. Her task için Definition of Done olmalı.
16. Sonnet taskları sırayla uygulayabilmeli.
17. Kullanıcı kodunu resetleme/revert etme.
18. Final implementation sırasını açıkça yaz.

---

# 2) Sonnet Implementation Prompt

Repository'de Opus tarafından hazırlanmış `PDA_CHAT_PERSISTENCE_PROJECT_LOGO_PLAN.md` dosyasını oku.

Bu plan source of truth'tur.

Şimdi planı IMPLEMENT ET.

## Çalışma düzeni

Taskları plandaki sırayla yap.

Bir task tamamen bitmeden sonraki taska geçme.

Her alt task tamamlandığında:

```md
- [ ]
```

değerini:

```md
- [x]
```

yap.

Definition of Done tamamlanmadan ana taskı `[x]` yapma.

---

# Chat Persistence

Aynı selected project içinde minimized/compact chat navigation boyunca korunmalı.

Özellikle:

- Tasks
- Calendar
- Teams
- Overview
- diğer project sayfaları

arasında geçerken chat kaybolmamalı.

Explicit X ile kapatılırsa kapalı kalmalı.

Project değişirse eski chat state temizlenmeli.

WebSocket duplicate subscription oluşturma.

---

# Project Settings Logo

Project'in mevcut logosu Project Settings sayfasında görünmeli.

Mevcut project media/logo mapping'ini reuse et.

Logo değişimi ve kaldırılması sonrası cache/query state doğru güncellenmeli.

Projects page card ve settings page aynı gerçek logo bilgisini göstermeli.

---

# Her Task Sonrası

1. Kodla.
2. İlgili testleri çalıştır.
3. Hataları düzelt.
4. Definition of Done doğrula.
5. Checkbox'ları `[x]` yap.
6. Sonraki taska geç.

Benden onay bekleme.

---

# Final Validation

Frontend:

- lint
- type-check
- Playwright
- production build

Backend'e dokunulduysa:

- backend tests
- integration tests
- architecture tests
- build

çalıştır.

---

# Final Rapor

## Checklist
## Chat Persistence Fix
## Project Settings Logo Fix
## Changed Files
## Tests
## Remaining Issues

Kalan sorun yoksa:

```text
Kalan blocker yok.
```

yaz.

---

# Kritik Kurallar

1. Opus planı source of truth.
2. Taskları sırayla uygula.
3. Chat state page navigationda kaybolmamalı.
4. Explicit close davranışı korunmalı.
5. Project değişiminde state temizlenmeli.
6. WebSocket lifecycle bozulmamalı.
7. Logo mevcutsa settings'te görünmeli.
8. Stale cache bırakma.
9. Kullanıcı kodunu resetleme/revert etme.
10. Full regression geçmeden işi tamamlanmış sayma.
