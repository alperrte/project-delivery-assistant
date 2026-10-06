# Chat Navigation, Replies & Emoji Reactions

## Teslim ve durum

2026-10-05. [Source of truth plan](../../PDA_CHAT_REPLY_REACTIONS_PLAN.md) Task 1–10 sırasıyla uygulandı; her task implementation → hedefli doğrulama → DoD → checkbox sırasıyla kapatıldı. Başlangıç ve final branch `project-service-backend`, HEAD `5519b76`; index değişmedi. Commit, push, staging, pull veya merge yapılmadı. Kullanıcının prompt dosyası korundu.

Full gate **PASSED, exit 0**: 459 backend testi, 225 Chromium testi, 1 expected production skip; lint, TypeScript, production build, Docker build/start ve health başarılı. Backend güncel V55 ile healthy; önceki Next dev sunucusu yeniden başlatıldı.

## Yapılanlar ve önemli dosyalar

- Navigation: aynı proje çalışma alanında kabul edilen page navigation `full → closed`; otomatik minimize yok. `bar/compact`, konuşma, text/reply draft ve failed outbox korunur. Logical pathname + section, same-page sidebar intent, back/forward ve programmatic navigation kapsanır. Modifier/new-tab ve iptal edilen navigation kapatmaz. Navigation eski trigger'a focus çalmaz; inert layout cleanup ile kalkar. [Provider](../../frontend/src/features/chat/chat-provider.tsx), [WorkspaceLink](../../frontend/src/components/layout/workspace-link.tsx), [ChatRoot](../../frontend/src/features/chat/components/chat-root.tsx).
- DB: additive [V55](../../backend/src/main/resources/db/migration/V55__chat_replies_and_reactions.sql); nullable same-conversation reply composite FK/self CHECK, nonnegative BIGINT version, altı canonical code ve actor-owned reaction PK. V51/V54 değiştirilmedi; eski mesajlar null quote / version0 / empty reactions ile çalışır.
- REST: [ChatService](../../backend/src/main/java/com/pda/chat/application/service/ChatService.java) batch quote/sender/history builder; [ChatReactionService](../../backend/src/main/java/com/pda/chat/application/service/ChatReactionService.java) row lock + idempotent insert/delete + yalnız değişimde version increment. [Repository](../../backend/src/main/java/com/pda/chat/infrastructure/repository/ChatReactionRepository.java) **version/count/mine tek SQL snapshot**; [Reader](../../backend/src/main/java/com/pda/chat/application/service/ChatReactionViewReader.java) personalized response ve after-commit fresh transaction.
- WS: [StompChatDelivery](../../backend/src/main/java/com/pda/chat/infrastructure/websocket/StompChatDelivery.java) aktif audience için bir batch SQL, alıcı başına memory personalization. REACTIONS absolute snapshot'tır; unread, cursor, lastMessage ve read state değişmez. No-op/rollback event üretmez; Notification/Spring publication registry kullanılmaz.
- Frontend: [cache](../../frontend/src/features/chat/cache.ts) yalnız target mesaj ve daha yeni version uygular; empty snapshot temizler, geç MESSAGE yeni reaction metadata'yı ezmez. [resync](../../frontend/src/features/chat/reaction-resync.ts) reconnect/cached reopen için loaded IDs chunk50 ve **tüm konuşmalar için shared concurrency2**; generation/abort guard. [buffer/parser](../../frontend/src/features/chat/reactions.ts) 1000-entry/120-second pre-MESSAGE buffer ve bounded validation; fake message oluşturmaz.
- UI: [ReplyPreview](../../frontend/src/features/chat/components/reply-preview.tsx), [MessageActions](../../frontend/src/features/chat/components/message-actions.tsx), [ReactionChips](../../frontend/src/features/chat/components/reaction-chips.tsx), [EmojiPicker](../../frontend/src/features/chat/components/emoji-picker.tsx), [composer](../../frontend/src/features/chat/components/message-composer.tsx). Tek seviyeli plain-text quote, iptal edilebilir reply context, immutable retry target; desktop hover/focus ve mobile kontroller. Mevcut Base UI ile composer24/reaction6 emoji; yeni npm paketi yok. Native button group, caret/selection restore, Unicode code-point sınırı, Escape önceliği picker → reply → panel. Server snapshot esas; optimistic additive count veya sahte başarı yok.
- TR/EN/DE chat/error katalogları, API/database/security/architecture/folder/design belgeleri ve yalnız etkilenen web checklist notu güncellendi.

## API ve Swagger

