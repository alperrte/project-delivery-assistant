# Toplantı sistemi frontend — 2026-10-18

## Tamamlanan kapsam

Seçili proje sidebar'ına Toplantılar > Oluştur / Toplantılarım / Takvim eklendi. Gerçek API'ye bağlı oluşturma, hemen başlatma, planlama, düzenleme, iptal, detay, sayfalı/durum filtreli liste ve herkes için bitirme akışları uygulandı. Takvim mevcut month-grid'i kullanır; global takvim aynı meeting kaynağını okur, gün aşan aralıkları gösterir ve reminder kopyası oluşturmaz. Bildirimden gerçek toplantı detayına geçiş mevcut read/navigation sınırlarıyla çalışır.

Canlı odada resmi LiveKit JS SDK ile mikrofon/kamera/ekran paylaşımı, cihaz seçimi, kişisel dinleme sesi, anlık katılımcı/konuşma görünümü, REST + reliable invalidation sohbeti, gerçek mention, manager mute/kick/end, onay dialogları ve süre aşımı uyarısı vardır. Süre aşımı End tetiklemez. Kalan katılımcılar epoch rotasyonunda yeniden yetkilendirilip yeni odaya bağlanır; yasaklı/erişimi bitmiş katılımcı retry yapmaz. İlk katılım cihazları kapalıdır. Track/listener/SDK temizliği, misafir refresh/session devamı ve BFCache dönüşü ele alındı.

Hesapsız misafir akışı ayrı public layout'tadır. Capability fragment'tan alınır ve hemen temizlenir; session/medya sırları depolanmaz. Davet metadata'sı yenileme sonrasında yönetilebilir; token yalnız ilk oluşturulduğu açık sayfada kopyalanabilir. Davet iptali mevcut misafiri çıkarmaz. TR/EN/DE, ortak tema/bileşen/token'lar, loading/empty/error/forbidden durumları kullanılır. Tekrar, draft ve fiziksel toplantı gibi desteklenmeyen alanlar gösterilmez.

## Branch ayrımı ve önemli dosyalar

- **Frontend:** ana çalışma alanı `meeting-system-frontend`; `frontend/src/features/meetings/**`, yeni proje/public guest rotaları, `src/i18n/meetings/**`.
- Sidebar, authenticated route listesi, project switch hedefleri, global takvim/month-grid, notification-center, i18n routing/request ve sayfa başlıkları güncellendi.
- `frontend/src/lib/api/client.ts`: guest 401 için PDA refresh yok; Retry-After metadata'sı.
- `frontend/{next.config.ts,.env.example}`, `src/{proxy.ts,lib/security/csp.ts}`: onaylı route-scoped cihaz/CSP güvenliği.
- `frontend/{package.json,package-lock.json}`: exact `livekit-client@2.23.0`.
- `frontend/bundle-budgets.json`: sekiz yeni rota için mevcut ölçüm + yaklaşık %10 / 5 KB yuvarlama politikasıyla açık bütçe; önceki bütçeler artırılmadı. SDK yalnız oda rotalarındadır.
- `frontend/e2e/{meetings.spec.ts,meeting-fixture.ts}`, `frontend/playwright.meetings.config.ts`.
- Devir: [meeting-frontend-handoff.md](../meeting-frontend-handoff.md).
- **Backend eki yalnız** `.branch-worktrees/meeting-guest-contract` içindeki `meeting-system-backend` branch'indedir. Preview/state, davet metadata listesi, mevcut-origin guest CORS ve Retry-After expose burada uygulanmıştır. Ana frontend çalışma alanındaki backend kaynakları değiştirilmedi. Ayrı kayıt: `.branch-worktrees/meeting-guest-contract/docs/compliation/2026-10-18-meeting-guest-contract.md`.

Kullanıcının açık talebi gereği **commit, push, merge veya production deployment yapılmadı**.

## Çalıştırılan doğrulamalar

Frontend dizininden:

```powershell
npm run lint
npx tsc --noEmit
npm run build
npm run check:bundle
npx playwright test --config playwright.meetings.config.ts
$env:E2E_REUSE_AUTH='1'
npx playwright test e2e/localized-routing.spec.ts --project chromium --output=test-results/routing-meeting-regression
npm audit --omit=dev --json
```

Her iki worktree'de `git diff --check`; ayrı backend'de hedefli Maven testleri; yerel LiveKit ve yeni backend için Docker build/start çalıştırıldı.

## Sonuçlar ve kanıt sınırları

