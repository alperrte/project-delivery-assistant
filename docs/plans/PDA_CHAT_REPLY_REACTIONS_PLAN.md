# PDA — Chat Navigation, Replies & Emoji Reactions Planı

Tarih: 2026-10-05. Durum: **Task 10 tamamlandı; Task 11 yürütülüyor.**

Source of truth: `.agents/PDA_Chat_Reply_Reactions_Plan_and_Implementation.md` belgesinin 1–53 bölümleri, kritik kuralları ve implementation teslim gereksinimleri. `frontend/CLAUDE.md` tamamen okundu; içerdiği `@AGENTS.md` yönlendirmesi uygulandı.

Bu dosya implementation için source of truth'tur. Tasklar sırayla uygulanır. Alt maddeler yalnız gerçek implementation/test kanıtından sonra `[x]` yapılır. Definition of Done tamamlanmadan ana task tamamlandı sayılmaz. Doğrulama kayıtları dosyanın sonunda tutulur.

## Implementation ?ncesindeki kaynak ve mimari snapshot

İncelenen branch `project-service-backend`, HEAD `5519b76`; yerel `origin/main` ile ahead/behind `0/0`. Fetch/pull yapılmadı. Başlangıçta yalnız kullanıcı prompt'u untracked idi. En yüksek mevcut migration V54; önerilen V55 numarası implementation öncesinde tekrar doğrulanmalı.

| Alan | Gerçek dosya ve mevcut davranış |
| --- | --- |
| Ownership | `frontend/src/components/layout/app-shell.tsx`: çalışma alanındaki ortak ChatProvider/ChatRoot; landing demo bağlantıyı devre dışı bırakır |
| Mode/state | `features/chat/chat-provider.tsx`, `types.ts`: `closed/full/bar/compact`; active conversation, ref tabanlı drafts, conversation bazlı outbox |
| Context sınırı | Provider ownerKey kullanıcı+seçili proje; generation/lifetime guard, cancel/remove query cleanup; aynı proje genel sayfalarda korunur |
| Navigation kök neden | Pathname yalnız proje seçimini belirliyor; aynı ownerKey'de route değişiminin `full → closed` geçişi yok |
| Focus/inert | `components/chat-root.tsx` full sırasında main'i inert yapar; hem root hem provider close focus restore eder. Navigation close için bu davranış ayrılmalı |
| Sidebar/routing | `project-sidebar-nav.tsx`, `app-shell.tsx`, `i18n/navigation.tsx`; logical pathname kullanılır. Bazı proje sekmeleri aynı pathname altında `?section=` ile değişir |
| Composer/list | `message-composer.tsx`: Enter gönderir, Shift+Enter newline, IME koruması; code point sınırı 2000. `message-list.tsx`: plain text, keyset history/scroll preservation; reply/reaction/picker yok |
| Frontend REST/cache | `api.ts`, `hooks.ts`, `cache.ts`: InfiniteData, before/after cursor; history staleTime Infinity, kendiliğinden refetch yok; append message-ID ile tekilleştirilir |
| Socket | `use-chat-socket.ts`: yalnız MESSAGE/READ parse eder; tek context, renewal sırasında 3 saniye iki subscription; provider yakın 1000 message ID ile side effect dedup yapar |
| DB/entity | `V51__project_chat.sql`, `ChatMessage.java`: conversations/messages/read_states; scalar UUID, immutable message content, reply/reaction yok |
| Backend | `ChatController`, `SendMessageRequest`, `ChatService`, `ChatViews`, `ChatResponses`: content-only send, history page 30/max100, batch sender lookup, membership + participant authorization |
| Delivery | `ChatDelivery`, `StompChatDelivery`: transaction sonrası doğrudan port çağrısı; /user/queue/chat; aktif üyelik delivery sırasında çözülür; Spring event_publication'a mesaj içeriği yazılmaz |
| Güvenlik | `SecurityBaselineConfiguration`, `ChatChannelInterceptor`, `ChatSocketRegistry`: HttpOnly session, CSRF, origin kontrolü, yalnız own queue SUBSCRIBE; client SEND yasak; session revoke/expiry cleanup |
| Mevcut testler | ChatDomainTest, ChatApiIntegrationTest, ChatWebSocketIntegrationTest, ChatSocketRegistryTest; `frontend/e2e/17-project-chat.spec.ts` |

Bu gözlemler static incelemedir; bu plan turunda testler veya runtime audit çalıştırılmadı. Eski completion sonuçları yeni özelliğin başarı kanıtı değildir.

## Kesin ürün kararları

### Navigation state machine

| Olay | full | compact | bar | closed |
| --- | --- | --- | --- | --- |
| Aynı projede çalışma alanı sayfasına navigation | **closed** | compact | bar | closed |
| X | closed | closed | closed | closed |
| Mesajlaşma action'ı | full | full | full | full |
| Proje/hesap değişimi, logout, erişim kaybı | closed + context cleanup | aynı | aynı | aynı |

Navigation full'u otomatik minimize etmez. Same-context close yalnız görünümü kapatır; konuşma seçimi, text/reply draft ve başarısız outbox mevcut session içinde korunur. Socket/unread için context yaşayabilir. Proje/hesap sınırında bunların tamamı temizlenir. Full document/locale reload persistence eklenmez.

