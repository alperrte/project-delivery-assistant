# Footer kapsamı ve sadeleştirme

## Teslim ve durum

2 Ekim 2026 — Kullanıcının kabul ettiği düzen uygulandı: çalışma ekranlarında footer kaldırıldı, bilgi sayfaları sadeleştirildi ve uygulama içindeki bilgi bağlantıları hesap menüsüne taşındı. Commit veya push yapılmadı.

## Yapılanlar

- [AppShell](../../frontend/src/components/layout/app-shell.tsx) ortak uygulama footer'ını artık render etmez. Dashboard, projeler, ekipler, görevler ve diğer AppShell ekranlarında alt bölüm çalışma içeriğine ayrılır.
- [AppHeader](../../frontend/src/components/layout/app-header.tsx) hesap menüsüne Bilgi ve destek grubu eklendi. SSS, KVKK, Gizlilik Politikası, Erişilebilirlik ve `mailto:pda-info@gmail.com` bağlantıları masaüstünde ve mobilde aynı menüdedir. Başlık ve etiketler mevcut üç dildeki çevirilerden gelir.
- [SiteFooter](../../frontend/src/components/layout/site-footer.tsx) bilgi sayfalarında copyright, dört bilgi bağlantısı ve iletişim e-postasından oluşan sade bir alt satır gösterir. Dar ekranda satırlar sarılır; bağlantılar en az 44 px yüksekliğindedir.
- Login, kayıt ve şifre sıfırlama ekranlarının kompakt auth footer'ı korunur; geliştirici/GitHub ve kaynak kod bağlantıları burada kalır. Bilgi sayfalarının login ile aynı tema kontrolü korunur. Arka plan görseli değiştirilmedi.
- [Mevcut footer testleri](../../frontend/e2e/footer-public-pages.spec.ts) uygulamada footer bulunmaması ve hesap menüsünden bilgi sayfasına geçiş beklentisine göre güncellendi.
- [Klasör rehberi](../../.agents/folder-structure.md) ve [tasarım kuralları](../../.agents/frontend-design-rules.md) yeni kapsamı açıklar.

## Doğrulama

Frontend dizininde çalışan geliştirme sunucusunda:

- `node node_modules/typescript/bin/tsc --noEmit` — başarılı.
- `node node_modules/eslint/bin/eslint.js src/components/layout/site-footer.tsx src/components/layout/app-shell.tsx src/components/layout/app-header.tsx e2e/footer-public-pages.spec.ts` — başarılı.
- `node node_modules/@playwright/test/cli.js test --config=playwright.public.config.ts` — 10 test başarılı. Üç dilde dolu içerik; iki temada 320/390/768/1440 px footer genişlikleri; GitHub/e-posta bağlantıları; SSS klavye kullanımı ve hesap menüsündeki bilgi sayfası erişimi kontrol edildi. Uygulama verileri bu testlerde sahte API yanıtlarıyla sağlandı; gerçek giriş/backend entegrasyon testi yapılmadı.
- Ek Playwright görsel kontrolünde 1440×900 uygulama ekranında footer yok; hesap menüsünün tüm bilgi ve iletişim bağlantıları mevcut. Klavyeyle SSS'ye geçiş çalışıyor. Bilgi footer'ının masaüstü yüksekliği 69 px olarak ölçüldü.
- 390×844 koyu temada bilgi footer'ı görsel olarak incelendi; yatay taşma yok. Hesap menüsü ekran sınırları içinde kalıyor. Tarayıcı sayfa hatası görülmedi.
- `git diff --check` — başarılı.

## Açık konular

Bu teslimde bilinen yerleşim engeli yok. Hukuki metinlerin yayın öncesi inceleme gereksinimi önceki teslimde belirtildiği şekilde devam eder.

## Kullanıcı kontrolü

1. Oturum açıp Dashboard, Projeler ve Görevler sayfalarını aç: büyük footer'ın görünmediğini doğrula.
2. Üst çubuktaki hesap menüsünü aç: Bilgi ve destek bölümünden dört bilgi sayfasına ulaş; İletişim bağlantısının e-posta uygulamasını açtığını kontrol et.
3. SSS, KVKK, Gizlilik ve Erişilebilirlik sayfalarının sonuna git: sade copyright/bağlantı satırını kontrol et.
4. Login, kayıt ve şifre sıfırlama ekranlarını aç: kompakt footer'ın ve geliştirici/GitHub bağlantılarının görünür olduğunu doğrula.
5. Mobil genişlikte ve açık/koyu temada aynı kontrolleri tekrarla.
