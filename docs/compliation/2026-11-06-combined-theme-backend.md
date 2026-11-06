# Renk ve animasyonlu arka planın birlikte kullanımı — Backend

## 1. Tamamlanan kapsam

Kullanıcının `theme-service-backend` branch'i için yeniden onayladığı kapsam tamamlandı. Mevcut tercih sözleşmesi dört durumu saklar:

- `SOLID`: tek renk vurgular, animasyonlu arka plan seçili değil.
- `GRADIENT`: gradyan vurgular, animasyonlu arka plan seçili değil.
- `ANIMATED`: tek renk vurgular + animasyonlu arka plan; mevcut kayıtların anlamı değişmez.
- `ANIMATED_GRADIENT`: gradyan vurgular + animasyonlu arka plan; yeni birleşik tür.

İki renk modu ve arka plan seçimi, yeni nesne/alan/servis eklemeden mevcut `themeColors.themeType` üzerinden eşlenir. Renkler ve animasyon/ses tercihleri aynı kullanıcı satırında korunur. Hareketin gerçekten oynatılması `themeAnimation.animationEnabled`, global/reduced-motion ve istemci yaşam döngüsüne; sesin başlaması ayrıca açık kullanıcı etkileşimine bağlıdır. Backend oynatma yapmaz.

Domain, DTO doğrulaması ve Swagger allowlist'i genişletildi. Yeni V62 migration'ı `theme_type` kolonunu VARCHAR(8)→VARCHAR(24) yapar ve CHECK'e 17 karakterli birleşik türü ekler. Önceki SQL migration'ları değiştirilmedi; kayıtlar, renk/animasyon alanları, diğer tercihler ve updated_at korunur. Reset mevcut varsayılanları kullanır. Yeni endpoint/ENV/bağımlılık/auth kararı yoktur.

### API sözleşmesi ve frontend'e devir

- Mevcut `GET /api/v1/users/me/preferences`: 200 tam tercih nesnesi, no-store. Kaydı olmayan hesap için varsayılanlar değişmez; GET satır oluşturmaz.
- Mevcut `PUT /api/v1/users/me/preferences`: 200 tam kayıtlı tercih nesnesi. Temel locale/theme/motion/themeTransition alanları ve eski opsiyonel alanlar değişmez. `themeColors` verilirse beş alanın tamamı zorunlu; tür yukarıdaki dört değer, renkler opak #RGB/#RRGGBB, açı 0–360 tamsayıdır. Yanıtta renkler kanonik #RRGGBB olur. `themeAnimation` verilirse dört alanın tamamı zorunlu: dört preset, iki boolean, 0–100 tamsayı ses seviyesi. Eksik/null nesneler kendi kayıtlarını bağımsız korur.
- Mevcut `DELETE /api/v1/users/me/preferences/theme`: 200 tam tercih, renk ve animasyon/ses varsayılana döner; diğer tercihler korunur.
- Yalnız principal hesabı; cookie oturumu, mutasyonlarda CSRF, satır kilidi ve no-store korunur. Oturumsuz 401, eksik CSRF 403, geçersiz PUT 400 ProblemDetail ve atomik ret. Yabancı kullanıcı yollarına erişim verilmez.

Güvenli örnek PUT:

```json
{
  "locale": "tr",
  "theme": "system",
  "motion": "on",
  "themeTransition": true,
  "themeColors": {
    "themeType": "ANIMATED_GRADIENT",
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

Frontend sonraki çalışmada iki bağımsız kontrol kullanmalıdır: renk modu SOLID/GRADIENT, animasyonlu arka plan seçili/seçili değil. Bu iki seçim yukarıdaki dört değere eşlenir. `ANIMATED_GRADIENT` gradyan token'larını ve arka plan/ses sahibini birlikte etkinleştirmeli; mevcut `ANIMATED` tek renk vurgusunu korumalıdır. Arka plan kapatılırken son animasyon/ses ve renk değerleri silinmez; yalnız tür SOLID/GRADIENT'e döner. Kaydet/Vazgeç, hesap izolasyonu, reduced motion, ses için gesture, sekme/çıkış temizliği ve reset korunmalıdır.

SECURITY §11 "Combined color and animated background preferences" güncellendi. Swagger mevcut docs ayarı açıkken `/swagger-ui/index.html` veya `/v3/api-docs`; normal cookie girişi sonrası GET `/api/v1/auth/csrf`, PUT/DELETE için X-XSRF-TOKEN kullanılır. Yeni secret veya kimlik bilgisi gerekmez.

## 2. Değişen önemli dosyalar

- `backend/src/main/java/com/pda/user/domain/ThemeColors.java`: yeni birleşik tür.
- `backend/src/main/java/com/pda/user/domain/entity/UserPreference.java`: kolon uzunluğu.
- `backend/src/main/java/com/pda/user/api/UserPreferenceController.java`: DTO/Swagger.
- `backend/src/main/resources/db/migration/V62__combined_theme_preferences.sql` ve migration README.
- `ThemeColorsTest`, `UserPreferenceApiIntegrationTest`, yeni `CombinedThemePreferenceMigrationTest`.
- `.agents/SECURITY.md`, `api.md`, `database.md`, `architecture.md`, `folder-structure.md`.

Frontend kaynakları ve web checklist değiştirilmedi; bu bağımsız backend teslimidir.

## 3. Çalıştırılan doğrulama komutları

Backend dizininde:

```powershell
.\mvnw.cmd -B -ntp "-Dtest=ThemeColorsTest,ThemeAnimationTest,UserPreferenceApiIntegrationTest,ThemeColorPreferenceMigrationTest,AnimatedThemePreferenceMigrationTest,CombinedThemePreferenceMigrationTest" test
.\mvnw.cmd -B -ntp test
```

Repo kökünde `git diff --check`, frontend değişiklik kontrolü ve güncel Surefire XML raporlarının test/failure/error/skip sayımı yapıldı. Test çıktıları ignored `.local/theme-combined-backend/` altındadır. Tam paket sayımında yalnız bu koşunun başlangıç zamanından sonra güncellenen 156 XML raporu kullanıldı; Maven toplamıyla eşleşti.

## 4. Test/doğrulama sonuçları

- Hedefli paket: **69/69 PASS**, 0 failure/error/skip.
- Tam backend: **1239 toplam, 1238 PASS, 0 failure/error, 1 beklenen skip**. Atlanan test `LiveKitRealSmokeTest.realSfuLifecycleAndSignedWebhook`; opt-in `pda.meeting.real-media-test` verilmedi. Bu koşu gerçek SFU smoke kabulü değildir.
- Maven BUILD SUCCESS. Tam paket yaklaşık 4 dk 39 sn sürdü. Diff kontrolü temiz.
- V61→V62 PostgreSQL 18 migration testi, üç eski türün tüm satır alanları/timestamp snapshot'ını eşit buldu; kolon genişliğini, dört türün yazılmasını, bilinmeyen/null türlerin ve mevcut seviye/açı ihlallerinin reddini, Flyway validate ve tekrar migrate'in no-op olmasını doğruladı.
- PostgreSQL 17 üzerinde cookie/CSRF API entegrasyonu yeni türün SQL'de saklanmasını, yeni oturumdan okunmasını, dört durum arasında geçişi, renk/animasyon değerlerinin korunmasını, eski eksik/null nesne davranışını, hesap izolasyonunu, atomik invalid PUT reddini ve bağımsız reset'i doğruladı. Swagger enum'u da test edildi.
- Mevcut auth, migration, User ve diğer modüllerin regresyonları tam pakette geçti. Testler mevcut izole Testcontainers veritabanlarını kullanır; kullanıcı uygulama veritabanına bağlanmaz.

## 5. Açık kalan konular ve doğrulanmayan sınırlar

Frontend uyarlaması bu branch'te yapılmadı; mevcut UI yeni birleşik türü henüz sunmaz. Eski istemciler yeni türü anlamadığından backend/frontend sürümleri birlikte planlanmalıdır. Arayüz ve gerçek tarayıcı/medya kabulü sonraki frontend çalışmasına aittir.

Yerel uygulama veya production DB'ye V62 uygulanmadı; servisler yeniden oluşturulmadı. Normal uygulama güncellemesinde önce standart yedek, sonra uyumlu backend ile Flyway startup kullanılmalıdır. Birleşik kayıtlar oluştuğunda eski binary'ye kör dönüş yapılmaz; uyumlu build veya açıkça incelenmiş veri uyarlaması gerekir. Kolon/history/kayıt silme veya eski migration'ı değiştirme geri dönüş yöntemi değildir.

Tam pre-push, production build/deployment, frontend testleri ve opt-in gerçek LiveKit smoke çalıştırılmadı. Commit/push/branch değişimi yapılmadı. ENV ve güvenlik mimarisi değiştirilmedi.

## 6. Kullanıcının manuel kontrol adımları

1. Uygulama DB'sinin standart yedeğini aldıktan sonra uyumlu backend'i normal başlatma yoluyla çalıştırın; Flyway V62 ve health durumunu kontrol edin.
2. Mevcut docs ayarı açıksa Swagger'da normal cookie/CSRF akışıyla yukarıdaki birleşik PUT'u gönderin. GET ile tür, iki renk ve animasyonun birlikte döndüğünü doğrulayın.
3. Başka oturumda aynı hesabın tercihini, farklı hesapta kendi varsayılanlarını kontrol edin. Eksik/null nesneyle eski istemci PUT'unun birleşimi koruduğunu deneyin.
4. ANIMATED, SOLID ve GRADIENT türlerine geçip renk/animasyon değerlerinin korunmasını; hatalı tür/rengin 400 vermesini kontrol edin. DELETE reset'inin ses dahil tema varsayılanlarını geri getirdiğini ve diğer tercihleri koruduğunu doğrulayın.
5. Frontend branch'inde iki bağımsız seçimin yukarıdaki dört türe eşlenmesi ve birleşik render/ses davranışı uygulanmalıdır; bu backend teslimi tek başına mevcut UI'yi değiştirmez.
