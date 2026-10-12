# Proje ve organizasyon logo şekli

Tarih: 2026-10-12. Durum: uygulama ve kapsamlı hedefli doğrulama tamamlandı.

## Tamamlanan kapsam

- Proje ve organizasyon oluşturma/düzenleme formlarında ortak, küçük görsel örnekli Köşeli/Yuvarlak seçici; anlık önizleme, klavye okları ve tema token'ları.
- `logoShape` gerçek API/DB üzerinden kaydedilir. Proje ve organizasyon ayarları bağımsızdır; dosya olmadan veya mevcut dosyayı silmeden şekil değiştirilebilir.
- V42 migration: iki tabloda `VARCHAR(16) NOT NULL DEFAULT 'SQUARE'`, SQUARE/CIRCLE CHECK. Mevcut kayıtlar Square kalır; görsel dosyası, referansı ve sürümü değişmez.
- Eksik/null create şekli Square; eksik/null PUT şekli kayıtlı değeri korur. Desteklenmeyen string, sayısal enum ordinal'ı, boolean, object ve array 400 döner.
- Kartlar, proje tablo satırı, detay başlıkları, açık/daraltılmış/mobil sidebar, ekip kartı/şeması/detayı, davet listesi/önizlemesi ve sohbet grup avatarına şekil aktarılır.
- Ortak `EntityMark` + `data-logo-frame`: Circle dış zemin/kenarlık ve iç görselde dairesel kırpma; Square mevcut köşe değerlerini korur. Görsel `object-cover` davranışı ve en-boy oranı korunur; logosuz/hatalı görsel fallback'i aynı şekli kullanır.
- TR/EN/DE, 320/390/768/1440 px, açık/koyu tema ve native radio klavye davranışı doğrulandı; mobil/masaüstü ekran görüntüleri incelendi.
- API, veri modeli, ortak frontend sözleşmesi ve ilgili web checklist kapsam notları güncellendi. Global web standartları tamamlandı sayılmadı.

## Önemli dosyalar

- `backend/src/main/java/com/pda/project/LogoShape.java`: desteklenen değerler ve güvenli JSON çözümleme.
- `backend/src/main/resources/db/migration/V42__entity_logo_shape.sql`: eski kayıt varsayılanı ve DB constraint'leri.
- Project/Organization entity, service, create/update request, response ve controller dosyaları; alıcı kapsamlı `ProjectInvitationService` ve `MyProjectInvitationController`.
- `frontend/src/lib/media/logo-shape.ts`, `components/common/logo-shape-picker.tsx`, `entity-mark.tsx`, `entity-card.tsx`, `image-picker.tsx`, `app/globals.css`.
- Proje/organizasyon dört formu, API/type/schema dosyaları; proje/organizasyon/ekip kart ve başlıkları; sidebar, davet ve sohbet component'leri. `query-invalidation.ts` kaydetme sonrası davet verisini de yeniler.
- `LogoShapeIntegrationTest`, `LogoShapeMigrationTest`, `e2e/logo-shape.spec.ts`. `MigrationConsolidationTest` tarihsel katalog karşılaştırmasını V40'a sabitler; yeni V42 upgrade testi ayrıdır.
- Landing demosuna yalnız yeni zorunlu Project alanının Square varsayılanı eklendi. Gerçek uygulama akışlarında mock veri eklenmedi.

## Doğrulama komutları ve sonuçları

1. Backend dizininde:

   ```powershell
   mvn.cmd -q -DskipTests package
   mvn.cmd -q '-Dtest=LogoShapeIntegrationTest,LogoShapeMigrationTest,ProjectIdentityIntegrationTest,ProjectApiIntegrationTest,ProjectInvitationApiIntegrationTest,ProjectHomeApiIntegrationTest,OrganizationServiceTest,OrganizationDomainTest,OrganizationRepositoryTest,MigrationConsolidationTest' verify
   ```

   Paketleme başarılı. Verify çıkış kodu 0; 60 test, 0 failure/error/skip. Gerçek PostgreSQL/Testcontainers; V41→V42 backfill/constraint/idempotence, PostgreSQL 17/18 konsolidasyon kataloğu, dosya baytları/sürüm korunması, create/update/list/by-slug, eski istemci uyumu, bağımsız tercihler, upload/remove/replacement, invalid enum ve yetki/CSRF denetimleri.

