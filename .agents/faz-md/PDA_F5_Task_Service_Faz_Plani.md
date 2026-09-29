# PDA — Faz 5: Task Service / Task Module Uygulama Planı

**Dosya hedefi:** `docs/plans/F5_TASK_SERVICE_IMPLEMENTATION_PLAN.md`  
**Durum:** Uygulama planı / contract-freeze adayı  
**Kapsam:** Task Core + Project entegrasyonu + Assignment + Workflow + History + REST API + backend authorization + frontend handoff  
**Mimari:** Modular Monolith  
**Not:** Projede günlük dilde “Task Service” denebilir; teknik olarak ayrı deploy edilen microservice değil, `com.pda.task` iş modülüdür.

---

## 1. Fazın Amacı

Auth/User ve Project/ProjectMembership tarafı tamamlandıktan sonra PDA'nın son ana çekirdek iş modülü olan Task modülünü oluşturmak.

Bu faz sonunda:

- Task oluşturulabilir, görüntülenebilir, düzenlenebilir ve arşivlenebilir.
- Task her zaman bir Project'e ait olur.
- Project bazlı okunabilir task key üretilebilir (`PDA-123` benzeri).
- Task bir veya birden fazla project member'a atanabilir.
- Assignment yalnız ilgili Project'in aktif üyeleri için yapılabilir.
- Task lifecycle backend tarafından yönetilir.
- `BLOCKED`, ana status'tan bağımsız tutulur.
- Her gerçek status değişikliği `TaskStatusHistory` üretir.
- Cross-project erişim backend tarafından engellenir.
- Project archive/membership durumu Task use-case'lerinde dikkate alınır.
- Task event contract'ları ileride Activity / Notification / Mail modüllerine hazır olur.
- Task REST API `/api/v1` ve mevcut `ProblemDetail` standardıyla sunulur.
- Pagination baseline tamamlanır.
- Frontend için API contract freeze edilir.

---

## 2. Source of Truth ve Başlangıç Kuralları

Bu faz başlamadan önce ajan/geliştirici sırasıyla şunları okur:

1. `AGENTS.md`
2. `.agents/SECURITY.md`
3. `.agents/architecture.md`
4. `.agents/folder-structure.md`
5. `.agents/api.md`
6. `.agents/authentication.md`
7. `.agents/database.md`
8. `.agents/decisions/0001-modular-monolith.md`
9. `.agents/decisions/0002-postgresql.md`
10. `.agents/decisions/0003-cookie-auth.md`
11. `docs/compliation/` altındaki Auth ve Project completion kayıtları
12. Bu Faz 5 planı

### Zorunlu mimari kurallar

- Task modülü Project repository'sine doğrudan erişemez.
- Task modülü Project JPA entity'sini import edemez.
- Task modülü User/Auth repository'sine doğrudan erişemez.
- Senkron cross-module ihtiyaçlar public `contract` / facade üzerinden çözülür.
- Event payload'ları persistence entity taşımaz.
- `shared` içine Task/Project domain modeli taşınmaz.
- Auth token parse işlemi Task modülünde yapılmaz; mevcut Spring Security principal kullanılır.
- Backend authorization source-of-truth'tur.
- `.env` veya `.env.example` değişikliği gerekirse önceden kullanıcı onayı gerekir.
- Migration numarası başlamadan önce gerçek repository'den belirlenir.
- Plan dokümanı uygulanmış kod sayılmaz; gerçek kod her task öncesi kontrol edilir.

---

## 3. Faz 5 Öncesi Zorunlu Repo Preflight

### F5-00 — Current Repo Audit + Contract Freeze

**Amaç:** Task implementasyonundan önce tamamlanmış Auth ve Project modüllerinin gerçek kod sözleşmesini doğrulamak.

Kontrol edilecekler:

- `ProjectRole` gerçek enum değerleri.
- Teknik `MemberPosition` değerlerinin authorization vermediği.
- Project archive modeli ve field/semantics.
- Project public contract/facade sınıfları.
- Project membership lookup yapılabilen mevcut public metodun olup olmadığı.
- Batch membership lookup imkânı.
- Project slug public contract'ta mevcut mu?
- Project member removal event'i mevcut mu?
- Auth principal içinden `currentUserId` alma standardı.
- Global `ADMIN` kontrolünün mevcut yöntemi.
- Kullanılan UUID tipi ve audit timestamp standardı.
- En son Flyway migration numarası.
- Mevcut Task placeholder / yarım kod.
- Mevcut test package standardı.
- `docs/compliation/` altında Auth/Project teslim kayıtları.
- `.agents/api.md` / `.agents/authentication.md` ile gerçek `ProjectRole` kodu arasında drift olup olmadığı.

### F5-00 çıktısı

Aşağıdaki kısa contract notu üretilir:

```text
ProjectRole:
Project read rule:
Project write rule:
Project archive rule:
Membership lookup contract:
Member removal event:
Current user id source:
Global ADMIN source:
Current highest Flyway:
Task package status:
Docs drift:
```

**Gate:** F5-00 tamamlanmadan F5-01'e geçilmez.

---

# 4. Task Modülünün Project Modülü ile Bağlantısı

Task modülü Project modülüne dört ana noktada ihtiyaç duyar:

1. Project var mı / archived mı?
2. Request yapan kullanıcı Project'e erişebilir mi ve mevcut ProjectRole nedir?
3. Assignee olmak istenen kullanıcılar bu Project'in aktif üyesi mi?
4. Task key için Project'in public slug/prefix bilgisi nedir?

## 4.1 Kesin yasak

Aşağıdaki bağlantılar kurulmaz:

```text
TaskService -> ProjectRepository
TaskService -> ProjectEntity
TaskAssignment -> @ManyToOne UserEntity
Task -> @ManyToOne ProjectEntity
```

## 4.2 Hedef bağlantı

```text
Task Application
    |
    v
Project public contract / facade
    |
    v
Project Application
    |
    v
Project Repository
```

Task persistence tarafında cross-module referanslar scalar UUID olarak tutulur:

```java
private UUID projectId;
private UUID createdBy;
private UUID updatedBy;
```

TaskAssignment için:

```java
private UUID taskId;
private UUID userId;
private UUID assignedBy;
```

## 4.3 Önerilen Project Task Contract

Mevcut Project contract aynı ihtiyacı karşılıyorsa yeni interface oluşturulmaz.

Eksikse minimal public contract eklenir:

```java
public interface ProjectTaskAccessContract {

    ProjectTaskContext getTaskContext(UUID projectId, UUID actorUserId);

    Map<UUID, ProjectMemberSnapshot> getActiveMembers(
        UUID projectId,
        Set<UUID> userIds
    );
}
```

Örnek DTO:

```java
public record ProjectTaskContext(
    UUID projectId,
    String slug,
    boolean archived,
    ProjectRole actorRole
) {}
```

```java
public record ProjectMemberSnapshot(
    UUID userId,
    boolean active
) {}
```

Project persistence entity dönülmez.

### Neden batch member lookup?

Bir task'a 5 kullanıcı atanacaksa Project modülüne 5 ayrı çağrı yapılmamalı.

Yanlış:

```text
for each userId -> projectService.isMember(...)
```

Doğru:

```text
getActiveMembers(projectId, distinctAssigneeIds)
```

---

# 5. Project Entegrasyonunun Use-case Bazlı Akışı

## 5.1 Task Create

```text
HTTP request
 -> authenticated principal
 -> TaskApplicationService
 -> ProjectTaskAccessContract.getTaskContext(projectId, actorId)
 -> project exists?
 -> project archived değil?
 -> actor create yetkisine sahip mi?
 -> project scoped counter
 -> task key
 -> Task save
 -> TaskCreatedEvent
```

## 5.2 Task Get / List

```text
actor
 -> project read access check
 -> query sadece path'teki projectId ile scope edilir
 -> archived task default listede gösterilmez
```

