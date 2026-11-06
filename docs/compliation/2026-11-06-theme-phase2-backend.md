# Gelişmiş tema sistemi — Faz 2 Backend

Tarih: 2026-11-06, Europe/Istanbul. Branch: `theme-service-backend`. Durum: **Faz 2 Backend tamamlandı; Faz 2 Frontend için ayrı kullanıcı onayı bekleniyor.**

## 1. Tamamlanan kapsam

- Mevcut themeColors.themeType alanı SOLID/GRADIENT/ANIMATED kabul eder; renk ve açı alanları korunur.
- Mevcut kullanıcı tercihlerine ayrı `themeAnimation` nesnesi eklendi: animation, soundEnabled, soundVolume, animationEnabled. Yalnız THUNDERSTORM, RAIN, SNOW, WATER desteklenir. Ses düzeyi tam sayı 0–100; ses/hareket bayrakları birbirinden ve global motion tercihinden bağımsız saklanır.
- Güvenli varsayılanlar THUNDERSTORM / **ses kapalı** / ses düzeyi 50 / animasyon açık. Tema türü varsayılanı hâlâ SOLID'dir; bu değerler kendiliğinden ses veya efekt başlatmaz.
- GET her iki tema nesnesini varsayılan/kayıtlı değerleriyle döndürür; kullanıcı hiç kaydetmediyse DB'ye satır yazmaz. PUT'ta eksik/null nesne yalnız kendisinin kayıtlı değerini korur. Verilmiş nesnede bütün alanlar zorunludur. Eski Solid/Gradient payload'ı kayıtlı animasyon tercihlerini silmez.
- Renkler ve animasyon tercihleri aynı user_preferences satırında, mevcut kullanıcı satır kilidi altında atomik kaydedilir. Mevcut DELETE tema sıfırlama renkleri ve animasyon/ses tercihlerini birlikte sıfırlar. Dil, light/dark/system, global motion, geçişler ve navbar korunur.
- Backend yalnız tercihlerden sorumludur. Renderer, ses oynatıcı, medya servisi, asset indirme, yeni realtime bağlantı veya bağımlılık eklenmedi. Frontend dosyaları/ENV/auth/CSRF/CORS/rol politikası değiştirilmedi; yeni endpoint yoktur.

## 2. Eklenen ve değiştirilen önemli dosyalar

Yeni:

- `backend/src/main/java/com/pda/user/domain/ThemeAnimation.java`
- `backend/src/main/resources/db/migration/V61__animated_theme_preferences.sql`
- `backend/src/test/java/com/pda/user/domain/ThemeAnimationTest.java`
- `backend/src/test/java/com/pda/migration/AnimatedThemePreferenceMigrationTest.java`
- Bu completion kaydı.

Güncellenen:

- `backend/src/main/java/com/pda/user/domain/ThemeColors.java`: ANIMATED türü.
- `backend/src/main/java/com/pda/user/domain/entity/UserPreference.java`: dört yeni kolon/değer nesnesi eşlemesi.
- `backend/src/main/java/com/pda/user/application/service/UserPreferenceService.java`: varsayılanlar, bağımsız opsiyonel nesne güncelleme, reset.
- `backend/src/main/java/com/pda/user/api/UserPreferenceController.java`: DTO/validation/OpenAPI ve mevcut reset genişletmesi.
- `backend/src/test/java/com/pda/user/domain/ThemeColorsTest.java`: güncel izinli tür sözleşmesi.
- `backend/src/test/java/com/pda/user/integration/UserPreferenceApiIntegrationTest.java`: dört yeni API testi, yeni şema/varsayılan/reset/uyumluluk/izolasyon kontrolleri.
- `backend/src/main/resources/db/migration/README.md`, `.agents/SECURITY.md` §11, `.agents/api.md`, `.agents/database.md`, `.agents/architecture.md`, `.agents/folder-structure.md`: sözleşme ve kısa özetler.

## 3. Çalıştırılan doğrulama komutları

Testler hook/pre-push kullanmadan doğrudan Maven ile, temizlenmiş çocuk süreç ortamında çalıştırıldı. DB için Testcontainers, SMTP için ilgili testlerin kendi yerel sink'leri kullanıldı; gerçek uygulama/production ENV veya DB kullanılmadı.

Backend dizininde hedefli koşu:

