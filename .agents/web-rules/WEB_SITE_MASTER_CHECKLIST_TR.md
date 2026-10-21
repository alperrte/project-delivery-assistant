# Web Sitesi Kesinlikle Olması Gerekenler — Master Checklist

## Tek takvim — 2026-10-18 (sınırlı kapsam)

Toplantılarım liste sayfası için de breadcrumb kaldırıldı; hedefli ESLint/whitespace kontrolleri geçti. Bu takip değişikliğinde tarayıcı testi tekrarlanmadı; global kutular değişmedi.

Toplantı oluşturma sayfası takip düzeltmesi: yalnız `/projects/[slug]/meetings/new` için breadcrumb ve form üstü geri bağlantısı kaldırıldı. Düzenleme sayfasının geri bağlantısı korundu. Etkilenen Breadcrumb/Navigasyon kapsamı için hedefli ESLint ve whitespace kontrolü geçti; güncel geliştirme sunucusunda iki öğenin yokluğu dahil mevcut gerçek servis Chromium regresyonu 1 PASS verdi. Global kutular değişmedi. Kayıt: `docs/compliation/2026-10-18-meeting-create-navigation.md`.

Navigasyon, yönlendirme, yerelleştirme ve responsive maddeleri açısından: ayrı toplantı takvimi girişi/renderer'ı kaldırıldı; ortak takvimde toplantı verisi ve detay bağlantıları korundu. TR/EN/DE eski URL → ortak takvim, proje bağlamı, yenileme ve proje değişimi gerçek API/PostgreSQL + Chromium ile doğrulandı. 320/390/1440 px görüntülerinde taşma yok; mevcut form light/dark axe kontrolleri de hedefli regresyonda geçti. Yeni ortak takvime özel tam ekran okuyucu/çok tarayıcı/tema matrisi iddia edilmez. Global kutular değiştirilmedi. Sonuçlar: `docs/compliation/2026-10-18-unified-calendar.md`.

## Toplantı frontend — 2026-10-18 (sınırlı kapsam)

Etkilenen Navigasyon / Pagination / Form Validation / Loading-Empty-Error-Forbidden / Responsive / Dark Mode / Focus / kritik işlem onayı / noindex ve cihaz güvenliği yüzeyleri gözden geçirildi. Gerçek API/PostgreSQL/LiveKit ile 3 kapsamlı Chromium kabulü ve 24 mevcut dil/oturum/route regresyonu geçti; 320/390/768/1440 görüntüleri, TR/EN/DE ve form light/dark axe doğrulandı. RTC ses byte/sample ve video decode kanıtı vardır; capture kaynağı TEST-ONLY tarayıcı cihazlarıdır. Donanım/screen reader/tüm tarayıcı/üretim TLS-TURN veya tam WCAG sonucu çıkarılmaz. Global kutular bu sınırlı kapsamla `[x]` yapılmadı. Lint/type/build/bundle geçti; API eki ayrı backend worktree'sindedir. Kayıt: `docs/compliation/2026-10-18-meeting-frontend.md`.

## Toplantı backend — 2026-10-18 (sınırlı kapsam)

Yalnız yeni API'lerin validation/pagination/error state, cookie/CSRF ve proje kapsamlı authorization sözleşmeleri etkilenir. Frontend route, component, CSS, metadata, footer ve görsel davranış değiştirilmez; önceki global kutular yeniden audit edilmez veya bu backend teslimiyle `[x]` yapılmaz. Hedefli PostgreSQL/concurrency/OpenAPI/SFU ve güvenlik kanıtları completion kaydında tutulur. Sonraki frontend görevinde loading/empty/error/forbidden, otomatik yeniden bağlantı, cihaz izinleri ve guest cookie/medya veri akışı açıklamaları uygulanmalıdır. Üretim TLS/TURN ve gerçek cihaz/ağ doğrulaması bu teslimden çıkarılamaz. API devir belgesi: `docs/meeting-backend-handoff.md`.

## Tam boy sohbet dış kaydırma kilidi — 2026-10-15 (sınırlı kapsam)

Responsive / Keyboard Navigation / Focus State / Navigasyon kapsamı yalnız full sohbet scroll sınırıdır: uzun gerçek Görevler sayfasında 120 px arka plan konumu desktop/mobile wheel, sidebar wheel, PageDown/Space, mesaj bilgisi dialogu ve mobil drawer boyunca korunur. İç mesaj kaydırması çalışır; bar/compact/close sonrası root kaydırması açılır, route değişiminde inert/kilit temizlenir. Gerçek API/Chromium hedefli test 1/1, lint/TypeScript/diff başarılı; desktop/mobile görüntüleri incelendi. Global kutular bu kapsamla değiştirilmedi. Kayıt: `docs/compliation/2026-10-15-chat-document-scroll-lock.md`.

## Görevler / Görevlerim sayfalama — 2026-10-15 (sınırlı kapsam)

Etkilenen Pagination / Navigasyon / Form Validation / Empty State / Responsive kapsamı yalnız iki görev listesidir: sayfa başına 9 benzersiz görev, gruplu proje listesinde de sayfa kontrolleri, URL sayfası/filtre sıfırlama ve küçülen son sayfada son geçerli sayfaya dönüş doğrulandı. Gerçek API ile Chromium kart/tablo 19 görevde 9/9/1, önceki/sonraki/numara/reload, mobil 390 px taşmasız geçişler ve son satır tamamlama/açık detay regresyonu başarılı. Desktop gruplu tablo ve mobil kart ekran görüntüleri incelendi. Global kutular bu sınırlı kanıtla değiştirilmedi; ayrıntı `docs/compliation/2026-10-15-task-list-pagination.md`.

## Sohbet Markdown ekleri — 2026-10-15 (sınırlı kapsam)

Form Validation / Error State kapsamında ortak dosya seçici/drop/paste uzantı listesi ve TR/EN/DE hata metni `.md` desteğiyle güncellendi. Strict UTF-8 ve 2 MiB sınırı korunur; dosya HTML olarak render edilmez. Güncel yerel backend üzerinde `.md` ve `.env` gerçek Chromium gönderimleri 2/2 başarılı, validator 9/9, lint/TypeScript/diff başarılı. Global kutular bu dar kapsamla değiştirilmedi. Ayrıntı: `docs/compliation/2026-10-15-chat-markdown-attachments.md`.

## Sohbet .env ekleri — 2026-10-15 (sınırlı kapsam)

Yerel çalışma zamanı takip doğrulaması: eski 14 Ekim backend imajı güncellenip yalnız dev backend yeniden oluşturuldu. Mevcut QA hesaplarıyla normal login sonrası gerçek Chromium chooser/drop/paste `.env` gönderimi 1/1 başarılı; health UP ve frontend HTTP 200. Global kutular değiştirilmedi. Ayrıntı aynı completion kaydındadır.

Etkilenen Form Validation / Error State kapsamı yalnız sohbet ek türü doğrulamasıdır: ortak chooser/drop/paste filtresi ve TR/EN/DE hata metni `.env` desteğiyle güncellendi; sunucu strict UTF-8, boyut ve MIME denetimi uygular. Görünüm veya navigasyon değişmedi. Global kutular bu dar kapsamla değiştirilmedi; hedefli test sonuçları ve manuel kontroller `docs/compliation/2026-10-15-chat-env-attachments.md` içindedir.

## Sohbet Yeniden Adlandırma ve WhatsApp Benzeri Mesaj Durumları — 2026-10-12

Mesajlaşma bölümü tüm navigasyon, panel, dock, tooltip ve hata metinlerinde "Sohbet" (EN: "Chat", DE: "Chat") olarak yeniden adlandırıldı. Gönderilen mesajlar için WhatsApp benzeri tek tik (SENT), çift tik (DELIVERED) ve mavi çift tik (READ/SEEN) durum simgeleri entegre edildi. Alıcı istemci mesajı aldığında POST /conversations/{conversationId}/delivered ile teslim teyidi iletir, sunucu DELIVERED socket eventi ile gönderenin ekranındaki tiki çift tike çevirir; okunduğunda SEEN socket eventi ile mavi çift tike çevrilir. Hem birebir hem grup sohbet kuralları desteklenir. V49 migration ile delivered_at takibi eklendi. Frontend Turbopack production build ve TypeScript kontrolü başarılı; backend 86 chat/websocket/migration testinin tamamı başarıyla geçti (0 fail/error/skip). Kayıt: `docs/compliation/2026-10-12-chat-rename-and-delivery-status.md`.

## Çoklu proje türleri — 2026-10-12

Create/edit ortak çoklu checkbox grubu, en az bir seçim, boş seçim hata/focus/aria-describedby, taslak/Vazgeç/kayıt/reload, kart/önizleme rozetleri ve birleşik/tekrarsız teknoloji önerileri doğrulandı. Production kaynakta 4 Chromium + 4 mobil WebKit testi: TR/EN/DE, light/dark, 320/390/768/1440 px, >=44 px label hedefleri, overflow ve hata/retry; mobil görseller incelendi. PostgreSQL integration 30/0 failure/error/skip: çoklu kayıt/update/list, legacy-client koruması, validation/auth/CSRF, V47→V48 tüm beş legacy türün backfill/constraint kontrolü. Lint/TypeScript/frontend build/backend package/diff başarılı. Form Validation / Responsive / Keyboard Navigation / Focus State / Screen Reader / QA global kutuları bu sınırlı kapsamla tamamlanmış sayılmadı. Kayıt: `docs/compliation/2026-10-12-project-multiple-types.md`.

## Navbar görünürlük seçimi — 2026-10-12