Cross-project task ID bilinse bile Project A kullanıcısı Project B task'ını okuyamaz.

## 5.3 Task Update

```text
task.projectId == path.projectId
AND
project archived değil
AND
task archived değil
AND
actor'ın current project access'i uygun
```

## 5.4 Assignment

```text
request assigneeIds
 -> distinct hale getir
 -> Project contract ile batch membership validation
 -> bütün assignee'ler aynı project'in active member'ı mı?
 -> authorization
 -> current assignment set
 -> diff
 -> insert/delete
 -> TaskAssignedEvent / TaskUnassignedEvent
```

## 5.5 Status / Block

Her mutation öncesi current project access doğrulanır.

Project rolü Task tablosuna kopyalanmaz.

---

# 6. Project Membership Sonradan Değişirse

Assignment anında kullanıcı project member olabilir; daha sonra project'ten çıkarılabilir.

Bu nedenle iki katmanlı çözüm kullanılır:

1. Assignment anında senkron membership validation.
2. Membership kaldırıldığında event-driven stale assignment cleanup.

Project modülünde event mevcutsa Task onu consume eder.

Yoksa Project tarafına minimal integration event eklenir:

```java
public record ProjectMemberRemovedEvent(
    UUID projectId,
    UUID userId,
    UUID removedBy,
    Instant occurredAt
) {}
```

Task consumer:

- İlgili project'teki o kullanıcının aktif TaskAssignment kayıtlarını kaldırır.
- Task silmez.
- Task status değiştirmez.
- TaskStatusHistory değiştirmez.
- İşlem idempotent olmalıdır.

Bu değişiklik Project modülüne dokunduğu için **integration change** olarak raporlanır.

---

# 7. Auth ile Bağlantı

Task modülü Auth/User repository'sine çağrı yapmaz.

Akış:

```text
HttpOnly JWT cookie
 -> Spring Security filter chain
 -> Authentication / Principal
 -> currentUserId
 -> Task use-case
```

Task modülü:

- JWT parse etmez.
- Session doğrulamaz.
- Password/Auth logic taşımaz.
- `localStorage/sessionStorage` ile ilgili hiçbir auth state üretmez.
- Global `ADMIN` authority bilgisini mevcut security mekanizmasından kullanır.

---

# 8. Authorization Kararı

## 8.1 Source of truth

Gerçek rol isimleri F5-00'da mevcut Project kodundan alınacaktır.

Teknik planın hedef modeli:

```text
Global:
- ADMIN

Project access:
- OWNER
- MANAGER
- MEMBER
- VIEWER

MemberPosition:
- BACKEND_ENGINEER
- FRONTEND_ENGINEER
- FULL_STACK_DEVELOPER
- TESTER
- UI_DESIGNER
```

MemberPosition tek başına API yetkisi vermez.

> Eğer mevcut kod farklı enum isimleri kullanıyorsa Task modülü kendi ikinci rol modelini yaratmaz. Önce Project/Auth completion ve ADR'larla uyuşmazlık çözülür.

## 8.2 Önerilen Task capability matrisi

| İşlem | ADMIN | OWNER | MANAGER | MEMBER | VIEWER |
|---|---:|---:|---:|---:|---:|
| Task listele / görüntüle | ✅ | ✅ | ✅ | ✅ | ✅ |
| Task oluştur | ✅ | ✅ | ✅ | ✅ | ❌ |
| Task temel alan düzenle | ✅ | ✅ | ✅ | assigned/created task | ❌ |
| Assignee setini değiştir | ✅ | ✅ | ✅ | ❌ | ❌ |
| Status değiştir | ✅ | ✅ | ✅ | assigned task | ❌ |
| Block / unblock | ✅ | ✅ | ✅ | assigned task | ❌ |
| Task archive | ✅ | ✅ | ✅ | ❌ | ❌ |

Bu matris F5-00'da gerçek ProjectRole sözleşmesiyle eşleştirilip freeze edilir.

---

# 9. Task Domain Modeli

## 9.1 Task

