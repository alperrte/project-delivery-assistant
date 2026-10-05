# Basit ve gelişmiş görev modeli — backend teslimi

## Teslim ve durum

2026-10-05 — Onaylanan planın **backend kapsamı tamamlandı**. Çalışma `task-service-backend` branch'inde yapıldı. Frontend uygulaması ayrı aşamadır; kullanıcı backend'i pushlayıp branch değiştirdikten sonra yeni izinle başlayacak. Git add/commit/push veya branch değişimi yapılmadı.

Plan: [Basit/gelişmiş görev modeli](2026-10-05-task-basit-gelismis-plan.md). Plan içindeki ilk kod taraması, planlama anının tarihsel durumudur.

## Tamamlanan kapsam

- Projede kalıcı `taskManagementMode: SIMPLE | ADVANCED | BOTH`; yeni projede ilk seçim yapılana kadar null. İlk seçim ve sonraki değişiklik yalnız aktif proje kurucusuna aittir. Başka Project Manager veya global ADMIN bu yetkiyi alamaz.
- Görevde kalıcı `creationMode: SIMPLE | ADVANCED`. Eski görevler ADVANCED, eski projeler BOTH olarak korunur. Tür göndermeyen eski POST istemcisi ADVANCED sayılır; proje politikası yine denetlenir.
- Basit görev: başlık, açıklama, öncelik, başlangıç/bitiş tarihi ve kişilere atama. Yorumlar/mention, durum, arşiv ve geçmiş iki türde de çalışır.
- Üst/alt görev, checklist, etiket, sprint, tahmin, worklog, havuz/team/claim/release, ilişki, ek dosya, manuel izleme ve yeni engel ekleme gelişmiş tür/politika gerektirir. Kontroller bütün ilgili mutation servislerindedir; yalnız UI görünürlüğüne dayanmaz.
- Proje SIMPLE'a geçince eski gelişmiş kayıtlar silinmez. Temel düzenleme, yorum, durum ve mevcut engeli kaldırma çalışır; gelişmiş mutation kapanır. Eski gelişmiş veri okumaları ve ek indirme mevcut yetkilerle korunur.
- Görev listesinde tür filtresi DB'de sayfalamadan önce uygulanır. Liste/detay/alt görev/Görevlerim/havuz TaskView'ları creationMode taşır. Claim edilemeyen projeler kişisel havuz listesi ve sayacından çıkarılır.
- PATCH'te gönderilmeyen tahmin/parent/sprint alanları korunur; açık null yalnız gelişmiş yazma açıkken temizler. Temel alanların mevcut tam değiştirme semantiği korunur. Atama/etiket/havuz eksik veya null ise korunur.
- Basit→gelişmiş dönüşüm proje politikasına bağlıdır. Gelişmiş→basit; tahmin, parent/çocuk (arşivli dahil), sprint, havuz/team/claim/block, etiket/checklist/ilişki, aktif ek/worklog veya manuel izleme varken engellenir. Veriler otomatik silinmez.
- Otomatik bildirim takipçileri yorum/atama için her iki türde de kalır; manuel izleme ayrıştırıldı. Kökeni bilinmeyen eski izleyici satırları korumacı biçimde manuel sayılır. Soft-deleted ek/worklog ve ortak geçmiş satırları korunur.
- Açık `pool:{open:false,teamId:null}` isteği, gelişmiş yazma açıkken kapalı havuzda kalan ekip hedefini/claim işaretini temizleyebilir; atanan kişiler silinmez. Temel atama/durum işlemlerinin mevcut havuz kapatma davranışı korunur.
- Proje shared/exclusive kilitleri politika değişimi ile görev mutation'larını; Task row lock tür dönüşümü ile ilişkili mutation'ları tutarlı tutar. İlişkili görevler sabit UUID sırasıyla kilitlenir. Project DynamicUpdate eski metadata kaydının yeni politikayı ezmesini engeller. Kilit çatışması güvenli `409 TASK_CONFLICT` olarak döner.
- Auth/cookie/CSRF/CORS, ENV, bağımlılık veya frontend kaynakları değiştirilmedi. Yeni exact PATCH rotası mevcut authenticated allowlist'e eklendi; deny-all kuralı korunur.