```powershell
.\mvnw.cmd -B -ntp test -Dtest=ThemeColorsTest,ThemeAnimationTest,ThemeColorPreferenceMigrationTest,AnimatedThemePreferenceMigrationTest,UserPreferenceApiIntegrationTest,SecurityBaselineTest,ModularityTest -DfailIfNoTests=true -Dsurefire.failIfNoSpecifiedTests=true -Dsurefire.reportNameSuffix=theme-phase2-targeted-065035 -Dpda.test.runId=theme-phase2-targeted-065035
```

Son tam backend koşusu:

```powershell
.\mvnw.cmd -B -ntp test -DfailIfNoTests=true -Dsurefire.failIfNoSpecifiedTests=true -Dsurefire.reportNameSuffix=theme-phase2-all-backend-065159 -Dpda.test.runId=theme-phase2-all-backend-065159
```

Repo kökünde `git diff --check`, `git status --short` ve frontend/ENV değişmediğini doğrulayan read-only diff kontrolleri yapıldı. Git dışında `.local/theme-phase2/test.ps1` izole test ortamını sağlar; targeted-tests.log ve all-backend-tests.log aynı klasördedir. Surefire raporları `backend/target/surefire-reports/*theme-phase2-all-backend-065159.xml` ile ayrılır.

## 4. Test / doğrulama sonuçları

- Hedefli koşu: **66 test, 0 failure, 0 error, 0 skip; BUILD SUCCESS**.
- Son tam backend: **1230 toplam, 1229 başarılı, 0 failure, 0 error, 1 skip; BUILD SUCCESS**. Süre yaklaşık 4 dakika 34 saniye. Atlanan mevcut opt-in LiveKitRealSmokeTest'tir; tema testleri atlanmadı.
- ThemeAnimationTest: 19/19; ThemeColorsTest: 24/24; UserPreferenceApiIntegrationTest: 15/15; AnimatedThemePreferenceMigrationTest: 1/1. Önceki V60 migration testi, güvenlik ve modül sınırı kontrolleri de geçti. Tekrar koşular sayıya eklenmedi.
- Gerçek PostgreSQL 17 / MockMvc / cookie oturumu: dört preset, ses aç/kapat, 0/100 düzeyi, hareket aç/kapat, yeni oturumda kalıcılık, SQL'de kayıt, ikinci kullanıcı izolasyonu, sessiz varsayılan ve ANIMATED seçimi, eski/eksik/null nesnelerle uyumluluk, reset ve diğer tercihler korunması doğrulandı.
- Hatalı preset/ordinal/null, eksik nesne alanları, ses düzeyi -1/101/kesirli/null için 400 ve kısmi yazmama; CSRF'siz mutasyon için 403, oturumsuz istek için 401 doğrulandı. Mevcut yabancı kullanıcı yolu reddi ve eşzamanlı ilk yazım/reset testi de geçti.
- Gerçek PostgreSQL 18 V60→V61: hem SOLID hem GRADIENT kayıtlarının bütün eski kolon snapshot'ları ve updated_at aynı kaldı; yeni sessiz varsayılanlar, NOT NULL/CHECK sınırları ve tekrar migrate/validate doğrulandı. Fresh latest şema da uygulama testlerinde doğrulandı.
- `/v3/api-docs`, yalnız test bağlamındaki mevcut docs ayarıyla açılıp yeni DTO ve ses düzeyi sınırları kontrol edildi. Gerçek production docs açılmadı.
- `git diff --check` temiz. Frontend/ENV değişmediğinden frontend veya global web checklist tekrar audit edilmedi; checklist kutuları değiştirilmedi. Commit/push/pre-push/branch değişikliği/deployment yapılmadı.

## 5. API ve veritabanı sözleşmesi

Mevcut üç yol kullanılır; yeni endpoint yoktur:

- `GET /api/v1/users/me/preferences`: 200 tam tercihler + themeColors + themeAnimation. Geçerli aktif cookie oturumu gerekir; oturumsuz 401. GET yazma yapmaz.
- `PUT /api/v1/users/me/preferences`: mevcut dört zorunlu temel alan locale/theme/motion/themeTransition korunur. themeColors ve themeAnimation opsiyoneldir; eksik/null nesne korunur. themeColors verilmişse mevcut beş alan; themeAnimation verilmişse dört yeni alan zorunludur. 200 tam kaydedilmiş tercihler, 400 geçersiz gövde, 401 oturumsuz, 403 CSRF eksik.
- `DELETE /api/v1/users/me/preferences/theme`: body yok; cookie + CSRF. 200 tam tercihler, renkler Faz 1 varsayılanlarına ve animasyon THUNDERSTORM/false/50/true değerlerine döner. Diğer tercihler korunur. Tekrarlama aynı tercih sonucunu verir. 401/403 önceki gibi.

