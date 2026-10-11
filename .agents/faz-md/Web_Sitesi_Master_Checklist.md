# Web Sitesi Master Checklist

## 1. Footer, kurumsal sayfalar ve iletişim

### Footer içeriği

- [X] Telif hakkı ve yıl
- [X] Site / marka adı
- [X] Hakkımızda bağlantısı
- [X] Sıkça Sorulan Sorular (SSS)
### HAMZA
- [X] KVKK Aydınlatma Metni
- [X] Gizlilik Politikası
- [X] Kullanım Koşulları
- [X] Çerez Politikası ve tercih bağlantısı
- [X] Erişilebilirlik Bildirimi
- [X] İletişim adresi ve destek bağlantısı
### HAMZA
- [X] Geliştirici / ekip profilleri
- [Eklenmeyecek] Sosyal medya bağlantıları
- [X] Kaynak kod bağlantısı
- [X] Açık kaynak lisansı
- [X] Sürüm bilgisi
- [X] Footer erişilebilirliği

### İletişim ve destek sayfası
### HAMZA
- [X] İletişim formu
- [X] E-posta gönderim altyapısı
- [X] Spam ve bot koruması
- [X] Gönderim sonucu bildirimi
- [X] Tekrarlanan gönderim koruması
- [X] Veri işleme bilgilendirmesi
### HAMZA
## 2. Hukuki uyum, KVKK ve çerezler

### Kişisel verilerin korunması
### HAMZA
- [X] KVKK aydınlatma metni
- [X] Gizlilik politikası
- [X] Kullanım koşulları
- [X] Veri sorumlusu bilgisi
- [X] Veri işleme amaçları ve hukuki sebepler
- [X] Veri minimizasyonu
- [X] Saklama ve imha politikası
- [X] İlgili kişi başvuruları
- [X] Açık rıza yönetimi
- [X] Aydınlatma ile açık rızanın ayrılığı
- [ ] Yurt dışına veri aktarımı
- [X] VERBİS değerlendirmesi
- [X] Veri ihlali hazırlığı
### HAMZA
### Çerez kullanımı ve seçimler
### HAMZA
- [X] Çerez envanteri
- [X] Çerez politikası
- [X] Çerez onay katmanı
- [X] Ön izin kontrolü
- [X] Seçimi geri alma
- [X] Çerez kategorileri
- [X] Yanıltıcı onay tasarımından kaçınma
### HAMZA
### Hizmet türüne göre diğer yükümlülükler

- [Eklenmeyecek] Ticari işletme bilgileri
- [Eklenmeyecek] ETBİS ve e-ticaret kontrolü
- [Eklenmeyecek] Mesafeli satış / ön bilgilendirme
- [Eklenmeyecek] İade, cayma ve iptal
- [Eklenmeyecek] Ticari elektronik ileti
### HAMZA
- [ ] GDPR ve yurt dışı yükümlülükleri
### HAMZA
- [X] Telif ve lisans kullanımı

## 3. Erişilebilirlik: herkes için kullanılabilir site

### Görme engelli ve az gören kullanıcılar

- [ ] Ekran okuyucu desteği — Otomatik ARIA kontrolleri geçti; gerçek NVDA sesli okuması doğrulanmadı.
- [X] Semantik HTML
- [X] Alternatif görsel metni (alt text)
- [X] Erişilebilir buton isimleri
- [X] Başlık hiyerarşisi
- [X] ARIA ve canlı mesajlar
- [X] Tablo ve grafik açıklamaları
- [X] Form etiketleri
- [X] Metin yakınlaştırma ve reflow
- [X] Renk kontrastı — Axe (WCAG 2.0-2.2 A/AA) herkese açık 15 sayfada (3 dil × 2 tema × 2 ekran) ve 13 oturumlu ekranda (2 tema × 2 ekran) 0 ihlal. Axe'in karar veremediği düğümler (gradyan/saydam zemin) metni saydam yapıp arka plan piksellerini örnekleyerek ölçüldü: iki gerçek sorun bulunup giderildi (koyu temada landing/üstbilgi 'Kayıt ol' düğmelerinde koyu metin ~2,9:1; açık/koyu temada auth kartı yardımcı metni 3-4:1); yalnız ikon içeren 24 kontrol ≥3:1.
- [X] Bilgi yalnız renkle verilmez