Ayarlar iki seçenek sunar: Her zaman görünür / Otomatik gizlen. Taslak, Vazgeç, Kaydet, kayıtlı tercihin reload sonrası uygulanması; 320/390/768/1440 px, TR/EN/DE, light/dark, açık drawer/focus ve dokunmatik yukarı scroll/reduced-motion kontrolleri üretim build üzerinde 6 Chromium + 6 mobil WebKit testiyle doğrulandı; görseller incelendi. Backend own-account/CSRF/invalid/legacy-client/relogin ve V46→V47 veri koruma/DB CHECK toplam 5 test geçti. Saved-preferences cache userId kapsamına alındı ve GET abort desteği eklendi. Hedefli ESLint/TypeScript/build/diff başarılı. Responsive / Keyboard Navigation / Focus State / Form Validation / QA global kutuları bu dar kapsamla tamamlanmış sayılmadı. Kayıt: `docs/compliation/2026-10-12-navbar-visibility-preference.md`.

## Hamburger çekmecesi yumuşak açılma — 2026-10-12

Çalışma alanı çekmecesi 280 ms soldan kayma ve 200 ms kapanma, eşzamanlı backdrop fade kullanır. Chromium + mobil WebKit'te nested dil/tema/Escape/odak/rota/resize ve fullscreen chat erişimi toplam 4 hedefli test geçti. Chromium frame örneklemesinde gerçek ara konumlar, final x=0/scale=1, reduced-motion ve motion-off altında 0.01 ms geçiş doğrulandı; lint/TypeScript/diff başarılı. Global erişilebilirlik/QA kutuları değişmedi. Kayıt: `docs/compliation/2026-10-12-workspace-drawer-soft-motion.md`.

## Mobil navbar gizlenmesini kaldırma — 2026-10-12

Mobil/tablet ve touch-primary cihazlarda auto-hide kapatıldı; yalnız >=1024 px hover/fine-pointer desktop'ta sürer. Güncel dev kaynakta 390/768 px idle/scroll/drawer/focus ve 1440 px desktop/touch + mobile resize senaryosu Chromium ve mobil WebKit'te birer başarılı; TypeScript/lint/diff geçti. Eski gerçek hesaplı touch test beklentileri uyarlandı; o backendli paket bu küçük takipte çalıştırılmadı. Global kutular değişmedi. Kayıt: `docs/compliation/2026-10-12-mobile-navbar-always-visible.md`.

## Oturum içi mobil navbar — 2026-10-12 (sınırlı kapsam)

AppHeader 640 px altında tek satır/56 px, 44 px hamburger/arama/bildirim/hesap ve PDA logo kullanır; dil/tema/native history mevcut çekmecededir. Main/fullscreen chat reserve mobil 80 px / desktop 72 px. Arama kapatma/odak, viewporta sığan sonuçlar, drawer Escape/nested dil menüsü/rota/resize, native geri ve dürüst unsupported fallback, auto-hide/drawer hold ve chat inert sınırı doğrulandı. Production build üzerinde 38 Chromium (28 landing/gerçek component + 2 native history + 8 yeni UI) ve 8 dokunmatik mobil WebKit başarılı; lint/TypeScript/build/diff geçti. TR/EN/DE, light/dark, 320/390/640/768/1024/1440 px geometrisi ve ekran görüntüleri incelendi. UI testleri açıkça TEST-ONLY REST/WS fixture kullanır; service worker yalnız fixture routing'i güvenilir kılmak için bu testlerde bloklanır. Gerçek backend hesaplı geniş gate ve gerçek cihaz kontrolü yapılmadı. Responsive / Mobil Görünüm / Keyboard Navigation / Focus State global kutuları değişmedi. Kayıt: `docs/compliation/2026-10-12-workspace-mobile-navbar.md`.

## Landing mobil menü, scroll animasyonları ve ortak footer — 2026-10-12 (sınırlı kapsam)

Footer kullanıcı takip düzeltmesi: GitHub hesapları yan yana, iletişim + e-posta aynı satırda, kaynak/lisans ve telif/sürüm ortalı; mobil dikey boşluk azaltıldı. Güncel dev sunucusunda 7 Chromium footer testi (TR/EN/DE, iki tema, 320/390/768/1440 px, landing/login/about + link/sürüm) ve Türkçe mobil WebKit matrix testi başarılı. 320/390 px koyu görseller ve aynı-satır geometrisi incelendi. Footer `[x]` kalır; proje geneli responsive/erişilebilirlik kutuları değişmedi. Kayıt: `docs/compliation/2026-10-12-footer-compact-mobile.md`.

Takip görsel düzeltmesi: mobil menü dil/tema kontrol satırının grid kaynaklı uzaması giderildi; dil etiketi, eşit 46 px yükseklik ve ayraç eklendi. 320/390 px koyu ve 390 px açık görüntüler incelendi; mevcut menü klavye/nested dil menüsü/Escape/dış tıklama/desktop geçişi/rota testi Chromium ve mobil WebKit'te birer başarılı. İlk dış-tıklama testi menünün kapladığı hero başlığına tıklıyordu; gerçek dış gutter koordinatıyla düzeltildi, kapanma assertion'ı korunuyor. Önceki geniş production gate bu küçük takip değişikliği için tekrarlanmadı; global kutular değişmedi. Kayıt: `docs/compliation/2026-10-12-mobile-menu-controls.md`.

Landing hamburger disclosure (1024 px altı; dil/tema/linkler, Escape/odak dönüşü, dış tıklama, viewport değişimi), 480 px ve üstü yükseklikte mobil/tablet/kısa laptop scroll hikâyesi, görünür demo alanlarına kamera ve mobil üye kartı animasyonu, kompakt terminal → teknoloji geçişi, reduced-motion/statik geri dönüş ve ortak footer satır kırılması/44 px hedefler doğrulandı. Üretim build üzerinde 45 Chromium + 8 dokunmatik mobil WebKit testi başarılı; TR/EN/DE, light/dark, 320/390/768/1280/1440/1920 px ve kısa yatay ekran kapsamı; ekran görüntüleri incelendi. Lint, TypeScript, production build ve diff kontrolü başarılı. Footer mevcut ortak kapsamını korur; Responsive / Mobil Görünüm / Keyboard Navigation / Focus State global kutuları bu teslimle tamamlanmış sayılmaz. Ayrı mobil WebKit denemesinde mevcut skip-link ilk Tab odağı testi başarısız kaldı; nihai 8 test bu ayrı klavye testini kapsamaz, gerçek iOS klavye kontrolü açıktır. Kayıt: `docs/compliation/2026-10-12-landing-mobile-navigation-motion-footer.md`.

## Sohbet kullanım ipucu kaldırılması — 2026-10-11

Takip düzenlemesi: Gönder düğmesi 44×44 px ve mesaj alanına dikey ortalıdır. İlgili Responsive / erişilebilirlik global kutuları bu küçük stil değişikliğiyle tamamlanmış sayılmadı.

Kullanıcı isteğiyle ortak sohbet mesaj alanındaki Enter/Shift+Enter alt metni kaldırıldı. Karakter sayacı, doğrulama hataları ve klavye davranışı korunur; hata/durum açıklamalarının erişilebilir bağlantıları koşullu tutulur. Form Validation / Keyboard Navigation / Screen Reader global kutuları değiştirilmedi. Kayıt: `docs/compliation/2026-10-11-chat-composer-hint-removal.md`.

## Hakkımızda başlık sadeleştirmesi — 2026-10-11

Kullanıcı isteğiyle Hakkımızda sayfasında görünür breadcrumb ve PDA üst etiketi TR/EN/DE için kaldırıldı. Mevcut JSON-LD ve sayfa içi bölüm navigasyonu korunur; Breadcrumb / Breadcrumb Structured Data global kutuları değiştirilmedi. Kayıt: `docs/compliation/2026-10-11-about-header-simplification.md`.

## İletişim gezinme yolu kaldırılması — 2026-10-11

Kullanıcı isteğiyle iletişim sayfasındaki görünür ana sayfa → iletişim satırı kaldırıldı (TR/EN/DE ortak bileşen). Türkçe açıklama kısaltıldı; soyadın isteğe bağlı metni placeholder'a taşındı. Başlık, form işlevi ve mevcut JSON-LD korunur. Breadcrumb, Breadcrumb Structured Data, Responsive ve Form Validation global kutuları değiştirilmedi; önceki iletişim breadcrumb kayıtları tarihsel doğrulamalardır. Kayıt: `docs/compliation/2026-10-11-contact-breadcrumb-removal.md`.

## Kayıt doğrulama / yeniden kod sayaçları — 2026-10-11 (sınırlı kapsam)

Kayıt ekranında 3 dakikalık yeniden kod beklemesi ile ilk gönderimden başlayan toplam 15 dakikalık kayıt süresi ayrıldı. Yenileme toplam süreyi uzatmaz; sayfa yenilenince iki sayaç korunur. Süre sonunda kod alanı kapanır ve yeniden kayıt bağlantısı görünür. Gönderim hatası kodu/süreyi korur; başarılı yeniden gönderimde kod alanı temizlenip odaklanır. TR/EN/DE 320 px başlangıç/expiry görünümlerinde yatay taşma yok, ekran görüntüleri incelendi. Ortak şifre sıfırlama davranışı korundu. Etkilenen Form Validation / Error State / Success State / Responsive / Focus State global kutuları yalnız bu yüzey doğrulandığı için değiştirilmedi. 41 backend testi, 7 yeni Chromium senaryosu + 1 mevcut odak/süre regresyonu, TypeScript ve hedefli ESLint başarılı. Browser timer/failure testleri açıkça stub yanıtlar kullanır; süre/temizlik gerçek PostgreSQL entegrasyon testleriyle doğrulandı. Kayıt: `docs/compliation/2026-10-11-kayit-dogrulama-sureleri.md`.

## general-features / main iletişim conflict doğrulaması — 2026-10-11

İletişim sayfasının breadcrumb'ı ile main'in görünür e-postası birlikte korundu; gerçek teslimat testinin ortak alıcı sabiti, kategori ve bot koruması kontrolleri birleştirildi. TypeScript, hedefli ESLint, production build ve 22 Chromium testi başarılı; TR/EN/DE breadcrumb/JSON-LD eşleşmesi, form/klavye/320–1440 px ve gerçek Mailpit teslimatı doğrulandı. Genel checkbox'lar değiştirilmedi. Kayıt: `docs/compliation/2026-10-11-general-features-main-conflicts.md`.

