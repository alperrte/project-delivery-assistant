# Animasyon açıkken renkli sidebar

## 1. Tamamlanan kapsam

Animasyonlu arka plan açıkken de sidebar seçilen tek renk/gradyan paletini kullanır. Sidebar hover/seçim ve muted metin tonları yerel olarak uyarlanır. Mobil açılır gezinme menüsü aynı renkleri kullanır. Ana zemin, kartlar ve diğer içerik yüzeyleri önceki animasyonlu/nötr davranışını korur.

Animasyon kapalıyken önceki renkli çalışma alanı davranışı devam eder. Public sayfalar ve forced-colors kapsamı korunur. API/backend/ENV/storage değişikliği yoktur. Bu karar önceki `2026-11-06-conditional-theme-surfaces.md` kaydındaki animasyon açıkken nötr sidebar davranışının yerini alır.

## 2. Değişen önemli dosyalar

- `frontend/src/styles/theme-colors.css`: animasyon açıkken masaüstü sidebar ve portal mobil gezinme menüsüne özgü yüzey/hover alias'ları ve gradyan.
- `frontend/src/i18n/messages/{tr,en,de}.json`: sidebar'ın da renklendiğini açıklayan metinler.
- `frontend/e2e/theme-colors.spec.ts`: ana yüzeylerin nötr kalması, renkli sidebar, mobil menü, hover, Escape ve Axe kontrolleri.
- İlgili mimari/tasarım ve scoped web checklist takip notları. Önceki teslimin mevcut uncommitted değişiklikleri korunmuştur.

## 3. Çalıştırılan doğrulama komutları

```powershell
# frontend/
npx.cmd playwright test -c playwright.theme.config.ts -g "surfaces follow" --output ../.local/theme-animated-sidebar/final
npx.cmd tsc --noEmit
npx.cmd eslint e2e/theme-colors.spec.ts
npm.cmd run build
npm.cmd run check:bundle
# repo kökü
git diff --check
```

## 4. Test/doğrulama sonuçları

- Solid/Gradient × light/dark hedefli tarayıcı senaryoları **4/4 PASS**. Masaüstü ve mobil sidebar renkleri eşleşiyor; ana zemin/kartlar nötr kalıyor; animasyon açık/kapalı geçişleri, reload, public cleanup ve forced-colors kontrolleri geçiyor.
- Sidebar ve mobil menü scoped Axe kontrollerinde ihlal yok; mobil menü Escape ile kapanıyor. Açık/koyu gradyan masaüstü ve mobil görüntüleri incelendi.
- TypeScript, hedefli ESLint, production build, tüm route bundle bütçeleri ve whitespace kontrolü PASS. Settings yaklaşık **493.1/505 KB gzip**.
- Testler API fixture kullanır; gerçek hesap veya DB değiştirilmedi. Önceki tam tema paketi bu küçük takip değişikliğinde baştan çalıştırılmadı; bu kaydın kanıtı hedefli dört senaryodur.

## 5. Açık kalan konular ve doğrulanmayan sınırlar

Fiziksel mobil cihaz, Safari/Firefox ve screen reader ile manuel kontrol yapılmadı. Backend/API sözleşmesi değişmediğinden backend testleri tekrar çalıştırılmadı. Commit/push, pre-push veya deployment yapılmadı.

## 6. Kullanıcının manuel kontrol adımları

1. Ayarlar'da tek renk veya iki farklı gradyan rengi seçin; animasyonlu arka planı açık tutup Kaydet'e basın.
2. Sidebar'ın seçilen paleti kullandığını, hover/seçim tonlarının uyduğunu ve ana içerik/kartların animasyonlu görünümünü koruduğunu kontrol edin.
3. Açık/koyu görünümde ve mobil menüyü açarak deneyin. Animasyon checkbox'ını kapatıp kaydedince önceki tüm çalışma alanını renklendiren davranış devam etmelidir.
