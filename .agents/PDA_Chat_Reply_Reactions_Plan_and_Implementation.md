# PDA — Chat Navigation Behavior, Replies & Emoji Reactions Planning

PDA (Project Delivery Assistant) mesajlaşma sistemine üç ilişkili geliştirme yapılacak:

1. Fullscreen chat'in navigation davranışını düzeltmek.
2. Mesajlara özel cevap verme (reply) özelliği eklemek.
3. Emoji gönderme ve mesajlara emoji reaction bırakma desteği eklemek.

Şu an senden KOD YAZMANI İSTEMİYORUM.

Önce repository'yi detaylı incele:

- mevcut chat frontend state modelini
- fullscreen / compact / minimized bar davranışını
- ChatProvider / ChatRoot ownership'ini
- route/layout yapısını
- message database modelini
- REST API'yi
- WebSocket/STOMP event modelini
- unread/read state'i
- existing composer'ı
- mevcut UI componentlerini
- i18n ve Playwright testlerini

çöz.

Ardından aşağıdaki gereksinimleri teknik bağımlılıklarına göre tasklara ayır ve uygulanabilir bir plan oluştur.

---

# En Önemli Çalışma Kuralı

Taskları aşağıdaki maddelerin yazılma sırasına göre körlemesine uygulama.

Gerçek dependency graph'ı repository analizinden çıkar.

Reply/reaction özellikleri database/API/WebSocket değişikliği gerektiriyorsa önce backend contract/schema, sonra frontend state/UI yapılması gerekebilir.

Ancak kesin sıra repository analizine göre senin kararın olmalı.

Bir task tamamen bitmeden sonraki taska geçilmemeli.

---

# Plan Dosyası

Repository root'unda:

```text
PDA_CHAT_REPLY_REACTIONS_PLAN.md
```

oluştur.

Bu dosya Sonnet implementation aşamasında source of truth olacak.

Her task checkbox formatında olmalı:

```md
## Task 1 — ...

- [ ] 1.1 ...
- [ ] 1.2 ...
- [ ] 1.3 ...

### Definition of Done
- [ ] ...
- [ ] ...
```

Implementation sırasında tamamlanan maddeler `[x]` olarak güncellenecek.

Definition of Done tamamlanmadan task `[x]` yapılmamalı.

---

# 1. Fullscreen Chat Navigation Davranışı

Mevcut chat modeli yaklaşık olarak:

```text
Fullscreen Chat
Minimized Bar
Compact Window
Closed
```

durumlarını destekliyor.

Daha önce chat navigation boyunca persistent hale getirildi.

Ancak mevcut davranış fazla geniş:

> Chat fullscreen haldeyken sidebar'dan başka bir sayfaya gidildiğinde de chat açık kalıyor.

Bu istenmiyor.

---

# 2. Beklenen Fullscreen Davranışı

Eğer chat `FULLSCREEN` durumundaysa ve kullanıcı sidebar'dan başka bir sayfaya tıklarsa:

```text
Fullscreen Chat
→ başka route
→ chat kapanır
→ tıklanan sayfa normal şekilde açılır
```

Chat otomatik olarak minimized hale getirilmemeli.

Chat yeni sayfanın üzerinde açık kalmamalı.

Kullanıcının navigation intent'i öncelikli olmalı.

---

# 3. Minimized / Compact Persistence

Persistent davranış SADECE sağ-alt chat durumlarında korunmalı.

Yani `MINIMIZED BAR` ve `COMPACT WINDOW` durumlarında kullanıcı başka sayfalara geçerse chat açık kalabilir.

Örneğin:

```text
Compact / Minimized
→ Tasks
→ Calendar
→ Organizations
→ Projects
→ Settings
```

ve benzeri navigationlarda mevcut product davranışına göre sağ-alt chat korunmalı.

---

# 4. Explicit Close

Kullanıcı `X` ile chat'i kapatırsa `CLOSED` olmalı.

Sonraki navigation chat'i otomatik yeniden açmamalı.

Sidebar'daki Mesajlaşma action'ı tekrar kullanılırsa yeniden açılabilmeli.

---

# 5. Project / Account Boundary

Mevcut güvenlik/state sınırlarını koru.

Project A chat state'i Project B içine taşınmamalı.

