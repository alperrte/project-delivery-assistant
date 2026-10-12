# Görev atayanı, panoda tamamlananları gizleme, görevlere görsel ekleme

2026-10-12 — Görevler ve Görevlerim listelerinde atayan kişi görünür; panoda tamamlanan kartlar gizlenebilir; görev oluştururken birden fazla görsel (her biri en çok 1 MB) eklenebilir.

## Tamamlanan kapsam

- **Atayan → atanan.** Bütün görev yanıtları `assigners` alanını taşır: görevi başkasına atayan aktif kullanıcılar, en son atayan önce, tekilleştirilmiş. Kendi kendine atama (havuzdan alma, yöneticinin kendini ataması) atayan üretmez. Görevler ve Görevlerim'de (tablo ve kart görünümü) atananların solunda atayanın profil resmi ve atayandan atanana akan yeşil ok görünür; birden çok atayan varsa ilki + `+N`. Atayan yoksa görünüm eskisi gibidir. Ok yalnız renkle anlatılmaz: `title` ve ekran okuyucu metni "{atayan} atadı: {atananlar}" der. Animasyon hem `prefers-reduced-motion` hem uygulamanın "hareketi kapat" ayarında durur, ok statik kalır.
- **Pano.** Araç çubuğunda "Tamamlananları gösterme" onay kutusu. Açıkken "Tamamlandı" sütunu yerinde kalır (sürükle-bırak ile tamamlama çalışır), kartların yerine "N tamamlanan görev gizli" satırı gelir; sütun başlığındaki sayı gerçek sayıyı gösterir. Tercih kullanıcı bazında tarayıcıda saklanır (`pda:board-hide-done:v1:{userId}`), varsayılan kapalıdır. Sunucudan çekilen veri değişmedi.
- **Görseller.** Görev oluşturma formunda (Basit ve Gelişmiş) "Görseller" bölümü: sürükle-bırak veya seçerek birden fazla png/jpeg/webp, önizleme, tek tek kaldırma, satır içi ret mesajları (tür, 1 MB, açılamayan dosya, 20 sınırı). Görev kaydedildikten sonra görseller sırayla yüklenir; bir kısmı yüklenemezse görev yine oluşur, uyarı gösterilir ve detay sayfasından yeniden eklenebilir.
- **Sunucu kuralı.** Görseller (png, jpeg, webp, gif) en çok 1 MB; diğer dosyalar 10 MB; görev başına 20. Görsel olup olmadığına istemcinin beyanı değil içerikten kanıtlanan tür karar verir. Görseller Basit ve Gelişmiş görevlere eklenip silinebilir; görsel dışı dosyalar Gelişmiş göreve özel kalır. Detay sayfasında Basit görevde bölüm "Görseller" adıyla ve yalnız görsel kabul ederek görünür.
- **Model dönüşümü.** Gelişmiş görev Basit'e çevrilirken görseller artık engel değildir ve görevde kalır; görsel dışı aktif ek `TASK_MODE_CONVERSION_BLOCKED` üretmeye devam eder.
- Yeni migration, yeni uç nokta, ENV veya yetki değişikliği yoktur. `SecurityBaselineConfiguration` değişmedi. 1 MB'tan büyük eski görsellere dokunulmaz.

## Önemli dosyalar

- Backend `com.pda.task`: `application/{TaskView,TaskViewAssembler,TaskSupport,AttachmentPolicy,TaskAttachmentService}.java`, `domain/TaskAttachment.java`, `infrastructure/TaskRepository.java` (`hasAdvancedData`), `api/TaskAttachmentController.java` (yalnız OpenAPI açıklaması).
- Backend testleri: `TaskAttachmentApiIntegrationTest`, `TaskModesApiIntegrationTest`, `TaskPoolAndMyTasksApiIntegrationTest`.
- Frontend `features/tasks`: `components/{task-badges,task-table,my-task-card,board-page,task-form-page,task-image-picker}.tsx`, `components/detail/{task-detail-page,attachments-section}.tsx`, `use-board-prefs.ts`, `api.ts`, `types.ts`.
- `frontend/src/app/globals.css` (`.assign-flow`), `frontend/src/lib/api/error-message.ts`, `frontend/src/i18n/messages/{tr,en,de}.json`.
- E2E: `frontend/e2e/{16-task-avatars,task-board-calendar,21-task-models,task-images}.spec.ts`.
- `.agents/SECURITY.md` (§11 ek satırı, ek tehdit notu, basit/gelişmiş politika tablosu, dönüşüm paragrafı, §18), `.agents/api.md`.

