# PDA — Toplantı Sistemi | Nihai FRONTEND Uygulama Promptu

> **Çalışma kapsamı:** Bu prompt **backend toplantı API'leri ve realtime/SFU altyapısı tamamlandıktan sonra** uygulanacaktır. Yalnızca Next.js/TypeScript UI, sidebar, takvim, sayfalar, toplantı odası, tarayıcı cihaz yönetimi, chat ve arayüz testleri kapsamındadır. **Backend iş mantığını yeniden yazma, yeni endpoint uydurma veya migration ekleme.** Eksik backend sözleşmesi varsa blokajı somut biçimde bildir.

## Codex'e görev

PDA'nın mevcut frontend repository'sini ve backend'den teslim edilmiş **OpenAPI + realtime event sözleşmesini** incele. Daha önce tasarlanan PDA dark tema dashboard görünümüyle tutarlı, estetik, erişilebilir, mobil uyumlu ve tamamen çalışan toplantı deneyimini geliştir. Önce backend uyumluluğunu doğrula; ardından UI'ı gerçek API'ler ve SFU istemci SDK ile bağla. Sahte veri, demo görüşme, maket buton veya çalışmayan akış bırakma.

## Başlamadan önce zorunlu önkoşullar

1. Backend toplantı endpoint'leri, yetki matrisi, guest invite akışı, notification ve calendar sözleşmesi mevcut olmalı.
2. SFU bağlantısı için erişilebilir gerçek servis/test ortamı, token alma endpoint'i ve gerekli WSS/TLS/ICE/TURN konfigürasyonu bulunmalı.
3. Realtime chat/presence event şemaları ve server davranışları dokümante edilmiş olmalı.
4. Eksik veya çelişkili sözleşmeleri inceleyip raporla. Mevcut backend'i sessizce değiştirerek işi genişletme; yalnız uyumlu frontend implementasyonuna devam et.

## Teknik bağlam ve değişmezler

PDA'nın onaylı teknik planına göre:

- Mimari: **Spring Modulith ile Modular Monolith**. Domain sınırları korunur; modüller diğer modüllerin repository'lerine doğrudan erişmez.
- Backend: **Java 25 LTS, Spring Boot 4.1.1, Spring MVC/REST, Spring Security, Spring Data JPA/Hibernate, Flyway, PostgreSQL, Maven Wrapper**.
- Frontend: **Next.js App Router, TypeScript, Tailwind CSS, feature-based mimari**.
- API: `/api/v1/...`; OpenAPI geliştirme/test ortamında.
- Authentication: HttpOnly cookie ile access/refresh JWT, CSRF ve CORS kontrolleri; browser storage içine token yazılmaz.
- Proje bazlı roller: `PROJECT_MANAGER`, `BACKEND_ENGINEER`, `FRONTEND_ENGINEER`, `FULL_STACK_DEVELOPER`, `TESTER`, `UI_DESIGNER`; kullanıcıların proje başına birden çok rolü olabilir.
- Kalıcı bildirim modülü, Türkçe/İngilizce, light/dark/system tema, responsive navigasyon, Docker Compose ve test standartları korunur.
- V1 planında realtime/meeting sistemi zorunlu değildir: **bu talep yeni bir feature genişletmesidir**, çekirdek tasarım kararlarını sessizce değiştirme.
- **Mevcut repository gerçek kaynak otoritesidir**: burada yazılan versiyon veya klasör varsayımları repo ile farklıysa mevcut çalışan yapıyı incele, farkı raporla ve uyumlu biçimde uygula.

## Hedef ürün davranışı

PDA sidebar'ında seçili proje altında **Toplantılar > Toplantı Oluştur / Toplantılarım / Toplantı Takvimi** yer alacak. Kullanıcı toplantıyı hemen başlatabilecek veya tarih/saat/gündem belirleyerek planlayabilecek. Planlanan toplantı PDA takvimine yansıyacak ve proje üyelerine uygulama içi bildirim gidecek. Planlanan başlangıçta oda otomatik açılacak. PDA içindeki web arayüzünden **gerçek zamanlı ses, kamera, ekran paylaşımı, katılımcı listesi, toplantıya özel sohbet, @mention, kişisel ses seviyesi ayarı** çalışacak. Hesabı/proje üyeliği olmayan davetli güvenli misafir bağlantısıyla katılabilecek. **Başka katılımcının mikrofonunu susturma ve katılımcıyı çıkarma yalnızca PROJECT_MANAGER** yetkisiyle çalışacak. Her kullanıcı kendi mikrofonunu açıp kapatabilecek; moderatör uzaktan kimsenin mikrofonunu izinsiz açamayacak. Planlanan bitiş saati geçince uyarı verilecek ama toplantı kapanmayacak. Moderatör herkes için bitirdiğinde veya oda politikaya göre boş kaldığında canlı oda ve medya kaynakları temizlenecek; tarihçe/takvim kaydı korunacak.