## Frontend başarısız test düzeltmeleri — 2026-10-11

İletişim sayfasına ortak `Breadcrumb` eklendi; görünür iki öğe mevcut `PageJsonLd` ile TR/EN/DE eşleşir. Navbar testleri üst kenarda navbar'ın yatay merkezinden açılma ve sidebar etkileşimi sonrası yeniden açılarak ölçüm yapma standardını kullanır. Cihaz reduced-motion tercihi testlerde korunur. Önceki 18 başarısız ve seri admin grubunda çalışmayan 6 senaryo hedefli koşumlarla doğrulandı: 39 senaryo, ilk koşum 38 başarılı/1 ölçüm hazırlığı hatası; son kalan test düzeltmeden sonra başarılı. Lint/TypeScript/build geçti. Breadcrumb/structured-data/keyboard global kutuları bu sınırlı kapsamla değiştirilmedi; 945 testlik paket yeniden çalıştırılmadı. Kayıt: `docs/compliation/2026-10-11-frontend-failed-tests-fixes.md`.

## Frontend başarısız test düzeltmeleri — 2026-10-11

İletişim sayfasına ortak `Breadcrumb` eklendi; görünür iki öğe mevcut `PageJsonLd` ile TR/EN/DE eşleşir. Navbar testleri üst kenarda navbar'ın yatay merkezinden açılma ve sidebar etkileşimi sonrası yeniden açılarak ölçüm yapma standardını kullanır. Cihaz reduced-motion tercihi testlerde korunur. Önceki 18 başarısız ve seri admin grubunda çalışmayan 6 senaryo hedefli koşumlarla doğrulandı: 39 senaryo, ilk koşum 38 başarılı/1 ölçüm hazırlığı hatası; son kalan test düzeltmeden sonra başarılı. Lint/TypeScript/build geçti. Breadcrumb/structured-data/keyboard global kutuları bu sınırlı kapsamla değiştirilmedi; 945 testlik paket yeniden çalıştırılmadı. Kayıt: `docs/compliation/2026-10-11-frontend-failed-tests-fixes.md`.

## Navbar scroll düzeltmesi — 2026-10-11

Yalnız oturum içi navbar etkileşimi kontrol edildi: masaüstünde navbar dışında yukarı scroll ve scrollbar kenarında yukarı çıkma görünürlüğü tetiklemez; hover/focus/açık bildirim popup'ı/Ctrl-K/dokunmatik drawer ve dokunmatik scroll-up erişimi korunur. Dört hedefli Chromium testi, TypeScript ve hedefli ESLint başarılıdır. Keyboard/Focus/Responsive global kutuları bu sınırlı kontrolle değiştirilmedi. Kayıt: `docs/compliation/2026-10-11-navbar-scroll-reveal-fix.md`.

## source-map-js security follow-up — 2026-10-06

Onaylı ayrı transitive patch 1.2.1→1.2.2; application/invitation/UI/test kaynakları değişmedi. Temiz npm ci, lint/TypeScript/build, 33 targeted Chromium ve canonical pre-push geçti: 469 backend testi, 0 failure/error/skip; 248 Chromium passed + 1 expected crash-route skip; Docker health PASS. Güncelleme sonrası full audit 5 high (mevcut dev debt), production audit 0. Global checklist kutuları değişmedi. Ayrı kayıt: `docs/compliation/2026-10-06-source-map-js-security-remediation.md`.

## Invitations remediation — 2026-10-06

INV-AUD-003/001/002/004 minimum kapsamla düzeltildi: gerçek actor switch/late response, expiry/resend/reinvite/prepared DB, legacy warm client navigation, external signed-in regression ve status/retry/real429 doğrulandı. Canonical gate geçti: 469 backend testi, 0 failure/error/skip; 248 Chromium passed + 1 expected production crash-route skip; lint/TypeScript/build/Docker health PASS. Global checklist kutuları değişmedi. Invitation tesliminde package/lock değişmemişti ve audit 6 high/production1 idi; source-map-js bulgusu daha sonraki ayrı security remediation ile kapatıldı. Ayrı kayıt: `docs/compliation/2026-10-06-invitations-integration-remediation.md`.

## 2026-10-06 Chat action menu / workspace history

Tek chevron/menu lifecycle/focus, yakın reaction chips, native same-origin history/fallback, responsive header reserve ve full-close/dock persistence kapsamı doğrulandı. Hedefli50+2 Chromium; final gate 464 backend0 failure/error/skip, 240 Chromium+1 expected production crash-route skip, lint/type/build/Docker health PASS. Bu scoped kanıt global accessibility/multi-browser/production kutularını topluca [x] yapmaz. Ayrıntı: `docs/compliation/2026-10-06-chat-action-menu-workspace-history.md`.

## Organization–Project remediation — 2026-10-05 (sınırlı kapsam)

Explicit standalone/assign/remove/move UI→API→prepared PostgreSQL read, co-manager current summary/plain-text capability, retained archive/Home200, affected old/new cache prefix ve independent projects loading/error/retry/empty/page clamp doğrulandı. 101 owned org picker +101 linked project pagination; TR/EN/DE, keyboard,320/390/768/1440px/light-dark screenshot kontrolü geçti. Full gate PASSED:464 backend (0 fail/error/skip),232 Chromium+1 expected production crash-route skip; lint/type/build/Docker health. Schema/migration/auth/CSRF/CORS/ENV değişmedi; mevcut dev npm debt5 high/production0 ayrı. Bu scoped kanıt genel checklist kutularını topluca [x] yapmaz. Ayrıntı: `docs/compliation/2026-10-05-organization-project-integration-remediation.md`.

## 2026-10-05 — Chat navigation, reply/reaction ve emoji kapsam doğrulaması

Full→closed page navigation, compact/bar draft persistence, modifier/cancel/back-forward intent, focus/inert cleanup, scoped reply/reaction REST/DB/WS, versioned cache ve reconnect batch50/shared2 resync doğrulandı. TR/EN/DE, keyboard/Escape/caret/IME, 2000 code-point sınırı, light/dark, 320/390/768/1440 px ve motion kontrolleri geçti; screenshot animasyon sonunda incelendi. Tam kapı: 459 backend (0 fail/error/skip), 225 Chromium + 1 expected production crash-route skip; lint/type/build/Docker health başarılı. Mevcut dev npm debt5 high / production0. Bu sınırlı kapsam genel accessibility, multi-browser veya production checklist kutularını topluca [x] yapmaz. Ayrıntı: `docs/compliation/2026-10-05-chat-replies-reactions.md`.

## Npm/CSS remediation — 2026-10-05 (sınırlı kapsam)

Shadcn CLI kaldırıldı; kullanılan yedi durum varyantı yerel CSS'te korundu. Üretilen CSS karşılaştırması, light/dark state/animation testleri, gerçek form/settings/chat akışları ve ekran görüntüleri doğrulandı. Hedefli 73, landing 23, tam Chromium 208 passed + 1 expected production skip; son pre-push 449 backend testi ile PASSED. Full npm audit 8→5 high; production audit 6→0. Kalan ESLint/braces zinciri açık security debt. Bu kapsam proje geneli kutuları tamamlanmış saymaz. Ayrıntı: `docs/compliation/2026-10-05-npm-security-remediation.md`.

## Görev modeli frontend doğrulaması — 2026-10-05 (sınırlı kapsam)

Basit/gelişmiş form ve detay, yorum/mention, kurucunun ilk tercihi/proje ayarı, açıklama tercihi, taslak koruma, URL tür filtresi, dönüşüm/veri koruma ve ortak sidebar politikası uygulandı. Son kaynak üzerinde 12 Chromium senaryosu; light/dark 390/1440 px form ve 390/768/1024/1440 px DE proje ayarı, keyboard/focus/validation ve reduced-motion kontrolleri başarılı. ESLint, TypeScript, production build ve 449 backend testi geçti. Tam frontend koşumu: 188 passed, 6 mevcut sohbet/landing failure, 13 serial test çalışmadı; genel E2E kapısı yeşil sayılmaz. Form/keyboard/loading/error gibi proje geneli maddeler bu sınırlı kanıtla [x] yapılmaz. Ayrıntı: `docs/compliation/2026-10-05-task-basit-gelismis-frontend.md`.

## Görev modeli backend doğrulaması — 2026-10-05

Basit/gelişmiş proje ve görev modeli için backend validation, cookie/CSRF/kurucu-yetki kapsamı, ProblemDetail, veri koruma, DB filtre/sayfalama, migration ve eşzamanlı işlemler test edildi. Tam kapı 447 test; son kilit yanıtı ve havuz temizleme düzenlemelerinden sonra 43 hedefli test başarılı, failure/error/skip yok. Yerel Docker backend health UP ve V54 migration doğrulandı. Frontend kaynakları, form/dialog/sidebar/i18n/görsel davranış bu aşamada değişmedi veya yeniden doğrulanmadı; proje geneli checklist maddeleri bu sınırlı backend kanıtıyla [x] yapılmaz. Detay: `docs/compliation/2026-10-05-task-basit-gelismis-backend.md`.

## Backend integration audit — 2026-10-05 (sınırlı kapsam)

Organization metadata/media gerçek API, PostgreSQL, dosya storage ve cache-disabled reload ile doğrulandı; logo ve cover container force-recreate sonrasında aynı byte hash'lerine sahip. Project settings logosu yeni browser context'te gerçek detail/image GET ile doğrulandı. Organization picker 101. kayıt ve rename → Project Home cache regresyonları ayrı onayla düzeltildi. Chat navigation/proje/hesap sınırları ve iki subscription renewal overlap sırasında tek mesaj unread artışı doğrulandı; duplicate MESSAGE side effect'i ayrı onayla giderildi. Son kaynak tam kapı: 415 backend + 182 Chromium passed, 1 expected production skip; lint/TypeScript/build/Docker health başarılı. Bu sınırlı audit proje geneli maddeleri [x] yapmaz. Ayrıntı: `docs/compliation/2026-10-05-backend-integration-mock-audit.md`.