Logical route kimliği pathname + sayfa seçen `section` değeridir; sıradan filtre/sayfalama query değişimi sayfa navigation'ıyla karıştırılmaz. Browser back/forward ve programmatic navigation kapsanır. Sidebar'da mevcut sayfayı gösterme intent'i full'u kapatabilir; Mesajlaşma düğmesi bu page-navigation handler'ını kullanmaz. Modifier/middle click/new tab ve iptal edilmiş navigation mevcut paneli kapatmamalı.

Explicit X focus'u açan kontrole döndürebilir. Navigation close eski chat trigger'ına focus çalmamalı; yeni sayfanın normal focus/scroll davranışı ve inert cleanup korunmalı. Picker Escape'i önce picker'ı, reply Escape'i sonra reply context'i kapatır; olay consumed ise ChatPanel minimize etmez. Reply/picker yokken mevcut panel Escape davranışı korunur.

### Emoji ve reply

Kullanıcı **bağımlılıksız küçük picker** seçimini onayladı. Composer için yaklaşık 24 Unicode emoji: 😀 😄 😂 🤣 😊 😍 🥳 😎 🤔 😮 😢 😭 😅 😴 👍 👎 👏 🙌 🙏 ❤️ 🔥 🎉 ✅ 🚀. Reaction için 👍 ❤️ 😂 😮 😢 🙏. Tam emoji kataloğu/skin tone picker V1 kapsamında yok; normal mesajda kullanıcı kendi Unicode metnini yapıştırabilir.

Mevcut `@base-ui/react` package export'unda `./popover` var; yeni npm picker kütüphanesi eklenmez. Paylaşılan küçük picker, iki farklı callback amacıyla kullanılır: composer insert ve reaction mutation. Seçim sonrası picker kapanır; composer seçiminde caret restore edilerek textarea'ya focus döner. Birden fazla emoji tekrar açılarak veya metinle gönderilebilir.

Reply, mevcut text message'ın opsiyonel `replyToMessageId` ilişkisidir. Aynı konuşma şarttır. Quote yalnız bir seviye gösterilir; nested reply chain fetch/render yapılmaz. Server preview mevcut 140 code point preview yaklaşımını reuse eder; tam orijinal content ayrıca response'a kopyalanmaz. Quote'a tıklayınca uzak geçmişi otomatik tarama/jump-to-message V1 kapsamına eklenmez.

Desktop Reply/React kontrolleri hover ve focus-within ile erişilir; mobile'da görünür küçük action/menu trigger kullanılır. Uzun basma zorunlu değildir; native text selection bozulmaz. Pending/unconfirmed mesaja reaction veya reply action sunulmaz.

## Hedef DB / REST / socket contract

### Schema

Önerilen `V55__chat_replies_and_reactions.sql`:

- `chat_messages.reply_to_message_id UUID NULL`.
- `chat_messages.reaction_version BIGINT NOT NULL DEFAULT 0`, nonnegative CHECK. Yalnız değişen reaction setinde artırılır; message created_at ve conversation last_message_at değişmez.
- `UNIQUE (id, conversation_id)` ve `(reply_to_message_id, conversation_id) → chat_messages(id, conversation_id)` composite FK. Aynı conversation DB düzeyinde korunur; project bunun conversation FK'sinden türetilir. Self-reply CHECK; reply UUID için non-null partial index. V1 fiziksel message delete yok; referansları silerek geçmiş kaybı oluşturulmaz.
- `chat_message_reactions(message_id UUID FK, user_id UUID, emoji_code VARCHAR(16), created_at TIMESTAMPTZ)`.
- PK `(message_id, user_id, emoji_code)`; code CHECK allowlist. Message FK ON DELETE CASCADE yalnız gelecekteki fiziksel cleanup için. User UUID mevcut chat modelindeki gibi scalar; User entity/repository bağımlılığı eklenmez.
- PK'nın message prefix'i aggregate ve actor membership sorgularını kapsar; ayrıca message_id duplicate index eklenmez. User_id standalone index ancak gerçek user bazlı sorgu ihtiyacı/ölçümle eklenir.

Emoji code enum: `THUMBS_UP`, `HEART`, `LAUGH`, `SURPRISED`, `SAD`, `THANKS`. Store/API code kullanır; canonical Unicode glyph server mapping'inden gelir. Böylece keyfi string/karmaşık Unicode reaction parser'ı ve URI glyph sorunları oluşmaz. Normal message content bu allowlist ile kısıtlanmaz.

### DTO / API

`Message` mevcut alanlarına şu alanlar eklenir:

```text
replyTo: null | { id, sender: UserSummary, preview }
reactionVersion: decimal string
reactions: [{ code, emoji, count, reactedByCurrentUser }]
```

Version wire'da decimal string; PostgreSQL BIGINT hassasiyeti JS Number dönüşümünde kaybolmaz. Frontend bounded numeric-string validation ve native BigInt constructor ile karşılaştırabilir; npm bağımlılığı veya tsconfig target değişikliği gerekmez. Eski messages `replyTo=null`, `reactions=[]`, `reactionVersion="0"`. Eski backend payload'ındaki eksik alanlar frontend normalization sınırında bu değerlere çevrilir.

Base: `/api/v1/projects/{projectId}/chat/conversations/{conversationId}`.

