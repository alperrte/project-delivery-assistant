# API rehberi

> Durum: teknik plan kararı. Endpoint adları, DTO alanları ve feature davranışları ilgili geliştirme planında kesinleştirilir. Bu belge henüz yayımlanmış bir API sözleşmesi değildir.

## Temel sözleşme

- Backend, Spring MVC ile REST API sunar. İlk major sürümün kökü `/api/v1` olur.
- Yeni bir feature, tek başına `/api/v2` gerektirmez. Yeni major yol yalnız geriye uyumsuz değişiklik için açılır. Geçiş döneminde iki sürüm birlikte çalışabilir; mümkün olduğunda aynı application/domain mantığını kullanır.
- Backend, kimlik ve yetki kontrolünün esas sahibidir. Frontend görünürlüğü güvenlik sınırı değildir.
- İstek doğrulaması backend'de Jakarta Validation ile yapılır. Client'a stack trace, SQL hatası veya altyapı sırrı dönülmez.
- Büyük listelerde sayfalama zorunludur. Sayfalama parametreleri, sıralama ve filtre alanları endpoint geliştirilirken belirlenip OpenAPI'ye eklenir.
- Swagger/OpenAPI development ve test ortamlarında `API_DOCS_ENABLED=true` ile açılır. Production'da varsayılan kapalıdır; `API_DOCS_ENABLED=true|false` ile kontrol edilir. Gerçek doküman URL'si uygulama konfigürasyonundan doğrulanmalıdır.

## V1 kaynak alanları

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

27 Eylül 2026 geçiş sözleşmesinde public endpoint'ler `GET /api/v1/auth/csrf`, `POST /api/v1/auth/register`, `POST /api/v1/auth/login` ve `POST /api/v1/auth/logout` olarak uygulanmıştır; POST isteklerinde CSRF zorunludur. `GET /api/v1/auth/me` access cookie ve aktif session gerektirir. Register doğrudan `ACTIVE` hesap üretir, email durumu `PENDING` kalır. Verify/resend yolları kapalıdır ve frontend auth fazına ertelenmiştir. Diğer API yolları deny-all kuralında kalır. `API_DOCS_ENABLED=true` iken yalnız Swagger UI ve OpenAPI dokümantasyonunun GET yolları public olur; `false` iken bu yollar da kapalıdır. Varsayılan `false` üretimde güvenli başlangıç sağlar; `.env.example` development için `true` örneği taşır. Swagger UI: `/swagger-ui/index.html`, JSON: `/v3/api-docs`. POST denemeleri için önce `/api/v1/auth/csrf` çağrısıyla `XSRF-TOKEN` cookie'si alınır; Springdoc UI standart `X-XSRF-TOKEN` header'ını ekler.

V1'de global `ADMIN` ve proje bazlı `PROJECT_MANAGER`, `BACKEND_ENGINEER`, `FRONTEND_ENGINEER`, `FULL_STACK_DEVELOPER`, `TESTER`, `UI_DESIGNER` rolleri vardır. Bir kullanıcının aynı projede birden çok rolü ve farklı projelerde farklı rolleri olabilir. Sabit rol matrisi, özellik uygulanırken açıkça test edilmelidir.

## Uygulama kontrol listesi

1. Endpoint sözleşmesini OpenAPI anotasyonları/şemalarıyla güncelleyin.
2. Başarılı, doğrulama hatalı, kimliksiz ve yetkisiz davranışları MockMvc/integration testleriyle doğrulayın.
3. Kullanıcıya veya projeye özel veri için erişim kapsamını backend'de test edin.
4. Breaking change ise geçiş ve kaldırma planını sürüm notunda belirtin.

İlgili kararlar: [0001](decisions/0001-modular-monolith.md), [0003](decisions/0003-cookie-auth.md).
