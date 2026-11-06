# Animasyonlu tema ikon kontrolleri

## 1. Tamamlanan kapsam

Metinli geçici tema kontrolleri mevcut Phosphor ikonlarıyla değiştirildi. Kullanıcının istediği durum gösterimi uygulandı: hareket çalışırken oynatma, durduğunda duraklatma ikonu; ses açıkken ses, kapalıyken sessiz ikonu. Her basış ilgili durumu değiştirir. Erişilebilir ad/title yapılacak eylemi belirtir. Düğmeler 44×44 px, klavyeyle kullanılabilir, ikonlar dekoratif ve toggle durumu aria-pressed ile açıklanır. Ses başlatma sırasında spinner ve aria-busy gösterilir. Kullanıcı etkileşimi olmadan ses başlatılmaz.

## 2. Değişen önemli dosyalar

`frontend/src/features/settings/effects/theme-effects.tsx`; frontend tasarım kuralları ve master checklist'in ilgili kapsam notu. Backend/ENV/bağımlılıklar ve kalıcı tercihler değişmedi.

## 3. Çalıştırılan doğrulama komutları

Frontend dizininde `npx.cmd tsc --noEmit`, `npx.cmd eslint src/features/settings/effects/theme-effects.tsx` ve `npx.cmd playwright test --config playwright.theme.config.ts theme-animation.spec.ts --output ../.local/theme-icon-controls/results --max-failures=1`.

Repo kökünde `node -` ile mevcut fixture üzerinde ek klavye/ses kontrolü ve iki durum ekran görüntüsü; `git diff --check`.

## 4. Test/doğrulama sonuçları

13/13 animasyon testi PASS. Ses başlat/durdur, visibility/cleanup, reduced motion/global off, geçici pause/resume, TR/EN/DE mobil/masaüstü ve scoped Axe kontrolleri geçti. Ek tarayıcı kontrolünde Space ile hareket durduruldu, ses düğmesiyle gerçek Web Audio başlatıldı ve aria-pressed doğrulandı. Hareket açık/ses kapalı ve hareket duraklatılmış/ses açık ikon görüntüleri `.local/theme-icon-controls/` altında incelendi. TypeScript/lint/diff temiz.

## 5. Açık kalan konular ve doğrulanmayan sınırlar

Doğrulama development Chromium ve sentetik API tercihleri üzerindedir; gerçek kullanıcı hesabına yazılmadı. Production build, tüm E2E, backend testleri veya pre-push tekrarlanmadı. Fiziksel mobil/screen reader kabulü değildir. Commit/push yapılmadı; geliştirme servisleri açık bırakıldı.

## 6. Kullanıcının manuel kontrol adımları

Sayfayı yenileyip animasyonlu temada sağ üstteki oynatma ikonuna basın: duraklatma ikonuna dönüşmeli ve hareket durmalıdır. Tekrar basınca oynatma ikonu ve hareket dönmelidir. Ses tercihinin açık olduğu durumda sessiz ikonuna basarak sesi başlatın; ses ikonuna tekrar basarak kapatın. Fareyle bekleyince açıklamayı, Tab ve Space/Enter ile kullanımı kontrol edin.
