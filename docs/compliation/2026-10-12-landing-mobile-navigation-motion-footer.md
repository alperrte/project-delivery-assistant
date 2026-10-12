# Landing mobil menü, animasyonlar ve footer

Tarih: 2026-10-12. Kullanıcının istediği üç düzeltme uygulanmıştır; bu kayıt proje genelinde production onayı değildir.

## Tamamlanan kapsam

- Ana sayfa navbar'ı 1024 px altında hamburger menüdür. Dil/tema, Hakkımızda, İletişim, Giriş ve Kayıt bağlantıları korunur. Menü 44 px tetikleyici, `aria-expanded`/`aria-controls`, Escape ile odak dönüşü, dış tıklamayla kapanma ve desktop geçişiyle sıfırlama içerir. Masaüstü navbar düzeni korunur.
- “Bir fikrin yolculuğu” ve açık kaynak terminal animasyonları artık mobil/tablet/kısa laptopta da kaydırmayla ilerler. Eski 1024×800 minimum sınırı yerine 480 px viewport yüksekliği kullanılır. Daha kısa yatay ekranlar ve reduced-motion/animasyon kapalı/JS yokluğu tam statik içeriği gösterir.
- Dar ekranda demo kamera proje adı, görev başlığı, ekip üyeleri ve görev durumunu görünür tutar; üye kartları desktop tablo satırlarıyla aynı sırada belirir. Tamamlanmış animasyonlar geri sarılmaz ve mevcut sticky alanı serbest bırakma davranışı korunur.
- Dar/kısa ekranlarda terminal tam genişlikte komutları yazar, ardından teknoloji bilgileri aynı alanda görünür. Desktop küçülme ve yana geçiş korunur.
- Ortak footer mobilde iki sütunlu bilgi bağlantıları, sola hizalı ekip/iletişim/kaynak/lisans ve alta yerleşen sürüm/telif satırı kullanır. Uzun bağlantılar kırılabilir, hedefler en az 44 px'tir. Auth ve public sayfalar aynı bileşeni kullanmayı sürdürür.

## Değişen önemli dosyalar

- `frontend/src/features/landing/{landing-page.tsx,landing.module.css,product-story.tsx,open-source-scene.tsx}`
- `frontend/src/features/landing/demo/pda-demo-workspace.tsx`; `product-demo.tsx` açıklama güncellemesi
- `frontend/src/components/layout/site-footer.tsx`
- `frontend/e2e/{landing-page.spec.ts,footer-public-pages.spec.ts}`
- `.agents/frontend-design-rules.md`, `.agents/web-rules/WEB_SITE_MASTER_CHECKLIST_TR.md`

## Doğrulama komutları ve sonuçları

`frontend` klasöründe, Windows için `.cmd` komutları kullanıldı:

```powershell
npx.cmd eslint src/features/landing src/components/layout/site-footer.tsx e2e/landing-page.spec.ts e2e/footer-public-pages.spec.ts
npx.cmd tsc --noEmit
npm.cmd run build
npm.cmd run start
npx.cmd playwright test -c playwright.public.config.ts landing-page.spec.ts landing-real-ui.spec.ts footer-public-pages.spec.ts --trace off --output ../tmp/landing-production-results
```

- ESLint, TypeScript ve production build: başarılı, çıkış 0.
- Son kaynak ve production sunucusu üzerinde Chromium: **45 başarılı**, 0 başarısız/skip.
- Mobil ve desktop hikâye yazımı/aşama/durum değişimi, mobil kamera görünürlüğü, terminalin kırpılmaması, tamamlanma/serbest bırakma, reduced-motion, JS'siz içerik, navbar menüsü/dil menüsü/Escape/odak/link/viewport geçişi ve mevcut gerçek component karşılaştırmaları doğrulandı.
- Ortak footer TR/EN/DE, light/dark, 320/390/768/1440 px ve landing/login/about yüzeylerinde taşma ve 44 px hedef kontrolünü geçti; mevcut auth ve public sayfa footer testleri de geçti. Landing responsive kontrolü ayrıca 1280/1920 px ve kısa yatay viewport içerir.
- `git diff --check`: başarılı; yalnız mevcut CRLF dönüşüm uyarıları var.

