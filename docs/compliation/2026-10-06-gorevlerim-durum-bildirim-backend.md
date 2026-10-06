# Görevlerim: durum akışı ve yönetici bildirimleri — backend

Durum: Backend teslimi tamamlandı. Tarih: 2026-10-06. Branch: `task-service-backend`. Bu kayıt yalnız backend teslimini kapsar; kart arayüzü, aynı sayfada detay açılması, onay pencereleri ve TR/EN/DE metinleri sonraki frontend teslimidir.

## Tamamlanan kapsam

- Basit görevlerde mevcut geçişlere ek olarak `BACKLOG → IN_PROGRESS` ve `IN_PROGRESS → DONE` desteklenir. Bekleyen görevi doğrudan başlatmak ve başlanmış görevi tamamlamak mümkündür. Başlanmamış görevi doğrudan bitirme desteklenmez.
- Gelişmiş görevlerde mevcut `TODO → IN_PROGRESS → IN_REVIEW → TESTING → DONE` akışı korunur. Her iki türde durum değişikliği ve yorum API'leri kullanılabilir.
- Gerçek `IN_PROGRESS` ve `DONE` değişiklikleri aynı projenin aktif Project Manager üyelerine de bildirim gönderir. Mevcut atanan/takipçi alıcılar korunur. Diğer durumlar takipçilere bildirilir.
- Yönetici aynı zamanda takipçiyse tek bildirim alır; işlemi yapan kendisine bildirim almaz. Kaldırılmış üyelik, başka projenin yöneticiliği veya yalnız global ADMIN rolü yönetici alıcısı oluşturmaz.
- Aynı durumun tekrarlanması ek geçmiş/aktivite/bildirim üretmez. Transaction rollback durumunda bildirim yazılmaz. Eşzamanlı aynı başlatma istekleri tek geçmiş ve tek bildirim oluşturur.
- `TASK_STATUS_CHANGED` bildirim tipi korunur. Yanıtlara nullable `statusChange` eklenir: `previousStatus`, `newStatus`, `taskKey`, `taskTitle`, `actorNickname`. Metinler olay anının kopyasıdır; sonradan görev adı değişse de bildirim değişmez. Mevcut İngilizce title/message de başlama/tamamlamayı açıklar.
- V56 migration yalnız nullable bildirim alanları ve tutarlılık CHECK'i ekler. Eski okunmuş/okunmamış kayıtlar ve eski JSON olay yayınları çalışmaya devam eder; onlar için `statusChange` null'dır.

## Önemli dosyalar

- [Task ve durum akışı](../../backend/src/main/java/com/pda/task/domain/Task.java), [TaskService](../../backend/src/main/java/com/pda/task/application/TaskService.java), [public TaskEvents](../../backend/src/main/java/com/pda/task/TaskEvents.java).
- [ProjectAccess](../../backend/src/main/java/com/pda/project/ProjectAccess.java) ve [uygulaması](../../backend/src/main/java/com/pda/project/application/service/ProjectAccessService.java): proje kapsamlı yönetici ID'leri.
- [Notification](../../backend/src/main/java/com/pda/notification/domain/Notification.java), [TaskStatusChange](../../backend/src/main/java/com/pda/notification/domain/TaskStatusChange.java), bildirim listener/writer/factory ve [NotificationController](../../backend/src/main/java/com/pda/notification/api/NotificationController.java).
- [V56 migration](../../backend/src/main/resources/db/migration/V56__task_status_notification_snapshots.sql).
- [API/regresyon testleri](../../backend/src/test/java/com/pda/task/TaskProgressNotificationApiIntegrationTest.java), [migration testi](../../backend/src/test/java/com/pda/notification/TaskStatusNotificationMigrationTest.java), [uzunluk/legacy testi](../../backend/src/test/java/com/pda/notification/TaskStatusNotificationFactoryTest.java) ve TaskDomainTest.
- `.agents/SECURITY.md` §11, API/mimari/veritabanı/klasör özetleri ve kapsamlı web checklist doğrulama notu güncellendi. API belgesindeki eski, basit görev havuzunu kapalı gösteren çelişkili paragraf da mevcut ortak havuz sözleşmesine düzeltildi.

## Doğrulama

Java 25 ve Maven 3.9.16 ile `backend` klasöründe:

```powershell
mvn -B -Dtest=TaskDomainTest,TaskProgressNotificationApiIntegrationTest,TaskStatusNotificationMigrationTest,TaskStatusNotificationFactoryTest,NotificationIntegrationTest,ModularityTest test
mvn -B verify
git diff --check
```

Son hedefli koşu: **19 test, 0 failure/error/skip; BUILD SUCCESS**. Tam backend koşusu: **480 test, 0 failure/error/skip; BUILD SUCCESS (Maven exit 0)**. `git diff --check`: başarılı. Maven logları local/ignored `.local/task-progress-targeted.log` ve `.local/task-progress-full-verify.log` içindedir.

Gerçek PostgreSQL/Testcontainers üzerinde V55→V56 veri koruma, Hibernate validate, alıcı kapsamı/tekilleştirme, kendi kendine bildirim engeli, yetki/CSRF, rollback, eşzamanlı istekler, yorumlar, Görevlerim DONE listesi, eski olay JSON'u ve bildirim read izolasyonu doğrulandı. Modulith sınır testi başarılıdır; Notification görev modülünün iç enum'una erişmez.