## Komutlar ve doğrulama sonuçları

`backend` içinde, Docker açıkken (Testcontainers, gerçek PostgreSQL):

```powershell
.\mvnw.cmd -B -ntp test "-Dtest=TaskAttachmentApiIntegrationTest,TaskModesApiIntegrationTest,TaskApiIntegrationTest,TaskPoolAndMyTasksApiIntegrationTest,TaskCollaborationApiIntegrationTest"
.\mvnw.cmd -B -ntp verify
```

- Hedefli koşu: **55 test, failure/error/skip 0**. Kapsam: 1 MB + 1 bayt görsel 400, tam 1 MB görsel 201, 1 MB üstü metin dosyası 201; Basit görevde görsel yükleme/listeleme/indirme/silme, görsel dışı dosyada 409, proje dışı kullanıcının reddi; kapalı politikadaki Gelişmiş görevde görsel de 409; yalnız görsel taşıyan görevin Basit'e dönüşmesi; atayan/kendi kendine atama/havuzdan alma; liste ve "görevlerim" yanıtlarında `assigners`.
- Tam `verify` (`clean` olmadan): **931 test, 930 başarılı, 1 failure, error/skip 0 — BUILD FAILURE.** Kalan tek hata `CentralChatMigrationTest.duplicateDmMergeKeepsIdsRepliesReactionsReadEvidenceAndSurvivesProjectDeletion:27` (`expected: <4> but was: <6>`); bu teslimin dokunmadığı bir migration sayımıdır (aşağıdaki açık konu). Görev paketindeki bütün testler bu koşuda da geçti.

`frontend` içinde:

```powershell
npx tsc --noEmit
npm run lint
```

- İkisi de hatasız (çıkış kodu 0).
- **E2E koşulmadı.** Yeni/güncellenen spec'ler yeni backend kodunu ister; yerelde 8080'de çalışan backend eski kodla açıktı ve kullanıcının süreci olduğu için yeniden başlatılmadı. Spec'ler yazıldı, tip ve lint kontrolünden geçti, çalıştırılmadı.

## API / Swagger kontrol yolu

Değişen tek yazma uç noktası ek yüklemedir (SECURITY §11 alanları):

- **Endpoint / metot:** `POST /api/v1/projects/{projectId}/tasks/{taskId}/attachments` (silme: `DELETE .../attachments/{attachmentId}`).
- **Kimlik doğrulama:** oturum çerezi + `X-XSRF-TOKEN`.
- **Rol / kapsam:** proje üyesi, `TASK_WORK`; silmede yükleyen kişi veya `TASK_MANAGE`. Proje görev modeli seçilmiş olmalı; Gelişmiş görev için proje ADVANCED/BOTH olmalı.
- **Gövde:** `multipart/form-data`, tek parça `file`. Sorgu parametresi yok.
- **Güvenli örnek girdi:** birkaç KB'lık bir `ekran.png`.
- **Başarı:** `201` + ek özeti (`id`, `fileName`, `contentType`, `sizeBytes`, …); silmede `204`.
- **Önemli hatalar:** `400 TASK_ATTACHMENT_IMAGE_TOO_LARGE` (görsel > 1 MB), `400 TASK_ATTACHMENT_TOO_LARGE` (> 10 MB), `400 TASK_ATTACHMENT_TYPE` (izin verilmeyen tür veya içeriği uzantısıyla uyuşmayan dosya), `400 TASK_ATTACHMENT_INVALID` (boş ya da bozuk dosya), `409 TASK_MODE_NOT_ALLOWED` (Basit görevde görsel dışı dosya veya politikası kapalı Gelişmiş görev), `409 PROJECT_TASK_MODE_NOT_CONFIGURED`, `409 TASK_ATTACHMENT_LIMIT` (20), `401` oturumsuz, `403` CSRF/yetki, proje dışı kullanıcıya mevcut gizleme politikası.