## Göreve ait sınırlı doğrulama — 2026-10-04

### Organization profili — 2026-10-05

Referans tasarım ek kapsamı: ikonlu dört bölüm, geniş iki kolon, tile upload, üç preview ve kaydedilen notes alanı TR/EN/DE, light/dark, 320/390/768/1280/1440 px kontrollerinden geçti; 1536×1024 referans screenshot incelendi. Notes error/counter/owner/1000 sınırı ve persistence doğrulandı; ortak Project picker ve sohbet dock regresyonları geçti. Yeni final kapı: 415 backend, 180 Chromium passed + production kontrollü crash route için 1 expected skip. Kapsam kaydı: `docs/compliation/2026-10-05-organization-reference-ui-notes.md`; global checklist maddeleri bu sınırlı kanıtla tamamlanmış sayılmaz.

Organization create/edit/detail/list ve ortak media picker için dosya/URL/e-posta validation, hata/başarı/partial retry, initials/cover fallback, klavye/focus, decorative görseller, object URL cleanup ve sticky actions kontrol edildi. TR/EN/DE, light/dark, 320/390/768/1280/1440 px ve reduced motion hedefli Chromium testleri geçti; screenshot incelendi. Sohbet barı Save alanını 320/390/1280 px'te örtmüyor. Full gate: 413 backend testi ve 180 Playwright testi başarılı; production'da kapalı kontrollü crash route testi 1 expected skip. Bu sınırlı kanıt aşağıdaki proje geneli accessibility/çok tarayıcı/production maddelerini `[x]` yapmaz. Detay: `docs/compliation/2026-10-05-organization-profile-expansion.md`.

Chat persistence ve proje logo ayarlarında client-side navigasyon, klavye/focus, X/Escape, boş/hata/yüklenme/başarı durumları, görsel fallback, dosya doğrulaması ve mobil dock/ayar çubuğu yerleşimi kontrol edildi. TR/EN/DE ve açık/koyu tema için hedefli Chromium E2E ve ekran görüntüsü incelemesi yapıldı. Proje oluşturma, banner ve mevcut yetki kontrolleri regresyona dahil edildi. Bu kanıt yalnız değişen akışları kapsar; aşağıdaki proje geneli accessibility, tüm tarayıcılar ve production QA maddeleri bununla `[x]` yapılmaz. Ayrıntılı sonuç tamamlanan teslimin `docs/compliation/2026-10-04-chat-persistence-project-logo.md` kaydında tutulur.

Bu dosya proje sonunda **AI'ye, geliştiriciye veya reviewer'a verilerek tek tek kontrol edilmek** üzere hazırlanmıştır.

## AI İçin Kontrol Talimatı

Bu checklist uygulanırken:

1. Her maddeyi **tek tek** incele.
2. Bir şeyi yalnız dosya isminden veya varsayımdan dolayı tamamlanmış sayma.
3. Mümkün olduğunda kod, route, component, config, test çıktısı veya production URL ile kanıtla.
4. Doğrulanan maddeyi `[x]` yap.
5. Eksik veya hatalı maddeyi `[ ]` bırak ve altına kısa gerekçe yaz.
6. Projede uygulanabilir olmayan madde için `N/A — <gerekçe>` yaz.
7. Güvenlik detaylarını bu dokümanda genişletme; ayrı `SECURITY.md` üzerinden kontrol et.
8. Kontrol sonunda:
   - Toplam madde
   - PASS
   - FAIL
   - N/A
   - Production blocker olan maddeler
   özetlenmelidir.

---

# A — Genel / Kurumsal

- [x] **Footer** — Kullanıcının yasal, kurumsal ve önemli bağlantılara site genelinde ulaşmasını sağlar.
  - 2026-10-12: Güncel kod landing/auth/public sayfalarda aynı `SiteFooter` bileşenini kullanır. Mobil bilgi bağlantıları iki sütun, ekip/iletişim/kaynak/lisans blokları sola hizalıdır; TR/EN/DE, iki tema, 320/390/768/1440 px hedef/taşma ve mevcut footer link/sürüm/odak kontrolleri production build üzerinde doğrulandı. Oturumlu çalışma alanı hesabındaki bilgi bağlantıları korunur.
  - 2026-10-03: Auth ve bilgi sayfalarında SiteFooter, landing’de kompakt LandingFooter bulunur. Kullanıcı tercihiyle çalışma ekranlarında footer yerine hesap menüsündeki “Bilgi ve destek” bağlantıları kullanılır. Public test paketi bu erişimi doğrular.
  - 2026-10-05: Landing footer, login ile aynı ortak CONTRIBUTORS listesinden Alper/Hamza GitHub profillerini ve aynı kaynak kod/Apache 2.0 bağlantısını gösterir. TR/EN/DE, light/dark, 320/390/1440 px hedefli kontrol; doğru href, ikon, metin, 44 px hedef ve klavye odağı doğrulandı.
- [x] **KVKK** — Kişisel veri işleme süreçleriyle ilgili gerekli bilgilendirme ve kullanıcı hakları erişilebilir olmalıdır.
  - 2026-10-11: "KVKK Aydınlatma Metni" (`/kvkk`) son metindir: veri sorumluları, veri kategorileri, amaç–hukuki sebep tablosu, alıcılar ve yurt dışı aktarım, saklama tablosu, m.11 hakları + başvuru yolu (form kategorisi + `info@pd-assistant.com`, en geç 30 gün), VERBİS değerlendirmesi (sonuç henüz yok, metinde böyle yazılı). Kayıt formunda KVKK/Gizlilik için aydınlatma bildirimi var (onay kutusu yok); Kullanım Koşulları ayrı onay kutusuyla kabul edilir (yalnız istemci doğrulaması, kaydedilmez). Hukuki danışman incelemesi yapılmadı; metin proje sahiplerinin kararıyla yayındadır. (2026-10-11, `docs/compliation/2026-10-11-auth-service-frontend-legal-contact-analytics.md`)
- [x] **Gizlilik Politikası** — Kullanıcı verilerinin nasıl toplandığını, kullanıldığını ve gerektiğinde saklandığını/paylaşıldığını açıklar.
  - 2026-10-11: güncel veri kategorileri, hesap silme/anonimleştirme, saklama tablosu, güvenlik, çocuklar; EN/DE sürümlerinde GDPR bölümleri (Art. 13/6/Chapter V/haklar/Art. 27 değerlendirmesi). (2026-10-11, `docs/compliation/2026-10-11-auth-service-frontend-legal-contact-analytics.md`)
- [ ] **Erişilebilirlik** — Site farklı kullanıcı ihtiyaçları düşünülerek erişilebilir biçimde geliştirilmiş olmalıdır.
- [ ] **Sıkça Sorulan Sorular** — Yaygın kullanıcı sorularını destek talebi oluşturmadan cevaplar; ürün için gereksizse N/A gerekçesi yazılmalıdır.
- [ ] **Çerez Onayı** — Gerekli durumlarda kullanıcının çerez tercihlerini yönetmesini sağlar.
- [x] **Çerez Politikası** — Çerez onay banner'ından ayrı olarak kullanılan çerezlerin türlerini ve amaçlarını açıklar.
  - 2026-10-11: tam envanter tablo olarak (çerezler, localStorage, sessionStorage; ad/tür/amaç/süre); `legal-pages.spec.ts` koddaki her `pda:*`/`PDA_*` anahtarının sayfada geçtiğini tarar. Analitik saklama 12 ay, ziyaretçi kimliği 12 ayda yenilenir; DE metni § 25 TDDDG. (2026-10-11, `docs/compliation/2026-10-11-auth-service-frontend-legal-contact-analytics.md`)
- [ ] **Hakkımızda Sayfası** — Projenin, ürünün veya kurumun kim olduğunu ve ne sunduğunu açıklar.
- [x] **Kullanım Koşulları** — Kullanıcı ile platform arasındaki kullanım kurallarını ve sorumlulukları tanımlar.
  - 2026-10-11: `/terms` (TR `kullanim-kosullari`, DE `nutzungsbedingungen`): kapsam, hesap kuralları, kabul edilebilir kullanım, kullanıcı içeriği, garanti yok, askıya alma, hesap silme, açık kaynak lisansı ilişkisi, sorumluluk sınırı, uygulanacak hukuk (Türkiye), değişiklikler. Altbilgi ve hesap menüsünde bağlantı var. (2026-10-11, `docs/compliation/2026-10-11-auth-service-frontend-legal-contact-analytics.md`)
- [x] **İletişim / Destek Kanalı** — Kullanıcının problem, KVKK talebi veya genel iletişim için ulaşabileceği açık ve çalışan bir kanal sağlar. (2026-10-09: herkese açık iletişim formu `/iletisim`; yerel gerçek SMTP yolu Mailpit ile kanıtlandı, üretimde `MAIL_ENABLED`/`SMTP_*` yapılandırması gerekir; 2026-10-11: tek görünür adres `info@pd-assistant.com` altbilgide, iletişim sayfasında ve bilgi sayfalarının iletişim bloğunda; form kategori, isteğe bağlı soyad, honeypot + süre tuzağı ve veri işleme bildirimi içerir.)

# B — CTA / UX / UI State

- [x] **Net BİR CTA** — Kullanıcıya “Kayıt Ol”, “Başla”, “İletişime Geç” gibi bir sonraki ana aksiyonu açıkça gösterir.
  - 2026-10-03: `/` landing page final ana aksiyonu “Serüvene katıl” → `/register`; “Giriş yap” ikincildir. Üç dil içerikleri ve mevcut link akışı `landing-page.spec.ts` ile doğrulandı.
