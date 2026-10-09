# PDA — Project-Based Real-Time Messaging System

PDA (**Project Delivery Assistant**) projesine proje bazlı gerçek zamanlı bir **Mesajlaşma / Chat** sistemi ekle.

Bu özellik yalnızca frontend mock olmamalıdır.

Mesajlar backend'de kalıcı tutulmalı, proje üyeliği ve authorization kuralları backend tarafından uygulanmalı, gerçek zamanlı mesajlaşma mevcut teknoloji stack'i ile güvenli şekilde çalışmalıdır.

Önce repository'yi incele.

Özellikle:

- Project Service
- ProjectMembership
- Teams
- Auth/User
- User summary/profile photo
- Notification Service
- Sidebar
- selected project navigation
- Navbar
- mevcut modal/panel sistemleri
- mevcut websocket/SSE altyapısı varsa
- Spring Modulith yapısı
- Security configuration
- frontend query/cache yaklaşımı
- API client
- profile photo/avatar componentleri
- responsive layout
- Flyway migrations
- test altyapısı

incelenmeden implementasyona başlama.

Bu task mevcut project/member mimarisine entegre edilmelidir.

---

# 1. Temel Amaç

Her proje kendi mesajlaşma alanına sahip olmalıdır.

Bir kullanıcı yalnızca üyesi olduğu proje içerisindeki mesajlaşmaya erişebilmelidir.

Mesajlaşma sistemi iki temel konuşma türüne sahip olacaktır:

```text
1. Bireysel konuşma
2. Proje grup konuşması
```

---

# 2. Sidebar'a "Mesajlaşma" Eklenmesi

Seçili proje sidebar'ında:

```text
Mesajlaşma
```

isimli yeni bir navigation item bulunmalıdır.

Bu item yalnızca bir proje seçiliyken görünmelidir.

Global sidebar'a ekleme.

Örnek:

```text
Seçili Proje

Genel Bakış
Kriterler
Ekipler
Depo
Görevler
Takvim
Mesajlaşma
```

Mevcut sidebar sıralamasına ve icon sistemine uy.

Yeni icon library ekleme.

---

# 3. Mesajlaşma Açıldığında Tam Ekran Chat Paneli

Kullanıcı:

```text
Sidebar
→ Mesajlaşma
```

butonuna bastığında klasik bir page navigation yerine uygulama alanını kaplayan büyük bir chat paneli açılmalıdır.

Bu panel:

- sidebar hariç ana content alanını kaplayabilir
- veya mevcut app shell yapısına göre tüm ana çalışma alanını kaplayabilir

Ancak mevcut navbar/sidebar sistemini kırma.

Panel açıldığında kullanıcı tamamen mesajlaşmaya odaklanabilmelidir.

---

# 4. Fullscreen Chat Panel Yapısı

Tam ekran chat paneli minimum olarak şu bölümlerden oluşmalıdır:

```text
┌───────────────────────────────────────────────────────────┐
│ Mesajlaşma                                       [—] [×] │
├───────────────────────┬───────────────────────────────────┤
│ Konuşmalar            │ Aktif Konuşma                     │
│                       │                                   │
│ Proje Grubu           │ Mesajlar                          │
│                       │                                   │
│ Kullanıcı 1           │                                   │
│ Kullanıcı 2           │                                   │
│ Kullanıcı 3           │                                   │
│ ...                   │                                   │
│                       │                                   │
│                       │                         Mesaj kutusu│
└───────────────────────┴───────────────────────────────────┘
```

Gerçek tasarımı PDA design system'e göre oluştur.

Bu yalnız kavramsal layout'tur.

---

# 5. Sol Konuşma Listesi

Chat panelinin sol tarafında o projedeki konuşulabilir kişiler listelenmelidir.

Kaynak:

```text
ProjectMembership
```

olmalıdır.

Bu listede:

- proje üyeleri
- avatar
- displayName/nickname
- gerekiyorsa role
- son mesaj özeti
- okunmamış mesaj sayısı

gösterilebilir.

Ancak V1 için gereksiz detay üretme.

Minimum:

```text
avatar
displayName
```

yeterlidir.

---

