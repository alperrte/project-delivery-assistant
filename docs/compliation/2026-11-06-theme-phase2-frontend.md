# Faz 2 Frontend — Animasyonlu temalar

Tarih: 2026-11-06. Kapsam: kullanıcı tarafından onaylanan Aşama 4 / Faz 2 Frontend. Çalışma mevcut `theme-service-frontend` branch'inde yapıldı; branch değiştirilmedi. Commit, push, pre-push veya deployment yapılmadı.

## 1. Tamamlanan kapsam

- Mevcut Solid/Gradient editörüne **Animasyonlu** kategorisi ve yalnız dört tema eklendi: **Gök gürültülü fırtına, Yağmur, Kar, Su**. Her kartın adı, kısa açıklaması ve statik SVG önizlemesi var; seçili temanın canlı önizlemesi sessizdir. TR/EN/DE desteklenir.
- Renkler ve `themeAnimation` aynı hesap taslağında Kaydet/Vazgeç akışını kullanır. Animasyon preset'i, ses açık/kapalı, 0–100 tamsayı ses seviyesi ve animasyon açık/kapalı backend'e kaydedilir. Tema reset'i renk ve animasyon nesnelerini birlikte varsayılana alır; ilgisiz ayar taslakları korunur. Hatalı/eksik API nesnesi güvenli varsayılana döner; geçersiz seviye kaydedilemez.
- AppShell'de hesap kimliğine bağlı tek efekt sahibi kullanılır. Sahne yalnız korumalı çalışma alanındadır; public/auth ve contained landing demo efekt çalıştırmaz. Solid/Gradient tercihlerindeki ham renkler korunur; önceki semantik renk/kontrast türetmesi devam eder.

### Animasyon ve sesin çalışma şekli

- **Yağmur:** farklı hız, boy ve konumlarda eğik damlalar; filtrelenmiş yumuşak yağmur ambiyansı.
- **Gök gürültülü fırtına:** yağmur, küçük/düşük opaklıklı lokal şimşek ve gecikmeli derin gök gürültüsü. İlk olay yaklaşık 12–16 sn, sonraki olaylar 18–32 sn aralığındadır; ses yaklaşık 0.5–1.5 sn gecikir. Tam ekran strobe yoktur. Görsel hareket kapalıyken sesin bağımsız seyrek gök gürültüsü zamanlayıcısı vardır.
- **Kar:** yavaş, farklı boyut ve salınımlı taneler; alçak frekanslı, yavaş dalgalanan kış rüzgârı.
- **Su:** yumuşak dalga bantları; dalgalanan su ambiyansı ve düzensiz kabarcık sesleri.
- Canvas render döngüsü React state güncellemez; en çok 30 FPS, önizlemede 24, dar sahnede 32, masaüstünde 72 parçacık ve en çok 1–1.5 DPR kullanır. Gizli sekme, animasyon kapalı, global hareket kapalı, OS reduced-motion veya geçici duraklatma durumunda RAF/observer temizlenir; statik zemin kalır. Efekt pointer-events almaz; içerik opak yüzeylerde okunur.
- Sesler **özgün prosedürel Web Audio** ile yerelde üretilir; medya dosyası, harici servis/istek veya yeni bağımlılık yoktur. Varsayılan ses kapalı, seviye 50'dir. Kayıtlı ses açık olsa bile yalnız **Sesi başlat** düğmesine açık kullanıcı etkileşimiyle tek AudioContext oluşturulur. Sayfa yükleme, Kaydet veya rastgele bir sayfa tıklaması ses başlatmaz.
- Header altındaki geçici araç çubuğu sesi başlatır/durdurur ve hareketi duraklatır/sürdürür. Bunlar oturum içidir; kalıcı açık/kapalı seçenekler Ayarlar'dadır. Önizleme hiçbir zaman ses çalmaz. Sesin kullanılamadığı tarayıcıda tekrar deneme mesajı gösterilir.
- Preset değişiminde eski node/source/timer'lar kapatılır ve tek context kullanılır. Solid/Gradient, ses kapalı, gizli sekme, OS ses kesintisi, unmount/çıkış/hesap değişiminde context dahil kaynaklar kapanır. Sekmeye dönüş/reload kendiliğinden ses başlatmaz. Yeni browser storage anahtarı yoktur.

## 2. Değişen önemli dosyalar

