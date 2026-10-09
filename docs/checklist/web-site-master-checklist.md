# Web Sitesi Master Checklist Raporu

> Tarih: 2026-10-08 · Dal: `task-service-frontend` · Kaynak liste: `.agents/web-rules/WEB_SITE_MASTER_CHECKLIST_TR.md`
> Bu rapor **sadece inceleme** sonucudur. Koda, ayara ve checklist kutularına dokunulmadı.

## Nasıl okunur?

| İşaret | Anlamı |
| --- | --- |
| ✅ Geçti | Var ve çalıştığı görüldü |
| ⚠️ Var ama eksik | Var, ama listenin istediği düzeyde değil |
| ❌ Yok | Hiç yapılmamış |
| ➖ N/A | Bu proje için gerekmiyor (gerekçesi yazıldı) |
| 🔍 Doğrulanamadı | Canlı (production) ortam olmadan ölçülemez |

**Nereden baktım?**
- Kod ve ayar dosyaları (frontend `src/`, `next.config.ts`, `Dockerfile`).
- Çalışan site: frontend `npm run build` + `npm run start` ile production modunda `localhost:3000`'de açıldı.
- 15 public adres (3 dil) tarayıcı içinden çekilip başlık, açıklama, canonical, hreflang, og:image, h1 sayısı ölçüldü.
- Public sayfalardan toplanan **78 benzersiz iç link** tek tek istendi.
- `npx playwright test -c playwright.public.config.ts` bu denetimde çalıştırıldı: **56 geçti, 1 atlandı, 0 hata**.
- Tam `pre-push` kapısı **çalıştırılmadı** (konteynerleri yeniden kurar, çok uzun). Geçmiş sonuç sadece bilgi: checklist dosyasındaki 2026-10-08 notu "548 backend testi, 328 Chromium geçti" diyor. Bu bugünkü ölçüm değildir.
- Production ortamı yok. `.agents/deployment.md` içindeki kararların hepsi TBD. Bu yüzden D ve H bölümleri ölçülemedi.

## Özet

| Toplam madde | ✅ Geçti | ⚠️ Var ama eksik | ❌ Yok | ➖ N/A | 🔍 Doğrulanamadı |
| --- | --- | --- | --- | --- | --- |
| **79** | **18** | **32** | **13** | **2** | **14** |

> Checklist başlığı "~80 madde" diyor; tek tek sayınca **79** çıkıyor (A 10, B 9, C 14, D 1, E 6, F 4, G 24, H 11).

**Production'ı durduran (blocker) maddeler**

| # | Blocker | Neden |
| --- | --- | --- |
| 1 | Kullanım Koşulları sayfası yok | `/en/terms` 404 dönüyor |
| 2 | KVKK ve Gizlilik sayfaları taslak | Sayfada "hukuki incelemeden geçmedi" uyarısı var, `noindex` ve sabit tarih (2026-10-02) taşıyor |
| 3 | Site adresi ayarı yok (`NEXT_PUBLIC_SITE_URL`) | Tanımsızsa sitemap, robots, canonical ve OG adresi `http://localhost:3000` olur. Ayrıca `frontend/Dockerfile` bu değişkeni build'e hiç geçirmiyor, yani Docker imajı her zaman localhost yazar |
| 4 | HTTPS / HSTS kararı yok | `deployment.md` TBD; `next.config.ts` içinde HSTS yok |
| 5 | İletişim kanalı yalnızca bir e-posta bağlantısı | Ayrı iletişim sayfası yok; adres kişisel bir Gmail (`site-info.ts`). Çalıştığı doğrulanamadı |

---

## A — Genel / Kurumsal (10 madde)

