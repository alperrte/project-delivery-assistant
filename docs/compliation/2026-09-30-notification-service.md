# Notification Service teslimi — 2026-09-30

## Teslim ve durum

Backend Notification Service tamamlandı. Bildirimler PostgreSQL'de kalıcıdır; Task, Project ve Squad olaylarından üretilir. REST ile listeleme, unread count ve read işlemleri vardır. Commit/push yapılmadı.

## Olay matrisi ve yapılanlar

| Olay | Actor → recipient | Tip / kaynak | Gerekçe |
| --- | --- | --- | --- |
| Task atandı | atayan → yeni assignee | `TASK_ASSIGNED` / TASK | Yeni sorumluluk |
| Task ataması kaldırıldı | kaldıran → eski assignee | `TASK_UNASSIGNED` / TASK | Sorumluluk değişimi |
| Task durumu değişti | değiştiren → diğer assignee'ler | `TASK_STATUS_CHANGED` / TASK | Yürütülen işin lifecycle değişimi |
| Task önceliği değişti | değiştiren → diğer assignee'ler | `TASK_PRIORITY_CHANGED` / TASK | İş önceliği değişimi |
| Task termini değişti | değiştiren → diğer assignee'ler | `TASK_DUE_DATE_CHANGED` / TASK | Planlanan teslim değişimi |
| Task bloke oldu | bloke eden → diğer assignee'ler | `TASK_BLOCKED` / TASK | Aksiyon gerektiren engel |
| Project üyesi eklendi/çıkarıldı | yönetici → hedef kullanıcı | `PROJECT_MEMBER_ADDED` / `PROJECT_MEMBER_REMOVED` / PROJECT | Erişim değişimi |
| Project rolü değişti | yönetici → hedef kullanıcı | `PROJECT_ROLE_CHANGED` / PROJECT | Sorumluluk ve yetki değişimi |
| Squad üyesi eklendi/çıkarıldı | yönetici → hedef kullanıcı | `SQUAD_MEMBER_ADDED` / `SQUAD_MEMBER_REMOVED` / SQUAD | Ekip üyeliği değişimi |

Bildirim üretmeyen incelenmiş olaylar: Task create, title/description/start date edit, aynı assignee seti, aynı status, TaskCompleted (status olayıyla mükerrer olur), unblock, archive, project create/metadata/criteria/repository değişiklikleri, davet accept (kullanıcının kendi aksiyonu), squad create/update/archive. Project üyeliği çıkarılınca temizlenen Task atamaları için ayrıca unassigned bildirimi yoktur. Issue, TestReport ve Comment modülleri henüz uygulanmadığı için olay eklenmedi.

Kaynak modüller public scalar event yayımlar: [TaskEvents](../../backend/src/main/java/com/pda/task/TaskEvents.java), [ProjectMembershipEvents](../../backend/src/main/java/com/pda/project/ProjectMembershipEvents.java), [SquadMembershipEvents](../../backend/src/main/java/com/pda/squad/SquadMembershipEvents.java). [NotificationEventListener](../../backend/src/main/java/com/pda/notification/application/NotificationEventListener.java) yalnız başarılı commit sonrasında çalışır; [NotificationWriter](../../backend/src/main/java/com/pda/notification/application/NotificationWriter.java) yeni transaction ile yazar. [NotificationFactory](../../backend/src/main/java/com/pda/notification/application/NotificationFactory.java) metinleri merkezi üretir. Alıcı actor ile aynıysa kayıt oluşmaz. Atama diff'i Task Service'dedir; yeni eklenen ve çıkarılan kullanıcı için tek event yayımlanır. Notification modülü başka modülün repository/entity'sini kullanmaz. Mail ve realtime bağımlılığı yoktur.

## Veritabanı

[V31__notifications.sql](../../backend/src/main/resources/db/migration/V31__notifications.sql) `notifications` tablosunu oluşturur. `recipient_user_id` User FK'sidir; actor/project/resource scalar UUID olarak tutulur. `(recipient_user_id, created_at DESC, id DESC)` birleşik index ve okunmamışlar için aynı sıralı kısmi index vardır. Hibernate şema üretimi kullanılmaz.

## API ve Swagger kontrolü

Swagger: `API_DOCS_ENABLED=true` ortamında `/swagger-ui/index.html`. Önce `GET /api/v1/auth/csrf`, sonra login. Tüm yollar access cookie ister; PATCH ayrıca `X-XSRF-TOKEN` ister. Scope yalnız oturum sahibi, özel proje rolü gerekmez. Hatalar `ProblemDetail` biçimindedir.

| Yöntem / yol | Parametre ve güvenli örnek | Başarı | Önemli hatalar |
| --- | --- | --- | --- |
| `GET /api/v1/notifications` | `?page=0&size=20&unreadOnly=true&type=TASK_ASSIGNED`; size 1–100 | `200` `{content,page,size,totalElements,totalPages}`; content type/title/message/read/createdAt/readAt/actorUserId/projectId/resourceType/resourceId içerir | `400` geçersiz filtre/sayfa, `401` |
| `GET /api/v1/notifications/unread-count` | Body yok | `200 {"count": 1}` | `401` |
| `PATCH /api/v1/notifications/{notificationId}/read` | UUID path, body yok | `200` güncellenmiş bildirim | `400` UUID, `401`, `403` CSRF, `404` bulunamadı veya başka kullanıcıya ait |
| `PATCH /api/v1/notifications/read-all` | Body yok | `200 {"count": 2}` değişen kayıt sayısı | `401`, `403` CSRF |

## Doğrulama

- `mvn -q -DskipTests package`: geçti.
- `mvn -q -Dtest=NotificationIntegrationTest test`: geçti. Çoklu atama, diff/duplicate, self suppression, pagination, unread filtre/count/read, sahiplik, CSRF, rollback, proje rolü ve squad olayları, Task durum/öncelik/termin/blocker olayları.
- `mvn -q test`: 231 test, 0 failure, 0 error, 0 skipped; `ModularityTest` geçti.
- `git diff --check`: geçti.

## Açık konular

Frontend bildirim ekranı ve polling UI bu backend tesliminin kapsamı dışında. Realtime, e-posta bildirimi ve henüz uygulanmamış Issue/TestReport/Comment olayları eklenmedi.

## Kullanıcı kontrolü

1. Swagger'da CSRF alın ve iki kullanıcıyla login olun.
2. Birini projeye ekleyin, bir task'a atayın. Hedefin `GET /api/v1/notifications` yanıtında Project ve Task bildirimlerini, `unread-count` sonucunda artışı görün.
3. Aynı assignee setini tekrar gönderin; sayı artmamalı. Kullanıcının kendisini ataması da kendi sayısını artırmamalı.
4. Hedef kullanıcının `PATCH .../{id}/read` ve `PATCH .../read-all` işlemlerini CSRF ile deneyin; sayı azalmalı.
5. Başka kullanıcının aynı notification ID'sini read yapma denemesi `404`, CSRF'siz PATCH `403` dönmeli.