- `frontend/src/features/settings/theme-animation.ts`: tipler, varsayılan, strict normalizasyon ve eşitlik.
- `frontend/src/features/settings/effects/{theme-scene.tsx,ambient-audio.ts,theme-effects.tsx}`: Canvas, prosedürel ses ve hesap/görünürlük/hareket yaşam döngüsü.
- `frontend/src/features/settings/components/{animated-theme-editor.tsx,theme-colors-section.tsx,settings-page.tsx}`: kartlar, kontroller, önizleme, taslak/kayıt/reset.
- Mevcut `features/settings/api.ts`, `theme-colors.ts`, `components/layout/app-shell.tsx`, `styles/theme-colors.css` ve `i18n/messages/{tr,en,de}.json` genişletildi.
- `frontend/e2e/theme-animation.spec.ts`, ortak `theme-fixture.ts`, mevcut `theme-colors{,-logic,-real}.spec.ts` ve `playwright.theme.config.ts`.
- `.agents/architecture.md`, `folder-structure.md`, `frontend-design-rules.md` ve web master checklist'in yalnız etkilenen kapsam notu güncellendi; global kutular topluca işaretlenmedi.

Backend kaynakları, migration, güvenlik mimarisi, endpoint'ler, ENV dosyaları, package manifest/lock değişmedi. Kullanılan mevcut sözleşme: cookie/CSRF korumalı GET/PUT `/api/v1/users/me/preferences` ve DELETE `/api/v1/users/me/preferences/theme`. Sözleşme ve Swagger kontrol yolu için [Faz 2 Backend teslimi](2026-11-06-theme-phase2-backend.md) ve `.agents/SECURITY.md` §11 geçerlidir.

## 3. Çalıştırılan doğrulama komutları

Frontend dizininde:

```powershell
npm.cmd run lint
npx.cmd tsc --noEmit
npm.cmd run build
npm.cmd run start -- --hostname 127.0.0.1 --port 3000
npm.cmd run check:bundle
$env:THEME_REAL_API='1'
npx.cmd playwright test --config playwright.theme.config.ts --output ../.local/theme-phase2-frontend/results --max-failures=1
$env:E2E_REUSE_AUTH='1'
npx.cmd playwright test e2e/motion-preferences.spec.ts --grep 'settings show only'
```

Repo kökünde `git diff --check` çalıştırıldı. Gerçek API kabulünde önceki fazın ignored `.local/theme-phase1-frontend/serve-api.ps1` yardımcısı kullanıldı: yalnız `pda.qa=theme-phase1-frontend` etiketi doğrulanan disposable PostgreSQL 18, test kullanıcıları, mevcut cookie/CSRF API ve yerel backend. Test altyapısı üretim/kullanıcı veritabanına bağlanmadı; gerçek API testlerinde route mock kullanılmadı. V61 bu geçici veritabanına mevcut backend tarafından uygulandı. Frontend production modu test edildi; production deployment değildir. Test sonunda görev frontend'i ve kimliği doğrulanmış backend süreç ağacı kapatıldı; etiket doğrulanan `--rm` PostgreSQL container'ı durdurularak sentetik verileriyle kaldırıldı.

## 4. Test/doğrulama sonuçları

- **Lint / TypeScript / production build / diff:** PASS.
- **Bundle:** tüm rotalar bütçe içinde; Settings **486.3 KB / 505 KB gzip**. Bütçe gevşetilmedi.
- **Tema paketi: 28/28 PASS, 0 skip** — 3 saf sözleşme/kontrast testi, 23 API-fixture'lı tarayıcı testi, 2 gerçek cookie API/PostgreSQL testi. İçinde 13 yeni animasyon testi vardır.
- **Mevcut hareket tercihi regresyonu: 4/4 PASS.** Toplam hedefli kabul: **32/32**.
- Gerçek Web Audio context'leriyle kullanıcı etkileşimi öncesi sıfır context, preset'lerde farklı filtre/üretim, seviye 100, görünürlük kaybında close, dönüşte/reload'da autoplay olmaması, Solid'e geçişte kapanma ve motion off iken gök gürültüsü doğrulandı. Bekleyen ses zamanlayıcısı durdurulduktan sonra ilerletilen test saatinde yeni ses oluşturmadı. Native ses API'sinin yokluğunda Settings kullanılabilir kaldı.
- Canvas sayacıyla 30 FPS üst sınırı ve duraklatıldığında çizim yapılmaması doğrulandı. Bu, fiziksel cihaz pil/ısı/FPS benchmark'ı değildir.
- TR/EN/DE animasyon alanı: 390 px koyu ve 1440 px açık görünüm, native radio klavyesi, taşmama ve altı scoped Axe kontrolü PASS. Mevcut Solid/Gradient responsive/light/dark/kontrast erişilebilirlik testleri de geçti. Mobil ve masaüstü ekran görüntüleri görsel olarak incelendi; ignored `.local/theme-phase2-frontend/` altındadır.
- Gerçek API/DB: animation preset'i, ses/hareket boolean'ları ve seviye satırda doğrulandı; yeni browser context'inde aynı hesabın tercihi, başka hesabın varsayılanı, çıkışta context close, başka hesaba geçişte efekt olmaması ve tüm tema reset'i PASS. Solid/Gradient'in önceki gerçek API regresyonu da PASS.
- İlk UI koşusunda kart erişilebilir adı/toolbar yerleşimi düzeltildi. Sonradan eklenen global off testindeki Kaydet yanıtı yarışı gerçek UI akışına taşındı. Paralel iki Playwright koşusunun ortak artifact klasörü çakışması, nihai koşuda ayrı çıktı diziniyle giderildi. Yukarıdaki 28/28 sonucu son üretim build'i üzerindeki kesintisiz başarılı koşudur; başarısız/yarım ilk koşular başarı sayılmadı.
- Mevcut tasarım/token yapısı korundu; `design-motion-principles` ve [Web Interface Guidelines](https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md) kapsamındaki yeni kontrollerin adları, hover/odak/scroll payı, form hataları, durdurma, reduced motion ve kaynak ömrü kontrol edildi. Impeccable mevcut yüzey yaklaşımı korundu; önceki launcher cache sınırı için yeni bağımlılık/kurulum yapılmadı.

