# Web Sitesi Kesinlikle Olması Gerekenler — Master Checklist

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