Base: `/api/v1/projects/{projectId}/chat/conversations/{conversationId}`. Her yol mevcut cookie session ister (`401` geçersiz/eksik). Her operation aktif proje üyeliği + scoped conversation/direct participant kontrolü yapar; ADMIN bypass yok. Foreign/unknown target aynı `404 CHAT_NOT_FOUND` ailesi. Principal dışından sender/actor alınmaz. Mutasyonlarda mevcut CSRF zorunlu (`403` eksik); cookie/CORS/origin/session/ENV politikası değişmedi.

| Method / suffix | Request | Başarı | Önemli hatalar |
| --- | --- | --- | --- |
| POST `/messages` | `{content, replyToMessageId?: UUID}`; text≤2000 code points, target aynı conversation | `201` enriched Message; private/no-store | `400` text/UUID; `404` target veya inactive direct peer (`CHAT_RECIPIENT`); mevcut send `429`, Retry-After60 |
| GET `/messages?before&after&limit` | Mevcut cursor; default30/max100 | `200 {messages,hasMore}`; quote + personalized reactions; private/no-store | `400` invalid/foreign cursor veya iki cursor; `403/404` scope |
| PUT `/messages/{messageId}/reactions/{emojiCode}` | Body yok; canonical code | `200` actor-personalized snapshot; idempotent; private/no-store | `400 CHAT_REACTION_INVALID`, `403/404`, `429 CHAT_REACTION_RATE_LIMITED`, Retry-After60 |
| DELETE aynı path | Body yok; yalnız own same-code reaction | `200` current snapshot; absent=no-op; last remove empty+new version | PUT ile aynı |
| GET `/messages/reactions?messageIds=...` | 1..50 UUID; repeated/comma query; tümü aynı conversation | `200` personalized snapshot array; private/no-store | empty/limit/malformed UUID `400`; herhangi foreign/missing ID bütün batch `404` |

Codes: `THUMBS_UP`, `HEART`, `LAUGH`, `SURPRISED`, `SAD`, `THANKS`. Reaction bağımsız V1 quota60 valid-code mutation attempt/min/user (no-op dahil), bounded map; message quota değişmedi, yeni ENV yok. Removed peer'in accessible direct history'sinde kalan aktif participant reaction yapabilir; reply send mevcut peer-active şartını korur. Silme başka actor'ın reaction'ını silemez.

Güvenli örnek: `{"content":"Thanks for the update","replyToMessageId":"00000000-0000-0000-0000-000000000001"}`; örnek UUID gerçek aynı-conversation target ile değiştirilir. Message ek alanları: `replyTo: null | {id,sender,preview}` (preview140 code points), `reactionVersion` **decimal string**, `reactions: [{code,emoji,count,reactedByCurrentUser}]`. Snapshot: `{messageId,reactionVersion,reactions}`. WS: `{type:"REACTIONS",projectId,conversationId,messageId,reactionVersion,reactions}`. Reactor listesi/e-posta paylaşılmaz. Eski wire payload frontend sınırında null/0/[] ile normalize edilir.

