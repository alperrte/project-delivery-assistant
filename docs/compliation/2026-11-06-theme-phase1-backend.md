# Gelişmiş tema sistemi — Faz 1 Backend

Teslim: 2026-11-06, Europe/Istanbul. Kod ve son test koşusu: 2026-11-05. Durum: **Faz 1 Backend tamamlandı; Faz 1 Frontend için kullanıcı onayı bekleniyor.**

## 1. Tamamlanan kapsam

- Yalnız SOLID ve GRADIENT renk tercihleri mevcut User modülüne eklendi. Animasyon/ses altyapısı veya frontend kodu yazılmadı.
- Serbest opak HEX renkleri: #RGB ve #RRGGBB kabul edilir, büyük harfli #RRGGBB olarak saklanır/döndürülür. Hazır renk listesi yoktur; üç renk alanı bağımsızdır, aynı renk veya yakın tonlar kullanılabilir. Alpha, CSS renk adları ve CSS ifadeleri kabul edilmez.
- Gradyan açısı tam sayı ve 0–360 dahil olmalıdır. Kesirli, aralık dışı, eksik/null alanlar reddedilir. Domain, request DTO ve PostgreSQL kısıtları birbirini destekler.
- Varsayılan renk nesnesi: SOLID / #1B5FE0 / #1B5FE0 / #8B5CF6 / 135. Hiç kaydetmemiş kullanıcının GET isteği bu nesneyi döndürür ve DB'ye satır eklemez. Eski seçilmemiş tercih alanları null kalır.
- Mevcut Light/Dark/System (`theme`) renk türünden bağımsızdır. Eski istemci PUT'ta themeColors göndermediğinde veya null gönderdiğinde kayıtlı renkler korunur.
- Renk sıfırlama dil, görünüm, hareket, iki geçiş tercihi ve navbarMode değerlerini korur. Aynı kullanıcıya eşzamanlı ilk kaydetme/sıfırlama işlemleri insert-if-absent ve pessimistic satır kilidiyle sıralanır.
- Kimlik yalnız mevcut principal'dan alınır. Cookie/oturum/CSRF/CORS/rol politikası değişmedi; yalnız tam eşleşen yeni DELETE yolu authenticated allowlist'e eklendi. Yeni ENV, bağımlılık, tablo veya servis yoktur.

## 2. Değişen önemli dosyalar

Yeni dosyalar:

- `backend/src/main/java/com/pda/user/domain/ThemeColors.java`
- `backend/src/main/resources/db/migration/V60__theme_color_preferences.sql`
- `backend/src/test/java/com/pda/user/domain/ThemeColorsTest.java`
- `backend/src/test/java/com/pda/migration/ThemeColorPreferenceMigrationTest.java`
- Bu teslim kaydı.

Güncellenen kod/testler:

- `backend/src/main/java/com/pda/user/api/UserPreferenceController.java`: opsiyonel nested DTO, validation, reset ve OpenAPI.
- `backend/src/main/java/com/pda/user/application/service/UserPreferenceService.java`: okuma/kaydetme/sıfırlama, eski istemci uyumluluğu.
- `backend/src/main/java/com/pda/user/domain/entity/UserPreference.java`: beş renk kolonu.
- `backend/src/main/java/com/pda/user/infrastructure/repository/UserPreferenceRepository.java`: ilk satır oluşturma ve kullanıcı satırı kilidi.
- `backend/src/main/java/com/pda/auth/infrastructure/config/SecurityBaselineConfiguration.java`: yalnız yeni DELETE matcher'ı.
- `backend/src/test/java/com/pda/user/integration/UserPreferenceApiIntegrationTest.java`: tema/Swagger/kalıcılık/izolasyon/CSRF/yarış kontrolleri.
- `backend/src/test/java/com/pda/meeting/internal/MeetingV57ReminderUpgradeIntegrationTest.java`: sabit son sürüm 59 beklentisi yerine V57–V59'un uygulanması ve bekleyen migration kalmaması doğrulanır; toplantı/SMTP beklentileri korunur.

Dokümantasyon: `.agents/SECURITY.md` §11, `.agents/api.md`, `.agents/database.md`, `.agents/architecture.md`, `.agents/folder-structure.md`, `backend/src/main/resources/db/migration/README.md`.