Başka hesaba/logout'a taşınmamalı.

Mevcut generation/project/account isolation mekanizmasını bozma.

---

# 6. Navigation Fix İçin Root Cause

Özellikle incele:

- AppShell
- ChatProvider
- ChatRoot
- current chat mode
- pathname/router
- sidebar navigation
- selected project context
- global navigation
- route change effects

Page-specific hack yapma.

State machine'in gerçek semantics'ini düzelt.

Özellikle:

```text
FULLSCREEN + navigation = CLOSE
COMPACT + navigation = KEEP
MINIMIZED + navigation = KEEP
CLOSED + navigation = KEEP CLOSED
```

davranışını merkezi şekilde tanımla.

---

# 7. Emoji — İki Farklı Kullanım

Emoji özelliğini iki ayrı davranış olarak ele al.

## A. Normal emoji mesajı

Kullanıcı composer'ın sağ altında emoji butonuna tıklar.

Emoji picker açılır.

Bir veya birden fazla emoji seçildiğinde composer'a eklenir.

Örneğin:

```text
😂❤️
```

Normal text message gibi gönderilir.

Bu özel bir message type olmak zorunda değildir.

Existing text message API emoji Unicode karakterlerini zaten destekliyorsa onu reuse et.

## B. Mesaja Emoji Reaction

Belirli bir mesaja özel emoji reaction bırakılabilmeli.

Örneğin:

```text
Hamza:
Yarın toplantı 14:00

        👍 2   😂 1
```

Reaction mesaj içeriği değildir.

Mesajın metadata/state'idir.

Backend'de gerçek persistence olmalıdır.

Local-only reaction yapma.

---

# 8. Emoji Picker UI

Composer'ın sağ tarafında emoji icon bulunmalı.

Örneğin:

```text
[ message input                    🙂 ] [Send]
```

Emoji icon'a tıklayınca küçük picker/popover açılmalı.

Seçilen emoji input'a insert edilmeli.

Enter mevcut send behavior'ına uygun şekilde mesajı göndermeli.

Shift+Enter davranışı mevcutsa korunmalı.

---

# 9. Emoji Picker Dependency

Repository'yi incele.

Mevcut emoji picker/component/library varsa reuse et.

Yoksa gereksiz ağır dependency ekleme.

Bir third-party picker eklemek gerekiyorsa:

- bundle size
- accessibility
- maintenance
- license
- dark/light support

incele.

Basit, maintainable çözüm yeterliyse onu tercih et.

---

# 10. Message Hover Actions

Desktop'ta kullanıcı bir mesajın üzerine hover yaptığında küçük action controls görünmeli.

WhatsApp benzeri yaklaşım kullanılabilir.

En az:

```text
Reply
React
```

action'ları olmalı.

Menü mesaj içeriğini gereksiz şekilde örtmemeli.

Own message ve other-user message için uygun positioning yap.

---

# 11. Mobile Davranışı

Hover mobile'da çalışmadığı için:

- tap
- long press
- veya uygun existing mobile interaction

kullan.

Desktop UX'i aynen mobile'a zorla kopyalama.

Responsive davranışı repository'nin mevcut chat design'ına göre belirle.

---

# 12. Reply Özelliği

Kullanıcı belirli bir mesaj için `Reply` seçtiğinde composer'ın üzerinde küçük reply context görünmeli.

Örneğin:

```text
Yanıtlanıyor:
Alper
"Yarın toplantı saat kaçta?"

[x]

-----------------------------------
Mesajınızı yazın...
```

X ile reply mode iptal edilebilmeli.

---

# 13. Reply Gönderimi

Reply sadece frontend görsel efekti olmamalı.

Message backend modeli reply ilişkisini desteklemeli.

Kavramsal olarak:

```text
message
id
conversationId
senderId
content
replyToMessageId?
createdAt
```

şeklinde olabilir.

Ancak gerçek model/adlandırmayı repository mimarisine göre belirle.

---

# 14. Reply Validation

Backend şu kontrolleri yapmalı:

- Reply edilen mesaj gerçekten var mı?
- Aynı conversation içinde mi?
- Aynı project scope içinde mi?
- Kullanıcının erişebildiği conversation'a mı ait?

