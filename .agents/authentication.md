# Kimlik doğrulama ve yetkilendirme

> Durum: Auth planı ve mevcut geçiş uygulaması. Access/refresh cookie isimleri ve CSRF taşıma yöntemi belirlenmiştir; production domain topolojisi ayrıca doğrulanacaktır.

## Uygulanan Faz 2 kayıt akışı

27 Eylül 2026 geçiş kararıyla `POST /api/v1/auth/register` email, nickname, 8–128 karakter şifre ve eşleşen doğrulama şifresi alır; hesap doğrudan `ACTIVE`, email durumu `PENDING` olur. Register mail göndermez veya `EMAIL_VERIFICATION_HMAC_KEY` istemez. Email ve nickname yazıldığı biçime duyarlı benzersizdir. Doğrulama kodu/backend hazırlığı ve V3 şeması ilerisi için saklanır; doğrulama akışı frontend auth fazında yeniden etkinleştirilecektir. Register, login ve logout başarılı isteklerde `200 OK` döner. Register cookie üretmez; frontend kayıt başarılı olunca aynı bilgilerle `POST /api/v1/auth/login` çağırarak kullanıcıyı otomatik giriş yaptırır, giriş başarısız olursa `/login`'e yönlendirir.

`POST /api/v1/auth/verify-email` ve `/resend-verification` public değildir. `GET /api/v1/auth/csrf` okunabilir `XSRF-TOKEN` cookie'si üretir; public POST istekleri bu değeri `X-XSRF-TOKEN` header'ında göndermelidir. `POST /api/v1/auth/login` email/BCrypt şifreyi doğrular; `ACTIVE/PENDING` hesaplar geçiş döneminde giriş yapabilir, `DISABLED` hesaplar yapamaz. Access ve refresh JWT'leri yalnız `PDA_ACCESS` ve `PDA_REFRESH` HttpOnly cookie'lerinde taşınır. Refresh hash'i UserSession'da saklanır. `POST /api/v1/auth/logout` session'ı revoke edip cookie'leri temizler; `GET /api/v1/auth/me` geçerli access cookie ve aktif session gerektirir. CORS yalnız `FRONTEND_URL` origin'ine izin verir. Register IP başına 10 dakikada beş, login IP başına 10 dakikada 30 istekle sınırlıdır (ayrı ayrı sayılır; başarılı istekler de sayılır). Diğer API endpoint'leri deny-all kalır; `API_DOCS_ENABLED=true` yalnız Swagger/OpenAPI GET yollarını açar.

## Uygulanan Faz 4: refresh rotation ve aktif oturumlar

`POST /api/v1/auth/refresh` public'tir (CSRF zorunlu) ve `PDA_REFRESH` cookie'sini doğrular: refresh JWT'si geçerli, kullanıcı `ACTIVE/PENDING` ve session aktif olmalıdır. Başarıda aynı session için yeni refresh + access token üretilir (sliding 7 gün); DB'de yalnız yeni SHA-256 hash tutulur, eski hash `previous_refresh_token_hash` alanına taşınır. Eski refresh token tekrar sunulursa (reuse/replay) session revoke edilir, cookie'ler temizlenir, 401 döner ve yalnız sessionId/userId loglanır. Logout ile revoke edilmiş, bilinmeyen veya süresi dolmuş token 401 verir. Refresh, IP başına 10 dakikada 30 istekle sınırlıdır (login 30, register 5). Bilinen sınır: iki sekmenin aynı anda refresh yapması replay gibi görünüp session'ı düşürebilir.

Aktif oturumlar (hepsi access cookie ister, yalnız çağıranın kendi oturumları): `GET /api/v1/auth/sessions`, `POST /api/v1/auth/sessions/{sessionId}/revoke`, `POST /api/v1/auth/sessions/revoke-others`. Başkasının veya pasif session'ı 404 döner. Session'da yalnız `user_agent` (en fazla 255 karakter, temizlenmiş) saklanır; IP saklanmaz.

