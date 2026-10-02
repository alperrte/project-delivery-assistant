# 07 — Pre-Production QA

Bu doküman production deploy öncesindeki release gate'tir. Kritik maddeler doğrulanmadan public release yapılmamalıdır.

## Responsive QA

- [ ] Mobil görünüm test edildi.
- [ ] Tablet görünüm test edildi.
- [ ] Laptop görünüm test edildi.
- [ ] Büyük desktop görünüm test edildi.
- [ ] Horizontal overflow kontrol edildi.
- [ ] Uzun/kısa içerik senaryoları kontrol edildi.

## Browser QA

- [ ] Chrome test edildi.
- [ ] Edge test edildi.
- [ ] Firefox test edildi.
- [ ] Safari test edildi veya projenin destek matrisi içinde N/A gerekçesi yazıldı.
- [ ] iOS Safari kritik akışları kontrol edildi.
- [ ] Android/Chrome kritik akışları kontrol edildi.

## Functional UI QA

- [ ] Net ana CTA çalışıyor.
- [ ] Form validation çalışıyor.
- [ ] Loading State'ler çalışıyor.
- [ ] Empty State'ler çalışıyor.
- [ ] Error State'ler çalışıyor.
- [ ] Success State'ler çalışıyor.
- [ ] Footer linkleri çalışıyor.
- [ ] İletişim/destek kanalı çalışıyor.

## Error Page QA

- [ ] 403 senaryosu doğrulandı.
- [ ] 404 senaryosu doğrulandı.
- [ ] 500 senaryosu doğrulandı.
- [ ] 503 senaryosu doğrulandı.

## SEO / GEO QA

- [ ] Metadata kontrol edildi.
- [ ] Unique page title'lar kontrol edildi.
- [ ] `sitemap.xml` erişiliyor.
- [ ] `robots.txt` erişiliyor.
- [ ] Canonical URL'ler production domain ile doğru.
- [ ] Open Graph verileri doğru.
- [ ] Sosyal paylaşım önizlemesi test edildi.
- [ ] `hreflang` gerekiyorsa doğrulandı.
- [ ] Favicon doğrulandı.
- [ ] JSON-LD / Structured Data doğrulandı.
- [ ] Breadcrumb gerekiyorsa doğrulandı.
- [ ] `llms.txt` proje kapsamında ise doğrulandı.
- [ ] HTTPS aktif ve HTTP → HTTPS yönlendirmesi çalışıyor.
- [ ] Broken internal link kontrolü yapıldı.

## Accessibility QA

- [ ] Keyboard-only temel akış testi yapıldı.
- [ ] Focus State'ler görünür.
- [ ] Screen reader açısından kritik semantik yapı gözden geçirildi.
- [ ] Alt text kontrolleri yapıldı.
- [ ] Heading hierarchy kontrol edildi.
- [ ] Form label ve hata mesajları kontrol edildi.
- [ ] Otomatik accessibility audit çalıştırıldı.

## Performance / Quality

- [ ] Lighthouse audit çalıştırıldı.
- [ ] Kritik Core Web Vitals problemleri gözden geçirildi.
- [ ] Gereksiz büyük görseller tespit edildi.
- [ ] Public sayfalarda bariz layout shift kontrol edildi.
- [ ] Production build başarıyla tamamlandı.

## Legal / Corporate QA

- [ ] KVKK bağlantısı mevcut ve çalışıyor.
- [ ] Gizlilik Politikası mevcut ve çalışıyor.
- [ ] Çerez Politikası mevcut ve çalışıyor.
- [ ] Çerez onay mekanizması gerekiyorsa çalışıyor.
- [ ] Kullanım Koşulları mevcut ve çalışıyor.
- [ ] Hakkımızda sayfası mevcut.
- [ ] SSS sayfası/bölümü mevcut veya N/A gerekçesi yazıldı.
- [ ] İletişim/destek kanalı mevcut ve çalışıyor.

## Security Referansı

- [ ] Ayrı `SECURITY.md` kontrol listesi ayrıca tamamlandı.

> Bu dosya güvenlik detaylarını içermez.