# 6. Kendini Listeleme

Kullanıcı bireysel konuşma listesinde kendisini görmemelidir.

Örneğin:

```text
Current User = Hamza

Conversation List:
Alper
Nisa
Kerem
```

olmalıdır.

Hamza kendi kendisine mesaj gönderememelidir.

Backend de bunu engellemelidir.

---

# 7. Profil Fotoğrafı

Daha önce eklenen profile photo sistemini kullan.

Kullanıcının profil fotoğrafı varsa:

```text
profile photo
```

göster.

Yoksa mevcut initial fallback kullan:

```text
Hamza
→ H
```

Yeni ayrı avatar sistemi oluşturma.

---

# 8. Proje Grup Konuşması

Her projede otomatik bir:

```text
Proje Grubu
```

konuşması bulunmalıdır.

Bu conversation o projedeki bütün aktif üyeler tarafından görülebilir ve kullanılabilir.

Örneğin:

```text
PDA Proje Grubu
```

veya mevcut localization standardına uygun isim kullanılabilir.

Bu grup manuel oluşturulmak zorunda değildir.

Project oluşturulduğunda veya chat ilk kez kullanıldığında güvenli şekilde oluşabilir.

---

# 9. Project Group Membership

Project group üyeliği:

```text
ProjectMembership
```

üzerinden türetilmelidir.

Ayrı manuel group-member yönetimi oluşturma.

Bir kullanıcı projeye üye olduğunda proje grup chat'ine erişebilir.

Projeden çıkarıldığında erişimi anında kaybetmelidir.

Eski mesaj history'sine artık erişememelidir.

---

# 10. Bireysel Konuşma

Bir proje üyesi başka bir proje üyesiyle bireysel mesajlaşabilmelidir.

Örneğin:

```text
Hamza ↔ Alper
```

Ancak bu konuşma project scope'a bağlı olmalıdır.

Yani:

```text
Hamza ↔ Alper
Project A
```

ile:

```text
Hamza ↔ Alper
Project B
```

aynı conversation olmak zorunda değildir.

Project-specific messaging olduğu için conversation context project'e ait olmalıdır.

---

# 11. Cross-Project Chat Yasak

Kullanıcı yalnızca seçili project'in üyeleriyle chat açabilmelidir.

Örneğin:

```text
User A:
Project 1 member

User B:
Project 2 member
```

ve ortak project yoksa Project 1 chat üzerinden iletişim kuramamalıdır.

Backend membership doğrulaması yapmalıdır.

Frontend'de gizlemek yeterli değildir.

---

# 12. Conversation Model

Mevcut architecture'a uygun bir conversation modeli oluştur.

Kavramsal olarak:

```text
Conversation

id
projectId
type
createdAt
updatedAt
```

Type:

```text
DIRECT
PROJECT
```

olabilir.

Gerçek isimleri mevcut naming standardına göre belirle.

---

# 13. Direct Conversation Participants

Direct conversation için participant modeli değerlendir.

Örneğin:

```text
ConversationParticipant

conversationId
userId
```

Ancak project group için duplicate member rows üretmek gereksizse mevcut project membership üzerinden türet.

Architecture'ı gereksiz karmaşıklaştırma.

---

# 14. Message Model

Mesajlar için kavramsal model:

```text
Message

id
conversationId
senderUserId
content
createdAt
updatedAt
deletedAt
```

V1 için minimum:

```text
id
conversationId
senderUserId
content
createdAt
```

yeterlidir.

Mevcut base entity/auditing standardına uy.

---

# 15. Mesaj İçeriği

Mesaj text tabanlı olacaktır.

V1'de yalnız text message destekle.

Şimdilik:

- image
- file
- audio
- voice message
- GIF
- sticker

ekleme.

Feature creep yapma.

---

# 16. Message Validation

Mesaj blank veya whitespace-only olamaz.

Makul max length belirle.

Örneğin:

```text
2000 karakter
```

Frontend ve backend aynı validation'a uymalıdır.

Backend source of truth'tur.

---

# 17. HTML / XSS

Message content raw HTML olarak render edilmemelidir.

Örneğin:

```html
<script>alert(1)</script>
<img src=x onerror=alert(1)>
```

text olarak görünmeli.

`dangerouslySetInnerHTML` kullanma.

---

# 18. Real-Time Messaging

Mesajlar gerçek zamanlı iletilmelidir.

Önce repository'de mevcut WebSocket, STOMP veya SSE altyapısı var mı kontrol et.

Varsa reuse et.

Yoksa mevcut Spring Boot + Next.js stack'ine en uygun, mümkün olduğunca sade çözümü seç.

Önerilen yaklaşım:

```text
Spring WebSocket
+
STOMP veya mevcut websocket standardı
```

olabilir.

Ancak repository yapısı farklıysa ona uy.

---

# 19. REST + WebSocket Ayrımı

Mesaj geçmişi ve conversation list için REST API kullanmak uygundur.

Yeni mesajların gerçek zamanlı iletimi için WebSocket kullanılabilir.

```text
REST
→ conversation history
→ conversation list

WebSocket
→ new message
→ read event
```

V1'de gereksiz her şeyi websocket'e taşıma.

---

# 20. Connection Authentication

WebSocket connection authenticated olmalıdır.

User ID client payload üzerinden güvenilir kabul edilmemelidir.

Authenticated session/JWT üzerinden backend current user belirlemelidir.

Kullanıcı başka bir `senderUserId` göndererek spoof yapamamalıdır.

---

# 21. WebSocket Authorization

Bir kullanıcı yalnızca erişebildiği conversation channel'ına subscribe olabilmelidir.

Direct conversation'da ayrıca current user participant olmalıdır.

---

# 22. Conversation Enumeration Engeli

Kullanıcı random conversation UUID deneyerek başka conversation mesajlarına erişememelidir.

REST ve WebSocket tarafında ownership/membership kontrolü yapılmalıdır.

IDOR engellenmelidir.

---

# 23. Mesaj Gönderme Akışı

Direct flow:

```text
User selects Alper
→ conversation bulunur / oluşturulur
→ message yazılır
→ backend validate eder
→ DB'ye kaydeder
→ websocket event publish edilir
→ iki kullanıcı ekranında görünür
```

Project flow:

```text
User selects Project Group
→ message
→ backend membership validate
→ save
→ project conversation subscribers receive
```

---

# 24. Direct Conversation Duplicate Engeli

Aynı project içinde aynı iki user için duplicate direct conversation oluşmamalıdır.

```text
Hamza ↔ Alper
```

ve:

```text
Alper ↔ Hamza
```

aynı direct conversation olmalıdır.

Application + DB seviyesinde güvenli çöz.

Race condition ihtimalini değerlendir.

---

# 25. Conversation List

Sol panelde `Proje Grubu` en üstte olabilir.

Ardından kullanıcılar listelenebilir.

Direct conversation henüz oluşmamış olsa bile project member seçilebilir.

İlk message gönderildiğinde conversation oluşturulabilir.

---

# 26. Son Mesaj

Existing architecture uygun ve kolay destekliyorsa conversation list'te son mesaj göster.

Query complexity'yi gereksiz büyütüyorsa V1 için yalnız kullanıcı adı gösterilebilir.

---

# 27. Unread Count

Unread message count ekle.

Bu bilgi:

- conversation list
- minimized chat
- sidebar Mesajlaşma item

gibi yerlerde reuse edilebilir.

Backend unread state source of truth olmalıdır.

---

# 28. Read State

Conversation açıldığında mevcut unread mesajlar read olarak işaretlenebilir.

Participant-level `lastReadAt` veya `lastReadMessageId` yaklaşımını değerlendir.

Her message için ayrı read row üretmek gereksizse yapma.

---

# 29. Sidebar Unread Badge

Seçili project sidebar'ındaki `Mesajlaşma` item'ında okunmamış mesaj varsa badge gösterilebilir.

Bu project'e ait unread mesaj toplamını göstermelidir.

Başka project unread count'larını karıştırma.

---

# 30. Active Conversation UI

Chat alanı minimum olarak:

- Conversation header
- Message history
- Message input
- Send button

içermelidir.

---

# 31. Message Bubble

