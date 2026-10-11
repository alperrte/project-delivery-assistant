# PDA — Separate Admin Login, `/pd-admin` Entry & Google Authenticator 2FA

PDA içerisindeki yönetici giriş sistemi normal kullanıcı girişinden ayrılacak ve admin authentication akışı yeniden düzenlenecek.

Kullanıcının ham talepleri:

1. Admin kullanıcılar şu anda normal kullanıcılarla aynı Login sayfasından giriş yapıyor.
2. Adminler için tamamen ayrı bir giriş sayfası oluşturulmalı.
3. ENV üzerinden tanımlanan admin e-posta ve şifresiyle giriş yapıldıktan sonra sistem şu anda zorunlu şifre değiştirme istiyor. ENV admin hesabı için bu zorunluluk kaldırılmalı.
4. Admin hesabına Google Authenticator uyumlu QR kod ile 2FA/TOTP bağlanmalı.
5. Admin giriş alanı public navigasyonda gösterilmemeli. Doğrudan `/pd-admin` URL'si üzerinden erişilmeli.

Bu maddeleri yazıldıkları sırayla körlemesine implement etme.

Önce repository'yi incele ve gerçek authentication/admin dependency graph'ını çıkar.

Her task:

```text
implementation
→ targeted test
→ gerekli bug fix
→ targeted re-test
→ Definition of Done
→ checkbox [x]
→ sonraki task
```

akışıyla yürütülmeli.

Bir task tamamlanmadan bağımlı task'a geçme.

---

# ÇALIŞMA MODELİ

İlk turda production kod değiştirme.

Önce read-only audit yap.

Özellikle aşağıdaki alanları incele:

```text
AuthController / AuthService
login endpoint
JWT/session implementation
refresh token
role/permission model
ADMIN role/policy
admin bootstrap mechanism
ENV admin email/password
first login / force password change
passwordChanged / mustChangePassword benzeri alanlar
frontend Login page
admin routes
route guards / middleware
SecurityFilterChain / security config
CSRF/CORS
rate limiting
account lockout
audit logging
2FA/TOTP support
encryption/key management
database migrations
i18n
Playwright auth fixtures
```

İsimleri tahmin etme.

Repository'deki gerçek entity, DTO, service, route, hook ve security katmanlarını kullan.

---

# PERSISTENT PLAN

Repository root'unda:

```text
PDA_ADMIN_AUTH_2FA_REFINEMENTS_PLAN.md
```

oluştur.

Plan implementation boyunca source of truth olacak.

En üstte görünür checklist bulunmalı:

```md
## Execution status

- [ ] Phase 0 — Global read-only auth/security audit
- [ ] Task 1 — Admin authentication contract
- [ ] Task 2 — Dedicated `/pd-admin` login experience
- [ ] Task 3 — ENV bootstrap admin password-change behavior
- [ ] Task 4 — Google Authenticator compatible TOTP enrollment
- [ ] Task 5 — Admin login + TOTP verification flow
- [ ] Task 6 — Security hardening / authorization regression
- [ ] Task 7 — Full regression / final verification
```

Her task:

```md
## Task N — ...

### Amaç
...

### Neden bu sırada?
...

### Prerequisite
...

### Etkilenecek alanlar
- Backend:
- Database:
- Frontend:
- Authentication:
- Authorization:
- Security:
- Cache/session:
- i18n/a11y:
- Tests:

### Checklist
- [ ] N.1 ...
- [ ] N.2 ...
- [ ] N.3 ...

### Definition of Done
- [ ] ...
- [ ] ...
```

formatında tutulmalı.

Task tamamlandıkça ilgili `[ ]` değerleri `[x]` yapılmalı.

Kullanıcı ilerlemeyi doğrudan bu dosyadan takip edebilmeli.

---

# TASK DEPENDENCY ORDER

Mantıksal sıra şu şekilde olmalı:

```text
Phase 0
↓
Authentication/security audit

Task 1
↓
Admin authentication contract'ını netleştir

Task 2
↓
Ayrı /pd-admin giriş sayfasını oluştur

Task 3
↓
ENV admin için zorunlu şifre değiştirmeyi kaldır

Task 4
↓
TOTP enrollment + QR bağlantısını oluştur

Task 5
↓
Password + TOTP admin login akışını tamamla

Task 6
↓
Authorization / IDOR / brute force / session güvenliği

Task 7
↓
Full regression + canonical pre-push
```