| Method/path | Amaç | Başarı / önemli hatalar |
| --- | --- | --- |
| POST `/messages` | `{content, replyToMessageId?: UUID}`; sender principal | 201; 400 text/UUID; 404 unknown/foreign reply; mevcut 403/429 |
| GET `/messages` | Mevcut cursor history, quote+personalized reactions | 200; mevcut access/cursor hataları |
| PUT `/messages/{messageId}/reactions/{emojiCode}` | Actor'ın reaction'ını idempotent ekle; body yok | 200 actor-personalized ReactionSnapshot; 400 code, 401/403, 404 scope, 429 |
| DELETE aynı path | Actor'ın aynı reaction'ını idempotent kaldır | 200 ReactionSnapshot; absent reaction no-op |
| GET `/messages/reactions?messageIds=...` | Reconnect/reopen için en çok 50 ID'nin personalized snapshots'ı | 200; boş/limit/invalid UUID 400; herhangi unknown/foreign ID 404 |

ReactionSnapshot: `{messageId, reactionVersion, reactions}`; son reaction silinince empty array ve **artan version** mutlaka döner. UI toggle, mevcut actor flag'ine göre PUT/DELETE seçer; network retry non-idempotent server toggle yapmaz. Aynı kullanıcı farklı code'ları aynı mesaja bırakabilir. No-op mutation version artırmaz/event üretmez; response güncel snapshot'tır.

Principal dışından actorId kabul edilmez. Her operation aktif üyelik + project/conversation + direct participant + message/conversation zincirini kontrol eder. Foreign/unknown message aynı 404 ailesini kullanır. Reaction mutation için ayrı 60 attempt/min/user V1 limiter önerilir; mevcut message limiter bütçesi tüketilmez/değişmez. Retry-After/error handler uyumu korunur; yeni ENV eklenmez. Bu değer Task 1 contract freeze'de doğrulanır.

Direct peer projeden çıkmışsa mevcut remaining participant'ın erişilebilir history'sinde reaction yapmasına izin verilir; removed peer'e push yapılmaz. Reply send mevcut peer-active send kuralını takip eder. Eski/removed-member reactions history metadata'sı olarak korunur; actor tekrar aktif olduğunda kendi reaction'ını kaldırabilir.

Personalized responses private/no-store; cookie/CSRF/CORS güvenlik modeli korunur. Yeni PUT/DELETE/GET yolları merkezi security matcher listesine açık ve dar şekilde eklenir; catch-all public izin eklenmez.

### Sorgu ve delivery tutarlılığı

History için page mesajları → distinct reply IDs batch lookup → page+quoted sender IDs tek UserAccounts lookup → tek batch reaction aggregation. Mesaj başına JPA relation veya REST fetch yok. Reaction query version + count + actor bool aggregate'lerini **aynı SQL snapshot'ında** alır; ayrı sorgularda eski version/yeni count karışımı üretilmez. Query sayısı page size 30/100 ile lineer büyümez; authorization sorguları ayrıca ölçülür.

Reaction write message row lock altında serialize olur; unique PK ikinci korumadır. Gerçek INSERT/DELETE değişikliği ile version increment aynı transaction'dadır. After-commit delivery only; rollback'ta event yok.

MESSAGE mevcut envelope içinde enriched Message taşır; reply normal unread davranışını takip eder. Yeni event:

```text
{type:"REACTIONS", projectId, conversationId, messageId,
 reactionVersion, reactions:[{code,emoji,count,reactedByCurrentUser}]}
```

**reactedByCurrentUser ortak payload olarak herkese gönderilemez.** Delivery aktif recipients'ı mevcut ProjectAccess modeliyle çözer. Uygulama katmanındaki snapshot reader tek SQL ile güncel version/count ve yalnız recipient IDs için actor membership bilgisini batch alır; bu server-içi veri wire'a reactor listesi olarak çıkarılmaz. Her recipient'ın altı flag'i memory'de hazırlanır; recipient başına DB sorgusu yapılmaz. Geç kalmış after-commit callback daha yeni snapshot okuyabilir; snapshot version ile count/mine aynı SQL'den geldiği için tutarlı kalır. Aynı version tekrar delivery edilebilir; client bunu idempotent işler.

Counter delta `+1/-1` event'i kullanılmaz. Client, loaded message için yalnız daha yeni snapshot'ı uygular. REST response ve WS aynı version ise ikinci uygulama etkisizdir. MESSAGE ID dedup ayrı kalır; reaction bir message'ın unread/lastMessage/cursor/read marker'ını güncellemez. Notification Service veya ikinci socket yok. Mevcut 16 KB frame limit'i yeni payload'ın worst-case UTF-8 boyutuyla test edilir.

Socket kopukken eski mesajlara gelen reactions `after=newestMessageId` catch-up ile yakalanmaz. Bu nedenle reconnect ve cached conversation reopen'da loaded message IDs için 50'lik batch snapshot sorguları, sınırlı concurrency ile çalışır. Çıkmış context'in response'u lifetime guard ile atılır; arada gelen daha yeni WS snapshot'ı eski REST overwrite edemez. Henüz MESSAGE gelmeden gelen REACTIONS için bounded, generation-scoped kısa buffer kullanılır; message yüklenince en yeni snapshot uygulanır, unloaded conversation için fake message oluşturulmaz. Buffer limitine ulaşıldığında reopen resync doğruluğu geri getirir.

Mevcut delivery/member listing 100×10 page sınırı static kodda görülüyor. Bu plan bunu sınırsız ölçek garantisi saymaz; batch hesaplamalar bu mevcut sınırla test edilir, üst sınırın genişletilmesi ayrı kapsamdır.

## Dependency / implementation sırası

```text
Task 1 Contract freeze
  → Task 2 Merkezi navigation (backend'e bağımlı değil)
  → Task 3 Schema/domain
  → Task 4 REST/auth/batch persistence
  → Task 5 WebSocket delivery
  → Task 6 Frontend wire/cache/state
  → Task 7 Reply UI
  → Task 8 Reaction + shared emoji picker UI
  → Task 9 Uçtan uca/security/performance/UX doğrulaması
  → Task 10 Full gate + belgeler + teslim
```

