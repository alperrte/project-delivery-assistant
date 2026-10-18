# Toplantı backend API ve frontend devir sözleşmesi

Bu belge `com.pda.meeting` uygulamasının gerçek controller/DTO sözleşmesidir. Bu teslimde frontend dosyası değiştirilmez. Medya kurulumu, dokuz ENV anahtarı, portlar ve üretim önkoşulları için [medya işletim belgesini](meeting-media-operations.md) kullanın. Gerçek doğrulama sonuçları `docs/compliation/2026-10-18-meeting-backend.md` kaydındadır.

## Kimlik ve izinler

Üye uçlarının kökü `/api/v1/projects/{projectId}/meetings` şeklindedir. Normal PDA HttpOnly cookie oturumu gerekir. Kimlik yalnız authenticated principal'dan gelir. Başka projeye ait meeting/participant/invite UUID'si erişim sağlamaz. Global ADMIN proje üyeliği veya moderasyon kazandırmaz.

- Aktif proje üyeleri toplantı oluşturabilir, listeleyebilir, detay/takvim/katılımcı görebilir ve açık toplantıya katılabilir.
- Organizatör kendi planlı toplantısını düzenleyebilir, başlatabilir ve iptal edebilir; kendi toplantısının misafir davetlerini oluşturup iptal edebilir.
- İlgili projenin PROJECT_MANAGER rolü bu işlemleri bütün toplantılarda yapabilir. Başkasını susturma, çıkarma ve herkes için bitirme yalnız bu role aittir. Organizatör olmak bu yetkileri vermez.
- Sohbet gönderme/geçmiş okuma için aktif, yasaklanmamış, SFU'da gerçekten bağlı katılımcı olmak gerekir. Misafirler aynı sohbet/mention sınırlarına tabidir.
- Mikrofon/kamera/ekran paylaşımını başlatmak kullanıcının tarayıcı izni ve kendi istemci niyetidir. Sunucu uzaktan unmute etmez. Katılımcı bazında dinleme ses seviyesi istemcide ayarlanır.

Bütün browser mutation isteklerinde önce `GET /api/v1/auth/csrf`, sonra normal `X-XSRF-TOKEN` başlığı ve credentials gerekir. Misafir mutation'ları da CSRF korumalıdır. CORS'un mevcut origin allowlist'i değişmez. API yanıtları önbelleğe alınmaz. Token/cookie/davet sırrını localStorage, sessionStorage, URL query/path, analitik veya loglara yazmayın.

## Oluşturma, planlama ve takvim

`POST /` aşağıdaki JSON ile 201 `MeetingView` döndürür. Buradaki `/` göreli kökü ifade eder; gerçek yol `/api/v1/projects/{projectId}/meetings`tir.

```json
{
  "title": "Sprint planlama",
  "description": "Gündem açıklaması",
  "startsAt": "2030-01-15T09:00:00Z",
  "endsAt": "2030-01-15T10:00:00Z",
  "zoneId": "Europe/Istanbul",
  "agenda": ["Öncelikler", "İş dağılımı"],
  "attendeeIds": []
}
```

Başlık 1–160, açıklama en çok 4000 Java string karakteridir. Gündem en çok 30 öğe ve öğe başına 1000 karakter; attendeeIds en çok 100 aktif proje üyesidir. Metinlerde newline/TAB dışındaki kontrol karakterleri reddedilir. Listeler boş olabilir, null olamaz. `startsAt < endsAt`, süre en çok 24 saattir. Başlangıç geçmişte olamaz; istek aktarımı için 5 saniye tolerans vardır. Geçerli ZoneId (ör. Europe/Istanbul veya UTC) gerekir. UTC Instant veritabanında saklanır; yerel saatten UTC'ye dönüştürmek ve takvimde kullanıcı zaman diliminde göstermek istemcinin sorumluluğudur.

