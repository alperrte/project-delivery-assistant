# Web Sitesi Kesinlikle Olması Gerekenler — Master Checklist

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
