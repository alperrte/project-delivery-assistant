# Kimlik doğrulama ve yetkilendirme

> Durum: Auth planı ve mevcut geçiş uygulaması. Access/refresh cookie isimleri ve CSRF taşıma yöntemi belirlenmiştir; production domain topolojisi ayrıca doğrulanacaktır.

## Uygulanan Faz 2 kayıt akışı

27 Eylül 2026 geçiş kararıyla `POST /api/v1/auth/register` email, nickname, 8–128 karakter şifre ve eşleşen doğrulama şifresi alır; hesap doğrudan `ACTIVE`, email durumu `PENDING` olur. Register mail göndermez veya `EMAIL_VERIFICATION_HMAC_KEY` istemez. Email ve nickname yazıldığı biçime duyarlı benzersizdir. Doğrulama kodu/backend hazırlığı ve V3 şeması ilerisi için saklanır; doğrulama akışı frontend auth fazında yeniden etkinleştirilecektir. Register, login ve logout başarılı isteklerde `200 OK` döner.

`POST /api/v1/auth/verify-email` ve `/resend-verification` public değildir. `GET /api/v1/auth/csrf` okunabilir `XSRF-TOKEN` cookie'si üretir; public POST istekleri bu değeri `X-XSRF-TOKEN` header'ında göndermelidir. `POST /api/v1/auth/login` email/BCrypt şifreyi doğrular; `ACTIVE/PENDING` hesaplar geçiş döneminde giriş yapabilir, `DISABLED` hesaplar yapamaz. Access ve refresh JWT'leri yalnız `PDA_ACCESS` ve `PDA_REFRESH` HttpOnly cookie'lerinde taşınır. Refresh hash'i UserSession'da saklanır. `POST /api/v1/auth/logout` session'ı revoke edip cookie'leri temizler; `GET /api/v1/auth/me` geçerli access cookie ve aktif session gerektirir. CORS yalnız `FRONTEND_URL` origin'ine izin verir. Register ve login ayrı ayrı IP başına 10 dakikada beş istekle sınırlıdır. Diğer API endpoint'leri deny-all kalır; `API_DOCS_ENABLED=true` yalnız Swagger/OpenAPI GET yollarını açar.

## Uygulanan Faz 4: refresh rotation ve aktif oturumlar

`POST /api/v1/auth/refresh` public'tir (CSRF zorunlu) ve `PDA_REFRESH` cookie'sini doğrular: refresh JWT'si geçerli, kullanıcı `ACTIVE/PENDING` ve session aktif olmalıdır. Başarıda aynı session için yeni refresh + access token üretilir (sliding 7 gün); DB'de yalnız yeni SHA-256 hash tutulur, eski hash `previous_refresh_token_hash` alanına taşınır. Eski refresh token tekrar sunulursa (reuse/replay) session revoke edilir, cookie'ler temizlenir, 401 döner ve yalnız sessionId/userId loglanır. Logout ile revoke edilmiş, bilinmeyen veya süresi dolmuş token 401 verir. Refresh, IP başına 10 dakikada 30 istekle sınırlıdır (register/login 5). Bilinen sınır: iki sekmenin aynı anda refresh yapması replay gibi görünüp session'ı düşürebilir.

Aktif oturumlar (hepsi access cookie ister, yalnız çağıranın kendi oturumları): `GET /api/v1/auth/sessions`, `POST /api/v1/auth/sessions/{sessionId}/revoke`, `POST /api/v1/auth/sessions/revoke-others`. Başkasının veya pasif session'ı 404 döner. Session'da yalnız `user_agent` (en fazla 255 karakter, temizlenmiş) saklanır; IP saklanmaz.

## Uygulanan Faz 5: Google OAuth login ve hesap bağlama

Spring Security `oauth2Login` (`spring-boot-starter-security-oauth2-client`) yalnız `GOOGLE_CLIENT_ID` ve `GOOGLE_CLIENT_SECRET` birlikte doluysa etkinleşir; ikisi de boşsa OAuth yolları deny-all kalır, yalnız biri doluysa uygulama başlamaz. Akış: `GET /api/v1/auth/oauth2/authorization/google` → Google (OIDC, `state`, `nonce`, PKCE) → `GET /api/v1/auth/oauth2/callback/google`. Yetkilendirme isteği kısa ömürlü HttpSession'da tutulur ve callback sonrası session geçersiz kılınır. Başarıda PDA kendi `UserSession`'ını açar ve `PDA_ACCESS`/`PDA_REFRESH` cookie'lerini yazar; Google token'ları saklanmaz veya loglanmaz. Yönlendirme yalnız `FRONTEND_URL`'e yapılır (`/` veya `/login?oauth_error=<kod>`).

