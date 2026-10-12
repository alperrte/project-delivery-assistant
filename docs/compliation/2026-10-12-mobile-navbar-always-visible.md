# Mobil navbar sürekli görünür

2026-10-12 — Kullanıcının acil mobil auto-hide kaldırma isteği tamamlandı.

## Kapsam ve önemli dosyalar

- `frontend/src/components/layout/use-auto-hide.ts`: auto-hide yalnız >=1024 px, hover/fine-pointer desktop'ta aktif. Mobil/tablet/touch cihazlarında idle/scroll/focus navbar'ı gizlemez; desktop → mobile resize gizli navbar'ı açar.
- `frontend/e2e/{workspace-mobile-header,navbar-auto-hide}.spec.ts`: yeni sürekli görünürlük beklentileri.
- Tasarım kuralları ve checklist kapsam notu güncellendi. Navbar boyut/reserve, ENV ve API/security sözleşmeleri değişmedi.

## Komutlar ve sonuçlar

`frontend` içinde güncel dev sunucusu `http://localhost:3001` kullanıldı:

```powershell
npx.cmd tsc --noEmit
npx.cmd eslint src/components/layout/use-auto-hide.ts e2e/workspace-mobile-header.spec.ts e2e/navbar-auto-hide.spec.ts
$env:E2E_BASE_URL='http://localhost:3001'
npx.cmd playwright test -c playwright.public.config.ts workspace-mobile-header.spec.ts --grep 'stays visible after idle' --trace off --output ../tmp/navbar-always-visible-results
$env:PLAYWRIGHT_BROWSERS_PATH=(Join-Path (Resolve-Path ../tmp) 'playwright-browsers')
$env:E2E_CROSS_BROWSER='1'
npx.cmd playwright test -c playwright.public.config.ts workspace-mobile-header.spec.ts --project mobile-safari --grep 'stays visible after idle' --trace off --output ../tmp/navbar-always-visible-safari-results
git diff --check
```

Chromium **1 başarılı**, dokunmatik mobil WebKit **1 başarılı**: 390/768 px bekleme/kaydırma, drawer/focus, 1440 px desktop auto-hide/touch görünürlüğü ve mobile resize. Mevcut açıkça TEST-ONLY API fixture kullanılır. TypeScript, ESLint ve diff başarılı. İlk yanlış porta giden deneme eski 3000 build'ini test etti; güncel 3001 kaynakla iki koşum geçti.

## Açık konular ve manuel kontrol

Küçük düzeltmede production build/geniş backendli gate tekrarlanmadı; gerçek hesaplı eski touch dosyası bu turda çalıştırılmadı. Telefonda bir iç sayfa açıp bekleyin ve aşağı/yukarı kaydırın: navbar sürekli görünür kalmalıdır. Mevcut 3000 production sunucusu yeniden derlenmeden kaynak değişikliğini göstermez; güncel dev sunucusu 3001'dir.