- `GET /`: 200 sayfa. Parametreler `status`, `from`, `to`, `page=0`, `size=20`, `sort=startsAt,asc`. `page` 0–10000, `size` 1–100. Sort alanları yalnız startsAt/createdAt/title/status; yön asc/desc. UUID son sıralama anahtarıdır. Tarih filtresi aralıkla kesişen toplantıları getirir: `endsAt > from`, `startsAt < to`. İki sınır verildiğinde aralık pozitif ve en çok 366 gündür.
- `GET /calendar?from={UTC}&to={UTC}&page=0&size=100`: 200 aynı sayfa yapısı; iki tarih zorunlu, sabit startsAt artan sırası. Önceki gün başlayıp görünen güne taşan toplantılar da gelir. Sonraki sayfaları `totalPages` ile alın. Bu, mevcut frontend takviminin reminders/tasks kaynaklarına ekleyeceği toplantı kaynağıdır; ayrı reminder kopyası oluşturulmaz.
- `GET /{meetingId}`: 200 MeetingView.
- `PUT /{meetingId}`: oluşturmayla aynı JSON; yalnız SCHEDULED durumda, 200 MeetingView.
- `POST /{meetingId}/start`: organizatör/yönetici tarafından hemen açma, 200 MeetingView. Aynı OPEN toplantıda tekrar çağrı idempotenttir. Hemen toplantı akışı: başlangıcı şimdi olan toplantıyı oluşturun, sonra start çağırın; scheduler da zamanı gelen kaydı açar.
- `POST /{meetingId}/cancel`: yalnız planlı toplantıyı iptal eder; zaten CANCELLED ise idempotent, 200 MeetingView.
- `POST /{meetingId}/end`: yalnız PROJECT_MANAGER; 200 MeetingView. Kalıcı ENDED ve cleanup niyeti önce commit edilir, sonra oda kapatma denenir. `cleanupPending=true` ise medya kaynağının kaldırılması hâlâ yeniden denenmektedir. ENDED kayda yeni token verilmez.

Sayfa JSON'u `{content:[...],page,size,totalElements,totalPages}`; boş sonuç 200 ve `content:[]`tır. `MeetingView` alanları: `id,projectId,organizerId,title,description,startsAt,endsAt,zoneId,status,openedAt,endedAt,overtime,chatRetained,version,agenda,attendeeIds,roomEpoch,reconnectRequired,cleanupPending`.

Durumlar `SCHEDULED → OPEN → ENDED` veya `SCHEDULED → CANCELLED` şeklindedir. Planlanan bitiş yalnız `overtime=true` ve bildirim üretir; toplantıyı kapatmaz. Scheduler 10 saniyede bir UTC zamanıyla geçmiş due kayıtları da tarar; restart sonrası toparlanır. Açma ve overtime bildirimi meeting satır kilidi altında bir kez üretilir. Bu bir gerçek zamanlı saat garantisi değildir; provider kesintisinde sonraki turda yeniden denenir.

Hiç katılımcı almamış oda planlanan bitişten sonra boş oda toleransı dolmadan kapanmaz. Daha önce katılım olmuşsa son boş kalma anından itibaren `MEETING_EMPTY_GRACE` uygulanır. SFU restart veya otomatik boş oda temizliğinden sonra yalnız güncel epoch yeniden oluşturulabilir. Eski epoch asla canlandırılmaz.

## Katılım ve moderasyon

- `POST /{meetingId}/join`: 200 MeetingJoin. Aynı katılımcı için token mint en sık 2 saniyede birdir.
- `POST /{meetingId}/leave`: 204; yalnız çağıranın bağlantısını kapatır. Üye daha sonra yeni join isteğiyle dönebilir. İstemci her durumda SDK bağlantısını da kapatmalıdır.
- `GET /{meetingId}/participants`: 200 katılımcı dizisi. Alanlar `id,identity,displayName,guest,connected,revoked,joinedAt,leftAt`. REST `id` moderasyon ve mention hedefidir; `identity` SDK katılımcısıyla kesin eşleştirme içindir. Kullanıcı adıyla eşleştirmeyin.
- `POST /{meetingId}/participants/{participantId}/mute`: PROJECT_MANAGER, 204. Yalnız mikrofon track'leri muted=true yapılır. Başkasının mikrofonunu açan bir endpoint yoktur.
- `POST /{meetingId}/participants/{participantId}/kick`: PROJECT_MANAGER, 204 ancak eski oda doğrulanmış biçimde kaldırılıp yeni epoch açıldıktan sonra. Eski oda kapanamazsa kalıcı ban/rotation niyeti korunur ve 503 `MEETING_RECONNECT_PENDING` döner. Bu hata, çıkarma talebinin hiçbir etkisi olmadığını ifade etmez; ban kalıcıdır ve worker devam eder.

