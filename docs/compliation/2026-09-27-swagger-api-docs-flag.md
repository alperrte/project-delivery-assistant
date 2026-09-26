# Swagger API_DOCS_ENABLED bayrağı

**Durum:** Tamamlandı, 27 Eylül 2026. Bağımsız Auth güvenlik yapılandırması düzeltmesi. Sonraki faza geçilmedi.

## Kapsam ve ön kontrol

Mevcut Springdoc bağımlılığı ve `API_DOCS_ENABLED` ENV sözleşmesi hazırdı. Önceki yapılandırmada bayrak Springdoc endpointlerini açsa bile Spring Security deny-all kuralı Swagger yollarını reddediyordu. Kullanıcının açık isteğiyle bayrak, dokümantasyonun HTTP erişimini de kontrol eder. Yeni ENV/secret, migration, dependency, `.env` veya `.env.example` değişikliği yoktur. Auth endpoint yetkileri, CSRF ve CORS kuralları korunmuştur.

## Değişiklikler

- [SecurityBaselineConfiguration](../../backend/src/main/java/com/pda/auth/infrastructure/config/SecurityBaselineConfiguration.java): yalnız `API_DOCS_ENABLED=true` iken Swagger UI ve OpenAPI için gerekli **GET** yolları public allowlist'e girer. `false` iken deny-all kapsamında kalır. POST veya diğer uygulama yolları bu bayrakla açılmaz.
- [application.properties](../../backend/src/main/resources/application.properties): API docs ve Swagger UI için ENV yoksa varsayılan `false`; bu, production varsayılan kapalı kuralıyla uyumludur. `.env.example` içindeki `API_DOCS_ENABLED=true` geliştirme örneği değişmedi. Aynı bayrak Springdoc'un mevcut `XSRF-TOKEN` cookie / `X-XSRF-TOKEN` header desteğini Swagger UI için açar.
- [LocalAuthIntegrationTest](../../backend/src/test/java/com/pda/auth/integration/LocalAuthIntegrationTest.java) ve [BackendApplicationTests](../../backend/src/test/java/com/pda/backend/BackendApplicationTests.java): açık/kapalı durumda gerçek HTTP endpointleri ve UI statik varlığı test edildi. `.agents/api.md`, `.agents/authentication.md` ve `.agents/architecture.md` güncellendi.

## HTTP sözleşmesi ve Swagger kontrolü

| Yöntem / yol | Kimlik/rol, istek | Bayrak `true` | Bayrak `false` |
| --- | --- | --- | --- |
| `GET /swagger-ui/index.html` | Public, rol yok; body/query yok | `200`, Swagger UI HTML | `403` |
| `GET /swagger-ui/swagger-ui.css` ve diğer UI varlıkları | Public, rol yok; body/query yok | `200`, statik içerik | `403` |
| `GET /v3/api-docs` | Public, rol yok; body/query yok | `200`, OpenAPI JSON | `403` |
| `GET /v3/api-docs/swagger-config` | Public, rol yok; body/query yok | `200`, UI config | `403` |

Güvenli örnek istek: `GET http://localhost:8080/v3/api-docs`. Port `.env` içindeki `BACKEND_PORT` değerine göre değişir. Swagger UI adresi `http://localhost:8080/swagger-ui/index.html` olur. `POST /api/v1/auth/register` veya `/login` için Swagger'da önce `GET /api/v1/auth/csrf` çağrılıp `XSRF-TOKEN` cookie'si alınmalıdır; UI standart CSRF cookie/header desteğiyle sonraki isteğe `X-XSRF-TOKEN` ekler. Cookie auth ve backend yetki kuralları etkilenmez.

## Doğrulama

- Docker PostgreSQL ile `backend` içinde `mvn -Djava.version=24 clean test`: **30 test, 0 failure, 0 error, 0 skipped; BUILD SUCCESS**. Repo Java 25 hedefliyor; bu makinedeki JDK 24 nedeniyle yalnız test koşusunda override kullanıldı.
- `API_DOCS_ENABLED=true`: UI HTML, CSS, JSON ve swagger config HTTP 200; Springdoc CSRF ayarı etkin.
- `API_DOCS_ENABLED=false`: aynı yollar HTTP 403. Kayıt/login/logout ve diğer güvenlik testleri regressionsuz geçti.
- Git push/merge/release yapılmadı.

## Açık konular ve kullanıcı kontrolü

- `true` ayarı Swagger/OpenAPI dokümanını kimliksiz erişime açar. Production ortamında ENV yoksa varsayılan kapalıdır; production'da `true` verilmesi bilinçli bir public dokümantasyon kararıdır.
- `.env` değişkenini değiştirdikten sonra backend yeniden başlatılmalıdır. Docker Compose kullanılıyorsa backend container yeniden oluşturulmalıdır; yalnız dosyayı kaydetmek çalışan Spring context'ini değiştirmez.
- Geliştirmede `API_DOCS_ENABLED=true` ile backend'i başlatıp UI ve JSON adreslerinin açıldığını kontrol edin. Ardından `false` ile yeniden başlatıp aynı adreslerde `403` bekleyin. Swagger'da POST denemesi yapmadan önce `/api/v1/auth/csrf` çağrısını çalıştırın.
