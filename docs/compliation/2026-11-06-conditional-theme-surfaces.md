# Animasyon seçimine göre renkli çalışma alanı yüzeyleri

## 1. Tamamlanan kapsam

- **Animasyonlu arka plan açık:** önceki görünüm korunur. Tek renk/gradyan buton, kaydırma çubuğu ve diğer vurgu bileşenlerini belirler; nötr sidebar/kart yüzeyleri ve animasyonlu arka plan devam eder.
- **Animasyonlu arka plan kapalı:** tek renk/gradyan arka plan, sidebar, kart/popover, hover/seçim ve border yüzeylerine de uygulanır. Açık/koyu görünüm için farklı yoğunlukta tonlar türetilir; ham hesap renkleri değiştirilmez.
- Gradyanın iki rengi ve açısı arka plan/sidebar/hover için ayrı paint üretir. Tek renk isteyen yüzeylerde iki ucun karışımı kullanılır. İkinci renk yalnız butonlarda kalmaz.
- Yeni yüzeylerde primary, ring ve muted metinler için kontrast uçlarda ve gradyan ara tonlarında kontrol edilir. Semantik success/warning/destructive token'ları değiştirilmez.
- Karar animasyon checkbox'ına bağlıdır. Animasyon açıkken geçici duraklatma, reduced motion veya animationEnabled=false renkli statik moda geçirmez; mevcut animasyon fallback'i korunur.
- Taslaklar görünümü değiştirmez; Kaydet uygular. Ayarlar açıklaması ve checkbox yardımcı metni TR/EN/DE olarak iki davranışı açıklar. Büyük önizleme/hızlı seçim eklenmedi.
- Public/auth kapsamı ve forced-colors görünümü korunur. Renk token'ları mevcut hesap/unmount cleanup'ına dahildir. API, backend, migration, ENV veya browser storage değişikliği yoktur.

## 2. Değişen önemli dosyalar

- `frontend/src/features/settings/theme-colors.ts`: yüzey paleti, iki uçlu paint, yüzeyler üzerinde kontrast ve mevcut apply/clear akışında yeni token'lar.
- `frontend/src/styles/theme-colors.css`: yalnız animasyon checkbox kapalıyken aktif olan semantik yüzey alias'ları, zemin/sidebar ve hover gradyanları; forced-colors kapsamı.
- `frontend/src/features/settings/components/theme-colors-section.tsx`: duruma göre yardımcı metin.
- `frontend/src/i18n/messages/{tr,en,de}.json`: iki davranışın açıklaması.
- `frontend/e2e/theme-colors-logic.spec.ts`, `theme-colors.spec.ts`: palet kontrastı ve kayıtlı checkbox davranışı; eski ham-primary beklentisi okunabilir UI tonu ile güncellendi.
- `.agents/architecture.md`, `.agents/frontend-design-rules.md`, `.agents/web-rules/WEB_SITE_MASTER_CHECKLIST_TR.md`: önceki genel nötr yüzey kararı yeni koşullu kararla güncellendi; yalnız etkilenen checklist kapsamı kaydedildi.

## 3. Çalıştırılan doğrulama komutları

```powershell
# frontend/
npx.cmd tsc --noEmit
npm.cmd run lint
npm.cmd run build
npm.cmd run check:bundle
npm.cmd run dev -- --port 3000
npm.cmd run start -- --port 13000
# Yalnız test komutunun sürecinde E2E_BASE_URL=http://localhost:13000:
npx.cmd playwright test -c playwright.theme.config.ts --output ../.local/theme-surfaces/full-production
npx.cmd playwright test -c playwright.theme.config.ts -g "surfaces follow" --output ../.local/theme-surfaces/conditional-production

# repo kökü
git diff --check
```

Palet saf testleri ve development tema paketi de çalıştırıldı. İlk yeni UI kontrollerinde uygulama/preferences henüz mount olmadan CSS okunması, kayıt yanıtından önce snapshot alınması ve CSS'in `#fff`/`#ffffff` kanonik farkı testleri etkiledi. Testler gerçek kayıtlı palet uygulanmasını ve workspace mount'unu bekleyecek, HEX gösterimini normalize edecek şekilde düzeltildi; son production sonuçları aşağıdadır.

## 4. Test/doğrulama sonuçları