| # | Madde | Durum | Kanıt | Eksik olan | Yapılması gereken | Öncelik |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Footer | ✅ | `components/layout/site-footer.tsx`, `features/landing/landing-footer.tsx`. 78 linkin hiçbiri kırık değil | Çalışma ekranlarında footer yok (bilinçli karar, hesap menüsünde "Bilgi ve destek" var) | Yok | — |
| 2 | KVKK | ⚠️ | `/en/kvkk` 200, `robots: noindex, follow`; `features/public-info/info-page.tsx` gözden geçirme uyarısı gösteriyor | Hukuki inceleme yok, `noindex`, tarih kodda sabit (`new Date("2026-10-02…")`) | Hukuk onayı al, `noindex`'i kaldır, tarihi içerikten gelen bir değere bağla | Yüksek (blocker) |
| 3 | Gizlilik Politikası | ⚠️ | `/en/privacy` 200, `noindex`; çerez ve veri anlatımı `tr.json` ~2519-2541. satırlarda | KVKK ile aynı: taslak, `noindex`, hukuki onay yok | KVKK ile birlikte tamamla | Yüksek (blocker) |
| 4 | Erişilebilirlik | ⚠️ | `/en/accessibility` 200, sitemap'te var | Sayfanın kendisi "bağımsız WCAG değerlendirmesi yapılmadı" diyor (`tr.json` ~2631) | Önce ölçüm yap (bkz. madde 40), sonra sayfayı güncelle | Orta |
| 5 | Sıkça Sorulan Sorular | ✅ | `/en/faq`, `/tr/sss` 200; 3 dilde, title ve canonical var | — | — | — |
| 6 | Çerez Onayı | ➖ | Sitede yalnızca zorunlu çerezler var: oturum (`PDA_ACCESS`, `PDA_REFRESH`, `PDA_SESSION`), `XSRF-TOKEN`, dil çerezi `NEXT_LOCALE`. Reklam/analitik yok (gizlilik metni de bunu söylüyor) | Onay banner'ı yok | Analitik veya reklam aracı eklenirse banner gerekir. Hukuki görüşle N/A kararını yazıya dök | Düşük |
| 7 | Çerez Politikası | ⚠️ | Çerez türleri gizlilik sayfasının içinde sayılıyor | Ayrı sayfa yok (`/en/cookies` → 404); checklist "banner'dan ayrı" istiyor | Kısa bir `/cookies` sayfası ekle (3 dil) ya da gizlilik sayfasındaki bölüme sabit bağlantı ver ve karar notu yaz | Orta |
| 8 | Hakkımızda Sayfası | ❌ | `/en/about` → 404; `i18n/routing.ts` içinde route yok | Sayfa yok. Landing ürünü anlatıyor ama "kim yapıyor" için ayrı yer yok | `/about` ekle ya da landing bölümüne bağla ve N/A gerekçesi yaz | Orta |
| 9 | Kullanım Koşulları | ❌ | `/en/terms` → 404 | Sayfa yok | Hazırla, 3 dilde yayınla, footer'a ekle | Yüksek (blocker) |
| 10 | İletişim / Destek Kanalı | ⚠️ | Footer ve bilgi sayfalarında `mailto:` (`features/public-info/site-info.ts`). `/en/contact` → 404 | Ayrı sayfa yok; gelen kutusunun çalıştığı doğrulanamadı; adres kişisel Gmail | Proje için ayrı bir adres (ör. alan adından), basit iletişim sayfası, KVKK talebi için yanıt süresi yaz | Yüksek (blocker) |

## B — CTA / UX / UI State (9 madde)

| # | Madde | Durum | Kanıt | Eksik olan | Yapılması gereken | Öncelik |
| --- | --- | --- | --- | --- | --- | --- |
| 11 | Net BİR CTA | ✅ | Landing ana buton "Serüvene katıl" → `/register`; "Giriş yap" ikincil (`landing-page.spec.ts` geçti) | — | — | — |
| 12 | Responsive Design | ⚠️ | Landing/auth/bilgi sayfaları 320–1920 px test edilmiş (checklist notları + public paket geçti) | Oturum içi tüm ekranlar için toplu kanıt yok. Bu denetimde de elle gezilmedi | Giriş yapılmış ana ekranlar için 390/768/1440 px ekran görüntülü tur | Orta |
| 13 | Mobil Görünüm Responsive Testleri | ⚠️ | `playwright.config.ts` yalnız "Desktop Chrome" profili; mobil testler pencere boyutu küçülterek yapılıyor | Gerçek mobil emülasyon (dokunmatik, iPhone/Pixel profili) ve gerçek cihaz yok | `devices["Pixel 7"]` / `devices["iPhone 14"]` projeleri ekle | Orta |
| 14 | Loading State | ⚠️ | Yalnız `app/(app)/projects/loading.tsx` var. 42 dosya iskelet/`animate-pulse` kullanıyor | Diğer route'larda (görevler, takvim, ayarlar vb.) route düzeyinde `loading.tsx` yok | Ana route'lara `loading.tsx` ekle ya da hepsinin iskelet kullandığını tek tek doğrula | Düşük |
| 15 | Empty State | ✅ | 47 feature dosyasında boş durum bileşeni/metni (kod taraması) | Her ekran tek tek gezilmedi | Ekran turunda doğrula | Düşük |
| 16 | Error State | ✅ | `app/(app)/error.tsx`, `app/error.tsx`, `global-error.tsx`; 53 dosyada `role="alert"`/`aria-live` | — | — | — |
| 17 | Success State | 🔍 | Kodda başarı bildirimleri var ama ekranlar tek tek gezilmedi | Kanıt yok | Ekran turunda doğrula | Düşük |
| 18 | Form Validation | ✅ | 10 dosyada zod şeması, 25 dosyada `aria-invalid`; backend `@Valid` ile doğrular | — | — | — |
| 19 | Breadcrumb | ⚠️ | Yalnız `team-detail-page.tsx` ve `task-header.tsx` içinde | Proje, sprint, etiket, ayarlar gibi derin sayfalarda yok | Derin sayfalara ortak breadcrumb bileşeni | Düşük |

