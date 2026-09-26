# Register alan doğrulaması geri bildirimi

> **Güncel sözleşme:** [200 OK ve 8 karakter şifre kararı](2026-09-27-auth-200-and-password-8.md) bu kayıttaki 12 karakter alt sınırının ve `202` başarı kodunun yerini alır.

**Durum:** Tamamlandı, 27 Eylül 2026. Mevcut register/login fazına yönelik hata açıklaması düzeltmesi; sonraki faza geçilmedi.

## Kapsam ve değişen dosyalar

- [`AuthApiErrorHandler`](../../backend/src/main/java/com/pda/auth/api/AuthApiErrorHandler.java): `400 Invalid request fields` yanıtına yalnız `invalidFields` alan adları eklendi. Reddedilen değerler ve şifre yanıtlanmaz.
- [`AuthRegistrationController`](../../backend/src/main/java/com/pda/auth/api/AuthRegistrationController.java) ve [`PasswordConfirmationMismatchException`](../../backend/src/main/java/com/pda/auth/api/PasswordConfirmationMismatchException.java): şifre ve teyit uyuşmadığında güvenli, açık bir `ProblemDetail` mesajı döner.
- [`application.properties`](../../backend/src/main/resources/application.properties): kullanıcı onayıyla Spring Web log düzeyi `INFO` olarak sınırlandı. `DEBUG` düzeyinde framework'ün reddedilen alan değerlerini loglaması engellendi.
- [`AuthRegistrationHttpTest`](../../backend/src/test/java/com/pda/auth/api/AuthRegistrationHttpTest.java): alan adları, şifre değerinin yanıtta bulunmaması ve şifre uyuşmazlığı kontrol edildi.

Yeni migration, ENV anahtarı veya endpoint yoktur. CSRF, CORS, rate limit ve kimlik kuralları korunur.

## API ve kullanıcı kontrolü

`POST /api/v1/auth/register` public ve CSRF korumalıdır; proje rolü aranmaz. JSON body: `email` (geçerli adres, en çok 320 karakter), `nickname` (3–32 Unicode harf/rakam/alt çizgi), `password` (12–128 karakter), `confirmPassword` (şifreyle aynı). Başarı `202`; alan hatası `400`, kimlik çakışması `409`, CSRF hatası `403`, hız sınırı `429`.

Örnek güvenli hata: `{"status":400,"detail":"Invalid request fields","invalidFields":["nickname"]}`. Şifre teyidi farklıysa `detail` değeri `Password confirmation does not match` olur. İstekteki değerler hatada tekrarlanmaz.

Swagger için `API_DOCS_ENABLED=true` ile backend'i yeniden başlatıp `/swagger-ui/index.html` açın. Önce `GET /api/v1/auth/csrf` çağırıp `XSRF-TOKEN` cookie değerini `X-XSRF-TOKEN` header'ında gönderin; geçersiz nickname ile register denemesinde `invalidFields` içinde `nickname` bekleyin. Geçerli girişle `202` bekleyin. `API_DOCS_ENABLED=false` ile Swagger erişimi kapanır.

## Doğrulama ve açık konular

- `backend` dizininde `mvn -Djava.version=24 -Dtest=AuthRegistrationHttpTest clean test`: **8 test geçti**.
- `backend` dizininde `mvn -Djava.version=24 test`: **31 test geçti, 0 hata, 0 atlanan test**. Bu makinedeki JDK 24 için sürüm override kullanıldı.
- Hangi alanın reddedildiği artık yanıttan anlaşılır; kullanıcının bu oturumdaki özgün request body içeriği görülmediği için yaşadığı 400'ün kesin alanı tespit edilemedi.

## Swagger ekranı için takip kontrolü

Kullanıcının gösterdiği JSON yapısı geçerlidir; ekrandaki 10 karakterlik şifre ise en az 12 karakter kuralını karşılamaz. Gerçek şifre testlere veya kayda alınmadı. Aynı yapıda örnek bir JSON ile eklenen HTTP testi `400 Invalid request fields` ve `invalidFields: ["password"]` sonucunu doğruladı; hedefli test toplamı **9 test, 0 hata** oldu. Ekrandaki `Invalid request body` mesajı bu geçerli örneğin güncel kodda beklenen sonucu değildir. Backend yeniden başlatıldıktan ve 10 dakikalık IP hız sınırı sıfırlandıktan sonra güvenli örnekle tekrar kontrol edilmelidir; aynı mesaj sürerse gerçek ağ isteğinin gövdesi ve `Content-Type` değeri incelenmelidir.
