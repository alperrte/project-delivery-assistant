# Proje kapsamlı gerçek zamanlı mesajlaşma

## Teslim ve durum

Tamamlandı, 2026-10-03. Her projede otomatik bir "Proje Grubu" ve aynı projenin iki üyesi arasında birebir konuşmalar; mesajlar PostgreSQL'de kalıcıdır, yetki `ProjectMembership` ile her istekte denetlenir, iletim WebSocket + STOMP ile gerçek zamanlıdır, gönderim REST'tedir. Arayüz seçili proje sidebar'ındaki "Mesajlaşma" düğmesiyle açılan tam panel; `full` → `bar` → `compact` durumları arasında geçer ve proje sayfaları arasında gezerken korunur. V1 kapsamı dışında bırakılanlar: bildirim entegrasyonu, çevrimiçi durumu, yazıyor göstergesi, düzenleme/silme, dosya/görsel.

## Yapılanlar

- Backend: yeni Modulith modülü `backend/src/main/java/com/pda/chat/` (`api`, `application/service`, `domain`, `infrastructure/repository`, `infrastructure/websocket`), migration `V51__project_chat.sql`, `pom.xml` içinde `spring-boot-starter-websocket`, `SecurityBaselineConfiguration` içinde üç POST eşleştiricisi, `GET /api/v1/ws` (authenticated) ve 401 giriş noktası listesine `/api/v1/ws`.
- Frontend: `frontend/src/features/chat/` (veri katmanı, `chat-provider.tsx`, `use-chat-socket.ts`, bileşenler), `components/layout/app-shell.tsx` içinde `ChatProvider` + `ChatRoot`, `project-sidebar-nav.tsx` içinde "Mesajlaşma" düğmesi, `sidebar-collapse.ts` (daralma durumu ortak hook), yapışkan kaydet çubuklarında `data-sticky-actions`, `tr/en/de.json` içinde `chat` ad alanı ve `CHAT_*` hata metinleri, bağımlılık `@stomp/stompjs`.
- Testler: `ChatDomainTest` (13), `ChatApiIntegrationTest` (25), `ChatWebSocketIntegrationTest` (8), `frontend/e2e/17-project-chat.spec.ts` (12).
- Belgeler: `.agents/SECURITY.md` §11 "Project chat", `api.md`, `database.md`, `folder-structure.md`, `architecture.md`, `deployment.md`, `frontend-design-rules.md`.

## Doğrulama

- `backend`: `./mvnw test` → 386 test, 0 hata (`ModularityTest` dahil).
- `frontend`: `npm run lint`, `npx tsc --noEmit`, `npm run build` temiz; `npx playwright test` → 136 geçti, 1 atlandı (üretim derlemesinde kapalı olan geliştirme hata rotası).
- `pre-push\pre-push.cmd` → PASSED (ikinci çalıştırma; ilk çalıştırmada dış ağa bağlı iki test, GitHub depo bağlama ve geliştirme hata rotası, geçici ağ hatasıyla düştü ve sohbetle ilgisizdi).
- Elle: backend durdurulup başlatıldığında mesaj kutusu "Bağlantı koptu…" ile devre dışı kaldı; yeniden bağlanınca kopukken gönderilen mesaj bir kez göründü (REST telafisi).
- `npm audit`: `@stomp/stompjs` için bulgu yok. Mevcut ve bu işten bağımsız 8 yüksek bulgu `braces` → `fast-glob` zincirinden (`shadcn`, `eslint-config-next`) gelir; düzeltmesi kırıcı (`--force`) olduğundan dokunulmadı.

## API

Ayrıntılı tablo (yöntem, yetki, istek, yanıt, hata) `.agents/SECURITY.md` §11 "Project chat" bölümündedir.

- `GET /api/v1/projects/{projectId}/chat/conversations`, `GET .../chat/members`
- `POST .../chat/direct/{userId}`
- `GET .../chat/conversations/{conversationId}/messages?before&after&limit`
- `POST .../chat/conversations/{conversationId}/messages` (`{content}`), `POST .../chat/conversations/{conversationId}/read`
- WebSocket: `GET /api/v1/ws` (STOMP), abonelik yalnız `/user/queue/chat`.

Swagger ile kontrol: `API_DOCS_ENABLED=true` iken Swagger UI'da "chat-controller"; WebSocket Swagger'da görünmez, `ChatWebSocketIntegrationTest` ile doğrulanır.

## Açık konular

- Açık soket oturumunu aşmaz: sunucu her 30 saniyede (`chat.ws.session-check-millis`) açık soketlerin oturumunu, erişim jetonunun süresini ve hesabın aktifliğini denetler, geçerli olmayanı sunucu tarafında kapatır (en kötü durumda ölü bir oturumun soketi bir denetim aralığı, yani ~30 sn açık kalır). Sağlıklı istemci kendiliğinden yeniden bağlanır (jeton yenilenir, kaçan mesajlar REST ile alınır); iptal edilmiş oturum yeniden bağlanamaz. Aynı hesabın diğer oturumları ve üyelik denetimleri etkilenmez. Kullanıcı bunu fark etmez: sunucu her yanıtta jetonun kalan süresini bildirir, istemci bitişten 90 sn önce oturumu yenileyip yeni jetonla ikinci bir soket açar, o bağlanınca devralır ve eskisini kapatır (kesinti ve çift mesaj yok). Yenileme başarısız olursa ya da bilgisayar uykuya geçtiyse sunucu soketi yine jeton bitişinde kapatır ve olağan yeniden bağlanma devreye girer.
- Gönderme hız sınırı bellek içidir ve örnek başınadır (yeniden başlatmada sıfırlanır).
- Sidebar rozeti proje sayfalarının dışında dakikada bir yenilenir (soket yok).
- Bildirim Servisi entegrasyonu V1'de yoktur; e-posta doğrulama/e-posta ile davet kararı ayrı olarak açıktır.

## Kullanıcı kontrolü

1. İki tarayıcıyla aynı projeye iki üye olarak girin; birinde "Mesajlaşma"yı açıp diğerine birebir mesaj yazın: diğer tarafta sayfa yenilenmeden sidebar rozeti ve konuşma satırı güncellenmeli, konuşma açılınca rozet silinmeli.
2. Tam panelde "—" ile sağ alt çubuğa küçültün ("×" ise sohbeti tamamen kapatır, sağ altta çubuk kalmaz), Görevler'e gidin, çubuğa tıklayıp pencereyi açın: aynı konuşma, geçmiş ve yazılmamış taslak korunmalı; başka projeye geçince sohbet sıfırlanıp kapanmalı.
3. Mesaj olarak `<script>alert(1)</script>` gönderin: metin olarak görünmeli. Projede olmayan bir hesapla `GET /api/v1/projects/{id}/chat/conversations` çağırın: 403.
4. Karanlık/aydınlık tema ve 390 px genişlikte (liste ↔ konuşma) panelin düzenini inceleyin.
