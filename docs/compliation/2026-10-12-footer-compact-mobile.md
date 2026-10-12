# Mobil footer kompakt düzen

Tarih: 2026-10-12. Kullanıcının satır/hizalama düzeltmesi tamamlandı.

## Tamamlanan kapsam

- İki GitHub hesabı aynı satırda yan yana.
- İletişim bağlantısı ve e-posta aynı satırda; e-posta mobilde 12 px, sm üstünde mevcut 14 px.
- Kaynak kod/lisans satırı ve altındaki telif/sürüm satırı ortalandı.
- Üst/alt padding, ayraç aralığı ve alt blok boşlukları azaltıldı. 390 px Türkçe footer yüksekliği 386 px olarak ölçüldü. 44 px link hedefleri ve tüm link içerikleri korunur.

## Önemli dosyalar

- `frontend/src/components/layout/site-footer.tsx`
- `.agents/frontend-design-rules.md`
- `.agents/web-rules/WEB_SITE_MASTER_CHECKLIST_TR.md`

## Doğrulama komutları ve sonuçları

`frontend` içinde mevcut `http://localhost:3001` dev sunucusuyla:

```powershell
npx.cmd eslint src/components/layout/site-footer.tsx
$env:E2E_BASE_URL='http://localhost:3001'
npx.cmd playwright test -c playwright.public.config.ts footer-public-pages.spec.ts --grep 'mobile footer|footer shows the release version|footer links open' --trace off --output ../tmp/footer-compact-results
$env:PLAYWRIGHT_BROWSERS_PATH=(Join-Path (Resolve-Path ../tmp) 'playwright-browsers')
$env:E2E_CROSS_BROWSER='1'
npx.cmd playwright test -c playwright.public.config.ts footer-public-pages.spec.ts --project mobile-safari --grep 'mobile footer.*tr$' --trace off --output ../tmp/footer-compact-safari-results
git diff --check
```

- Chromium: **7 başarılı**, 0 başarısız. TR/EN/DE, light/dark, 320/390/768/1440 px; landing/login/about footer taşma/44 px hedefler, bilgi/katılımcı bağlantıları ve sayfa türleri boyunca sürüm kontrolü.
- Dokunmatik iPhone profiliyle mobil WebKit: **1 başarılı**, 0 başarısız; Türkçe iki tema/dört genişlik/üç sayfa türü matrix.
- ESLint ve diff kontrolü başarılı.
- 320/390 px koyu tema ekran görüntüleri incelendi: `tmp/landing-qa/footer-compact-dark-{320,390}.png`. 390 px DOM geometrisi iki GitHub linkinin ve iletişim/e-postanın aynı satırda olduğunu doğruladı.

## Açık kalan konular

Bu küçük yerleşim değişikliğinde geniş production build/gate tekrarlanmadı. Önceki mobil WebKit skip-link Tab odağı açık noktası değişmedi. Backend, ENV, bağımlılık veya güvenlik sözleşmesi değişmedi; genel responsive/erişilebilirlik checkbox'ları tamamlanmış sayılmadı.

## Manuel kontrol

`http://localhost:3001/tr/ana-sayfa` altında footer'ı 320/390 px ve gerçek telefonda inceleyin: iki GitHub hesabı, iletişim/e-posta yan yana; kaynak kod/lisans/sürüm ortalı olmalıdır. Dil ve tema değiştirip satır kırılmasını kontrol edin.