Önerilen alanlar:

```text
id              UUID
projectId       UUID

taskNumber      BIGINT
taskKey         VARCHAR

title           VARCHAR(160)
description     TEXT nullable

status          TaskStatus
priority        TaskPriority

startDate       DATE nullable
dueDate         DATE nullable

blocked         BOOLEAN
blockedReason   VARCHAR(500) nullable

createdBy       UUID
createdAt       TIMESTAMPTZ
updatedBy       UUID nullable
updatedAt       TIMESTAMPTZ

archivedBy      UUID nullable
archivedAt      TIMESTAMPTZ nullable

version         BIGINT
```

Kurallar:

- `projectId` create sonrası değişmez.
- `taskNumber` create sonrası değişmez.
- `taskKey` create sonrası değişmez.
- `title` boş olamaz.
- `title` trim edilir.
- `dueDate < startDate` olamaz.
- Archived task normal mutation kabul etmez.
- Project archived ise task mutation kabul etmez.
- `@Version` optimistic locking için kullanılır.

## 9.2 TaskPriority

V1 önerisi:

```text
LOW
MEDIUM
HIGH
CRITICAL
```

Default:

```text
MEDIUM
```

## 9.3 TaskStatus

V1:

```text
BACKLOG
TODO
IN_PROGRESS
IN_REVIEW
TESTING
DONE
```

`BLOCKED` TaskStatus değildir.

---

# 10. Workflow Kararı

Önerilen kontrollü V1 geçişleri:

```text
BACKLOG     -> TODO

TODO        -> BACKLOG
TODO        -> IN_PROGRESS

IN_PROGRESS -> TODO
IN_PROGRESS -> IN_REVIEW

IN_REVIEW   -> IN_PROGRESS
IN_REVIEW   -> TESTING

TESTING     -> IN_REVIEW
TESTING     -> DONE

DONE        -> IN_PROGRESS
```

Böylece:

```text
BACKLOG -> DONE
TODO -> TESTING
```

gibi skip'ler reddedilir.

`DONE -> IN_PROGRESS` reopen senaryosudur.

---

# 11. BLOCKED Modeli

Blocked ana status'tan bağımsız tutulur.

Örnek:

```text
status = IN_PROGRESS
blocked = true
```

Kurallar:

- `DONE + blocked=true` geçersiz.
- DONE'a geçişte blocked otomatik `false` olur.
- DONE'a geçişte `blockedReason` temizlenir.
- Block/unblock status history oluşturmaz.
- Block/unblock daha sonra Activity event üretir.
- `blockedReason` maksimum 500 karakterdir.

---

# 12. TaskAssignment

Alanlar:

```text
id
taskId
userId
assignedBy
assignedAt
```

DB constraint:

```text
UNIQUE(task_id, user_id)
```

Kurallar:

- Bir task'ın bir veya çok assignee'si olabilir.
- V1'de sabit assignee upper limit yoktur.
- Yalnız task'ın project'inin aktif member'ı atanabilir.
- Request içi duplicate UUID'ler normalize edilir.
- Assignment set değişimi tek transaction içinde yapılır.
- Assignee membership validation Project public contract üzerinden yapılır.

Assignment endpoint'i **replace-set** mantığı kullanır.

Bu sayede request idempotent olabilir.

---

# 13. TaskStatusHistory

Alanlar:

```text
id
taskId
previousStatus
newStatus
changedBy
changedAt
```

Kurallar:

- Her gerçek status değişikliği tam bir history satırı üretir.
- Aynı status tekrar istenirse no-op kabul edilir; duplicate history üretilmez.
- History update/delete edilmez.
- History task bazında kronolojik listelenir.
- Activity ile aynı tablo/model değildir.

---

# 14. Readable Task Key

## 14.1 Hedef

Örnek:

```text
PDA-1
PDA-2
PDA-3
```

## 14.2 Project slug değişim problemi

Task key üretirken doğrudan her seferinde güncel slug kullanmak, Project slug değişince yeni task'ların farklı prefix almasına yol açabilir.

