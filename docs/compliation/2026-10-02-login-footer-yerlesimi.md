# Login footer yerleşimi

## Teslim ve durum

2 Ekim 2026 — Login ekranındaki footer yüksekliği ve ekranla uyumu düzeltildi. Commit veya push yapılmadı.

## Yapılanlar

- [SiteFooter](../../frontend/src/components/layout/site-footer.tsx): Auth ekranlarında dört kolon yerine kompakt, satırları dar ekranlarda saran düzen kullanılır. Bilgi sayfaları, GitHub profilleri, iletişim e-postası, kaynak kod ve copyright bağlantıları korunur. Bağlantılar en az 44 px yüksekliğindedir.
- [AuthShell](../../frontend/src/components/layout/auth-shell.tsx): Logo boyutu ve dikey boşluklar azaltıldı. Footer sayfa akışında kalır; kısa ekranlarda kaydırma yapılır, formun üzerine binmez.
- [LoginHero](../../frontend/src/features/auth/components/login-hero.tsx): Başlık boyutu ve alt boşluğu giriş formu ile footer'a yer açacak şekilde düzenlendi.
- [Tasarım kuralları](../../.agents/frontend-design-rules.md): Auth footer düzeni güncellendi.

## Doğrulama

Frontend dizininde çalışan geliştirme sunucusunda:

- `node node_modules/typescript/bin/tsc --noEmit` — başarılı.
- `node node_modules/eslint/bin/eslint.js src/components/layout/site-footer.tsx src/components/layout/auth-shell.tsx src/features/auth/components/login-hero.tsx` — başarılı.
- `node node_modules/@playwright/test/cli.js test --config=playwright.public.config.ts` — mevcut 10 test başarılı. Üç dil, iki tema, 320/390/768/1440 px genişlikler, footer bağlantıları, bilgi sayfaları ve uygulama içi footer kontrol edildi.
- Playwright ile ek görsel kontrol: 1440×900 login görünümünde footer yüksekliği 370 px'den 110 px'ye, toplam sayfa yüksekliği yaklaşık 1255 px'den 900 px'ye indi. Açık ve koyu tema incelendi.
- 1366×768, 390×844 ve 320×568 boyutlarında yatay taşma görülmedi. Form ile footer arasında en az 16 px mesafe kaldı; footer bağlantılarının yüksekliği en az 44 px olarak ölçüldü. Tarayıcı sayfa hatası görülmedi.

## Açık konular

- Kısa ekranlarda ve mobilde form ile footer toplamı ekran yüksekliğini aşabilir; bu durumda doğal dikey kaydırma beklenir. İçeriği kesen sabit yükseklik veya forma örtüşen footer kullanılmaz.
- Bu teslim yerleşim düzeltmesidir. Önceki teslimde belirtilen hukuki metinlerin yayın öncesi inceleme gereksinimi devam eder.

## Kullanıcı kontrolü

1. Frontend çalışırken `/login` sayfasını yenile.
2. Tarayıcıyı 1440×900 ölçüsüne getir: form ve footer'ın birlikte ekrana oturduğunu kontrol et.
3. Kısa ekran ve mobil genişliklerde aşağı kaydır: footer bağlantılarının görünür, formun kullanılabilir ve yatay taşmanın olmadığını doğrula.
4. Açık/koyu temayı değiştir; bilgi sayfaları, GitHub profilleri ve e-posta bağlantısını kontrol et.