### İşitme engelli ve az işiten kullanıcılar

- [N/A] Video altyazıları — Sitede gömülü video bulunmuyor.
- [N/A] Ses kayıtlarının dökümü — Sitede ses kaydı bulunmuyor.
- [N/A] Canlı yayın altyazısı — Canlı yayın bulunmuyor.
- [X] Sesli bildirim için görsel karşılık — Mevcut bildirimler görsel ve metin olarak sunuluyor.
- [N/A] Erişilebilir medya oynatıcı — Gömülü medya oynatıcı bulunmuyor.
- [N/A] İşaret dili seçeneği — İşaret dili alternatifi gerektiren video veya canlı yayın bulunmuyor.

### Motor engeller, klavye ve dokunma

- [X] Tam klavye kullanılabilirliği — 13 oturumlu ekranda Tab gezintisi: tuzak yok, her durakta görünür odak (`e2e/a11y-signed-in.spec.ts`); menü, diyalog, form, pano ve yorum akışları mevcut klavye testleriyle (`task-comment-keyboard`, `cookie-consent`, `form-first-error-focus` vb.) kapsanıyor.
- [X] Mantıklı sekme sırası
- [X] Görünür odak (focus)
- [X] İçeriğe atla bağlantısı
- [X] Modal / dialog odak yönetimi
- [X] Klavye tuzağını önleme
- [X] Sürükle-bırak alternatifi
- [X] Yeterli tıklama hedefi — Herkese açık sayfalarda ve 13 oturumlu ekranda tüm görünür kontroller ≥24×24 CSS px (WCAG 2.5.8; label içindeki özel radyo/onay kutularında tıklanabilir satır ölçülür); `e2e/ui-ux-public.spec.ts` ve `e2e/a11y-signed-in.spec.ts`.
- [X] Hover alternatifi — Hover ile görünen kontroller (görev etkinlik, kontrol listesi, ilişki, süre kaydı silme düğmeleri) `group-focus-within` ile klavye odağında da görünür; ipuçları (tooltip) odakla açılır; arama listesi hover yalnızca vurgu içindir.
- [X] Zaman sınırı kontrolü — Erişim jetonu (15 dk) kullanıcıya sorulmadan sessizce yenilenir; yenileme süresi (7 gün) dolunca 'Oturumunuz sona erdi' mesajı gösterilir ve aynı sayfaya dönülür. Kayıt kodu (15 dk) ve yeniden gönderme beklemesi (3 dk) güvenlik amaçlı zorunlu sınırlardır (WCAG 2.2.1 'essential' istisnası); süre dolunca yeni kod istenebilir ve form verileri korunur.

### Bilişsel erişilebilirlik ve hareket hassasiyeti

- [X] Tutarlı menü ve etiketler
- [X] Anlaşılır mikro metin
- [X] Düzeltilebilir hata mesajları
- [X] Form verilerini koruma
- [X] Hareket azaltma desteği
- [X] Yanıp sönme riskinden kaçınma
- [Eklenmeyecek] Otomatik hareketi durdurma — Kullanıcı kararıyla (2026-10-11): landing/auth'taki dekoratif animasyonlar sürekli kalır ve ayrı bir duraklatma kontrolü eklenmez; hareket azaltma için cihazın 'hareketi azalt' tercihi ve hesap ayarlarındaki animasyon tercihi geçerlidir.
- [X] Erişilebilir doğrulama

### Video ve çoklu ortam

- [N/A] Sesli betimleme — Gömülü video bulunmuyor.
- [N/A] Medya alternatifleri — Gömülü ses veya video bulunmuyor.
- [N/A] Otomatik ses kontrolü — Otomatik ses çalma bulunmuyor.
- [ ] Manuel erişilebilirlik testleri — Tarayıcıda klavye, odak ve yakınlaştırma kontrolleri yapıldı; gerçek ekran okuyucu testi eksik.

## 4. SEO, GEO, URL ve sosyal paylaşım

### Teknik SEO ve keşfedilebilirlik