Okuma tarafında `GET .../tasks`, `GET .../tasks/{taskId}`, `GET /api/v1/tasks/mine` ve havuz yanıtlarına `assigners` dizisi eklendi (yalnız ek alan). `PATCH .../tasks/{taskId}` ile Basit'e dönüşümde görseller artık `TASK_MODE_CONVERSION_BLOCKED` üretmez.

Swagger açıksa (`API_DOCS_ENABLED=true`) `/swagger-ui/index.html` → "Upload attachment"; normal girişten sonra `GET /api/v1/auth/csrf`, mutasyonlarda `X-XSRF-TOKEN`. Örneklerde parola, çerez veya token kullanılmaz.

## Açık konular / kullanıcının manuel kontrolü

- Commit, push ve deployment yapılmadı. Backend önce veya frontend ile birlikte yayınlanmalı: yeni frontend eski backend'e karşı Basit görevde görsel yüklemeyi 409 ile kaybeder (görev yine oluşur, uyarı çıkar); eski frontend yeni backend ile sorunsuz çalışır.
- `CentralChatMigrationTest` bu teslimden bağımsız olarak kırık ve tam `verify`'ı düşürüyor: v42 sonrası tam 4 migration (43–46) bekliyor, kaynakta V48 de olduğu için sayı tutmuyor. Yerel koşuda 6 çıkması, `clean` yapılmadığı için `target/classes` içinde başka daldan kalmış bir `V47` bulunduğunu düşündürüyor (doğrulanmadı). Bu teslimde düzeltilmedi; beklentinin güncellenmesi ayrı bir karar.
- Bu dalda `V47` yok, `V48` var; `V47` başka dallarda. Canlı veritabanında hangi sürümlerin uygulandığı deploy öncesi kontrol edilmeli (Flyway doğrulaması açılışı durdurabilir). Bu teslim migration eklemez.
- `.agents/*` belgelerinde ve `db/migration/README.md`'de önceden commit edilmiş merge-conflict işaretleri duruyor; bu teslimde yalnız ilgili satırlar güncellendi.
- Ekran görüntüleri sık sık 1 MB'ı aşar; istemci tarafı otomatik küçültme yok. Ek yüklemede kullanıcı başına hız sınırı/kota hâlâ açık madde (SECURITY ek tehdit notu).
- Oluşturma formu gif kabul etmez (önizleme doğrulaması png/jpeg/webp); gif detay sayfasından eklenebilir.

Elle kontrol:

1. Bir görevi başka bir üyeye atayın; Görevler (tablo + kart) ve o üyenin Görevlerim sayfasında solda sizin resminiz, yeşil akan ok ve atanan görünmeli. Kendinize atadığınız veya havuzdan alınan görevde ok olmamalı.
2. Açık/koyu tema ve mobil genişlikte oku kontrol edin; işletim sisteminde "hareketi azalt" açıkken ok durmalı.
3. Panoda "Tamamlananları gösterme"yi işaretleyin: Tamamlandı kartları gizlenmeli, sütun kalmalı; bir kartı o sütuna sürükleyip tamamlayın; sayfayı yenileyince tercih korunmalı.
4. Basit ve Gelişmiş görev oluştururken iki görsel ekleyin, 1 MB'tan büyük bir görselin reddedildiğini görün; kayıttan sonra detayda görseller görünmeli.
5. Basit görevin detayında pdf yüklemeyi deneyin (kabul edilmemeli); Gelişmiş görevde pdf ve görsel birlikte çalışmalı.
6. Yalnız görsel taşıyan Gelişmiş görevi Basit'e çevirin; görseller yerinde kalmalı.