Bu sıranın sebebi:

TOTP login akışı, admin authentication contract'ı ve ayrı admin route tamamlanmadan güvenilir şekilde kurulamaz.

---

# PART A — ADMIN AUTHENTICATION CONTRACT

## A1. Normal user ve admin login ayrımı

Mevcut sistemde normal user ve admin aynı login formunu kullanıyorsa bu davranış ayrılmalı.

Normal kullanıcı Login ekranı yalnız normal kullanıcı authentication experience'ı olarak kalmalı.

Admin için ayrı giriş akışı oluşturulmalı.

## A2. `/pd-admin` davranışı

Admin girişinin başlangıç URL'si:

```text
/pd-admin
```

olmalı.

Kullanıcı doğrudan bu URL'yi ziyaret ettiğinde:

### Admin oturumu yoksa
Admin Login ekranını görmeli.

### Geçerli admin oturumu varsa
Admin dashboard/paneline yönlendirilmeli veya mevcut admin root page gösterilmeli.

## A3. Public UI görünürlüğü

Landing, Login, Register, Footer, Navbar ve public menus alanlarına `Admin Login` bağlantısı ekleme.

`/pd-admin` doğrudan URL ile erişilen bir alan olarak kalmalı.

Ancak:

> URL'nin bilinmemesi güvenlik kontrolü değildir.

Backend authorization zorunlu olmalı.

## A4. Normal kullanıcı `/pd-admin`

Normal kullanıcı oturumu açık olsa bile `/pd-admin` admin yetkisi vermemeli.

Normal user token/session ADMIN route, ADMIN API veya ADMIN dashboard erişimi sağlamamalı.

Client-side gizleme tek güvenlik mekanizması olamaz.

---

# PART B — DEDICATED ADMIN LOGIN PAGE

## B1. Ayrı UI

Admin login normal Login component'inin birebir conditional versiyonu olarak yapılmamalı.

Gerekirse ortak input, button, form field, theme ve validation component'leri reuse edilebilir.

Ancak admin login kendi route ve auth flow'una sahip olmalı.

## B2. Alanlar

İlk aşamada:

```text
E-posta
Şifre
```

bulunmalı.

Başarılı credential doğrulamasından sonra TOTP aktifse ikinci adım açılmalı.

## B3. Admin-specific branding

Sayfa PDA design system ile uyumlu olmalı fakat bunun bir yönetici giriş alanı olduğu açıkça anlaşılmalı.

Örneğin `PDA Yönetici Girişi` / `Admin Panel` gibi i18n destekli başlık kullanılabilir.

## B4. URL leakage

Public sayfalarda `/pd-admin` linki gösterilmese de route gerçek güvenlik kontrolünden geçmeli.

`robots.txt` veya client-side gizleme güvenlik önlemi olarak kabul edilmemeli.

---

# PART C — ENV ADMIN ACCOUNT

## C1. ENV source

Önce gerçek ENV isimlerini bul.

`ADMIN_EMAIL`, `ADMIN_PASSWORD` gibi isimleri tahmin ederek ekleme; repository hangi isimleri kullanıyorsa onları koru.

## C2. Backend-only

Admin password hiçbir şekilde `NEXT_PUBLIC_*`, frontend bundle, HTML, browser storage, API response veya log içine girmemeli.

ENV credential yalnız backend tarafından okunmalı.

## C3. Forced password change

ENV ile bootstrap edilen admin hesabı ENV admin email + ENV admin password ile başarılı giriş yaptığında zorunlu şifre değiştirme sayfasına yönlendirilmemeli.

Şu anki `firstLogin`, `mustChangePassword`, `forcePasswordChange`, `temporaryPassword` benzeri mekanizmalardan hangisi bunu tetikliyorsa gerçek source'u bul.

## C4. Scope

Bu değişiklik yalnız ENV/bootstrap admin davranışına uygulanmalı.

Sistemde başka admin/user temporary-password flow'ları varsa gereksiz yere kaldırma.

## C5. ENV password lifecycle

ENV password değiştiğinde bootstrap hesabının nasıl davranacağı mevcut implementation'a göre audit edilmeli.

Agent sessizce her startup'ta DB password overwrite gibi tehlikeli bir davranış eklememeli.

---

# PART D — GOOGLE AUTHENTICATOR / TOTP

Google'a özel kapalı bir API kullanma.

