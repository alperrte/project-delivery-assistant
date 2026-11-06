# Tek renk / gradyan scrollbar renkleri

## 1. Tamamlanan kapsam

Solid/Gradient hesap temasında viewport ve mevcut `data-workspace-scroll` alanlarının scrollbar rengi erişilebilir `--primary` tonuna bağlandı. Hover token'ı aynı vurgu ile foreground karışımıdır. Gradyanda ilk renk esas alınır; native scrollbar'a gradyan zorlanmaz. Public/auth, animasyonlu tema ve forced-colors varsayılanları korunur. Arka plan/sidebar yüzeyleri değiştirilmedi.

## 2. Değişen önemli dosyalar

`frontend/src/styles/theme-colors.css`: Solid/Gradient + AppShell için iki scrollbar değişkeni. `frontend/src/app/globals.css`: açıklama güncellemesi. Frontend tasarım kuralları ve master checklist'in ilgili kapsam notu güncellendi.

## 3. Çalıştırılan doğrulama komutları

Repo kökünde `node -` ile mevcut Playwright/tema fixture'ını kullanan geçici tarayıcı otomasyonu ve `git diff --check` çalıştırıldı. Gerçek development arayüzünde sentetik API tercihleri kullanıldı; kullanıcının hesabına yazılmadı.

## 4. Test/doğrulama sonuçları

8 kontrol PASS: light/dark × kayıtlı Solid/Gradient için viewport ve opt-in scrollbar computed renkleri primary ile eşleşti; her görünümde forced-colors `auto` ve public sayfaya geçişte label-blue fallback doğrulandı. İlk geçici komuttaki public kontrolü yanlış renk eşitliğini sızıntı sayıyordu; doğrudan label-blue fallback ve AppShell yokluğu denetlenerek başarılı koşu tamamlandı. Diff kontrolü temiz.

## 5. Açık kalan konular ve doğrulanmayan sınırlar

Küçük CSS değişikliği için tam test/build/pre-push çalıştırılmadı. Kontrol development Chromium üzerindedir; OS'nin scrollbar gizleme/hover davranışı ve diğer tarayıcıların native görünümü farklı olabilir. Backend/ENV/bağımlılık değişmedi. Commit/push yapılmadı; geliştirme servisleri açık kaldı.

## 6. Kullanıcının manuel kontrol adımları

Ayarlar'da tek renk veya gradyan seçip kaydedin. Sayfa, sidebar ve sohbetin mevcut scrollbar'larını kaydırarak kontrol edin. Gradyanda scrollbar ilk renkten türetilen vurgu tonundadır. Açık/koyu görünümü değiştirip seçimin uygun tonla devam ettiğini doğrulayın.