Navigation bağımsız mevcut bug olduğu için önce tamamlanabilir. Reply/reaction UI, DB/REST/socket contract ve cache güvenliği tamamlanmadan başlamaz. Paylaşılan picker composer/reaction farklı callback'lerini birlikte kapsar. Her task kendi testlerini geçerek sonraki taska geçer.

## Task 1 — Implementation preflight ve contract freeze

**Amaç/sıra:** Yukarıdaki kararları güncel kaynakla sabitle; prerequisite yok.

**Dosyalar:** Bu plan, chat source/test dosyaları, migration listesi, SECURITY/API/database/frontend rehberleri.

**Etkiler:** Bu task production backend/DB/frontend/socket kodu değiştirmez. Scope/authorization, emoji allowlist, version ve cache semantics'in implementation sözleşmesini sabitler.

- [x] 1.1 HEAD/branch/index/worktree snapshot al; kullanıcı dosyalarını koru. Planın hazırlandığı HEAD ile değişen kaynakları karşılaştır.
- [x] 1.2 V55 numarasının boş olduğunu doğrula; başka migration geldiyse bir sonraki boş sürümü kullan, eski migration'ı değiştirme.
- [x] 1.3 Navigation intent/routeKey/closeReason, reply draft ömrü, reaction limiter ve canonical codes kararlarını doğrula.
- [x] 1.4 Batch history ve per-recipient snapshot SQL stratejisini, error/status/cache headers ve event union'u somutlaştır.
- [x] 1.5 Kalan braces debt notunu kullanıcıya hatırlat; picker için yeni paket ekleme. Güvenlik/ENV değişikliği ihtiyacı doğarsa somut değişikliği ayrıca onaya sun.

### Definition of Done

- [x] Endpoint/DTO/migration/event contract'ında implementation'ı engelleyen belirsizlik yok; zorunlu karar değişikliği kullanıcıyla çözüldü.
- [x] Tests/runtime/source sınırları ve Git snapshot kaydedildi; feature tamamlandı iddiası yapılmadı.

## Task 2 — Merkezi fullscreen navigation state semantics

**Amaç/sıra:** Full overlay yeni sayfayı engellemesin; prerequisite Task 1.

**Dosyalar:** `chat-provider.tsx`, `types.ts`, `components/chat-root.tsx`, `app-shell.tsx`, `project-sidebar-nav.tsx`, workspace link helper gerekirse; `17-project-chat.spec.ts`, yeni navigation spec. `i18n/navigation.tsx` locale davranışı korunur.

**Backend/DB/WS/security:** Yeni backend/schema yok. Socket context ömrü ve membership/generation güvenliği sürer. **Cache/state:** aynı owner'da yalnız full görünümü kapat; draft/active/outbox korunur; owner değişimi mevcut cleanup.

- [x] 2.1 Reducer/policy için page-navigation action ekle: full→closed, diğer modes sabit.
- [x] 2.2 Logical pathname+section observer ile back/forward/programmatic değişimleri kapsa; ilk mount/hydration'da gereksiz close üretme.
- [x] 2.3 Sidebar page intent ile chat-open action'ını ayır; same-page page intent, collapsed/mobile sidebar, modifier/new tab/aborted navigation davranışlarını doğrula.
- [x] 2.4 Route transition'da overlay/inert yeni sayfada bir frame kalmasın; closeReason navigation eski trigger'a focus çalmasın. Provider/root çift focus restore'u birlikte incele.
- [x] 2.5 Eski full persistence E2E beklentilerini yeni matrix'e güncelle; compact/bar persistence testlerini koru. X sonrası yeniden açılmama, incoming unread/read timer ve A→B→A sınırlarını test et.

### Definition of Done

- [x] Tasks/Calendar/global workspace/section navigation'da full kapalı; compact/bar aynı projede açık; X kapalı kalır.
- [x] Navigation minimize etmez; yeni sayfa etkileşebilir/focus doğru; chat action yeniden açar.
- [x] Account/project cleanup, disabled landing demo ve mevcut socket/unread regresyonları hedefli testlerden geçti.

## Task 3 — Reply/reaction schema ve domain foundation

**Amaç/sıra:** DB gerçek persistence ve integrity sağlayacak; prerequisite Task 2.

**Dosyalar:** yeni V55 migration; `ChatMessage.java`, yeni reaction entity/code enum; repository mapping; ChatDomainTest ve yeni ChatReplyReactionMigrationTest. API/frontend/socket contract bu aşamada genişletilmez; eski factory çağrıları default null/0 ile çalışır.

**Security/cache:** Composite FK scope korur; principal actor kontrolü Task 4'te. User entity ilişkisi yok. **Edge cases:** legacy rows, Unicode, self/foreign reply, duplicate reaction, son reaction removal, fiziksel cleanup constraints.

- [x] 3.1 Yukarıdaki additive migration/PK/FK/CHECK/index'leri oluştur; V51/V54'ü değiştirme.
- [x] 3.2 Scalar reply ID ve reaction version mapping'i; mevcut message immutable content/time ve cursor mikro-saniye davranışını koru.
- [x] 3.3 Reaction code allowlist ve canonical glyph mapping'i ekle; message normalization tüm Unicode metinler için mevcut davranışta kalsın.
- [x] 3.4 PostgreSQL migration testinde eski mesajlardan round-trip, null quote/zero version, cross-conversation/self FK ve duplicate PK reddini doğrula.