Project Service'i yeniden şema değişikliğine zorlamamak için Task modülünde bir counter/prefix snapshot tablosu kullanılması önerilir.

```text
project_task_counters
- project_id PK
- key_prefix
- last_value
```

İlk task oluşturulurken:

1. Project contract'tan slug alınır.
2. Prefix normalize edilir.
3. Counter row oluşturulur.
4. Prefix bundan sonra Task modülünde stabil kalır.

Böylece Project slug daha sonra değişse bile mevcut Project'in Task key prefix'i değişmez.

## 14.3 Concurrency

`COUNT(tasks) + 1` kullanılmaz.

PostgreSQL atomic increment yaklaşımı:

```sql
INSERT INTO project_task_counters(project_id, key_prefix, last_value)
VALUES (:projectId, :keyPrefix, 1)
ON CONFLICT (project_id)
DO UPDATE SET last_value = project_task_counters.last_value + 1
RETURNING last_value;
```

Native SQL gerekiyorsa parameter binding zorunludur.

Task constraints:

```text
UNIQUE(project_id, task_number)
UNIQUE(project_id, task_key)
```

---

# 15. Flyway / Persistence Planı

Migration numaraları bu dokümana sabit yazılmaz.

Her task başında gerçek migration klasörü kontrol edilir:

```text
backend/src/main/resources/db/migration/
```

Önerilen migration dalgası:

### F5-01

```text
tasks
project_task_counters
```

### F5-02

```text
task_assignments
```

### F5-04

```text
task_status_history
```

Önerilen indexler:

```text
tasks(project_id, archived_at, updated_at)
task_assignments(task_id)
task_assignments(user_id)
task_status_history(task_id, changed_at)
```

---

# 16. Task REST API

Base path:

```text
/api/v1/projects/{projectId}/tasks
```

Project ID'nin path'te bulunması scope kontrolünü görünür tutar.

## 16.1 Create

```http
POST /api/v1/projects/{projectId}/tasks
```

Body:

```json
{
  "title": "Login ekranı responsive düzeltme",
  "description": "Mobil görünümde form taşmasını düzelt.",
  "priority": "HIGH",
  "startDate": "2026-10-01",
  "dueDate": "2026-10-03"
}
```

Default:

```text
status = BACKLOG
blocked = false
```

## 16.2 List

```http
GET /api/v1/projects/{projectId}/tasks?page=0&size=20&sort=updatedAt,desc
```

F5 yalnız pagination baseline sunar.

Gelişmiş filter/sort F9'a bırakılır.

Allowed baseline sort alanları:

```text
taskNumber
createdAt
updatedAt
dueDate
```

Arbitrary property/SQL sort kabul edilmez.

## 16.3 Detail

```http
GET /api/v1/projects/{projectId}/tasks/{taskId}
```

## 16.4 Update Basic Fields

```http
PATCH /api/v1/projects/{projectId}/tasks/{taskId}
```

Bu endpoint yalnız:

```text
title
description
priority
startDate
dueDate
```

değiştirir.

Status / assignment / blocked ayrı use-case'tir.

## 16.5 Replace Assignees

```http
PUT /api/v1/projects/{projectId}/tasks/{taskId}/assignees
```

Body:

```json
{
  "assigneeIds": [
    "uuid-1",
    "uuid-2"
  ]
}
```

## 16.6 Change Status

```http
PATCH /api/v1/projects/{projectId}/tasks/{taskId}/status
```

Body:

```json
{
  "status": "IN_PROGRESS"
}
```

## 16.7 Block / Unblock

```http
PATCH /api/v1/projects/{projectId}/tasks/{taskId}/blocked
```

Body:

```json
{
  "blocked": true,
  "reason": "Backend contract bekleniyor"
}
```

## 16.8 History

```http
GET /api/v1/projects/{projectId}/tasks/{taskId}/history
```

## 16.9 Archive

```http
DELETE /api/v1/projects/{projectId}/tasks/{taskId}
```