Başka conversation/project message ID verilerek reply yapılamamalı.

IDOR/cross-project açığı bırakma.

---

# 15. Reply Response Model

Frontend mesajı render ederken reply context gösterebilmeli.

Response DTO reply edilen mesaj hakkında yeterli ama minimum bilgi vermeli.

Örneğin:

```text
replyTo:
  id
  sender
  preview/content
```

veya mevcut architecture'a daha uygun eşdeğer model.

Her reply için frontend'in ayrıca N tane request atmasına neden olma.

N+1 fetch tasarımı yapma.

---

# 16. Reply Preview Length

Uzun mesajlarda quoted preview sınırlı olmalı.

Frontend'de ellipsis olabilir.

Backend'de content truncate edilmesinin gerekli olup olmadığını repository/model yapısına göre değerlendir.

---

# 17. Message Reactions — Data Model

Reaction gerçek backend persistence olmalı.

Kavramsal yapı:

```text
message_reactions

id?
message_id
user_id
emoji
created_at
```

veya equivalent composite-key modeli.

Unique davranışı düşün:

```text
message + user + emoji
```

aynı reaction'ın duplicate kayıt oluşturmasını engellemeli.

---

# 18. Reaction Toggle

Kullanıcı aynı emoji reaction'a tekrar basarsa add → remove toggle davranışı olabilir.

Final semantics'i repository/product yapısına göre açıkça planla.

---

# 19. Bir Kullanıcının Birden Fazla Reaction'ı

Önerilen V1:

> Aynı kullanıcı aynı mesaja birden fazla farklı reaction bırakabilsin; ancak aynı emoji duplicate olmasın.

Bu tercih mevcut UX'e uygunsa uygula.

---

# 20. Reaction Aggregation

Frontend message response'unda reaction'lar aggregate şekilde bulunmalı.

Örneğin:

```json
[
  {
    "emoji": "👍",
    "count": 3,
    "reactedByCurrentUser": true
  },
  {
    "emoji": "😂",
    "count": 1,
    "reactedByCurrentUser": false
  }
]
```

Exact DTO repository convention'a göre belirlenmeli.

Frontend her reaction için ayrı API isteği yapmamalı.

---

# 21. Reaction Authorization

Kullanıcı yalnız:

- aktif proje üyesiyse
- ilgili conversation'a erişebiliyorsa

reaction ekleyebilmeli/silebilmeli.

Message ID'yi değiştirerek başka project/conversation'a reaction eklenememeli.

Backend source of truth.

---

# 22. Reaction Emoji Validation

Backend'de reaction alanına keyfi sınırsız string kaydedilmemeli.

Emoji validation ve length limit tanımla.

Aşırı karmaşık Unicode parsing yapmadan güvenli, maintainable bir çözüm seç.

---

# 23. Reaction API

Repository'deki REST style'a göre endpoint tasarla.

Örneğin kavramsal olarak:

```text
PUT/POST
/projects/{projectId}/chat/conversations/{conversationId}/messages/{messageId}/reactions

DELETE
/projects/{projectId}/chat/conversations/{conversationId}/messages/{messageId}/reactions/{...}
```

veya toggle endpoint.

Ancak bu yalnız örnektir.

Mevcut ChatController conventions'a göre en temiz API'yi seç.

---

# 24. WebSocket / Real-Time Reply

Reply normal message delivery eventinin parçası olmalı.

Yeni reply message başka kullanıcıya gerçek zamanlı geldiğinde quoted message context de görünmeli.

Ek REST fetch gerektirmemeli.

---

# 25. WebSocket / Real-Time Reaction

Reaction değişiklikleri de mümkünse real-time görünmeli.

Recipient ekranında reload olmadan count güncellenmeli.

Mevcut WebSocket/STOMP event envelope architecture'ını reuse et.

İkinci paralel socket sistemi kurma.

---

# 26. Duplicate Event Safety

Daha önce renewal overlap sırasında duplicate message event problemi düzeltildi.

Reaction ve reply implementation bu korumayı bozmamalı.

WebSocket handover sırasında aynı reaction event iki kez gelirse:

- count +2 olmamalı
- duplicate reaction görünmemeli

Existing generation/message/event dedup sistemini incele.

---

# 27. Unread Davranışı

