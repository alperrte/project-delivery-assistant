# PDA — Ayrı Admin Girişi, `/pd-admin` ve Google Authenticator 2FA — Final Completion

Kaynak talep: `.agents/PDA_Admin_Auth_2FA_Refinements_Plan_and_Implementation.md`. İş, kullanıcı kararıyla iki branch'te yapıldı ve main'e girdi:

- **Phase 1 `auth-service-backend`** — PR #139 (`c87d776`): admin giriş uçları, oturum bayrağı, zorunlu 2FA, ENV admin düzeltmesi, sertleştirme.
- **Phase 2 `auth-service-frontend`** — PR #141 (`228abda`): `/pd-admin` sayfası, QR/TOTP arayüzü, admin paneli koruması, admin E2E testlerinin yeni girişe taşınması.

## Final verdict

md'deki 5 ham talebin tamamı uygulandı ve main'de. Admin artık normal giriş sayfasından ve Google/GitHub ile giremiyor; yalnız `/pd-admin` üzerinden e-posta + şifre + zorunlu Google Authenticator (TOTP) koduyla giriyor. ENV admini zorunlu şifre değiştirmeye yönlendirilmiyor. Parola doğrulanınca tam oturum açılmıyor; yalnız kısa ömürlü, tek kullanımlık bir bilet veriliyor. Admin API'leri yalnız admin girişiyle açılmış oturumda çalışıyor.

Doğrulama durumu (dürüst kayıt): Phase 1'de backend `mvnw clean verify` **850/0**, Phase 2'de hedefli E2E **91/91** ve public paket **289/289** geçti. Birleşik main üzerinde canonical `pre-push.cmd` **koşturulmadı**: kullanıcı 2026-10-11'de kapsamlı testi kendisinin yaptığını belirterek tam pre-push'tan vazgeçti. Bu nedenle md'nin "Full regression PASS / Canonical pre-push PASS" şartı bu kayıtta **claim edilmiyor**; doğrulama sorumluluğu kullanıcıdadır.

## Task checklist

- [x] Phase 0 — Read-only auth/security audit
- [x] Task 1 — Admin authentication contract
- [x] Task 2 — Dedicated `/pd-admin` login experience
- [x] Task 3 — ENV bootstrap admin password-change behavior
- [x] Task 4 — Google Authenticator compatible TOTP enrollment
- [x] Task 5 — Admin login + TOTP verification flow
- [x] Task 6 — Security hardening / authorization regression
- [ ] Task 7 — Full regression / final verification (tam pre-push kullanıcı kararıyla koşturulmadı)

## Existing auth architecture

HS256 JWT (`JwtTokens`), HttpOnly çerezler `PDA_ACCESS` (`/api`), `PDA_REFRESH` (`/api/v1/auth`), ipucu çerezi `PDA_SESSION`; rol JWT'de değil, her istekte veritabanından okunur (`JwtCookieAuthenticationFilter`). Yenileme token'ı rotasyonlu (SHA-256 hash, tekrar kullanım tespiti oturumu iptal eder). Roller `GlobalRole {USER, ADMIN}`; `PlatformPermission` ve `RolePolicy` ile servis içinde ikinci kontrol (`AdminAuthorization`). CSRF `csrf.spa()`. TOTP motoru (Alper'in PR #135'i): `TotpService`/`Totp`/`TotpCrypto`, RFC 6238, SHA-1, 6 hane, 30 sn, ±1 adım, kullanılmış adım tekrar kabul edilmez, 5 yanlış kod → 15 dk kilit, secret AES-256-GCM (`TOTP_ENCRYPTION_KEY`), 10 yedek kod.

## Admin login separation

Normal `POST /api/v1/auth/login` ve Google/GitHub girişi ADMIN hesabını **yanlış şifreyle birebir aynı** genel 401 ile reddeder (hesabın admin olduğu sızmaz; OAuth `oauth_error=provider_error` ile döner). Normal `/login/2fa` da ADMIN'i reddeder. Admin için ayrı uçlar: `POST /api/v1/auth/admin/login`, `/admin/2fa/setup`, `/admin/2fa/enable`, `/admin/login/2fa` (hepsi public + CSRF).

