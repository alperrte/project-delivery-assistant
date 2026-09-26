# Kimlik doğrulama ve yetkilendirme

> Durum: Auth planı ve mevcut geçiş uygulaması. Access/refresh cookie isimleri ve CSRF taşıma yöntemi belirlenmiştir; production domain topolojisi ayrıca doğrulanacaktır.

## Uygulanan Faz 2 kayıt akışı

27 Eylül 2026 geçiş kararıyla `POST /api/v1/auth/register` email, nickname, 8–128 karakter şifre ve eşleşen doğrulama şifresi alır; hesap doğrudan `ACTIVE`, email durumu `PENDING` olur. Register mail göndermez veya `EMAIL_VERIFICATION_HMAC_KEY` istemez. Email ve nickname yazıldığı biçime duyarlı benzersizdir. Doğrulama kodu/backend hazırlığı ve V3 şeması ilerisi için saklanır; doğrulama akışı frontend auth fazında yeniden etkinleştirilecektir. Register, login ve logout başarılı isteklerde `200 OK` döner.

`POST /api/v1/auth/verify-email` ve `/resend-verification` public değildir. `GET /api/v1/auth/csrf` okunabilir `XSRF-TOKEN` cookie'si üretir; public POST istekleri bu değeri `X-XSRF-TOKEN` header'ında göndermelidir. `POST /api/v1/auth/login` email/BCrypt şifreyi doğrular; `ACTIVE/PENDING` hesaplar geçiş döneminde giriş yapabilir, `DISABLED` hesaplar yapamaz. Access ve refresh JWT'leri yalnız `PDA_ACCESS` ve `PDA_REFRESH` HttpOnly cookie'lerinde taşınır. Refresh hash'i UserSession'da saklanır. `POST /api/v1/auth/logout` session'ı revoke edip cookie'leri temizler; `GET /api/v1/auth/me` geçerli access cookie ve aktif session gerektirir. CORS yalnız `FRONTEND_URL` origin'ine izin verir. Register ve login ayrı ayrı IP başına 10 dakikada beş istekle sınırlıdır. Diğer API endpoint'leri deny-all kalır; `API_DOCS_ENABLED=true` yalnız Swagger/OpenAPI GET yollarını açar.

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

`ADMIN` instance genelinde yetkilidir. Proje üyelikleri `PROJECT_MANAGER`, `BACKEND_ENGINEER`, `FRONTEND_ENGINEER`, `FULL_STACK_DEVELOPER`, `TESTER`, `UI_DESIGNER` rollerinden bir veya birkaçını taşıyabilir. Aynı kullanıcının başka projedeki rolleri farklı olabilir. V1'de custom rol ve granular permission matrix yoktur. Her use-case, hem global hem proje kapsamını backend'de denetlemelidir.

## Admin bootstrap

İlk startup'ta yönetici yoksa `ADMIN_EMAIL` ve `ADMIN_INITIAL_PASSWORD` ile global `ADMIN` hesabı oluşturulur. Başlangıç şifresi BCrypt ile hashlenir. Yönetici zaten varsa restart bu hesabı yeniden oluşturmaz veya şifreyi değiştirmez. İlk login'de şifre değişimi zorunludur; sonrasında bootstrap şifresi hesap üzerinde yetki sağlamaz. Secret'ları Git'e koymayın.

## Güvenlik kontrolleri ve testler

- Hassas auth endpoint'lerinde rate limit/throttling ve brute-force önlemlerini uygulayın.
- Backend doğrulamasını Jakarta Validation ile yapın; SQL için parametreli sorgu/JPA kullanın.
- Uygun HSTS, CSP, frame ve `nosniff` başlıklarını etkinleştirin.
- Başarısız auth, cookie, CSRF, CORS, refresh rotation/revocation ve farklı proje yetkilerini Spring Security Test ile doğrulayın.
- Password, cookie, JWT, imza anahtarı ve diğer secret'ları response hata ayrıntısına veya loglara yazmayın.

İlgili karar: [0003 Cookie auth](decisions/0003-cookie-auth.md).