## Uygulanan Faz 5: Google OAuth login ve hesap bağlama

Spring Security `oauth2Login` (`spring-boot-starter-security-oauth2-client`) yalnız `GOOGLE_CLIENT_ID` ve `GOOGLE_CLIENT_SECRET` birlikte doluysa etkinleşir; ikisi de boşsa OAuth yolları deny-all kalır, yalnız biri doluysa uygulama başlamaz. Akış: `GET /api/v1/auth/oauth2/authorization/google` → Google (OIDC, `state`, `nonce`, PKCE) → `GET /api/v1/auth/oauth2/callback/google`. Yetkilendirme isteği kısa ömürlü HttpSession'da tutulur ve callback sonrası session geçersiz kılınır. Başarıda PDA kendi `UserSession`'ını açar ve `PDA_ACCESS`/`PDA_REFRESH` cookie'lerini yazar; Google token'ları saklanmaz veya loglanmaz. Yönlendirme yalnız `FRONTEND_URL`'e yapılır (`/projects` veya `/login?oauth_error=<kod>`).

Kimlik modeli: V6 `user_oauth_identities` (`UNIQUE(provider, provider_subject)`, `UNIQUE(user_id, provider)`); eşleştirme Google `sub` ile yapılır, email ile değil. Yeni hesap yalnız doğrulanmış Google emaili ile açılır (şifresiz, `ACTIVE`, email `VERIFIED`, rol `USER`). Aynı email'e sahip mevcut hesap varsa otomatik birleştirme yapılmaz, `account_exists` döner. Bağlama: giriş yapmış kullanıcı `POST /api/v1/auth/oauth/google/link` çağırır, dönen URL'ye gider; niyet OAuth `state`'ine bağlı istekte saklanır. Bağlantı kaldırma: şifresi olmayan hesapta tek giriş yöntemi ise `409`.

## Uygulanan Faz 6: GitHub OAuth login ve hesap bağlama

GitHub, Google ile aynı modeli ve aynı handler'ları kullanır; yalnız `GITHUB_CLIENT_ID` ve `GITHUB_CLIENT_SECRET` birlikte doluysa etkinleşir (ikisi boş: yollar deny-all, yalnız biri dolu: başlangıç hatası). GitHub OIDC değildir ve profil emaili opsiyonel/doğrulanmamıştır; bu yüzden `user:email` scope'uyla token değişiminden sonra `GET https://api.github.com/user/emails` bir kez çağrılır ve yalnız primary ve verified adres kabul edilir, yoksa `email_not_verified`. Eşleştirme GitHub sayısal `id`'siyle yapılır (email değişse de aynı hesap). Otomatik birleştirme yoktur (`account_exists`). Bağlama/çözme genelleştirildi: `POST /api/v1/auth/oauth/{provider}/link|unlink` (`google` veya `github`; bilinmeyen ya da yapılandırılmamış provider `404`). Başka hesaba bağlı kimlik `/?oauth_link=linked_to_another_account` döner. Yeni migration yoktur (V6 `GITHUB` değerini zaten kabul eder).

## Uygulanan Faz 9: şifremi unuttum / sıfırlama

`POST /api/v1/auth/password/forgot` (`{email}`) ve `POST /api/v1/auth/password/reset` (`{email, code, newPassword, confirmPassword}`) public'tir, CSRF ve IP başına 10 dakikada beş istek sınırı taşır (register ile aynı sınır). `forgot` hesap var/yok fark etmeksizin her zaman `202` döner; hesap `ACTIVE` ise ve önceki kodun 60 saniyelik yeniden gönderim bekleme süresi geçtiyse yeni bir 6 haneli kod üretilip e-postalanır, aksi halde sessizce hiçbir şey yapılmaz. Mail kapalıyken (`MAIL_ENABLED=false` veya SMTP hatası) hesap kontrolünden önce `503` döner, böylece bu durum bile hesabın var olup olmadığını sızdırmaz.

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