### Definition of Done

- [x] Migration boş/legacy DB üzerinde çalıştı; entity validate/round-trip başarılı; eski messages bozulmadı.
- [x] Domain/migration testleri geçti; indekslerin gerçek query ihtiyacı açıklanmış, duplicate indeks yok.

## Task 4 — REST, scoped persistence ve batch view builder

**Amaç/sıra:** UI/WS gerçek server contract'a dayanacak; prerequisite Task 3.

**Dosyalar:** SendMessageRequest, ChatController, ChatApiErrorHandler, ChatService veya ayrılan ChatReactionService/ViewReader, ChatViews/ChatResponses, message/reaction repositories, ayrı reaction limiter, SecurityBaselineConfiguration; ChatApiIntegrationTest ve repository/concurrency tests.

**DB:** Task 3 schema kullanılır. **Frontend:** Kod yok. **WS:** mevcut MESSAGE response mapper'ı quote alanlarını taşıyabilir; REACTIONS event Task 5. **Security:** deny-by-default exact mappings, cookie/CSRF, active member/direct participant; actor spoof/cross-scope no-op değil reject.

- [x] 4.1 Send'e optional reply ID ve uniform missing/foreign target kontrolü ekle; scoped lookup + composite FK, normal send limiter/peer rule korunur.
- [x] 4.2 History/send reply summary + versioned reaction DTO builder'ı batch olarak uygula; quoted sender lookup union ve inactive nickname fallback.
- [x] 4.3 İdempotent PUT/DELETE: message row lock, gerçek değişiklikte version increment; unique PK ve no-op response semantics.
- [x] 4.4 Tek SQL snapshot aggregate ile count/version/mine tutarlılığı; batch query endpoint max50 UUID ve foreign/missing bütün-set doğrulaması.
- [x] 4.5 Ayrı reaction attempt limiter ve 429/Retry-After; mevcut message bütçesini değiştirme. Mutasyonlar reject olduğunda DB/versiyon değişmesin.
- [x] 4.6 Aynı/foreign conversation/project, non-member/removed/ADMIN bypass yok, CSRF, invalid emoji/UUID, own-only DELETE, multiple emojis, concurrent duplicate/add-remove ve old request tests.
- [x] 4.7 History 30 ve 100 mesaj için query sayısını ölç; per-message/per-reactor lookup yok; fresh DB transaction üzerinden persistence doğrula.

### Definition of Done

- [x] Gerçek PostgreSQL/API round-trip, scoped authorization ve concurrency testleri başarılı.
- [x] Yeni message ile eski text API uyumlu; history/overview/read/cursor/limiter bozulmadı.
- [x] Endpoint request/response/status/header/error contract ve batch performance kanıtı hazır.

## Task 5 — After-commit WebSocket reaction delivery

**Amaç/sıra:** Cache/UI'ye doğru kişiselleştirilmiş real-time veri; prerequisite Task 4.

**Dosyalar:** ChatDelivery, StompChatDelivery, snapshot reader, ChatWebSocketIntegrationTest; mevcut handshake/channel/socket registry testleri. DB yalnız var olan schema; frontend consumer Task 6.

**Security:** Mevcut own queue ve session/origin/SEND yasağı; recipient resolution mevcut ProjectAccess. **State/cache:** absolute snapshots, reaction unread değil. **Edge cases:** rollback, commit-order inversion, empty snapshot, multi-tab, removed receiver, group cap, frame size.

- [x] 5.1 ReactionChanged immutable scope/ID port event'i; directParticipants/current group audience; afterCommit çağrısı. Spring publication registry veya Notification Service kullanma.
- [x] 5.2 Aynı SQL'den current version/count ve recipient membership bilgisi batch al; payload'ı her recipient için memory'de kişiselleştir; birinin mine flag'ini diğerine gönderme.
- [x] 5.3 MESSAGE quote taşır; REACTIONS event'in add/remove/no-op/rollback semantics'ini uygula. No-op event üretmez.
- [x] 5.4 Gerçek iki/üç kullanıcı ve çoklu socket testleri: own flags/counts, removed-member isolation, out-of-order delivery, last-remove empty list, group/direct ve UTF-8 16KB budget.
- [x] 5.5 Session expiry/revoke, heartbeat, forbidden subscribe/SEND ve mevcut delivery tests'ini yeniden çalıştır.

### Definition of Done

- [x] Reload olmadan reply/add/remove doğru; rollback/unauthorized/no-op yanlış event üretmiyor.
- [x] Count/mine/version tutarlı; recipient başına SQL yok; mevcut socket güvenliği geçti.

## Task 6 — Frontend types, cache, draft/outbox ve reconnect

**Amaç/sıra:** UI kurmadan önce verinin doğru yaşam döngüsü; prerequisite Task 5.

**Dosyalar:** chat types/api/cache/hooks/provider/use-chat-socket/limits; cache ve socket testleri. Backend/DB yeni değişiklik gerektirmez. **Security:** owner/generation, scoped IDs, stale promise guards ve malformed-event validation.