Reply normal message olduğu için mevcut unread kurallarını takip etmeli.

Reaction yeni unread message sayısını artırmamalı.

Bir reaction bildirim sayacı tasarlama.

V1'de Notification Service'e reaction/reply bell notification ekleme.

Chat içindeki real-time UI yeterli.

---

# 28. Message UI

Reply olan mesaj görsel olarak quoted message → actual reply şeklinde anlaşılır olmalı.

Own/other message bubble tasarımını bozma.

Reaction chips bubble altında gösterilebilir.

PDA design system'e uy.

---

# 29. Reaction Picker

Mesaj hover action'daki emoji button tıklanınca küçük reaction picker açılmalı.

İlk görünümde sık kullanılan birkaç emoji göstermek yeterli olabilir:

```text
👍 ❤️ 😂 😮 😢 🙏
```

ve gerekirse full picker action.

WhatsApp'ı birebir clone etme.

---

# 30. Direct Emoji Message

Composer emoji picker reaction picker'dan farklı amaç taşır.

```text
Composer picker
→ emoji normal message content'e ekler.

Message reaction picker
→ message reaction API çağrısı yapar.
```

Bu iki behavior açıkça ayrılmalı.

---

# 31. Keyboard UX

Reply mode'da Esc ile reply iptali değerlendir.

Composer emoji picker:

- keyboard accessible
- Enter/Space action
- Escape close
- focus restore

olmalı.

Existing Radix/shadcn primitives varsa reuse et.

---

# 32. Database Migration

Reply/reaction persistence yeni schema gerektiriyorsa Flyway migration ekle.

Örneğin:

```text
chat_messages.reply_to_message_id
chat_message_reactions
```

Ancak gerçek mevcut schema'ya göre final karar ver.

Constraints:

- FK
- project/conversation integrity
- unique reaction
- indexes

ekle.

Migration mevcut mesajları bozmamalı.

---

# 33. Database Indexes

Özellikle değerlendir:

```text
message_reactions.message_id
message_reactions.user_id
chat_messages.reply_to_message_id
```

ve aggregate query performansı.

History pagination üzerinde N+1 veya full scan bırakma.

---

# 34. Message History Query

History endpoint artık:

- reply context
- reaction aggregates
- current user reaction state

döndürebilmeli.

Bunu N+1 query üretmeden tasarla.

---

# 35. Backward Compatibility

Mevcut eski messages:

```text
replyTo = null
reactions = []
```

olarak çalışmalı.

Existing history/messages E2E bozulmamalı.

---

# 36. Fullscreen Navigation Testleri

En az:

```text
open fullscreen chat
→ Tasks sidebar
→ Tasks opens
→ chat fullscreen closed
```

```text
open fullscreen chat
→ Calendar
→ chat closed
```

```text
compact chat
→ Tasks
→ compact chat remains
```

```text
minimized bar
→ Organizations / Projects / Settings
→ bar remains
```

```text
close X
→ navigate
→ chat remains closed
```

---

# 37. Reply E2E

En az gerçek iki kullanıcıyla:

```text
User A sends:
"Toplantı saat kaçta?"

User B
→ hover message
→ Reply
→ quoted context appears
→ sends "14:00"

User A
→ receives real-time
→ sees quoted original message
→ reply content correct
```

Reload sonrası reply ilişkisi hâlâ görünmeli.

---

# 38. Reaction E2E

Gerçek iki kullanıcıyla:

```text
User A sends message

User B
→ React
→ 👍

User A
→ without reload sees 👍 1
```

Sonra:

```text
User B presses 👍 again
→ reaction removed
→ User A sees removal real-time
```

Ayrıca birden fazla farklı reaction count'u doğru olmalı.

---

# 39. Composer Emoji E2E

```text
open emoji picker
→ select 😂
→ emoji appears in composer
→ Enter
→ actual message 😂 sent
→ other user receives 😂
→ reload
→ history contains 😂
```

Local-only picker sonucu kabul edilmez.

---

# 40. Security Tests

Backend testlerinde:

- reply to same conversation allowed
- reply to foreign conversation rejected
- reply to foreign project rejected
- reaction same conversation allowed
- foreign message reaction rejected
- non-member rejected
- removed member rejected
- invalid emoji rejected
- duplicate same emoji idempotent/toggle
- CSRF required
- IDOR protected

