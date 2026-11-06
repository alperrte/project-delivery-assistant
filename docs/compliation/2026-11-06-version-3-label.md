# Görünen PDA sürümü: 3

## 1. Tamamlanan kapsam
Güncel `general-features` branchinde footer ve sidebar'ın ortak sürüm etiketi `2.9.9` yerine `3` oldu; görünür etiket `v3`.

## 2. Değişen önemli dosyalar
`frontend/src/features/public-info/site-info.ts`: ortak `APP_VERSION` sabiti. Paket/API sürümleri değiştirilmedi.

## 3. Çalıştırılan doğrulama komutları
`rg -n 'APP_VERSION' frontend/src/components/layout/app-shell.tsx frontend/src/components/layout/site-footer.tsx frontend/src/features/public-info/site-info.ts` ve `git diff --check`.

## 4. Test/doğrulama sonuçları
Footer ve sidebar'ın aynı sabiti kullandığı kaynak koddan doğrulandı; whitespace kontrolü geçti. Tek sabit metin değişikliği için test/build çalıştırılmadı.

## 5. Açık kalan konular ve doğrulanmayan sınırlar
Tarayıcıda görsel kontrol yapılmadı. Commit/push veya deployment yapılmadı.

## 6. Kullanıcının manuel kontrol adımları
Sayfayı yenileyip footer ve sidebar'da `v3` göründüğünü kontrol edin.