- [ ] **Responsive Design** — Site telefon, tablet, laptop ve masaüstünde düzgün kullanılmalıdır.
  - 2026-10-04: Scroll-story landing ve gerçek component demo 320/390/768/1280/1440/1920 px, light/dark ve 1280×720 kısa ekran akışı doğrulandı. Gerçek route ile demo sidebar/navbar/form/tablo/task stilleri karşılaştırıldı; logo 1440/1920 px’de 110px ve mevcut navbar yüksekliğiyle kontrol edildi. Proje genelindeki tüm çalışma ekranları denetlenmedi; bu yüzden genel madde açık.
- [ ] **Mobil Görünüm Responsive Testleri** — Kritik sayfalar gerçekçi mobil viewportlarda test edilmelidir.
  - Landing'in son 23 testi ile auth/bilgi footer'ları ve hata ekranlarının 28 testi (toplam 51 farklı kontrol) doğrulandı (2026-10-04); tüm kritik oturum içi akışlar bu teslimin kapsamı değildir.
- [ ] **Loading State** — Veri veya sayfa yüklenirken kullanıcı sistemin çalıştığını anlayabilmelidir.
- [ ] **Empty State** — Veri olmadığında boş ekran yerine nedenini ve mümkünse sonraki aksiyonu anlatmalıdır.
- [ ] **Error State** — Bir işlem başarısız olduğunda kullanıcıya problemi ve mümkünse çözüm/yeni deneme yolunu göstermelidir.
- [ ] **Success State** — Kayıt, gönderim veya güncelleme gibi işlemlerin gerçekten tamamlandığını kullanıcıya net biçimde göstermelidir.
- [ ] **Form Validation** — Eksik veya hatalı girişler kullanıcıya anlaşılır biçimde gösterilmelidir.
- [ ] **Breadcrumb** — Gerekli hiyerarşik sayfalarda kullanıcının site içinde nerede olduğunu ve üst seviyelere nasıl döneceğini göstermelidir.

# C — SEO / GEO

- [ ] **SEO / GEO** — Public içerik hem klasik arama motorları hem de AI tabanlı keşif sistemleri tarafından anlaşılabilir olmalıdır.
- [ ] **Meta Data** — Arama motorlarına ve tarayıcılara sayfanın başlık, açıklama ve ilgili metadata bilgilerini vermelidir.
  - Landing page üç dilde title/description ve OpenGraph metadata üretir; diğer rotaların tüm metadata alanları bu görevde denetlenmedi.
- [ ] **Unique Page Title** — Her önemli public sayfa arama motorlarında ve tarayıcı sekmesinde kendisini doğru tanımlayan benzersiz bir title'a sahip olmalıdır.
- [x] **sitemap.xml** — Arama motorlarının sitenin önemli public sayfalarını keşfetmesini sağlamalıdır.
  - 2026-10-04: Sitemap TR/EN/DE landing, giriş, kayıt, SSS ve erişilebilirlik adreslerini hreflang eşleriyle içerir; noindex taslaklar listelenmez.
- [x] **robots.txt** — Arama motoru botlarına hangi alanların taranabileceğini belirtmeli ve yanlışlıkla public siteyi engellememelidir.
  - 2026-10-04: TR/EN/DE public yollar açık; API, yerelleştirilmiş çalışma alanı, hata ve dev rotaları dışlanır. Bu dosya erişim güvenliği değildir. Production üzerinde ayrıca doğrulanmalıdır.
- [x] **Canonical URL'ler** — Her dildeki public sayfa kendi asıl adresini bildirir.
  - 2026-10-04: Landing, auth ve bilgi sayfalarında canonical doğrulandı; production domain yayın ortamında ayrıca kontrol edilmelidir.
- [ ] **OpenGraph** — Link WhatsApp, LinkedIn, Discord vb. platformlarda paylaşıldığında doğru başlık, açıklama ve görsel çıkmalıdır.
- [ ] **llms.txt** — AI sistemlerine sitenin önemli public içerikleri hakkında yönlendirme sağlamayı amaçlayan dosya proje kararı doğrultusunda mevcut olmalı veya N/A/opsiyonel olarak işaretlenmelidir.
- [x] **hreflang** — Çok dilli sayfaların dil karşılıklarını bildirir.
  - 2026-10-04: Landing, auth ve bilgi sayfaları TR/EN/DE alternates üretir; sitemap aynı eşlemeyi taşır.
- [ ] **Favicon** — Tarayıcı sekmesi, favoriler ve uygun yüzeylerde sitenin doğru küçük logosu görünmelidir.
- [ ] **JSON-LD / Structured Data** — Uygun sayfalarda `Organization`, `SoftwareApplication`, `FAQPage`, `BreadcrumbList` vb. schema ile sayfanın anlamı makine-okunur biçimde verilmelidir.
- [ ] **Breadcrumb Structured Data** — Breadcrumb kullanılan public sayfalarda uygunsa `BreadcrumbList` schema ile desteklenmelidir.
- [x] **301 / 308 Redirect Yönetimi** — Eski sayfa adreslerini yeni adrese taşır.
  - 2026-10-04: Eski ve dil uyumsuz URL, query korunarak canonical adrese 308 ile yönlenir; bilinmeyen yol 404 kalır.
- [ ] **Broken Link Kontrolü** — Internal public linklerde kırık veya yanlış hedef bulunmamalıdır.

# D — HTTPS Referansı

- [ ] **HTTPS zorunlu + HTTP → HTTPS redirect** — Production ortamında tüm normal trafik HTTPS üzerinden sunulmalı ve HTTP istekleri HTTPS'e yönlenmelidir.

> Ayrıntılı TLS, header, cookie, auth, rate-limit ve diğer güvenlik kontrolleri bu dosyada değil ayrı `SECURITY.md` içinde tutulmalıdır.

# E — Erişilebilirlik

- [ ] **Keyboard Navigation** — Kullanıcı mouse kullanmadan Tab/Shift+Tab/Enter/Escape gibi kontrollerle temel akışları tamamlayabilmelidir.
  - Landing skip link, hikâye bölüm bağlantıları, canlı reduced-motion değişimi ve JS’siz içerik doğrulandı; proje genelindeki tüm temel akışlar denetlenmedi. 2026-10-04: Tema kontrolü dashboard görünümünde tek component olarak landing/auth/public/error/app ekranlarında eşitlendi; iki yönlü ortak geçiş ve reduced-motion altında klavye seçimi doğrulandı.
- [ ] **Screen Reader Uyumluluğu** — Görme engelli kullanıcıların arayüzü semantik HTML ve gerektiğinde uygun erişilebilir isimlerle anlayabilmesini sağlamalıdır.
- [ ] **Alt Text** — Anlam taşıyan görsellerin erişilebilir açıklaması bulunmalıdır.
- [ ] **Heading Hierarchy** — `h1`, `h2`, `h3` yapısı sayfanın mantıksal içerik hiyerarşisini doğru yansıtmalıdır.
- [ ] **Focus State** — Klavye ile gezen kullanıcının hangi etkileşimli element üzerinde olduğunu görmesi sağlanmalıdır.
- [ ] **WCAG Hedefi** — Projenin erişilebilirlik hedefi, tercihen WCAG 2.2 AA, açıkça belirlenmiş olmalıdır.

# F — Özel Hata Sayfaları

- [ ] **403 — Erişim Yok** — Yetkisi olmayan kullanıcı kontrollü ve anlaşılır bir 403 deneyimi görmelidir.
- [ ] **404 — Adres Bulunamadı** — Olmayan route kullanıcıyı düzgün bir 404 sayfasına yönlendirmelidir.
- [ ] **500 — Beklenmeyen Hata** — Beklenmeyen server/application hatalarında teknik detay sızdırmayan kontrollü hata deneyimi bulunmalıdır.
- [ ] **503 — Geçici Olarak Kullanılamıyor** — Bakım veya geçici servis kesintisinde kullanıcı durumun geçici olduğunu anlayabilmelidir.

# G — Production Öncesi QA

- [ ] Mobil görünüm test edildi.
- [ ] Tablet görünüm test edildi.
- [ ] Laptop/desktop görünüm test edildi.
- [ ] Chrome test edildi.
- [ ] Edge test edildi.
- [ ] Firefox test edildi.
- [ ] Safari/iOS davranışı destek matrisine göre test edildi.
- [ ] Keyboard-only temel akış test edildi.
- [ ] Form validation test edildi.
- [ ] Loading / Empty / Error / Success state'leri test edildi.
- [ ] 403 / 404 / 500 / 503 senaryoları doğrulandı.
- [ ] Metadata kontrol edildi.
- [ ] Open Graph paylaşım görünümü test edildi.
- [ ] `sitemap.xml` doğrulandı.
- [ ] `robots.txt` doğrulandı.
- [ ] Canonical URL'ler doğrulandı.
- [ ] JSON-LD / Structured Data doğrulandı.
- [ ] Broken link kontrolü yapıldı.
- [ ] Favicon doğrulandı.
- [ ] HTTPS ve HTTP → HTTPS redirect doğrulandı.
- [ ] Accessibility audit yapıldı.
- [ ] Lighthouse kontrolü yapıldı.
- [ ] Core Web Vitals açısından kritik problemler gözden geçirildi.
- [ ] Ayrı `SECURITY.md` kontrol listesi tamamlandı.

# H — Production Sonrası

- [ ] Production domain üzerinde kritik route'lar smoke test edildi.
- [ ] Production metadata localhost/staging değeri içermiyor.
- [ ] Production canonical URL'leri doğru domain'i kullanıyor.
- [ ] Production `robots.txt` erişilebilir.
- [ ] Production `sitemap.xml` erişilebilir.
- [ ] Sitemap uygun arama motoru webmaster araçlarına gönderildi.
- [ ] Google Search Console kurulumu/doğrulaması yapıldı veya N/A gerekçesi yazıldı.
- [ ] Open Graph gerçek production URL ile test edildi.
- [ ] Structured Data gerçek production URL üzerinde kontrol edildi.
- [ ] Mobil production görünümü kontrol edildi.
- [ ] Footer, KVKK, gizlilik, çerez, kullanım koşulları ve iletişim linkleri production üzerinde çalışıyor.

