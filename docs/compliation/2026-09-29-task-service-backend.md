# Faz 5 — Task Service Backend (F5-00–F5-06)

**Tamamlanma tarihi:** 2026-09-29
**Durum:** Backend tarafı tamamlandı (F5-00 Repo Preflight + Contract Freeze, F5-01 Task Persistence + Readable Key, F5-02 Assignment + Project Membership Integration, F5-03 Workflow + BLOCKED, F5-04 TaskStatusHistory, F5-05 Task REST API + Pagination + Security, F5-06 Project Integration Hardening + Architecture Gate). F5-07 (Task UI) ve F5-08 (Task History UI + E2E Gate) kapsam dışı — frontend Claude'a ayrı iş olarak devredilecek.

## Kapsam ve önemli dosyalar

- [Task.java](../../backend/src/main/java/com/pda/task/domain/Task.java), [TaskAssignment.java](../../backend/src/main/java/com/pda/task/domain/TaskAssignment.java), [TaskStatusHistory.java](../../backend/src/main/java/com/pda/task/domain/TaskStatusHistory.java), [TaskStatus.java](../../backend/src/main/java/com/pda/task/domain/TaskStatus.java), [TaskPriority.java](../../backend/src/main/java/com/pda/task/domain/TaskPriority.java) — domain modeli, kontrollü workflow (`BACKLOG→TODO→IN_PROGRESS→IN_REVIEW→TESTING→DONE`, `DONE→IN_PROGRESS` reopen), `BLOCKED` status'tan bağımsız, optimistic locking (`@Version`).
- [TaskService.java](../../backend/src/main/java/com/pda/task/application/TaskService.java) — use-case katmanı: create/list/detail/update/replaceAssignees/changeStatus/setBlocked/history/archive; her mutation'da Project public contract üzerinden erişim/arşiv kontrolü; `ProjectMemberRemovedEvent` dinleyerek stale assignment temizliği (idempotent).
- [TaskController.java](../../backend/src/main/java/com/pda/task/api/TaskController.java), [TaskApiErrorHandler.java](../../backend/src/main/java/com/pda/task/api/TaskApiErrorHandler.java) — `/api/v1/projects/{projectId}/tasks` REST yüzeyi, Jakarta Validation, `ProblemDetail` hata sözleşmesi, sort allowlist (`taskNumber/createdAt/updatedAt/dueDate`).
- [TaskKeyCounter.java](../../backend/src/main/java/com/pda/task/infrastructure/TaskKeyCounter.java) — `INSERT ... ON CONFLICT DO UPDATE ... RETURNING` ile atomik, parametre bağlı proje bazlı sayaç; slug değişse bile prefix stabil kalır.
- `TaskEvents.java` — scalar-only entegrasyon event'leri (`TaskCreatedEvent`, `TaskAssignedEvent`, `TaskUnassignedEvent`, `TaskStatusChangedEvent`, `TaskCompletedEvent`, `TaskBlockedEvent`, `TaskUnblockedEvent`, `TaskArchivedEvent`); consumer'lar F8'de bağlanacak.
- Migration: `V28__task_core.sql`, `V29__task_assignments.sql`, `V30__task_status_history.sql` (DB-level check constraint'ler dahil: `ck_tasks_dates`, `ck_tasks_done_blocked`, unique `(project_id, task_number)`/`(project_id, task_key)`/`(task_id, user_id)`).
- Project entegrasyonu: [ProjectAccess.java](../../backend/src/main/java/com/pda/project/ProjectAccess.java) genişletildi (`isMemberIncludingArchived`, `taskContext`, `activeMemberIds`); yeni public DTO'lar [ProjectTaskContext.java](../../backend/src/main/java/com/pda/project/ProjectTaskContext.java) ve [ProjectMemberRemovedEvent.java](../../backend/src/main/java/com/pda/project/ProjectMemberRemovedEvent.java) (Project entity/persistence taşımaz, yalnız scalar alan). `ProjectMembershipService.removeMember` artık bu event'i yayımlıyor.
- Güvenlik: [SecurityBaselineConfiguration.java](../../backend/src/main/java/com/pda/auth/infrastructure/config/SecurityBaselineConfiguration.java) Task rotalarını `authenticated()` + CSRF zincirine ekledi, CORS `PATCH` metodunu açtı; deny-by-default `anyRequest().denyAll()` korunuyor.
- Doküman güncellemeleri: `.agents/SECURITY.md` §11 Task tablosu, `.agents/api.md`, `.agents/architecture.md`, `.agents/database.md`, `.agents/folder-structure.md`, `docs/plans/F5_TASK_CONTRACT_FREEZE.md` (F5-00 contract freeze notu).

## Mimari doğrulama

- `TaskService -> ProjectRepository`, `Task -> ProjectEntity`, `TaskAssignment -> UserEntity` bağımlılığı yok; Task modülü Project/Auth'a yalnız `ProjectAccess`/`ProjectTaskContext`/`ProjectMemberRemovedEvent` üzerinden bağlı. `ModularityTest` (Spring Modulith) bunu doğruluyor.
- Task persistence tarafında cross-module referanslar (`projectId`, `createdBy`, `updatedBy`, `userId`, `assignedBy`, `changedBy`) scalar `UUID`.
- Auth principal Task modülünde JWT parse etmiyor; mevcut `@AuthenticationPrincipal UserAccounts.AuthenticatedUser` kullanılıyor. Global `ADMIN` Task'a bypass vermiyor (F5-00 frozen kararıyla birebir).

## Doğrulama

| Komut / kontrol | Sonuç |
| --- | --- |
| `cd backend && GOOGLE_CLIENT_ID= GOOGLE_CLIENT_SECRET= GITHUB_CLIENT_ID= GITHUB_CLIENT_SECRET= ./mvnw.cmd clean verify` | **BUILD SUCCESS.** Tüm suite: 228 test, 0 hata/0 skip (`TaskApiIntegrationTest` 4 senaryo, `TaskDomainTest`, `ModularityTest`, Project/Squad/Auth/Admin/User test paketleri dahil). Testcontainers PostgreSQL 17 ile. |
| `TaskApiIntegrationTest` kapsamı | 401 (unauth), 403 (no CSRF, no permission, non-member, cross-project outsider), 400 (title/date/sort/size/invalid assignee), 404 (cross-project task, archived-project outsider), 409 (archived project create/mutation, invalid status transition, optimistic lock, DONE+blocked), pagination/sort allowlist, concurrent create'de benzersiz `taskNumber`/`taskKey` (6 thread), member removal → stale assignment temizliği + sonraki `TASK_WORK` denemesi 403, archive sonrası liste `totalElements=0`, OpenAPI dokümanında `/tasks` yolları var ve `PDA_ACCESS=` gibi secret sızmıyor. |
| Kaynak kod taraması (hardcoded secret) | `task/`, `ProjectTaskContext.java`, `ProjectMemberRemovedEvent.java` içinde `password=`, `secret=`, `api_key=`, private key bloğu deseni **yok**. |
| `.env` / `.env.example` | `.env` git tarafından track edilmiyor (`git ls-files .env.example` yalnız example dosyasını listeliyor); bu faz için ENV değişikliği yapılmadı (yeni ENV key yok). `.env.example` gerçek secret içermiyor. |
| `git status` | Yalnız izlenen/yeni Task+Project entegrasyon dosyaları ve ilgili `.agents/*` dokümanları değişmiş; commit/push yapılmadı. |
| `pre-push\pre-push.cmd` | **Çalıştırılmadı** — frontend derleme/E2E adımı da içeriyor ve bu görev yalnız backend'i kapsıyor; push öncesi ayrıca çalıştırılmalı. |

## Security.md uyumluluk kontrolü (bölüm 21 checklist)

- [x] Hardcoded secret yok (task/project entegrasyon dosyaları tarandı).
- [x] `.env` track edilmiyor; bu fazda `.env`/`.env.example` değişikliği yapılmadı (onay gerektiren bir değişiklik yok).
- [x] Backend'de Jakarta Validation (`@NotBlank`, `@Size`, `@NotNull`) mevcut; domain katmanında ayrıca tarih/başlık/blocked-reason doğrulaması var.
- [x] Authentication her Task rotasında `authenticated()`; `SecurityBaselineConfiguration` deny-by-default `anyRequest().denyAll()` ile kapanıyor.
- [x] Authorization: create/update/assignees/archive → `TASK_MANAGE`; status/blocked → `TASK_MANAGE` veya atanmış kullanıcıda `TASK_WORK`; read → `PROJECT_VIEW`. Global `ADMIN` istisnası yok (F5-00 frozen karara uygun).
- [x] Cross-project erişim engelli: path `projectId` ile `task.projectId` eşleşmiyorsa `404`; testte doğrulandı.
- [x] SQL: JPA/Hibernate + tek native SQL (`TaskKeyCounter`) parametre bağlı (`?`), sort alanları allowlist ile sınırlı (`taskNumber/createdAt/updatedAt/dueDate`), keyfi kolon/SQL sort kabul edilmiyor.
- [x] CORS wildcard yok; `PATCH` yalnız gerektiği için allowed-methods listesine eklendi.
- [x] CSRF: tüm Task mutasyonları `X-XSRF-TOKEN` gerektiriyor (testte doğrulandı, header yoksa `403`).
- [x] Token'lar `localStorage`/`sessionStorage` kullanmıyor; Task modülü herhangi bir auth state üretmiyor.
- [x] Loglarda/response'larda secret yok; `ProblemDetail` mesajları generic (`"Invalid request"`, `"Resource not found"`, vb.), stack trace/SQL/iç detay sızdırmıyor.
- [x] Swagger örnekleri secret içermiyor; test bunu otomatik doğruluyor (`PDA_ACCESS=` araması negatif).
- [x] İlgili testler geçti (yukarıdaki tabloya bakın).
- [ ] `pre-push\pre-push.cmd` — bu oturumda çalıştırılmadı (yalnız backend kapsamlı görev); push öncesi frontend dahil tam çalıştırılmalı.

## Açık konular

- F5-07 (Task UI) ve F5-08 (Task History UI + E2E Gate) henüz yapılmadı; bu backend'in üstüne ayrı frontend işi olarak planlanmalı.
- `pre-push\pre-push.cmd` bu oturumda çalıştırılmadı; push öncesi tam pipeline (frontend build/lint/tsc + Docker smoke dahil) ayrıca çalıştırılmalı.
- Task event'lerinin (`TaskCreatedEvent` vb.) Activity/Notification/Mail consumer'ları F8'de bağlanacak; bu fazda yalnız producer var, bilinçli olarak.

## Kullanıcı kontrolü

1. `backend/` altında `GOOGLE_CLIENT_ID= GOOGLE_CLIENT_SECRET= GITHUB_CLIENT_ID= GITHUB_CLIENT_SECRET= ./mvnw.cmd clean verify` çalıştırıp 228 testin hatasız geçtiğini doğrulayın (bu oturumda doğrulandı).
2. `API_DOCS_ENABLED=true` ile `/swagger-ui/index.html` açın; `GET /api/v1/auth/csrf` → login → bir proje oluşturun/seçin → `.agents/SECURITY.md` §11 Task tablosundaki uç noktaları sırayla deneyin (create, list, detail, update, assignees, status, blocked, history, archive).
3. Kendi üyesi olmadığınız bir projenin task'ına erişmeyi deneyip `403`/`404` aldığınızı, arşivlenmiş projede create/mutation denediğinizde `409` (üye) veya `404` (üye değil) aldığınızı doğrulayın.
4. Push'tan önce repo kökünde `pre-push\pre-push.cmd` çalıştırıp `PDA PRE-PUSH CHECK PASSED` çıktısını görün (bu oturumda çalıştırılmadı, kullanıcı tarafında yapılmalı).