Kimlik modeli: V6 `user_oauth_identities` (`UNIQUE(provider, provider_subject)`, `UNIQUE(user_id, provider)`); eşleştirme Google `sub` ile yapılır, email ile değil. Yeni hesap yalnız doğrulanmış Google emaili ile açılır (şifresiz, `ACTIVE`, email `VERIFIED`, rol `USER`). Aynı email'e sahip mevcut hesap varsa otomatik birleştirme yapılmaz, `account_exists` döner. Bağlama: giriş yapmış kullanıcı `POST /api/v1/auth/oauth/google/link` çağırır, dönen URL'ye gider; niyet OAuth `state`'ine bağlı istekte saklanır. Bağlantı kaldırma: şifresi olmayan hesapta tek giriş yöntemi ise `409`.

## Uygulanan Faz 6: GitHub OAuth login ve hesap bağlama

GitHub, Google ile aynı modeli ve aynı handler'ları kullanır; yalnız `GITHUB_CLIENT_ID` ve `GITHUB_CLIENT_SECRET` birlikte doluysa etkinleşir (ikisi boş: yollar deny-all, yalnız biri dolu: başlangıç hatası). GitHub OIDC değildir ve profil emaili opsiyonel/doğrulanmamıştır; bu yüzden `user:email` scope'uyla token değişiminden sonra `GET https://api.github.com/user/emails` bir kez çağrılır ve yalnız primary ve verified adres kabul edilir, yoksa `email_not_verified`. Eşleştirme GitHub sayısal `id`'siyle yapılır (email değişse de aynı hesap). Otomatik birleştirme yoktur (`account_exists`). Bağlama/çözme genelleştirildi: `POST /api/v1/auth/oauth/{provider}/link|unlink` (`google` veya `github`; bilinmeyen ya da yapılandırılmamış provider `404`). Başka hesaba bağlı kimlik `/?oauth_link=linked_to_another_account` döner. Yeni migration yoktur (V6 `GITHUB` değerini zaten kabul eder).

## Uygulanan Faz 9: şifremi unuttum / sıfırlama

`POST /api/v1/auth/password/forgot` (`{email}`) ve `POST /api/v1/auth/password/reset` (`{email, code, newPassword, confirmPassword}`) public'tir, CSRF ve IP başına 10 dakikada beş istek sınırı taşır (register/login ile aynı pencere). `forgot` hesap var/yok fark etmeksizin her zaman `202` döner; hesap `ACTIVE` ise ve önceki kodun 60 saniyelik yeniden gönderim bekleme süresi geçtiyse yeni bir 6 haneli kod üretilip e-postalanır, aksi halde sessizce hiçbir şey yapılmaz. Mail kapalıyken (`MAIL_ENABLED=false` veya SMTP hatası) hesap kontrolünden önce `503` döner, böylece bu durum bile hesabın var olup olmadığını sızdırmaz.

