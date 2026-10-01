# API rehberi

## Proje takvim anımsatıcıları (2026-10-01)

`/api/v1/projects/{projectId}/reminders` altında tarih aralığıyla liste (`from`, `to`), detay, oluşturma, `PATCH` ile düzenleme ve silme sunulur. Anımsatıcı bir göreve değil takvime aittir; kapsamı oluşturulurken sabitlenir: `PERSONAL` yalnız yaratıcıya, `PROJECT` tüm aktif üyelere görünür ve yalnız `PROJECT_MANAGER` (`REMINDER_MANAGE`) oluşturur/düzenler/siler. Yöntem, body, yetki ve hata matrisi `SECURITY.md` §11'dedir; tablo `database.md` V35'tedir.

## Teams ve alıcı davetleri (2026-09-30)

Uygulanan yeni proje kapsamlı API `/api/v1/projects/{projectId}/teams` altında ekip listeleme (üye önizlemesi, son güncelleyen, son katılan), detay, create (`includeCreator`)/update/parent taşıma/archive, ekip üyeliği ve `GET /{teamId}/candidates?q=` aday aramasıdır. Otomatik General Team yoktur: proje ekipsiz başlar, her üye en az bir ekipte kalır ve davetler `teamId` taşır. Hatalar `ProblemDetail.code` ile döner (`TEAM_*`, `PROJECT_OWNER_PROTECTED`, `LAST_PROJECT_MANAGER`). `/api/v1/project-invitations/me` yalnız alıcının davetlerini; `/{invitationId}/accept|reject` yalnız o hesabın yanıtını sunar. `GET /api/v1/projects/{projectId}/invitations/all?status=` yöneticinin durum filtreli geçmişini ve ret mesajını döner. Mevcut üyelik/rol endpointleri Project yetkisinde kalır; `/squads` uyumluluk yolu devam eder. Yöntem, body, yetki ve hata matrisi `SECURITY.md` §11'de, uçtan uca örnekler teslim kaydındadır.

> Durum: teknik plan kararı. Endpoint adları, DTO alanları ve feature davranışları ilgili geliştirme planında kesinleştirilir. Bu belge henüz yayımlanmış bir API sözleşmesi değildir.

## Temel sözleşme

- Backend, Spring MVC ile REST API sunar. İlk major sürümün kökü `/api/v1` olur.
- Yeni bir feature, tek başına `/api/v2` gerektirmez. Yeni major yol yalnız geriye uyumsuz değişiklik için açılır. Geçiş döneminde iki sürüm birlikte çalışabilir; mümkün olduğunda aynı application/domain mantığını kullanır.
- Backend, kimlik ve yetki kontrolünün esas sahibidir. Frontend görünürlüğü güvenlik sınırı değildir.
- İstek doğrulaması backend'de Jakarta Validation ile yapılır. Client'a stack trace, SQL hatası veya altyapı sırrı dönülmez.
- Büyük listelerde sayfalama zorunludur. Sayfalama parametreleri, sıralama ve filtre alanları endpoint geliştirilirken belirlenip OpenAPI'ye eklenir.
- Swagger/OpenAPI development ve test ortamlarında `API_DOCS_ENABLED=true` ile açılır. Production'da varsayılan kapalıdır; `API_DOCS_ENABLED=true|false` ile kontrol edilir. Gerçek doküman URL'si uygulama konfigürasyonundan doğrulanmalıdır.

## V1 kaynak alanları

Task backend sözleşmesi (`/api/v1/projects/{projectId}/tasks`, create/list/detail/basic update/replace assignees/status/blocked/history/archive) F5 ile uygulanmıştır. Gerçek roller için `TASK_MANAGE` ve atanmış kullanıcıda `TASK_WORK` kullanılır; endpoint ayrıntıları ve Swagger kontrol yolu `SECURITY.md` §11 Task tablosundadır. Liste `page`, `size` ve izinli `sort` alanlarıyla sayfalanır.

Notification backend sözleşmesi `/api/v1/notifications` altında liste (`page`, `size`, `unreadOnly`, `type`), unread count, tekli read ve read-all işlemlerini sunar. Tüm işlemler authenticated user's own scope içindedir; PATCH için CSRF zorunludur. Ayrıntı ve Swagger kontrolü `SECURITY.md` §11 Notification tablosundadır.

| Alan | Planlanan kapsam |
| --- | --- |
| Authentication | Signup, login, logout, access/refresh akışı |
| User | Temel hesap ve profil yönetimi |
| Project | Oluşturma, düzenleme, görüntüleme ve üyelik yönetimi |
| Squad | Proje içi ekip ve üye yönetimi |
| Task | Oluşturma, düzenleme, durum/tarih takibi ve çoklu atama |
| Issue | Proje veya task problemi takibi |
| TestReport | Tamamlanan iş için tester sonucu |
| Notification | Kalıcı bildirim, okundu/okunmadı ve okunmamış sayı |
| Admin | Temel instance, kullanıcı ve proje yönetimi |

