# Detaylı animasyonlu temalar, gerçek ortam sesleri ve Alev

## 1. Tamamlanan kapsam

- Yağmur: farklı hız/uzunluk/parlaklıklarda derinlik katmanları, optik damla izleri, hafif pus, zemine yakın sıçramalar ve genişleyen halkalar.
- Fırtına: yağmurun üzerine değişen konumda dallanan şimşek, yumuşak yerel bulut aydınlanması; ilk olay 12–16 aktif animasyon saniyesi, sonraki aralıklar 20–36 saniye. Tek olay hem çizimi hem kayıtlı gök gürültüsünü tetikler; ses 0.45–1.3 saniye mesafe gecikmesiyle başlar. Tam ekran strobe yoktur. Hareket kapalıysa ses için ayrı seyrek olay saati korunur.
- Su: sinüs dalgaları yerine farklı derinlik/boyutlarda yükselen, hafif salınan baloncuklar; kırılma halkaları, küçük parlamalar ve yumuşatılmış sualtı ışığı.
- Kar: farklı derinlik/hız/opaklık ve yumuşak yatay sürüklenme.
- Yeni **Alev / Fire / Feuer**: düşük çözünürlüklü, akışla taşınan çok ölçekli yoğunluk alanından organik alevler, sıcak alt aydınlatma ve yükselen kıvılcımlar. İlk geometrik çizim görsel değerlendirmede değiştirilmiştir.
- Yapay gürültü/oscillator seslerinin yerine beş yerel CC0 kayıt: yağmur, tek gök gürültüsü, rüzgâr, su baloncukları ve kamp ateşi. Kaynak, lisans, dönüşüm ve SHA-256 bilgileri ses klasöründe bulunur. Döngülerde 650 ms ek yeri crossfade; gök gürültüsünde giriş/kuyruk fade uygulanmıştır.
- Ses dosyaları yalnız ses ikonuna açık tıklama/klavye etkinleştirmesinden sonra indirilir. Autoplay yoktur. Yükleme iptal edilebilir; indirme/decode hatası tekrar denenebilir. Preset değişimi eski kaynakları kapatır, geç gelen decode yanıtları fence edilir; en çok o sahnenin bir/iki buffer'ı tutulur. Gizli sekme, arka planı kapatma, hesap/çıkış temizliği devam eder.
- Alev için frontend allowlist, statik kart, TR/EN/DE metinleri, backend domain/DTO/Swagger ve V63 PostgreSQL CHECK birlikte genişletildi. Renk modu ile arka planın bağımsız çalışması korunur. Sidebar/kart yüzey token'ları değişmez; büyük/canlı önizleme geri eklenmedi.

## 2. Değişen önemli dosyalar

- `frontend/src/features/settings/effects/weather-scene.ts`: bounded sahne çizimi, sprite/aydınlatma ön hesaplama, alev yoğunluk alanı.
- `frontend/src/features/settings/effects/theme-scene.tsx`: tek Canvas, 30 FPS sınırı, 1/1.5 DPR, ResizeObserver ve RAF temizliği.
- `frontend/src/features/settings/effects/ambient-audio.ts`, `theme-effects.tsx`: kayıt indirme/decode/oynatma, asenkron iptal, şimşek bağlantısı ve iptal edilebilir ses kontrolü.
- `frontend/public/audio/ambience/`: beş WAV (toplam yaklaşık 7.1 MiB), `README.md`, `sources.json`. Başlangıç JS paketine eklenmez; yalnız seçilen dosyalar yüklenir.
- `theme-animation.ts`, `components/animated-theme-editor.tsx`, `theme-colors.css`, üç dil dosyası: FIRE ve güncel statik kart/açıklamalar.
- `backend/src/main/java/com/pda/user/domain/ThemeAnimation.java`, `api/UserPreferenceController.java`: beş preset allowlist'i.
- `backend/src/main/resources/db/migration/V63__fire_theme_preset.sql`: yalnız preset CHECK genişlemesi; eski kayıt/default/timestamp ve migration checksum'ları aynı kalır.
- Domain/API/migration ve frontend tema testleri; ilgili `.agents` özetleri, API/güvenlik sözleşmesi ve scoped web checklist notu.

Önceki birleşik renk/arka plan tesliminin mevcut uncommitted değişiklikleri korunmuştur; bunlar bu görevin yeni kapsamı olarak sayılmamıştır.