**Durum: Faz 8'de uygulandı.** `AdminBootstrapRunner` (admin modülü) startup'ta çalışır; `ADMIN_EMAIL` geçersizse veya `ADMIN_INITIAL_PASSWORD` 12 karakterden kısaysa (`.env.example` yer tutucusu `change_me` dahil) uyarı loglayıp atlar, e-posta/şifre asla loglanmaz. Aynı e-postaya sahip mevcut ADMIN olmayan hesap terfi ettirilmez veya değiştirilmez. Hesap ACTIVE + e-posta VERIFIED oluşur (2026-10-10 itibarıyla `must_change_password` set edilmez, aşağıdaki "Admin girişi" bölümüne bakın). Bayrağı taşıyan bir hesapta `JwtCookieAuthenticationFilter` yalnız `/api/v1/auth/{me,password/change,logout,refresh,csrf}` yollarına izin verir; diğerleri `403` + `code: password_change_required` döner. `POST /api/v1/auth/password/change` bayrağı kaldırır ve diğer oturumları iptal eder.

İlk startup'ta yönetici yoksa `ADMIN_EMAIL` ve `ADMIN_INITIAL_PASSWORD` ile global `ADMIN` hesabı oluşturulur. Başlangıç şifresi BCrypt ile hashlenir. Yönetici zaten varsa restart bu hesabı yeniden oluşturmaz veya şifreyi değiştirmez. Bootstrap şifresi 2026-10-10 itibarıyla zorunlu değişime tabi değildir; admin yalnız ayrı admin girişinden (parola + TOTP) oturum alır. Secret'ları Git'e koymayın.

### Admin girişi ve zorunlu 2FA (2026-10-10; yukarıdaki "ilk login'de şifre değişimi zorunludur" anlatımının yerine geçer)