## C — SEO / GEO (14 madde)

Canlı ölçüm tablosu (15 public adres):

| Adres grubu | Sayfa | Title benzersiz | Description | Canonical | hreflang | h1 sayısı | Robots |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Landing | `/tr`, `/en`, `/de` | ✅ 3 farklı | ✅ dile uygun | ✅ | 3 | **5** | index |
| Giriş | `/tr/giris`, `/en/login`, `/de/anmelden` | ✅ | ⚠️ **hep Türkçe** | ✅ | 3 | 1 | index |
| Kayıt | `/en/register` | ✅ | ⚠️ **Türkçe** | ✅ | 3 | 1 | index |
| Şifre unuttum | `/en/forgot-password` | ⚠️ **genel başlık** ("PDA · Project Delivery Assistant") | ⚠️ **Türkçe** | ❌ yok | ❌ 0 | 1 | index |
| SSS | `/en/faq`, `/tr/sss` | ✅ | ✅ | ✅ | 3 | 1 | index |
| Erişilebilirlik | `/en/accessibility`, `/tr/erisilebilirlik`, `/de/barrierefreiheit` | ✅ | ✅ | ✅ | 3 | 1 | index |
| KVKK, Gizlilik | `/en/kvkk`, `/en/privacy` | ✅ | ✅ | ✅ | 3 | 1 | noindex (bilinçli) |