- [x] 6.1 MESSAGE/READ/REACTIONS discriminated union; required/optional wire normalization ve code/version/count/mine validation.
- [x] 6.2 Targeted message metadata patch helper: InfiniteData'nın tüm loaded pages'ında yalnız target ID; daha eski/eşit version effectsiz, empty snapshot temizler. MESSAGE/REST geç gelen metadata yeni reaction snapshot'ını overwrite etmesin.
- [x] 6.3 REACTIONS branch MESSAGE side effects'ine düşmesin: unread/overview/lastMessage/outboxConsume/read state değişmez. Mevcut 1000 message-ID dedup ve generation guard korunur.
- [x] 6.4 Reconnect/cached reopen batch snapshot resync; loaded IDs chunk50, bounded concurrency/cancellation. Yeni message catch-up ayrı devam eder; history'yi komple refetch etme.
- [x] 6.5 Reaction-before-MESSAGE bounded buffer; project/account reset'te temizle; stale REST/WS/version tests.
- [x] 6.6 Conversation draft'a immutable reply context ekle. PendingMessage retry için reply target/preview snapshot taşısın; outbox content eşlemesi quote ID'yi de dikkate alsın. REST clientId confirmation korunur; HTTP send idempotency varmış gibi yeni garanti verme.
- [x] 6.7 Mutation pending flags ve response/error'lar generation-scoped; aynı message+code request serialize edilir, başka code bağımsızdır.

### Definition of Done

- [x] Duplicate overlap/reordered REST-WS/empty removal/missed reconnect ve stale-context senaryoları cache testlerinden geçti.
- [x] Reaction hiçbir unread artışı veya phantom message üretmiyor; reply send/retry target'ını kaybetmiyor.
- [x] Lint/type-check geçti; yeni npm bağımlılığı yok.

## Task 7 — Reply actions, composer context ve quoted bubbles

**Amaç/sıra:** Gerçek backend reply uçtan uca kullanılabilir; prerequisite Task 6.

**Dosyalar:** message-list, message-composer, conversation-view, küçük message-actions/reply-preview components; TR/EN/DE chat/errors katalogları; reply E2E. Backend/DB/socket Task 4–6 contract'ını kullanır.

**Cache/state/security:** confirmed target, same-conversation draft, one-level plain-text quote, no extra fetch; project/account sınırı korunur. **Edge cases:** quote target older page, reply-to-reply, inactive sender, failed send/retry, draft switch, picker/panel Escape priority.

- [x] 7.1 Desktop hover/focus-within ve mobile action trigger; own/other bubble positioning, touch/keyboard/aria/tooltip.
- [x] 7.2 Composer üstünde sender+bounded preview+cancel; X yalnız reply'ı iptal eder, text korunur. Escape consumed olduğunda panel minimize olmaz.
- [x] 7.3 Send/retry optional reply ID gönderir; gönderim kabul edilince yalnız ilgili draft temizlenir, pending snapshot taşınır.
- [x] 7.4 Quote+actual reply bubble, unavailable defensive fallback, inactive nickname fallback; markup render etme veya quoted message için ayrı request atma.
- [x] 7.5 Gerçek A gönderir/B reply eder/A WS ile quote görür/reload DB history; farklı target aynı text/outbox ve pagination testleri.

### Definition of Done

- [x] Reply local-only değil; gerçek REST/DB/WS kanıtlı; cancelled/failed/retry/switch davranışı doğru.
- [x] TR/EN/DE, light/dark, keyboard/mobile ve quote sınırı doğrulandı; existing message bubble/scroll/read bozulmadı.

## Task 8 — Shared emoji picker, reactions UI ve normal emoji mesajı

**Amaç/sıra:** İki emoji kullanımını aynı küçük primitive ile doğru server yollarına bağla; prerequisite Task 7.

**Dosyalar:** emoji-picker/catalog, message-actions, reaction-chips, composer/list/view; gerekirse yerel Base UI popover wrapper; TR/EN/DE katalogları/E2E. Backend/DB yeni schema yok; yeni npm yok.

**State/cache:** server response ve versioned WS snapshot source of truth; fake success veya additive count optimistic patch yok. **Security/UX:** canonical six reaction code, principal-owned mutation; message content normal Unicode.

- [x] 8.1 Composer 24 ve reaction 6 glyph katalogları; mevcut Base UI popover/portal ile token stilleri, 44px touch hedefi, viewport clipping ve z-index.
- [x] 8.2 Composer selectionStart/End UTF-16 caret ile insert/selection replace; code point counter/2000 limit, IME, disabled state, Enter/Shift+Enter korunur; focus/caret restore.
- [x] 8.3 Reaction chips aggregate count/mine/aria-pressed; click PUT/DELETE, aynı code pending'de ikinci dispatch yok; farklı codes ve çoklu kullanıcı count'u.
- [x] 8.4 Popover Tab/Enter/Space/Escape/dismiss/focus restore; focus-within hover controls, mobile visible menu trigger. Keyboard hareket için gerçek semantic button group kullan; eksik grid keyboard modeliyle role=grid verme.
- [x] 8.5 Gerçek iki kullanıcı add/remove/multiple emojis/multi-tab/reload; composer 😂❤️ normal POST/message/unread/history testleri. Error/offline state yanlış success göstermesin.

### Definition of Done

- [x] Emoji message ile reaction ayrı API/state yollarında; persistence ve real-time kanıtlı.
- [x] Light/dark/compact/full/mobile picker/chips taşmıyor, reply textarea'yı kullanılmaz yapmıyor.
- [x] Üç dil, accessible labels/focus ve existing local shadcn-compat varyantları korunuyor; dependency tree büyümedi.

## Task 9 — Birleşik security, UI ve performans regresyonu

**Amaç/sıra:** Özellik birleşiminde kalan riskleri kapat; prerequisite Task 8.