## `/pd-admin` behavior

Dil öneksiz tek URL (`ADMIN_ENTRY_PATH`); `proxy.ts` bilerek geçirir ve `X-Robots-Tag: noindex, nofollow` ekler, sayfa `noindex` meta taşır; `/tr/pd-admin` ve alt yollar 404. Hiçbir public yüzeyde (landing, auth, footer, navbar) link yok; `robots`/`sitemap`/`llms.txt`'te de yok. Dil NEXT_LOCALE çerezi/Accept-Language ile. Doğrulanmış admin oturumu varsa panele (`/admin/users`) yönlendirir; normal kullanıcı oturumu `/pd-admin`'de admin giriş formunu görür ve admin yetkisi kazanmaz. Analitik izleyici bu adresi ölçmez. Not: `/pd-admin` dizgesi istemci paketinde sabit olarak bulunur (dil değiştirici ve izleyici hariç tutması için); bu bir link değildir ve URL gizliliği güvenlik önlemi sayılmaz.

## ENV bootstrap admin behavior

`AdminBootstrapRunner` gerçek ENV adlarını kullanır (`ADMIN_EMAIL`, `ADMIN_INITIAL_PASSWORD`; parola 12–72 karakter). Yalnız hiç admin yoksa hesabı oluşturur; sonraki açılışlarda hiçbir şey değişmez (parola yeniden yazılmaz, ENV değişse de yok sayılır, mevcut kullanıcı admin'e terfi ettirilmez). Parola yalnız backend'dedir (`NEXT_PUBLIC_*` yok), log/yanıt/depolamaya girmez. Kullanıcı politikası (2026-10-10): tek admin = ENV hesabı; rol değiştirme özelliği yok.

## Forced password change removal

`User.bootstrapAdmin` artık `mustChangePassword=true` set etmez; mevcut kayıtlar için veri migration'ı bayrağı temizledi (bayrak yalnız bootstrap'te set ediliyordu — kodda doğrulandı). `mustChangePassword` mekanizması (filtre izin listesi, değiştirme akışı) **korundu**; başka bir temporary-password akışı zaten yoktu. Telafi kontrolü: zorunlu TOTP.

## TOTP enrollment flow

2FA'sı olmayan admin: `admin/login` → `TWO_FACTOR_ENROLLMENT_REQUIRED` + 10 dk'lık `PDA_ADMIN_ENROLL` bileti (oturum yok) → `admin/2fa/setup` (QR verisi) → kullanıcı kodu girer → `admin/2fa/enable`: yanlış kodla 2FA **aktif olmaz** (`two_factor_code_invalid`); doğru kodla aktif olur, 10 yedek kod bir kez döner, bilet tüketilir ve ancak o zaman admin-doğrulanmış oturum açılır. Admin hesabında `/auth/2fa/disable` reddedilir (`admin_two_factor_required`); yedek kod yenileme parola/TOTP kurallarıyla kalır.

## QR provisioning

`otpauth://totp/PDA:{admin e-posta}?secret=BASE32&issuer=PDA&algorithm=SHA1&digits=6&period=30` (Google Authenticator ve standart TOTP uygulamalarıyla uyumlu). Secret yalnız setup yanıtında (`Cache-Control: no-store`), uygulama durumunda bellekte tutulur; JWT, localStorage/sessionStorage, normal API yanıtları ve loglarda yoktur. Arayüz: numaralı talimatlar, QR (`role="img"`), kopyalanabilir manuel anahtar, 6 haneli kod alanı (`autocomplete="one-time-code"`).

## TOTP login challenge

`admin/login` → `TWO_FACTOR_REQUIRED` + 5 dk'lık `PDA_ADMIN_MFA` bileti → `admin/login/2fa {code}` (TOTP veya yedek kod). Parola doğru olsa bile bu aşamada erişim/yenileme token'ı **üretilmez**. Bilet sunucu tarafında tek kullanımlıktır (`admin_auth_tickets`, koşullu `UPDATE ... WHERE consumed_at IS NULL`); tekrar/eşzamanlı ikinci kullanım 0 satır günceller ve tüm giriş geri alınır. Yanlış kod bileti yakmaz (yazım hatası şifre yeniden girişi gerektirmesin diye); hesap kilidi ve hız sınırı korur. Çoklu bilet: yeni parola adımı eski biletleri siler; bilet normal erişim token'ı olarak kabul edilmez, normal ve admin biletleri birbirine geçmez.