- [X] SEO / GEO yaklaşımı
- [X] Benzersiz sayfa başlığı
- [X] Meta description
- [X] robots.txt
- [X] sitemap.xml
- [X] Canonical URL
- [X] noindex / nofollow kararı
- [X] hreflang
- [X] Structured data / JSON-LD
- [X] FAQ yapılandırılmış verisi
- [ ] Google Search Console — Gerçek alan adı ve Google hesabı gerektirir; sitemap.xml ve robots.txt hazır, mülk doğrulaması yapılmadı.
- [X] llms.txt
- [X] İç bağlantı kalitesi
- [X] Özel sayfa gizliliği

### URL, slug, routing ve breadcrumb

- [X] Okunabilir URL
- [X] Slug standardı
- [X] Slug benzersizliği
- [X] Türkçe karakter kuralı
- [X] Kalıcı yönlendirme (301/308)
- [X] Geçici yönlendirme (302/307)
- [X] Trailing slash ve harf standardı
- [X] Query parametreleri
- [X] 404 ve 410 kuralları
- [X] Yetki kontrollü özel rotalar
- [X] Back / forward davranışı
- [X] Dil değişiminde eşdeğer rota
- [X] Breadcrumb

### OpenGraph ve bağlantı önizlemeleri

- [X] og:title
- [X] og:description
- [X] og:image
- [X] og:url, og:type, og:site_name
- [X] og:locale ve dil varyantları
- [X] X / Twitter Card metadata
- [X] Mutlak HTTPS görsel adresi
- [X] Görsel ölçüsü ve biçimi
- [X] Canlı paylaşım testi
- [X] Özel veriyi paylaşmama

## 5. Formlar, doğrulama ve geri bildirim

### Form alanlarının doğrulanması

- [X] Zorunlu alan kontrolü
- [X] Boşluk-only içerik kontrolü
- [X] E-posta / telefon / URL formatı
- [X] Minimum ve maksimum uzunluk
- [X] Veri tipi ve mantık kontrolü
- [X] Alan yanındaki hata
- [X] Erişilebilir hata anonsu
- [X] Hatanın yalnız renkle ifade edilmemesi
- [X] İlk hataya yönlendirme
- [X] Form verisini koruma
- [X] Frontend ve backend doğrulaması

### Formun gönderilmesi ve sonuçlar

- [X] Loading state
- [X] Çift gönderim önleme
- [X] Success state
- [X] Error state
- [X] Bağlantı kesintisi davranışı
- [X] Silme / kritik eylem onayı
- [Eklenmeyecek] Undo / geri alma
- [X] Hata ve sonuç testleri

## 6. UI/UX, responsive tasarım ve ekran durumları

### Görsel tasarım ve cihaz uyumu

- [X] Responsive düzen
- [X] Taşma ve kırılma kontrolü
- [X] Tutarlı tasarım sistemi
- [X] Light / Dark tema
- [X] Tema tercihi
- [X] Favicon ve uygulama ikonları
- [X] Dokunmatik kullanılabilirlik

### Navigasyon ve eylem yönlendirmeleri

- [X] Ana CTA
- [X] Aktif menü durumu
- [X] Logo ile ana sayfaya dönüş
- [X] Breadcrumb ve site hiyerarşisi
- [X] Geçişlerde başlık ve odak güncellemesi

### Bütün arayüz durumları

- [X] Loading / Skeleton
- [X] Empty State
- [X] Success State
- [X] Error State
- [X] Disabled State
- [X] Hover / Focus / Active State
- [X] Toast ve uyarılar
- [X] Confirmation Dialog
- [X] Offline ve yeniden deneme
- [X] HTTP hata ekranları

## 7. Üyelik, oturum ve yetkilendirme

### Kimlik doğrulama ve hesap işlemleri

- [X] Güvenli kayıt ve giriş
- [X] Parola hashleme
- [X] Parola sıfırlama
- [X] E-posta doğrulama
- [X] Oturum süresi ve çıkış
- [X] Güvenli cookie ayarları
- [X] Giriş hızı sınırı
- [X] MFA / 2FA

### Erişim ve hesap güvenliği

- [X] Rol tabanlı yetkilendirme
- [X] Sunucu tarafı nesne yetkilendirmesi
- [X] Hesap silme ve veri talepleri
- [X] Kritik değişiklikte yeniden doğrulama
- [X] Oturum zaman aşımı mesajı
- [X] Open redirect ve yetki yükseltme koruması

