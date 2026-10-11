# Kayıt doğrulama süreleri

Tarih: 2026-10-11 (Europe/Istanbul).

## Tamamlanan kapsam

- Yeni kayıt kodu isteme süresi frontend ve backend'de **3 dakika** olarak eşitlendi. Önceden frontend düğmeyi 15 dakika sonunda gösteriyor, backend 60 saniye sonra gönderime izin veriyordu.
- Kaydın doğrulama süresi ilk gönderimden itibaren toplam **15 dakika**. Yeniden kod istemek bu süreyi uzatmaz; eski kod geçersizleşir, deneme sayısı ve yeniden gönderim beklemesi sıfırlanır.
- Süresi dolmuş kayıt verify/resend sırasında temizlenir. Mevcut dakikalık job da süresi dolan doğrulanmamış kayıtları siler; fiziksel arka plan temizliği sonraki job çalışmasında gerçekleşir. Böylece e-posta/kullanıcı adı yeniden kullanılabilir.
- Ekranda iki ayrı sayaç, süre sonunda yeniden kayıt bağlantısı, hata durumunda kodu/süreyi koruma ve başarılı yeniden gönderimde alanı temizleyip odaklama uygulandı.
- Mevcut `pda.pendingVerification` sessionStorage kaydına yalnız başlangıç/son gönderim zamanları eklendi; yeni kayıtların süreleri reload sonrası korunur. Bunlar UI bilgisi, backend zaman denetimi esas. Parola ve kod bu kayda yazılmaz.
- TR/EN/DE ekran ve kayıt e-postası metinleri sabit süreyi açıklıyor. Şifre sıfırlama/değiştirme süreleri korunuyor.
- ENV, migration, cookie/CSRF/CORS, endpoint izinleri veya IP kotası değişmedi. Normal Docker backend/DB yeniden başlatılmadı veya değiştirilmedi.

## Değişen önemli dosyalar

- Backend `auth/domain/entity/EmailVerificationChallenge.java`: 3 dakika cooldown, sabit deadline, expiry sonrası resend yasağı.
- Backend `auth/application/service/RegistrationWorkflow.java` ve `auth/infrastructure/repository/EmailVerificationChallengeRepository.java`: expiry temizliği ve deadline dahil sorgu.
- Backend `auth/api/AuthRegistrationController.java`, `auth/infrastructure/mail/VerificationMailTemplate.java`: Swagger/metin sözleşmesi.
- Frontend `features/auth/components/{code-entry-step,verify-email-form,pending-verification,register-form}` ve `i18n/messages/{tr,en,de}.json`.
- `frontend/e2e/registration-resend-timing.spec.ts`, mevcut `auth-email-codes.spec.ts`, backend challenge/registration/mail testleri.
- `.agents/SECURITY.md` §11 ve kod özeti, `.agents/authentication.md`, kalıcı web checklist'i.

## Doğrulama komutları ve sonuçları

Backend dizininde:

```powershell
.\mvnw.cmd '-Dtest=EmailVerificationChallengeTest,RegistrationVerificationIntegrationTest,VerificationMailTemplateTest,AuthRegistrationHttpTest' clean test
```

**41 test, 0 failure/error/skip, BUILD SUCCESS.** PostgreSQL Testcontainers ile pending hesap, 3 dakika cooldown, eski kod, korunmuş expires_at, 15 dakika sonrası reddetme/temizlik, yeniden kayıt, mail rollback, CSRF/CORS/rate-limit ve tek kullanım doğrulandı. İlk temiz olmayan koşum, önceki migration numaralandırmasının target klasöründe kalan kopyaları yüzünden Flyway duplicate version hatası verdi; Maven clean sonrası geçti. Test logu `backend/registration-timing-test.log` (Git dışı).

Frontend dizininde:

```powershell
npx.cmd tsc --noEmit
npx.cmd eslint src/features/auth/components/code-entry-step.tsx src/features/auth/components/pending-verification.ts src/features/auth/components/register-form.tsx src/features/auth/components/verify-email-form.tsx e2e/registration-resend-timing.spec.ts e2e/auth-email-codes.spec.ts
$env:E2E_REUSE_AUTH='1'
npx.cmd playwright test registration-resend-timing.spec.ts --project=chromium --reporter=list
npx.cmd playwright test -c playwright.public.config.ts form-first-error-focus-public.spec.ts --grep 'verification allows' --project=chromium --reporter=list
```