## Secret storage

Mevcut proje şifrelemesi yeniden kullanıldı: AES-256-GCM (12 bayt IV, AAD `totp:userId`), anahtar `TOTP_ENCRYPTION_KEY` (Base64, 32 bayt). Anahtar yoksa admin girişi kimlik bilgilerine bakmadan **503 `two_factor_unavailable`** ile kapalı kalır (bilgi sızdırmaz); anahtar değişmiş/okunamıyorsa normal ve admin ikinci adım yolları 500 yerine kontrollü 503 döner. Yedek kodlar HMAC-SHA256 ile hash'li saklanır.

## Token/session behavior

Tam admin oturumu yalnız parola başarısı + TOTP/enrollment başarısı sonrası açılır (`UserSessions.openAdminVerified`); `user_sessions.admin_verified_at` bayrağı yenileme rotasyonunda korunur. Yenileme token'ı TOTP tamamlanmadan üretilmez. Logout erişim/yenileme çerezlerini ve `PDA_MFA`, `PDA_ADMIN_MFA`, `PDA_ADMIN_ENROLL` biletlerini temizler; frontend çıkışta `["auth","2fa"]` önbelleğini de temizler. Eski admin oturumları (bayraksız) admin API'ye erişemez → `/pd-admin`'den yeniden giriş.

## Authorization isolation

`/api/v1/admin/**`: ROLE_ADMIN **ve** admin-doğrulanmış oturum (`JwtCookieAuthenticationFilter`, ikinci hat `AdminAuthorization.require`). Anonim → 401; normal kullanıcı → 403; admin ama doğrulanmamış (yalnız parola/eski oturum) → 403 `admin_reauthentication_required`; tam doğrulanmış admin → izin. Rol JWT'den okunmaz. İstemci tarafı: `AdminArea` yalnız `ADMIN` + `adminVerified` için render eder, aksi hâlde `/pd-admin`'e yönlendirir; ancak asıl güvenlik backend'dedir. Admin linkleri yalnız doğrulanmış adminde görünür.

## Rate limiting / brute-force protection

Admin login/2FA/enrollment uçları "sensitive" kovada: IP başına 10 dk'da 5 istek (route başına); TOTP hesap kilidi: 5 yanlış kod → 15 dk (giriş, enable, disable, yedek kod yenileme ortak). Admin giriş adımında bilinmeyen/yanlış/admin-olmayan/devre dışı hesap aynı genel yanıtı verir. **Hesap bazlı parola kilidi yoktur** (yalnız IP bazlı sınır) — takip maddesi.

## Responsive / a11y / i18n

`/pd-admin` 320/390/768/1024/1440 genişliklerde ve açık/koyu temada E2E ile doğrulandı; odak her adımda başlığa taşınır, hatalar `role="alert"`, 44 px hedefler, klavye ile uçtan uca tamamlanabilir. Metinler TR/EN/DE (Almanca resmi "Sie"); genel kimlik hatası, 429, 503 ve süresi dolan bilet için ayrı mesajlar.

## Backend/database changes

- Yeni uçlar: `POST /api/v1/auth/admin/login`, `/admin/2fa/setup`, `/admin/2fa/enable`, `/admin/login/2fa`.
- Çerezler: `PDA_ADMIN_MFA` (`/api/v1/auth/admin/login/2fa`, 5 dk), `PDA_ADMIN_ENROLL` (`/api/v1/auth/admin/2fa`, 10 dk); HttpOnly, SameSite=Lax, prod'da Secure.
- Migration'lar (Phase 1'de V67/V68): `user_sessions.admin_verified_at` + `admin_auth_tickets` tablosu; bootstrap admin bayrağı temizliği. Kullanıcının 2026-10-11 migration birleştirmesinden sonra bu içerik `V37__admin_verified_sessions_and_tickets.sql` olarak numaralıdır (SQL baytları değişmeden yeniden numaralama).
- `GET /auth/me` artık `adminVerified` taşır. Yeni ENV adı yok.
- `SecurityBaselineConfiguration` ve `AuthRateLimitFilter` değişiklikleri kullanıcı onaylı ortak dosyalardır.