Standart TOTP, RFC 6238-compatible ve `otpauth://` mekanizması kullanılmalı.

Google Authenticator ile uyumlu olmalı; aynı zamanda diğer standart TOTP uygulamalarıyla da çalışabilir.

## D1. Enrollment

Admin ilk defa 2FA bağlarken backend güvenli bir TOTP secret üretmeli.

Frontend'e QR provisioning data gönderilmeli.

QR `otpauth://totp/...` URI'sinden oluşturulmalı.

## D2. QR bilgisi

Provisioning URI içerisinde uygun `issuer`, `account label`, `secret`, `algorithm`, `digits`, `period` bilgileri bulunmalı.

Örneğin issuer `PDA`, account label admin email olabilir. Exact format implementation sırasında mevcut product naming'e göre belirlenmeli.

## D3. Aktivasyon öncesi doğrulama

QR görüntülendi diye 2FA'yı hemen aktif etme.

Akış:

```text
Generate secret
↓
Show QR
↓
Admin Google Authenticator'a ekler
↓
Admin 6 haneli kod girer
↓
Backend TOTP doğrular
↓
Only then activate 2FA
```

Yanlış kodla 2FA active hale gelmemeli.

## D4. Secret storage

TOTP secret plaintext log, frontend storage, localStorage, sessionStorage veya JWT içinde tutulmamalı.

Database'de saklanacaksa mevcut project encryption/key-management sistemi varsa reuse et.

Yoksa secret-at-rest güvenlik modelini audit edip plan içinde açıkça belirt.

## D5. QR secret exposure

QR provisioning secret yalnız enrollment sırasında yetkili admin'e gösterilmeli.

Normal admin profile/dashboard API'leri secret döndürmemeli.

---

# PART E — ADMIN LOGIN + 2FA FLOW

Final admin login:

```text
/pd-admin
↓
email + password
↓
credential valid?
↓
TOTP required?
↓
6 digit authenticator code
↓
verify
↓
admin session/token
↓
admin dashboard
```

olmalı.

## E1. TOTP challenge

Password doğru ama TOTP bekleniyorsa henüz tam admin session verilmemeli.

Mümkünse short-lived pending-auth challenge veya mevcut auth mimarisine uygun eşdeğer güvenli yöntem kullan.

Password doğrulamasından hemen sonra full ADMIN JWT verip sonra client'ta TOTP sormak kabul edilmez.

## E2. Code format

Google Authenticator standardına uygun 6 haneli kod kabul edilmeli.

Whitespace normalization gerekiyorsa güvenli biçimde yapılabilir.

## E3. Clock tolerance

TOTP doğrulamasında küçük bir time-window toleransı uygulanabilir.

Ancak gereksiz geniş pencere kullanma.

Library'nin güvenli varsayımlarını incele.

## E4. Replay

Mümkünse aynı TOTP timestep kodunun tekrar kullanım riskini değerlendir.

Mevcut auth/security architecture'a uygun koruma varsa uygula.

## E5. Rate limiting

Admin credential ve TOTP endpoint'leri brute-force'a açık olmamalı.

Login rate limit, TOTP verify rate limit, account/IP limits ve lockout/backoff davranışlarını audit et.

Mevcut infrastructure varsa reuse et.

---

# PART F — 2FA ENROLLMENT POLICY

ENV admin için davranış açık olmalı.

İstenen temel davranış:

```text
Admin ENV email/password ile giriş yapar
↓
zorunlu password change YOK
↓
2FA henüz bağlı değilse Google Authenticator enrollment akışına gider
↓
QR scan
↓
TOTP verify
↓
2FA active
↓
admin panel
```

Sonraki giriş:

```text
email/password
↓
TOTP
↓
admin panel
```

---

# PART G — 2FA RESET / RECOVERY

Repository'de mevcut recovery sistemi varsa reuse et.

Yoksa minimum olarak `Admin telefonunu kaybederse ne olacak?` durumunu planla.

Agent sessizce güvensiz bir `2FA'yı frontend'den kapat` endpoint'i eklememeli.

2FA disable/reset işlemi re-authentication + admin authorization gerektirmeli.

Eğer recovery-code özelliği scope'u büyütüyorsa bunu `FOLLOW-UP SECURITY FEATURE` olarak kaydet; kullanıcının ana taleplerini bloke etme.

---

# PART H — SESSION / TOKEN SECURITY

## H1. Full admin token

