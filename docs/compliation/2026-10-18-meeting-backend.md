# Toplantı sistemi backend teslimi — 2026-10-18

Durum: İstenen backend temeli, veritabanı, gerçek SFU adaptörü, API/güvenlik, test ve devir dokümantasyonu tamamlandı. Frontend bu teslimin dışındadır. Production deployment veya tarayıcıdan uçtan uca medya kabulü yapılmadı.

## Tamamlanan kapsam

- Yeni `com.pda.meeting` Modulith modülü: toplantı CRUD, gündem/katılımcı seçimi, UTC takvim kaynağı, planlı/hemen başlatma, iptal ve bitirme.
- `SCHEDULED/OPEN/ENDED/CANCELLED` yaşam döngüsü; planlanan bitişte yalnız overtime uyarısı. On saniyelik scheduler, DB satır kilidi, restart recovery, boş oda toleransı ve kalıcı cleanup/rotation state.
- Gerçek self-hosted LiveKit RoomService adaptörü: oda oluşturma/sorgulama/silme, en çok 120 saniyelik dar kapsamlı medya JWT, yalnız mikrofon susturma, server-only reliable data packet, bounded HTTP timeout/yanıt ve imzalı raw-body webhook doğrulaması.
- Yalnız ilgili projenin PROJECT_MANAGER rolüne mute/kick/end. Organizatör ayrıcalığı veya global ADMIN bypass yok. Kick ban'ı ve eski oda adı remote işten önce commit edilir; doğrulanmış silme ve yeni epoch olmadan başarı/token dönmez. Başarısızlık kalıcı retry ve 503 üretir.
- Kullanıcı onaylı ayrım: davet iptali yeni guest session'ı engeller; mevcut bounded session devam eder ve sırf iptal nedeniyle oda yenilenmez. Session expiry/üyelik/aktif hesap kaybı da gerektiğinde ban ve epoch yenilemesiyle uzlaştırılır.
- Süreli, kullanım sayılı, hash saklanan davet ve ayrı meeting-path HttpOnly/Secure/Lax guest cookie. Genel PDA principal'ı/proje erişimi verilmez. CSRF bütün browser mutation'larında korunur; tek istisna imzalı tam webhook POST yoludur. Gerçek body boyutları ve oran sınırları uygulanır.
- Meeting-scoped sohbet, aktif SFU katılımcılarına mention, REST history ve server-generated invalidation. Varsayılan bitişte chat içeriği silinir; retention tercihi yapılandırılabilir. Audit içeriğe/token'a yer vermez. Mevcut merkezi Chat/STOMP değiştirilmez.
- Mevcut Notification modülünde altı meeting event türü, kalıcı read/unread davranışı, event/recipient dedup ve dayanıklı publication recovery.
- Kalıcı proje silme ilişkileri cascade ile kaldırır; bağımsız SFU cleanup tombstone'u kaybolmaz. Hesap silmenin mevcut anonimleştirme davranışı korunur.
- İsteğe bağlı yerel LiveKit Compose overlay'i ve gerçek imajda doğrulanmış HTTP healthcheck. Production medya DNS/TLS/TURN/NAT ve kapasite önkoşulları belgeli.

## Değişen önemli dosyalar

