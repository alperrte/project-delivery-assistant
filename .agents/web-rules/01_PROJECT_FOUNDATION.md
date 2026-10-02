# 01 — Project Foundation

Bu doküman, proje daha ilk geliştirme aşamasındayken kurulması gereken temel web standartlarını tanımlar.

## Responsive Temel

- [ ] **Responsive Design** — Telefon, tablet, laptop ve desktop ekranları proje başından itibaren desteklenmelidir.
- [ ] Breakpoint yaklaşımı tasarım sisteminde tanımlanmalıdır.
- [ ] Sabit pixel ölçülerinin mobil görünümü bozmadığı doğrulanmalıdır.
- [ ] Horizontal overflow oluşmamalıdır.

## Sayfa ve Route Temeli

- [ ] Her public route için anlamlı bir **Unique Page Title** yapısı bulunmalıdır.
- [ ] Route yapısı okunabilir ve tutarlı olmalıdır.
- [ ] Gerekli çok seviyeli yapılarda **Breadcrumb** mimarisi planlanmalıdır.
- [ ] Çok dilli projelerde locale/route stratejisi baştan belirlenmelidir.

## UI State Temeli

Her veri odaklı ekran aşağıdaki dört temel durumu düşünmelidir:

- [ ] **Loading State** — Veri yüklenirken kullanıcı sistemin çalıştığını anlayabilmelidir.
- [ ] **Empty State** — Veri yoksa boş ekran yerine nedenini ve mümkünse sonraki aksiyonu göstermelidir.
- [ ] **Error State** — İşlem başarısız olduğunda anlaşılır hata ve mümkünse çözüm/yeni deneme aksiyonu sunmalıdır.
- [ ] **Success State** — İşlem başarıyla tamamlandığında kullanıcı net geri bildirim almalıdır.

## Form Standardı

- [ ] **Form Validation** client-side ve gerektiğinde server-side doğrulamayı desteklemelidir.
- [ ] Hata mesajları ilgili input ile görsel ve semantik olarak ilişkilendirilmelidir.
- [ ] Form submit sırasında duplicate submission önlenmelidir.
- [ ] Başarılı submit sonrası uygun Success State gösterilmelidir.

## Semantik HTML Temeli

- [ ] Sayfada anlamlı landmark elementleri kullanılmalıdır (`header`, `nav`, `main`, `footer` vb.).
- [ ] **Heading Hierarchy** mantıklı `h1 → h2 → h3` düzeni izlemelidir.
- [ ] Görseller için **Alt Text** stratejisi uygulanmalıdır.
- [ ] Etkileşimli elementler mümkün olduğunca gerçek `button`, `a`, `input` vb. HTML elementleriyle oluşturulmalıdır.

## CTA

- [ ] Landing/public sayfalarda kullanıcıya ana amacı gösteren **net bir CTA** bulunmalıdır.
- [ ] Aynı ekranda birbirleriyle yarışan gereksiz ana CTA'lar oluşturulmamalıdır.
- [ ] CTA metni yapılacak aksiyonu açıkça ifade etmelidir: “Kayıt Ol”, “Başla”, “İletişime Geç” vb.

## Metadata Altyapısı

- [ ] Sayfa bazlı metadata üretebilecek yapı kurulmalıdır.
- [ ] Title ve description değerleri route bazında yönetilebilmelidir.
- [ ] Open Graph verileri için merkezi/default yapı bulunmalıdır.
- [ ] Canonical URL üretimi için altyapı planlanmalıdır.