## Önemli dosyalar

- [V54 migration](../../backend/src/main/resources/db/migration/V54__task_creation_modes.sql): iki tür alanı, CHECK kısıtları, aktif tür indeksi, manuel izleme ayrımı.
- [ProjectAccess](../../backend/src/main/java/com/pda/project/ProjectAccess.java), [ProjectTaskContext](../../backend/src/main/java/com/pda/project/ProjectTaskContext.java), [TaskManagementMode](../../backend/src/main/java/com/pda/project/TaskManagementMode.java): public modül sözleşmesi; Task, Project repository/entity'sine erişmez.
- [ProjectService](../../backend/src/main/java/com/pda/project/application/service/ProjectService.java), [ProjectController](../../backend/src/main/java/com/pda/project/api/ProjectController.java), [ProjectResponse](../../backend/src/main/java/com/pda/project/api/dto/response/ProjectResponse.java): kurucuya ait tercih ve response.
- [TaskCreationMode](../../backend/src/main/java/com/pda/task/domain/TaskCreationMode.java), [TaskService](../../backend/src/main/java/com/pda/task/application/TaskService.java), [TaskSupport](../../backend/src/main/java/com/pda/task/application/TaskSupport.java), [TaskUpdateRequest](../../backend/src/main/java/com/pda/task/api/TaskUpdateRequest.java), [TaskFilter](../../backend/src/main/java/com/pda/task/application/TaskFilter.java): tür, ortak guard, veri koruma ve filtre.
- Task checklist/relation/attachment/worklog/watcher/pool servisleri, LabelService ve SprintService: gelişmiş mutation kontrolleri.
- [Görev modeli API testleri](../../backend/src/test/java/com/pda/task/TaskModesApiIntegrationTest.java), [migration testi](../../backend/src/test/java/com/pda/task/TaskModesMigrationTest.java), [kilit çatışması testi](../../backend/src/test/java/com/pda/task/api/TaskLockConflictApiTest.java). Mevcut Task/Notification fixture'ları yeni proje için BOTH tercihini açıkça kaydeder.
- [.agents/SECURITY.md §11](../../.agents/SECURITY.md), [API](../../.agents/api.md), [database](../../.agents/database.md), [architecture](../../.agents/architecture.md), [folder structure](../../.agents/folder-structure.md): gerçek backend sözleşmesi güncellendi.

## Doğrulama

Java 25, Maven wrapper ve gerçek PostgreSQL Testcontainers kullanıldı. Kontroller frontend'i veya kullanıcının hesap/proje verilerini fixture olarak değiştirmedi.

| Komut / kontrol | Sonuç |
| --- | --- |
| `cd backend; .\mvnw.cmd -q -DskipTests test` | Ana kaynaklar ve test kaynakları derlendi |
| `cd backend; .\mvnw.cmd clean verify -Dlogging.level.org.hibernate.SQL=INFO` | **447 test, 0 failure, 0 error, 0 skip; BUILD SUCCESS**. Backend'in tüm testleri, Spring Modulith sınırları ve migration'lar dahil |
| `cd backend; .\mvnw.cmd -Dtest=TaskLockConflictApiTest,TaskApiIntegrationTest,TaskModesApiIntegrationTest,TaskModesMigrationTest,TaskPoolAndMyTasksApiIntegrationTest -Dlogging.level.org.hibernate.SQL=INFO verify` | **43 test, 0 failure, 0 error, 0 skip; BUILD SUCCESS**, son kilit yanıtı/havuz temizleme düzeltmelerinden sonra |
| `docker compose build backend`; son kaynak için `docker compose up -d --build backend` | Docker derleme/başlatma başarılı; mevcut PostgreSQL volume korundu |
| `GET http://localhost:8080/actuator/health` | `UP`; PostgreSQL container healthy |
| Backend Flyway başlangıç kaydı | V54 başarıyla uygulandı; schema v54 |
| `GET http://localhost:8080/v3/api-docs` | Yeni PATCH rotası ve creationMode alanı var; iç providedFields payload alanı yayınlanmıyor |
| `git diff --check` | Temiz |

