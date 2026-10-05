# Web Sitesi Kesinlikle Olması Gerekenler — Master Checklist
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
  - 2026-10-03: Auth ve bilgi sayfalarında SiteFooter, landing’de kompakt LandingFooter bulunur. Kullanıcı tercihiyle çalışma ekranlarında footer yerine hesap menüsündeki “Bilgi ve destek” bağlantıları kullanılır. Public test paketi bu erişimi doğrular.
  - 2026-10-05: Landing footer, login ile aynı ortak CONTRIBUTORS listesinden Alper/Hamza GitHub profillerini ve aynı kaynak kod/Apache 2.0 bağlantısını gösterir. TR/EN/DE, light/dark, 320/390/1440 px hedefli kontrol; doğru href, ikon, metin, 44 px hedef ve klavye odağı doğrulandı.
- [ ] **KVKK** — Kişisel veri işleme süreçleriyle ilgili gerekli bilgilendirme ve kullanıcı hakları erişilebilir olmalıdır.
- [ ] **Gizlilik Politikası** — Kullanıcı verilerinin nasıl toplandığını, kullanıldığını ve gerektiğinde saklandığını/paylaşıldığını açıklar.
- [ ] **Erişilebilirlik** — Site farklı kullanıcı ihtiyaçları düşünülerek erişilebilir biçimde geliştirilmiş olmalıdır.
- [ ] **Sıkça Sorulan Sorular** — Yaygın kullanıcı sorularını destek talebi oluşturmadan cevaplar; ürün için gereksizse N/A gerekçesi yazılmalıdır.
- [ ] **Çerez Onayı** — Gerekli durumlarda kullanıcının çerez tercihlerini yönetmesini sağlar.
- [ ] **Çerez Politikası** — Çerez onay banner'ından ayrı olarak kullanılan çerezlerin türlerini ve amaçlarını açıklar.
- [ ] **Hakkımızda Sayfası** — Projenin, ürünün veya kurumun kim olduğunu ve ne sunduğunu açıklar.
- [ ] **Kullanım Koşulları** — Kullanıcı ile platform arasındaki kullanım kurallarını ve sorumlulukları tanımlar.
- [ ] **İletişim / Destek Kanalı** — Kullanıcının problem, KVKK talebi veya genel iletişim için ulaşabileceği açık ve çalışan bir kanal sağlar.

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

İYİLEŞTİRMELER:
1.
2.

SONUÇ:
READY / NOT READY
```

> `READY` yalnız production blocker kalmadığında verilmelidir.