**TypeScript / hedefli ESLint başarılı; 7 yeni + 1 mevcut Chromium testi başarılı.** Yeni testler browser saatini ve API yanıtlarını açıkça stub ederek 179/180 saniye sınırını, resend sonrası yalnız cooldown reset'ini, reload, 15 dakika expiry, başarısız gönderimi, yeniden kayıt linkini ve ortak şifre sıfırlama davranışını ölçer. Backend testleri gerçek PostgreSQL ve capture mail adaptörü kullanır; gerçek SMTP/Mailpit uçtan uca paket bu görevde çalıştırılmadı. 320 px TR/EN/DE overflow kontrolleri ve başlangıç/expiry screenshot'ları `frontend/test-results/` altında; görsel kontrol yapıldı. Yeni kod sonrası odak hatası yerel düzeltmeyle giderilip yeniden test edildi.

Repo kökünde `git diff --check`: başarılı.

## Endpoint ve Swagger kontrol yolu

Envanter `.agents/SECURITY.md` §11 "Registration verification timing" bölümünde güncellendi. Public POST'lar mevcut CSRF ve IP kotasını gerektirir; çerez oturumu üretmez.

| Endpoint | Güvenli örnek girdi | Başarı | Önemli hata |
| --- | --- | --- | --- |
| `POST /api/v1/auth/register` | `{email:"member@example.test",nickname:"member_1",password:"<strong password>",confirmPassword:"<same password>",locale:"tr"}` | `200`, pending hesap + kod | `400`, `403`, `409`, `429`, `503` |
| `POST /api/v1/auth/register/verify` | `{email:"member@example.test",code:"<6 digits>"}` | `200`, ACTIVE | `400 verification_code_invalid / verification_code_expired / verification_too_many_attempts`, `403`, `429` |
| `POST /api/v1/auth/register/resend` | `{email:"member@example.test",locale:"tr"}` | Her durumda genel `202`; uygun canlı hesapta kod gönderilir | `400`, `403`, `429`, `503` |

Mevcut `API_DOCS_ENABLED=true` ortamında `/swagger-ui/index.html` ve `/v3/api-docs`; önce `GET /api/v1/auth/csrf`, sonra XSRF-TOKEN cookie değerini `X-XSRF-TOKEN` olarak POST'a ekleyin. Cooldown/expired/unknown/active resend yanıtı aynı kalır; hesap varlığı açıklanmaz. Tüm yanıtlar `Cache-Control: no-store`.

## Açık kalan konular

- Çalışan normal backend eski Docker imajını kullanır; değişikliklerin o serviste görünmesi için güncel kaynakla build/başlatma gerekir. Bu görev deploy veya normal DB değişikliği yapmadı. Repo'nun daha önceki migration numaralandırma/DB history uyumluluk kararları ayrıca geçerlidir.
- Full suite, production build ve canonical pre-push bu sınırlı görevde çalıştırılmadı. Commit/push/merge/deployment yapılmadı.

## Kullanıcının manuel kontrol adımları

1. Bu kaydı inceleyin; geliştirme ortamındaki backend'i mevcut DB/migration uyumluluğuna uygun güncel kaynakla çalıştırın.
2. Yeni kayıt açın: toplam süre 15 dakika, yeni kod beklemesi 3 dakika olmalı. 3 dakika sonunda düğme açılmalı; mevcut kod hâlâ doğrulanabilmeli.
3. Yeni kod isteyin: eski kod reddedilmeli, toplam kayıt süresi artmamalı, yeni kod beklemesi yeniden 3 dakika başlamalı. Sayfayı yenileyince kalan süreler korunmalı.
4. İlk gönderimden 15 dakika sonra kayıt reddedilmeli; yeniden kayıt bağlantısı çalışmalı. Cleanup sonrası aynı e-posta/kullanıcı adıyla kayıt açılabilmeli.
