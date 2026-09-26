# Auth 200 OK ve 8 karakter şifre sözleşmesi

**Durum:** Tamamlandı, 27 Eylül 2026. Kullanıcının isteğiyle mevcut auth endpoint sözleşmesi güncellendi; sonraki faza geçilmedi.

## Kapsam ve değişen dosyalar

- [`AuthRegistrationController`](../../backend/src/main/java/com/pda/auth/api/AuthRegistrationController.java) ve [`AuthSessionController`](../../backend/src/main/java/com/pda/auth/api/AuthSessionController.java): register, login ve logout başarıda `200 OK` ve boş gövde döner. Login JWT'leri yine yalnız HttpOnly cookie ile iletir; logout session revoke ve cookie temizleme davranışını korur. Swagger/OpenAPI başarı kodları `200` olarak güncellendi.
- [`RegisterRequest`](../../backend/src/main/java/com/pda/auth/api/dto/request/RegisterRequest.java): local kayıt şifresi 8–128 karakter; confirm password eşleşmesi zorunlu. BCrypt, CSRF, CORS, IP hız sınırı ve ProblemDetail hataları korunur.
- [`AuthRegistrationHttpTest`](../../backend/src/test/java/com/pda/auth/api/AuthRegistrationHttpTest.java) ve [`LocalAuthIntegrationTest`](../../backend/src/test/java/com/pda/auth/integration/LocalAuthIntegrationTest.java): 8 karakter kabulü, 7 karakter reddi, üç `200` yanıtı, HttpOnly cookie ve OpenAPI şemasındaki `minLength: 8` doğrulandı.
- [Alper planı](../../.agents/faz-md/alper.md) ve [kimlik sözleşmesi](../../.agents/authentication.md) güncellendi. Eski teslim kayıtlarına bu kararın bağlantısı eklendi.

Migration, yeni ENV veya secret yoktur. Auth endpoint'lerinin sahipliği ve izinleri değişmedi.

## API sözleşmesi ve kullanıcı kontrolü

| Endpoint | Kimlik/istek | Başarı | Önemli hatalar |
| --- | --- | --- | --- |
| `POST /api/v1/auth/register` | Public + CSRF; email, nickname, 8–128 karakter password, aynı confirmPassword | `200`, boş gövde; hesap `ACTIVE/PENDING` | `400` alan/eşleşme, `403` CSRF, `409` çakışma, `429` hız sınırı |
| `POST /api/v1/auth/login` | Public + CSRF; email, password | `200`, boş gövde; iki HttpOnly cookie | `400` alan, `401` kimlik, `403` CSRF, `429` hız sınırı |
| `POST /api/v1/auth/logout` | Public + CSRF; refresh cookie varsa kullanılır | `200`, boş gövde; session revoke ve cookie temizleme | `403` CSRF |

Backend'i yeniden başlatın. `API_DOCS_ENABLED=true` ile `/swagger-ui/index.html` sayfasını yenileyip üç POST endpoint'in `200` açıklamasını kontrol edin. Önce `GET /api/v1/auth/csrf` ile CSRF cookie'si alın; UI otomatik `X-XSRF-TOKEN` header'ı göndermelidir. Benzersiz email/nickname ve 8 karakterlik bir şifreyle register `200`, aynı kimlikle login `200`, sonra `/api/v1/auth/me` `200`, logout `200`, ardından `/me` `401` dönmelidir. Gerçek şifreyi ekran görüntüsünde veya logda paylaşmayın.

## Doğrulama ve açık konular

- `backend` dizininde `mvn -Djava.version=24 -Dtest=AuthRegistrationHttpTest,LocalAuthIntegrationTest clean test`: **14 test, 0 hata, 0 atlanan test**.
- `backend` dizininde `mvn -Djava.version=24 test`: **33 test, 0 hata, 0 atlanan test**. Docker PostgreSQL çalışıyordu; yerel JDK 24 için yalnız test komutunda sürüm override kullanıldı.
- Başarı gövdeleri boş kalır; `200` kodu cookie içeriğini JSON'a taşımaz. Eski API istemcileri `202`/`204` bekliyorsa yanıt kodu beklentilerini güncellemelidir.