MeetingJoin JSON'u `{participantId,identity,media:{url,token,expiresAt},chatRetained,roomEpoch,status}`. Medya token'ı yalnız bu oda için join/publish/subscribe sağlar; camera/microphone/screen_share/screen_share_audio kaynakları izinlidir. roomAdmin, roomCreate, roomList, metadata değiştirme ve istemci data publishing yoktur. SFU secret'ı hiçbir yanıta eklenmez. Token yalnız SDK bağlantısı için kısa süre bellekte tutulur.

Çıkarma ve proje üyeliği kaybı, daha önce verilmiş token'ı self-hosted SFU'da tek başına iptal edemez. Kullanıcı onaylı çözüm: kalıcı ban, eski oda adı kalıcı pending kaydı, doğrulanmış silme ve yeni oda epoch'u. `auto_create=false` zorunludur. Yeniden bağlanan yasaklı kişi yeni token alamaz; eski token yalnız artık bulunmayan eski odaya aittir. Proje üyeliği/aktif hesap kaybı da worker veya public membership olayıyla tespit edilip aynı sınırla uygulanır.

### Sonraki frontend görevi: otomatik yeniden bağlantı

Backend bu teslimde gerekli state/token sözleşmesini sağlar. Otomatik yeniden bağlantının arayüz/SDK uygulaması ve uçtan uca testi sonraki frontend görevidir.