- `backend/src/main/java/com/pda/meeting/`: public `MeetingMediaPort`, `MeetingMediaEvents`, `MeetingEvents`, `MeetingPolicy`; `internal/` model/repository/service/lifecycle/scheduler/moderation/controller; `internal/http/` guest/webhook; `media/` LiveKit adaptörü ve verifier.
- `backend/src/main/java/com/pda/auth/infrastructure/config/SecurityBaselineConfiguration.java`, `MeetingHttpLimitFilter.java`: açık verb/path allowlist, exact webhook CSRF istisnası, bounded ingress ve mevcut trusted-proxy zinciriyle IP kotası.
- `backend/src/main/java/com/pda/notification/application/MeetingNotificationListener.java`, `MeetingNotificationStore.java`, `MeetingPublicationRecovery.java`; mevcut NotificationFactory/Notification/NotificationType/ResourceType genişletmeleri.
- `backend/src/main/resources/db/migration/V52__meeting_core.sql`: meetings, agenda, attendee, invite, participant/session hash, chat/mention, audit, webhook dedup ve bağımsız oda cleanup tablosu; FK/check/unique/index'ler.
- `backend/src/main/resources/db/migration/V53__meeting_notifications.sql`: eski team-deletion invariants korunarak meeting event/recipient dedup sözleşmesi. Önceki migration'lar değiştirilmedi.
- `backend/src/main/resources/application.properties`, `.env.example`, Git dışındaki `.env/.env.dev/.env.prod`, `docker-compose.meeting.yml`.
- `backend/src/test/java/com/pda/meeting/`, notification altındaki Meeting testleri ve `auth/infrastructure/config/MeetingProxyRateLimitTest`.
- [API/frontend devir sözleşmesi](../meeting-backend-handoff.md), [medya işletim belgesi](../meeting-media-operations.md), [ADR 0004](../../.agents/decisions/0004-meeting-sfu-lifecycle.md), README ve ilgili `.agents` mimari/API/database/deployment/operations/security özetleri.
- Web checklist'e yalnız etkilenen backend standartları için sınırlı kapsam notu eklendi; global kutular topluca `[x]` yapılmadı. `frontend/` altında değişiklik yok.

### Onaylı ENV sözleşmesi

