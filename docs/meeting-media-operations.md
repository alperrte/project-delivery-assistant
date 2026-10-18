# Toplantı medya servisi işletimi

Bu teslim backend entegrasyonudur. Frontend medya istemcisi, üretim DNS/TLS/TURN kurulumu ve farklı ağlardan gerçek ses/görüntü denemesi ayrıca yapılır. Üretim anahtarları oluşturulmadı; servis varsayılan olarak kapalıdır.

## Sağlayıcı ve sürüm

Self-hosted LiveKit SFU, `livekit/livekit-server:v1.13.10` imaj etiketiyle sabitlenmiştir. Sunucu [Apache 2.0 lisanslıdır](https://github.com/livekit/livekit/blob/v1.13.10/LICENSE); sürüm kaydı [resmî v1.13.10 release sayfasındadır](https://github.com/livekit/livekit/releases/tag/v1.13.10). Cloud hesabı veya ücretli SaaS gerektirmez; sunucu, egress ve TURN kaynakları işletmeciye aittir. Etiket digest sabitlemesi değildir; sonraki yükseltme ayrı doğrulama gerektirir.

Backend [resmî RoomService Twirp API](https://docs.livekit.io/reference/other/roomservice-api/) üzerinden Java HttpClient kullanır. Yeni LiveKit SDK bağımlılığı yoktur. `LIVEKIT_CONFIG` ve `LIVEKIT_KEYS` resmî [sunucu ortam değişkenleridir](https://github.com/livekit/livekit/blob/v1.13.10/cmd/server/main.go).

## Onaylı yapılandırma

Dokuz yeni ENV anahtarı vardır. Medya ayarları `pda.meeting.media.*` alanlarına bağlanır:

- `MEETING_MEDIA_ENABLED`: varsayılan `false`; `enabled` alanı.
- `LIVEKIT_API_URL`: backend RoomService kökü; `api-url` alanı. Geliştirme varsayılanı `http://livekit:7880`.
- `LIVEKIT_WS_URL`: istemciye dönen sinyalleşme kökü; `websocket-url` alanı. Geliştirme varsayılanı `ws://localhost:7880`.
- `LIVEKIT_API_KEY`: `api-key`; varsayılan boş. İzinli biçim `[A-Za-z0-9_-]`, 1–128 karakter.
- `LIVEKIT_API_SECRET`: `api-secret`; varsayılan boş. 32–512 karakter base64/base64url biçimine uygun harf, rakam, `_`, `+`, `/`, `=`, `-`. Dağıtım secret mekanizmasından sağlanır; kaynak koduna veya komut satırı argümanına yazılmaz.

Aynı `MEETING_MEDIA_ENABLED` bayrağı `pda.meeting.enabled` alanını da etkinleştirir; ayrı bir gizli feature bayrağı yoktur. Yaşam döngüsü için onaylanan dört ayar:

- `MEETING_EMPTY_GRACE=PT10M`: `pda.meeting.empty-grace`; boş toplantının kapanma toleransı. 1 dakika–24 saat arası ISO-8601 duration.
- `MEETING_RETAIN_CHAT=false`: `pda.meeting.retain-chat`; bitiş sonrası sohbeti saklama tercihi. Üretim saklama/hukuki politikasına göre seçilir.
- `MEETING_MAX_PARTICIPANTS=50`: `pda.meeting.max-participants`; 2–100 arası oda katılımcı üst sınırı, kapasite garantisi değildir.
- `MEETING_TOKEN_TTL=PT60S`: `pda.meeting.token-ttl`; katılımcı token geçerliliği, 15–120 saniye arası ISO-8601 duration.

`.env.example`, `.env.dev`, `.env.prod` ve etkin `.env` içine yalnız eksik anahtarlar eklendi; diğer mevcut değerler korunur. `.env.prod` adresleri `https://media.pd-assistant.com` ve `wss://media.pd-assistant.com` hazırlık değerleridir; DNS veya sertifikanın kurulduğu anlamına gelmez. Kimlik bilgileri boş bırakıldı. Profilleri mevcut `ops/env.ps1` akışıyla yönetin.

Etkinleştirildiğinde eksik/geçersiz anahtar veya URL uygulama başlangıcını durdurur. `dev` profili yalnız localhost, loopback veya Docker `livekit` host'u için HTTP/WS kabul eder. Diğer profiller HTTPS/WSS ister. URL kullanıcı bilgisi, query, fragment veya ek path kabul etmez. Secret ve token'lar loglanmaz.

## Yerel Compose

Önce `.env.dev` içindeki medya kimlik bilgilerini güvenli şekilde yapılandırın, etkin profili `dev` yapın ve `MEETING_MEDIA_ENABLED=true` seçin. İsteğe bağlı overlay temel yığını değiştirmeden başlatılır:

```powershell
docker compose -f docker-compose.yml -f docker-compose.meeting.yml --profile meeting config --quiet
docker compose -f docker-compose.yml -f docker-compose.meeting.yml --profile meeting up -d
```

`config --quiet` yalnız sözleşmeyi doğrular; SFU hazır olma kanıtı değildir. Düz `docker compose config` veya `docker inspect` çıktısı sır içerebilir; sohbet/CI çıktısına eklemeyin. Boş kimlik bilgileri overlay çözümlemesini durdurur. Compose `LIVEKIT_CONFIG` içinde sır olmayan ayarları, `LIVEKIT_KEYS` içinde anahtar çiftini çalışma anında sağlar. Açık debug/dev sunucu modu kullanılmaz.

Backend Compose içinde `http://livekit:7880` kullanır. Java uygulaması host üzerinde çalıştırılıyorsa `LIVEKIT_API_URL=http://localhost:7880` verilmelidir; Docker servis adı host DNS'inde çözülmez. `LIVEKIT_WS_URL` tarayıcının ulaşacağı adres olmalıdır. Localhost varsayılanı yalnız aynı bilgisayar içindir.

Dev overlay sinyalleşmeyi TCP 7880, medya TCP yedeğini 7881, UDP multiplex trafiğini 7882 portuna bağlar; host bağları yalnız `127.0.0.1` üzerindedir. `rtc.node_ip=127.0.0.1`, `use_external_ip=false` özellikle yerel topolojidir. Bu dosya uzak erişim/üretim Compose'u değildir. Redis veya ayrı TURN servisi gerekçesiz eklenmez. İmaj içindeki `wget` ile HTTP kökü her 10 saniyede kontrol edilir; backend başlangıcı bu healthcheck'i bekler. Bu liveness kontrolü kimliği doğrulanmış RoomService smoke testinin veya gerçek ICE bağlantısının yerine geçmez. Aynı healthcheck komutu gerçek imaj üzerindeki smoke testinde de çalıştırılır.

## Güvenlik ve hata davranışı

SFU'da `room.auto_create=false` ve `room.enable_remote_unmute=false` zorunludur. Backend odaları deterministik adla oluşturur; tekrar oluşturma aynı odayı hedefler. Moderasyon epoch değişiminde eski odanın doğrulanmış silinmesi, eski token'ın yeniden kullanılmasını engelleyen sınırdır. Bu ayarlar dışarıdan gevşetilirse self-hosted `RemoveParticipant` tek başına token iptal garantisi vermez.

Katılımcı token'ı en çok 120 saniye geçerlidir ve yalnız belirli odaya katılım, kamera, mikrofon ve ekran paylaşımı yayınlama/izleme yetkisi taşır. Veri yayınlama ve kendi metadata'sını değiştirme kapalıdır; yönetim grant'ları verilmez. Token süre sonu mevcut WebRTC oturumunu kendiliğinden sonlandırmaz. Yönetim JWT'leri yalnız backend'in RoomService isteğinde kullanılır. Susturma yalnız mikrofon track'lerini `muted=true` yapar; uzaktan unmute yolu yoktur.

HTTP connect timeout 3 saniye, istek timeout 5 saniye, yanıt limiti 256 KiB'dır. Adapter kendi içinde retry yapmaz; kalıcı lifecycle işi retry sahibidir. Devre dışı veya erişilemeyen SFU gerçek medya işlemlerinde güvenli `503` üretir; sahte oda/token dönmez. `ListRooms` için 404 hata sayılır; bulunamayan oda normalde 200 ve boş listedir. İdempotent silme ve katılımcı sorgularında yalnız doğrulanmış Twirp `404` + JSON `code=not_found` yokluk sayılır; proxy HTML 404, boş sorgu gövdesi veya bozuk JSON yokluk sayılmaz.

Webhook `POST /api/v1/meetings/media/webhook` yoluna `application/webhook+json` ile gelir. Dev SFU bunu Docker ağındaki `http://backend:8080` adresine yollar. İstek raw byte'ları en çok 64 KiB'dır; API key issuer, HS256, exp/nbf ve raw gövdenin base64 SHA-256 değeri sabit süreli karşılaştırmayla doğrulanır. JWT ham Authorization veya Bearer biçiminde kabul edilir. İş olayları core'da event ID ve oda epoch'una göre işlenir. Yanıt/error loglarına webhook gövdesi veya token eklenmez. Protokol: [LiveKit webhooks](https://docs.livekit.io/intro/basics/rooms-participants-tracks/webhooks-events/).

## Üretim hazırlığı

Mevcut tek Hostinger KVM 2 VPS ve Caddy düzeninde `media.pd-assistant.com` için DNS ve güvenilir TLS sertifikası gerekir. Caddy HTTPS/WSS sinyalleşmeyi SFU TCP 7880'e yönlendirmeli; WebSocket yükseltmesini ve uzun bağlantıları korumalıdır. RoomService `/twirp/*` trafiğini internetten erişilebilir bırakmayın: backend'in erişebildiği özel ağ/proxy allowlist'i kullanın. Prod adapter HTTPS istediğinden backend API adresinin de uygun sertifika ve özel erişimle çözüldüğünü doğrulayın. Mevcut üretim Caddy ve Compose dosyaları bu teslimde otomatik değiştirilmez.

TCP 7881 ve UDP 7882 WebRTC medyası HTTP reverse proxy üzerinden geçmez; sunucu firewall/NAT yönlendirmesi ayrıca gerekir. Gerçek public IP/NAT ve SFU'nun ilan ettiği ICE adresleri doğru yapılandırılmalıdır; dev loopback ayarlarını üretime taşımayın. [Resmî firewall dokümanı](https://docs.livekit.io/transport/self-hosting/ports-firewall/) ve [dağıtım rehberi](https://docs.livekit.io/transport/self-hosting/deployment/) ortamın son port planı için esastır.

Mobil/kurumsal kısıtlı ağlar için TURN gerekli olabilir. TURN domain'i, TLS sertifikası, credential/ephemeral auth politikası ve UDP/TCP relay portları henüz sağlanmadı. Özellikle TURN TLS 443 ile Caddy'nin aynı IP:443 dinlemesi çakışır; ayrı public IP/host veya bilinçli L4 yönlendirme gerekir. Yeni domain tek başına aynı IP:443 çakışmasını çözmez. Bu karar tamamlanmadan uzak ağ desteği doğrulanmış sayılmaz.

100–500 kayıtlı kullanıcı eşzamanlı medya kapasitesi değildir. Eşzamanlı oda/katılımcı sayısı, yayın çözünürlüğü, simulcast, abone sayısı, egress, TURN oranı ve CPU/bellek ayrı yük testi ister. Aynı VPS'teki PostgreSQL/backend/frontend kaynakları hesaba katılmalıdır; bu teslim kapasite garantisi vermez.

## Otomatik ve manuel doğrulama

Backend dizininde hızlı outbound/JWT/webhook kontrolleri:

```powershell
.\mvnw.cmd "-Dtest=LiveKitMediaAdapterTest,LiveKitWebhookVerifierTest" test
```

Docker açıkken gerçek sabitlenmiş SFU ve imzalı webhook smoke:

```powershell
.\mvnw.cmd "-Dtest=LiveKitRealSmokeTest" "-Dpda.meeting.real-media-test=true" test
```

Opt-in test kendi geçici konteynerini, rastgele anahtarlarını ve callback alıcısını oluşturup kapatır. Gerçek create/list/missing participant mute/data/delete ve imzalı `room_started` callback'ini doğrular. Normal test koşusunda opt-in smoke atlanır. Çıktı test sonucu/metadatadır; token, ortam değişkeni veya tam Docker yapılandırmasını yazdırmayın. Bu belge testin geçtiğini iddia etmez; gerçek koşu sonucu completion kaydına yazılır.

Frontend hazır olduğunda iki gerçek cihazdan, ayrı ev interneti ve mobil veri bağlantılarından katılma; kamera/mikrofon/ekran paylaşma; TURN'e zorlanan bağlantı; kopma/yeniden bağlanma; yetki kaybı; kick sonrası eski token ile yeniden giriş; SFU restart ve backend restart toparlanması manuel doğrulanmalıdır. Testcontainers RoomService testi bu medya/ağ kontrolünün yerine geçmez.

## Kesinti ve geri dönüş

Önce aktif toplantıları normal yetkili API üzerinden bitirin ve provider odalarının kaldırıldığını gerçek RoomService ile doğrulayın. SFU erişilemiyorsa eski odaların temizliği operatörün açık işi olarak kalır; yalnız DB durumunu değiştirmek yeterli değildir. Ardından `MEETING_MEDIA_ENABLED=false` ile backend'i yeniden başlatın; yeni medya işlemleri 503 verir. Bu bayrak var olan SFU oturumlarını kendiliğinden kapatmaz. Gerekli olay müdahalesinde yalnız toplantı SFU servisini durdurmak mevcut medya oturumlarını kapatır; diğer proje/container/volume'lerine dokunmayın.

Kalıcı lifecycle kayıtlarını veya Flyway geçmişini silmeyin. Medya bağlantıları geçicidir; meeting/participant/invite/chat verisinin yedeği PostgreSQL politikasına dahildir. Sorun düzeltildikten sonra yapılandırmayı ve gerçek SFU smoke'u doğrulayıp servisi etkinleştirin; kalan lifecycle işleri kalıcı kayıtlardan toparlanır. Üretim deployment ve anahtar rotasyonu kullanıcı tarafından ayrıca yürütülür.
