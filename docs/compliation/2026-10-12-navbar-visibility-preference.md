# Navbar görünürlük tercihi

2026-10-12 — Kullanıcı, gizlenebilen ve sürekli görünür navbar arasında ayarlardan seçim yapabilir.

## Tamamlanan kapsam

- Ayarlar → Üst gezinme çubuğu: **Her zaman görünür** / **Otomatik gizlen**; TR/EN/DE, mevcut ortak radio grubu ve taslak/Kaydet/Vazgeç akışı.
- Kaydedilen seçim mobil ve masaüstünde geçerlidir; hesapta saklanır, yenileme ve yeniden girişte korunur. Seçilmemiş hesaplarda eski varsayılan sürer: mobil/tablet/touch sürekli görünür, >=1024 px hover/fine-pointer desktop otomatik gizlenir.
- Otomatik gizleme 700 ms bekleme/aşağı scroll; açma üst tutamaç, desktop hover/focus/Ctrl-K ve dokunmatikte yukarı scroll. Açık drawer/popup ve navbar odağı gizlenmeyi engeller. Reduced-motion korunur; header reserve/drawer animasyonu değişmez.
- Saved-preferences önbelleği `['preferences', userId]` ile hesap kapsamındadır; GET AbortSignal alır. Seçimi uygulamak için yeni browser storage kullanılmaz.
- `GET|PUT /api/v1/users/me/preferences` opsiyonel nullable `navbarMode` alır/döner. Eski istemcinin eksik/null alanı mevcut seçimi sıfırlamaz. V47 yalnız nullable CHECK sütunu ekler; mevcut satırlar ve diğer tercihler korunur.

## Önemli dosyalar

- `frontend/src/features/settings/{api,session-preferences}.ts`, `components/{settings-page,navigation-section}.tsx`: hesap tercihi, taslak ve UI.
- `frontend/src/components/layout/{app-header.tsx,use-auto-hide.ts}`: kayıtlı tercih, varsayılan ve dokunmatik reveal.
- `frontend/src/i18n/messages/{tr,en,de}.json`: iki seçenek ve kullanım metni.
- Backend `UserPreferenceController`, `UserPreferenceService`, `UserPreference`; `db/migration/V47__navbar_visibility_preference.sql`.
- `UserPreferenceApiIntegrationTest`, `NavbarPreferenceMigrationTest`, `frontend/e2e/workspace-mobile-header.spec.ts`. Eski `navbar-auto-hide.spec.ts` davranış testleri artık shared QA hesabını değiştirmeden explicit TEST-ONLY preference response override ile doğru seçeneği sabitler.
- SECURITY §11, API/mimari/klasör/veritabanı/tasarım notları, migration README ve web checklist kapsam notu.

## Doğrulama komutları ve sonuçları

`frontend` içinde:

```powershell
npx.cmd eslint src/components/layout/app-header.tsx src/components/layout/use-auto-hide.ts src/features/settings/api.ts src/features/settings/session-preferences.ts src/features/settings/components/settings-page.tsx src/features/settings/components/navigation-section.tsx e2e/workspace-mobile-header.spec.ts
npx.cmd eslint e2e/navbar-auto-hide.spec.ts
npx.cmd tsc --noEmit
npm.cmd run build
$env:E2E_BASE_URL='http://localhost:3003'
npx.cmd playwright test -c playwright.public.config.ts workspace-mobile-header.spec.ts --grep 'navbar choice|failed navbar|touch auto-hide|mobile/tablet' --trace off --output ../tmp/navbar-preference-final-results
$env:PLAYWRIGHT_BROWSERS_PATH=(Join-Path (Resolve-Path ../tmp) 'playwright-browsers')
$env:E2E_CROSS_BROWSER='1'
npx.cmd playwright test -c playwright.public.config.ts workspace-mobile-header.spec.ts --grep 'navbar choice|failed navbar|touch auto-hide|mobile/tablet' --project mobile-safari --trace off --output ../tmp/navbar-preference-safari-final-results
```

Backend Java 25 gerektirir; mevcut default Java 21 olduğundan resmi Temurin JDK yalnız ignored `tmp/navbar-test-jdk25` dizininde kullanıldı. `backend` içinde:

```powershell
$env:JAVA_HOME=(Resolve-Path '../tmp/navbar-test-jdk25/jdk-25.0.4.1+1').Path
.\mvnw.cmd '-Dtest=UserPreferenceApiIntegrationTest,NavbarPreferenceMigrationTest' clean test -B
```

- **6 Chromium + 6 mobil WebKit başarılı**: tam UI üzerinden iki seçenek, seçim öncesi davranışın korunması, keyboard Space/Vazgeç, kaydetme/reload, hata/retry, mobil+desktop açık tercih, hidden→visible değişimi, drawer/Escape/focus, varsayılan ve touch upward-scroll/reduced-motion. API/WS yanıtları açıkça TEST-ONLY fixture'dır; normal backend başarılarının kanıtı aşağıdaki gerçek PostgreSQL testleridir.
- **5 backend testi başarılı, failure/error/skip 0**, gerçek Testcontainers PostgreSQL 17/18: iki mode persistence, başka hesaba sızmama, yeni sign-in, invalid/CSRF/anonymous koruması, eski PUT uyumluluğu, V46→V47 veri koruma ve enum CHECK. Hibernate validate başarılı.
- ESLint, TypeScript, production build ve `git diff --check` başarılı. Mobil light TR / dark DE seçenek görselleri incelendi.
- İlk tarayıcı koşumunda eski sohbet fixture'ı güncel merkezi `groups` şemasına uyarlandı. Dev overlay tıklamayı engellediğinden final gate izole production sunucusunda koşuldu. WebKit'in CSS süreyi farklı metin biçiminde döndürmesi sayısal karşılaştırmayla düzeltildi. İlk migration numarası mevcut sohbet migration'larıyla çakıştı; son dosya yalnız V47, temiz derleme ile doğrulandı.

## API / Swagger kontrol yolu

Mevcut authenticated `GET|PUT /api/v1/users/me/preferences`: 200/no-store; invalid mode 400, oturumsuz 401, CSRF olmadan PUT 403. Örnek güvenli body: `{"locale":"tr","theme":"system","motion":"on","themeTransition":true,"navbarMode":"always-visible"}`. Swagger zaten açıksa `/swagger-ui/index.html` veya `/v3/api-docs`; normal cookie login, `GET /api/v1/auth/csrf`, PUT'ta `X-XSRF-TOKEN`. Ayrıntı `.agents/SECURITY.md` bölüm 11'dedir. ENV veya güvenlik politikası değişmez.

## Açık konular / kullanıcı kontrolü

Bu teslimde genel E2E/pre-push gate veya production deployment yapılmadı. Eski gerçek hesaplı `navbar-auto-hide.spec.ts` paketinin kaynak uyarlaması lint/type ile kontrol edildi; bu paket ayrıca koşulmadı. Yeni ayarın kullanılacağı ortamda frontend ve backend birlikte güncellenmeli; backend başlangıcında Flyway V47 uygulanır. Mevcut veri tabanı sıfırlanmaz.

Telefonda Ayarlar'dan her iki seçeneği Kaydet ile deneyin; sayfayı yenileyip yeniden giriş yaparak seçimin kaldığını kontrol edin. Otomatik gizlen modunda üst tutamaç ve yukarı scroll ile açılmayı deneyin. Masaüstünde Her zaman görünür seçeneğinin bekleme/scroll sonrası gizlenmediğini kontrol edin.
