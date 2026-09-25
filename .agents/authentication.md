# Kimlik doğrulama ve yetkilendirme

> Durum: teknik planda onaylanan güvenlik ilkeleri. Cookie isimleri, auth endpoint yolları, CSRF token taşıma yöntemi ve domain topolojisi uygulama sırasında netleşecektir.

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