---

# Final AI Rapor Formatı

Kontrol bittiğinde aşağıdaki format kullanılmalıdır:

```text
WEB STANDARDS FINAL REPORT

Toplam Kontrol:
PASS:
FAIL:
N/A:

PRODUCTION BLOCKERS:
1.
2.
3.

KRİTİK EKSİKLER:
1.
2.
3.

İYİLEŞTİRMELER:
1.
2.
3.

SONUÇ:
READY / NOT READY
```

> `READY` yalnız production blocker kalmadığında verilmelidir.

2026-10-06 navbar kullanıcı düzeltmesi: viewport merkezindeki önceki konum geri alındı, sidebar collapse ile kaymaz. Güncel lint/type/build0 ve hedefli14 Chromium PASS; scope yalnız bu yerleşim. Global kutular değişmedi.


## Task date picker verification - 2026-10-06 (scoped)

Task create/edit calendar, date ordering/persistence, advanced deadline time/clear, leap-day/month keyboard navigation and focus/dismissal passed. TR/EN/DE, light/dark, 320/390/768/1440 px and reduced-motion popup/form overflow and page-error checks passed; screenshots inspected. Initial targeted Chromium gate: 16 passed (4 date-picker + 12 task-model regressions); ESLint/TypeScript passed. Global accessibility/responsive/production checkboxes are not marked complete from this limited evidence. Details: `docs/compliation/2026-10-06-task-date-picker.md`.

Task date picker month/year follow-up (2026-10-06): native select menus replaced with shared themed Select, named listboxes and nested Escape/focus support. Final follow-up gate: 5 targeted Chromium tests passed; TR/EN/DE, both themes, 320/390/768/1440px inner-list viewport/selected-option checks, screenshots after animation, lint/type passed. Prior 12 task-model regressions were not repeated in this follow-up. Trace disabled on final run after Windows EBUSY artifact lock. Global checkboxes remain unchanged; same task-date-picker completion record contains commands and results.
2026-10-06 navbar kullanıcı düzeltmesi: viewport merkezindeki önceki konum geri alındı, sidebar collapse ile kaymaz. Güncel lint/type/build0 ve hedefli14 Chromium PASS; scope yalnız bu yerleşim. Global kutular değişmedi.


## Task planning and assignment verification - 2026-10-06 (scoped)

Shared priority colors/critical alert, self-assignment via Assign me, shared simple/advanced pool assignment and calendar-day quick deadlines verified. Final targeted Chromium gate: 34 passed (7 planning/assignment, 5 date-picker, 12 task-model, 10 task-management). TR/EN/DE, light/dark and 320/390/768/1440px overflow/page-error checks passed; screenshots inspected. ESLint and TypeScript passed. Explicitly authorized backend pool extension: full Maven verify, 465 passed; project/team/permission/CSRF guards and concurrent claims tested. Global accessibility/responsive/production boxes remain unchanged. Details: docs/compliation/2026-10-06-task-planning-assignment.md.


## Task progress notification verification - 2026-10-06 (backend scope)

SIMPLE start/completion shortcuts, ADVANCED review/testing retention, same-project active manager recipients, actor suppression and follower deduplication verified on real PostgreSQL. No-op, rollback, concurrent same-status requests, permission/CSRF and own-notification isolation passed. V55-to-V56 upgrade retains legacy read/unread notifications; old serialized event JSON remains consumable. Final targeted gate: 19 passed; full Maven verify: 480 passed, 0 failure/error/skip, BUILD SUCCESS. Test-runner post-exit shutdown diagnostic is recorded in the completion. No frontend source/UI/browser behavior was changed or visually verified in this backend stage; global checklist boxes remain unchanged. Details: docs/compliation/2026-10-06-gorevlerim-durum-bildirim-backend.md.

## Squad modernization scoped verification - 2026-10-06

Team deletion dialog/errors/cache redirect, real own notification center and at-most-once popup/account boundary, safe batch member avatar/initial/+N and invitation eight-role/server-pagination UI verified. Targeted combined132 backend0 fail/error/skip +56 Chromium PASS, lint/type/build PASS. TR/EN/DE, two themes,320/390/768/1024/1440 screenshots inspected; grid overflow and German badge clipping fixed/retested. Navbar remains viewport centered; chat/history/pool regressions pass. Normal new success flows use real backend/PostgreSQL; network faults/latency and page-boundary seeds are explicit TEST-ONLY. Global checklist boxes remain unchanged; full canonical gate evidence belongs to the separate implementation completion.

## My tasks cards frontend verification - 2026-10-06

Square assigned-task cards, shared same-page detail/comments, URL refresh/page clamp, SIMPLE start/complete and retained ADVANCED review/testing, shared status confirmation including board drag, failed-update retry and non-following manager notifications/read state verified against real API. TR/EN/DE, light/dark, 320/390/768/1440 px, long text, keyboard/Escape/focus, overflow and runtime errors covered; screenshots reviewed. ESLint/TypeScript/Turbopack build passed. Production full run: 266 passed, 2 history test races, 1 expected production crash-route skip; this full run was not green. Hydration/URL waiting and atomic same-frame navbar geometry corrected the test races without relaxing overlap checks. Final affected acceptance run: 24 passed, 0 failure/skip. Full 269-test package was not rerun after those test corrections. No backend, dependency, environment, cookie/CSRF/CORS changes; global checklist boxes remain unchanged. Details: docs/compliation/2026-10-06-gorevlerim-kartlar-frontend.md.

2026-10-06 Squad/main conflict integration: task-notification dialog/read/focus + team once-popup/account isolation, TR/EN/DE responsive surfaces, centered header/native history and contained demo passed in34 targeted Chromium; lint/type/build0. Global boxes unchanged; no new full gate claim. See `docs/compliation/2026-10-06-squad-main-conflict-resolution.md`.

## Frontend foundation scoped verification - 2026-10-07

Own username form/session/cache/Unicode/duplicate/late actor response, authenticated native adjacent history boundary, desktop+actual touch700ms auto-hide/held interactions and scoped blue root/sidebar scrollbar passed combined137 backend0 failure/error/skip +47 Chromium, lint/type/build0. Normal new success uses actual backend/PostgreSQL; delayed real-response/unsupported/fault/style probes explicitly TEST-ONLY. Root/sidebar native thumb viewport screenshots inspected; text/forms/chat/menu surfaces retain native scroll styling. Global checklist boxes unchanged; full gate evidence belongs to separate final implementation completion.

## Notification read/history scoped verification - 2026-10-07

Own server-filtered New/History pages, individual/all read persistent row retention/count, actor late-response isolation, popup/read separation, existing task navigation and20-size requests verified on real backend/PostgreSQL. Targeted backend51 JUnit0 fail/error/skip; current lint/type/build0; combined33 Chromium and corrected visual/touch1 passed.320/390/768/1024/1440,TR/EN/DE,light/dark,motion-off/reduced,44px/read/focus/overflow screenshots inspected. Normal successes real; failure/latency/style/cache probes TEST-ONLY. Global boxes unchanged; final full gate evidence belongs to separate implementation completion.

## Project invitations/create UX scoped verification - 2026-10-08

Own/project-managed count separation, nested Teams disclosure/flyout, keyboard/mobile/three-language bounded badge, local banner decode/error/cleanup/previous-preview preservation, responsive sticky actions and event-time notification context verified in targeted real Chromium/API/PostgreSQL. Navbar position/reserve, account isolation, read/history/popup distinction and existing landing inert isolation retained. Global checklist boxes unchanged; Organization invitations are outside scope / Pending product decision. Canonical gate PASSED exit0; backend548/0/0/0, Chromium328+1 expected skip, lint/type/build/Docker smoke. Separate [implementation completion](../../docs/compliation/2026-10-08-project-invitations-create-ux.md); independent Next production audit follow-up is open, not a release waiver.

## Ortak seçiciler / form doğrulama özeti scoped verification - 2026-10-10

Proje ve organizasyon oluşturma formlarında inline hata + erişilebilir doğrulama özeti (`role="alert"`, odak, bölüm bağlantıları), ortak tarih/saat seçicilerde klavye/Escape/odak dönüşü/aralık kısıtı, organizasyon kartı ölçü eşitliği (320–1440) ve görev yorumu klavye/IME/dokunmatik davranışı gerçek Chromium/API/PostgreSQL ile doğrulandı; TR/EN/DE, light/dark, 320/390/1440 taşma kontrolleri yapıldı. "Form Validation" global maddesi yalnız iki create formu kapsandığı için `[ ]` bırakıldı. Kanonik gate PASSED: backend 649/0/0/0, Chromium 595 + 1 beklenen skip, lint/type/build/Docker. Ayrıntı: `docs/compliation/2026-10-10-general-features-ui-refinements.md`.

## Auth frontend/main conflict integration ? 2026-10-09 (scoped)

Cookie/contact/admin and main About/License/version/focus/JSON-LD/canonical named routes retained together. Footer/legal/cookie preferences, error/static503 contact, TR/EN/DE public content/accessibility, sitemap/hreflang/robots, canonical create/section/history and existing app regressions passed. Final canonical gate:649 backend0 failure/error/skip,555 Chromium +1 expected production crash-route skip, lint/type/build/Docker PASS. Long-suite QA shared sessions renew through actual CSRF/login without app UI; production auth unchanged. Global production/multi-browser/WCAG boxes are not inferred from this scoped Chromium evidence. See `docs/compliation/2026-10-09-auth-frontend-main-conflict-resolution.md`.

## Hesap / oturumsuz sayfa UI ve tema performansı scoped verification - 2026-10-10 (general-features)

