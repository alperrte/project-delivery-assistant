# Animasyonu son kareyi koruyarak duraklatma

## 1. Tamamlanan kapsam
Duraklatma sırasında animasyonun kaybolması düzeltildi. Önceden `running` değişince sahnenin effect cleanup'ı Canvas'ı siliyordu. Sahne/observer ömrü ile RAF kontrolü ayrıldı: duraklatma yalnız çizim döngüsünü durdurur; son kare, parçacıklar ve sahne zamanı korunur. Devam ettirme aynı sahneyi sürdürür, beklenen süreyi telafi eden ani sıçrama yapmaz.

Duraklatılmışken pencere boyutu değişirse son görüntü yeni boyuta ölçeklenerek korunur; yeni viewport geometrisi hazırlanır. Baştan hareket kapalı veya reduced motion etkin olduğunda bir statik başlangıç karesi çizilir, sürekli döngü çalışmaz. Preset değişimi/unmount normal kaynak temizliğini sürdürür. Ses ve kullanıcı tercihi sözleşmesi değiştirilmedi.

## 2. Değişen önemli dosyalar
- `frontend/src/features/settings/effects/theme-scene.tsx`: kalıcı sahne, ayrı start/stop kontrolü ve duraklatılmış resize görüntüsü.
- `frontend/e2e/theme-animation.spec.ts`: beş preset için piksel koruma, resume ve resize regresyonları.
- İlgili mimari/tasarım ve scoped motion checklist notları.

Önceki sağ panel tema çalışmasının mevcut uncommitted değişiklikleri korunmuştur; bu düzeltmede onların kapsamı yeniden uygulanmadı.

## 3. Çalıştırılan doğrulama komutları
```powershell
# frontend/
npx.cmd playwright test -c playwright.theme.config.ts -g "pause freezes|30fps|reduced motion, explicit" --output ../.local/theme-pause-frame/focused
npx.cmd tsc --noEmit
npx.cmd eslint src/features/settings/effects/theme-scene.tsx e2e/theme-animation.spec.ts
npm.cmd run build
npm.cmd run start -- --port 13000
# Yalnız test sürecinde E2E_BASE_URL=http://localhost:13000:
npx.cmd playwright test -c playwright.theme.config.ts --output ../.local/theme-pause-frame/full-production
npm.cmd run check:bundle
# repo kökü
git diff --check
```

## 4. Test/doğrulama sonuçları
- Hedefli testler **7/7 PASS**. THUNDERSTORM/RAIN/SNOW/WATER/FIRE için duraklatma sonrası görünür piksel var; bitmap beklerken aynı kalıyor. Resume sonrası görüntü değişiyor, Canvas genişliği yeniden atanarak sahne sıfırlanmıyor. Duraklatılmış 390 px resize sonrasında görüntü görünür/sabit kalıyor.
- Son yerel production Chromium tema paketi **49/49 PASS**: 6 saf, 43 API-fixture UI testi. Mevcut reduced motion/global motion, 30 FPS, ses indirme/iptal/temizleme, şimşek eşleşmesi ve renkli yan panel kontrolleri de geçti. Gerçek hesap/DB değiştirilmedi.
- TypeScript, hedefli ESLint, normal production build, tüm route bundle bütçeleri ve whitespace kontrolü PASS; Settings **493.4/505 KB gzip**.
- Yalnız görev için açılan 13000 production sunucusu kapatıldı; normal development frontend korundu. API/backend/ENV/bağımlılık değişikliği, commit/push veya deployment yoktur.

## 5. Açık kalan konular ve doğrulanmayan sınırlar
Fiziksel mobil, Firefox/Safari ve screen reader ile manuel kontrol yapılmadı. Piksel/RAF davranışı Chromium'da doğrulandı. Viewport boyutu değiştiğinde geometri yeniden hazırlanır; normal pause/resume aynı viewport'ta mevcut sahne durumunu korur. Bu teslimde gerçek API/DB veya backend testleri çalıştırılmadı.

## 6. Kullanıcının manuel kontrol adımları
1. Animasyonlu bir tema seçip kaydedin. Hareket ederken duraklatma ikonuna basın; görüntü kaybolmadan son karede kalmalıdır.
2. Birkaç saniye bekleyip devam ettirin; aynı sahne hareket etmeye devam etmelidir. Beş temada deneyin.
3. Duraklatılmışken pencereyi küçültüp büyütün; görüntü kaybolmamalıdır. Reduced motion ve uygulama hareketi kapalıyken sürekli hareket olmamalıdır.
