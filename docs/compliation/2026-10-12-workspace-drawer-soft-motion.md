# Hamburger çekmecesi yumuşak geçiş

2026-10-12 — Oturum içi mobil hamburger çekmecesinin açılma/kapanma animasyonu güncellendi.

## Tamamlanan kapsam

Modal için kullanılan 100 ms zoom/fade yerine soldan **280 ms yavaşlayarak kayma**, kapanırken **200 ms kayma** eklendi. Arka örtü eşzamanlı solar. Yalnız transform ve opacity geçişleri kullanılır; reduced-motion/animasyon kapalı tercihinde anlık olur. Mevcut menü açma koşulları, odak/Escape, rota davranışı ve sürekli görünür mobil navbar korunur.

## Önemli dosyalar

- `frontend/src/components/layout/app-shell.tsx`: çekmece/backdrop sınıfları.
- `frontend/src/components/ui/dialog.tsx`: opsiyonel `overlayClassName`; diğer dialogların varsayılan görünümü değişmez.
- `frontend/src/app/globals.css`: yalnız çalışma alanı drawer/backdrop için Base UI starting/ending-state CSS geçişleri.
- Tasarım kuralları ve web master checklist kapsam notu.

## Komutlar ve sonuçlar

Mevcut `http://localhost:3000` dev sunucusunda, `frontend` içinde:

```powershell
npx.cmd eslint src/components/layout/app-shell.tsx src/components/ui/dialog.tsx
npx.cmd tsc --noEmit
npx.cmd playwright test -c playwright.public.config.ts workspace-mobile-header.spec.ts --grep 'nested language|fullscreen chat' --trace off --output ../tmp/workspace-drawer-motion-results
$env:PLAYWRIGHT_BROWSERS_PATH=(Join-Path (Resolve-Path ../tmp) 'playwright-browsers')
$env:E2E_CROSS_BROWSER='1'
npx.cmd playwright test -c playwright.public.config.ts workspace-mobile-header.spec.ts --project mobile-safari --grep 'nested language|fullscreen chat' --trace off --output ../tmp/workspace-drawer-motion-safari-results
git diff --check
```

- Chromium **2 başarılı**, mobil WebKit **2 başarılı**: nested dil/tema menüsü, Escape/odak dönüşü, rota/geçmiş/resize ve fullscreen chat üzerindeki drawer erişimi. Mevcut açıkça TEST-ONLY REST/WS fixture kullanılır.
- Ek Chromium frame örneklemesi: açılışta ara negatif x konumları mevcut; final x=0, scale=1 ve 0.28 s transition. OS reduced-motion ve uygulama motion-off altında süre 0.00001 s, final x=0. Exit sonrasında DOM kaldırılması da kontrol edildi.
- ESLint, TypeScript ve diff başarılı.

## Açık konular / manuel kontrol

Küçük motion değişikliğinde geniş production build/gate veya gerçek backend login testi çalıştırılmadı. API/ENV/auth/dependency değişikliği yok. Gerçek telefonda giriş yaptıktan sonra hamburger'i açıp kapatın; soldan yavaşlayarak gelmeli, kapanırken biraz daha hızlı gitmelidir. Ayarlar/OS hareket azaltma açıkken anlık geçiş beklenir.