Sonraki frontend görevinde [resmî JavaScript SDK kurulumuna](https://docs.livekit.io/reference/client-sdk-js/) göre `npm install livekit-client --save` uygulanır ve seçilen sürüm lockfile ile sabitlenir; bu teslimde kurulmadı. İstemci `Room` ve `RoomEvent` kullanarak `room.connect(join.media.url, join.media.token)` çağırır. `TrackSubscribed/TrackUnsubscribed`, `ParticipantConnected/ParticipantDisconnected`, `ActiveSpeakersChanged`, `DataReceived`, `Reconnecting/Reconnected/Disconnected` olaylarının sahipliği aynı meeting ekranında olmalı; unmount/logout/leave'de listener, track ve bağlantılar temizlenmelidir. Bağlanma tek başına cihaz yayını izni değildir; mikrofon, kamera ve ekran paylaşımı yalnız kullanıcının açık eylemiyle başlatılır. Server SDK veya API secret frontend'e kurulmaz.

Mevcut frontend'de iki somut entegrasyon önkoşulu vardır: `frontend/next.config.ts` başlığı şu anda `camera=(), microphone=()` ile cihaz erişimini kapatır; `frontend/src/lib/security/csp.ts` üretim connect-src listesi yalnız PDA/API origin'ini ve onun WebSocket eşini içerir. Sonraki frontend görevi toplantı yüzeyine uygun cihaz politikasını ve açık medya WSS origin allowlist'ini güvenlik kurallarıyla birlikte düzenlemelidir; wildcard veya genel CSP kaldırma kullanılmaz. Bu backend teslimi bu başlıkları gevşetmez. Misafir katılım sayfası da normal PDA login guard'ına yönlendirilmeyen ayrı public UI akışı gerektirir. Oturum cookie'si, canlı medya ve sohbet saklama tercihi kullanıcıya bu akışta açıklanmalıdır.

1. SDK beklenmeyen disconnect verdiğinde veya detay sorgusunda epoch değiştiğinde toplantı ID'sini, gündemi, sohbet görünümünü ve kullanıcının kendi medya niyetini koruyun.
2. Normal cookie/CSRF veya misafir scoped cookie ile yeniden join çağırın. 503 pending için Retry-After'a uyun, bounded exponential backoff kullanın; aynı katılımcıda 2 saniyeden sık token istemeyin. Proje detayında `reconnectRequired=true` pending rotasyonu gösterir; rotasyon tamamlandıktan sonra yeni `roomEpoch` değişiklik kanıtıdır.
3. Yeni URL/token ile SDK odasına bağlanın; eski token'ı ve room nesnesini bırakın. Kullanıcı başlatmadan tarayıcı cihaz izni istemeyin veya kimsenin mikrofon/kamerasını kendiliğinden açmayın. Önceki kendi yayın tercihini geri yüklemek ayrı istemci izin/UX kontrolüdür.
4. 401/403'te tekrar bağlanmayı durdurun; 409 MEETING_NOT_OPEN ve 404'te kapanmış/erişilemeyen oda durumunu gösterin. Bilinçli Leave, kicked/revoked veya End sonrasında otomatik join döngüsü başlatmayın.

Kısa medya kesintisi vardır; aynı veritabanı toplantı kaydı, gündem, takvim ve sohbet bu rotasyonda korunur. İstemciler açıkken yenilenmiş durumu periyodik REST sorgusuyla da uzlaştırmalıdır; kopmuş eski odanın data kanalından yeni oda bildirimi beklemeyin.

## Misafir daveti ve oturumu

- Üye kökünde `POST /{meetingId}/invites`, `{expiresAt,maxUses}` ile 201 `{id,token,expiresAt,maxUses}`. Bitiş gelecekte ve en çok 30 gün sonra; maxUses 1–100. Sır yalnız ilk yanıtta alınır, hash saklanır. Frontend gelecekte davet sırrını URL fragment'ında taşımalı, sunucuya yalnız POST gövdesiyle göndermeli ve fragment'ı işledikten sonra temizlemelidir; bu teslim bir public frontend davet sayfası oluşturmaz.
- `DELETE /{meetingId}/invites/{inviteId}`: 204. Yeni misafir session oluşturmayı hemen engeller. Kullanıcının açık onayıyla mevcut session'ları değiştirmez, canlı odadaki misafiri çıkarmaz ve epoch yenilemez. Bir misafiri çıkarmak ayrı kick işlemidir.
- Public `POST /api/v1/meetings/guest/session`, `{inviteToken,displayName}` ile 201 `{meetingId,participantId,expiresAt}`. CSRF gerekir. İsim 1–80 karakter, HTML/control karakterleri reddedilir. Toplantı OPEN olmalıdır. Kullanım sayısı meeting satır kilidi altında güncellenir; eşzamanlı single-use davet yalnız bir kez kullanılabilir.
- Session süresi en çok 12 saat ve davetin özgün expiresAt değerini geçmez. Sonraki davet iptali bu süreyi kısaltmaz. JSON'da session sırrı yoktur; `PDA_MEETING_GUEST` HttpOnly cookie, host-only, SameSite=Lax, Path=`/api/v1/meetings/guest/{meetingId}` ile yazılır. Üretimde Secure zorunludur. PDA_ACCESS veya authenticated principal üretilmez.

Scoped cookie ile kullanılabilen public yollar:

- `POST /api/v1/meetings/guest/{meetingId}/join`: 200 MeetingJoin.
- `GET /api/v1/meetings/guest/{meetingId}/participants`: 200 katılımcı dizisi.
- `GET /api/v1/meetings/guest/{meetingId}/chat?page=0&size=50`: 200 sohbet sayfası.
- `POST /api/v1/meetings/guest/{meetingId}/chat`: 201 ChatView.
- `POST /api/v1/meetings/guest/{meetingId}/leave`: 204, guest session revoke ve cookie silme. Gönüllü leave bir yönetici kick'i değildir; istemci eski token'ı atmalı ve SDK'yı kapatmalıdır.

Eksik guest cookie 401; başka meeting cookie'si, süresi dolmuş/yasaklı session 403; kapalı oda 409. Guest cookie genel proje/API erişimi vermez. Cookie path bir UX daraltmasıdır; backend hash+meeting eşleşmesini ayrıca doğrular. Süresi dolmuş session her API'de hemen reddedilir. Daha önce medya token'ı almış session'ın canlı medya erişimi worker tarafından revoke/oda yenilemeyle kaldırılır; normal tarama aralığı 10 saniyedir, sağlayıcı kesintisinde cleanup/retry gerekir. Hiç medya token'ı almamış expired session gereksiz oda yenilemez.

Anonymous kişi kimliğini biyometrik veya başka takip yöntemiyle doğrulamıyoruz. Çıkarılan kişi başka geçerli çok kullanımlı davet sırrıyla yeni anonim kimlik edinebilir. Bu riski azaltmak için maxUses=1 ve gerektiğinde davet iptali kullanın; mevcut eski token/session yasağı bununla karıştırılmamalıdır. Bekleme odası bu teslimde eklenmez.

## Sohbet, mention ve presence

Üye kökünde `POST /{meetingId}/chat`, `{content,mentionIds}` ile 201 ChatView; `GET /{meetingId}/chat?page=0&size=50` ile 200 sayfa. Misafir yolları yukarıdadır. Metin en çok 2000 karakterdir; boş/HTML/control içerik reddedilir, güvenilir HTML değildir. mentionIds null olamaz, boş olabilir, en çok 20; hedefler hem DB'de bağlı/yasaksız hem güncel SFU presence içinde olmalıdır. Yeni mesaj en sık 750 ms'de birdir. Geçmiş sayfası 0–1000, size 1–100; sıralama sentAt ve id azalandır.

ChatView alanları `id,participantId,displayName,content,sentAt,mentionIds` şeklindedir. Mention üyeye/guest'e ait katılımcı UUID'sidir, kullanıcı adı/e-posta değildir. İstemci metni düz text olarak render etmeli, HTML yorumlamamalıdır.

Backend doğrulanmış REST yazımı sonrasında yalnız sunucunun yayınlayabildiği LiveKit reliable data packet gönderir. Topic `pda.meeting`, JSON:

```json
{"type":"meeting.chat","meetingId":"<uuid>","messageId":"<uuid>"}
```

Bu bir invalidation olayıdır; sohbet REST kaynağından yenilenir. Packet teslimi kalıcı mesaj kuyruğu değildir. Reconnect sonrası da history yenileyin. Mevcut `/api/v1/ws` ve `/user/queue/chat` merkezi sohbet sözleşmesi değişmez; misafirlere bu WebSocket açılmaz.

Katılımcı join/leave/disconnect state'i doğrulanmış SFU webhook'ları ve 10 saniyelik authoritative RoomService uzlaştırmasından gelir. İstemci SDK'nın participant bağlantı/active-speaker olaylarını canlı ses göstergesi için kullanabilir; bunlar ayrı kalıcı konuşma günlüğü değildir. `ParticipantView.identity` ile SDK kimliğini eşleştirin. Kişisel ses seviyesi tamamen istemci davranışıdır.

Varsayılan `MEETING_RETAIN_CHAT=false`: sohbet toplantı boyunca PostgreSQL'de reconnect/history için tutulur, ENDED olduğunda silinir; audit yalnız action/kimlik/zaman tutar. true seçilirse chat metni DB'de kalır fakat bu teslimin history uçları yalnız OPEN ve bağlı katılımcılara açıktır; bitmiş sohbet arşivi için ayrı endpoint/UX yoktur. Saklama tercihi `chatRetained` alanıyla UI'da açıkça belirtilmelidir. Toplantı/katılım/takvim/audit geçmişi oda kapanınca silinmez; projenin açık kalıcı silme işlemi DB cascade ile bu kayıtları siler, bağımsız oda cleanup ledger'ı kalır.

## Bildirimler

Mevcut bildirim sisteminde `resourceType=MEETING`, resourceId=meetingId, projectId ve `MEETING_CREATED/UPDATED/CANCELLED/OPENED/OVERTIME/ENDED` türleri vardır. Her olayın anındaki aktif proje üyeleri, organizatör dahil, snapshot alıcılardır. Davet sırrı/medya token'ı bildirimde bulunmaz. Mevcut read/unread/liste/filtre davranışı korunur. Event UUID + recipient unique index ile replay duplicate üretmez. Modulith publication kaydı transaction'la kalıcıdır; AFTER_COMMIT fanout başarısız olursa yalnız meeting ailesi için 60 saniyelik, en çok 50 publication seçen recovery çalışır. Frontend bildirim linki seçili proje/meeting ID'sinden oluşturulur; bu görev bir frontend route'u eklemez.

## Hatalar ve oran sınırları

Domain hataları ProblemDetail ve `code` ile döner; detail genel ve sır içermez. Framework authentication/CSRF ve media availability hatalarında code bulunmayabilir, HTTP status fallback gereklidir.

- 400: bozuk JSON/UUID/enum, geçersiz tarih/aralık/sort/katılımcı/mention veya metin. Form alanlarını koruyun, otomatik retry yapmayın.
- 401: PDA oturumu veya guest cookie yok. Normal PDA oturumu için mevcut refresh akışını kullanın; guest cookie PDA refresh'e dönüştürülmez.
- 403: üyelik/PROJECT_MANAGER eksikliği, CSRF, `MEETING_PARTICIPANT_REVOKED`, `MEETING_GUEST_INVALID`, `MEETING_INVITE_INVALID`. Retry durur.
- 404: bulunamayan veya başka proje/meeting kapsamındaki kaynak. Gizli veri çıkarımı yapmayın.
- 409: `MEETING_NOT_OPEN`, `MEETING_NOT_SCHEDULED`, `MEETING_CLOSED`, `MEETING_FULL`, kilit/constraint çatışmasında `MEETING_CONFLICT`.
- 413: proje toplantı mutation'larında 196608, guest session için 2048, diğer guest mutation için 16384, webhook için 65536 byte gerçek gövde sınırı; chunked body de sayılır. Proje limiti en büyük gündem/açıklama JSON'unu barındırır, doğrulamadan önce sınırsız JSON ayrıştırmayı engeller.
- 429: guest session IP başına 10/dakika, diğer guest istekleri 120/dakika (`Retry-After:60`, bounded 10000 IP bucket); medya token mint 2 saniye, mesaj gönderimi 750 ms (`Retry-After:2` veya `1`). IP'ler mevcut trusted-proxy normalizer'dan gelir; rastgele X-Forwarded-For güvenilir sayılmaz. IP limitleri process-local'dır; çok replica için ingress'te ortak kota gerekir. Meeting/participant satır kilidi token/chat zaman sınırlarını instance'lar arasında korur.
- 503: `MEETING_DISABLED`, SFU unavailable veya `MEETING_RECONNECT_PENDING`. Pending rotasyonda Retry-After=10; provider hatasında kullanıcı verisi korunur ve bounded retry sunulur. Davet oluşturma/mesaj yazma gibi mutation'ları körlemesine tekrar etmeyin; belirsiz yanıtta REST state'i uzlaştırın.

Loading için isteği bekleyen UI state; empty için 200 boş liste; forbidden için 403; geçici servis kesintisi için 503 kullanılmalıdır. Ağ timeout'u mikrofon izni reddi değildir; cihaz izin reddi tarayıcı/SDK tarafında ele alınır.

## OpenAPI ve kabul kontrolü

Geliştirme/test ortamında mevcut `API_DOCS_ENABLED` zaten açıksa `/swagger-ui/index.html` veya `/v3/api-docs` kullanılır. Üretimde sırf incelemek için açmayın. OpenAPI entegrasyon testi gerçek route'ları, MeetingView alanlarını ve guest session yanıtında secret/token bulunmamasını kontrol eder.

Normal cookie login → csrf → toplantı oluştur → start → join → participants → chat akışı, proje üyesi olmayan hesabın reddi ve PROJECT_MANAGER olmayan organizatörün mute/kick/end reddi kontrol edilmelidir. Misafir için csrf → invite token POST → scoped cookie → join; davet iptalinden sonra yeni session reddi fakat mevcut session devamı; kick sonrası eski token/session reddi ve kalan katılımcılar için yeni epoch akışı kontrol edilir.

Testcontainers adapter/RoomService doğrulaması tarayıcılar arası ses, kamera, ekran paylaşımı, otomatik SDK reconnect veya mobil veri/TURN testi anlamına gelmez. Bunlar frontend ve üretim ağ hazırlığı tamamlandığında manuel kabul adımlarıdır.