| # | Madde | Durum | Kanıt | Eksik olan | Yapılması gereken | Öncelik |
| --- | --- | --- | --- | --- | --- | --- |
| 20 | SEO / GEO | ⚠️ | Public sayfalar anlamlı HTML, `lang` doğru, sitemap + robots var | JSON-LD yok, `llms.txt` yok, site adresi ayarı yok | Aşağıdaki C maddelerini kapat | Orta |
| 21 | Meta Data | ⚠️ | Tabloya bak | Giriş/kayıt/şifre sayfaları EN ve DE'de **Türkçe açıklama** gösteriyor. Sebep: bu sayfaların `generateMetadata` fonksiyonu yalnız `title` + `alternates` döndürüyor, `description` yok; köke tanımlı Türkçe varsayılan devreye giriyor (`app/layout.tsx`) | Her sayfaya dile uygun `description` ekle | Orta |
| 22 | Unique Page Title | ⚠️ | 15 adresin 14'ü benzersiz | `/en/forgot-password` başlığı kök varsayılanıyla aynı | Bu sayfaya `generateMetadata` ekle | Orta |
| 23 | sitemap.xml | ⚠️ | 15 URL = 5 rota × 3 dil (`/`, `/login`, `/register`, `/faq`, `/accessibility`), hreflang eşleriyle. Kod: `app/sitemap.ts` | `lastModified` yok. Site adresi tanımsızsa tüm URL'ler `http://localhost:3000`. KVKK/gizlilik bilinçli olarak dışarıda | `NEXT_PUBLIC_SITE_URL` tanımla (ve Dockerfile'a ARG olarak ekle). `lastModified` ekle. Yeni sayfalar (terms, about, contact) gelince listeye ekle | Yüksek |
| 24 | robots.txt | ⚠️ | `/` açık; `/api/`, `/_next/` ve yerelleştirilmiş çalışma alanı yolları kapalı | Sitemap satırı da aynı localhost yedeğini kullanıyor | Madde 23 ile aynı kök neden | Yüksek |
| 25 | Canonical URL'ler | ⚠️ | 14/15 adreste doğru | `/en/forgot-password` canonical yok; adres localhost yedeği | Şifre sayfasına ekle; site adresi ayarı | Orta |
| 26 | OpenGraph | ⚠️ | og:image her sayfada aynı: `/images/branding/pda-full.png` | Görsel **1254×1254 kare** ve **1.45 MB**. Paylaşım önizlemeleri 1200×630 ve genelde <300 KB ister. `public/images/og/` klasörü boş (`.gitkeep`). Sayfaya özel görsel yok | 1200×630 sıkıştırılmış OG görseli üret, `public/images/og/` altına koy | Orta |
| 27 | llms.txt | ❌ | `/llms.txt` → 404 | Dosya yok, "gerek yok" kararı da yazılmamış | Karar ver: ekle ya da "opsiyonel, yapılmayacak" notu düş | Düşük |
| 28 | hreflang | ✅ | 14 adreste 3 alternatif; sitemap aynı eşlemeyi taşıyor; `localized-routing.spec.ts` geçti | `/en/forgot-password` 0 alternatif (sitemap'te de yok) | Şifre sayfası için gerekirse ekle | Düşük |
| 29 | Favicon | ⚠️ | `/icon.png` 200 (layout `icons`) | `/favicon.ico` → 404. Birçok tarayıcı/bot önce bunu ister, konsolda 404 hatası düşer | `app/favicon.ico` ekle | Düşük |
| 30 | JSON-LD / Structured Data | ❌ | Hiçbir public sayfada `application/ld+json` yok (15/15) | `Organization`, `SoftwareApplication`, SSS için `FAQPage` | Landing'e Organization+SoftwareApplication, SSS'ye FAQPage ekle | Orta |
| 31 | Breadcrumb Structured Data | ➖ | Public sayfalarda breadcrumb yok | — | Public sayfalara breadcrumb eklenirse `BreadcrumbList` da eklenmeli | Düşük |
| 32 | 301 / 308 Redirect Yönetimi | ✅ | `proxy.ts` canonical 308; `localized-routing.spec.ts` (6 test) geçti; bilinmeyen yol 404 | — | — | — |
| 33 | Broken Link Kontrolü | ✅ | 11 public sayfadan 78 benzersiz iç link istendi, 400 ve üstü **0** (korumalı sayfalar giriş sayfasına 307 yönlendiriyor) | Dış linkler kontrol edilmedi | Dış linkleri (GitHub vb.) ayrıca tara | Düşük |

## D — HTTPS Referansı (1 madde)

| # | Madde | Durum | Kanıt | Eksik olan | Yapılması gereken | Öncelik |
| --- | --- | --- | --- | --- | --- | --- |
| 34 | HTTPS zorunlu + HTTP → HTTPS redirect | 🔍 | Production yok; `.agents/deployment.md` TBD; `next.config.ts` içinde HSTS yok | Yönlendirmeyi kim yapacak (reverse proxy) belli değil | Dağıtım kararını yaz; proxy'de 80→443 ve HSTS aç | Yüksek (blocker) |

## E — Erişilebilirlik (6 madde)

| # | Madde | Durum | Kanıt | Eksik olan | Yapılması gereken | Öncelik |
| --- | --- | --- | --- | --- | --- | --- |
| 35 | Keyboard Navigation | ⚠️ | `/en/faq`'de ilk Tab "Skip to content" bağlantısına gidiyor (`#public-main`) | Oturum içi temel akışların toplu klavye turu yok | Giriş → proje → görev oluştur akışını yalnız klavyeyle dene | Orta |
| 36 | Screen Reader Uyumluluğu | ⚠️ | `<main>` var, `lang` doğru, 53 dosyada `aria-live`/`role=alert` | NVDA/VoiceOver ile gerçek deneme yok | En az bir ekran okuyucuyla ana akışları dene | Orta |
| 37 | Alt Text | ⚠️ | `/en/faq` içinde `alt`'sız `<img>` yok (0) | Yalnız bir sayfa ölçüldü | Tüm public sayfalarda ve oturum içi ekranlarda tara | Düşük |
| 38 | Heading Hierarchy | ⚠️ | Landing'de **5 adet `h1`** (TR/EN/DE hepsinde). Diğer sayfalarda 1 | Landing içine gömülü demo ekranları kendi `h1`'lerini üretiyor | Demo bölümünde `h1` yerine `h2`/`div` kullan, sayfada tek `h1` bırak | Orta |
| 39 | Focus State | ✅ | Skip link odakta `outline: auto 1px`; `globals.css` içinde `:focus-visible` kuralları | Bütün özel bileşenler tek tek ölçülmedi | Ekran turunda doğrula | Düşük |
| 40 | WCAG Hedefi | ❌ | Erişilebilirlik sayfası "değerlendirme yapılmadı" diyor; hiçbir yerde "WCAG 2.2 AA hedefliyoruz" cümlesi yok | Hedef belirlenmemiş | Hedefi yaz (öneri: WCAG 2.2 AA), sayfaya ve README'ye ekle | Orta |

## F — Özel Hata Sayfaları (4 madde)

| # | Madde | Durum | Kanıt | Eksik olan | Yapılması gereken | Öncelik |
| --- | --- | --- | --- | --- | --- | --- |
| 41 | 403 — Erişim Yok | ⚠️ | `app/errors/[code]/page.tsx` önizleme rotası var (`error-pages.spec.ts` geçti) | Gerçek 403 durumunda bu ekranın gösterildiği bu denetimde elle doğrulanmadı | Yetkisiz proje erişimini elle dene | Düşük |
| 42 | 404 — Adres Bulunamadı | ✅ | `/en/nonexistent` HTTP 404; `app/not-found.tsx` | — | — | — |
| 43 | 500 — Beklenmeyen Hata | ✅ | `app/error.tsx`, `app/(app)/error.tsx`, `app/global-error.tsx`; teknik ayrıntı göstermiyor | Production'da kontrollü çökme testi atlanıyor (beklenen skip) | — | — |
| 44 | 503 — Geçici Olarak Kullanılamıyor | ⚠️ | `public/errors/503.html` var (200 dönüyor) | Bakım sırasında bu dosyayı kimin sunacağı (proxy/CDN) tanımlı değil | Dağıtım ayarında bakım modunu bu dosyaya bağla | Orta |

## G — Production Öncesi QA (24 madde)

| # | Madde | Durum | Kanıt | Eksik olan | Yapılması gereken | Öncelik |
| --- | --- | --- | --- | --- | --- | --- |
| 45 | Mobil görünüm test edildi | ⚠️ | Landing ve auth için pencere küçültmeli testler | Madde 13 ile aynı | Mobil profil ekle | Orta |
| 46 | Tablet görünüm test edildi | ⚠️ | 768 px testleri var | Oturum içi ekranlar tam değil | Ekran turu | Düşük |
| 47 | Laptop/desktop görünüm test edildi | ✅ | 1280/1440/1920 px testleri | — | — | — |
| 48 | Chrome test edildi | ✅ | Playwright "Desktop Chrome" (Chromium). Bu denetimde 56 geçti | Marka Chrome değil, Chromium | — | — |
| 49 | Edge test edildi | ❌ | `playwright.config.ts` içinde yok | Edge hiç denenmemiş (motoru Chromium, risk düşük) | `channel: "msedge"` ile bir proje ekle | Düşük |
| 50 | Firefox test edildi | ❌ | Config'te yalnız `chromium` | Hiç test yok | Firefox projesi ekle | Orta |
| 51 | Safari/iOS davranışı test edildi | ❌ | Config'te `webkit` yok; destek matrisi yazılı değil | Hiç test yok | Destek matrisi yaz, `webkit` projesi ekle | Orta |
| 52 | Keyboard-only temel akış test edildi | ⚠️ | Madde 35 | Madde 35 | Madde 35 | Orta |
| 53 | Form validation test edildi | ✅ | Madde 18; e2e testleri | — | — | — |
| 54 | Loading / Empty / Error / Success state'leri test edildi | ⚠️ | Madde 14-17 | Success kanıtı yok, loading kısmi | Ekran turu | Düşük |
| 55 | 403 / 404 / 500 / 503 senaryoları doğrulandı | ⚠️ | `error-pages.spec.ts` geçti; 404 canlı doğrulandı | 403 ve 503 gerçek akışta doğrulanmadı | Madde 41 ve 44 | Düşük |
| 56 | Metadata kontrol edildi | ⚠️ | Bu denetimde ölçüldü | Eksikler bulundu (madde 21-22) | Düzeltip yeniden ölç | Orta |
| 57 | Open Graph paylaşım görünümü test edildi | ❌ | WhatsApp/LinkedIn/Discord denemesi yok | Önizleme hiç görülmemiş | Madde 26 sonrası paylaşım önizleme araçlarıyla dene | Orta |
| 58 | `sitemap.xml` doğrulandı | ✅ | Canlıda 15 URL, hreflang'lı; `localized-routing.spec.ts` geçti | Production adresiyle doğrulanmadı | H bölümüne bak | — |
| 59 | `robots.txt` doğrulandı | ✅ | Canlı çıktı doğru | Production adresiyle doğrulanmadı | H bölümüne bak | — |
| 60 | Canonical URL'ler doğrulandı | ⚠️ | 14/15 | Şifre sayfası eksik | Madde 25 | Orta |
| 61 | JSON-LD / Structured Data doğrulandı | ❌ | JSON-LD yok | Madde 30 | Madde 30 | Orta |
| 62 | Broken link kontrolü yapıldı | ✅ | Madde 33 | — | — | — |
| 63 | Favicon doğrulandı | ⚠️ | Madde 29 | `/favicon.ico` 404 | Madde 29 | Düşük |
| 64 | HTTPS ve HTTP → HTTPS redirect doğrulandı | 🔍 | Madde 34 | Production yok | Madde 34 | Yüksek |
| 65 | Accessibility audit yapıldı | ❌ | axe/Lighthouse/elle denetim kaydı yok; erişilebilirlik sayfası da bunu itiraf ediyor | Hiç yapılmamış | axe-core ile Playwright'ta otomatik tarama ekle | Orta |
| 66 | Lighthouse kontrolü yapıldı | ❌ | Kayıt yok (bu denetimde de çalıştırılmadı) | Hiç yapılmamış | Landing + giriş için Lighthouse raporu al | Orta |
| 67 | Core Web Vitals açısından kritik problemler gözden geçirildi | ❌ | Kayıt yok. Şüphe: 1.45 MB OG görseli (paylaşım için, sayfa yüklemesini etkilemez); landing'de çok sayıda gömülü demo ekranı | Ölçüm yok | Lighthouse/PageSpeed ile LCP, CLS, INP ölç | Orta |
| 68 | Ayrı `SECURITY.md` kontrol listesi tamamlandı | ⚠️ | Bkz. `security-checklist.md` | Orada ❌/⚠️ maddeler var | O raporu kapat | Yüksek |

## H — Production Sonrası (11 madde)

Production ortamı olmadığı için bu bölümün tamamı ölçülemez. Aşağıda her madde için "bugün hazır mı" notu var.

| # | Madde | Durum | Bugünkü hazırlık notu | Yapılması gereken |
| --- | --- | --- | --- | --- |
| 69 | Production domain'de kritik route'lar smoke test edildi | 🔍 | Public Playwright paketi var, adresi parametrik mi belli değil | Paketi canlı adrese yönlendirebilir hale getir |
| 70 | Production metadata localhost/staging değeri içermiyor | 🔍 | **Risk yüksek**: değişken tanımsızsa localhost çıkar; Dockerfile değişkeni geçirmiyor | Madde 23'ü kapat, sonra canlıda ölç |
| 71 | Production canonical URL'leri doğru domain'i kullanıyor | 🔍 | Aynı risk | Aynı |
| 72 | Production `robots.txt` erişilebilir | 🔍 | Dosya hazır | Canlıda aç ve bak |
| 73 | Production `sitemap.xml` erişilebilir | 🔍 | Dosya hazır | Canlıda aç ve bak |
| 74 | Sitemap webmaster araçlarına gönderildi | 🔍 | Yapılmamış olması doğal (site yok) | Yayın sonrası |
| 75 | Google Search Console kurulumu/doğrulaması | 🔍 | Yapılmamış | Yayın sonrası ya da N/A gerekçesi yaz |
| 76 | Open Graph gerçek production URL ile test edildi | 🔍 | Önce görsel düzeltilmeli (madde 26) | Yayın sonrası |
| 77 | Structured Data production'da kontrol edildi | 🔍 | Önce JSON-LD eklenmeli | Yayın sonrası |
| 78 | Mobil production görünümü kontrol edildi | 🔍 | — | Yayın sonrası |
| 79 | Footer, KVKK, gizlilik, çerez, kullanım koşulları ve iletişim linkleri production'da çalışıyor | 🔍 | Kullanım koşulları ve çerez sayfası şu an yok | Önce sayfaları yap |

---

## Kutu durumu ↔ bulgu farkı

Checklist dosyasındaki kutulara **dokunulmadı**. Aşağıdaki tablo, kutu ile bu denetimin bulgusu arasındaki farkı gösterir. Kutuları sen adım adım işaretleyeceksin.

| Madde | Kutu şimdi | Bu denetimde bulgu | Fark ne? |
| --- | --- | --- | --- |
| Footer (1) | `[x]` | ✅ | Uyumlu |
| Net BİR CTA (11) | `[x]` | ✅ | Uyumlu |
| sitemap.xml (23) | `[x]` | ⚠️ | İçerik doğru; ama site adresi tanımsız kalırsa localhost yazar, `lastModified` yok |
| robots.txt (24) | `[x]` | ⚠️ | Aynı localhost yedeği sorunu |
| Canonical (25) | `[x]` | ⚠️ | `/forgot-password` sayfasında canonical yok |
| hreflang (28) | `[x]` | ✅ | Uyumlu (şifre sayfası hariç) |
| 301/308 (32) | `[x]` | ✅ | Uyumlu |
| SSS (5) | `[ ]` | ✅ | **Aslında hazır**, kutu işaretlenebilir |
| Empty State (15) | `[ ]` | ✅ | Kodda var, ekran turuyla teyit et |
| Error State (16) | `[ ]` | ✅ | Hazır görünüyor |
| Form Validation (18) | `[ ]` | ✅ | Hazır |
| Broken Link (33) | `[ ]` | ✅ | Bu denetimde 0 kırık link |
| Focus State (39) | `[ ]` | ✅ | Hazır |
| 404 (42) | `[ ]` | ✅ | Hazır |
| 500 (43) | `[ ]` | ✅ | Hazır |
| G: Laptop, Chrome, Form validation, sitemap, robots, broken link (47, 48, 53, 58, 59, 62) | `[ ]` | ✅ | Kanıt var, işaretlenebilir |
| Diğer tüm `[ ]` maddeler | `[ ]` | ⚠️ / ❌ / 🔍 | Kutu doğru: henüz tamam değil |

---

## WEB STANDARDS FINAL REPORT

```text
WEB STANDARDS FINAL REPORT

Toplam Kontrol: 79
PASS: 18
FAIL: 45   (⚠️ 32 + ❌ 13)
N/A: 2
Doğrulanamadı (production gerekir): 14

PRODUCTION BLOCKERS:
1. Kullanım Koşulları sayfası yok (/terms → 404).
2. KVKK ve Gizlilik sayfaları taslak, noindex, hukuki inceleme yok.
3. NEXT_PUBLIC_SITE_URL tanımsız; sitemap/robots/canonical/OG localhost yazar (Dockerfile değişkeni de geçirmiyor).
4. HTTPS yönlendirmesi ve HSTS kararı yok (deployment.md TBD).
5. İletişim kanalı yalnız kişisel Gmail mailto'su; ayrı sayfa yok.

KRİTİK EKSİKLER:
1. Hakkımızda, Çerez Politikası sayfaları yok; çerez onayı için N/A kararı yazılı değil.
2. JSON-LD (Organization, SoftwareApplication, FAQPage) hiç yok.
3. OG görseli kare ve 1.45 MB; sayfaya özel görsel yok.
4. Giriş/kayıt/şifre sayfaları EN ve DE'de Türkçe açıklama gösteriyor; şifre sayfasında title/canonical/hreflang yok.
5. Landing'de 5 adet h1; WCAG hedefi yazılmamış; erişilebilirlik ve Lighthouse ölçümü hiç yapılmamış.

İYİLEŞTİRMELER:
1. /favicon.ico ekle (şu an 404).
2. llms.txt için karar ver.
3. Firefox ve WebKit (Safari) testlerini Playwright'a ekle; mobil cihaz profilleri ekle.
4. Sitemap'e lastModified ekle.
5. Ana route'lara loading.tsx ve derin sayfalara breadcrumb ekle.

SONUÇ:
NOT READY
```
