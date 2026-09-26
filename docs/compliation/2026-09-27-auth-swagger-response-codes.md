# Auth Swagger başarı yanıt kodları

> **Güncel sözleşme:** [200 OK ve 8 karakter şifre kararı](2026-09-27-auth-200-and-password-8.md) bu kayıttaki `202`/`204` kodlarının yerini alır.

**Durum:** Tamamlandı, 27 Eylül 2026. Mevcut auth API'sinin OpenAPI açıklaması düzeltildi; sonraki faza geçilmedi.

## Kapsam

- [`AuthSessionController`](../../backend/src/main/java/com/pda/auth/api/AuthSessionController.java): login ve logout için `204 No Content` başarı yanıtı OpenAPI'de tanımlandı.
- [`AuthRegistrationController`](../../backend/src/main/java/com/pda/auth/api/AuthRegistrationController.java): register için `202 Accepted` başarı yanıtı OpenAPI'de tanımlandı.
- [`LocalAuthIntegrationTest`](../../backend/src/test/java/com/pda/auth/integration/LocalAuthIntegrationTest.java): `/v3/api-docs` JSON çıktısında üç kodun bulunduğu doğrulandı.

Endpoint davranışı, migration, ENV, güvenlik filtresi veya cookie politikası değişmedi. Login `204` yanıtında gövde bulunmaz; access ve refresh JWT'leri HttpOnly cookie ile iletilir. Logout da `204` ve boş gövde döner. Register `202` ve boş gövde döner. Auth endpoint'lerinin CSRF ve erişim gereksinimleri önceki teslimdeki gibidir.

## Doğrulama ve kullanıcı kontrolü

- `backend` dizininde `mvn -Djava.version=24 -Dtest=LocalAuthIntegrationTest clean test`: **4 test, 0 hata, 0 atlanan test**. Docker PostgreSQL kullanıldı; yerel JDK 24 için sürüm override uygulandı.
- Backend'i yeniden başlatın. `API_DOCS_ENABLED=true` iken `/swagger-ui/index.html` sayfasını yenileyin. Login ve logout altında `204`, register altında `202` yanıt açıklamasını kontrol edin. Login `204` sonrası `GET /api/v1/auth/me` isteği cookie ile `200` dönmelidir.
- Bilinen sınır: Swagger arayüzü HttpOnly cookie değerlerini JavaScript'e açmaz; cookie durumunu tarayıcının Application/Storage panelinden veya `/me` çağrısıyla kontrol edin.
