# MSF-01…04 — Toplantı arayüzü yeniden tasarımı (frontend)

Dal: `meeting-system-frontend` (yerelde `origin/main` ile aynı ucu gösteriyordu; V54 e-posta hatırlatma migration'ı bu tabanda vardır). Dosya adı kullanıcının verdiği yola göre `2026-10-22` ile verilmiştir; çalışma 2026-10-23'te yapıldı.

## Önemli sınır: referans görseller

Görevde üç referans görsel anıldı, ancak **görsel dosyaları bana iletilmedi**; yalnız metin tarifleri vardı. Bu yüzden tasarım, görev metnindeki yerleşim/bileşen tariflerine göre uygulandı ve **referans görsellerle piksel/oran karşılaştırması yapılmadı**. Karşılaştırma yerine, gerçek uygulamanın 320/375/768/1024/1440 px × açık/koyu ekran görüntüleri alınıp incelendi. Görseller gelirse sağ panel genişliği, filmstrip yüksekliği ve kart oranları gibi sayısal ayarlar ayrıca karşılaştırılmalıdır.

## Tamamlanan kapsam

- **MSF-01 Oluştur/Düzenle:** solda Temel bilgiler (başlık sayacı, çok satırlı genişleyen açıklama), Tarih ve saat (Başlangıç | Bitiş sütunları, ortak `DatePicker`/`TimePicker`), Gündem (opsiyonel; Enter yeni madde, silme, 30 madde); sağda aranabilir/avatarlı katılımcı paneli (organizatör sabit, `n / toplam` sayacı), `Toplantı planla` ve `Hemen başlat`. Düzenleme aynı formu mevcut değerlerle doldurur. Satır içi hatalar: başlık, bitiş ≤ başlangıç, 24 saat, geçmiş, mevcut olmayan (DST boşluğu) saat. Çevrim içi bilgi satırı kullanıcı isteğiyle sonradan kaldırıldı; çalışmayan bir toplantı türü sunulmaz. Aynı istekle görüşme odası sayfasında breadcrumb ("Projeler › proje adı") gizlendi. `Hemen başlat` yalnız oluşturma + gerçek `start` çağrısıdır (başarısız başlatma tekrar toplantı oluşturmaz).
- **MSF-02 Liste:** başlık + açıklama + mavi `Toplantı oluştur`; Tümü/Planlandı/Canlı/Bitti/İptal edildi sekmeleri gerçek sayılarla (768 px altında aynı state'li ortak `Select`); geniş arama; Takvim bağlantısı; sıralama (Yaklaşan/En yeni/En eski); Bugün/Yarın/Sonraki günler/Geçmiş hafta/Daha eski grupları; 10'luk sayfalama. Durum, arama, sıralama ve sayfa URL'dedir; Geri/İleri ve yenileme çalışır; geçersiz değer güvenli varsayılana döner. 15 sn polling korunur.
- **MSF-03 Kart/Detay:** yatay kompakt kart (ikon, ad, durum, proje, katılımcı sayısı, avatar yığını, tarih/saat/süre, duruma bağlı `Katıl`/`Detay`, ⋯ menüsü: detay, düzenle, bağlantıyı kopyala, iptal et, herkes için bitir — yetkiye göre, yıkıcı olanlar onay ister). Canlı kart mavi konturlu, canlı süre ve kalan/aşım bilgisi taşır. Detay sayfası aynı dil: tarih/saat/süre, gündem (numaralı), planlanan katılımcılar, canlı katılımcılar, aksiyonlar, misafir davetleri.
- **MSF-04 Oda:** başlık + durum + katılımcı sayısı + geçen süre + planlanan bitiş, küçült (geri) düğmesi, bağlantıyı kopyala, `Herkes için bitir` (yalnız organizatör); solda büyük sahne (ekran paylaşımı öncelikli, `object-contain`, tam ekran, odak seçimi, ızgara görünümü) ve altında yatay filmstrip; sağda Katılımcılar/Sohbet sekmeli panel (arama, rol/mikrofon durumu, kişi bazlı yerel ses, moderasyon, `Davet et`, `Bağlantıyı kopyala`; sohbette avatar, zaman, otomatik aşağı kaydırma, "Yeni mesajlar" atlama düğmesi); altta ortada yüzen kontrol çubuğu (mikrofon, kamera, ekran, katılımcılar, sohbet, cihazlar, diğer, ayrıl). Kapalı mikrofon/kamera uyarı tonu + çizgili ikonla, açık olanlar mavi gösterilir. Mobil (`compact`) yerleşim önceki davranışı korur.
- **Gürültü azaltma:** mikrofon `echoCancellation`/`noiseSuppression`/`autoGainControl` kısıtlarıyla açılır; tarayıcı `noiseSuppression` destekliyorsa Cihazlar panelinde anahtar çıkar ve açık parçayı yeniden başlatır (gerçek `getSettings()` değeri testte true→false→true). Konuşma göstergesinden bağımsızdır; üçüncü taraf servis yok.

## Korunan işlevler

LiveKit Room/token/track yaşam döngüsü, `MeetingSessionProvider`/`SessionRunner`/`MeetingMiniBar` (görüşme sayfa değişince sürer, mini bardan mikrofon/kamera ve dönüş), ön test ekranı ve cihaz seçimi, ekran paylaşımı hata açıklamaları, kişi bazlı ses (0–100, yerel), mute/kick ayrımı ve yetkileri, organizatör bitirme politikası, misafir davetleri, logout'ta medya temizliği, epoch yeniden bağlanma, tek oturum, hatırlatma sistemi. Token'lar yalnız bellekte; loglanmaz/URL'ye yazılmaz.

## Yeni / değişen bileşenler

Yeni: `meeting-card.tsx`, `meeting-list.ts` (URL durumu, gruplama, sıralama, arama), `meeting-schedule.ts` (saf zaman kuralları), `room/room-stage.tsx`, `room/invite-dialog.tsx`, `room/use-media-query.ts`. Değişen: `meetings-page.tsx`, `meeting-form.tsx`, `meeting-detail.tsx`, `meeting-room.tsx`, `room/room-controls.tsx`, `room/room-panels.tsx`, `room/participant-tile.tsx`, `session/meeting-mini-bar.tsx`, `use-meeting-room.ts`, `shared.tsx`, `api.ts` (`listAll`), `components/ui/button.tsx` (`accent` varyantı), `app/globals.css` (`--meeting*` token'ları), `i18n/meetings/{tr,en,de}.json`, `(app)/projects/[slug]/meetings/page.tsx` (Suspense). Testler: `meeting-redesign.spec.ts` (5 yeni), `meeting-schedule-logic.spec.ts` (4 yeni), `meeting-fixture.ts` (`showPanel`), mevcut üç spec ve `playwright.meetings.config.ts` güncellendi. Tasarım özeti: `.agents/frontend-design-rules.md` ve `.agents/architecture.md`.

## Backend

**Değişiklik yok; ikinci branch'e commit atılmadı.** Gerekçe: liste araması/sayımı için backend'e yeni parametre eklemek yerine proje toplantılarının tamamı (100'lük sayfalar, en çok 20 sayfa) mevcut `GET …/meetings` ile alınıp istemcide işlenir; gündem, katılımcılar, davet, sohbet ve moderasyon mevcut API'lerle çalışır. V54: yerel Flyway geçmişinde `54 meeting email reminders` başarılı; formdan oluşturulan toplantılar `meeting_reminder_deliveries` kuyruğuna girdi (PENDING/SENT/CANCELLED kayıtları görüldü). Form payload'ı (`startsAt`/`endsAt` ISO, `zoneId`, `agenda`, `attendeeIds`) değişmedi.

## Çalıştırılan doğrulama

| Komut | Sonuç |
|---|---|
| `npm run lint` (tüm frontend) | 0 hata |
| `npx tsc --noEmit` | 0 hata |
| `npm run build` | başarılı |
| `npm run check:bundle` | tüm rotalar bütçe içinde |
| `playwright test --config=playwright.meetings.config.ts` (üretim derlemesi, gerçek API/PostgreSQL/LiveKit, Chromium + sahte medya cihazı) | **37/37 geçti** (32 mevcut + 5 yeni) |
| `playwright test e2e/meeting-schedule-logic.spec.ts` | 4/4 geçti |
| `git diff --check` | commit öncesi çalıştırıldı |

Yeni testler: liste (sayılar, filtre, URL, Geri/İleri, arama, sıralama, gruplar, tek kart/toplantı, duruma ve role göre aksiyonlar, üye için yetkisiz aksiyonların gizlenmesi, telefonda Select, axe açık+koyu), sayfalama (10+2, URL, filtre sıfırlar), form (zorunlu başlık, Enter ile gündem, katılımcı arama/sayaç/organizatör, gerçek payload, `Hemen başlat` tek toplantı + OPEN, 320 px, axe), iki gerçek katılımcılı oda (sahne/filmstrip/odak/otomatik dönüş, ekran paylaşımı sahneye `object-contain`, ızgara, sekmeler, bağlantı kopyalama, gerçek misafir daveti ve yalnız metadata, üyede davet/bitir yok, küçültünce mini bar, axe), mikrofon kısıtları. Saat dilimi testleri Europe/Istanbul, America/New_York (ilkbahar boşluğu reddi, sonbahar çakışması), Europe/Berlin (23 saatlik gün + 24 saat sınırı), Pacific/Auckland için ayrı TZ'li süreçlerde çalışır.

Mevcut spec'lerde yapılan düzeltmeler (davranış kararı gereği): panel geniş ekranda açık başladığı için çubuk düğmesi artık kapatıyor → `showPanel` yardımcısı; panel avatarları video alanıyla aynı fotoğrafı gösterdiği için fotoğraf sorguları video alanına daraltıldı; detay sayfasının "Planlanan katılımcılar" başlığı; telefon paneli artık başlık yerine sekme gösterir. İlk koşuda geliştirme sunucusunun hata katmanı mobil düğmelerin üstünü kapattığı için testler üretim derlemesine karşı koşturuldu.

## Erişilebilirlik / responsive / tema

- axe (WCAG 2.x AA kuralları): liste, oluştur, düzenle, detay sayfaları açık+koyu **0 ihlal**; oda (Katılımcılar ve Sohbet sekmeleri) koyu 0 ihlal; oda ve form açık tema testlerde 0 ihlal.
- Taşma: liste/oluştur/detay 320, 375, 768, 1024, 1440 px × açık/koyu yatay taşmasız; oda mevcut testle 320×640, 375×667, 390×844, 430×932, 768×1024, 1024×768 ve 844×390'da taşmasız, çubuk düğmeleri ≥ 44 px.
- Klavye: sekmeler/menü/Select/dialog ortak bileşenlerle; Enter ile gündem; sahne ve filmstrip kartları gerçek `button`'dır (odak halkası), Escape paneli kapatır.
- Ekran görüntüleri incelendi (açık/koyu, 1440/1024/768/390): liste, form, detay ve oda (kamera, ekran paylaşımı, sohbet, ızgara).

## Test edilemeyen / bilinen sınırlar

- Referans görseller yok → görsel karşılaştırma yapılmadı (yukarıya bakın).
- Gerçek kamera/mikrofon donanımı, fiziksel telefon, Safari/WebKit/Firefox, ekran okuyucu ve üretim TLS/TURN denenmedi; medya kaynağı Chromium'un sahte cihazıdır. Tam ekran düğmesi görünür ve bağlıdır ama otomatik testte tıklanmadı.
- Liste proje toplantılarını tek seferde alır; 2000'den fazlasında yalnız en yeni 2000 listelenir ve ekranda uyarı çıkar. Arama başlık, açıklama ve gündem maddelerini kapsar (katılımcı adları değil).
- Sahne aktif konuşmacıyı otomatik izlemez (sürekli kayma rahatsız eder); konuşan kart mavi halkayla işaretlenir, sahneyi kullanıcı seçer.
- 768–1023 px arası (compact değil, lg değil) yerleşimde panel sahnenin altında akar; çubuk yapışkandır.
- "Davet et" yalnız organizatör/proje yöneticisine görünür; nihai yetki backend'dedir.
- Tam pre-push, push, merge ve deployment **çalıştırılmadı / yapılmadı**.

## Manuel kontrol listesi

1. Üç referans görselle liste, oluştur ve oda ekranlarını yan yana karşılaştırın (sağ panel genişliği, filmstrip yüksekliği, kart yoğunluğu).
2. İki gerçek cihazla odaya girin: kamera/mikrofon, ekran paylaşımı, tam ekran, kişi bazlı ses, mute/kick, sohbet.
3. Telefonda oda: panel, çubuk, klavye açıkken sohbet; küçült → mini bar → dön.
4. `?status=`, `?q=`, `?sort=`, `?page=` ile Geri/İleri; 11'den fazla toplantıda sayfalama.
5. Yaz/kış saati geçişi olan bir bölgede (ör. 2027-03-28 Berlin) 02:30 seçip satır içi hatayı görün.
6. Hatırlatma e-postasını Mailpit'te (8025) kontrol edin.

## Commit

Kod ve testler: `20a531bf` — `feat(meetings): redesign meeting interfaces from visual references` (`meeting-system-frontend`). Bu kayıt ayrı bir `docs` commit'idir. Push/merge yapılmadı.
