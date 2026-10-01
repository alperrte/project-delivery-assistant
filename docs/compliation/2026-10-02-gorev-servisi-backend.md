# Görev Servisi Backend Genişletmesi (Linear/Jira düzeyi)

**Tamamlanma tarihi:** 2026-10-02
**Branch:** `task-service-backend`
**Durum:** Backend tamamlandı ve doğrulandı. Frontend (`task-service-frontend`) sonraki iştir. Commit/push yapılmadı.

## Kapsam

Faz 5 çekirdek Task API'si şu özelliklerle genişletildi:

- **Saatli deadline ve hatırlatma:** `dueDate` yerine `deadlineAt` (ISO-8601 anı). `TaskDeadlineScheduler` her `pda.task.deadline-scan-interval` (varsayılan `PT5M`, ENV `TASK_DEADLINE_SCAN_INTERVAL`) aralığında 24 saat kala (`TASK_DEADLINE_SOON`) ve gecikme (`TASK_OVERDUE`) bildirimi üretir. Çift bildirim koşullu `UPDATE ... WHERE ... IS NULL` ile engellenir; deadline değişince döngü yeniden başlar.
- **Görev havuzu:** PM görevi havuza koyar (isteğe bağlı ekip hedefi), üye `claim` eder (satır kilidiyle atomik), üstlenen kişi `release` edebilir. `GET /api/v1/tasks/pool` kullanıcının üstlenebileceklerini projeler arası listeler.
- **Alt görev ve checklist**, **yorum + `@[userId]` bahsetme + birleşik aktivite akışı**, **etiketler + tahmin puanı + süre tahmini**, **ilişkiler** (`BLOCKS|RELATES|DUPLICATES`), **izleyiciler**, **dosya ekleri**, **sprintler** (özet + burndown), **zaman kayıtları**.
- **Görevlerim:** `GET /api/v1/tasks/mine` (+ `counts`), kimlik yalnız oturumdan; yalnız aktif projelerin, arşivlenmemiş, kullanıcıya atanmış görevleri.
- **Liste filtreleri sunucu tarafında:** durum, öncelik, atanan, atanmamış, arama, etiket, sprint/backlog, havuz, üst görev, gecikmiş, engelli.

Migration'lar `V37`–`V46` (ayrıntı `.agents/database.md`). Endpoint matrisi, hata kodları ve ek yükleme tehdit notu `.agents/SECURITY.md` §11 "Task Service genişletmesi" ve §18'dedir.

## Önemli dosyalar

- Controller'lar: `backend/src/main/java/com/pda/task/api/` (`TaskController`, `MyTasksController`, `TaskChecklistController` (+claim/release), `TaskCommentController`, `TaskRelationController`, `TaskWatcherController`, `TaskWorklogController`, `TaskAttachmentController`, `LabelController`), `task/sprint/api/SprintController`.
- Servisler: `task/application/` (`TaskService`, `TaskPoolService`, `MyTasksService`, `TaskCommentService`, `TaskAttachmentService`, `AttachmentPolicy`, `TaskDeadlineService/Scheduler`, …), `task/sprint/application/SprintService`.
- Modül sözleşmeleri: `project/ProjectAccess` (+`activeProjectsForUser`), `project/ProjectSummaryView`, `project/ProjectTeamDirectory` (Squad uygular), `task/TaskEvents` (Notification yalnız bunu `AFTER_COMMIT` dinler).
- Güvenlik: `SecurityBaselineConfiguration` yeni yolları allow-list'e ve 401 desenine ekler; `anyRequest().denyAll()` korunur.

## Testlerde bulunup düzeltilen gerçek hatalar

- **Worklog tarihi:** Saat dilimi UTC olduğu için UTC'nin ilerisindeki kullanıcı "bugün" kaydını gelecek tarih diye reddediyordu. Kural artık `workDate <= UTC bugün + 1 gün` (`TaskWorklog.change`).
- **Sprint başlatma:** ACTIVE bir sprint tekrar başlatılınca `SPRINT_ACTIVE_EXISTS` dönüyordu; artık doğru kod `SPRINT_NOT_PLANNED` (`SprintService.start`).

## Doğrulama

| Kontrol | Sonuç |
| --- | --- |
| `./mvnw -o test` | **BUILD SUCCESS, 299 test, 0 hata/0 skip**, `ModularityTest` dahil (Testcontainers PostgreSQL 17) |
| Yeni entegrasyon testleri | `TaskPoolAndMyTasksApiIntegrationTest` (5), `TaskCollaborationApiIntegrationTest` (4), `TaskAttachmentApiIntegrationTest` (3), `SprintAndWorklogApiIntegrationTest` (2); migrate edilen `TaskApiIntegrationTest`, `TaskDomainTest`, `NotificationIntegrationTest` |
| Kritik senaryolar | çift üstlenme yarışı (tek kazanan, `TASK_ALREADY_CLAIMED`), ekip dışı üstlenme 403, sahte png/pdf/html/svg/NUL/exe 400, bahsetmede üye olmayan bildirim almaz, zamanlayıcı ikinci çalıştırmada tekrar göndermez ve taşınan deadline yeni döngü başlatır, `/tasks/mine` başkasının görevini döndürmez, yetki matrisi, 401/403 (CSRF'siz)/404 izolasyonu, `PROJECT_ARCHIVED` |
| `docker compose up -d --build backend` | Flyway mevcut veritabanında 10 migration uyguladı (v36 → v46, hepsi başarılı), backend 10 sn'de ayağa kalktı, `/actuator/health` 200 |
| Dönüşüm kontrolü | Yerel veritabanında görev yoktu; `(due_date + 23:59) AT TIME ZONE 'Europe/Istanbul'` ifadesi SQL ile denendi (`2026-10-05` → `2026-10-05 20:59 UTC`) |
| Çalışan backend smoke | Yeni yolların tümü oturumsuz `401`; OpenAPI'de 36 task/sprint/label yolu görünüyor |
| `git diff --check` | Boşluk hatası yok |
| `.env` / `.env.example` | Değiştirilmedi; yeni Maven/npm bağımlılığı yok |

## Açık konular

- Ek yükleme ve yorum için kullanıcı başına ayrı hız sınırı yoktur (mevcut IP sınırlayıcı yalnız auth/davet yollarını kapsar). SECURITY.md'de açık konu olarak notlandı.
- Dosya baytları veritabanında tutulur (görev başına 20 × 10 MB üst sınır); büyük kullanımda nesne depolamaya geçiş ayrı karar gerektirir.
- Frontend ekranları (Görev Yönetimi, Görevlerim, Havuz, Pano, Sprintler, Etiketler) `task-service-frontend` branch'inde yapılacak.

## Kullanıcı kontrol adımları

1. `API_DOCS_ENABLED=true` ile `/swagger-ui/index.html` açın, `GET /api/v1/auth/csrf` ve giriş yapın.
2. Görev oluşturun (`deadlineAt`, etiket, atanan) → havuza koyun (`"pool":{"open":true}`) → ikinci kullanıcıyla `POST .../claim`.
3. `@[kullanıcı-uuid]` içeren yorum yazın ve bildirimi kontrol edin.
4. Dosya yükleyin ve `GET .../attachments/{id}/content` yanıt başlıklarını (`nosniff`, `CSP: sandbox`) doğrulayın.
5. Sprint oluşturun, başlatın, `complete` ile tamamlayın; `GET /api/v1/tasks/mine` sayaçlarına bakın.
