# Navbar arama placeholder düzeltmesi

## 1. Tamamlanan kapsam
Navbar'daki uzun placeholder yerine mevcut çevirilerden kısa `Ara… / Search… / Suche…` gösterilir. Sayfa/proje/organizasyon kapsamı gizli açıklama ve `aria-describedby` ile korunur; arama davranışı değişmez. Boş input'taki gereksiz sağ boşluk azaltıldı; yazı varsa temizleme düğmesinin alanı korunur. 1280 px altındaki header'da hesap adı yerine avatar gösterilerek arama alanının sıkışması önlenir; geniş ekranlarda ad görünür.

## 2. Değişen önemli dosyalar
`frontend/src/components/layout/global-search.tsx`, `app-header.tsx`; ilgili frontend tasarım ve scoped checklist notları. Yeni API/ENV/bağımlılık yoktur.

## 3. Çalıştırılan doğrulama komutları
```powershell
# repo kökü, ignored yerel Chromium ölçüm betiği
node .local/navbar-placeholder/check.cjs
# frontend/
npx.cmd eslint src/components/layout/global-search.tsx src/components/layout/app-header.tsx
npx.cmd tsc --noEmit
npx.cmd playwright test -c playwright.public.config.ts workspace-mobile-header.spec.ts -g "mobile search, notification" --output ../.local/navbar-placeholder/mobile
# repo kökü
git diff --check
```

## 4. Test/doğrulama sonuçları
TR/EN/DE × 640/768/1024/1440/1920 px: **15/15 PASS**. Uzun hesap adı ve iki haneli bildirim sayacıyla, fontlar yüklendikten sonra metin genişliği input'un padding sonrası kullanılabilir alanıyla karşılaştırıldı. Masaüstü görüntüsü incelendi. Mevcut mobil arama açma, odak, kapatma, klavyeyle sonuç seçimi ve diğer popup senaryosu **1/1 PASS**. TypeScript, hedefli ESLint ve whitespace kontrolü temiz.

## 5. Açık kalan konular ve doğrulanmayan sınırlar
Chromium development üzerinde API fixture kullanıldı; gerçek hesap değiştirilmedi. Fiziksel mobil, Firefox/Safari ve screen reader ile manuel kontrol yapılmadı. Küçük metin/yerleşim değişikliğinde tam test paketi veya production build çalıştırılmadı. Commit/push/deployment yapılmadı.

## 6. Kullanıcının manuel kontrol adımları
Navbar'ı yenileyip `Ara…` metninin tam göründüğünü kontrol edin. Tablet genişliğinde avatar menüsünü, geniş ekranda hesap adını inceleyin. Aramaya yazıp temizlemeyi ve mobil arama düğmesini deneyin.