- Son lint, TypeScript, production build ve bundle kontrolü **exit 0**; tüm rotalar bütçe içinde.
- **3 kapsamlı gerçek servis Chromium testi geçti**: form/create/edit/cancel + sidebar/takvim/bildirim; çoklu kullanıcı/guest medya ve güvenli reconnect; kalıcı davet metadata/revoke + public invalid guest.
- **24 mevcut dil/oturum/route regresyon testi geçti**.
- Ayrı backend ekinde **38 test, 0 failure/error/skip**, Maven exit 0. Bunların PostgreSQL entegrasyonu Testcontainers, medya portu test double'dır.
- Frontend kabulünde **gerçek yerel backend, PostgreSQL ve LiveKit** kullanıldı. İki hesap + hesapsız misafir arasında katılım, tarayıcı ekran paylaşımı, mic/video, manager mute/kick, non-manager 403, mention/chat, kişisel sesin yalnız alıcıda değişmesi, guest refresh, invite revoke sonrası mevcut session devamı, yeni epoch/reconnect, sohbet korunması, overtime'da bağlantının açık kalması, End sonrası track'lerin `ended` olması kontrol edildi.
- RTC istatistiklerinde **alınan ses byte/sample'ları ve decode edilmiş video kareleri** kontrol edildi. Capture kaynağı Chromium'un TEST-ONLY yapay kamera/mikrofonu ve otomatik masaüstü seçicisidir; fiziksel ses kalitesi doğrulanmış sayılmaz.
- Formun **light/dark axe taramasında ihlal yok**. TR/EN/DE 320 px, dark 768 px ve 1440 px form; 390 px ve 1440 px oda görüntüleri incelendi; yatay taşma kontrolü geçti. Gerçek tema düğmesi ve reduced-motion kullanıldı. Bu, tam WCAG veya gerçek ekran okuyucu sertifikasyonu değildir.
- Üretim bağımlılık audit'i **0 açık**. Mevcut geliştirme araç zincirindeki 5 high braces advisory borcu sürer; resmî advisory'de patch yoktur. Büyük yükseltme/custom patch yapılmadı.
- İlk denemelerde eski ortak QA hesabı login olamadığı için ayrı yerel test hesapları oluşturuldu; kayıt e-postası gönderilmedi. Bir test seçicisi merkezi sohbetle çakışıyordu, meeting alanına daraltıldı. Gerçek guest testinin bulduğu eksik CORS kaydı backend worktree'sinde düzeltildi. Paralel test koşumlarının ortak artifact klasörü çakışması ayrı output dizinleriyle giderildi; son iki koşum temizdir.
- Impeccable Windows context yardımcı komutu `cache_directory_failed` batch-label hatası verdi. Referans polish/craft-floor ve web-interface kuralları doğrudan uygulanıp ekran görüntüleri incelendi; otomatik Impeccable pipeline'ın geçtiği iddia edilmez.

## Yapılandırma ve açık sınırlar

Kullanıcı onayıyla yalnız yerel `.env.dev`/aktif `.env` medya özelliği etkinleştirildi ve sırlar yazdırılmadan üretildi. `frontend/.env.local` public signaling origin'ini içerir; `.env.prod` değiştirilmedi. Public frontend ENV örneği production WSS placeholder'ıdır. Kamera/mikrofon/display-capture yalnız room/guest yüzeylerinde same-origin; production CSP exact signaling origin'i ekler, nonce script politikası korunur. Guest UI no-referrer/no-store/noindex'tir. ENV/token/secret çıktısı veya logu üretilmedi.

Yerel backend halen ayrı worktree kaynağından alınmış imajı çalıştırır. Backend ekini entegre etmeden ana frontend branch'indeki eski backend kaynağını yeniden build etmeyin. Çalıştırma ve branch ayrımı [devir belgesindedir](../meeting-frontend-handoff.md).

Safari/Firefox, gerçek mobil klavye/VoiceOver/NVDA, fiziksel mic/speaker/camera, uzak ağ/NAT/TURN, production TLS ve kapasite testi yapılmadı. Tam repo/pre-push/production gate çalıştırılmadı. Görsel uygulama mevcut PDA titanium tasarım sistemi ve iki sütunlu form düzenine dayanır. Guest-invalid sözleşmesi expiry/revoke/wrong scope için ortaktır; UI erişimin sonlandığını gösterir. Browser Permissions desteklemiyorsa önceki mic/camera tercihi otomatik açılmaz; kullanıcı yeniden açar. Ekran paylaşımı rotasyondan sonra kullanıcı eylemi gerektirir.

## Kullanıcının manuel kontrol adımları

1. İki worktree'nin diff'lerini ve ayrı backend completion kaydını inceleyip commit işlemlerini kendiniz yapın. Ajan hiçbir commit/push yapmadı.
2. `http://localhost:3000` üzerinden gerçek proje hesabıyla Toplantılar menüsüne girin; planla/düzenle/takvim/bildirimden detay geçişini kontrol edin.
3. İki gerçek cihaz/tarayıcıyla aynı toplantıya girin. Mic/speaker sesini, kamera karelerini ve ekran paylaşımını karşılıklı kontrol edin; kişisel ses slider'ı yalnız dinleyeni etkilemeli.
4. Misafir bağlantısını gizli pencerede açın; adres çubuğundaki fragment temizlenmeli, PDA login istenmemeli. Yenileme sonrasında scoped session ile yeniden katılın. Daveti iptal edin: mevcut misafir kalmalı, yeni session reddedilmeli.
5. PROJECT_MANAGER ile sustur/çıkar/end deneyin; normal üye bunları yapamamalı. Çıkarma sırasında diğerleri kısa medya kesintisinden sonra yeniden bağlanmalı; ekran paylaşımı açıkça yeniden başlatılmalı. Başkasının mikrofonunu açma eylemi yoktur.
6. Cihaz iznini reddetme, cihazı çıkarma/değiştirme, ağ kesintisi, sekme değiştirme/kapatma ve Leave sonrası cihaz göstergelerinin kapanmasını kontrol edin. Safari/Firefox ve mobil ekran okuyucu/klavye kontrollerini tamamlayın.
7. Production'a geçmeden gerçek WSS/TLS/ICE/TURN/firewall yapılandırmasını ve ayrı ağ kabulünü tamamlayın; localhost sonucu üretim kabulü değildir.
