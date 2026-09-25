# API rehberi

> Durum: teknik plan kararı. Endpoint adları, DTO alanları ve feature davranışları ilgili geliştirme planında kesinleştirilir. Bu belge henüz yayımlanmış bir API sözleşmesi değildir.

## Temel sözleşme

- Backend, Spring MVC ile REST API sunar. İlk major sürümün kökü `/api/v1` olur.
- Yeni bir feature, tek başına `/api/v2` gerektirmez. Yeni major yol yalnız geriye uyumsuz değişiklik için açılır. Geçiş döneminde iki sürüm birlikte çalışabilir; mümkün olduğunda aynı application/domain mantığını kullanır.
- Backend, kimlik ve yetki kontrolünün esas sahibidir. Frontend görünürlüğü güvenlik sınırı değildir.
- İstek doğrulaması backend'de Jakarta Validation ile yapılır. Client'a stack trace, SQL hatası veya altyapı sırrı dönülmez.
- Büyük listelerde sayfalama zorunludur. Sayfalama parametreleri, sıralama ve filtre alanları endpoint geliştirilirken belirlenip OpenAPI'ye eklenir.
- Swagger/OpenAPI development ve test ortamlarında açıktır. Production'da varsayılan kapalıdır; `API_DOCS_ENABLED=true|false` ile kontrol edilir. Gerçek doküman URL'si uygulama konfigürasyonundan doğrulanmalıdır.

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

Access ve refresh JWT'leri `HttpOnly` cookie ile taşınır. Tarayıcıdaki istekler cookie'leri göndermeli ve backend'in CSRF korumasına uymalıdır. Cookie isimleri, CSRF taşıma yöntemi ve auth endpoint yolları henüz belirlenmemiştir; ayrıntılar [authentication.md](authentication.md) içindedir.

V1'de global `ADMIN` ve proje bazlı `PROJECT_MANAGER`, `BACKEND_ENGINEER`, `FRONTEND_ENGINEER`, `FULL_STACK_DEVELOPER`, `TESTER`, `UI_DESIGNER` rolleri vardır. Bir kullanıcının aynı projede birden çok rolü ve farklı projelerde farklı rolleri olabilir. Sabit rol matrisi, özellik uygulanırken açıkça test edilmelidir.

## Uygulama kontrol listesi

1. Endpoint sözleşmesini OpenAPI anotasyonları/şemalarıyla güncelleyin.
2. Başarılı, doğrulama hatalı, kimliksiz ve yetkisiz davranışları MockMvc/integration testleriyle doğrulayın.
3. Kullanıcıya veya projeye özel veri için erişim kapsamını backend'de test edin.
4. Breaking change ise geçiş ve kaldırma planını sürüm notunda belirtin.

İlgili kararlar: [0001](decisions/0001-modular-monolith.md), [0003](decisions/0003-cookie-auth.md).