Tam paket tamamlandıktan sonra eklenen güvenli kilit yanıtı ve havuz temizleme için etkilenen testler yeniden çalıştırıldı; son iki test bu hedefli kapıdadır. 447 ve 43 toplamları birbirine eklenmez, çoğu test tekrar edilmiştir.

Yeni görev modeli API testleri 32 senaryo/parametre koşumunu kapsar: kurucu/co-PM/ADMIN, CSRF, üç politika, gelişmiş payload reddi, ortak yorum/mention/durum/atama, alanların korunması ve açık null, ilişkili tablolar, tür dönüşümü, salt okunur veri, DB filtre/paging, havuz, politika/görev yarışları ve eski metadata güncellemesi. Migration testi 53→54 eski/arşivli kayıt koruması ve DB kısıtlarını doğrular.

Test JVM'i tüm testlerden sonra 30 saniye içinde kapanmadığı için Surefire fork kapatma uyarısı verdi. İki verify komutu da exit 0 ve BUILD SUCCESS döndü; test failure/error/skip yok. Kapanış gecikmesinin kök nedeni bu özellik kapsamında incelenmedi. Yerel backend normal başladı ve health UP oldu.

Frontend kaynakları değişmediğinden bu backend aşamasında ESLint/Playwright çalıştırılmadı. Planlama aşamasındaki frontend sonuçları plan kaydında ayrı tutulur; bu backend teslimi onları yeni başarılı frontend testi olarak saymaz.

## API ve Swagger kontrolü

Tam güncel yöntem/yetki/hata matrisi [SECURITY.md §11 — Simple / advanced task policies](../../.agents/SECURITY.md) içindedir. Swagger: mevcut `API_DOCS_ENABLED=true` ile `http://localhost:8080/swagger-ui/index.html`; şema `/v3/api-docs`.

Önce `GET /api/v1/auth/csrf` ve normal giriş; mutation'larda mevcut access cookie ve `X-XSRF-TOKEN`. Örneklere gerçek şifre/token/cookie yazmayın. Kimlik daima oturumdan gelir.

| Yöntem / yol | İstek ve kapsam | Başarı / önemli hatalar |
| --- | --- | --- |
| PATCH `/api/v1/projects/{projectId}/task-management-mode` | `{"mode":"BOTH"}`; yalnız aktif kurucu + CSRF | 200 ProjectResponse; 400 invalid/missing enum, 401, 403 non-founder/CSRF, 404 unknown/archived outsider, 409 PROJECT_ARCHIVED |
| GET `/api/v1/projects`, `/{projectId}`, `/by-slug/{slug}` | Mevcut proje üyeliği | 200; nullable taskManagementMode ve mevcut createdBy. Genel canEdit bu tercihin yetkisi değildir |
| POST `/api/v1/projects/{projectId}/tasks` | `{"title":"İlk görev","priority":"MEDIUM","creationMode":"SIMPLE"}`; TASK_MANAGE + CSRF | 201 TaskView; 400 TASK_SIMPLE_FIELDS_INVALID; 409 PROJECT_TASK_MODE_NOT_CONFIGURED / TASK_MODE_NOT_ALLOWED |
| PATCH `/api/v1/projects/{projectId}/tasks/{taskId}` | Örn. `{"title":"Güncel görev","priority":"HIGH"}`; TASK_MANAGE + CSRF. Tür dönüşümü için creationMode eklenir | 200; gelişmiş alanların eksik/null ayrımı. 409 TASK_MODE_CONVERSION_BLOCKED veya TASK_MODE_NOT_ALLOWED |
| GET `/api/v1/projects/{projectId}/tasks?creationMode=SIMPLE&page=0&size=20` | PROJECT_VIEW; mevcut filtrelerle birleşir | 200; doğru totalElements/totalPages, 400 geçersiz enum/paging |
| GET task detail/subtasks; GET `/api/v1/tasks/mine` / `pool` | Mevcut üyelik/kişisel kapsam | 200; creationMode bütün TaskView'larda. Kapalı projeler pool/count'tan çıkar |
| Gelişmiş task ve proje label/sprint mutation yolları | Mevcut yetki/CSRF + uygun proje ve görev türü | Mevcut başarı gövdeleri/durumları; model kapalıysa 409. Okumalar veri koruma politikasını izler |

