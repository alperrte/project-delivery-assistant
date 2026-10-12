# Oturum içi mobil navbar

Tarih: 2026-10-12. Kullanıcının mobil iç sayfa navbar kullanılabilirliği düzeltmesi tamamlandı.

## Tamamlanan kapsam

- 640 px altında iki satırlı 112 px navbar yerine **56 px tek satır**: hamburger, PDA logosu, arama, bildirim ve hesap. Etkileşim hedefleri en az 44 px.
- Dil/tema ve native geri/ileri mevcut AppShell çekmecesine taşındı. Ayrı navigasyon sistemi eklenmedi; mevcut ortak component'ler ve tercih/oturum sözleşmesi korunur.
- Çekmece Escape ile odak döndürür, link seçimi veya güvenli history traversaliyle kapanır; sm breakpoint'ine geçince kapanır. Alt safe-area boşluğu vardır. Nested dil menüsünde ilk Escape yalnız iç menüyü kapatır.
- Main ve tam ekran sohbet aynı reserve'i kullanır: telefonlarda **128 → 80 px**, sm üstünde 72 px. Desktop navbar merkez/hizalama/boyutları korunur. Landing gerçek UI demosunun kamera inset'i artık main'in gerçek padding'ini okur.
- Mobil arama açıkça kapatılabilir; 44 px kapatma düğmesi ve Escape odağı arama tetikleyicisine döndürür. Dış tıklama sorgu varken de paneli kapatır; sonuç paneli viewporta sığar.
- Mevcut 700 ms auto-hide, focus/popup/drawer koruması korunur. Hamburger ve history kontrolleri fullscreen chat'in inert içerik alanı dışındadır.

## Değişen önemli dosyalar

- `frontend/src/components/layout/{app-header,app-shell,global-search,workspace-history-controls}.tsx`
- `frontend/src/app/globals.css`
- `frontend/src/features/landing/demo/pda-demo-workspace.tsx`
- Yeni `frontend/e2e/workspace-mobile-header.spec.ts`; güncellenen `workspace-history.spec.ts` ve `playwright.public.config.ts`
- `.agents/{architecture,folder-structure,frontend-design-rules}.md`, web master checklist kapsam notu.

## Komutlar ve sonuçlar

`frontend` içinde:

```powershell
npx.cmd tsc --noEmit
npx.cmd eslint src/components/layout/app-header.tsx src/components/layout/app-shell.tsx src/components/layout/global-search.tsx src/components/layout/workspace-history-controls.tsx src/features/landing/demo/pda-demo-workspace.tsx e2e/workspace-mobile-header.spec.ts e2e/workspace-history.spec.ts playwright.public.config.ts
npm.cmd run build
npm.cmd run start
$env:E2E_REUSE_AUTH='1'
npx.cmd playwright test workspace-mobile-header.spec.ts native-history.spec.ts landing-page.spec.ts landing-real-ui.spec.ts --trace off --output ../tmp/workspace-mobile-production-results
$env:PLAYWRIGHT_BROWSERS_PATH=(Join-Path (Resolve-Path ../tmp) 'playwright-browsers')
$env:E2E_CROSS_BROWSER='1'
npx.cmd playwright test -c playwright.public.config.ts workspace-mobile-header.spec.ts --project mobile-safari --trace off --output ../tmp/workspace-mobile-safari-production-final
git diff --check
```

- TypeScript, hedefli ESLint, production build ve diff: başarılı.
- Production Chromium: **38 başarılı** (28 landing/gerçek component regresyonu, 2 native history kontrolü, 8 yeni çalışma alanı UI testi).
- Production dokunmatik iPhone profilli WebKit: **8 başarılı**.
- TR/EN/DE × light/dark × 320/390/640/768/1024/1440 px: header merkez/hit-area/çakışma/taşma, drawer görünürlüğü ve main reserve kontrolleri geçti. Popup/arama, tema, nested dil menüsü, Escape/focus, rota/resize/native back, unsupported history, idle/drawer hold ve fullscreen chat üst boşluğu/inert sınırı doğrulandı.
- Ekran görüntüleri `tmp/workspace-mobile-header/` altında incelendi. Tüm bu çalışma alanı senaryolarında API ve WebSocket yanıtları açıkça **TEST-ONLY fixture**; gerçek UI/sunucu render'ı çalışır, gerçek backend hesabı kullanılmaz. Native adapter testi gerçek tarayıcı history entry'leriyle çalışır.
- İlk production WebKit denemesinde service worker sayfa routing fixture'ını bypass edip gerçek 401 yanıtına gidiyordu. Yalnız yeni sunum testleri `serviceWorkers: "block"` kullanacak şekilde düzeltildi; uygulamanın worker/auth/security kodu değiştirilmedi. Son 8 testin hepsi geçti.
- `workspace-history.spec.ts` eski 112/128 px mobil beklentileri 56/80 px ve drawer history erişimine güncellendi. Gerçek backend hesaplı bu eski integration dosyası bu görevde çalıştırılmadı; yerleşim yeni chat fixture testiyle doğrulandı.

## Açık kalan konular

- Gerçek telefon/Safari ve gerçek hesaptaki proje/sohbet verileriyle manuel kontrol önerilir. WebKit testi gerçek iOS cihazı değildir.
- Backend hesaplı tüm authenticated paket, genel pre-push ve deployment çalıştırılmadı. Global responsive/erişilebilirlik checkbox'ları bu sınırlı kapsamla tamamlanmış sayılmaz.
- Önceki landing skip-link mobil WebKit Tab odağı açık noktası bu görevin kapsamı değildir.
- ENV, dependency, backend/API, auth/cookie/CSRF/CORS veya migration değişikliği yok.
- `docs/compliation/README.md` bu kopyada bulunmadığından AGENTS.md'nin istediği kapsam/dosya/komut/sonuç/açık konu/manuel kontrol bölümleri kullanıldı.

## Kullanıcının manuel kontrol adımları

1. Normal geliştirme ortamında giriş yapıp 320/390 px veya telefonda bir iç sayfayı açın. Üst çubuk tek satır olmalıdır.
2. Hamburger'i açıp proje/görev navigasyonu, dil, tema ve geri/ileri kontrollerini deneyin. Escape sonrası odak hamburger'e dönmelidir.
3. Aramayı açıp kapatın; bildirim ve hesap menülerinin ekran içinde kaldığını kontrol edin.
4. Projede tam ekran sohbet açın: navbar ve hamburger erişilebilir kalmalı, sohbet navbar'ın altında başlamalıdır.
5. Desktop'ta sidebar'ı daraltıp genişletin; navbar viewport merkezinde kalmalıdır.