## Changed files

Ayrıntılı listeler PR #139 ve #141'de. Başlıca: backend `AdminAuthController`, `AdminAuthService`, `AdminAuthTicket`+repository, `AdminReauthenticationRequiredException`, `LocalLoginService`, `AuthCookies`, `JwtCookieAuthenticationFilter`, `OAuthLoginHandlers`, `TotpCrypto`/`TotpService`, `UserSession*`, `AdminBootstrapRunner`, `User`; frontend `app/pd-admin/**`, `features/admin-auth/**`, `admin-guard.tsx`, `app-shell.tsx`, `use-complete-login.ts`, `lib/api/client.ts`/`error-message.ts`, `proxy.ts`, `i18n/routing.ts`, `adminLogin` i18n namespace, `e2e/admin-login.spec.ts` ve taşınan admin spec'leri; dokümanlar (`SECURITY.md`, `authentication.md`, `api.md`, `database.md`, `frontend-design-rules.md`, `folder-structure.md`).

## Tests

| Doğrulama | Sonuç |
| --- | --- |
| Backend `mvnw clean verify` (Phase 1, `AdminAuthIntegrationTest` 16 + `AdminAuthHardeningIntegrationTest` 3 + migration testi dahil) | 850 / 0 / 0 / 0 |
| Hedefli E2E (Phase 2: admin-login 19, admin-users 9, admin-analytics 11, auth-session-audit 4, localized-routing 24, authenticated-history 2, auth-two-factor-and-deletion 4, landing-page 18) | 91 / 91 |
| Public paket (Phase 2) | 289 / 289 |
| Sonraki işler (checklist HAMZA Phase 1: `clean verify`) | 892 / 0 |
| Birleşik main'de canonical pre-push | **Koşturulmadı** (kullanıcı kendi kapsamlı testini yaptı) |

Test notu: admin "TOTP anahtarı yok → 503" testi `.env` yüklenmiş ortamda (pre-push) gerçek anahtarı görüp düşüyordu; testin kendi özellikleri (`TOTP_ENCRYPTION_KEY=""`, limitler) açıkça verilerek düzeltildi.

## Remaining issues

- Task 7 (tam regresyon + canonical pre-push) kullanıcıya bırakıldı; "global completion" bu nedenle md'nin katı anlamında ilan edilmiyor.
- Admin çıkış yapınca `/login`'e gider (`/pd-admin`'e değil); ayrı çıkış hedefi eklenmedi.
- Kapanmış bir oturumu kapatmaya çalışınca backend `USER_NOT_FOUND` döner (oturuma özel kod yok); oturum listesinde "bu benim oturumum" bayrağı yok, admin kendi oturumunu kapatabilir (arayüz uyarır).
- 4xx/5xx sayaçları ve zamanlanmış iş bilgisi süreç belleğindedir.

## Follow-up security items

- **ENV ile tetiklenen 2FA sıfırlama** (FOLLOW-UP SECURITY FEATURE): tüm yedek kodlar ve cihaz kaybolursa bugünkü prosedür, operasyonun veritabanında adminin `totp_credentials`/`totp_recovery_codes` satırlarını silmesidir (sonraki `/pd-admin` girişinde yeniden kurulum).
- Hesap bazlı parola kilidi / artımlı bekleme (şu an yalnız IP bazlı sınır).
- Admin oturum ömrü: erişim 15 dk / yenileme 7 gün kullanıcılarla aynı; `admin_verified_at` için azami yaş veya kritik işlemde TOTP ile yeniden doğrulama (step-up).
- Admin giriş bildirimi / IP kısıtlaması.
- Çok sunuculu kurulumda hız sınırı ve ticket durumu paylaşımlı depoya taşınmalı (hız sınırı şu an bellekte).