Mobil WebKit, iPhone cihaz profili (dokunmatik emülasyon):

```powershell
$env:PLAYWRIGHT_BROWSERS_PATH=(Join-Path (Resolve-Path ../tmp) 'playwright-browsers')
$env:E2E_CROSS_BROWSER='1'
npx.cmd playwright test -c playwright.public.config.ts landing-page.spec.ts footer-public-pages.spec.ts --project mobile-safari --grep 'compact story|mobile hamburger|mobile footer' --trace off --output ../tmp/landing-safari-production-results
```

- Son production koşumu: **8 başarılı**, 0 başarısız/skip. Menü, dört kompakt viewport ve üç dil footer kapsamı.
- Başlangıçta gerekli WebKit sürümü yoktu; proje içindeki ignored `tmp/playwright-browsers` klasörüne indirildi. Paket/lock/config bağımlılık sözleşmesi değişmedi.
- Geliştirme koşumunda mevcut ilk Tab → “İçeriğe geç” odak testi mobil WebKit'te başarısız kaldı. Alt+Tab denemesi de bu emülasyonda çözmedi; test gevşetilmedi, eski Tab kontrolü korunuyor. Final seçilmiş 8 test bu ayrı testi içermez. Chromium'da aynı klavye testi geçer; tüm WebKit paketinin yeşil olduğu iddia edilmez.
- Yeni footer testi fotoğraf yüklemelerinden bağımsız `domcontentloaded` ve etkin footer kontrolü/tema hazır olma koşulunu bekler; ilk WebKit denemesindeki `/about` load timeout'u böyle giderildi.

Ekran görüntüleri `tmp/landing-qa/` altında incelendi: hamburger, 320/390 px demo yazımı/ekip/durum, terminal yazımı/teknoloji ve çok dilli footer. Bunlar geçici yerel QA çıktılarıdır.

## Açık kalan konular

- Gerçek iPhone/iPad Safari, işletim sistemi klavye erişilebilirlik ayarları ve skip-link Tab odağı manuel doğrulanmalıdır. WebKit emülasyonu gerçek cihaz doğrulaması değildir.
- Proje genelindeki frontend/backend gate, Firefox/Edge ve production deployment bu görevin kapsamı değildir. Global responsive/erişilebilirlik checkbox'ları tamamlanmış sayılmadı.
- Backend/API, ENV, auth, cookie, CSRF/CORS, bağımlılık veya migration değişikliği yok. Testlerin gerçek uygulama referansları mevcut açıkça TEST-ONLY fixture yanıtlarını kullanır; landing demo hiçbir backend isteği göndermez.
- `docs/compliation/README.md` bu çalışma kopyasında bulunmadığından AGENTS.md'nin istediği kapsam/dosya/komut/sonuç/açık konu/manuel kontrol bölümleri kullanıldı.

## Kullanıcının manuel kontrol adımları

1. Yerel production önizlemesi `http://localhost:3000/tr/ana-sayfa` üzerinde açık. Telefon boyutunda hamburger'i açın; dil/tema ve giriş bağlantılarını deneyin.
2. Animasyon tercihi açıkken aşağı kaydırın; proje adı/görev başlığı yazımı, ekip üyeleri, görev durumu ve terminal komutlarının ilerlediğini kontrol edin. Hareket azaltma açıkken statik içerik beklenir.
3. Footer'ı 320/390 px ve gerçek telefonda, iki tema ve özellikle Almanca uzun metinlerle kontrol edin.
4. Gerçek Safari'de ilk Tab/harici klavye ile “İçeriğe geç” bağlantısının odağını ayrıca deneyin.