Kullanıcının kendi mesajı ile karşı taraf mesajı görsel olarak ayrılmalıdır.

```text
other → left
self → right
```

Mevcut PDA dark/light design system'e uy.

---

# 32. Message Timestamp

Mesaj üzerinde minimum time göster.

Tarih değiştiğinde date separator kullanılabilir.

Mevcut localization/date utilities'i reuse et.

---

# 33. Message History Pagination

Bütün conversation history'yi tek request'te çekme.

Cursor pagination tercih et.

Örneğin:

```text
GET messages?before=<messageId>&limit=30
```

veya mevcut pagination standardına uygun çözüm.

---

# 34. Infinite Scroll

Kullanıcı yukarı scroll ettiğinde eski mesajlar yüklenebilir.

Scroll position kaybolmamalıdır.

Yeni mesaj geldiğinde kullanıcı zaten en alttaysa auto-scroll yapılabilir.

Eski mesajları okurken zorla alta atma.

---

# 35. Empty Conversation State

Henüz mesaj yoksa uygun empty state göster.

---

# 36. Chat Panel Minimize Davranışı

Tam ekran chat panelinin sağ üstünde minimize/kapatma kontrolü bulunmalıdır.

Kullanıcı minimize ettiğinde chat tamamen kapanmamalıdır.

Panel küçülerek ekranın sağ alt köşesine yerleşmelidir.

Instagram / LinkedIn web chat davranışına benzer olmalıdır.

---

# 37. Minimized Chat Panel

Küçültülmüş panel sağ alt köşede floating panel olarak görünmelidir.

Mevcut PDA design system'e uy.

---

# 38. Minimize vs Close

İki farklı davranışı ayır.

```text
—  → minimize
×  → close
```

Ancak requirement gereği X minimize olarak kullanılacaksa bunu koru.

---

# 39. Minimized Panel Restore

Sağ alt panelde expand aksiyonu bulunmalıdır.

Tıklanınca tekrar full-screen chat açılmalıdır.

Aktif conversation korunmalıdır.

---

# 40. State Koruma

Full-screen → minimize → full-screen geçişinde:

- selected conversation
- loaded messages
- draft text mümkünse
- unread state

kaybolmamalıdır.

---

# 41. Navigation Sırasında Minimized Chat

Kullanıcı chat'i minimize ettikten sonra Tasks, Calendar, Teams gibi project pages arasında gezinebilir.

Minimized chat panel mümkünse açık kalmalıdır.

Ancak selected project değişirse conversation state resetlenmelidir.

---

# 42. Project Değişimi

Selected project değiştiğinde:

- eski project conversation subscription'larını kapat
- eski active conversation'ı temizle
- yeni project chat context'ini kullan

Cross-project state leak oluşmamalı.

---

# 43. Global Route Davranışı

Kullanıcı project context dışına çıkarsa project-specific chat kapansın.

Global chat sistemi oluşturma.

---

# 44. Online Presence

V1 için online/offline/last seen zorunlu değildir.

Ana feature'ı geciktirmesin.

---

# 45. Typing Indicator

`Alper yazıyor...` V1 için zorunlu değildir.

Ana chat sistemi tamamlandıktan sonra çok doğal oturuyorsa eklenebilir.

---

# 46. Message Editing

V1'de mesaj düzenleme zorunlu değildir.

---

# 47. Message Deletion

V1 için message delete zorunlu değildir.

---

# 48. Notifications

Kullanıcı chat panelinde değilken yeni mesaj geldiğinde mevcut Notification Service ile entegrasyonu değerlendir.

Notification spam üretme.

Direct message için recipient notification uygun olabilir.

Project group için unread badge yeterli olabilir.

---

# 49. Self Notification

Kullanıcının kendi gönderdiği message için notification oluşturma.

---

# 50. Browser Notification

Native browser/push notification bu task'ın zorunlu parçası değildir.

---

# 51. Chat API

Mevcut REST standardına göre gerekli endpointleri oluştur.

Kavramsal:

```text
GET project conversations
GET project chat members
GET conversation messages
POST/open direct conversation
mark conversation read
```

Örneğin:

```http
GET /api/v1/projects/{projectId}/chat/conversations
GET /api/v1/projects/{projectId}/chat/members
POST /api/v1/projects/{projectId}/chat/direct/{userId}
GET /api/v1/projects/{projectId}/chat/conversations/{conversationId}/messages
POST /api/v1/projects/{projectId}/chat/conversations/{conversationId}/read
```

Gerçek naming mevcut repository standardına göre belirlenmelidir.

---

# 52. WebSocket Topics

Kavramsal olarak project/conversation scoped topic veya authenticated user-specific subscription modeli kullanılabilir.

Backend subscription authorization şarttır.

---

# 53. WebSocket Payload

Message event minimum:

```text
messageId
conversationId
projectId
sender
content
createdAt
```

içerebilir.

Full User entity publish etme.

Minimum UserSummary kullan.

---

# 54. Optimistic UI

Mesaj gönderirken optimistic UI kullanılabilir.

Failed message düzgün rollback/error göstermelidir.

Duplicate message oluşmasını önlemek için mevcut yaklaşımı kullan.

---

# 55. Duplicate Delivery

WebSocket reconnect veya retry nedeniyle aynı message iki kez görünmemelidir.

Frontend message ID üzerinden deduplicate edebilmelidir.

---

# 56. Reconnect

WebSocket bağlantısı koparsa mevcut client library'nin reconnect özelliğini kullan.

Reconnect sonrası REST catch-up ile kaçırılan mesajları almak gerekebilir.

Mesaj kaybı olmamalıdır.

---

# 57. Offline Send

V1 için offline queue oluşturma.

Connection yoksa kullanıcıya mesaj gönderilemediğini belirt.

---

# 58. Database

Flyway ile gerekli tabloları oluştur.

Kavramsal olarak:

```text
chat_conversations
chat_conversation_participants
chat_messages
chat_read_states
```

Mevcut naming standardına uy.

Hibernate schema update kullanma.

---

# 59. Indexler

Gerçek query patternine göre index ekle.

Özellikle:

```text
conversation_id + created_at
project_id
sender_user_id
```

alanlarını değerlendir.

Direct conversation uniqueness için uygun constraint/index oluştur.

---

# 60. Project Group Conversation Uniqueness

Her project için yalnızca bir PROJECT conversation bulunmalıdır.

DB/application seviyesinde duplicate project group oluşmasını engelle.

---

# 61. User Removal

Bir kullanıcı project'ten çıkarıldığında:

- project chat'e erişememeli
- websocket subscription geçersiz olmalı
- yeni message gönderememeli
- history endpoint'ine erişememeli

Eski message kayıtlarını DB'den silmek zorunda değilsin.

---

# 62. User Account Deletion

User silinme/lifecycle davranışı mevcut sistemde varsa chat message history integrity'sini bozma.

---

# 63. Authorization

Backend mutlaka şunları doğrulamalıdır:

```text
current user project member mı?
conversation project'e ait mi?
direct conversation'da participant mı?
recipient aynı project member mı?
message sender current authenticated user mı?
```

Frontend security değildir.

---

# 64. IDOR Testleri

Özellikle test et:

```text
Project A user
→ Project B conversation ID
```

erişememeli.

```text
Conversation A participant
→ Conversation B direct messages
```

erişememeli.

```text
User A
→ senderUserId = User B
```

spoof yapamamalı.

---

# 65. Rate Limiting / Spam

Mevcut rate limiting altyapısı varsa message sending üzerinde makul limit uygula.

Sırf chat için yeni ağır infrastructure ekleme.

---

# 66. Content Validation

Mesajlarda blank, max length ve control character kontrolleri yap.

---

# 67. Logging

Full private chat content'i gereksiz şekilde application loglarına yazma.

Message ID/conversation ID gibi metadata yeterlidir.

---

# 68. Privacy

Project member listesi yalnız o project üyelerine görünmelidir.

Direct message history yalnız iki participant tarafından okunabilmelidir.

Project group history yalnız project members tarafından okunabilmelidir.

---

# 69. User Email Gösterme

Chat member listesinde email gösterme.

`displayName / nickname / avatar` kullan.

---

# 70. Frontend State Architecture