## 3. Çalıştırılan doğrulama komutları

```powershell
# backend/
.\mvnw.cmd -B -ntp "-Dtest=ThemeAnimationTest,UserPreferenceApiIntegrationTest,FireThemePreferenceMigrationTest,CombinedThemePreferenceMigrationTest" test
.\mvnw.cmd -B -ntp test

# frontend/
npx.cmd tsc --noEmit
npm.cmd run lint
# Yalnız komut sürecinde NEXT_PUBLIC_API_URL=http://localhost:18080/api/v1 ile QA build:
npm.cmd run build
npm.cmd run start -- --port 13000
# Süreç değişkenleri: E2E_BASE_URL=http://localhost:13000,
# THEME_REAL_API=1, NEXT_PUBLIC_API_URL=http://localhost:18080/api/v1
npx.cmd playwright test -c playwright.theme.config.ts --output ../.local/theme-cinematic/final-all
npx.cmd playwright test -c playwright.theme.config.ts -g "visible lightning" --repeat-each 3 --output ../.local/theme-cinematic/lightning-stability
# Normal dev'de ek hareket kontrolü (E2E_REUSE_AUTH=1):
npx.cmd playwright test e2e/motion-preferences.spec.ts --output ../.local/theme-cinematic/motion-regression
# QA değişkenleri olmadan normal build geri hazırlandı:
npm.cmd run build
npm.cmd run check:bundle

# repo kökü
git diff --check
powershell.exe -NoProfile -ExecutionPolicy Bypass -File ops/env.ps1 status
powershell.exe -NoProfile -ExecutionPolicy Bypass -File ops/backup.ps1 -OutDir .local/theme-cinematic/pre-v63-backup
docker compose -f docker-compose.yml -f docker-compose.meeting.yml --profile meeting up -d --build backend
```

Yerel WAV'lar ayrıca Python `wave`/SHA-256 ile manifest, kanal, süre ve clipping açısından kontrol edildi. API testi yalnız görev etiketli geçici PostgreSQL'de TEST-ONLY hesaplar hazırladı; uygulama hesaplarını değiştirmedi. `.env` veya kalıcı ENV sözleşmesi değiştirilmedi.

## 4. Test/doğrulama sonuçları

- Hedefli backend **38/38 PASS**. V62→V63 öncesi/sonrası tüm preference snapshot'ı aynı; beş preset geçerli, bilinmeyen/null preset reddediliyor. FIRE gerçek cookie/CSRF API üzerinden kayıt/yeniden giriş testinde doğrulandı.
- Son tam backend **1241 test, 0 failure, 0 error, 1 beklenen opt-in LiveKit skip**; 1240 PASS. İlk geniş koşu Docker ortamına bağlanamadı; Docker tekrar yanıt verirken normal koşu başarıyla tamamlandı. Güvenlik/test kuralları gevşetilmedi.
- Son izole production Chromium tema paketi **41/41 PASS**: 5 saf sözleşme/renk testi, 34 API-fixture'lı tarayıcı testi, 2 gerçek cookie API/PostgreSQL testi. FIRE saklama, yeni oturum/cihaz, hesap izolasyonu, reset, logout; ses başlangıç/indirme hatası/iptal/temizleme ve görsel şimşek–ses bağlantısı kapsandı.
- Şimşek testi ilk layout/ResizeObserver ile yarışıyordu; render yerleşimi beklenip aktif animasyon saati için yeterli sınır tanımlandı. Üç tekrar ve son tam koşu geçti. İlk QA adresindeki eksik `/api/v1` ve test yardımcı API süreci adresi düzeltildi; bunlar ENV dosyası değişikliği değildir.
- Beş sahne × açık/koyu × 1440/390 px için **20 hareketli render/görünüm kontrolü**, ayrıca şimşek görüntüsü; daha geniş tema paketinde TR/EN/DE, 320/390/768/1440 px, klavye ve scoped Axe kontrolleri geçti. Görüntüler incelendi; alev geometrisi ve su ışığı değerlendirmeden sonra düzeltildi.
- Ek mevcut hareket paketinde **4 Ayarlar testi PASS**, **2 public landing testi başarısız**: mevcut public sayfada bulunmayan `#product` seçicisini bekliyorlar. Bu görev landing sayfasını değiştirmedi; bu iki test başarılı sayılmamıştır.
- TypeScript, ESLint, normal production build, tüm route bundle bütçeleri ve whitespace kontrolü geçti. Settings yaklaşık **492.7 / 505 KB gzip**; bütçe yükseltilmedi. Ses dosyaları bu JS boyutuna dahil değildir ve lazy yüklenir.
- Beş WAV hash'i manifest ile eşleşiyor; peak ≤0.85, süreler 12–23.35 saniye. Ses dosyalarının gerçekçi duyulmasına yönelik işitsel kullanıcı kabulü otomatik test sonucu değildir.
- Yerel dev profili doğrulandı. DB+medya yedeği `.local/theme-cinematic/pre-v63-backup/` altına alındı; yerel backend normal Flyway ile V63'e yükseldi. Health **UP**, Swagger enum'unda **FIRE** mevcut. Normal backend/frontend/LiveKit çalışır durumda bırakıldı; yalnız task-owned QA backend/13000 frontend/etiketli geçici PostgreSQL kapatıldı.

