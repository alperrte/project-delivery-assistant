# 02 — Development Standards

Bu doküman, geliştirme süresince her yeni sayfa ve component için korunması gereken standartları tanımlar.

## Responsive Geliştirme

- [ ] Her yeni ekran telefon, tablet, laptop ve desktop boyutlarında kontrol edilmelidir.
- [ ] **Mobil Görünüm Responsive Testleri** geliştirme sırasında düzenli yapılmalıdır.
- [ ] Navigasyon, modal, dropdown, tablo ve form gibi karmaşık componentler mobilde ayrıca test edilmelidir.
- [ ] İçerik uzadığında veya kısaldığında layout bozulmamalıdır.

## UI State Yönetimi

- [ ] Async ekranlarda **Loading State** bulunmalıdır.
- [ ] Veri olmayan ekranlarda **Empty State** bulunmalıdır.
- [ ] Başarısız işlemlerde **Error State** bulunmalıdır.
- [ ] Tamamlanan işlemlerde **Success State** bulunmalıdır.
- [ ] Kullanıcıya teknik stack trace veya anlamsız backend mesajı gösterilmemelidir.

## Formlar

- [ ] **Form Validation** eksik ve hatalı girişleri kullanıcıya açıkça göstermelidir.
- [ ] Required alanlar anlaşılır biçimde belirtilmelidir.
- [ ] Hata mesajları yalnız renge bağlı olmamalıdır.
- [ ] Submit/loading durumu kullanıcıya gösterilmelidir.
- [ ] Başarılı/başarısız gönderim sonucu görünür olmalıdır.

## Navigasyon ve CTA

- [ ] Sayfanın ana amacı varsa **Net Bir CTA** açıkça görünmelidir.
- [ ] Çok seviyeli sayfalarda gerekli ise **Breadcrumb** kullanılmalıdır.
- [ ] Geri navigasyon kullanıcının bağlamını gereksiz yere kaybettirmemelidir.
- [ ] Footer bağlantıları geçerli route'lara gitmelidir.

## Metadata Disiplini

- [ ] Yeni public sayfaya uygun **Unique Page Title** eklenmelidir.
- [ ] Uygun meta description eklenmelidir.
- [ ] Gerekliyse canonical URL güncellenmelidir.
- [ ] Sosyal paylaşım yapılabilecek public sayfalarda Open Graph verileri düşünülmelidir.

## Erişilebilirlik Geliştirme Standardı

- [ ] **Keyboard Navigation** ile temel akış tamamlanabilmelidir.
- [ ] **Focus State** görünür olmalıdır.
- [ ] **Alt Text** eksik bırakılmamalıdır.
- [ ] **Heading Hierarchy** bozulmamalıdır.
- [ ] **Screen Reader Uyumluluğu** açısından semantik HTML tercih edilmelidir.

Ayrıntılar için `05_ACCESSIBILITY.md` kullanılmalıdır.