Kapsam yalnız aşağıdaki değişikliklerdir; hiçbir global madde `[x]` yapılmadı. Kullanıcı adı sözleşmesi (Unicode harf/rakam, `_`, `-`, tek boşluk, 3-32, baş/son boşluk kırpma, art arda boşluk için ayrı hata; kayıt, davetli kayıt ve profil aynı kural; tek kaynak `com.pda.user.NicknameRules`), tüm oturumsuz sayfalarda ortak document-root scrollbar standardı, alt-orta cookie banner (Login `h-dvh` kilidi banner açıkken kalkar) ve tema geçişi performansı (Login döngü duraklatma + yazılım render tespiti) uygulandı. "Form Validation" global maddesi yalnız kayıt/davetli kayıt/profil kullanıcı adı alanını kapsar. "Core Web Vitals" maddesi `[ ]` kalır: tema geçişi ölçümü yalnız Login/Landing tema geçişi içindir, LCP/CLS/INP üretim ölçümü değildir. Klavye ve ekran okuyucu maddeleri bu işte yeniden denetlenmedi (tema düğmesi odak/route koruması `theme-switch-performance.spec.ts` ile doğrulandı). Test sonuçları: `docs/compliation/2026-10-10-general-features-account-public-ui-theme.md`.

## Ekip üyesi kartı scoped verification - 2026-10-10 (squad-service-backend)

Kapsam yalnız Ekipler kart görünümündeki üye kutusudur (avatar, tam ad, ana rol + "+N"); hiçbir global madde `[x]` yapılmadı. Kullanıcı geri bildirimiyle ad/rol kısaltılmaz (wrap); 320/390/768/1024/1440 x light/dark yatay taşma ve kırpılma yok, tooltip + `aria-label` tüm rolleri verir, üye başına ek istek yok (Responsive/Dark Mode/Accessibility maddeleri yalnız bu yüzey için kanıtlandı). Ayrıntı: `docs/compliation/2026-10-10-squad-service-teams-member-cards.md`.

## Ayrı yönetici girişi `/pd-admin` scoped verification - 2026-10-10 (auth-service-frontend)

