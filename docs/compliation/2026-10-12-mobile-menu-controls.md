# Mobil menü dil ve tema kontrolleri

Tarih: 2026-10-12. Kullanıcının görsel geri bildirimi üzerine küçük takip düzeltmesi.

## Tamamlanan kapsam

- Tema pill'inin grid hücresine yayılıp sağda boş kuyruk oluşturması giderildi. Dil ve tema aynı flex satırında; tema içerik genişliğinde kalır.
- Dil seçimi mobilde bayrak + TR/EN/DE etiketi + caret içerir. İki kontrol 46 px yükseklikte hizalıdır; mobil tema düğmeleri 36 px, mevcut 28 px'ten büyüktür.
- Kontrol satırı bağlantılardan ince ayraçla ayrıldı. Desktop boyutları ve ortak tema/dil davranışı korunur.

## Önemli dosyalar

- `frontend/src/features/landing/landing-page.tsx`
- `frontend/src/features/landing/landing.module.css`
- `frontend/e2e/landing-page.spec.ts`: menü hero başlığını kapatabildiği için dış tıklama gerçek dış gutter koordinatında yapılır; kapanma assertion'ı korunur.
- `.agents/frontend-design-rules.md`, ilgili web checklist notu.

## Komutlar ve sonuçlar

Mevcut geliştirme sunucusu `http://localhost:3001` kullanıldı; `frontend` içinde:

```powershell
npx.cmd eslint src/features/landing/landing-page.tsx e2e/landing-page.spec.ts
$env:E2E_BASE_URL='http://localhost:3001'
npx.cmd playwright test -c playwright.public.config.ts landing-page.spec.ts --grep 'mobile hamburger' --trace off --output ../tmp/landing-menu-polish-results
$env:PLAYWRIGHT_BROWSERS_PATH=(Join-Path (Resolve-Path ../tmp) 'playwright-browsers')
$env:E2E_CROSS_BROWSER='1'
npx.cmd playwright test -c playwright.public.config.ts landing-page.spec.ts --project mobile-safari --grep 'mobile hamburger' --trace off --output ../tmp/landing-menu-polish-safari-results
```

- Chromium: 1 başarılı. Mobil WebKit: 1 başarılı. Menü açma, nested dil menüsü, Escape/odak, gerçek dış tıklama, desktop resize ve giriş rotası doğrulandı.
- ESLint ve `git diff --check`: başarılı.
- 320/390 px koyu ve 390 px açık ekran görüntüleri incelendi. Tema seçici 84×46 px; boş kuyruk yok. Geçici görseller: `tmp/landing-qa/mobile-menu-controls-dark*.png`, `mobile-hamburger.png`.
- İlk dış-tıklama denemesi menünün kapladığı başlığa tıklarken timeout oldu; testin hedefi gerçek dış alanla düzeltildi ve iki tarayıcıda tekrar geçti.

## Açık kalan konular

Bu küçük düzen için önceki geniş 45+8 production paketi veya production build tekrarlanmadı. Önceki kayıttaki mobil WebKit skip-link ilk Tab odağı açık noktası devam eder. ENV, bağımlılık, backend veya ortak ThemeToggle/LocaleSwitcher kaynağı değişmedi.

## Manuel kontrol

`http://localhost:3001/tr/ana-sayfa` üzerinde hamburger'i açıp dil/tema satırını 320 ve 390 px, açık/koyu temalarda kontrol edin. Tema geçişini ve dil menüsünü deneyin.