doğrula.

---

# 41. WebSocket Tests

Test et:

- reply real-time
- reaction add
- reaction remove
- renewal overlap
- duplicate event safety
- project switch cleanup
- logout/session revoke

Existing socket/session security modelini bozma.

---

# 42. Frontend Cache

React Query cache updates:

- history
- overview
- active conversation
- unread

doğru kalmalı.

Reaction için tüm message history'yi gereksiz refetch etme.

Mümkünse targeted cache update kullan.

Server response source of truth olsun.

---

# 43. Performance

Reaction/reply eklenince:

- her message için ayrı request atılmamalı
- history load N+1 olmamalı
- reaction real-time event full conversation reload ettirmemeli
- WebSocket event storm üretmemeli

---

# 44. i18n

Yeni UI metinleri:

- Reply
- Replying to
- Cancel reply
- React
- Emoji
- reaction error
- quoted message unavailable

mevcut desteklenen dillerde eklenmeli.

TR / EN / DE gerçekten aktifse üçü de tamamlanmalı.

---

# 45. Accessibility

Kontrol et:

- hover actions keyboard ile erişilebilir
- reaction buttons aria-label
- emoji picker keyboard support
- reply context screen-reader label
- focus restore
- tooltip
- touch interaction

---

# 46. Dark / Light Theme

Yeni:

- hover controls
- reply preview
- emoji picker
- reaction chips

dark/light theme ile uyumlu olmalı.

Hardcoded background/text renkleriyle mevcut token sistemini bypass etme.

---

# 47. Mobile / Responsive

Desktop:

```text
hover actions
compact chat
```

Mobile:

- hover yerine tap/long press
- emoji picker taşmamalı
- reply preview composer'ı kullanılamaz hale getirmemeli
- reaction chips wrap olabilmeli

---

# 48. Notification Service

V1'de:

```text
reply → bell notification YOK
reaction → bell notification YOK
```

Mevcut karar korunmalı.

Chat real-time UI + unread message sistemi yeterli.

---

# 49. Existing Feature Regression

Şunlar bozulmamalı:

- project group chat
- direct chat
- history pagination
- unread
- read state
- minimized bar
- compact window
- fullscreen
- direct conversation switcher
- project group switching
- reconnect
- proactive token refresh
- revoked session handling
- account/project isolation
- rate limit
- message-ID dedup

---

# 50. Task Gruplandırma

Yukarıdaki maddeleri tek tek task yapma.

Repository analizine göre mantıklı ana fazlar oluştur.

Muhtemel dependency graph:

```text
Existing chat/state/schema analysis
↓
Fullscreen navigation semantics
↓
Reply + reaction DB model
↓
Backend API/service/security
↓
WebSocket event contract
↓
Backend integration tests
↓
Frontend types/API/cache
↓
Reply UI
↓
Reaction UI
↓
Composer emoji picker
↓
Responsive/accessibility/i18n
↓
Playwright
↓
Full regression
```

Ancak gerçek sıra repository analizine göre senin kararın olmalı.

---

# 51. Her Task İçin

Mutlaka belirt:

- amaç
- neden bu sırada
- prerequisite
- etkilenecek dosyalar
- backend değişiklikleri
- DB migration
- frontend değişiklikleri
- WebSocket etkisi
- security etkisi
- cache/state etkisi
- edge cases
- testler

Ve:

```md
### Definition of Done

- [ ] ...
- [ ] ...
```

ekle.

---

# 52. Git Güvenliği

Mevcut staged/unstaged kullanıcı değişikliklerini kaybetme.

Kullanma:

```text
git reset --hard
git checkout .
```

Plan dışı değişiklikleri revert etme.

Commit/push yapma.

---

# 53. Opus Final Çıktısı

Final cevabını şu sırayla ver:

## 1. Existing Architecture Analysis
Chat frontend/backend/WebSocket/schema/state yapısını özetle.

## 2. Navigation State Decision
Fullscreen / compact / minimized / closed route-change semantics'ini kesinleştir.

## 3. Reply Data Model
DB + DTO + API yaklaşımını açıkla.

## 4. Reaction Data Model
DB + aggregation + toggle semantics.

