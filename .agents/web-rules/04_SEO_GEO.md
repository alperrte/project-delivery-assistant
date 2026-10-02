# 04 — SEO / GEO

Bu doküman arama motorları, sosyal paylaşım sistemleri ve AI tabanlı bilgi keşif sistemleri için public web görünürlüğü standartlarını tanımlar.

## SEO / GEO Temeli

- [ ] Public sayfalar arama motorları tarafından anlaşılabilir semantik yapıya sahip olmalıdır.
- [ ] İnsanlara yönelik içerik kalitesi öncelik olmalıdır; yalnız crawler için yapay içerik üretilmemelidir.
- [ ] SEO ve GEO kontrolleri gerçek public URL'ler üzerinden production öncesi ve sonrası doğrulanmalıdır.

## Metadata

- [ ] **Meta Data** her önemli public sayfada tanımlanmalıdır.
- [ ] **Unique Page Title** her indexlenebilir sayfa için benzersiz ve anlamlı olmalıdır.
- [ ] Meta description ilgili sayfanın içeriğini doğru özetlemelidir.
- [ ] Varsayılan metadata yalnız gerekli fallback durumlarında kullanılmalıdır.

## sitemap.xml

- [ ] **sitemap.xml** erişilebilir olmalıdır.
- [ ] Indexlenmesi gereken önemli public URL'ler sitemap içinde bulunmalıdır.
- [ ] Auth/private/admin URL'leri gereksiz yere sitemap'e eklenmemelidir.
- [ ] Dinamik sitemap kullanılıyorsa yeni içeriklerle güncellendiği doğrulanmalıdır.

## robots.txt

- [ ] **robots.txt** erişilebilir olmalıdır.
- [ ] Crawler kuralları yanlışlıkla tüm public siteyi engellememelidir.
- [ ] Sitemap konumu gerekiyorsa robots.txt içinde belirtilmelidir.
- [ ] robots.txt güvenlik mekanizması olarak kullanılmamalıdır.

## Canonical URL

- [ ] **Canonical URL** duplicate veya alternatif URL'lerin asıl versiyonunu belirtmelidir.
- [ ] Canonical URL absolute ve doğru production domain'ine işaret etmelidir.
- [ ] Sayfa yanlış başka bir route'u canonical olarak göstermemelidir.

## Open Graph

- [ ] **OpenGraph** title tanımlanmalıdır.
- [ ] OpenGraph description tanımlanmalıdır.
- [ ] Uygun paylaşım görseli tanımlanmalıdır.
- [ ] Paylaşılan public link WhatsApp, LinkedIn, Discord vb. önizlemelerde test edilmelidir.
- [ ] OG URL production URL ile uyumlu olmalıdır.

## hreflang

- [ ] Çok dilli projelerde **hreflang** uygulanmalıdır; tek dilli projelerde N/A olarak işaretlenebilir.
- [ ] Dil/bölge kodları doğru olmalıdır.
- [ ] Alternatif dil URL'leri birbirini doğru göstermelidir.

## Favicon

- [ ] **Favicon** tanımlanmalıdır.
- [ ] Modern browserlarda doğru görünmelidir.
- [ ] Gerekliyse farklı icon boyutları sağlanmalıdır.

## JSON-LD / Structured Data

- [ ] Uygun sayfalarda **JSON-LD / Structured Data** kullanılmalıdır.
- [ ] İçeriğe göre `Organization`, `SoftwareApplication`, `FAQPage`, `BreadcrumbList`, `Article` vb. doğru schema seçilmelidir.
- [ ] Structured data sayfada gerçekte bulunmayan bilgileri iddia etmemelidir.
- [ ] Üretilen JSON-LD geçerli JSON olmalıdır.
- [ ] Production öncesinde structured data validator/test araçlarıyla kontrol edilmelidir.

## Breadcrumb

- [ ] Hiyerarşik public sayfalarda **Breadcrumb** kullanılmalıdır.
- [ ] Breadcrumb kullanıcıya mevcut konumu göstermelidir.
- [ ] Uygunsa `BreadcrumbList` structured data ile desteklenmelidir.

## llms.txt

- [ ] **llms.txt** proje kararı doğrultusunda oluşturulmalıdır veya N/A/opsiyonel olarak işaretlenmelidir.
- [ ] AI sistemlerine önemli public içeriklerin nerede olduğu hakkında açık yönlendirme sağlamalıdır.
- [ ] `llms.txt`, `robots.txt` veya `sitemap.xml` yerine geçen bir mekanizma olarak değerlendirilmemelidir.

## HTTPS

- [ ] **HTTPS zorunlu + HTTP → HTTPS redirect** production ortamında doğrulanmalıdır.
- [ ] Güvenlik yapılandırmasının ayrıntıları `SECURITY.md` içinde tutulmalıdır.

## Redirect ve URL Kalitesi

- [ ] Eski/değişmiş public URL'ler gerektiğinde **301/308 redirect** ile yeni adrese yönlendirilmelidir.
- [ ] Kırık internal link bulunmamalıdır.
- [ ] URL path'leri okunabilir ve tutarlı olmalıdır.