Önemli yeni kodlar: `PROJECT_TASK_MODE_NOT_CONFIGURED`, `TASK_MODE_NOT_ALLOWED`, `TASK_MODE_CONVERSION_BLOCKED`, `TASK_SIMPLE_FIELDS_INVALID`; mevcut `TASK_CONFLICT` kilit yarışlarında da kullanılır. Mevcut 400/401/403/404/409 kapsam ve doğrulama kontrolleri korunur.

## Açık konular ve sınırlar

- **Frontend bekliyor:** form modları, (i)/bilgi dialog'u ve kullanıcıya özel “bir daha otomatik gösterme”, proje ilk seçimi/ayar alanı, sidebar, detay/düzenleme, TR/EN/DE ve URL tür filtresi sonraki teslim.
- Mevcut frontend yeni projede ilk politika seçimini sunmadığı için yeni proje görev POST'u backend'de 409 alabilir; frontend aşamasına kadar Swagger/API üzerinden kurucu tercih kaydedebilir. Eski projeler BOTH backfill'i sayesinde korunur.
- Arşivli çocuk verisi bulunan parent ve tarihsel manuel izleyicileri bulunan görev basite çevrilemez. Hiçbir veri dönüşüm amacıyla otomatik silinmez. Aktif gelişmiş veriyi temizlemek için proje ADVANCED/BOTH olmalıdır.
- Yeni ENV gerekmiyor. V54 kolonlarını geri dönüşte silmeyin; eski backend görev politikalarını uygulamaz, bu yüzden SIMPLE politikası kullanılan ortamda eski sürüme davranışsal rollback uygun değildir.
- Test JVM kapanış gecikmesi yukarıda kayıtlıdır. Production deployment veya remote Git işlemi yapılmadı.

## Kullanıcının manuel kontrolü

1. Kaydı ve SECURITY.md §11 API matrisini incele. Backend değişikliklerini kendi commit/push akışınla gönder.
2. Swagger'da yeni proje oluştur: taskManagementMode null olmalı. Görev oluşturmayı dene: PROJECT_TASK_MODE_NOT_CONFIGURED beklenir.
3. Kurucu olarak SIMPLE seç ve basit görev oluştur. Başka Project Manager ile aynı politika endpoint'ini çağır: 403 beklenir.
4. Basit görevde yorum/mention, kişi atama, durum ve temel düzenleme çalışmalı; checklist/ek/worklog/sprint/etiket/manuel watch yazma isteği reddedilmeli.
5. BOTH seç, gelişmiş bir göreve tahmin/etiket/checklist ekle. Projeyi SIMPLE'a çevir: veri okunmalı; temel güncelleme gizli alanları silmemeli; gelişmiş mutation reddedilmeli.
6. Gelişmiş verisi olan görevi SIMPLE'a dönüştür: TASK_MODE_CONVERSION_BLOCKED beklenir. Veriyi açık işlemlerle temizledikten sonra yeniden dene; yorumlar kaybolmamalı.
7. Tür filtresini sayfalama ile dene; pool listesi/count'ı yalnız basit projedeki eski havuz kayıtlarını claim edilebilir saymamalı.
8. Backend'i pushlayıp frontend branch'ine geçince frontend uygulamasına başlamak için haber ver. Bu kayıtta frontend tamamlanmış sayılmaz.