### Mimari tercihleri açıklığa kavuştur

- **Medya aktarımını REST API veya sıradan WebSocket üzerinden taşımaya çalışma.** WebRTC tabanlı ses/video/ekran paylaşımı kullan; çok katılımcılı oturumlarda **SFU mimarisi** tercih et. Mevcut repo veya barındırma durumuna göre **self-hosted LiveKit** (önerilen örnek) ya da eşdeğer üretim destekli bir WebRTC SFU çözümü değerlendir. Projeye entegrasyonun kolaylığını, Docker çalıştırılabilirliğini, açık kaynak lisansını, maliyetini ve operasyonel gereksinimleri belgele. Mevcut Spring Boot servisini signaling/media sunucusu gibi sıfırdan yeniden yazma.
- Görüşme odaları **geçici medya kaynaklarıdır**; `Meeting` kaydı, takvim girdisi, bildirimler ve denetim kayıtları **kalıcı** olabilir. Odanın bitmesi veritabanı geçmişinin silinmesi anlamına gelmez.
- Toplantı özel chat için güvenilir server-side erişim kontrolü olan gerçek zamanlı kanal kullan. Seçilen SFU'nun data channel özellikleri yeterliyse güvenilirlik/geçmiş gereksinimlerine göre değerlendir; değilse Spring tabanlı WebSocket/STOMP veya mevcut realtime altyapısına uyumlu alternatif uygula. Kalıcılık politikasını açıkça belirle.
- Takvim ve bildirim sistemlerini **yeniden icat etme**; mevcut modüller varsa sözleşmelerinden yararlan. Takvim henüz yoksa toplantı etkinliklerini gösterebilecek en küçük uyumlu entegrasyonu ekle.
- Varsayılan davranış: toplantı odası planlanan başlangıçta otomatik oluşturulur/açılır; katılımcıların mikrofon/kamerası **kendiliğinden açılmaz**. Kullanıcı izinleri yalnız tarayıcı üzerinden verilir. Oda açılışında herkesin otomatik katılması söz konusu değildir.
- Zamanları DB'de UTC `Instant`/eşdeğer olarak sakla; takvimde kullanıcı zaman diliminde görüntüle. Scheduled işleri tek instance ve birden fazla replica senaryolarında **idempotent** tasarla. Restart sonrası kaçırılan planlı toplantıları telafi et.

---

## Tasarım ve ürün kararları