Hard delete yapılmaz.

```text
archivedAt
archivedBy
```

set edilir.

---

# 17. Error Contract

Mevcut global Spring `ProblemDetail` standardı kullanılır.

| Durum | HTTP |
|---|---:|
| Request validation | 400 |
| Authentication yok | 401 |
| Project/task aksiyonu için yetki yok | 403 |
| Project veya scoped task bulunamadı | 404 |
| Path projectId != task.projectId | 404 |
| Invalid status transition | 409 |
| Archived project mutation | 409 |
| Archived task mutation | 409 |
| Optimistic lock conflict | 409 |
| Invalid assignee membership | mevcut domain validation standardına göre 400/409 |

Cross-project resource existence bilgisi response'ta sızdırılmaz.

---

# 18. Task Event Contract'ları

F8 consumer'ları henüz yoksa bile Task modülü küçük ve entity içermeyen event contract'ları üretebilir.

Minimum event seti:

```text
TaskCreatedEvent
TaskAssignedEvent
TaskUnassignedEvent
TaskStatusChangedEvent
TaskCompletedEvent
TaskBlockedEvent
TaskUnblockedEvent
TaskArchivedEvent
```

Örnek:

```java
public record TaskStatusChangedEvent(
    UUID taskId,
    UUID projectId,
    TaskStatus previousStatus,
    TaskStatus newStatus,
    UUID changedBy,
    Instant occurredAt
) {}
```

`TaskCompletedEvent`, status `DONE` olduğunda ayrıca publish edilir.

Activity/Notification/Mail consumer'ları F8'de bağlanır.

---

# 19. Transaction Sınırları

`@Transactional` application/use-case seviyesinde tutulur.

## Status

```text
changeStatus()
 -> task load
 -> project/current access
 -> task authorization
 -> transition validation
 -> status update
 -> history insert
 -> event publish
```

## Assignment

```text
replaceAssignees()
 -> task load
 -> project/current access
 -> assignment authorization
 -> Project contract batch membership check
 -> current/requested set diff
 -> insert/delete
 -> assignment events
```

Başka modülün repository'si transaction içine doğrudan çekilmez.

---

# 20. Faz 5 Mikro-Task Planı

## F5-00 — Repo Preflight + Contract Freeze

**Dependency:** Auth + Project completion  
**Kod:** Normalde yok; gerekiyorsa docs düzeltmesi.

Yapılacaklar:

- Current main doğrula.
- Auth completion kaydını oku.
- Project completion kaydını oku.
- Gerçek ProjectRole enum'u çıkar.
- Project membership contract'ını çıkar.
- Project archive contract'ını çıkar.
- Auth principal standardını çıkar.
- En son Flyway migration numarasını belirle.
- Task package mevcut durumunu çıkar.
- Docs drift raporla.
- Gerekli Project integration change'i açıkça yaz.

**Acceptance:**

- Task'ın Project ve Auth'a nasıl bağlanacağı belirsiz değil.
- Role isimleri uydurulmamış.
- Migration numarası bilinçli.
- Project repository/entity dependency planlanmamış.

**Gate:** Kullanıcı onayı.

---

## F5-01 — Task Persistence + Readable Key

**Dependency:** F5-00  
**Branch:** `feature/f5-01-task-persistence-readable-key`

Yapılacaklar:

- `Task`
- `TaskStatus`
- `TaskPriority`
- `project_task_counters`
- Task repository
- create use-case
- project existence/archive/access check
- concurrency-safe readable key
- optimistic locking
- Flyway migration
- repository/Testcontainers testleri

**Acceptance:**

- Project içinde task number/key duplicate olmaz.
- Paralel create key çakıştırmaz.
- Archived project'te create reddedilir.
- Cross-module entity import yok.
- Test suite yeşil.

---

## F5-02 — TaskAssignment + Project Membership Integration

**Dependency:** F5-01  
**Branch:** `feature/f5-02-task-assignment`

Yapılacaklar:

- `TaskAssignment`
- unique `(task_id,user_id)`
- replace-set use-case
- Project contract batch membership validation
- assignment authorization
- `assignedBy`
- `assignedAt`
- assigned/unassigned events
- member removal cleanup integration
- cross-project assignment testleri

**Acceptance:**

- Non-member atanamaz.
- Duplicate assignment yok.
- Cross-project user assignment yok.
- Yetkisiz actor assignment setini değiştiremez.
- Member removal stale assignment bırakmaz veya açık integration debt olarak merge öncesi çözülür.

---

## F5-03 — Workflow + BLOCKED

**Dependency:** F5-01  
**Branch:** `feature/f5-03-workflow-blocked`

Yapılacaklar:

- transition policy
- status change use-case
- block/unblock use-case
- DONE/blocked invariant
- task authorization
- domain/service testleri

**Acceptance:**

- Allowed transitions testli.
- Invalid transition 409'a map edilebilir domain error üretir.
- `BLOCKED` enum status değildir.
- Status generic update endpoint'iyle değiştirilmez.

---

## F5-04 — TaskStatusHistory

**Dependency:** F5-03  
**Branch:** `feature/f5-04-task-status-history`

Yapılacaklar:

- history persistence
- history repository
- status mutation ile aynı transaction'da insert
- history query
- status/completed event
- repository/service tests

**Acceptance:**

- Her gerçek status change history üretir.
- Same-status no-op duplicate history üretmez.
- History immutable.
- Actor bilgisi var.

---

## F5-05 — Task REST API + Pagination + Security

**Dependency:** F5-01..F5-04  
**Branch:** `feature/f5-05-task-api`

Yapılacaklar:

- create
- list
- detail
- basic update
- archive
- replace assignees
- change status
- block/unblock
- history
- Jakarta Validation
- OpenAPI
- ProblemDetail mapping
- pagination baseline
- sort allowlist
- MockMvc
- Spring Security Test
- cross-project IDOR tests

**Acceptance:**

- 400/401/403/404/409 davranışları testli.
- Protected endpoint public değil.
- Project A kullanıcısı Project B task'ına erişemez.
- Pagination var.
- Swagger examples secret içermez.
- API contract freeze edilebilir.

---

## F5-06 — Project Integration Hardening + Architecture Gate

**Dependency:** F5-05  
**Branch:** `feature/f5-06-task-project-integration-gate`

Yapılacaklar:

- Project contract usage review
- `ProjectRepository` import grep
- `ProjectEntity` import grep
- User/Auth repository import grep
- archived project testleri
- member removed testleri
- project slug değişimi / stable key prefix testi
- Spring Modulith architecture verification
- full backend integration test

**Acceptance:**

- Module boundary ihlali yok.
- Cross-project security suite yeşil.
- Project integration change varsa dokümante.
- F5 backend contract frozen.

---

## F5-07 — Task UI

**Dependency:** F5-05 contract freeze  
**Branch:** `feature/f5-07-task-ui`

Kapsam:

- Project detail içinden Tasks sekmesi/sayfası.
- Task list.
- Task detail.
- Create/edit form.
- Assignment UI.
- Status UI.
- Block/unblock UI.
- Loading/empty/error/validation states.
- Role-sensitive action visibility.
- Gerçek backend API.

> Frontend visibility güvenlik sınırı değildir; backend 403 testleri esas kalır.

---

## F5-08 — Task History UI + E2E Gate

**Dependency:** F5-04 contract + F5-07  
**Branch:** `feature/f5-08-task-e2e-gate`

E2E:

```text
login
 -> project
 -> create task
 -> assign project member
 -> start task
 -> block
 -> unblock
 -> review
 -> testing
 -> done
 -> history doğrula
```

Negatif E2E/API senaryoları:

```text
viewer write attempt
non-member assignment
cross-project task access
invalid status skip
archived project mutation
```

**Acceptance:** Kritik Task lifecycle gerçek backend ile geçer.

---

# 21. Test Matrisi

## Unit / Service