## 3. Çalıştırılan doğrulama komutları

Maven doğrudan çalıştırıldı; hook veya pre-push kullanılmadı. Çocuk test sürecinin uygulama/secret ortamı temizlenip test değerleri verildi; dış DB adresi kullanılmadı, SMTP varsayılanı kapalı/loopback idi. Gerçek SMTP testleri kendi yerel Mailpit/GreenMail sunucularını kullandı. ENV dosyaları değiştirilmedi.

Backend dizinindeki ilk hedefli komut:

```powershell
.\mvnw.cmd -B -ntp test -Dtest=ThemeColorsTest,ThemeColorPreferenceMigrationTest,UserPreferenceApiIntegrationTest,SecurityBaselineTest,ModularityTest -DfailIfNoTests=true -Dsurefire.failIfNoSpecifiedTests=true -Dsurefire.reportNameSuffix=theme-phase1-targeted -Dpda.test.runId=theme-phase1-targeted
```

Son tam backend komutu:

```powershell
.\mvnw.cmd -B -ntp test -DfailIfNoTests=true -Dsurefire.failIfNoSpecifiedTests=true -Dsurefire.reportNameSuffix=theme-phase1-all-backend-100443 -Dpda.test.runId=theme-phase1-all-backend-100443
```

Repo kökünde ayrıca `git diff --check`, `git status --short` ve yalnız okuma amaçlı diff incelemeleri yapıldı. Git dışında tutulan `.local/theme-phase1/test.ps1`, yukarıdaki Maven komutlarına izole ortam sağlayan yerel yardımcıdır; ilk/son tam koşu logları aynı klasördedir. Surefire kanıtı `backend/target/surefire-reports/*theme-phase1-all-backend-100443.xml` dosyalarıdır.

## 4. Test / doğrulama sonuçları

- İlk hedefli başarılı koşu: **41 test, 0 failure, 0 error, 0 skip**. Sonrasında Swagger testi eklendi ve son tam koşuda doğrulandı.
- Son tam backend: **1206 toplam, 1205 başarılı, 0 failure, 0 error, 1 skip; BUILD SUCCESS**, yaklaşık 4 dakika 25 saniye. Atlanan tek test mevcut opt-in `LiveKitRealSmokeTest`; tema testlerinde skip yoktur.
- Son koşuda `ThemeColorsTest`: 24/24; `UserPreferenceApiIntegrationTest`: 11/11; `ThemeColorPreferenceMigrationTest`: 1/1; düzeltilen toplantı upgrade/yerel SMTP testi: 1/1.
- Gerçek Testcontainers PostgreSQL 17 üzerinde yeni şema ve HTTP/DB kalıcılığı; PostgreSQL 18 üzerinde V59→V60 yükseltme, eski tercih/updated_at korunması, constraint reddi, yeniden migrate idempotency ve kullanıcı FK cascade doğrulandı.
- API testleri Solid/Gradient, serbest HEX/normalizasyon, iki renk, 0 ve 360 sınırları, kesirli/geçersiz açı, desteklenmeyen tür, get/reset, yeni oturumda kalıcılık, eski payload, kullanıcı izolasyonu, yabancı yolların reddi, CSRF ve eşzamanlı ilk yazımları kapsar. `/v3/api-docs` yalnız test bağlamında açılıp şema/endpoint/hata statüleri kontrol edildi.
- İlk denemedeki test kaynağı tırnak hatası düzeltildi. İlk tam koşunun tek hatası, eski toplantı testinin maksimum migration sürümünü 59'a sabitlemesiydi; V60 sonrasında doğru semantiği doğrulayacak şekilde güncellendi. Son tam koşu hatasızdır.
- `git diff --check` temiz. Frontend/ENV dosyalarında değişiklik yok. Bu backend aşaması mevcut web checklist kutularını tamamlanmış saydırmaz; global checklist değiştirilmedi.

## 5. API sözleşmesi ve veritabanı

Tüm yollar mevcut `/api/v1` sürümünde, yalnız oturum sahibine aittir. USER/ADMIN fark etmeksizin aktif, geçerli oturum gerekir; kullanıcı ID parametresi yoktur. Yanıtlar no-store, hatalar mevcut ProblemDetail yapısındadır.

