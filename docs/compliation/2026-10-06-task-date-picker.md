# Görev formu tarih seçicisi

## Teslim ve durum

2026-10-06 — Tamamlandı. Görev oluşturma ve düzenleme formundaki başlangıç ve son tarih alanları, tarayıcıya bağlı native tarih seçicisi yerine ortak takvim dropdown'u kullanır.

## Yapılanlar

- Mevcut Base UI Popover, Button ve semantic renk token'larıyla `DatePicker` eklendi. Takvim, gezinme ve kapatma ikonları Lucide React'ten gelir; yeni paket eklenmedi.
- Yerelleştirilmiş tarih gösterimi, ay/yıl seçimi, önceki/sonraki ay, seçili gün, bugün vurgusu, Bugün ve Temizle eylemleri bulunur. TR/EN/DE desteklenir; hafta pazartesi başlar.
- Kullanıcının ikinci tur isteğiyle ay/yıl alanlarındaki native `<select>` kaldırıldı. Mevcut ortak Select bileşeniyle temaya uyumlu, seçili öğesi işaretli ve yüksekliği sınırlı kaydırılabilir menüler kullanılır. Ay/yıl listeleri ayrıca erişilebilir ada sahiptir; ortak `SelectContent` için geriye uyumlu opsiyonel `listProps` eklendi.
- Klavyede ok tuşları, Home/End, PageUp/PageDown, Shift+PageUp/PageDown ve Enter/Space desteklenir. Açılışta seçili güne odaklanılır; seçim veya Escape sonrası odağın tetikleyiciye dönmesi doğrulandı. Dışarı tıklama takvimi kapatır.
- Form değerleri `YYYY-MM-DD` olarak korunur. Son tarihin mevcut yerel saat → ISO dönüşümü ve saat girilmemişse 23:59 davranışı değişmedi. Başlangıçtan önceki son tarih doğrulaması korunur.
- Gelişmiş görevlerde saat alanı ve hızlı son tarih seçenekleri korunur. Takvimden son tarih temizlenince saat de temizlenir; boş tarihe ait saat doğrulama hatası bırakılmaz.
- Dar ekranlarda popup viewport içinde kalır, gerekli olduğunda dikey kaydırılır; Bugün/Temizle alt satırı sabittir. Almanca 320 px form taşması için tür düğmeleri, tarih grid'i, form sütunları ve kaydetme düğmesinin genişlikleri düzeltildi.

## Önemli dosyalar

- [Ortak DatePicker](../../frontend/src/components/ui/date-picker.tsx)
- [Ortak Select ve liste erişilebilirliği](../../frontend/src/components/ui/select.tsx)
- [Görev oluşturma/düzenleme formu](../../frontend/src/features/tasks/components/task-form-page.tsx)
- [Görev türü seçimi](../../frontend/src/features/tasks/components/task-mode-picker.tsx)
- `frontend/src/i18n/messages/{tr,en,de}.json`: ortak `datePicker` çevirileri.
- [Tarih seçici Playwright senaryoları](../../frontend/e2e/task-date-picker.spec.ts)

## Doğrulama

Komutlar `frontend` dizininde çalıştırıldı:

```powershell
npm.cmd run lint
npx.cmd tsc --noEmit
$env:E2E_REUSE_AUTH='1'
npx.cmd playwright test e2e/task-date-picker.spec.ts e2e/21-task-models.spec.ts --output=../.local/task-date-picker-delivery-results
```

- ESLint: başarılı, exit 0.
- TypeScript: başarılı, exit 0.
- Chromium ilk teslim: **16 passed**, failure/skip yok. Dört tarih seçici senaryosu ve on iki mevcut görev modeli regresyonu.
- Gerçek yerel backend ile basit görev oluşturma, tarih sırası hatası/düzeltmesi, kaydedilmiş tarihleri düzenlemede açma, gelişmiş görev saatinin doğru ISO payload'ı, bugün/temizleme ve hızlı tarih seçimi doğrulandı.
- Artık yıl, ay sınırında klavye gezinmesi, seçili gün odağı ve Escape/dış tıklama kontrol edildi.
- TR/EN/DE; light/dark; 320/390/768/1440 px; reduced-motion altında popup/form taşması ve runtime page error kontrolü geçti. 390 px koyu ve 1440 px açık ekran görüntüleri ayrıca görsel olarak incelendi.
- Git dışı QA çıktıları: `.local/task-date-picker-delivery-results/`; son yerleşim kontrolü görüntüleri ayrıca `.local/task-date-picker-layout3-results/` altında.
- İlk test hazırlığında önceki E2E hesabın oturumu geçersizdi. Standart global setup yeni yerel E2E oturumlarını hazırladı; final koşum aynı geçerli oturumları kullandı. Hazırlık ve düzeltme sırasındaki başarısız koşumlar final başarı sayısına dahil değildir.

