# Animasyonlu tema arka plan sürekliliği

## 1. Tamamlanan kapsam

Kullanıcının Görevlerim ekranında gösterdiği siyah dikdörtgenin nedeni, `main` altındaki sayfa kapsayıcılarına uygulanan global opak `background-color` kuralıydı. Bu özellik kaldırıldı; içerik sırasını koruyan `position: relative` devam eder. Böylece başlık, filtreler ve kartlar arasındaki boşluklardan animasyonlu zemin kesintisiz görünür. Kartların, formların ve kontrol çubuğunun kendi yüzeyleri değiştirilmedi. Düzeltme ortak tema CSS'inde olduğu için tüm animasyon preset'lerini ve çalışma alanı sayfalarını kapsar.

## 2. Değişen önemli dosyalar

- `frontend/src/styles/theme-colors.css`: sayfa kapsayıcısının opak zemini kaldırıldı.
- `.agents/frontend-design-rules.md`: şeffaf sayfa kapsayıcısı / opak bileşen yüzeyi ayrımı açıklandı.
- `.agents/web-rules/WEB_SITE_MASTER_CHECKLIST_TR.md`: yalnız etkilenen kapsamın doğrulama notu eklendi.

## 3. Çalıştırılan doğrulama komutları

- Repo kökünde `node -` üzerinden mevcut Playwright ve `e2e/theme-fixture.ts` yardımcısıyla geçici tarayıcı doğrulaması yapıldı. Gerçek development arayüzü ve sentetik API yanıtları kullanıldı; kullanıcı hesabına veya gerçek tercihlerine yazılmadı.
- Dört preset × açık/koyu × 1440×960; ayrıca açık/koyu 390×844 mobil kontrolü. Computed style ile şeffaf wrapper, opak kart ve efekt `pointer-events: none` kontrol edildi; taşma ve `pageerror` izlendi.
- Mobil görsel kabul için çerez kararı mevcut test state'inden yüklenerek ek iki temiz ekran görüntüsü alındı.
- `git diff --check`.

## 4. Test/doğrulama sonuçları

10 görünüm kontrolü PASS; sayfa kapsayıcıları şeffaf, kartlar opak, efekt etkileşim engellemiyor; yatay taşma ve runtime hatası yok. Masaüstü/mobil görüntüler `.local/theme-background-fix/` altında, Git dışında tutulur ve görsel olarak incelendi. İlk geçici doğrulama komutunun Türkçe selector'ü PowerShell stdin kodlamasında bozuldu; metinler mevcut UTF-8 JSON'dan alınarak başarılı koşu tamamlandı. Diff kontrolü PASS.

## 5. Açık kalan konular ve doğrulanmayan sınırlar

Bu tek CSS özelliği düzeltmesi için tam E2E, production build, backend testleri veya pre-push tekrar çalıştırılmadı. Tarayıcı kontrolü yerel development Chromium üzerindedir; gerçek hesap/API ve fiziksel cihaz kabulü değildir. Backend, ses/animasyon motoru, ENV ve bağımlılıklar değişmedi. Commit/push yapılmadı; kullanıcı için mevcut geliştirme servisleri açık bırakıldı.

## 6. Kullanıcının manuel kontrol adımları

Sayfayı yenileyip Görevlerim'i açın. Animasyonlu temalarda başlığın ve filtre/kart aralarının arka planla birleştiğini, önceki büyük siyah dikdörtgenin kaybolduğunu kontrol edin. Kartların kendi koyu/açık yüzeyleri okunabilirlik için korunur. Aynı kontrolü diğer çalışma alanı sayfalarında ve mobil görünümde yapabilirsiniz.