- Task validation.
- Date validation.
- Prefix normalization.
- Workflow transitions.
- Blocked invariants.
- Assignment diff.
- Authorization policy.

## Repository / Testcontainers PostgreSQL

- Task migration.
- Counter atomic increment.
- Unique key.
- Unique assignment.
- History order.
- Optimistic lock.

## MockMvc / Security

- unauthenticated 401
- forbidden 403
- cross-project isolation
- validation 400
- not found 404
- conflict 409
- pagination
- Swagger/OpenAPI contract

## Modulith

- Task -> Project repository dependency yok.
- Task -> Project entity dependency yok.
- Task -> Auth/User repository dependency yok.
- Public contract boundary korunuyor.

---

# 22. Task Fazında Bilinçli Olarak Ertelenenler

Aşağıdakiler Faz 5'i şişirmeyecek:

```text
Label             -> F6
Milestone         -> F6
Issue             -> F7
TestReport        -> F7
Comment           -> F7
Activity          -> F8
Notification      -> F8
Mail              -> F8
Advanced filtering-> F9
Global search     -> F9
Dashboard         -> F9
```

Event producer'ları hazırlanabilir; consumer'lar ait oldukları fazda eklenir.

---

# 23. Git / Merge Sırası

Önerilen sıra:

```text
F5-00 contract freeze
   ↓
F5-01 task core
   ↓
F5-02 assignment --------┐
                         ├─ gerekli yerlerde paralel
F5-03 workflow ----------┘
   ↓
F5-04 history
   ↓
F5-05 API contract freeze
   ↓
F5-06 integration/architecture gate
   ↓
F5-07 frontend
   ↓
F5-08 E2E gate
```

Migration lock tek backend sorumlusunda kalır.

`pom.xml`, security config, `.env.example` gibi shared dosyalar ancak gerçekten gerekirse ve ilgili onay/lock ile değiştirilir.

---

# 24. Definition of Done

Faz 5 DONE sayılmaz, ta ki:

- Task core persistence tamamlanmış.
- Readable key concurrency-safe.
- Assignment project membership ile bağlı.
- Project module repository/entity sınırı ihlal edilmemiş.
- Workflow + blocked tamamlanmış.
- Status history tamamlanmış.
- Backend RBAC ve cross-project security testli.
- REST API + pagination + ProblemDetail tutarlı.
- Modulith testleri yeşil.
- Backend full test/verify yeşil.
- Frontend gerçek API'ye bağlı.
- E2E lifecycle geçiyor.
- `docs/compliation/YYYY-MM-DD-task-service.md` oluşturulmuş.
- Swagger endpoint kontrol bilgileri completion kaydına eklenmiş.
- Açık critical/high bug yok.

---

# 25. Her Mikro-Task Öncesi Zorunlu Agent Çıktısı

Agent kodlamadan önce şunu raporlar:

```text
Task:
Amaç:
Dependency tamam mı:
Mevcut kod doğrulaması:
Dokunulacak dosyalar:
Project/Auth contract etkisi:
DB migration:
API contract:
Authorization:
Shared-file conflict:
Test planı:
Acceptance:
```

Kullanıcı onayından sonra kodlamaya başlanır.

---

# 26. Her Mikro-Task Sonrası Zorunlu Handoff

```text
Tamamlanan:
Değişen dosyalar:
Migration:
API değişikliği:
Project/Auth integration değişikliği:
Çalıştırılan testler:
Sonuç:
Açık risk:
Sonraki task:
Merge/handoff notu:
```

---

# 27. İlk Uygulama Adımı

İlk uygulanacak adım **F5-00 — Repo Preflight + Contract Freeze**'dir.

Bu adımda kod yazılmayacak; önce tamamlanmış Auth ve Project servislerinin gerçek implementation'ı okunarak Task modülünün bağlanacağı public contract'lar, roller, security principal ve migration durumu kesinleştirilecektir.

F5-00 sonucu onaylandıktan sonra **F5-01 — Task Persistence + Readable Key** başlatılır.