Full admin session yalnız password success + required TOTP success sonrasında oluşturulmalı.

## H2. Refresh tokens

Admin refresh token sistemi varsa TOTP tamamlanmadan refresh token üretme.

## H3. Logout

Admin logout access session, refresh session ve pending auth challenge gibi ilgili auth state'i temizlemeli.

## H4. Normal user isolation

Normal user auth state ile admin auth state arasında privilege escalation oluşmamalı.

---

# PART I — ROUTE / API AUTHORIZATION

Admin panel API'leri backend'de ADMIN yetkisiyle korunmalı.

Sadece `pathname.startsWith("/pd-admin")` kontrolü güvenlik değildir.

Test et:

```text
anonymous → admin API denied
normal user → admin API denied
admin password-only before TOTP → admin API denied
fully authenticated admin → allowed
```

---

# PART J — ERROR MESSAGES

Login sırasında email yanlış / şifre yanlış / admin yok durumları attacker'a fazla bilgi vermemeli.

Generic credential error tercih edilmeli.

TOTP aşamasında uygun ama güvenli hata mesajı gösterilmeli.

TR / EN / DE tamamlanmalı.

---

# PART K — A11Y / RESPONSIVE / THEME

Admin Login ve TOTP ekranlarını 320 / 390 / 768 / 1024 / 1440 viewportlarında kontrol et.

Light/dark destekleniyorsa her ikisiyle çalışmalı.

QR ekranında accessible instructions, manual code fallback if product permits, proper labels, keyboard navigation ve focus management kontrol edilmeli.

---

# TEST MATRIX

## Test 1 — Normal Login isolation

```text
normal Login page
→ normal user login works
→ admin-specific UI görünmez
```

## Test 2 — `/pd-admin`

```text
anonymous
→ /pd-admin
→ dedicated admin login visible
```

## Test 3 — Normal user cannot become admin

```text
normal user authenticated
→ /pd-admin
→ admin access denied/login required
→ admin APIs 403/appropriate denial
```

## Test 4 — ENV admin no forced password change

```text
ENV admin email
+
ENV admin password
↓
credentials accepted
↓
NO forced password change page
```

## Test 5 — First TOTP setup

```text
ENV admin
→ login
→ 2FA not configured
→ QR shown
→ Google Authenticator scan
→ current 6-digit code
→ verification success
→ 2FA activated
→ admin panel
```

## Test 6 — Invalid enrollment code

```text
QR generated
→ wrong TOTP
→ activation rejected
→ 2FA remains not active
```

## Test 7 — Subsequent admin login

```text
email/password
→ password success
→ TOTP challenge
→ valid code
→ admin session
```

## Test 8 — Password only cannot access admin

```text
email/password valid
→ TOTP not yet completed
→ call admin API
→ DENIED
```

## Test 9 — Wrong TOTP

```text
correct password
→ wrong TOTP
→ no admin session
→ error
```

## Test 10 — Rate limit

Repeated wrong password / wrong TOTP attempts existing rate-limit/backoff rules according to security policy.

## Test 11 — Secret leakage

Verify TOTP secret does NOT appear in:

```text
logs
JWT
localStorage
sessionStorage
normal API payloads
frontend source bundle
```

## Test 12 — Logout

```text
admin login + TOTP
→ logout
→ /pd-admin protected state inaccessible
```

---

# DEFINITION OF DONE

Global completion için:

- [ ] Admin artık normal Login page üzerinden giriş yapmıyor.
- [ ] `/pd-admin` dedicated admin entry oluşturuldu.
- [ ] Public UI'da admin login linki bulunmuyor.
- [ ] `/pd-admin` gizliliği güvenlik mekanizması olarak kullanılmıyor.
- [ ] Backend ADMIN authorization korunuyor.
- [ ] ENV admin password frontend'e expose edilmiyor.
- [ ] ENV/bootstrap admin için forced password change kaldırıldı.
- [ ] Diğer temporary-password flows gereksiz yere bozulmadı.
- [ ] Google Authenticator compatible TOTP enrollment çalışıyor.
- [ ] QR scan → first-code verification → activation akışı çalışıyor.
- [ ] TOTP secret güvenli saklanıyor.
- [ ] Password success tek başına full admin token üretmiyor.
- [ ] TOTP doğrulanmadan admin API erişimi mümkün değil.
- [ ] Wrong TOTP admin session oluşturmuyor.
- [ ] Rate limiting/brute-force protection doğrulandı.
- [ ] Normal user admin route/API erişemiyor.
- [ ] Logout/session lifecycle doğru.
- [ ] TR/EN/DE tamamlandı.
- [ ] Responsive + light/dark + keyboard/focus test edildi.
- [ ] Backend tests geçti.
- [ ] Frontend lint/TypeScript/build geçti.
- [ ] Targeted Playwright geçti.
- [ ] Full Chromium regression geçti.
- [ ] Canonical pre-push geçti.