- `GET /api/v1/users/me/preferences`: 200 mevcut tercih alanları + her zaman themeColors; oturumsuz 401.
- `PUT /api/v1/users/me/preferences`: mevcut dört zorunlu alan locale/theme/motion/themeTransition korunur; languageTransition/navbarMode opsiyoneldir. themeColors eksik/null ise korunur; nesne varsa beş alan da zorunludur. 200 tam kayıtlı tercihler, 400 geçersiz/eksik değer, 401 oturumsuz, 403 CSRF eksik. Geçersiz istek hiçbir tercihi kısmen kaydetmez.
- **Yeni** `DELETE /api/v1/users/me/preferences/theme`: body yok, CSRF gerekir. Yalnız renkleri varsayılana alır, 200 tam tercihler; 401 oturumsuz, 403 CSRF eksik. Tekrar çağrılması aynı tercih sonucunu verir.
- Başka kullanıcı ID'siyle oluşturulan `/users/{id}/preferences...` yolları açılmadı; signed-in istekler deny-by-default 403 alır.

Güvenli PUT örneği (Solid için yalnız themeType değerini SOLID yapabilirsiniz):

```json
{
  "locale": "tr",
  "theme": "system",
  "motion": "on",
  "themeTransition": true,
  "themeColors": {
    "themeType": "GRADIENT",
    "solidColor": "#abc",
    "gradientStartColor": "#001122",
    "gradientEndColor": "#FFEEDD",
    "gradientAngle": 135
  }
}
```

Yanıttaki solidColor `#AABBCC` olur. Renk alanları iki türde de gönderilir; kullanılmayan türün renkleri de saklanır. Reset görünümdeki `theme` alanını sıfırlamaz.

V60 yalnız mevcut user_preferences tablosuna beş NOT NULL/default/CHECK kolonu ekler; eski alanları veya önceki migration dosyalarını değiştirmez. Sonraki sürüm V61'dir. Uygulama rollback'inde additive kolon/verileri koruyun; eski uygulama bunları yazmaz ve eski INSERT'ler DB varsayılanlarını alır. Şema kurulum geçmişiyle uyumlu ortamda normal Flyway başlangıcı kullanılır; history repair/reset yapılmaz.

## 6. Açık sınırlar ve kullanıcının manuel kontrolü

Bu aşamada bilinen açık backend hatası yoktur. Frontend renk seçici, önizleme, token/kontrast uygulaması, ekran/cihaz kabulü ve animasyon/ses sonraki onaylı aşamalara aittir. Production veya yerel uygulama veritabanına migration uygulanmadı; testler geçici DB'lerde çalıştı. Deployment/production kabulü ve tam pre-push sonucu iddia edilmez. Commit, push, branch değişikliği veya PR yapılmadı.

`.agents/SECURITY.md` §11 uyarınca manuel Swagger kontrolü:

1. **Bu teslim kaydını inceleyin.** Zaten API docs açık olan geliştirme/test ortamında `/swagger-ui/index.html` veya `/v3/api-docs` yolunu açın; bu kontrol için ENV değiştirilmedi.
2. Normal cookie oturumu açın; `GET /api/v1/auth/csrf` ile token alın, mutasyonlarda mevcut `X-XSRF-TOKEN` başlığını kullanın. Gerçek cookie/token değerlerini belgeye veya sohbete kopyalamayın.
3. GET ile varsayılanları kontrol edin, örnek PUT'u gönderin; ardından GET ve yeni oturumla renklerin kalıcılığını kontrol edin. SOLID/GRADIENT ve light/dark/system kombinasyonlarını deneyin.
4. Geçersiz HEX, açı -1/361/12.5 ve ANIMATED türüyle 400 bekleyin. Renk nesnesi olmayan eski PUT'un renkleri koruduğunu kontrol edin.
5. DELETE ile renkleri sıfırlayın; locale/theme/motion/geçiş/navbar değerlerinin değişmediğini ve ikinci hesabın tercihlerinin etkilenmediğini kontrol edin. CSRF'siz mutasyon 403, oturumsuz GET 401 olmalıdır.
6. Gerçek ortama daha sonra uygulanacak migration öncesi normal yedek/restore ve dağıtım prosedürünü izleyin. Faz 1 Frontend'e geçiş için ayrıca açık onay verin.