**Dosyalar:** Chat backend/socket/migration testleri, `17-project-chat.spec.ts`, yeni reply/reaction/navigation specs; gerekirse yalnız bu kapsam bug fix'leri. DB/WS/frontend etkileri yukarıdaki contract'la sınırlı.

- [x] 9.1 Navigation matrix: Tasks/Calendar/Organizations/Projects/Settings, query-section/same intent, modifier/aborted/back-forward, X/reopen, compact/bar draft-reply preservation.
- [x] 9.2 Gerçek iki kullanıcı reply/react/emoji send+reload; normal başarılı yollarda route.fulfill kullanma. Hata injection fixture'larını ayrı TEST-ONLY olarak raporla.
- [x] 9.3 Foreign project/conversation/message, removed member/disabled account, active DIRECT participant, invalid code/UUID, CSRF, own-only delete, readonly historical state ve rate limiter.
- [x] 9.4 Gerçek renewal sırasında iki subscribed socket'e tek message/reaction: reply unread bir, reaction unread sıfır; counts/version/flags doğru. Session revoke/project switch/A→B→A/late response cleanup.
- [x] 9.5 320/390/768/1440px, light/dark, hareket kapalı/reduced-motion mevcut tercih, keyboard/touch, overlays/inert/focus ve chips wrap; screenshot incele.
- [x] 9.6 History query count 30/100 sabit, per-message REST yok; reaction mutation full history reload yok, batched reconnect ve per-recipient delivery SQL bounded.
- [x] 9.7 Existing group/direct/history/pagination/read/unread/outbox/selection/token refresh ve disabled landing demo regresyonları; QA kaynakları temizlenirken kullanıcı kayıtlarına dokunma.

### Definition of Done

- [x] Backend/DB/WS ve hedefli gerçek Chromium senaryoları başarılı; test adı/komut/exit/source/artifact kanıtları kaydedildi.
- [x] Bulunan kapsam bug'ları giderildi; çözülmeyen blocker açıkça kayıtlıysa task tamamlandı işaretlenmedi.

## Task 10 — Full gate, belgeler ve teslim

**Amaç/sıra:** Bütün tasklar doğrulandıktan sonra final kalite kapısı; prerequisite Task 9.

**Dosyalar:** Plan checkbox'ları; SECURITY §11 endpoint tablosu, api/database/architecture/folder/frontend-design notları, yalnız etkilenen web checklist maddeleri; `docs/compliation/YYYY-MM-DD-chat-replies-reactions.md` ve README biçimi. Production fix gerekiyorsa ilgili taska geri dön ve yeniden doğrula.

- [x] 10.1 Backend testleri/DB migration/WS integration, frontend lint/type/build, hedefli ve full Chromium paketini güncel kaynak üzerinde çalıştır.
- [x] 10.2 Root ` .\pre-push\pre-push.cmd` çalıştır: Maven clean verify, lint/type/build, tüm E2E, Docker build/start/health. Eski frontend/backend imajı başarı kanıtı sayılmaz; QA başında güncel backend hazır olsun.
- [x] 10.3 Servis/port çatışmasında yalnız doğrulanan proje sürecini ele al; gerekli izin varsa geçici durdur/restore et. ENV/secrets veya rate-limit/security gevşetme; bağımsız koşumlarda yerel backend restart mevcut bütçeyi sıfırlayabilir.
- [x] 10.4 Testcontainers disabledWithoutDocker SKIP'lerini PASS sayma. Expected production crash-route skip ile runtime engelini ayır. Kalan npm advisory borcunu ayrı raporla; audit mevcut gate'e sessizce eklenmesin.
- [x] 10.5 Endpoint method/path/auth/scope/body/status/errors ve Swagger kontrol yolunu completion'a ekle; güvenli örnekler kullan, auth cookies/trace/secrets publish etme.
- [x] 10.6 UI/state/schema/socket kaynaklarına göre dokümanları güncelle; checklist global maddelerini kısmi kanıtla `[x]` yapma.
- [x] 10.7 Son Git diff/index/source kontrolü; commit/push yok. Finalde checklist, DB/API, reply/reaction/emoji/navigation/WS/security, changed files/tests/remaining issues ver.

### Definition of Done

- [x] Full gate PASSED ve tüm zorunlu testler geçerli ortamda geçti; release/dependency sınırları açık.
- [x] Her önceki task DoD ve alt checkbox kanıtla tamamlandı; completion ve manuel kontrol adımları hazır.
- [x] Yalnız gerçekten blocker yoksa `Kalan blocker yok.` yazıldı; kullanıcıya completion yolu ve commitlenmemiş kapsam açıklandı.

## Validation komut planı

Host JDK/Maven/Docker ve gerçek test altyapısı doğrulandıktan sonra; çalıştırılmamış komutlar PASS sayılmaz:

```powershell
Push-Location backend
.\mvnw.cmd '-Dtest=ChatDomainTest,ChatReplyReactionMigrationTest,ChatApiIntegrationTest,ChatWebSocketIntegrationTest,ChatSocketRegistryTest' test
Pop-Location

Push-Location frontend
npm.cmd run lint
npx.cmd tsc --noEmit
npm.cmd run build
npx.cmd playwright test e2e/17-project-chat.spec.ts e2e/chat-replies-reactions.spec.ts e2e/chat-navigation.spec.ts --project=chromium
npx.cmd playwright test --project=chromium
Pop-Location

.\pre-push\pre-push.cmd
```