- Son yerel **production Chromium tema paketi 44/44 PASS**: 6 saf sözleşme/palet testi, 38 API-fixture'lı tarayıcı testi. Gerçek hesap/veritabanı değiştirilmedi; bu görevde gerçek API/DB testleri ve backend paketi tekrar çalıştırılmadı.
- Dört yeni Solid/Gradient × light/dark senaryosu hem tam pakette hem ayrı koşuda **4/4 PASS**. Taslak/kayıt, ikinci gradyan ucunun zemin/sidebar'a etkisi, hover, statik↔animasyon geçişi, reload, public cleanup ve forced-colors kapsandı.
- Uç renk çiftleriyle 50 açık/koyu gradyan kombinasyonunda zemin/sidebar/hover ara tonları ve kart yüzeyi üzerinde primary/ring/muted metin kontrastı ≥4.5:1 doğrulandı. Mevcut 256 gri ton, gradient interpolation ve aksiyon kontrast testleri de geçti.
- Sekiz yeni 1440/390 px görünümü üretildi ve incelendi. Mevcut tema paketinde TR/EN/DE, 320/390/768/1440 px, klavye ve scoped Axe kontrolleri geçti; yeni dört senaryoda editor/sidebar için Axe ihlali yoktu.
- Önceki animasyon, gerçek kayıtlı ses, şimşek-ses eşleşmesi, ses yükleme/iptal/temizleme ve reduced-motion senaryoları aynı production paketinde geçti. Bu görev ses/Canvas motorunu değiştirmedi.
- TypeScript, ESLint, normal production build ve whitespace kontrolü geçti. Tüm route bundle bütçeleri korundu; Settings **493.1 / 505 KB gzip**. Bütçe/bağımlılık artırılmadı.
- Yerel backend health **UP**. Normal frontend development sunucusu 3000'de açık bırakıldı; yalnız görev için açılan 13000 production önizleme sunucusu kapatıldı. Backend/DB yeniden başlatılmadı veya değiştirilmedi.
- Git commit/push, pre-push gate veya deployment yapılmadı.

## 5. Açık kalan konular ve doğrulanmayan sınırlar

- Fiziksel mobil cihaz, Safari/Firefox ve screen reader ile manuel kontrol yapılmadı. Chromium emülasyonu bunların yerine geçmez. Sabit CSS gradyanı desteklemeyen tarayıcılar normal scroll davranışına düşebilir.
- Boyamalar açık/koyu görünümde okunaklı türetilmiş tonlardır; ham HEX değerinin tüm yüzeylere aynen basılması değildir. Ham hesap seçimi ve iki gradyan ucu korunur.
- Gerçek API/account persistence sözleşmesi değişmediğinden backend/integration testleri bu teslimde yeniden çalıştırılmadı; UI paketinin API-fixture kapsamı gerçek DB kanıtı olarak sunulmaz.
- Global web checklist tamamlandı sayılmadı; yalnız tema, kontrast, responsive, form ve keyboard/focus açısından etkilenen maddeler gözden geçirildi.

## 6. Kullanıcının manuel kontrol adımları

1. `http://localhost:3000/tr/ayarlar` sayfasında tek renk seçin, animasyonlu arka planı kapatın ve Kaydet'e basın. Görevlerim gibi geniş boşluğu olan bir sayfada zemin, sidebar, kartlar ve hover tonlarını inceleyin.
2. Gradyan seçip birbirinden farklı iki renk belirleyin. Kaydedin; ikinci rengi ve açıyı değiştirerek zemin/sidebar/hover üzerinde iki rengin de etkisini kontrol edin.
3. Animasyonlu arka planı açıp Kaydet'e basın. Zemin animasyonlu, sidebar/kart yüzeyleri önceki nötr görünümde olmalı; seçilen tek renk/gradyan buton ve scroll bar gibi vurgu bileşenlerinde kalmalıdır.
4. Kutuyu tekrar kapatıp kaydedin; renkli yüzeyler geri gelmelidir. Kaydetmeden değiştirip Vazgeç'e bastığınızda uygulanan görünüm aynı kalmalıdır.
5. Açık/koyu/sistem görünümünü, dar ekranı, klavye odağını ve işletim sistemi yüksek kontrast modunu deneyin. Animasyon açıkken yalnız hareketi duraklatmak veya reduced motion kullanmak renkli statik moda geçirmemelidir.
6. Sayfayı yenileyip seçimin korunduğunu, renk sıfırlamada varsayılan SOLID/animasyon kapalı paletinin geldiğini ve çıkış/public sayfada hesap renklerinin temizlendiğini kontrol edin.