Chat state'i tek component içine gömme.

Mantıklı şekilde ayır:

```text
chat API
chat queries
websocket hook
conversation list
message list
message input
floating/minimized panel
chat shell/provider
```

Gereksiz global state library ekleme.

---

# 71. Chat Provider

Fullscreen/minimized state sayfalar arasında korunacaksa authenticated/project layout seviyesinde uygun provider/state çözümü değerlendir.

---

# 72. Z-Index

Minimized panel navbar/sidebar/dialog/dropdown ile çakışmamalı.

Mevcut z-index scale'i kullan.

---

# 73. Responsive

Desktop'ta fullscreen + minimized floating panel.

Tablet'te responsive two-column veya collapsible list.

Mobile'da tek-column conversation flow kullanılabilir.

Desktop requirement'ını bozma.

---

# 74. Accessibility

Keyboard navigation, focus management, aria-label, send button semantics, conversation selection ve unread indicator uygun şekilde implement edilmeli.

---

# 75. Dark / Light Theme

Chat panel mevcut theme system'i kullanmalıdır.

Hardcoded dark theme yapma.

---

# 76. i18n

UI metinlerini mevcut i18n sistemine ekle.

---

# 77. Loading States

Conversation list ve message history için mevcut skeleton/loading standardını kullan.

---

# 78. Error States

Mesajlar yüklenemedi, bağlantı koptu, mesaj gönderilemedi gibi anlaşılır error state kullan.

Backend exception text'i direkt kullanıcıya gösterme.

---

# 79. Empty Member State

Project'te yalnız current user varsa:

```text
Bu projede henüz başka üye yok.
```

göster.

Project group yine mevcut olabilir.

---

# 80. Tests — Backend

En az:

## Membership
- project member chat açabilir
- non-member açamaz

## Direct Chat
- same-project users direct chat
- cross-project user reject
- self chat reject
- duplicate direct conversation oluşmaz

## Project Chat
- one project group per project
- all project members access
- non-members reject

## Messages
- valid message save
- blank reject
- too long reject
- sender spoof reject

## Privacy
- direct participant olmayan okuyamaz
- other project message okunamaz

## Removal
- project'ten çıkarılan user access kaybeder

## Read State
- unread count doğru
- mark read doğru

---

# 81. Tests — WebSocket

En az:

- authenticated connection
- unauthenticated connection reject
- authorized subscribe
- unauthorized conversation subscribe reject
- new message delivery
- sender spoof protection
- project group broadcast

test et.

---

# 82. Tests — Frontend

En az:

- sidebar Mesajlaşma item
- full chat open
- conversation select
- message send
- incoming message render
- unread badge
- minimize
- restore
- project change reset
- profile avatar fallback

test et.

---

# 83. E2E

Mevcut Playwright altyapısında kritik flow ekle.

## Direct Chat

```text
User A login
→ Project A
→ Mesajlaşma
→ User B
→ message gönder
→ User B
→ message görünür
```

## Project Chat

```text
Manager
→ Project Group
→ message
→ normal member
→ project chat
→ message görünür
```

## Minimize

```text
Open chat
→ minimize
→ right-bottom panel
→ navigate Tasks
→ panel remains
→ restore
→ active conversation preserved
```

## Security

```text
User outside project
→ project chat route/API
→ forbidden
```

---

# 84. Notification / Unread Regression

Chat eklendikten sonra mevcut Notification Service, navbar notification count ve invitation count bozulmamalıdır.

Chat unread count notification count ile karıştırılmamalıdır.

---

# 85. Performance

Mesaj listesinde N+1 user query üretme.

Project group'a message gönderirken her project member için ayrı DB message row oluşturma.

Tek message record + conversation yeterli olmalıdır.

---

# 86. Spring Modulith

Chat feature'ın module ownership'ini repository architecture'a göre belirle.

Ayrı `messaging` module mantıklıysa oluştur.

Başka modüllerin internal repository'lerine direkt erişme.

Project membership ve user summary için public contracts kullan.

Architecture tests geçmeli.

---

# 87. Event Kullanımı

Cross-module event gerekiyorsa immutable DTO/event kullan.