Kapsam yalnız `/pd-admin` yüzeyidir; hiçbir global madde `[x]` yapılmadı. Etkilenen maddeler: **robots.txt / sitemap** (`[x]` kalır: `/pd-admin` robots, sitemap ve `llms.txt` içinde yoktur, hiçbir public sayfa ona bağlanmaz, sayfa `noindex` meta + `X-Robots-Tag` taşır; gizlilik güvenlik değildir, yetki backend'dedir), **Unique Page Title** (`[ ]` kalır: yalnız bu sayfanın başlığı "Yönetici girişi · PDA" TR/EN/DE doğrulandı), **Keyboard Navigation / Focus State** (`[ ]` kalır: yalnız bu sayfanın adımları Tab/Enter/Shift+Tab ile tamamlanır, adım başlığına odak taşınır, 44 px hedefler). 320/390/768/1024/1440 px light/dark yatay taşma yok. Sonuçlar: `docs/compliation/2026-10-10-auth-service-frontend-admin-login.md`.

## Yönetim operasyon ekranları scoped verification - 2026-10-11 (auth-service-frontend)

Kapsam yalnız `(app)/admin/**` ekranlarıdır (kullanıcı detayı + oturumlar, sistem, denetim kaydı, destek talepleri, analitik davranış raporları); hiçbir global madde `[x]` yapılmadı. Etkilenen maddeler: **Loading / Empty / Error State** ve **Responsive** (`[ ]` kalır: yalnız bu ekranlarda her bölümün yükleme iskeleti, boş, hata + yeniden dene durumu ve 320/390/768/1024/1440 px açık/koyu yatay taşma yokluğu doğrulandı), **Keyboard Navigation / Focus State** (`[ ]` kalır: yıkıcı eylem diyaloğu klavyeyle açılır/Escape ile kapanır, odak tetikleyiciye döner; sekmeler ve eylemler ≥44 px / ≥36 px), **Unique Page Title** (`[ ]` kalır: yeni 5 sayfa başlığı TR/EN/DE), **Kritik işlem onayı** (`[x]` kalır: oturum kapatma ve talep kapatma `ConfirmDialog` ile). Plan Task 8 maddeleri (kullanıcı detayı, sistem, denetim, destek, analitik raporları) bu görevde uygulandı; "Rol ve izin yönetimi" tek admin politikası gereği yalnız salt okunur gösterim + not olarak karşılandı (düzenleme yok). Sonuçlar: `docs/compliation/2026-10-10-auth-service-frontend-admin-operations.md`.


## Kurumsal e-posta geçişi — 2026-10-12 (sınırlı kapsam)

Footer, iletişim/destek, KVKK/Gizlilik/Çerez metinlerindeki kurumsal adres `info@pd-assistant.com`; TR/EN/DE Gmail gönderim ifadeleri Hostinger Email ile güncellendi. Gönderim yapılandırması şifre beklediği için yerel profillerde kapalıdır; üretim posta/DNS teslimi doğrulanmış sayılmaz. Mevcut kutular proje geneli yeni audit kanıtı olarak değiştirilmedi. Doğrulama ve kullanıcı adımları: `docs/compliation/2026-10-12-hostinger-corporate-mail.md`.


## Sidebar seçili proje logosu — 2026-10-12 (sınırlı kapsam)

İlgili Görsel fallback / Responsive / Dark Mode / Navigasyon kapsamı: gerçek proje logo API'si açık/daraltılmış sidebar ve mobil çekmecede doğrulandı; logosuz proje ve TEST-ONLY 404 baş harfe döner. Mevcut global kutular bu küçük kapsamla değiştirilmedi. Build/TypeScript ve hedefli lint başarılı. Ayrıntı: `docs/compliation/2026-10-12-sidebar-selected-project-logo.md`.


## Ekip breadcrumb kaldırma — 2026-10-12 (sınırlı kapsam)

Yalnız Breadcrumb maddesiyle ilişkili: kullanıcının istediği ekip detay/düzenle/üye davet yollarında breadcrumb kaldırıldı; gerçek QA backend + Chromium ile bu üç sayfada yokluğu, ekip oluşturma sayfasında varlığı doğrulandı. Global Breadcrumb kutusu bu sınırlı kapsam nedeniyle değiştirilmedi. Ayrıntı: `docs/compliation/2026-10-12-team-pages-breadcrumb.md`.

## Proje / organizasyon logo şekli — 2026-10-12 (sınırlı kapsam)

Etkilenen Görsel fallback / Responsive / Dark Mode / Form Validation / Keyboard Navigation / Focus State maddeleri açısından yalnız logo yüzeyleri doğrulandı: ortak native radio seçici, dört formda anlık preview ve API/DB kalıcılığı, Circle 50% kırpma ve Square mevcut radius, kart/başlık/sidebar/ekip/sohbet/davet tutarlılığı. TR/EN/DE, light/dark ve 320/390/768/1440 px overflow/klavye kontrolleri geçti; mobil/masaüstü ekran görüntüleri incelendi. 4 yeni + 25 mevcut Chromium testi, hedefli backend verify 60/0/0/0 ve son lint/type/build exit0. Normal başarılar gerçek API/PostgreSQL/medya; QA hesap hazırlığı ve mevcut regresyon hata/latency senaryoları TEST-ONLY. Global maddeler bu kapsamla [x] yapılmadı; production veya tüm tarayıcı audit'i iddia edilmez. Ayrıntı: docs/compliation/2026-10-12-project-organization-logo-shape.md.

## Sohbet Word/PDF yükleme uyumluluğu — 2026-10-12 (sınırlı kapsam)

Dosya doğrulamasındaki yanlış retler giderildi: PDF normal sayfa hedefleri, Word güvenli hyperlink ilişkileri, bilinen MIME parametre/alias'ları desteklenir; boyut ve etkin içerik engelleri korunur. Frontend görünümü değişmedi. Kullanıcının testleri sonlandırma isteğine uygun olarak yeni otomatik test koşumu yapılmadı; regresyon senaryoları kaynakta eklendi ve derlemede compile edildi. Global Form Validation / Error State kutuları bu sınırlı düzeltmeyle tamamlandı sayılmadı. Kayıt: `docs/compliation/2026-10-12-chat-document-upload-compatibility.md`.

## Sohbet PDF Content Credentials düzeltmesi — 2026-10-12 (sınırlı kapsam)

Repodaki 958377 byte CV'nin ret nedeni 24296 byte C2PA metadata'sı olarak doğrudan teşhis edildi. Yeni doğrulayıcı aynı PDF'yi `application/pdf` olarak kabul eder; gerçek dosya yeniden oluşturulmaz. Genel otomatik test koşumu yapılmadı; yalnız dosya üzerinde validator incelemesi ve backend derlemesi yapıldı. Form Validation / Error State genel kutuları bu sınırlı kanıtla değiştirilmedi. Kayıt: `docs/compliation/2026-10-12-chat-pdf-c2pa.md`.

## Sohbet scrollbar paleti — 2026-10-12 (sınırlı kapsam)

Dark Mode / UI tutarlılığı kapsamı: sohbetin altı kaydırılabilir yüzeyi mevcut `data-workspace-scroll` paletine bağlandı; light/dark label-blue token'ı, transparan track, ortak hover ve forced-colors fallback kullanılır. Hedefli ESLint ve production build başarılı; küçük stil değişikliği için genel audit/test koşumu yapılmadı. Global checklist kutuları bu sınırlı kanıtla değiştirilmedi. Kayıt: `docs/compliation/2026-10-12-chat-scrollbar-theme.md`.

## Profile FAQ / consent session continuity - 2026-10-12 (scoped)

Affected navigation, keyboard/focus, responsive, dark-mode and consent standards: shared FAQ opens within the workspace without route changes; keyboard/Escape/focus return, TR/EN/DE at 320 px, desktop light and mobile dark visuals verified. Real API confirms unchanged authentication cookies during preferences, reload/public/contact return, actual refresh rotation after TEST-ONLY access expiry, and explicit logout. 3 new + 4 existing targeted Chromium tests, lint/type/build PASS. Global boxes remain unchanged. Evidence: docs/compliation/2026-10-12-profile-help-session.md.

## Profile FAQ page - 2026-10-12 (scoped follow-up)

Previous FAQ modal replaced by authenticated /account/faq page. Localized title, noindex/account guard, return navigation after reload, TR/EN/DE 320 px, light/dark and real session/refresh/logout passed in 3 Chromium tests. Lint/type/build PASS. Global boxes unchanged. Latest evidence: docs/compliation/2026-10-12-profile-faq-page.md.

## Legacy FAQ navigation - 2026-10-12 (scoped)

Authenticated legacy FAQ URLs in TR/EN/DE now resolve to workspace layout; anonymous public FAQ and protected-route login guard verified. 3 targeted real-session Chromium tests, lint/build PASS. Global boxes unchanged. Evidence: docs/compliation/2026-10-12-profile-faq-routing.md.

## Workspace contact page - 2026-10-12 (scoped)

Navigation/title/noindex/responsive/dark-mode scope: profile and legacy contact addresses keep signed-in workspace layout, reload/back/cookies verified; anonymous contact and protected login guard preserved. TR/EN/DE at 320 px and desktop/mobile screenshots checked. 3 targeted Chromium tests, lint/type/build PASS. Form/mail delivery unchanged and not retested; global boxes unchanged. Evidence: docs/compliation/2026-10-12-profile-contact-page.md.

## Pre-push öncesi regresyon düzeltmeleri - 2026-10-13 (sınırlı kapsam)

Etkilenen navigasyon/oturum, logo fallback, sohbet read/delete/focus ve API hata durumu kapsamları doğrulandı. Giriş/çıkış Next Router Cache sınırı, aktör kapsamlı chat overview yenilemesi, bounded teslim bildirimi yetki/konuşma/receipt sınırları ve authoritative mesaj durumları korundu. Son hedefli backend 62/0/0/0 ve Chromium sohbet/cache 17/0/0; lint/type/build/strict bundle/diff geçti. Global kutular bu sınırlı kanıtla değiştirilmedi. Kullanıcı son tam pre-push'a geçilmemesini istedi; başlatılan koşu durduruldu, kanonik PASSED/production onayı yok. Kapsam, önceki keşif koşuları, mevcut development bağımlılık borcu ve manuel adımlar: `docs/compliation/2026-10-13-pre-push-oncesi-duzeltmeler.md`.

## Pre-push öncesi regresyon düzeltmeleri - 2026-10-13 (sınırlı kapsam)

Etkilenen navigasyon/oturum, logo fallback, sohbet read/delete/focus ve API hata durumu kapsamları doğrulandı. Giriş/çıkış Next Router Cache sınırı, aktör kapsamlı chat overview yenilemesi, bounded teslim bildirimi yetki/konuşma/receipt sınırları ve authoritative mesaj durumları korundu. Son hedefli backend 62/0/0/0 ve Chromium sohbet/cache 17/0/0; lint/type/build/strict bundle/diff geçti. Global kutular bu sınırlı kanıtla değiştirilmedi. Kullanıcı son tam pre-push'a geçilmemesini istedi; başlatılan koşu durduruldu, kanonik PASSED/production onayı yok. Kapsam, önceki keşif koşuları, mevcut development bağımlılık borcu ve manuel adımlar: `docs/compliation/2026-10-13-pre-push-oncesi-duzeltmeler.md`.
## Sohbet içi mesaj arama — 2026-10-14 (sınırlı kapsam)

Loading/Empty/Error/Responsive/Keyboard Navigation/Focus State/Dark Mode kapsamı yalnız yeni sohbet arama paneli ve eski mesaj çevresidir: TR/EN/DE, light/dark, 320/390/768/1440, 320×420 kısa viewport, reduced-motion, focus/Escape/Enter, bağımsız scrollbar ve gerçek API/DB/socket akışları doğrulandı; ekran görüntüleri incelendi. VisualViewport keyboard yüksekliği uygulanmıştır; gerçek mobil keyboard/screen reader veya bütün tarayıcılar doğrulanmış sayılmaz. Global kutular bu sınırlı kanıtla değiştirilmedi. Son production Chromium 18 PASS, backend 66/0/0/0, lint/type/build/diff-check başarılı; tam pre-push gate koşulmadı. API/güvenlik/migration ve kullanıcı kontrolleri: `docs/compliation/2026-10-14-chat-message-search.md`.
## Ana sidebar genişliği / sohbet tepki ve dosya girişleri — 2026-10-14 (sınırlı kapsam)

Görünür tutamaç follow-up: ana sidebar ve sohbet grip'leri viewport'un dikey merkezinde eşitlendi; merkez farkı <1 px, mouse/keyboard/kalıcılık/rail ve screenshot hedefli 1 Chromium testinde doğrulandı. Hedefli lint/type/diff PASS. Global kutular değişmedi. Kayıt: `docs/compliation/2026-10-14-sidebar-resize-grip-alignment.md`.

Yalnız etkilenen Responsive/Keyboard Navigation/Focus State/Loading/Empty/Error/Dark Mode/Form Validation/Görsel fallback/Navigasyon ve Çerez Politikası yüzeyleri gözden geçirildi. Ana sidebar pointer/klavye genişliği, hesap bazlı kalıcılık, rail ve sohbet hizası; gerçek kullanıcılarla sayfalı reaction detayları, own kaldırma, Escape/odak; ortak chooser/drop/paste kuyruğu, overlay kapsamı, metin yapıştırma, duplicate seçimi, kısmi retry ve konuşma sınırı doğrulandı. TR/EN/DE, 320/768/1440, light/dark tepki paneli ve masaüstü sidebar/drop/preview ekran görüntüleri incelendi. 67 backend testinde hata/skip yok; 31 benzersiz frontend kontrolü (18 gerçek Chromium E2E + 13 saf cache/contract kontrolü) hedefli koşularda geçti. File clipboard olayları tarayıcı native API'leriyle sentetiktir; normal metin Ctrl+V gerçek browser clipboard ile kontrol edildi. İşletim sistemi dosya yöneticisi ve gerçek telefon keyboard/screen reader/tüm tarayıcılar doğrulanmış sayılmaz. Global kutular bu sınırlı kanıtla değiştirilmedi; full pre-push/production gate çalıştırılmadı. API/komutlar/sınırlamalar/manual: `docs/compliation/2026-10-14-sidebar-chat-enhancements.md`.

## Sidebar proje dropdown — 2026-10-14 (sınırlı kapsam)

Etkilenen Loading/Empty/Error/Responsive/Keyboard Navigation/Focus State/Dark Mode/Görsel fallback/Navigasyon yüzeyi yalnız yeni sidebar seçicisidir. TR/EN/DE, light/dark, 320/390/768/1440, klavye/Enter/Escape/odak, mobil drawer kapanışı, collapsed rail, gerçek API/PostgreSQL/üyelik kaybı/kalıcılık ve 102 QA projesiyle sonraki sayfalarda arama doğrulandı; ekran görüntüleri incelendi. Son hedefli Chromium 12 PASS + 3 demo izolasyonu PASS, lint/type/build/diff-check başarılıdır. Backend/API/yetki politikası değişmedi. Global kutular bu sınırlı kanıtla değiştirilmedi; tam pre-push ve gerçek mobil/diğer tarayıcı kanıtı değildir. Ayrıntı ve manuel kontroller: `docs/compliation/2026-10-14-sidebar-project-dropdown.md`.

## Toplantı odasına belge geçişi — 2026-10-19 (sınırlı kapsam)

Yalnız oda giriş navigasyonu ve route kapsamlı medya izinleri etkilendi. Katıl bağlantısı yerelleştirilmiş normal bağlantı olarak yeni belge yükler; CSP/Permissions-Policy genişletilmedi. Gerçek yerel API/PostgreSQL/LiveKit üzerinde belge, kamera/mikrofon izinleri ve iki katılımcılı medya/sohbet/moderasyon/reconnect kontrolleri 2 Chromium testinde PASS; hedefli lint, TypeScript/production Docker derlemesi ve diff kontrolü PASS. Global kutular değiştirilmedi. Production dağıtımı onay bekliyor; fiziksel cihaz kabulü ve diğer tarayıcılar tamamlanmış sayılmaz. Ayrıntı: `.agents/meeting-launch-remaining.md`.

## General Features: seçili proje kalıcılığı ve canlı veri — 2026-10-21 (sınırlı kapsam)

Etkilenen Loading/Empty/Error/Navigasyon yüzeyi yalnız seçili proje çözümü ve çalışma alanı veri listeleridir (Projeler, Görevler, Pano, Havuz, Görevlerim, Dashboard, Proje genel bakış, Kriterler, Ekipler, Sprintler, Etiketler, Organizasyonlar). Seçili proje artık hesap kapsamlı `localStorage` slug'ıdır (URL önceliği, erişim kaybında temizleme + ilk projeye düşme, eski sessionStorage göçü); token/cookie/JWT/hassas veri web storage'a yazılmaz. Çalışma alanı sorguları merkezi olarak görünür sekmede ~15 sn'de bir ve sekmeye dönüşte yenilenir; hata geri çekilmeli, toast'sız; arka plan yenileme hatası son iyi veriyi korur; form kaynakları yenilemeden muaftır. Yeni WebSocket/SSE/Redis/bağımlılık, backend, API, yetki, cookie, CSRF, CORS ve ENV değişmedi. Chromium'da yeni spec 10/10 PASS; etkilenen 21 mevcut spec + yeni spec iki koşuda 134 ve 144 PASS (her koşuda 1 hata: biri aralıklı `06-calendar-page`, nedeni kanıtlanmadı; diğeri test verisi birikimi, test düzeltildi ve 10/10), lint/tsc/build/bundle bütçesi/diff-check temiz. Global kutular bu sınırlı kanıtla değiştirilmedi; tam pre-push ve tam E2E paketi koşulmadı, diğer tarayıcılar/gerçek cihaz doğrulanmadı. Ayrıntı ve manuel kontroller: `docs/compliation/2026-10-21-general-features-fixes.md`.
