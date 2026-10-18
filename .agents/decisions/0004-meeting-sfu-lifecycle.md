# ADR 0004 — Toplantı SFU ve erişim iptali yaşam döngüsü

Durum: Kabul edildi; kullanıcı onayı 2026-10-18 tarihli oturumda alındı.

## Bağlam

Toplantı backend'i mevcut Spring Modulith'e yeni bir feature olarak eklenir. Spring Boot medya sunucusu olmaz; toplantı kaydı, bildirim ve takvim kalıcı, WebRTC odası geçicidir. Mevcut cookie/CSRF/CORS, ProjectAccess ve Notification sözleşmeleri korunmalıdır. Frontend ayrı teslimdir.

## Karar

Self-hosted LiveKit, gerçek RoomService Twirp adaptörü ve kısa ömürlü, tam oda kapsamlı JWT ile kullanılır. İstemciye yönetim, oda oluşturma veya data publishing yetkisi verilmez. Mesaj yazımı yetkili REST'ten geçer; server-only reliable data packet yalnız geçmişi yenileme olayıdır. SFU'da `room.auto_create=false` ve `room.enable_remote_unmute=false` zorunludur.

Self-hosted LiveKit RemoveParticipant, mevcut medya token'ını iptal etmez. Kullanıcı bu nedenle aşağıdaki ayrımı açıkça onayladı:

- PROJECT_MANAGER katılımcıyı çıkardığında ban ve pending eski oda adı önce commit edilir. Oda doğrulanmış biçimde silinip yeni epoch oluşturulmadan başarılı çıkarma cevabı veya yeni join token'ı verilmez. Hata 503 ve kalıcı retry üretir. Başlık, takvim, gündem ve sohbet aynı meeting kaydında kalır.
- Davet iptali yalnız yeni guest session oluşturmayı engeller. Var olan session kendi ilk expiry süresine kadar devam eder; sırf invite revoke edildi diye oda yenilenmez. Mevcut misafiri çıkarmak ayrı moderasyon işlemidir.
- Guest session süresi dolması ve aktif üyelik/hesap kaybı API erişimini engeller; önceden verilmiş medya erişimi de worker/üyelik olayıyla ban ve gerektiğinde aynı epoch mekanizması üzerinden kaldırılır. Hiç medya token'ı almamış guest expiry oda kesintisi üretmez.

Guest session ayrı HttpOnly/Secure/SameSite=Lax, meeting-path cookie'sidir ve PDA principal'ı oluşturmaz. Davet/session sırları hash olarak saklanır. Browser mutation'ları mevcut CSRF stratejisini kullanır; yalnız tam imzalı webhook POST yolu istisnadır. Yeni ENV ve public guest/webhook sözleşmeleri kullanıcı tarafından onaylanmıştır.

Planlanan bitiş yalnız overtime bildirimi üretir. Asıl bitiş PROJECT_MANAGER veya belgelenmiş boş oda toleransıyla olur. Scheduler DB satır kilidi, kalıcı pending state, idempotent oda adları ve retry kullanır. Bildirim fanout'u kalıcı Modulith publication ve event/recipient dedup ile çalışır. Proje silinince bağımsız oda cleanup tombstone'u kalır.

## Sonuçlar ve sınırlar

Çıkarma sırasında diğer katılımcılarda kısa medya kesintisi gerekir. Yeni token ve roomEpoch ile otomatik reconnect, sonraki frontend SDK görevinde uygulanıp test edilir; backend bunu tek başına gerçekleştirmiş sayılmaz. SDK token expiry mevcut bağlantıyı sonlandırmaz; uygulama session expiry ile karıştırılmaz. Normal uzlaştırma aralığı 10 saniyedir, provider kesintisinde gerçek medya kaldırma retry başarısına bağlıdır. Başarısız kick başarılı olarak raporlanmaz.

Cloud token revocation veya ayrı signaling admission gateway kesintiyi azaltabilir; bunlar ek sağlayıcı/altyapı kararıdır ve bu teslimde eklenmez. Bu kararın güvenlik sınırı sunucunun auto-create kapalı yapılandırmasına bağlıdır; onu açmak sıradan operasyon değişikliği sayılamaz.

Canlı ses/görüntü, mikrofon izni, gerçek iki ağ, TURN ve otomatik frontend reconnect doğrulaması ayrı kabul adımlarıdır. Medya varsayılan kapalı ve deployment secret'ları boştur. Referanslar: `docs/meeting-backend-handoff.md`, `docs/meeting-media-operations.md`, `.agents/SECURITY.md` bölüm 11; [LiveKit token lifecycle](https://docs.livekit.io/frontends/reference/tokens-grants/).