Yeni test dosyaları implementation sırasında oluşturulur; source'un kullandığı test isimleriyle komut listesi güncellenir. Docker socket/yeni ortam izni gerekiyorsa implementation aşamasında somut işlemle ayrıca sunulur.

## Kaynak prompt kapsam eşlemesi

| Prompt bölümleri | Plan |
| --- | --- |
| 1–6, 36 | State matrix, root cause, Task 2/9 |
| 7–11, 29–31, 39 | Onaylı picker kararı, Task 7/8/9 |
| 12–16, 24, 37 | Reply contract/schema/batch DTO, Task 3–7/9 |
| 17–23, 25–28, 38 | Reaction schema/idempotence/auth/versioned recipient snapshots, Task 3–6/8/9 |
| 32–35, 40–43 | Constraints/indexes/backward compatibility/SQL/WS/cache tests, Task 3–6/9 |
| 44–49 | TR/EN/DE, a11y/theme/mobile, Notification yok, existing regressions, Task 7–10 |
| 50–53 + kritik kurallar + implementation teslimi | Sıralı dependency graph, her task alanları/DoD, Git güvenliği, Task 1/10 |

## İlk plan tesliminin sınırı (tarihsel kayıt)

Bu dosya yalnız plan teslimidir. Production kodu, migration, test/config veya servis değiştirilmedi; testler çalıştırılmadı, feature completion kaydı oluşturulmadı. Sadece plan dosyası oluşturuldu. Yeni soru/bloker doğarsa implementation'ın ilgili bağımlı adımı bekler; bağımsız işleri yürütmek tamamlanmamış taskı `[x]` yapma gerekçesi değildir.

### Task 1 doğrulama kaydı

HEAD 5519b76 ve kullanıcı/index snapshot doğrulandı; V55 boş. Enum, limiter 60/min, scoped API ve tek-SQL personalized/versioned snapshot sözleşmesi plandaki biçimiyle sabitlendi. Backend/frontend runtime değişikliği yok; preflight statik doğrulama tamamlandı.

### Task 2 doğrulama kaydı

Lint/type/build exit 0; chat + landing real UI 26 passed. Modifier/new-tab, cancelled click, section/same-page, back-forward, collapsed and mobile boundaries 3 passed. Full closed without bar; compact/draft and owner/socket isolation preserved.

### Task 3 doğrulama kaydı

PostgreSQL V54→V55 integrity/legacy/cascade test, domain and existing API entity compatibility: 42 passed, 0 fail/error/skip; Maven BUILD SUCCESS.

### Task 4 doğrulama kaydı

48 domain/migration/API tests passed; final scoped REST/security package 32 passed, 0 failures/errors/skips. Concurrent version/count/mine reads and 30/100 query-count tests passed; real ADMIN without membership denied.

### Task 5 doğrulama kaydı

55 API/WebSocket/session tests passed, no failures/errors/skips. Real overlap sockets, personalized flags, same-SQL batch delivery, stale callback, empty removal, rollback, removed recipients, direct privacy and UTF-8 frame budget verified.

### Task 6 doğrulama kaydı

6 meaningful cache/protocol/outbox/resync tests passed, lint and TypeScript exit 0. Bigint ordering, duplicate/empty snapshots, bounded pre-MESSAGE buffer, global concurrency2/chunk50 and stale owner/REST guards verified; mutation signals follow owner lifetime.

### Task 7 doğrulama kaydı

Lint/type/build passed; updated V55 backend and 31 real chat/reply/cache tests passed. Group/direct reply WS + reload, canceled reply/text preservation, failed retry target and TR/EN/DE mobile/compact/navigation verified.

### Task 8 doğrulama kaydı

35 chat/reply/reaction/emoji/cache tests passed; locale-focused 14 passed. Real server/WS add/remove/mine/count/reload/no-unread, Unicode/caret/IME-preserving input, keyboard Escape/focus, failure without fake chips and TR/EN/DE mobile themes verified; no npm changes.

### Task 9 doğrulama kaydı

71 backend testi (0 fail/error/skip), 57 birleşik Chromium testi; ekran görüntüsü animasyon sonu doğrulaması için ek responsive koşumu 1 passed. Gerçek iki socket reaction delivery, cached reopen ve gerçek socket reconnect batch-resync, 320/390/768/1440 light/dark, hareket kapalı, keyboard, navigation ve account/project boundary kontrolleri başarılı. task9-junit-summary.json, task9-final-ui.log, task9-screens-ui.log ve screens/ kanıtları.

### Task 10 doğrulama kaydı

Canonical pre-push PASSED exit0: Maven clean verify459 (0 fail/error/skip), lint/TypeScript/production build, full Chromium225 passed + 1 expected production skip, Docker build/start/health. Bağımsız full Chromium225+1 skip; final IME/Shift+Enter/caret/2000-code-point probe PASS. Runtime V55 success; Swagger reaction PUT/DELETE/GET ve enriched Message schema GET200. Belgeler/checklist/completion güncel; index/HEAD/package/lock/tsconfig/Compose/ENV example değişmedi. Backend health200 ve önceki Next dev3000 geri başlatıldı200. Mevcut npm dev5 high debt ayrı, production0; yeni paket yok. Kalan blocker yok.

## Final implementation teslimi

Task 1?10 ve DoD tamamland?; [completion kayd?](docs/compliation/2026-10-05-chat-replies-reactions.md) endpoint matrisi, de?i?en dosyalar, ger?ek test sonu?lar?, a??k V1 s?n?rlar? ve manuel kontrol ad?mlar?n? i?erir. Full gate exit0; commit/push/staging yok.
