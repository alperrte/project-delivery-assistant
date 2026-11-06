# Tema gradyanı, kontrol konumu ve animasyon editörü

## 1. Tamamlanan kapsam

- Hareket/ses kontrolleri sayfanın en sağ üst köşesine, 8 px inset ile alındı. Absolute konumları belgeye bağlıdır; scroll sırasında takip etmez, sayfayla birlikte ekran dışına çıkar. Grup ve düğmelerin kutusu/zemini/border'ı kaldırıldı. Görünen ikonlar 20→14 px, masaüstü hedefleri 44→32 px oldu. Dokunmatik hedef 44 px korunur. Dar ekranlarda navbar için ayrı alan vardır; çakışma yoktur. Erişilebilir eylem adları, title, toggle ve sesin gesture kuralı korunur.
- Gradyan yalnız butonlarda değildir: primary dolgu/avatarlarda, seçili radio/checkbox'ta, seçim satırlarında, navigasyon işaretinde, primary metin/SVG ikonlarda, range izlerinde ve destekleyen tarayıcıların scrollbar thumb'ında iki renk görünür. Açı hesaptaki değerden alınır. Stroke SVG'ler fill'e dönüştürülmez.
- Açık/koyu accent uçları ayrı türetilir; koyu temada aradaki sRGB tonlarının kontrastı korunur. Renk isteyen native kontroller ve scrollbar fallback'i iki uçtan türetilir; artık yalnız ilk renk değildir. Odak rengi ikinci uçtan gelir. Ham HEX'ler, sayfa/sidebar yüzeyleri ve semantik durum renkleri değişmez.
- Animasyonlu seçenekte büyük canlı/sessiz önizleme kaldırıldı; dört statik kart kaldı. Animasyon açık / Tema sesi açık checkbox'ları yan yana iki sütundadır. Ses seviyesi ince doluluk izi, küçük thumb, ses ikonları ve düzenlenebilir yüzde değeriyle yenilendi. Native range klavyesi, 0–100 tamsayı doğrulaması ve kayıt/reset korunur. TR/EN/DE metinleri uyarlandı.

## 2. Değişen önemli dosyalar

- `frontend/src/features/settings/theme-colors.ts`: iki uç, ara ton kontrastı, karışık native fallback ve paint token'ları.
- `frontend/src/features/settings/effects/theme-effects.tsx`: küçük/zeminsiz kontroller ve gradient SVG paint tanımı.
- `frontend/src/features/settings/components/animated-theme-editor.tsx`: önizleme kaldırma, checkbox ve ses seviyesi düzeni.
- `frontend/src/styles/theme-colors.css`; `frontend/src/components/layout/app-header.tsx`: konum/gradient/slider ve dar ekran header uyumu.
- `frontend/src/i18n/messages/{tr,en,de}.json`; `e2e/theme-animation.spec.ts`, `e2e/theme-colors-logic.spec.ts`.
- Mimari kısa özet, frontend tasarım kuralları ve master checklist'in ilgili kapsam notu.

Önceki tema sadeleştirmesi ve siyah wrapper düzeltmeleri korunur; bu kayıt sonraki gradyan/kontrol/önizleme kararlarını açıklar. Backend, API, ENV, migration, bağımlılık ve browser storage sözleşmesi değişmedi.

## 3. Çalıştırılan doğrulama komutları

Frontend dizininde:

```powershell
npx.cmd tsc --noEmit
npx.cmd eslint src/features/settings/components/animated-theme-editor.tsx src/features/settings/effects/theme-effects.tsx src/features/settings/theme-colors.ts src/components/layout/app-header.tsx e2e/theme-animation.spec.ts e2e/theme-colors-logic.spec.ts
npx.cmd playwright test --config playwright.theme.config.ts --output ../.local/theme-accent-refinement/final-editor --max-failures=1
```

Repo kökünde:

```powershell
node .local/theme-accent-refinement/verify.cjs
git diff --check
```

Ignored doğrulama yardımcısı mevcut Playwright ve sentetik tema fixture'ını kullanır. Gerçek kullanıcı tercihleri değiştirilmez; gerçek development arayüzünde çalışır.

## 4. Test/doğrulama sonuçları

- **27/27 tema testi PASS, 0 skip**: 4 saf sözleşme/kontrast + 23 API-fixture'lı tarayıcı testi. Eski önizleme beklentileri kaldırıldı; kart seçimi ve editörde Canvas bulunmaması doğrulanır. İki uçlu fallback ve dört uç çifti için açık/koyu temada 101 ara noktanın en az 4.5:1 kontrastı denetlendi.
- **13 ek senaryo PASS**: 320/390/768/1440 px × light/dark köşe yerleşimi, scroll takip etmeme, şeffaf/bordersız 14 px ikonlar, header çakışmaması, Canvas bulunmaması ve yan yana checkbox'lar. Kayıtlı gradyanda radio/avatarda ve scrollbar'da gradient paint; ikinci uç değişince paint/fallback güncellenmesi ve ana yüzeyin değişmemesi doğrulandı. İki kaydedilmiş gradyan Axe kontrolü, forced-colors native fallback ve coarse pointer'da 44 px hedef/14 px ikon kontrolü geçti. Ses slider'ı Home/End ile 0/100 değerlerine ulaştı.
- TypeScript, hedefli ESLint ve diff temiz. Autoplay/visibility/motion/ses kaynak temizliği regresyonları 27 testin içindedir.
- Görüntüler `.local/theme-accent-refinement/` altında Git dışındadır. Koyu masaüstü/mobil köşe konumu, gradyan ve açık/koyu ses editörü görüntüleri incelendi. İlk geçici stil kontrolündeki mutation yanıtı yarışı, yeni paint'i bekleyerek giderildi; başarılı koşu son UI üzerindedir.

## 5. Açık kalan konular ve doğrulanmayan sınırlar

Kabul development Chromium ve sentetik API fixture'ları üzerindedir; fiziksel cihaz, Safari/Firefox veya gerçek hesap/API kabulü değildir. WebKit scrollbar pseudo desteği olmayan tarayıcıların native scrollbar'ında ve native accent-color isteyen alanlarda iki rengin erişilebilir karışımı kullanılır; bu CSS color özellikleri gradyan kabul etmez.

Production build/bundle, backend testleri, gerçek PostgreSQL, tam uygulama E2E ve pre-push yeniden çalıştırılmadı. Commit/push yapılmadı. Yerel frontend/backend/LiveKit servisleri açık bırakıldı.

## 6. Kullanıcının manuel kontrol adımları

1. Sayfayı yenileyin. Animasyonlu temada en sağ üstte küçük ve zeminsiz ikonları görün; kaydırınca ekranı takip etmemeliler. Hareket/ses toggle'larını klavyeyle de deneyin.
2. Ayarlar'da Animasyonlu'yu seçin. Kartların altında büyük önizleme bulunmamalı; iki checkbox yan yana olmalı. Kaydırıcı/yüzde, Kaydet/Vazgeç ve 0/100 uçlarını deneyin.
3. Gradyanı iki belirgin renkle kaydedin. Aksiyon, avatar/seçim, range ve scrollbar'da iki rengi kontrol edin. Yalnız ikinci rengi değiştirip kaydedin; vurgu değişmeli, sayfa/sidebar yüzeyi aynı kalmalıdır.
4. Açık/koyu, dar ekran navbar, Tab/focus ve yüksek kontrast görünümünü kontrol edin. Native scrollbar farkları yukarıdaki sınırlarla değerlendirilmelidir.