JPA entity event payload olarak taşıma.

---

# 88. Existing User/Profile Contracts

Chat participant göstermek için mevcut UserSummary/ProfilePhoto contractını reuse et.

Aynı user datasını gereksiz duplicate etme.

---

# 89. Migration

Flyway migration ekle.

Mevcut son migration numarasını bul ve doğru sırada devam et.

Eski DB'yi reset gerektiren migration yazma.

---

# 90. Final Validation

Backend:

- compile
- unit tests
- integration tests
- websocket tests
- security tests
- architecture tests

Frontend:

- lint
- type-check
- component tests
- E2E
- production build

çalıştır.

---

# 91. Görev Sonunda Teknik Rapor

Finalde aşağıdaki formatta rapor ver.

## Architecture

Chat modülünün nerede konumlandığını açıkla.

## Conversation Model

DIRECT ve PROJECT conversation mantığını açıkla.

## Project Group

Project group'un nasıl oluştuğunu ve membership davranışını açıkla.

## Direct Messaging

İki project member arasındaki direct chat mantığını açıkla.

## Real-Time

WebSocket/SSE architecture'ını açıkla.

## Security

Authorization ve IDOR korumalarını özetle.

## Fullscreen / Minimized UI

Fullscreen ve bottom-right minimized davranışını açıkla.

## Unread State

Unread count/read state modelini açıkla.

## API

Eklenen REST/WebSocket endpoint/topic'leri listele.

## Database

Migration ve tabloları belirt.

## Frontend

Yeni component/hook/provider yapılarını listele.

## Tests

Backend/frontend/E2E testlerini özetle.

## Changed Files

Önemli değiştirilen dosyaları listele.

## Build

Tüm test/build sonuçlarını yaz.

---

# Kritik Kurallar

1. Chat yalnız project scope içinde çalışmalı.
2. Global kullanıcılar arası chat oluşturma.
3. ProjectMembership authorization source of truth olmalı.
4. Kullanıcı yalnız aynı project üyeleriyle direct chat yapabilmeli.
5. User kendi kendisiyle chat açamamalı.
6. Her project'te tek project group conversation olmalı.
7. Project group membership ProjectMembership'ten türetilmeli.
8. Project'ten çıkarılan user chat erişimini kaybetmeli.
9. Direct conversation iki user arasında duplicate oluşmamalı.
10. Message sender client payload'dan güvenilir kabul edilmemeli.
11. WebSocket authentication zorunlu olmalı.
12. WebSocket subscription authorization yapılmalı.
13. Random conversation ID ile IDOR mümkün olmamalı.
14. Message content raw HTML render edilmemeli.
15. Message length backend'de validate edilmeli.
16. Message content logs'a gereksiz yazılmamalı.
17. Message history paginate edilmeli.
18. Project group için member başına duplicate message row oluşturma.
19. Existing profile photo/avatar sistemi reuse edilmeli.
20. Email chat listesinde gösterilmemeli.
21. Sidebar'a `Mesajlaşma` project item eklenmeli.
22. Chat full-screen açılmalı.
23. Full-screen chat minimize edilebilmeli.
24. Minimized chat sağ altta floating panel olmalı.
25. Minimized panel tekrar full-screen yapılabilmeli.
26. Active conversation minimize/restore sırasında korunmalı.
27. Project değişince eski chat state/subscription temizlenmeli.
28. Project context'ten çıkınca project chat leak olmamalı.
29. Existing Notification Service'i chat unread ile karıştırma.
30. Browser/push notifications V1'e ekleme.
31. File/image/audio message V1'e ekleme.
32. Message edit/delete V1'in zorunlu parçası değil.
33. Typing/online presence ana feature'ı geciktirmemeli.
34. Mevcut query/state sistemini kullan; gereksiz yeni state library ekleme.
35. Mevcut design system, theme ve i18n yapısını koru.
36. Spring Modulith sınırlarını bozma.
37. Cross-module repository access yapma.
38. Schema değişikliklerini Flyway ile yap.
39. Backend security frontend visibility'ye bırakılmamalı.
40. Full regression + build tamamlanmadan task bitmiş sayılmamalı.