## 5. Açık kalan konular ve doğrulanmayan sınırlar

- Otomatik tarayıcı kabulü yerel production modu **Chromium** üzerindedir. Safari/Firefox, gerçek iOS/Android, ekran okuyucu, OS ses kesintileri ve fiziksel hoparlör/kulaklıkla işitsel kalite kabulü otomatik doğrulanmadı. “Doğal” ses/görsel algısı manuel değerlendirilmelidir; kullanılan sesler gerçek alan kaydı değildir.
- Sekme görünürlük yaşam döngüsü deterministik `visibilitychange`/visibilityState testiyle doğrulandı; gerçek cihazın arka plan/uyku/pil davranışı manuel kalır. Ses sağlayamayan API senaryosu ayrıca simüle edildi.
- API-fixture'lı testler backend güvenlik kabulü sayılmaz; iki gerçek entegrasyon senaryosu ayrı raporlanmıştır. Backend kodu değişmediği için backend'in tam test paketi yeniden çalıştırılmadı. Tüm uygulama E2E paketi, production deployment ve pre-push çalıştırılmadı.
- Efektler üretkenlik ekranında metnin üstüne çizilmez; opak içerik çevresindeki boşluklarda görünür. Düşük donanım ve gerçek cihaz pil tüketimi için saha ölçümü yapılmadı.

## 6. Kullanıcının manuel kontrol adımları

1. V61 uygulanmış backend ve frontend ile giriş yapın. Ayarlar → Tema ayarları → Animasyonlu bölümünde dört kartı seçin. Kaydet öncesi yalnız yerel önizlemenin değiştiğini; Vazgeç'in kayıtlı seçime döndüğünü kontrol edin.
2. Her temayı kaydedin. Yağmur hızlarını, karın yavaş salınımını, su dalgalarını ve fırtınadaki seyrek lokal şimşeği gözlemleyin. Metin, formlar, navbar/sidebar ve mobil dokunma hedeflerinin okunup kullanılabildiğini kontrol edin.
3. Tema sesi açık seçeneğini ve örneğin %73 seviyesini kaydedin. Çalışma alanındaki **Sesi başlat** düğmesine basın. Kulaklık/hoparlörde dört sesi dinleyin; 0/100 seviyelerini ve Sesi durdur'u deneyin. Şimşek sonrası gecikmeli gök gürültüsü için en az 20 sn bekleyin.
4. Animasyon açık seçeneğini kapatıp kaydedin; sesin bağımsız çalışabildiğini kontrol edin. Geçici Hareketi duraklat/sürdür, global Arayüz animasyonları Kapalı ve OS azaltılmış hareket ayarlarıyla sabit görünümü doğrulayın.
5. Ses çalarken sekmeyi gizleyin; ses/efekt durmalıdır. Geri dönün ve reload yapın; ses yeniden düğmeye basmadan başlamamalıdır. Solid/Gradient'e geçişte, ses kapatmada ve çıkışta eski ses kalmamalıdır.
6. Aynı hesapta başka cihazla tercihi kontrol edin; farklı hesapta önceki hesabın sesi/efekti görünmemelidir. Tema reset'inin renk/animasyonu birlikte sıfırlayıp diğer tercihleri koruduğunu deneyin.
7. Fiziksel mobil cihaz, Safari/Firefox, ekran okuyucu ve kulaklıkla kalan kabul sınırlarını değerlendirin. Yeni ses tercihlerinin saklanması için bu teslimde ek ENV veya servis kurulumu gerekmez.