### Ay/yıl menülerinin son doğrulaması

```powershell
npm.cmd run lint
npx.cmd tsc --noEmit
$env:E2E_REUSE_AUTH='1'
npx.cmd playwright test e2e/task-date-picker.spec.ts --trace=off --output=../.local/task-date-picker-modern-delivery-results
```

- Son kaynakta ESLint ve TypeScript exit 0; **5 Chromium testi passed**, failure/skip yok (44.9 saniye).
- Önceki dört tarih seçici senaryosu ve yeni custom menü senaryosu geçti. Ocak 31 → Şubat 28, ay/yıl seçimi, seçili yılın görünürlüğü, klavyeyle sonraki yıla geçiş, iç menüden odağın geri dönmesi ve iki katmanlı Escape doğrulandı.
- TR/EN/DE, light/dark ve 320/390/768/1440 px kombinasyonlarında hem ay hem yıl listesi açıldı; seçili seçenek, viewport sınırı, dış form taşması ve page error kontrol edildi. Menü açılış animasyonu tamamlandıktan sonra görüntüler alındı ve mobil koyu / masaüstü açık örnekleri incelendi.
- QA çıktıları `.local/task-date-picker-modern-delivery-results/` içindedir. Bir önceki koşum bütün davranış kontrollerinden sonra trace kapanışında Windows dosya kilidi (`EBUSY`) verdi; son koşumda trace yazımı kapatıldı. Süresi dolan test access cookie'si için mevcut test hesaplarıyla tekrar giriş yapıldı. Bu hazırlık/artifact hataları final başarı sayısına dahil değildir.
- Ay/yıl güncellemesinde hedefli beş test yeniden çalıştırıldı; ilk teslimde geçen on iki görev modeli testi bu takip turunda yeniden çalıştırılmadı.

## Açık konular / kapsam sınırı

Bu teslimde açık kalan hata yok. Kontrol Chromium ve etkilenen frontend akışlarıyla sınırlıdır; tam proje test paketi veya backend testleri yeniden çalıştırılmadı. Backend/API sözleşmesi, auth, CSRF, migration, bağımlılıklar ve `.env` değişmedi. Commit veya push yapılmadı. Mevcut `2026-10-06-task-test-kullanicilari.md` kullanıcı dosyasına dokunulmadı.

## Kullanıcı kontrolü

1. Görevler → Görev oluştur sayfasında başlangıç ve son tarih alanlarına basın. Ay/yıl düğmelerini açın: tarayıcı menüsü yerine temaya uyumlu seçenek listesi ve seçili öğede işaret görünmeli. Seçilen tarihler alan üzerinde okunabilir biçimde görünmeli.
2. Son tarihi başlangıçtan önce seçin: hata görünmeli. Daha sonraki tarihi seçin: hata kalkmalı. Görevi oluşturup düzenlemeye girin: aynı tarihler ve seçili ay korunmalı.
3. Gelişmiş görevde saat girin; takvimden Temizle'ye basın: tarih ve saat boşalmalı. Bugün, Yarın ve diğer hızlı seçimler çalışmalı.
4. Klavyeyle takvimi açın, oklarla gün değiştirin, Enter ile seçin ve Escape ile kapatın. Ay/yıl listesi açıkken ilk Escape yalnız listeyi, ikinci Escape takvimi kapatmalı. Dar ekranda ve iki temada takvim ve seçenek menüleri ekran dışına taşmamalı.

Commit mesajı:

```text
feat(tasks): add a modern accessible date picker to task forms
```
