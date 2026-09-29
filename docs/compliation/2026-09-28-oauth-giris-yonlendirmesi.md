# OAuth giriş yönlendirmesi

**Durum:** Tamamlandı — 28 Eylül 2026.

## Kapsam

Google ve GitHub ile başarılı girişten sonra PDA oturumu açılır ve kullanıcı `/projects` sayfasına yönlendirilir. Önceki `/` hedefi frontend tarafından koşulsuz `/login` sayfasına yönlendiriliyordu.

## Yapılanlar

- `backend/src/main/java/com/pda/auth/infrastructure/config/OAuthLoginHandlers.java`: başarılı giriş hedefi `/projects` oldu. Başarısız girişin `/login?oauth_error=...` hedefi korundu.
- `backend/src/test/java/com/pda/auth/integration/GoogleOAuthIntegrationTest.java`: yönlendirme ve verilen access cookie ile `/api/v1/auth/me` çağrısı doğrulandı.
- `backend/src/test/java/com/pda/auth/integration/GitHubOAuthIntegrationTest.java`: ortak handler'ın GitHub yönlendirme beklentisi güncellendi.
- `.agents/authentication.md`: akışın hedefi güncellendi.

## Doğrulama

`backend` içinde Java 25 ile `mvn.cmd '-Dtest=GoogleOAuthIntegrationTest,GitHubOAuthIntegrationTest' test`: **23 test geçti, 0 hata**. Testler Testcontainers PostgreSQL kullandı. `docker compose up -d --build backend`: başarılı; yeniden başlatma sonrası `/actuator/health` HTTP 200 döndü. `git diff --check`: geçti.

## Açık konular

Hesap bağlama akışının `/?oauth_link=...` yönlendirmesi bu giriş düzeltmesinin kapsamında değildir. Gerçek Google hesabıyla tarayıcı uçtan uca kontrolü kullanıcı tarafından yapılmalıdır.

## Kullanıcı kontrolü

1. Gizli pencerede `http://localhost:3000/login` üzerinden Google ile giriş yapın.
2. Adresin `/projects` olduğunu ve sağ üstte kullanıcı adının göründüğünü kontrol edin.
3. Kullanıcı menüsündeki e-posta adresinin seçtiğiniz Google hesabı olduğunu doğrulayın.