Her iki Maven koşusunda testler bittikten sonra Surefire, System.exit(0) sonrası JVM kapanışı 30 saniyeyi aştığı için fork JVM’ini sonlandırdığını logladı. Test raporlarında failure/error/skip yok; Maven exit 0 ve BUILD SUCCESS verdi. Bu test-runner kapanış davranışı bu teslimde değiştirilmedi.

Bu aşamada frontend dosyası değişmedi; ESLint/Playwright ve tüm `pre-push` kapısı bu backend doğrulamasının parçası değildir. Kullanıcı push işleminden önce repo kuralındaki `pre-push\pre-push.cmd` kapısını çalıştırmalıdır. Commit/push/merge yapılmadı.

## API ve Swagger kontrolü

SECURITY §11'deki mevcut endpointler kullanılır. Tüm yollar `/api/v1` altındadır; kimlik HttpOnly access cookie'den alınır. Mutasyonlarda `X-XSRF-TOKEN` gerekir. İstek gövdesinden aktör veya bildirim alıcısı kabul edilmez.

| Yöntem / yol | Yetki / kapsam | İstek örneği | Başarı / önemli hatalar |
| --- | --- | --- | --- |
| `PATCH /projects/{projectId}/tasks/{taskId}/status` | Aktif proje üyesi; `TASK_MANAGE` veya bu göreve atanmış `TASK_WORK` | `{"status":"IN_PROGRESS"}` veya `{"status":"DONE"}` | `200` TaskView; `400` geçersiz enum/body, `401` oturum, `403` yetki/CSRF, `404` bulunamayan/başka proje görevi, `409` geçersiz geçiş/arşiv |
| `GET /tasks/mine` | Yalnız oturum sahibine atanmış, aktif projelerdeki görevler | `?scope=OPEN` / `DONE` / `ALL`; page/size ve mevcut filtreler | `200` content/counts; `400` filtre/page, `401` oturum |
| `GET /projects/{projectId}/tasks/{taskId}` | `PROJECT_VIEW` | Body yok | `200` TaskView; `401/403/404` |
| `GET /projects/{projectId}/tasks/{taskId}/history` | `PROJECT_VIEW` | Body yok | `200` kronolojik durum geçmişi; `401/403/404` |
| `GET /projects/{projectId}/tasks/{taskId}/comments` | `PROJECT_VIEW` | `?page=0&size=50` | `200` yorum sayfası; `400/401/403/404` |
| `POST /projects/{projectId}/tasks/{taskId}/comments` | Mevcut `TASK_WORK` yoruma erişim kuralı, CSRF | `{"body":"İş tamamlandı."}` | `201` CommentView; `400` boş/uzun body, `401/403/404/409` |
| `GET /notifications` | Yalnız oturum sahibinin kayıtları | `?type=TASK_STATUS_CHANGED&page=0&size=20` | `200` sayfa, nullable statusChange; `400/401` |
| `PATCH /notifications/{notificationId}/read` | Kendi kaydı, CSRF | Body yok | `200` bildirim, statusChange korunur; `400/401/403`, başka kişinin/bulunamayan kayıt için `404` |

Yeni durum bildirimindeki örnek alan:

```json
{
  "type": "TASK_STATUS_CHANGED",
  "statusChange": {
    "previousStatus": "IN_PROGRESS",
    "newStatus": "DONE",
    "taskKey": "DEMO-1",
    "taskTitle": "Prepare demo",
    "actorNickname": "demo_worker"
  }
}
```

Swagger: mevcut ortamda açıksa `/swagger-ui/index.html`; önce `GET /api/v1/auth/csrf`, ardından normal login. Cookie aynı tarayıcı oturumunda tutulur; mutation için CSRF başlığı kullanılır. Bu teslim ENV ayarı değiştirmedi. Güvenlik/yetki matrisi için [SECURITY §11](../../.agents/SECURITY.md) kullanılmalıdır.

## Manuel kontrol ve sonraki aşama

1. Yeni backend build'ini çalıştır; Flyway V56 otomatik uygulanır. Testcontainers doğrulaması gerçek geliştirme veritabanını değiştirmez.
2. Aynı projede kurucu yönetici, takipçi olmayan ikinci yönetici ve bir atanmış kullanıcıyla basit görev oluştur. Atanmış kullanıcı görevi IN_PROGRESS, sonra DONE yapsın; iki yönetici de her gerçek değişiklikte bir bildirim almalı, yapan kullanıcı kendisine bildirim almamalı.
3. Aynı durumu tekrar gönder; bildirim ve geçmiş sayısı artmamalı. Bir başka projenin yöneticisine bu görev için bildirim gitmemeli.
4. Görev adını değiştir; önceki bildirimin taskTitle değeri eski adı korumalı. Bildirimi okunmuş işaretle; statusChange korunmalı.
5. Gelişmiş görevde doğrudan IN_PROGRESS→DONE isteği 409 vermeli; inceleme/test akışıyla DONE olmalı. Basit görevlerde yorumlar ve DONE Görevlerim listesi kullanılabilir olmalı.

Backend teslimi sonrası kullanıcı commit/push yapacak. Ardından `task-service-frontend` branch'inde, kullanıcının onayıyla kare görev kartları, aynı sayfada detay/yorum, durum onayı ve bildirim yerelleştirmesi uygulanacak. Bu frontend kapsamı henüz tamamlandı olarak işaretlenmemiştir.