Mevcut runtime `/v3/api-docs` GET200; iki reaction path, PUT/DELETE/GET mappings ve yeni message schema alanları doğrulandı. Manuel Swagger: `http://localhost:8080/swagger-ui/index.html`, mevcut login/CSRF akışı. Docs açmak için ENV değiştirilmedi. Tam yetki/sözleşme [SECURITY §11](../../.agents/SECURITY.md#11-api-and-swagger-security).

## Doğrulama

| Komut / kontrol | Sonuç |
| --- | --- |
| `backend/mvnw.cmd -Dtest=ChatDomainTest,ChatReplyReactionMigrationTest,ChatApiIntegrationTest,ChatWebSocketIntegrationTest,ChatSocketRegistryTest test` | Task9: 71 passed, fail/error/skip0, exit0 |
| `npm.cmd run lint`, `npx.cmd tsc --noEmit`, `npm.cmd run build` | Hedefli koşumlarda ve final gate'de exit0 |
| `npx.cmd playwright test e2e/chat-replies-reactions.spec.ts e2e/chat-responsive.spec.ts e2e/17-project-chat.spec.ts e2e/chat-cache.spec.ts e2e/05-settings-page.spec.ts e2e/12-theme-transition.spec.ts e2e/motion-preferences.spec.ts e2e/landing-real-ui.spec.ts --project=chromium` | 57 passed, exit0 |
| `npx.cmd playwright test e2e/chat-responsive.spec.ts --project=chromium` | Animasyon tamamlandıktan sonra screenshot koşumu: 1 passed |
| `npx.cmd playwright test e2e --project=chromium` | 225 passed + 1 expected skip, exit0 |
| `./pre-push/pre-push.cmd` | PASSED exit0; Maven clean verify459, lint/type/build, Chromium225+1 expected skip, Docker build/start/health |
| `node .local/chat-rp/composer-probe.cjs` | Gerçek Chromium: IME Enter göndermez; Shift+Enter newline; 1999 ASCII+😂=2000 kabul, sonraki emoji reddedilir; focus restore; unexpected send0 |
| PostgreSQL runtime Flyway read | `55|t`; ilk diagnostic varsayılan port ile başarısızdı, container'ın gerçek configured portunda exit0; config değiştirilmedi |
| History query ölçümü | limit30=8 ve limit100=8 JPA prepared statement; her request için ayrıca 1 JDBC reaction snapshot; per-message/per-recipient sorgu yok |
| `npm.cmd audit --json`; `npm.cmd audit --omit=dev --json` | Full5 high (exit1), production0 (exit0); önceki dev dependency debt, bu task yeni advisory/paket eklemedi |

Gerçek PostgreSQL migration/round-trip, FK/PK/CHECK, concurrent duplicate/add/remove ve aynı SQL version/count/mine parity; ADMIN/nonmember/removed/CSRF/cross-scope/batch validation/quota; iki kullanıcı ve gerçek çoklu STOMP subscription, personalized flags, no-op/rollback, late callback, last-remove empty, removed/direct privacy, session expiry/revoke/SEND/subscribe ve 16KB UTF-8 budget testleri geçti. Testcontainers skip'i PASS sayılmadı; backend skip0.

Cache testleri BIGINT Number sınırı üstünde ordering, stale REST/newer WS, empty deletion, pre-MESSAGE buffer, 50-ID batches/global2 workers, late old-account response ve pending reply identity'yi doğrular. Browser testleri group/direct reply + reload, reaction count/mine/add/remove + reload, Unicode mesaj, failed-send retry, cached reopen ve gerçek socket reconnect resync, overlap unread isolation, navigation/focus/inert/context sınırları, TR/EN/DE ve 320/390/768/1440px light/dark/motion davranışını kapsar. Normal başarılı akışlar gerçek backend kullanır. HTTP abort, reaction frame loss ve accelerated expiry yalnız ayrı **TEST-ONLY** hata/renewal kanıtıdır; sahte persistence kanıtı değildir.

İlk geliştirme koşumlarında fixture sırası, remount sonrası caret, mevcut read debounce ve connecting textarea beklentisi düzeltilerek yeniden test edildi. Screenshot animasyonun başında alındığından önce animasyonun bitmesi beklenerek tekrar alındı. Açık failure kalmadı. Private logs/screens/JUnit/source snapshots `.local/chat-rp/` altında Git dışında; secrets/auth storage rapora eklenmedi. Tek expected skip `error-pages.spec.ts` production'da disabled controlled crash route'dur.

## Açık konular ve sınırlar

- **Kalan blocker yok.** Task kapsamındaki full gate başarılı. Mevcut ESLint → fast-glob → micromatch → braces dev debt (5 high) bu tasktan ayrı devam ediyor; [NPM kaydı](2026-10-05-npm-security-remediation.md). Production audit0. Yeni dependency/lock/tsconfig/Compose/ENV değişikliği yok.
- Quote tek seviyeli preview; uzak geçmişe jump/nested chain/full emoji katalog V1 kapsamı değil. Text/reply draft ve panel state client navigation içinde korunur; full document/locale reload persistence yok. HTTP message send idempotency garantisi eklenmedi.
- Group audience mevcut membership paging sınırını korur (100×10); sınırsız ölçek garantisi verilmez. In-memory quota instance başınadır.
- Testlerin yalnız kendi QA projeleri archive edildi; kullanıcı kayıtları/volume'ler silinmedi. Test hesapları, archived metadata ve history DB'de kalabilir.

## Kullanıcı kontrolü

1. Full sohbet açıkken Görevler/Takvim/Organizasyonlar/Ayarlar'a git: panel tamamen kapansın. Mesajlaşma ile açınca text/reply draft kalsın. Compact/bar aynı projede gezinince kalsın; X sonrası kendi kendine açılmasın.
2. İki üyeyle group/direct mesajına Reply seç, quote ile gönder, diğer tarafta ve reload sonrası doğrula. Reply X/Escape yalnız reply'ı silsin; text taslağı kalsın.
3. React ile emoji ekle, chip ile kaldır; iki kullanıcıda count ve own flag doğru olsun. Son remove chip'i silsin; reaction unread artırmasın.
4. Composer picker ile caret'e 😂❤️ ekle; normal mesaj olarak gönder. Keyboard/Escape/focus, light/dark ve mobile yerleşimini kontrol et.
5. X/reopen, bağlantı kesilip dönme ve proje/hesap değişimini kontrol et; eski reaction/context state yeni projeye taşınmasın. [Planı](../../PDA_CHAT_REPLY_REACTIONS_PLAN.md) ve bu completion kaydını incele. Değişiklikler commitlenmemiştir; commit/push kullanıcıya bırakıldı.