- **ENV admini zorunlu şifre değişimine düşmez.** `User.bootstrapAdmin` artık `must_change_password` set etmez; V68 mevcut yöneticilerin bayrağını temizler (bayrak yalnız bootstrap'te set ediliyordu). `mustChangePassword` mekanizması (filtre allow-list'i, `password/change`) bayrak taşıyan diğer hesaplar için olduğu gibi durur. Restart şifreyi hâlâ değiştirmez. Şifre değiştirilmeden kullanılabildiği için telafi kontrolü admin TOTP zorunluluğudur.
- **Admin normal girişten oturum alamaz.** `POST /auth/login`, Google ve GitHub, `ADMIN` hesabına yanlış şifreyle aynı genel `401 Invalid credentials` (OAuth'ta `/login?oauth_error=provider_error`) döner; admin olduğu sızmaz. Admin yalnız `/pd-admin` (frontend) → `POST /api/v1/auth/admin/login` ile girer.
- **Sözleşme.** `admin/login {email,password}` yalnız ACTIVE ADMIN + doğru şifre için ilerler (diğer her durum aynı 401), oturum vermez: TOTP onaylıysa `{"status":"TWO_FACTOR_REQUIRED"}` + 5 dk `PDA_ADMIN_MFA`; değilse `{"status":"TWO_FACTOR_ENROLLMENT_REQUIRED"}` + 10 dk `PDA_ADMIN_ENROLL`. Kurulum: `admin/2fa/setup` (`{secret, otpauthUri}`, yalnız bu yanıtta, `no-store`) → `admin/2fa/enable {code}` (doğru kodla 2FA açılır, 10 yedek kod bir kez döner, bilet tüketilir ve admin-doğrulanmış oturum açılır; yanlış kodla 2FA açılmaz). Sonraki girişler: `admin/login/2fa {code}` (TOTP ya da yedek kod). Biletler tek kullanımlıktır (sunucu tarafı `admin_auth_tickets` satırı), kullanıcıya ve amaca bağlıdır, erişim token'ı olarak kabul edilmez, normal uç noktalarda geçersizdir.
- **Admin-doğrulanmış oturum.** `/api/v1/admin/**` yalnız `user_sessions.admin_verified_at` dolu oturumla çalışır (yalnız yukarıdaki iki başarı yolu doldurur; refresh aynı satırı döndürdüğü için korunur). Eski admin oturumu `403 admin_reauthentication_required` alır; admin `/pd-admin`'den yeniden girer. Ayrıntı ve tablo: `.agents/SECURITY.md` son bölüm, uç nokta özeti: `.agents/api.md`.
- **2FA tüm adminler için zorunludur**: `POST /auth/2fa/disable` ADMIN için `403 admin_two_factor_required` döner; yedek kod yenileme kalır. `TOTP_ENCRYPTION_KEY` yok ya da değişmişse admin girişi ve tüm ikinci adım yolları `503 two_factor_unavailable` verir (500 değil).
- **Kurtarma.** 10 yedek kod (kurulumda bir kez gösterilir). Hepsi kaybolursa operasyon, ilgili adminin `totp_credentials` ve `totp_recovery_codes` satırlarını siler; sonraki `/pd-admin` girişi yeniden kurulum ister. ENV ile tetiklenen sıfırlama **FOLLOW-UP SECURITY FEATURE** olarak uygulanmadı.

## Güvenlik kontrolleri ve testler

- Hassas auth endpoint'lerinde rate limit/throttling ve brute-force önlemlerini uygulayın.
- Backend doğrulamasını Jakarta Validation ile yapın; SQL için parametreli sorgu/JPA kullanın.
- Uygun HSTS, CSP, frame ve `nosniff` başlıklarını etkinleştirin.
- Başarısız auth, cookie, CSRF, CORS, refresh rotation/revocation ve farklı proje yetkilerini Spring Security Test ile doğrulayın.
- Password, cookie, JWT, imza anahtarı ve diğer secret'ları response hata ayrıntısına veya loglara yazmayın.

İlgili karar: [0003 Cookie auth](decisions/0003-cookie-auth.md).

## Auth sertleştirme (2026-10-10): güçlü parola, e-posta kodları, 2FA, hesap silme

Bu bölüm yukarıdaki Faz 2 ("hesap doğrudan ACTIVE, register mail göndermez, otomatik giriş") ve Faz 9 ("tek adımlı sıfırlama, 10 dakika") anlatımlarının **yerine geçer**; eski bölümler tarihçe olarak durur. Tamamlanma kaydı: `docs/compliation/2026-10-10-auth-sertlestirme.md`.

**Parola kuralı.** Kayıt, davetli kayıt, şifre sıfırlama ve şifre değiştirmede yeni parola 8–128 karakter olmalı ve en az bir büyük harf, bir rakam, bir özel karakter içermelidir (`@StrongPassword`). Frontend aynı kuralı canlı liste olarak gösterir (`PasswordRules`); kural yine de yalnız backend'de bağlayıcıdır.

**Kayıt + e-posta doğrulama.** `POST /auth/register` hesabı `PENDING_VERIFICATION` açar ve 6 haneli kodu e-postalar (mail kapalıysa hesap açılmadan `503`). `POST /auth/register/verify {email, code}` hesabı `ACTIVE` yapar; `POST /auth/register/resend {email, locale}` her zaman `202` döner (60 sn bekleme içinde sessiz no-op). Doğrulanmamış hesap, şifre doğru olsa bile `403 email_not_verified` alır (şifre yanlışsa yine `401`). Kod 15 dakika geçerli, tek kullanımlık, 5 denemelidir; süresi dolan bekleyen kayıt zamanlanmış işle silinir ve aynı e-posta/kullanıcı adıyla yeni kayıt bekleyeni anında temizler. Kod tek başına oturum açmaz (backend `register/verify` çerez üretmez). Frontend, kayıtta (ya da doğrulanmamış girişte) yazılan şifreyi yalnızca bellekte tutar ve kod doğrulanınca aynı şifreyle `POST /auth/login` çağırarak kullanıcıyı otomatik girdirir; şifre bellekte yoksa (sayfa yenilendi, başka adres) ya da giriş başarısızsa `/login`'e gidilir. Davetli kayıt (`/register/invitation`) mail kodu istemez.

**Şifremi unuttum (3 adım).** `POST /password/forgot {email, locale}` → `POST /password/reset/verify {email, code}` (kodu tüketir, 10 dakikalık HttpOnly `PDA_RESET` bileti verir) → `POST /password/reset {newPassword, confirmPassword}` (bileti kullanır, tüm oturumları iptal eder). Eski `{email, code, …}` gövdeli tek adım kalktı.

**Hesap ayarlarında şifre değiştirme.** `POST /password/change/code` (oturum + CSRF, kod mailler) → `POST /password/change/verify {code}` (10 dakikalık `PDA_PWCHANGE` bileti) → `POST /password/change {currentPassword, newPassword, confirmNewPassword}`. Bilet yoksa `403 verification_required`. Zorunlu ilk giriş değişimi (`mustChangePassword`) mail kodundan muaftır. Arayüzde "Şifremi unuttum" kısayolu vardır.

**TOTP 2FA.** `GET /auth/2fa`, `POST /auth/2fa/setup`, `/enable` (10 yedek kodu bir kez döner), `/disable` (şifre + TOTP ya da yedek kod), `/recovery-codes` (yeniler). RFC 6238 (SHA-1, 30 sn, 6 hane, ±1 adım, kullanılmış adım tekrar kabul edilmez); gizli anahtar `TOTP_ENCRYPTION_KEY` ile AES-256-GCM şifreli saklanır; 5 hatalı kod 15 dakika kilitler. 2FA açıkken `POST /login` oturum açmaz: 5 dakikalık `PDA_MFA` çerezi ve `TWO_FACTOR_REQUIRED` döner, `POST /login/2fa {code}` (TOTP ya da yedek kod) oturumu açar. Google/GitHub girişi de aynı ara adımdan geçer (`/login?step=2fa`).

**Oturum sonu.** Access token'ı 401 verip yenileme de başarısız olunca arayüz `/login?reason=session-expired&next=<sayfa>` açar ve "Oturumunuz sona erdi" gösterir; elle çıkışta mesaj yoktur. Süre dolumu `Clock` ile sabitlenmiş backend testleriyle (access 15 dk, refresh 7 gün, iptal edilen oturum) ve `auth-session-audit.spec.ts` ile doğrulanır.

**Hesap silme.** `POST /auth/account/deletion/request` (oturum + CSRF) "Hesabınızı gerçekten silmek istiyor musunuz?" bağlantılı mail yollar (15 dk, tek kullanımlık, DB'de yalnız hash). Bağlantı public `/delete-account?token=…` sayfasını açar; `POST /auth/account/deletion/confirm {token, email, password}` (şifresiz OAuth hesabında yalnız e-posta; 2FA açıksa kod da) hesabı **anonimleştirir**: durum `DELETED`, ad "Silinmiş kullanıcı", e-posta/kullanıcı adı/şifre/foto/OAuth/2FA/oturum/tercih/bildirim silinir, üyelikler kalkar; görev-yorum-mesaj geçmişi kalır. Proje ya da organizasyon sahibi `409 owns_resources` alır (liste döner). `ADMIN` hesabı kendini silemez (`403 administrator_cannot_delete`). Silinen hesap bir daha açılamaz; e-posta ve kullanıcı adı yeniden kullanılabilir.

**Mail.** Kayıt, sıfırlama, şifre değişimi ve silme mailleri HTML + düz metindir (üstte gömülü PDA logosu, ortada kod/buton, 15 dakika notu, "PDA ekibi"); dil sitenin o anki dilidir (tr/en/de), silme bağlantısı backend'deki sabit yol tablosundan kurulur.

Yeni ayarlar: `TOTP_ENCRYPTION_KEY` (Base64, 32 bayt; boşsa 2FA kapalı), mevcut `EMAIL_VERIFICATION_HMAC_KEY` artık kayıtta da zorunludur.
