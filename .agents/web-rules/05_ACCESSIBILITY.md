# 05 — Accessibility

Bu doküman web arayüzlerinin farklı yeteneklere sahip kullanıcılar tarafından kullanılabilir olması için uygulanacak erişilebilirlik standartlarını tanımlar.

## Hedef

- [ ] Proje için **WCAG 2.2 AA** hedefi benimsenmelidir veya farklı hedef açıkça belgelenmelidir.

## Keyboard Navigation

- [ ] **Keyboard Navigation** ile temel kullanıcı akışları tamamlanabilmelidir.
- [ ] Tab sırası mantıklı olmalıdır.
- [ ] Modal açıldığında focus uygun şekilde yönetilmelidir.
- [ ] Modal kapandığında focus mümkünse tetikleyen elemente dönmelidir.
- [ ] Escape ile kapatılması beklenen componentler uygun şekilde çalışmalıdır.
- [ ] Keyboard trap oluşmamalıdır.

## Focus State

- [ ] **Focus State** görünür olmalıdır.
- [ ] CSS reset veya custom style focus göstergesini tamamen kaldırmamalıdır.
- [ ] Focus göstergesi arka plan üzerinde yeterince ayırt edilebilir olmalıdır.

## Screen Reader Uyumluluğu

- [ ] **Screen Reader Uyumluluğu** semantik HTML ile desteklenmelidir.
- [ ] Form alanlarının erişilebilir isimleri bulunmalıdır.
- [ ] Icon-only butonların erişilebilir isimleri bulunmalıdır.
- [ ] Durum mesajları gerektiğinde screen reader tarafından anlaşılabilir olmalıdır.
- [ ] Gereksiz ARIA kullanılmamalıdır; native HTML tercih edilmelidir.

## Alt Text

- [ ] Anlam taşıyan görsellerde uygun **Alt Text** bulunmalıdır.
- [ ] Dekoratif görseller screen reader tarafından gereksiz okunmamalıdır.
- [ ] Alt text görsel dosya adını tekrar etmek yerine görselin işlevini/anlamını aktarmalıdır.

## Heading Hierarchy

- [ ] Sayfada anlamlı bir **Heading Hierarchy** bulunmalıdır.
- [ ] Ana sayfa başlığı uygun `h1` ile ifade edilmelidir.
- [ ] Görsel boyut için heading seviyesi atlanmamalıdır.
- [ ] Başlık sırası içeriğin mantıksal yapısını takip etmelidir.

## Responsive ve Zoom

- [ ] Mobil ve dar ekranlarda erişilebilirlik davranışı korunmalıdır.
- [ ] Yüksek zoom seviyelerinde temel içerik ve kontroller kullanılabilir kalmalıdır.
- [ ] Metinler container dışına taşmamalıdır.

## Formlar

- [ ] Input alanlarının görünür veya erişilebilir label'ları bulunmalıdır.
- [ ] Hata mesajları yalnız renkle ifade edilmemelidir.
- [ ] Required durumu anlaşılır olmalıdır.
- [ ] Validation sonucu screen reader kullanıcısına da aktarılabilmelidir.

## Son Kontrol

- [ ] Otomatik accessibility audit çalıştırılmalıdır.
- [ ] En az bir manuel keyboard-only test yapılmalıdır.
- [ ] Kritik akışlar screen reader mantığı açısından manuel gözden geçirilmelidir.