## 5. WebSocket Event Design
Reply/reaction real-time delivery.

## 6. Dependency / Implementation Order
Taskların neden bu sırada olduğunu açıkla.

## 7. Implementation Checklist
Checkbox'lı plan.

## 8. Database Changes
Migration/index/constraints.

## 9. Backend Changes
Controller/service/repository/security.

## 10. Frontend Changes
Chat state/reply/reaction/emoji UX.

## 11. Security Risks
IDOR/cross-project/duplicate event/input validation.

## 12. Performance Risks
N+1/cache/event duplication.

## 13. Validation Plan
Backend + WebSocket + Playwright + full regression.

---

# Kritik Kurallar

1. Şu aşamada production kodu yazma.
2. Önce repository'yi incele.
3. Fullscreen chat navigation persistence'ını kaldır; yalnız compact/minimized persistence kalsın.
4. Navigation sırasında fullscreen'i minimized'a otomatik çevirme; kapat.
5. Explicit X kapalı state'i korusun.
6. Project/account boundaries korunmalı.
7. Reply frontend-only yapılmamalı.
8. Reply relation DB/API'de gerçek persistence olmalı.
9. Cross-conversation reply engellenmeli.
10. Reaction frontend-only yapılmamalı.
11. Reaction backend'de persist edilmeli.
12. Reaction authorization backend'de enforce edilmeli.
13. Same user + message + emoji duplicate olmamalı.
14. Reply normal unread message davranışını izlemeli.
15. Reaction unread message sayısını artırmamalı.
16. Composer emoji normal message content'idir; reaction değildir.
17. WebSocket reply/reaction real-time çalışmalı.
18. Renewal overlap duplicate reaction/count üretmemeli.
19. History N+1 query üretmemeli.
20. Existing chat API/security modelini gereksiz bozma.
21. Notification Service entegrasyonu ekleme.
22. Dark/light/mobile/accessibility/i18n tamamlanmalı.
23. Existing chat regression bırakma.
24. Her task checkbox + Definition of Done içermeli.
25. Sonnet taskları sırayla uygulayabilmeli.
26. Bir task bitmeden `[x]` yapma.
27. Commit/push yapma.

---

# Sonnet Implementation Prompt

Repository root'undaki `PDA_CHAT_REPLY_REACTIONS_PLAN.md` dosyasını tamamen oku.

Bu dosya implementation için source of truth'tur.

Planı task sırasını değiştirmeden IMPLEMENT ET.

Her alt task tamamlandığında:

```md
- [ ]
```

değerini:

```md
- [x]
```

olarak güncelle.

Definition of Done ve ilgili testler geçmeden ana taskı tamamlandı işaretleme.

Özellikle şu ürün davranışları finalde kesin olmalı:

1. FULLSCREEN chat + sidebar navigation → chat CLOSED.
2. COMPACT/MINIMIZED chat + navigation → chat persistent.
3. Reply gerçek backend persistence kullanmalı.
4. Reaction gerçek backend persistence kullanmalı ve WebSocket ile real-time güncellenmeli.
5. Composer emoji picker normal mesaj içeriğine emoji eklemeli.
6. Message hover/touch actions Reply + React sunmalı.
7. Reply cross-conversation/project IDOR engellenmeli.
8. Reaction unread message sayısını artırmamalı.
9. Reply normal message unread davranışını takip etmeli.
10. Renewal overlap duplicate reply/reaction/count üretmemeli.
11. Existing project group/direct chat/history/read/unread/compact/fullscreen/session behavior bozulmamalı.

Task task ilerle:

```text
implementation
→ targeted tests
→ bug fix
→ Definition of Done
→ checkbox [x]
→ next task
```

Finalde:

- backend tests
- DB/migration tests
- WebSocket integration tests
- frontend lint
- TypeScript
- build
- targeted Playwright
- full Playwright
- pre-push gate

çalıştır.

Commit/push yapma.

Final raporda:
- checklist
- DB/API changes
- reply behavior
- reaction behavior
- emoji picker
- navigation behavior
- WebSocket behavior
- security/IDOR
- changed files
- tests
- remaining issues

başlıklarını kullan.

Blocker yoksa:

```text
Kalan blocker yok.
```

yaz.