2. Frontend dizininde:

   ```powershell
   npm.cmd run lint
   npx.cmd tsc --noEmit
   npm.cmd run build
   $env:E2E_REUSE_AUTH='1'
   npx.cmd playwright test e2e/logo-shape.spec.ts --project=chromium
   npx.cmd playwright test e2e/project-logo-settings.spec.ts e2e/organization-profile.spec.ts e2e/project-settings.spec.ts --project=chromium
   ```

   Son lint/type/build çıkış kodları 0. Dört yeni kabul testi ve 25 mevcut regresyon testi geçti (29 benzersiz test). Yeni kabul paketinin son süreç çıkışı 0. Önceki denemelerde native radio tıklama alanı düzeltildi; ek yüzey testinin tam ekran sohbet kapatma seçicisi düzeltildi. Son kabul paketi tamamen yeşildir. İki Playwright denemesinin aynı çıktı dizinini eşzamanlı kullanması test trace dosyasını etkiledi; son paket seri ve sorunsuz çalıştırıldı.

3. Yerel işletme:

   ```powershell
   powershell.exe -NoProfile -ExecutionPolicy Bypass -File ops/backup.ps1 -KeepLast 1000
   docker compose up -d --build --no-deps backend
   docker compose logs backend
   ```

   DB ve organizasyon medya yedeği alındı: `.local/backups/pda-db-20261012-115634.dump`, `.local/backups/pda-media-20261012-115634.tar.gz`. Yerel backend yeniden derlendi; Flyway V42 uygulandı, Hibernate validate ile açıldı, `/actuator/health` UP. Docker/Maven uyarılarının PowerShell stderr yönlendirmesi ilk sarmalayıcıya exit 1 gösterdi; gerçek test sonuçları, son Maven verify exit 0 ve çalışan backend ayrıca doğrulandı. ENV, production veya uzak Git işlemi yapılmadı.

4. `git diff --check`: başarılı.

Loglar: `.local/logo-shape-backend-verify.log`, `logo-shape-e2e-final.log`, `logo-shape-regressions.log`, `logo-shape-lint-final.log`, `logo-shape-type-final.log`, `logo-shape-build-final.log`. Görsel kanıtlar: `.local/logo-shape-{projects,organizations}-{light,dark}-{390,1440}.png`.

## API ve Swagger kontrolü — SECURITY.md bölüm 11

- `POST /api/v1/projects`, `POST /api/v1/organizations`: örnek `{"name":"Example","logoShape":"CIRCLE"}`, 201; oturum + CSRF gerekir.
- `PUT /api/v1/projects/{id}`: örnek `{"name":"Example","priority":"MEDIUM","status":"PLANNING","logoShape":"SQUARE"}`, 200; mevcut PROJECT_UPDATE gerekir.
- `PUT /api/v1/organizations/{id}`: örnek `{"name":"Example","logoShape":"SQUARE"}`, 200; aktif owner gerekir, ADMIN bypass yoktur.
- Invalid şekil 400; oturumsuz 401; CSRF/yetki yokluğu 403; eksik/arşivli kayıt 404. Read yanıtları ve yalnız kendi alıcı davetinin `/project-invitations/me`, `/{id}/preview` yanıtı şekli taşır. Medya endpoint'leri değişmedi.
- Mevcut `API_DOCS_ENABLED=true` ortamında `/swagger-ui/index.html` veya `/v3/api-docs`. `GET /api/v1/auth/csrf`, normal çerez oturumu ve mutation'da `X-XSRF-TOKEN`. Bu görev ENV değerini değiştirmedi.

## Açık kalan konular ve doğrulama sınırları

- İstenen özellik kapsamında açık implementasyon konusu yoktur.
- Tam backend/front-end projenin tüm test paketleri veya production dağıtımı çalıştırılmadı; sonuçlar yukarıdaki hedefli kapsamdır. Edge/Firefox/Safari manuel kontrolü yapılmadı.
- Önceki QA hesapları mevcut yerel DB'de olmadığı ve mail kapalı olduğu için yalnız test hazırlığında iki yeni QA hesabı DB'ye eklendi; oturumlar gerçek login API'sinden alındı. Uygulama auth/mail ayarları değiştirilmedi. Başarı senaryoları gerçek API/DB/medya; mevcut regresyonların hata/latency müdahaleleri TEST-ONLY'dir.
- `docs/compliation/README.md` repo içinde bulunmadığından AGENTS.md'deki alanlar kayıt yapısı olarak kullanıldı.

## Kullanıcının manuel kontrol adımları

1. Bir proje ve bir organizasyonun oluşturma/düzenleme ekranında Köşeli/Yuvarlak seçimini deneyin; logosuz ve logolu önizlemeyi karşılaştırın.
2. Kaydedip yenileyin; liste, detay, sidebar, ekip ve sohbet görünümlerinde aynı şekli kontrol edin. Proje ve organizasyona farklı şekiller verin.
3. Logo dosyasını değiştirmeden şekli değiştirin; sonra logo yükleme/değiştirme/kaldırma işlemlerini deneyin.
4. Gerçek geniş/en-boy oranlı kendi logolarınızı hem temada, mobil ve masaüstünde görsel olarak değerlendirin.
5. Başka ortama geçerken normal migration/yedekleme sürecini kullanın; production deployment bu teslimin parçası değildir.