## 8. Güvenlik ve üretim altyapısı

### Tarayıcı, ağ ve uygulama güvenliği

- [X] HTTPS ve yönlendirme — `docker-compose.prod.yml` + Caddy (otomatik HTTPS, `http://` → `https://` 308) production biçiminde kuruldu ve `ops/smoke-test.mjs` ile doğrulandı (yerel Caddy CA'sı, `localhost`). Gerçek alan adında aynı betik yeniden çalıştırılacak.
- [ ] Geçerli TLS ve HSTS — HSTS (`max-age=31536000; includeSubDomains`) HTTPS üzerinden Caddy yığınında doğrulandı; geçerli (halka açık CA'dan) sertifika yalnız gerçek alan adında alınabilir ve Caddy'nin otomatik alma/yenilemesi orada doğrulanacak (`ops/smoke-test.mjs` sertifika zincirini sınar).
- [X] Mixed Content kontrolü — HTTPS üzerinde 8 sayfa tarayıcıda yüklendi: karışık içerik uyarısı 0, CSP ihlali 0, düz-http istek 0; production CSP'si `upgrade-insecure-requests` içerir (yalnız https site adresinde).
- [X] Content Security Policy (CSP)
- [X] Güvenlik başlıkları
- [X] CORS allowlist
- [X] CSRF koruması
- [X] XSS ve injection koruması
- [X] SSRF ve URL doğrulaması
- [X] API rate limiting
- [X] Güvenli dosya yükleme
- [X] Sunucu tarafı veri doğrulama
- [X] Secret ve environment yönetimi
- [X] Bağımlılık taraması — 2026-10-11: Maven bağımlılıkları (Trivy) 0 HIGH/CRITICAL; npm üretim bağımlılıkları (`npm audit --omit=dev` ve Trivy) 0. Tam ağaçta yalnız bilinen 5 high (ESLint/braces geliştirme zinciri, `SECURITY.md` §16 açık takip, üretim imajına girmez). Komutlar `.agents/operations.md` §5; CI'da `npm audit` ve Dependabot da var.

### İşletim, izleme ve süreklilik

- [ ] Güvenlik güncellemeleri — Süreç `.agents/operations.md` §5'te, Dependabot yapılandırması `.github/dependabot.yml`'de; GitHub'da `main`'e birleşip ilk PR'lar gelince tiklenecek.
- [X] Hata izleme ve loglama
- [X] Hassas veriyi loglamama
- [X] Yedekleme ve geri yükleme — `ops/backup.ps1` (DB + medya) ve `ops/restore.ps1` (geçici DB'ye geri yükleme tatbikatı) çalışan Docker yığınında denendi: yedek alındı (DB dump + medya arşivi), geçici veritabanına açıldı (56 tablo, Flyway kayıtları ve 1836 kullanıcı okundu), geçici DB silindi; canlı DB'ye dokunulmadı. Yedeğin makine dışına taşınması ve gerçek hosting yedeği hosting seçilince.
- [X] Olay müdahale prosedürü
- [X] Audit log
- [X] Production gizlilik kontrolleri

## 9. Admin paneli, analitik ve izleme

### Admin paneli (koşullu)
### HAMZA
- [X] Kullanıcı yönetimi
- [X] Rol ve izin yönetimi
- [X] Sistem ayarları
- [X] Destek talepleri
- [X] Operasyon metrikleri
- [X] Audit log inceleme
- [X] Admin güvenliği
- [X] Kritik işlem onayı
- [X] Admin indeksleme politikası

### Analytics ve monitoring (koşullu)

- [X] Sayfa görüntülenmeleri
- [X] Kullanıcı akışları
- [X] CTA ve dönüşüm ölçümü
- [X] Hata oranları
- [X] Gizlilik odaklı ölçümleme
- [X] Analitik için hukuki değerlendirme
### HAMZA


## 10. Performans ve teknik kalite

### Hız ve teknik verimlilik

- [X] Core Web Vitals — Lighthouse mobil, uygulanan Slow 4G + 4x CPU kısıtı (gözlenen): LCP 1,9-2,1 sn, CLS 0, FCP 1,4-2,1 sn, TBT 40-400 ms (landing en yüksek), skor 87-98. LCP öğesi çerez banner'ıydı (hydration sonrası çiziliyordu, LCP 6-7 sn); banner artık sunucuda çiziliyor ve kararı olan ziyaretçide `<head>` betiğiyle ilk boyamadan önce gizleniyor. Yalnız laboratuvar ölçümü; gerçek kullanıcı (INP/field) verisi yok.
- [X] Lighthouse analizi
- [X] Görsel sıkıştırma ve format
- [X] Lazy loading
- [X] Font optimizasyonu
- [X] Gereksiz kodun azaltılması — Landing −323 KB gz (demo ayrımı), kök i18n yükü ve kullanılmayan görseller azaltıldı; tüm rotalar bütçe içinde. Form sayfalarındaki zod (~88 KB gz) ve ~350 KB paylaşılan çekirdek için daha fazla azaltma yapılmamasına kullanıcı kararıyla (2026-10-11) karar verildi; `optimizePackageImports` denendi, etkisi yok.
- [X] Code splitting
- [X] Cache stratejisi
- [X] Yavaş ağ testleri
- [X] Bundle boyutu takibi
- [X] API timeout / retry
- [X] Responsive görseller
- [X] Kaynak haritası ve debug yönetimi

## 11. Çoklu dil, PWA ve platform özellikleri

### Çoklu dil (koşullu)

- [X] Dil bazlı routing — TR/EN/DE önekleri, çevrilmiş adresler, canonical yönlendirmeler ve dil değiştirme mevcut; ayrı yönetici girişi bilinçli olarak öneksiz.
- [X] Doğru html lang — Root layout, çözümlenen sayfa dilini html lang alanına yazıyor.
- [X] Hreflang ve dil eşdeğerliği — Public sayfalarda TR/EN/DE ve x-default eşleri; sitemap'te dil karşılıkları mevcut.
- [X] Yerel tarih / sayı biçimi — Tarih/saat alanları ve analitik sayı gösterimleri seçili dille Intl üzerinden biçimlendiriliyor.
- [X] Eksik çeviri fallback — Seçili dilin kataloğu varsayılan dil (TR) kataloğunun üstüne birleştirilir; EN'deki 27 eksik anahtar Türkçe görünür, ham anahtar görünmez. Varsayılan dilde de yoksa sunucuda uyarı yazılır ve noktalı yol gösterilir (`i18n/request.ts`).
- [X] Form ve hata çevirileri — Ortak validation/errors anahtarları TR/EN/DE'de mevcut; formlar doğrulama ve API hatalarını çeviri anahtarlarıyla gösteriyor.
- [X] Dil bazlı metadata / OG — Public sayfalarda çevrilmiş title/description, OG locale ve alternateLocale mevcut; oturumlu sayfalarda çevrilmiş başlıklar ve noindex uygulanıyor.

### PWA (isteğe bağlı)

- [X] Web App Manifest — manifest.ts içinde uygulama adı, start_url, standalone görünüm, renkler ve ikon tanımları mevcut.
- [X] Uygulama ikonları — Manifest'in PNG ikonları gerçek 192×192 ve 512×512 boyutlarında; Apple ikonu 180×180.
- [X] Service Worker — `public/sw.js` (yalnız çevrimdışı sayfa; API, Next varlıkları ve oturumlu içerik önbelleğe alınmaz), kayıt `service-worker-registration.tsx` (yalnız production). Production build'de kayıt ve devralma tarayıcıda doğrulandı.
- [X] Offline senaryosu — Ağ yokken sayfa gezinmesi önbellekteki `offline.html` (TR/EN/DE) ile yanıtlanır; tarayıcıda çevrimdışı mod ile doğrulandı. Açık çalışma alanındaki bağlantı uyarısı ayrıca duruyor.
- [X] Cache sürümü güncelleme — `CACHE_VERSION` değişince yeni worker kurulur, hemen devralır ve eski `pda-` önbelleklerini siler (başka önbelleklere dokunmaz); v1 → v2 geçişi tarayıcıda doğrulandı.

## 12. Test, yayın ve yayın sonrası takip

### Yazılım ve kullanıcı akışı testleri

- [X] Unit test — Backend: JUnit birim testleri (ör. `TotpTest`, `StrongPasswordValidatorTest`, `ChatDomainTest`) pre-push'ta 897 test, 0 hata. Frontend'de birim test çatısı (Vitest) yok; davranış testleri Playwright ile.
- [X] Integration test
- [X] E2E test — Playwright, tam paket (pre-push): 1036 testten 1005 geçti, 22 atlandı, 6 başarısız; başarısızlıkların tümü değişikliklerimden bağımsız (temiz HEAD'de de aynı: dil çerezi yarışı 4 test, `project-logo-settings` sohbet çubuğu 6 px çakışması; `team-deletion-notifications` tek başına geçiyor).
- [X] Tarayıcı uyumluluğu — Herkese açık Playwright paketi Chromium, Chrome, Edge, Opera 137, Firefox 155 ve WebKit üzerinde çalıştırıldı (`E2E_CROSS_BROWSER=1`, Opera için `E2E_OPERA_PATH`). Chrome ve Edge: tüm testler geçti. Opera: 195 geçti; tek hata, `target=_blank` bağlantısının yeni sekme olayını Playwright'ın Opera'da almaması (bağlantı Opera'da gerçekten yeni sekme açıyor; test düzeneği sınırı) ve bir geliştirme-modu testi atlandı. Firefox ve WebKit'te kalan hatalar test düzeneğinden: WebKit'te `route.fulfill` ile mock'lanan çapraz-origin API (gerçek iletişim formu akışı WebKit ve Firefox'ta elle doğrulandı), WebKit'in Tab ile bağlantı odaklamama varsayılanı, Firefox'ta scrollbar hesaplanan değeri. Bulunup giderilen gerçek sorunlar: production CSP'sindeki `upgrade-insecure-requests` WebKit'te http alt kaynaklarını kırıyordu; çerez banner düğmeleri hydration'dan önce tıklanınca kayboluyordu. Gerçek Safari/iOS cihazı denenmedi (ayrı madde).
- [ ] Gerçek mobil test — Gerçek cihaz gerektirir (iOS Safari, Android Chrome); yapılmadı.
- [ ] Klavye ve ekran okuyucu testi — Klavye/odak otomatik testlerle geçti; gerçek NVDA/VoiceOver okuması yapılmadı.
- [X] Otomatik erişilebilirlik analizi
- [X] Kırık bağlantı kontrolü
- [X] SEO / paylaşım testi

### Yayına alma ve sürdürülebilirlik

- [X] Production ortam değişkenleri — Zorunlu değişken adları ve sabitler `docker-compose.prod.yml` ve `.agents/operations.md` §6a/§7'de; yalnız bu değişkenlerle production biçimli yığın (APP_ENV=prod, docs kapalı, Secure çerezler, tek origin) ayağa kalktı ve smoke testi geçti. Gerçek secret değerleri dağıtımda secret store'a girilir.
- [ ] CI/CD pipeline — `.github/workflows/ci.yml` yazıldı (frontend lint/tsc/build/bütçe/audit, backend verify, Gitleaks, Docker build); GitHub'da henüz çalıştırılmadı. Deploy adımı hosting kararına bağlı.
- [ ] Monitoring ve alarm — Uygulama içi sağlık ve hata sayaçları var; dış izleme için `.github/workflows/uptime.yml` yazıldı (30 dakikada smoke test + sertifika süresi, alarm = başarısız çalıştırma bildirimi, mail kotası kullanılmaz). Gerçek site adresi (`SITE_URL`) tanımlanıp GitHub'da çalıştığı görülünce tiklenecek.
- [ ] Sertifika ve domain yenileme — Caddy sertifikayı otomatik alır/yeniler; `uptime.yml` sertifika (<14 gün) ve alan adı kaydı (<30 gün) için alarm üretir; plan `.agents/operations.md` §6. Gerçek alan adı ve ilk çalıştırma olmadan tiklenmedi.
- [X] Deployment sonrası smoke test — `ops/smoke-test.mjs` (yönlendirme, HSTS/CSP/başlıklar, API ve Secure çerez, WebSocket yolu, statik dosyalar, 36 sayfa/753 bağlantı) production biçimli yığında 25/25 geçti; gerçek bir dağıtım henüz yok.
- [X] Rollback stratejisi
- [X] Veritabanı migration planı
- [X] Bakım ve güncelleme planı
