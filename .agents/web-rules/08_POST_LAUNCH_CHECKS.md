# 08 — Post-Launch Checks

Bu doküman production yayını tamamlandıktan sonra gerçek public ortamda yapılacak kontrolleri tanımlar.

## Canlı URL Kontrolü

- [ ] Ana sayfa production URL üzerinden açılıyor.
- [ ] Kritik public route'lar açılıyor.
- [ ] Login/register gibi kritik akışlar varsa canlı ortamda smoke test yapıldı.
- [ ] HTTPS aktif.
- [ ] HTTP istekleri HTTPS'e yönleniyor.
- [ ] Canonical URL'ler localhost/staging yerine production domain gösteriyor.

## SEO / GEO Canlı Kontrol

- [ ] `robots.txt` production üzerinden erişiliyor.
- [ ] `sitemap.xml` production üzerinden erişiliyor.
- [ ] Sitemap arama motoru araçlarına gönderildi.
- [ ] Google Search Console property doğrulandı veya proje kararıyla N/A işaretlendi.
- [ ] Önemli public sayfaların indexlenebilirliği kontrol edildi.
- [ ] Open Graph preview gerçek production linki ile test edildi.
- [ ] Structured Data production URL üzerinde tekrar kontrol edildi.
- [ ] `hreflang` varsa production domainlerle doğrulandı.
- [ ] `llms.txt` kullanılıyorsa production üzerinden erişiliyor.

## UI / UX Smoke Test

- [ ] Mobil production görünümü kontrol edildi.
- [ ] Ana CTA çalışıyor.
- [ ] Footer linkleri çalışıyor.
- [ ] Form validation canlı ortamda çalışıyor.
- [ ] Loading / Empty / Error / Success state'leri kritik akışlarda doğru.
- [ ] 404 production ortamında test edildi.

## Accessibility Smoke Test

- [ ] Keyboard navigation production ortamında kontrol edildi.
- [ ] Focus State'ler production CSS build sonrasında görünür.
- [ ] Kritik görsellerde alt text korunmuş.
- [ ] Heading hierarchy production HTML'de doğru.

## Yasal / Kurumsal

- [ ] KVKK sayfası erişilebilir.
- [ ] Gizlilik Politikası erişilebilir.
- [ ] Çerez Politikası erişilebilir.
- [ ] Kullanım Koşulları erişilebilir.
- [ ] Hakkımızda sayfası erişilebilir.
- [ ] İletişim/destek kanalı gerçekten çalışıyor.

## Sürekli İzleme

- [ ] SEO/GEO durumunun periyodik olarak gözden geçirilmesi planlandı.
- [ ] Core Web Vitals/performance problemleri yayın sonrası tekrar kontrol edildi.
- [ ] Yeni route eklendiğinde metadata/sitemap/canonical süreçlerinin nasıl güncelleneceği ekipçe biliniyor.