## 5. Açık kalan konular ve doğrulanmayan sınırlar

- Seslerin kulaklık/hoparlör üzerindeki doğallığı, tercih edilen seviye ve loop ek yerinin işitsel kabulü kullanıcı tarafından yapılmalıdır. Rüzgâr kaydı eski bir arşiv kaydıdır; düşen karın birebir sesi olarak sunulmaz. Su kaydı gerçek baloncuk kaydıdır.
- Fiziksel mobil cihaz, düşük güçlü GPU/CPU, Safari/Firefox, OS ses kesintileri ve screen reader ile manuel kontrol yapılmadı. Chromium testi bu platformların tamamına garanti değildir.
- İki mevcut public landing hareket testinin seçicileri bu teslimin dışında güncellenmelidir. Tema/Ayarlar reduced-motion davranışı bu teslimin geçen testlerinde ayrıca doğrulandı.
- FIRE kaydedilmiş hesaplar için eski allowlist'li backend'e kör rollback yapılmamalıdır. Uyumlu binary kullanın; V63 history veya kullanıcı tercihlerini sessizce silmeyin. Production deployment/pre-push/commit/push yapılmadı.

## 6. Kullanıcının manuel kontrol adımları

1. `http://localhost:3000/tr/ayarlar` sayfasını yenileyin. Tema ayarlarında animasyonlu arka planı açıp sırayla Yağmur, Fırtına, Su, Kar ve **Alev** seçerek Kaydet'e basın. Görevlerim gibi boş alanı olan bir sayfada hareketi inceleyin.
2. Tema sesi açık seçiliyken sağ üst ses ikonuna basın. Yağmur/su/ateş kayıtlarını kulaklık ve hoparlörde dinleyin; 0/50/100 seviyelerini ve loop geçişlerini karşılaştırın. Sayfa yenilenince sesin kendiliğinden başlamadığını kontrol edin.
3. Fırtınada ilk şimşek için yaklaşık 12–16 aktif animasyon saniyesi bekleyin; devam eden olaylar seyrektir. Şimşekten sonra mesafe gecikmeli gök gürültüsünü dinleyin. İkonla duraklatmayı, ses kapatmayı ve sekme değiştirmeyi deneyin.
4. Alev'i hem tek renk hem gradyan vurgu ile kaydedin; sayfa yenileme/ikinci oturumda korunduğunu doğrulayın. Kart/sidebar yüzeylerinin, yan yana toggle'ların ve önizlemesiz ayar düzeninin korunduğunu inceleyin.
5. Sistem reduced-motion veya uygulama hareketi kapalıyken görsel şimşek/partikül/alev hareket etmemelidir. Ses yine yalnız açık etkileşimle başlamalıdır.
6. API/Swagger kontrolü: mevcut `GET|PUT /api/v1/users/me/preferences`, `DELETE /api/v1/users/me/preferences/theme`; ayrıntılı güvenlik/girdi/yanıt/hata sözleşmesi `.agents/SECURITY.md` §11 **Fire preset and recorded theme ambience**. Normal cookie girişi ve `GET /api/v1/auth/csrf` sonrası PUT/DELETE için X-XSRF-TOKEN kullanın. `/swagger-ui/index.html` veya `/v3/api-docs` içinde FIRE değerini kontrol edin. Yeni endpoint, ENV, yetki veya CSRF istisnası yoktur.