Kod, e-posta doğrulama kodlarıyla aynı şekli paylaşır (hash'li, 10 dakika ömürlü, 5 deneme limitli, `password_reset_challenges` tablosunda kullanıcı başına tek aktif satır — V8 migration) ama ayrı bir tablo ve ayrı bir HMAC alanıdır: `VerificationCodeHasher` aynı `EMAIL_VERIFICATION_HMAC_KEY`'i `pwd-reset` ön ekiyle kullanır, böylece bir sıfırlama kodu ile aynı kullanıcı/rakamlara sahip bir doğrulama kodu asla aynı hash'e düşmez. Yeni ENV eklenmedi. `reset` mevcut şifreyi sormaz (kimlik zaten e-postalanan kodla kanıtlanmıştır); doğru koddan sonra `UserSessions.revokeAll` ile hesabın **tüm oturumları** iptal edilir ve varsa bekleyen zorunlu şifre değişimi (`mustChangePassword`) temizlenir. SMTP gönderimi mevcut `VerificationMailPort`/`SmtpVerificationMailAdapter`'a `sendPasswordResetCode` olarak eklendi; `auth` modülü içinde yeni bir port/adapter çifti açılmadı (cross-module SMTP tekrarı yalnız modül sınırını geçen durumlar için — ör. `project` modülünün davet e-postası — bilinçli olarak korunuyor).

## Kimlik akışı

V1 signup, login, logout ve access/refresh akışını kapsar. Spring Security backend'de kimlik ve yetki denetimini uygular. Şifreler persistence öncesinde BCrypt ile hashlenir; plaintext şifre veya hash değeri loglanmaz. Access ve refresh JWT'leri `HttpOnly` cookie içinde tutulur. Auth tokenları/verileri `localStorage` veya `sessionStorage` içinde saklanmaz.

| Ayar | Plan kararı |
| --- | --- |
| Access token ömrü | Varsayılan 15 dakika; ENV ile değiştirilebilir |
| Refresh token ömrü | Varsayılan 7 gün; ENV ile değiştirilebilir |
| Refresh yönetimi | Rotation ve revocation desteklenir; persist edilen token plaintext olmaz |
| JWT imza anahtarı | Yalnız backend ENV veya deployment secret store içinde |
| Production cookie | `Secure=true`; `SameSite` domain/deployment topolojisi belirlenince seçilir |
| CSRF | Cookie auth için etkin bir koruma kurulur; körlemesine kapatılmaz |

Tarayıcı ile backend farklı origin'lerdeyse izinli origin'leri açıkça tanımlayın; production'da wildcard CORS kullanmayın. Nihai domain, cookie `SameSite`/`Domain`/`Path` değerleri ve CSRF akışı birlikte test edilmelidir. Cookie ayarlarını host seçimi yapılmadan sabitlemeyin.

## Yetki modeli

`ADMIN` instance genelinde platform operatörüdür (kullanıcı, oturum ve denetim yönetimi: `PlatformPermission`); proje üyeliği değildir ve proje verisinde örtük yetkisi yoktur. Proje üyelikleri `PROJECT_MANAGER`, `BACKEND_DEVELOPER`, `FRONTEND_DEVELOPER`, `FULL_STACK_DEVELOPER`, `AI_ML_DEVELOPER`, `UI_UX_DEVELOPER`, `TESTER`, `ANALYST` rollerinden bir veya birkaçını taşıyabilir. Aynı kullanıcının başka projedeki rolleri farklı olabilir. Roller yalnız etikettir: yetki `RolePolicy` ile rol→`ProjectPermission` eşlemesinden gelir (deny-by-default, custom rol yok). Her use-case, hem global hem proje kapsamını backend'de denetlemelidir. Proje modülü `ProjectAccess` facade'ı ile `projectId + userId` için üyelik/permission bilgisini sunar; Auth Project entity/repository'sine erişmez.

## Admin bootstrap

**Durum: Faz 8'de uygulandı.** `AdminBootstrapRunner` (admin modülü) startup'ta çalışır; `ADMIN_EMAIL` geçersizse veya `ADMIN_INITIAL_PASSWORD` 12 karakterden kısaysa (`.env.example` yer tutucusu `change_me` dahil) uyarı loglayıp atlar, e-posta/şifre asla loglanmaz. Aynı e-postaya sahip mevcut ADMIN olmayan hesap terfi ettirilmez veya değiştirilmez. Hesap ACTIVE + e-posta VERIFIED oluşur ve `must_change_password=true` taşır. Bu bayrak açıkken `JwtCookieAuthenticationFilter` yalnız `/api/v1/auth/{me,password/change,logout,refresh,csrf}` yollarına izin verir; diğerleri `403` + `code: password_change_required` döner. `POST /api/v1/auth/password/change` bayrağı kaldırır ve diğer oturumları iptal eder.

İlk startup'ta yönetici yoksa `ADMIN_EMAIL` ve `ADMIN_INITIAL_PASSWORD` ile global `ADMIN` hesabı oluşturulur. Başlangıç şifresi BCrypt ile hashlenir. Yönetici zaten varsa restart bu hesabı yeniden oluşturmaz veya şifreyi değiştirmez. İlk login'de şifre değişimi zorunludur; sonrasında bootstrap şifresi hesap üzerinde yetki sağlamaz. Secret'ları Git'e koymayın.

## Güvenlik kontrolleri ve testler

- Hassas auth endpoint'lerinde rate limit/throttling ve brute-force önlemlerini uygulayın.
- Backend doğrulamasını Jakarta Validation ile yapın; SQL için parametreli sorgu/JPA kullanın.
- Uygun HSTS, CSP, frame ve `nosniff` başlıklarını etkinleştirin.
- Başarısız auth, cookie, CSRF, CORS, refresh rotation/revocation ve farklı proje yetkilerini Spring Security Test ile doğrulayın.
- Password, cookie, JWT, imza anahtarı ve diğer secret'ları response hata ayrıntısına veya loglara yazmayın.

İlgili karar: [0003 Cookie auth](decisions/0003-cookie-auth.md).