---

# CHECKBOX WORKFLOW

Her task tamamlandığında plan dosyasındaki checkbox anında güncellenmeli.

Başlangıç:

```md
- [ ] Task 4 — Google Authenticator compatible TOTP enrollment
```

Task implementation + tests + DoD tamamlandıktan sonra:

```md
- [x] Task 4 — Google Authenticator compatible TOTP enrollment
```

Bir taskın checkbox'ı sadece `kod yazıldı` diye `[x]` yapılmamalı.

Şunlar tamamlanmalı:

```text
implementation
+
targeted test
+
bug fix
+
re-test
+
DoD
```

---

# FINAL VALIDATION

Minimum:

```text
Backend targeted auth/security tests
Backend full mvn clean verify

Frontend:
lint
tsc --noEmit
production build

Playwright:
admin login
normal-user isolation
ENV admin
TOTP enrollment
TOTP challenge
wrong TOTP
admin authorization
logout
responsive/a11y

Full Chromium suite

Canonical:
./pre-push/pre-push.cmd
```

Docker build/start/health canonical gate'in parçasıysa çalıştır.

---

# FINAL REPORT

Completion dokümanı oluştur:

```text
PDA_ADMIN_AUTH_2FA_REFINEMENTS_COMPLETION.md
```

Başlıklar:

## Final verdict
## Task checklist
## Existing auth architecture
## Admin login separation
## `/pd-admin` behavior
## ENV bootstrap admin behavior
## Forced password change removal
## TOTP enrollment flow
## QR provisioning
## TOTP login challenge
## Secret storage
## Token/session behavior
## Authorization isolation
## Rate limiting / brute-force protection
## Responsive / a11y / i18n
## Backend/database changes
## Changed files
## Tests
## Remaining issues
## Follow-up security items

---

# KRİTİK KURALLAR

1. Önce mevcut auth mimarisini audit et.
2. Admin Login normal kullanıcı Login'inden ayrılmalı.
3. Admin giriş noktası `/pd-admin` olmalı.
4. Public navigasyona Admin Login linki ekleme.
5. `/pd-admin` adresinin bilinmemesine güvenlik özelliği gibi güvenme.
6. Tüm gerçek güvenlik backend authorization ile sağlanmalı.
7. Normal kullanıcı admin endpoint'lerine erişememeli.
8. ENV admin credential yalnız backend'de kalmalı.
9. Admin password frontend'e/loglara/API response'a çıkmamalı.
10. ENV admin için zorunlu password change kaldırılmalı.
11. Başka temporary-password flow'larını gereksiz yere kaldırma.
12. 2FA Google Authenticator uyumlu standart TOTP olmalı.
13. QR gösterildiği anda 2FA active sayılmamalı.
14. İlk doğru TOTP koduyla enrollment doğrulanmalı.
15. TOTP secret localStorage/sessionStorage/JWT'de tutulmamalı.
16. Password başarıyla doğrulandı diye full ADMIN token verme.
17. Full admin authentication ancak gerekli TOTP doğrulamasından sonra oluşmalı.
18. TOTP brute-force protection/rate limiting doğrulanmalı.
19. Admin API'leri server-side ADMIN authorization kullanmalı.
20. Admin route client guard ile sınırlı kalmamalı.
21. Normal user/admin auth boundary test edilmeli.
22. TR/EN/DE tamamlanmalı.
23. 320/390/768/1024/1440 test edilmeli.
24. Light/dark/a11y tamamlanmalı.
25. Persistent checkbox planı tutulmalı.
26. Her task implementation → targeted test → fix/retest → DoD → `[x]` sırasıyla yürütülmeli.
27. Kullanıcının plan dışı değişiklikleri revert edilmemeli.
28. Agent commit/push/staging yapmamalı.
29. Full regression ve canonical pre-push geçmeden global completion ilan edilmemeli.