Yeni anahtarlar `MEETING_MEDIA_ENABLED`, `LIVEKIT_API_URL`, `LIVEKIT_WS_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `MEETING_EMPTY_GRACE`, `MEETING_RETAIN_CHAT`, `MEETING_MAX_PARTICIPANTS`, `MEETING_TOKEN_TTL`.

Dört dosyada da dokuz anahtarın varlığı doğrulandı. Varsayılan feature kapalı, secret boştur. Süre/sınır varsayılanları sırasıyla boş oda için PT10M, retention=false, max participant=50, token TTL=PT60S. API/WSS adreslerinin ortama göre anlamı işletim belgesindedir. Üretim credential'ı oluşturulmadı veya çıktı verilmedi; mevcut diğer profil değerleri korunur. Gerçek ENV dosyaları Git tarafından izlenmiyor.

## API, güvenlik ve Swagger kontrol yolu

`.agents/SECURITY.md` bölüm 11 uyarınca tam girdi/yanıt alanları, izinler, hata kodları, cookie/CSRF/realtime/reconnect/retention sözleşmesi [API devir belgesindedir](../meeting-backend-handoff.md).

Gerçek kök `/api/v1/projects/{projectId}/meetings`:

- GET/POST kök; GET/PUT `/{meetingId}`; GET `/calendar?from=&to=&page=&size=`.
- POST `/{meetingId}/start`, `/cancel`, `/end`, `/join`, `/leave`.
- GET `/{meetingId}/participants`; POST `/{meetingId}/participants/{participantId}/mute` ve `/kick`.
- POST `/{meetingId}/invites`; DELETE `/{meetingId}/invites/{inviteId}`.
- GET/POST `/{meetingId}/chat`.

Public fakat scoped capability ile korunan yollar: POST `/api/v1/meetings/guest/session`; POST `/api/v1/meetings/guest/{meetingId}/join`, `/leave`, `/chat`; GET aynı meeting kökünde `/participants`, `/chat`. JSON guest session sırrını içermez. Public webhook POST `/api/v1/meetings/media/webhook`, issuer/HS256/exp/nbf/raw-body SHA-256 kontrolü olmadan işlenmez.

Swagger yalnız mevcut geliştirme/test docs ayarı açıkken `/swagger-ui/index.html` veya `/v3/api-docs` üzerinden kullanılır. Normal login → GET `/api/v1/auth/csrf` → X-XSRF-TOKEN ile mutation akışı korunur. Anonymous üye API'si 401; yetkisiz rol/guest/CSRF 403; scoped kaynak yoksa 404; bozuk girdi 400; state/full/lock çatışması 409; body limiti 413; kota 429; disabled/provider/pending rotation 503. Üretimde sırf incelemek için API docs açılmadı.

OpenAPI testi gerçek route'ları, MeetingView epoch/cleanup alanlarını, SDK eşleştirmesi için ParticipantView.identity alanını ve guest session yanıtında secret/token bulunmamasını doğruladı.

## Çalıştırılan doğrulama komutları

Backend dizininden son tam kapı:

```powershell
.\mvnw.cmd clean verify "-Dpda.meeting.real-media-test=true" "-l" "../.local/meeting-standard-final-verify.log"
```

Son değişiklikler sonrası hedefli kontrol ve paketleme:

```powershell
.\mvnw.cmd "-Dtest=Meeting*Test,LiveKit*Test,ModularityTest,SecurityBaselineTest,UserProfileApiIntegrationTest,UserProfilePhotoApiIntegrationTest" "-Dpda.meeting.real-media-test=true" "-l" "../.local/meeting-final-validation.log" verify
```

Ek kontroller:

- `docker compose -f docker-compose.yml -f docker-compose.meeting.yml --profile meeting config --quiet`: yalnız process-local rastgele test kimlik bilgileriyle; genişletilmiş sır içeren config yazdırılmadı.
- Pinli `livekit/livekit-server:v1.13.10` içinde wget varlığı; aynı gerçek imaj/konteynerde Compose healthcheck komutunun exit0 kontrolü.
- `git diff --check`, `git diff --name-only -- frontend`, `git ls-files -- .env .env.dev .env.prod`.
- Dört ENV dosyasında yalnız anahtar varlığı/defaultDisabled/secretBlank boolean kontrolleri; gerçek değer çıktısı yok.

## Test ve doğrulama sonuçları

Son tam standart koşu **BUILD SUCCESS**: **1005 test, 0 failure, 0 error, 0 skipped**, 131 test sınıfı. Bunların **53'ü Meeting/LiveKit** kapsamındadır. Koşu 2026-10-18 00:38:31 Europe/Istanbul zamanında bitti, süre 8 dakika 45 saniye. Paket `backend/target/backend-0.0.1-SNAPSHOT.jar` üretildi. Maven 3.9.16, Java 25.0.1, Spring Boot 4.1.1; yeni SDK/Maven bağımlılığı eklenmedi.

Önceki son hedefli koşu **76/0/0/0 BUILD SUCCESS**. Gerçek PostgreSQL 17/18 migration/entegrasyon ve DB concurrency; duplicate scheduler/notification; single-use invite yarışı; revoke commit'ini bekleyen redemption; guest expiry; ban/rotation persistence; provider restart; takvim aralık kesişimi; canlı mention/persistence/default chat temizliği; auth/CSRF/scoped cookie; trusted/untrusted proxy kota; Modulith ve OpenAPI doğrulandı.

Gerçek LiveKit smoke testinde kontrollü geçici anahtar ve konteynerle create/list/token grant/data/missing-participant mute/delete, actual signed room_started webhook ve healthcheck komutu başarılı oldu. Core testlerindeki media fake'i yalnız test bean'idir; production adaptörü gerçek RoomService çağırır. Tarayıcı WebRTC medya transferi veya otomatik SDK reconnect test edildiği iddia edilmez.

İlk keşif/doğrulama sırasında Maven sandbox erişimi, Java BOM ve proxy üzerinden doğrudan field erişimi sorunları çözüldü. Bir tam koşudaki iki mevcut profil sınıfının geçici class-resource başlangıç hataları sonraki hedefli ve son tam koşuda tekrarlanmadı. Günlük seviyesi azaltılan ara koşu mevcut INFO-log assertion'ını etkilediği için durduruldu; uygulama/test beklentisi gevşetilmeden standart ayarlarla son tam kapı geçti. Başarısız veya durdurulan ara koşular başarı kanıtı sayılmaz.

Compose quiet validation, diff-check, no-frontend-change ve ENV Git dışı kontrolleri başarılıdır. Tam frontend/pre-push/production gate veya deployment çalıştırılmadı; kullanıcı push/merge/release yetkisi vermedi ve bu işlemler yapılmadı.

## Açık kalan konular ve doğrulanmayan sınırlar

- Üretim LiveKit key/secret, medya DNS/TLS, firewall/NAT ve gerekebilecek TURN kurulumu operatör tarafından sağlanmalıdır. Feature varsayılan kapalıdır. Dev overlay uzak ağ çözümü diye sunulmaz.
- Frontend toplantı ekranı, guest public route, SDK kurulumu, otomatik reconnect, cihaz izinleri ve UI retention açıklaması sonraki task'tır. Mevcut frontend Permissions-Policy kamera/mikrofonu kapatır; üretim CSP yeni medya WSS origin'ini henüz içermez. Bunlar backend tesliminde gevşetilmedi.
- Tarayıcıdan gerçek ses/kamera/ekran paylaşımı, mobil veri/ev interneti/TURN ve yük kapasitesi doğrulanmadı. 100–500 kayıtlı kullanıcı sayısı eşzamanlı SFU kapasitesi garantisi değildir.
- Self-hosted token revoke sınırı ADR 0004 ve auto_create=false önkoşuluna bağlıdır. Başarısız provider silmesinde live erişimin kesin bitmesi retry başarısına bağlıdır; kick başarılı diye raporlanmaz. Anonymous kullanıcı başka geçerli davetle yeni anonim kimlik edinebilir; gerçek kişi yasağı iddia edilmez.
- Guest ingress IP kotası process-local'dır; çok replica dağıtımında ortak ingress kotası gerekir. Meeting satır kilidi ile lifecycle/token/chat sınırları instance'lar arasında korunur.
- Retention=true yalnız DB'de chat içeriğini korur; bu teslimin history endpoint'i bitmiş toplantı arşivi sunmaz. Metadata/audit geçmişi korunur, projenin kalıcı silme akışı ayrıdır.

## Kullanıcının manuel kontrol adımları

1. Bu kayıtla birlikte API devir ve medya işletim belgelerini inceleyin. Yeni ENV anahtarlarını profillerde güvenli şekilde yapılandırın; gerçek anahtarları sohbet/commit/log'a koymayın.
2. Geliştirmede doğru etkin profil ve gerçek test credential'larıyla isteğe bağlı meeting overlay'ini başlatın; healthcheck ve Swagger/CSRF üzerinden create/start/join/list/calendar akışlarını kontrol edin.
3. PROJECT_MANAGER olmayan organizatör için mute/kick/end reddini; yabancı proje erişimini; single-use invite ve guest cookie scope'unu kontrol edin. Invite iptali yeni session'ı durdurmalı, mevcut session devam etmelidir.
4. Frontend hazır olduğunda kick sonrası eski token ile dönüş reddini ve kalan katılımcıların yeni epoch ile otomatik bağlantısını; kendi mic/camera izinlerinin korunmasını gerçek istemcide doğrulayın. Planlanan bitiş oda kapatmamalıdır.
5. Üretim öncesinde ayrı ev interneti/mobil veri cihazlarıyla gerçek medya, TURN fallback, restart ve provider kesintisi/cleanup recovery deneyin; DNS/TLS/firewall ve kapasiteyi ayrıca doğrulayın.
6. Yayın/merge/push öncesinde ilgili production ve pre-push kapılarını ayrıca yürütün. Bu kayıt otomatik yayın onayı değildir.