Bu tablo URL, HTTP yöntemi veya yanıt şeması taahhüdü değildir. Her endpoint için uygulama sırasında en az şunları belgeleyin: yol/yöntem, istek/yanıt örneği, doğrulama, kimlik ve proje rolü gereksinimi, olası hata durumları, sayfalama ve geriye uyumluluk etkisi.

## Kimlik ve erişim

Access ve refresh JWT'leri ileriki fazlarda `HttpOnly` cookie ile taşınacaktır. Faz 2'de CSRF için okunabilir `XSRF-TOKEN` cookie'si ve `X-XSRF-TOKEN` header'ı kullanılır. Auth token cookie isimleri henüz belirlenmemiştir; ayrıntılar [authentication.md](authentication.md) içindedir.

27 Eylül 2026 geçiş sözleşmesinde public endpoint'ler `GET /api/v1/auth/csrf`, `POST /api/v1/auth/register`, `POST /api/v1/auth/login` ve `POST /api/v1/auth/logout` olarak uygulanmıştır; POST isteklerinde CSRF zorunludur. `GET /api/v1/auth/me` access cookie ve aktif session gerektirir. Register doğrudan `ACTIVE` hesap üretir, email durumu `PENDING` kalır. Verify/resend yolları kapalıdır ve frontend auth fazına ertelenmiştir. Faz 4 ile public `POST /api/v1/auth/refresh` (CSRF zorunlu) ve access cookie isteyen `GET /api/v1/auth/sessions`, `POST /api/v1/auth/sessions/{sessionId}/revoke`, `POST /api/v1/auth/sessions/revoke-others` eklenmiştir; ayrıntı ve örnekler `SECURITY.md` §11 ve `docs/compliation` Faz 4 kaydındadır. Faz 5 ile Google OAuth yolları (`GET /api/v1/auth/oauth2/authorization/google`, `GET /api/v1/auth/oauth2/callback/google`; yalnız Google yapılandırıldıysa public) ve access cookie isteyen `GET /api/v1/auth/oauth/identities`, `POST /api/v1/auth/oauth/google/link`, `POST /api/v1/auth/oauth/google/unlink` eklenmiştir; ayrıntı `SECURITY.md` §11'dedir. Faz 6 ile aynı yollar GitHub için de eklenmiştir (`GET /api/v1/auth/oauth2/authorization/github`, `GET /api/v1/auth/oauth2/callback/github`; yalnız GitHub yapılandırıldıysa public) ve link/unlink `POST /api/v1/auth/oauth/{provider}/link|unlink` biçimine genelleştirilmiştir. Faz 9 ile public `POST /api/v1/auth/password/forgot` (`{email}`, her zaman `202`, hesap var/yok sızdırmaz) ve `POST /api/v1/auth/password/reset` (`{email, code, newPassword, confirmPassword}`, doğru koddan sonra hesabın tüm oturumlarını iptal eder) eklenmiştir; ikisi de CSRF ve register/login ile aynı IP hız sınırını taşır, ayrıntı `SECURITY.md` §11 Faz 9'dadır. Docker/pre-push smoke kontrolü için yalnız `GET /actuator/health` public'tir (detay göstermez, başka actuator yolu yoktur). Diğer API yolları deny-all kuralında kalır. `API_DOCS_ENABLED=true` iken yalnız Swagger UI ve OpenAPI dokümantasyonunun GET yolları public olur; `false` iken bu yollar da kapalıdır. Varsayılan `false` üretimde güvenli başlangıç sağlar; `.env.example` development için `true` örneği taşır. Swagger UI: `/swagger-ui/index.html`, JSON: `/v3/api-docs`. POST denemeleri için önce `/api/v1/auth/csrf` çağrısıyla `XSRF-TOKEN` cookie'si alınır; Springdoc UI standart `X-XSRF-TOKEN` header'ını ekler.

Global `ADMIN` PDA instance operatörüdür (platform yönetimi; proje üyeliği değildir, projelerde örtük yetkisi yoktur). Proje bazlı roller `PROJECT_MANAGER`, `BACKEND_DEVELOPER`, `FRONTEND_DEVELOPER`, `FULL_STACK_DEVELOPER`, `AI_ML_DEVELOPER`, `UI_UX_DEVELOPER`, `TESTER`, `ANALYST` olup kanonik tanım ve rol→permission matrisi `com.pda.user.RolePolicy`'dedir (`.agents/SECURITY.md` §11 Faz 7). Bir kullanıcının aynı projede birden çok rolü ve farklı projelerde farklı rolleri olabilir.

## Uygulama kontrol listesi

1. Endpoint sözleşmesini OpenAPI anotasyonları/şemalarıyla güncelleyin.
2. Başarılı, doğrulama hatalı, kimliksiz ve yetkisiz davranışları MockMvc/integration testleriyle doğrulayın.
3. Kullanıcıya veya projeye özel veri için erişim kapsamını backend'de test edin.
4. Breaking change ise geçiş ve kaldırma planını sürüm notunda belirtin.

İlgili kararlar: [0001](decisions/0001-modular-monolith.md), [0003](decisions/0003-cookie-auth.md).