- Sidebar'da seçili proje altında **Toplantılar** grubu ve **Toplantı oluştur**, **Toplantılarım**, **Toplantı takvimi** öğeleri yer alsın. Mevcut sidebar hiyerarşisi ve responsive drawer davranışı korunsun.
- Toplantı oluşturma formu: ad, açıklama, katılımcılar, tür (çevrim içi/fiziksel/hibrit desteği backend'de varsa), tarih, başlangıç/bitiş, tekrar, gündem ve davet yönetimi; backend'in desteklemediği alanı sahte işlev gibi gösterme.
- Canlı odada: kendi mikrofonunu aç/kapat, kamera aç/kapat, ekran paylaş, katılımcı listesi, kişisel kullanıcı ses ayarı, toplantıya özel chat/@mention ve toplantı süresi izleme.
- Diğer katılımcıyı zorla mute etmek veya çıkarmak yalnız PROJECT_MANAGER için gösterilsin; backend 403/permission durumunu yine de güvenle işle. Başka kişinin mikrofonunu uzaktan açma özelliği ekleme.
- PDA hesabı bulunmayan davetli için güvenli guest join akışı yap; proje sayfaları veya login zorlamasıyla gereksiz engel koyma. Süresi dolmuş/iptal edilmiş linkleri açıkça göster.
- Planlanan başlangıçta oda otomatik hazırlanır ama kullanıcıya otomatik kamera/mikrofon açılmaz; tarayıcı izinleri kullanıcı etkileşimiyle istenir.
- Planlanan bitiş saati geçince kullanıcıyı uyar, ancak bağlantıyı kapatma ve otomatik end işlemi tetikleme.
- Light/dark/system tema, Türkçe/İngilizce çeviriler, klavye erişimi, prefers-reduced-motion ve PDA ortak bileşenleri ile uyumlu ol.

## Entegrasyon ilkeleri

- Backend'in gerçek endpoint ve DTO'larını kullan; merkezi typed API client ve tutarlı hata/kimlik doğrulama yönetimi sağla.
- JWT/auth bilgisini localStorage veya sessionStorage'a yazma; mevcut HttpOnly cookie + CSRF akışını koru.
- SFU SDK'sı için ekran/cihaz izinleri, permission denial, reconnect, track cleanup, farklı ses çıkış aygıtları ve sekme kapatma durumlarını ele al.
- Sunucu tarafından gelen participant presence/moderation/end olaylarını işleyerek UI durumunu güncelle; yalnız istemci state'ini gerçek durum sanma.
- Guest token ve meeting invitation linklerini loglara, analytics'e veya yanlışlıkla üçüncü taraf linklerine sızdırma.
- Toplantı erişimi sona erdiğinde medya track'lerini temizle; history/takvim kayıtlarını silme.

# FAZ 0 — Frontend keşfi ve backend sözleşmesini doğrulama

## Adım 01 — Ön inceleme ve sözleşme uyumluluğu
1. Next.js route, feature-based klasör, sidebar, takvim, bildirim, tema, çeviri ve auth kullanımını incele.
2. Backend OpenAPI, error response, endpoint yetkileri ve SFU/chat handshake sözleşmesini oku; typed client ve SDK gereksinimlerini belirle.
3. Var olan tasarım sistemini ve kullanıcının onayladığı toplantı oluşturma ekranını temel al; gerekiyorsa mevcut layout kurallarına uyarlama yap.
4. Backend sözleşmesinde eksik kritik nokta varsa açıkça belgeleyerek kullanıcıya bildir; backend feature implementasyonuna başlama.

# FAZ 1 — Arayüz ve entegre kullanıcı akışları

## Adım 02 — Sidebar, routing ve temel sayfalar
1. Seçili proje menüsüne **Toplantılar** grubu ve **Toplantı Oluştur / Toplantılarım / Toplantı Takvimi** linklerini ekle.
2. Yeni route'ları mevcut Next.js App Router ve feature klasör düzenine uygun oluştur.
3. Aktif menü, breadcrumb, 403/404, loading/empty/error durumlarını uygulamaya entegre et.
4. Masaüstü sidebar ve mobil drawer davranışlarını bozma.

## Adım 03 — Toplantı oluşturma ekranı
1. Görsel referansa yakın, PDA'nın mevcut dark/light tasarım sistemiyle uyumlu profesyonel layout oluştur.
2. Ana sütun: **Temel Bilgiler** (başlık/açıklama), **Toplantı Türü** (çevrim içi), **Tarih ve Saat**, **Gündem** ve gerekli seçenekler.
3. Yan sütun: proje üyeleri için arama/seçim, takvim özeti, gündem maddeleri ve oluşturma aksiyonları.
4. Tarih, başlangıç/bitiş saatini saat dilimi farklarını dikkate alarak doğrula; form sunucu validation'ıyla eşleşsin.
5. **Hemen Başlat** ve **Toplantı Planla** akışlarını net ayır; draft özelliği yalnız backend'de gerçek destek varsa sun.
6. Form submit sonucunda gerçek API kaydı, takvim ve bildirim oluşturulsun; sahte toast veya sabit mock veri kullanma.

## Adım 04 — Toplantı listesi ve detay ekranı
1. Yaklaşan, canlı, geçmiş ve iptal edilmiş toplantılar için filtrelenebilir liste hazırla.
2. Detayda başlık, gündem, oluşturucu, proje, katılımcılar, başlangıç/bitiş saati, durum, **Katıl** ve (yetkiliyse) **Düzenle / İptal Et / Herkes İçin Bitir** göster.
3. Planlanan bitiş saati geçtikten sonra **Devam ediyor — planlanan süre aşıldı** uyarısı göster, toplantıyı otomatik sonlandırma.
4. Toplantı bitmişse eski medya token'ı ya da oda bağlantısıyla yeniden giriş yaptırma.

## Adım 05 — Takvim entegrasyonu
1. Mevcut PDA takviminde planlanmış toplantıları etkinlik olarak göster.
2. Gün/hafta/ay görünümünde var olan yapı neyi destekliyorsa onu kullan; aynı etkinlik birden fazla kopya olmasın.
3. Takvim etkinliğine tıklayınca toplantı detayına git; uygun zamanda katılım seçeneğini sun.
4. Saat dilimi, gün değişimi, çok yakın tarihler ve saat formatlarını doğru göster.

## Adım 06 — Canlı toplantı odası düzeni
1. Google Meet'ten esinlenen ancak PDA görsel diliyle tutarlı, özgün bir **toplantı odası** arayüzü tasarla.
2. Ana alan: aktif konuşmacı/video grid veya ekran paylaşımı; alt toolbar: mikrofon, kamera, ekran paylaşımı, katılımcılar, chat, ayrılma.
3. Yan panel: katılımcı listesi, moderasyon menüsü, sohbet ve @mention önerileri.
4. Kişinin kendisini mute/unmute etmesi ile moderatörün başkasını susturması UI'da açıkça ayrı eylemler olsun.
5. Responsive mobil düzen, erişilebilir klavye kullanımını, tooltip ve focus durumlarını ekle.

## Adım 07 — WebRTC cihaz ve medya yönetimi
1. Seçilen SFU'nun resmi client SDK'sını kullanarak gerçek mikrofon, kamera ve ekran paylaşımını bağla.
2. Browser izin istemleri, cihaz seçimi, cihaz değişikliği, izin reddi, cihaz bulunamaması ve ekran paylaşımının browser tarafından durdurulmasını işle.
3. İstemciye medya token'ını sadece server-side yetkilendirme sonrası al; token'ı localStorage'a kaydetme.
4. Katılımcı için **kişisel ses seviyesi slider'ı** ekle: etkisi yalnız slider'ı kullanan istemcide olsun, diğer kullanıcıların yayın gain'i değişmesin.
5. Ayrılırken/odası bitince medya track'lerini ve bağlantıları temizle; kamera/mikrofon arka planda açık kalmasın.

## Adım 08 — Mesajlaşma, mention, presence ve moderasyon UI
1. Gerçek zamanlı chat panelini bağla; aktif katılımcıya `@` ile mention önerisi sun.
2. Anlık katılımcı giriş/çıkışını, konuşmacıyı ve gerekli bağlantı durumlarını göster.
3. `PROJECT_MANAGER` kullanıcısına diğer katılımcılar üzerinde **Sessize Al** ve **Toplantıdan Çıkar** seçenekleri göster; çıkarma işleminde onay diyaloğu kullan.
4. UI'da gizlenen butonların yetki güvenliği sağlamadığını kabul et; backend `403` hatasını doğru göster.
5. Çıkarılan katılımcıya nedenini belirsiz bırakmayan uygun durum ekranı göster ve yeniden katılım politikasını uygula.

## Adım 09 — Misafir katılım akışı
1. Toplantı detayındaki **Davet bağlantısı oluştur/kopyala/iptal et** akışını gerçek API'ye bağla.
2. Guest landing ekranında toplantı adı, girilecek görünen ad, mikrofon/kamera önizleme ve **Katıl** aksiyonu sun.
3. Misafir için PDA login veya proje üyeliği isteme; fakat link süresi, kullanım politikası ve güvenlik kuralları geçerli olsun.
4. Geçersiz, süresi bitmiş, iptal edilmiş, bitmiş toplantı ve uzaklaştırılmış misafir durumlarını anlaşılır biçimde işle.
5. Davet linkini kopyalarken kullanıcıya açık bir onay ver; secret'ı analytics/loglara taşımamaya dikkat et.

## Adım 10 — Süre takibi ve bildirim deneyimi
1. Toplantı odasında hem **geçen süreyi** hem **planlanan bitişe kalan süreyi** sun.
2. Planlanan saat dolunca dikkat çekici fakat engellemeyen **“Planlanan toplantı süresi aşıldı”** uyarısı göster; gerekli in-app bildirim davranışıyla birleştir.
3. Bildirimin tekrar tekrar üretilmesini engelle; yeniden bağlanma/refresh sonrasında gerçek saatten tekrar hesapla.
4. Süre aşıldı diye çağrıyı kapatma; kullanıcı istediği kadar devam edebilsin (yalnız explicit end/boş oda politikası sınırı içinde).

## Adım 11 — Dil, tema, erişilebilirlik ve mikro-etkileşimler
1. Tüm yeni metinleri Türkçe ve İngilizce localization sistemine ekle; hardcoded tek dilli string bırakma.
2. Dark/light/system görünümünde kontrast, form alanları, dialog ve toast bileşenlerini kontrol et.
3. Küçük ekran, tablet, masaüstü; klavye, ekran okuyucu ve düşük bağlantı senaryolarını iyileştir.
4. Reconnect/loading/empty/error/busy state'lerde tutarlı UI göster; animasyonları cihaz performansını ve reduced-motion tercihini gözeterek kullan.

# FAZ 3 — Test, dağıtım ve teslimat

# FAZ 2 — Frontend test ve teslimat

## Adım 12 — Frontend ve uçtan uca testler
1. TypeScript type-check, lint ve build işlemlerini tamamla.
2. Playwright E2E ile toplantı oluşturma, planlama, takvim yansıması, bildirim, join/leave, misafir katılımı, moderation 403 ve bitiş akışlarını test et.
3. **Gerçek tarayıcı ve çalışır SFU ile** en az iki katılımcı arasında mikrofon sesi, kamera, ekran paylaşımı ve chat için manuel/otomatik smoke test tanımla.
4. Tarayıcının mikrofon izinleri ve gerçek ses cihazları CI'da sınırlıysa bunu raporla; test edilmemiş senaryoyu geçmiş gibi gösterme.

## Adım 13 — Frontend kalite, uyumluluk ve teslimat
1. Toplantı ve mevcut dashboard/navigation akışları için regresyon kontrolü yap.
2. Bütün butonların ve formların gerçek backend/SFU akışına bağlandığını doğrula; mocked production akışı bırakma.
3. Backend API'lerinin status/error dönüşleri, guest permissions ve cihaz izinlerini farklı tarayıcı/donanım koşullarında test et.
4. Son raporda değişen dosyalar, yeni route'lar, kullanılan endpointler, ENV gereksinimleri, build/test sonuçları ve eksikler yer alsın.


## Frontend tamamlanma kriterleri

- [ ] Sidebar menüleri gerçek sayfalara bağlanır ve mevcut navigasyon bozulmaz.
- [ ] Toplantı oluşturma, düzenleme, katılma ve bitirme akışları backend'e bağlıdır.
- [ ] Takvim ve bildirimlerden toplantı detayına/odaya doğru geçiş yapılır.
- [ ] SFU ile gerçek mikrofon, kamera, ekran paylaşımı, reconnect ve track cleanup çalışır.
- [ ] Katılımcı listesi, kişisel ses seviyesi, toplantı chat'i ve @mention entegredir.
- [ ] Manager-only moderasyon UI'ı ve backend 403 durumları doğru yönetilir.
- [ ] Hesapsız davetli güvenli ve kısıtlı guest join deneyimiyle katılabilir.
- [ ] Bitiş saati uyarısı toplantıyı kapatmaz.
- [ ] Responsive, light/dark/system, TR/EN, keyboard ve screen-reader kontrolleri tamamdır.
- [ ] Frontend test/lint/type-check/build ve gerçek servis smoke test sonuçları raporlanır.
- [ ] Backend tarafında gereksiz değişiklik yapılmaz.

## Uygulamaya başla

Mevcut frontend ve backend sözleşmelerini doğrula, sonra aşağıdaki frontend adımlarını sırayla uygula. Sonuçta gerçek ekranları, entegre akışları, test sonuçlarını, gerekli ENV ayarlarını ve çözülmemiş bağımlılıkları raporla.