Kimlik yalnız authenticated principal'dan gelir; kullanıcı/hesap ID parametresi yoktur, başka kullanıcı yolu açılmadı. Yanıtlar no-store, hatalar mevcut güvenli ProblemDetail modelindedir. Güvenlik ayrıntısı `.agents/SECURITY.md` §11 "Animated theme preferences" bölümündedir.

Güvenli PUT örneği:

```json
{
  "locale": "tr",
  "theme": "system",
  "motion": "on",
  "themeTransition": true,
  "themeColors": {
    "themeType": "ANIMATED",
    "solidColor": "#1B5FE0",
    "gradientStartColor": "#1B5FE0",
    "gradientEndColor": "#8B5CF6",
    "gradientAngle": 135
  },
  "themeAnimation": {
    "animation": "RAIN",
    "soundEnabled": false,
    "soundVolume": 50,
    "animationEnabled": true
  }
}
```

Sadece animasyon tercihlerini değiştirmek için themeColors atlanabilir; sadece tür/renk değiştirmek için themeAnimation atlanabilir. SOLID/GRADIENT seçildiğinde animasyon tercihleri hatırlanır, ama istemci o türlerde efekt/ses oynatmamalıdır. soundEnabled saklı kullanıcı isteğidir; browser autoplay veya kullanıcı etkileşimi koşulunu geçersiz kılmaz. Global motion/reduced-motion da render anında istemci tarafından uygulanır.

V61 mevcut theme_type CHECK'ini üç türe genişletir ve user_preferences'a `animation_preset VARCHAR(16)`, `theme_sound_enabled BOOLEAN`, `theme_sound_volume INTEGER`, `theme_animation_enabled BOOLEAN` ekler. Hepsi NOT NULL/default; preset ve ses aralığı CHECK ile sınırlı. Yeni tablo/index/extension yoktur, V60 veya önceki SQL dosyaları değiştirilmedi. Sonraki migration V62'dir.

## 6. Açık sınırlar ve manuel kontrol

Bu backend fazında bilinen açık hata yoktur. Faz 2 Frontend, görsel efektler, audio asset/oynatma/temizleme ve gerçek cihaz kabulü henüz yapılmadı. **Mevcut Faz 1 arayüzü ANIMATED türünü tanımıyor**: bu türle gelen veriyi fallback'e dönüştürebilir ve genel Kaydet ile SOLID gönderebilir. ANIMATED kullanıcıya açılmadan önce eşleşen Faz 2 Frontend teslimiyle dağıtım koordine edilmelidir.

ANIMATED kayıtlarını kabul etmeyen eski backend'e doğrudan binary downgrade güvenli değildir; uyumlu build veya ayrıca gözden geçirilmiş veri/uyumluluk kararı gerekir. Kolonları veya Flyway geçmişini silmek rollback değildir. Gerçek ortama migration uygulanmadı; normal yedek/restore ve deployment prosedürü operatöre aittir.

Kullanıcının kontrol adımları:

1. **Bu completion kaydını ve değişen dosyaları inceleyin.** Mevcut geliştirme/test ortamında API docs zaten açıksa `/swagger-ui/index.html` veya `/v3/api-docs` açın; bu teslim için ENV değiştirilmedi.
2. Normal cookie login ve `GET /api/v1/auth/csrf` kullanın; PUT/DELETE için `X-XSRF-TOKEN` gönderin. Gerçek cookie/token değerlerini kayıt veya sohbete taşımayın.
3. GET ile sessiz varsayılanları, örnek PUT ile ANIMATED + RAIN kaydını ve yeni oturumda kalıcılığı kontrol edin. THUNDERSTORM/SNOW/WATER, ses 0/100 ve iki bayrağı deneyin.
4. Desteklenmeyen FOG, null alan, -1/101/kesirli ses düzeyi için 400 bekleyin. Geçerli eski Solid/Gradient PUT'ta themeAnimation'ı atlayın veya null gönderin; kayıtlı animasyon tercihlerinin korunduğunu kontrol edin.
5. DELETE ile renkler ve animasyonun varsayılanlara, sesin kapalıya döndüğünü; dil/görünüm/motion/geçiş/navbar ve ikinci hesabın etkilenmediğini kontrol edin. CSRF'siz mutasyon 403, oturumsuz GET 401 olmalıdır.
6. Faz 2 Frontend'e geçiş için ayrıca açık onay verin. Bu aşamada efekt veya sesin oynatılmaması beklenen davranıştır.
