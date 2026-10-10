<!-- markdownlint-disable MD024 -->
# PDA — Ayrı Admin Girişi, `/pd-admin` ve Google Authenticator 2FA — Persistent Plan

Kaynak talep: `.agents/PDA_Admin_Auth_2FA_Refinements_Plan_and_Implementation.md` (5 ham talep, Part A–K, 12 test, global DoD).
Bu dosya implementation boyunca source of truth'tur; checkbox'lar gerçek zamanlı güncellenir.

Yürütme: implementation → targeted test → bug fix → re-test → DoD → `[x]` → sonraki bağımlı task.
Git: branch dağılımı aşağıda (kullanıcı ajana bıraktı); staging, branch değiştirme ve `git pull --ff-only origin main` ajan tarafından; `git commit` / `git push` yalnız kullanıcıda. Kodlama: Sonnet 5.5 (high) alt-ajanları; inceleme/test/dokümantasyon Opus. Kodlamadan önce `git branch --show-current` + `HEAD == origin/main` doğrulanır.
Test politikası (kullanıcı kararı 2026-10-10): Phase 1–2'de yalnız hedefli kontroller (etkilenen backend testleri, lint, `tsc`, ilgili Playwright); tam `mvn clean verify` + full Chromium + canonical pre-push bir kez Phase 3'te.

## Branch execution status

- [x] Phase 0 — Global read-only auth/security audit (kod değişikliği yok)
- [x] Phase 1 — `auth-service-backend`: Task 1, Task 3, Task 4/5 backend uçları, Task 6 backend sertleştirmesi
- [x] Transition Gate 1 — kullanıcı commit/push + main'e merge (PR #139, `c87d776`)
- [x] Phase 2 — `auth-service-frontend`: Task 2, Task 4/5 arayüzü, Task 6 E2E/admin spec taşıması
- [ ] Transition Gate 2 — kullanıcı commit/push + main'e merge
- [ ] Phase 3 — main üzerinde final verification (Task 7) + completion dokümanı

Gerekçe: proje backend/frontend işlerini servis branch'lerine ayırıyor; auth bu alanın sahibi. İki auth branch'i de main'e tamamen merge edilmiş (ileride commit yok). Frontend, backend uçları main'e girdikten sonra gerçek backend ile test edilir. Not: `auth-service-frontend` şu an `.branch-worktrees/auth-service-frontend` worktree'sinde checkout (temiz, merge edilmiş `ae52bf4`); Phase 2'de o worktree kaldırılıp ana çalışma ağacında checkout edilecek (kullanıcı onayıyla).

## Execution status

- [x] Phase 0 — Global read-only auth/security audit
- [x] Task 1 — Admin authentication contract
- [x] Task 2 — Dedicated `/pd-admin` login experience
- [x] Task 3 — ENV bootstrap admin password-change behavior
- [x] Task 4 — Google Authenticator compatible TOTP enrollment
- [x] Task 5 — Admin login + TOTP verification flow
- [x] Task 6 — Security hardening / authorization regression
- [ ] Task 7 — Full regression / final verification

---

## Phase 0 — Audit bulguları (2026-10-10, main `90f7c7c`)

### Mevcut auth mimarisi (gerçek isimler)

| Alan | Gerçek durum |
| --- | --- |
| Login | `AuthSessionController` `POST /api/v1/auth/login` (`LoginRequest{email,password}`) → `LocalLoginService.login` → `afterFirstFactor`. 2FA kapalıysa oturum açar (boş 200), açıksa `{"status":"TWO_FACTOR_REQUIRED"}` + `PDA_MFA` ticket. OAuth (`OAuthLoginHandlers`) aynı `afterFirstFactor`'u kullanır. |
| Token/cookie | HS256 `JwtTokens` (`JWT_SECRET`, access 15 dk, refresh 7 gün). Cookie'ler `AuthCookies`: `PDA_ACCESS` (`/api`), `PDA_REFRESH` (`/api/v1/auth`), `PDA_SESSION` hint (`/`), ticket'lar `PDA_MFA` (`/api/v1/auth/login`, 5 dk), `PDA_RESET`, `PDA_PWCHANGE`. HttpOnly, `SameSite=Lax`, prod'da Secure. **JWT'de rol yok**; rol her istekte DB'den (`JwtCookieAuthenticationFilter`, `findActiveById`, `sid` aktif oturum kontrolü). |
| Refresh/logout | `UserSessionService.rotate` (SHA-256 hash, önceki hash ile reuse tespiti → oturum iptal). Logout yalnız mevcut oturumu iptal eder, `PDA_ACCESS/REFRESH/SESSION` temizler; **`PDA_MFA`'yı temizlemez**. |
| Roller | `GlobalRole {USER, ADMIN}`; `PlatformPermission {USER_MANAGE, SESSION_MANAGE, AUDIT_VIEW, SYSTEM_VIEW}`; `RolePolicy`. `/api/v1/admin/**` GET/POST `hasRole("ADMIN")` (`SecurityBaselineConfiguration` L192-193) **ve** servis içinde `AdminAuthorization.require(...)`. Anonim 401, USER 403. |
| 2FA (PR #135) | `AuthTwoFactorController` + `TotpService`/`Totp`/`TotpCrypto`, V65 (`totp_credentials`, `totp_recovery_codes`). Herkes için **opsiyonel**. Setup → secret + `otpauth://totp/PDA:{email}?secret=…&issuer=PDA&algorithm=SHA1&digits=6&period=30` yalnız setup yanıtında (`no-store`); ilk doğru kodla aktivasyon + 10 yedek kod (bir kez); ±1 adım; kullanılan adım tekrar kabul edilmez (`lastUsedStep` + `@Version`); 5 yanlış kod → 15 dk kilit; secret AES-256-GCM (`TOTP_ENCRYPTION_KEY`, AAD `totp:userId`); disable = parola + TOTP/yedek kod. |
| Admin bootstrap | `AdminBootstrapRunner` (`ADMIN_EMAIL`, `ADMIN_INITIAL_PASSWORD`, 12–72 karakter) → `UserAdministrationService.bootstrapAdmin` → `User.bootstrapAdmin` (**`mustChangePassword=true`** yalnız burada set edilir). Sonraki açılışlarda hiçbir şey değişmez (parola overwrite yok; ENV değişirse yok sayılır). Başka temporary-password akışı **yok**. |
| Forced change | `JwtCookieAuthenticationFilter` allow-list (`me`, `password/change`, `logout`, `refresh`, `csrf`, analytics, contact) dışındaki her şeye 403 `password_change_required`. Frontend yalnız login sonunda `/change-password`'e yönlendirir (`use-complete-login.ts`). |
| Rate limit | `AuthRateLimitFilter`: bellekte, IP+route, 10 dk; login 30, `login/2fa` ayrı kova 30, sensitive 5. **Hesap bazlı kilit yok**; TOTP için hesap bazlı 5/15 dk var. |
| Audit | Kalıcı audit tablosu yok; yalnız SLF4J (secret/parola loglanmıyor). |
| Frontend | Login: `(auth)/login` → `LoginFlow` → `LoginForm` / `TwoFactorLoginForm` → `useCompleteLogin`. Admin paneli `(app)/admin/{users,analytics}` (`/tr/yonetim/...`), `AdminArea` client guard (`globalRole === "ADMIN"`), linkler yalnız `AppShell`/`AppHeader`'da rol ile. 2FA ayar paneli `features/account/components/two-factor-panel.tsx` (`qrcode.react`, manuel anahtar fallback). `proxy.ts`: `matchPath` null ise dokunmadan geçirir (yeni `/pd-admin` locale/auth rewrite almaz). |
| E2E | Admin spec'leri normal kullanıcıyı `promoteToAdmin` (SQL) ile admin yapıp normal `/login`'den girer. ENV admin/forced change E2E yok. TOTP yardımcısı `e2e/totp.ts`; 2FA akışı `auth-two-factor-and-deletion.spec.ts`. Kayıt Mailpit kodu ister (yerel override scratchpad'de). |

### Audit'te bulunan, plana alınan riskler

1. **Normal `/login` ve OAuth admin'e tam oturum veriyor** — admin ayrımı yalnız UI'da değil backend'de kurulmalı.
2. **`PDA_MFA` ticket'ı tek kullanımlık değil** (ref sabit `"mfa"`); 5 dk içinde tekrar oynatılabilir (her seferinde geçerli kod yine gerekir).
3. **`TOTP_ENCRYPTION_KEY` boş/değişmişse 2FA'lı kullanıcı login'de 500 alır** (`requireKey()` → yakalanmayan `IllegalStateException`). Admin için TOTP zorunlu olacağından fail-closed + anlamlı hata gerekir.
4. Logout `PDA_MFA`'yı temizlemiyor; frontend logout `["auth","2fa"]` önbelleğini temizlemiyor.
5. `robots.ts` admin URL'lerini listeliyor (gizlilik güvenlik değildir; bilgi amaçlı).
6. `.agents/authentication.md:70` var olmayan `docs/compliation/2026-10-10-auth-sertlestirme.md`'ye işaret ediyor (Alper'in kaydı eksik — bilgi).

### Kullanıcı kararları

- Branch: dağılım ajana bırakıldı (2026-10-10) → Phase 1 `auth-service-backend`, Phase 2 `auth-service-frontend`, Phase 3 main.
- E-posta doğrulama kararı kapatıldı (Alper PR #135).
- **Normal login (2026-10-10):** ADMIN hesabı normal `/login` ve Google/GitHub ile **tamamen engellenir**; genel kimlik hatası döner (admin olduğu sızmaz). Admin yalnız `/pd-admin`'den girer.
- **2FA kapsamı:** **tüm ADMIN hesapları** için zorunlu (ENV admini + sonradan admin yapılanlar).
- **İlk kurulum:** parola sonrası **oturum yok**; kısa ömürlü (10 dk), tek kullanımlık, yalnız kurulum uçlarında geçerli bilet; ilk doğru kodla 2FA aktif + ancak o zaman admin oturumu.
- **Branch:** Alper auth branch'lerinde çalışmıyor → Phase 1 `auth-service-backend`, Phase 2 `auth-service-frontend`, Phase 3 main.

### Ajan kararları (gerekçeli)

- **Kurtarma:** mevcut 10 yedek kod (kurulumda bir kez gösterilir) yeterli kurtarma yolu; frontend'den 2FA kapatma ucu eklenmez. Tüm yedek kodlar da kaybolursa operasyonel prosedür (DB'de `totp_credentials`/`totp_recovery_codes` satırının silinmesi → sonraki girişte yeniden kurulum) `SECURITY.md`'ye yazılır; ENV ile tetiklenen sıfırlama `FOLLOW-UP SECURITY FEATURE`.
- **Admin 2FA kapatma:** admin hesabında `/auth/2fa/disable` reddedilir (zorunlu politika); yedek kod yenileme parola+TOTP ile kalır.
- **Mevcut bootstrap admin:** veri migration'ı ile `must_change_password=false` (bayrak yalnız bootstrap'te set edildiği için güvenli); mekanizma kodu korunur.
- **`/pd-admin`:** locale önekisiz tek URL (talep metnindeki gibi); dil cookie/`Accept-Language`; `noindex`; robots/sitemap/public navigasyona eklenmez. Başarılı girişte mevcut panel (`/admin/users` → `/tr/yonetim/kullanicilar`).
- **Eski admin oturumları:** yeni oturum bayrağı olmadan admin API 403 `admin_reauthentication_required`; admin `/pd-admin`'den yeniden girer.
- **Rate limit:** admin login/2FA uçları sensitive kovasında (5/10 dk/IP) + mevcut TOTP hesap kilidi (5 yanlış → 15 dk).

---

## Phase 1 — `auth-service-backend` (Task 1, 3 + Task 4/5/6 backend)

## Task 1 — Admin authentication contract

### Amaç

Admin ile normal kullanıcının kimlik doğrulama sözleşmesini backend'de ayırmak: admin yalnız ayrı admin uç noktasından, parola + TOTP ile tam oturum alır; admin API'leri yalnız bu şekilde açılmış oturumla erişilebilir.

### Neden bu sırada?

Ayrı sayfa (Task 2), enrollment (Task 4) ve TOTP challenge (Task 5) bu sözleşmeye dayanır.

### Prerequisite

Phase 0 + kullanıcı kararları.

### Etkilenecek alanlar

- Backend: yeni `AdminAuthController` (`/api/v1/auth/admin/login`, `/login/2fa`, enrollment uçları Task 4'te), `LocalLoginService`/`afterFirstFactor` (rol kontrolü), `OAuthLoginHandlers` (admin hesabı OAuth ile tam oturum alamaz), `JwtCookieAuthenticationFilter` (admin API için oturumun admin-MFA ile açıldığı kontrolü), `SecurityBaselineConfiguration` matcher'ları (kullanıcı onaylı ortak dosya).
- Database: `user_sessions`'a oturumun nasıl doğrulandığını tutan alan (ör. `admin_verified_at TIMESTAMPTZ NULL`) — yeni migration (V67).
- Frontend: yok (Task 2).
- Authentication: normal login'de ADMIN hesabı → genel 401 (enumeration yok); admin login'de USER hesabı → aynı genel 401.
- Authorization: `/api/v1/admin/**` = `ROLE_ADMIN` **+** oturum admin-MFA ile açılmış. Mevcut admin oturumları (eski) admin API'ye erişemez → yeniden `/pd-admin`'den giriş.
- Security: URL gizliliği güvenlik sayılmaz; tüm kontrol backend'de.
- Cache/session: refresh rotasyonunda bayrak korunur.
- i18n/a11y: yok.
- Tests: `AdminAuthContractIntegrationTest` (anonim/USER/admin-parola-only/tam admin matrisi), `LocalAuthIntegrationTest`, `AdminIntegrationTest` uyarlaması, `ModularityTest`.

### Checklist

- [x] 1.1 Sözleşme dokümanı (`SECURITY.md` + `authentication.md` + `api.md`): uçlar, durum kodları, ticket'lar, oturum bayrağı.
- [x] 1.2 Migration + `UserSession` alanı + refresh rotasyonunda taşınması.
- [x] 1.3 Normal login/OAuth admin'i reddeder (genel hata), admin login USER'ı reddeder (aynı genel hata).
- [x] 1.4 Admin API filtresi: ADMIN rolü + admin-doğrulanmış oturum; değilse 403 `admin_reauthentication_required`.
- [x] 1.5 Testler (Test 1, 3, 8 backend tarafı).

### Definition of Done

- [x] Normal kullanıcı/normal oturum hiçbir yoldan admin API'ye erişemiyor.
- [x] Admin hesabı normal login'den tam oturum alamıyor; hata mesajı kullanıcı varlığını sızdırmıyor.

## Task 2 — Dedicated `/pd-admin` login experience

### Amaç

`/pd-admin` doğrudan URL ile açılan, normal Login'in koşullu kopyası olmayan ayrı yönetici giriş sayfası.

### Neden bu sırada?

Task 1 uçları hazır olduktan sonra UI kurulabilir; Task 4/5 bu sayfanın adımlarını doldurur.

### Prerequisite

Task 1.

### Etkilenecek alanlar

- Backend: yok.
- Database: yok.
- Frontend: `src/app/pd-admin/` (locale önekisiz tek URL; dil cookie/`Accept-Language` ile), `features/admin-auth/**` (form, adım makinesi, API), `AuthShell`/`AuthCard`/`FormField`/`SubmitButton` yeniden kullanımı; oturum varsa ve admin-doğrulanmışsa mevcut panele (`/admin/users` → `/tr/yonetim/kullanicilar`) yönlendirme; `proxy.ts` (`/pd-admin` geçişi bilinçli, noindex), `authenticated-route`/routing testleri.
- Authentication: credentials adımı (e-posta + parola).
- Authorization: sayfa yalnız UI; yetki backend'de.
- Security: public navigasyon/footer/landing/robots/sitemap'e link **eklenmez**; sayfa `noindex`.
- Cache/session: başarılı girişte mevcut `useCompleteLogin` temizlik desenine paralel temizlik.
- i18n/a11y: yeni `adminLogin` namespace TR/EN/DE (DE "Sie"); başlık "PDA Yönetici Girişi"; generic credential error.
- Tests: `e2e/admin-login.spec.ts` (Test 1, 2, 3 UI), 320–1440, light/dark.

### Checklist

- [x] 2.1 Rota + sayfa iskeleti + branding.
- [x] 2.2 Credentials adımı (Task 1 uçlarına bağlı), generic hata, rate-limit mesajı.
- [x] 2.3 Oturum varsa yönlendirme davranışı (A2).
- [x] 2.4 Public yüzeylerde link olmadığının testi; normal Login'de admin UI yok (Test 1).
- [x] 2.5 Responsive/tema/klavye/odak.

### Definition of Done

- [x] Anonim `/pd-admin` → admin login görünür; normal kullanıcı oturumu admin yetkisi vermez.
- [x] Public UI'da admin login linki yok.

## Task 3 — ENV bootstrap admin password-change behavior

### Amaç

ENV ile oluşturulan admin, ENV e-posta + parola ile girişte zorunlu şifre değiştirme sayfasına gönderilmez.

### Neden bu sırada?

Task 4'ün ilk-giriş enrollment akışı forced change engeli kalkmadan çalışamaz (`/2fa/*` şu an 403 `password_change_required`).

### Prerequisite

Task 1.

### Etkilenecek alanlar

- Backend: `User.bootstrapAdmin` artık `mustChangePassword=true` set etmez; `AdminBootstrapRunner` log metni; filtre allow-list mekanizması **korunur** (gelecekteki temporary-password akışları için).
- Database: veri migration'ı — mevcut bootstrap admin'lerin bayrağını temizle (`UPDATE users SET must_change_password=false WHERE global_role='ADMIN'`; bayrak yalnız bootstrap'te set edildiği için kapsam güvenli).
- Frontend: yok (bayrak false olunca `useCompleteLogin` zaten yönlendirmez).
- Authentication: ENV parola yaşam döngüsü değişmez (startup'ta overwrite yok — mevcut davranış korunur ve dokümante edilir).
- Authorization: yok.
- Security: ENV parola yalnız backend'de (`NEXT_PUBLIC_*` yok — doğrulandı); parola artık değiştirilmeden kullanılabildiği için admin TOTP zorunluluğu (Task 4/5) telafi kontrolüdür.
- Cache/session: yok.
- i18n/a11y: yok.
- Tests: `AdminIntegrationTest` L81/L133 uyarlaması (Test 4), restart sonrası parola değişmez testi korunur.

### Checklist

- [x] 3.1 Bootstrap + migration.
- [x] 3.2 Testler (Test 4; diğer `mustChangePassword` mekanizması bozulmadı).
- [x] 3.3 Docs (`authentication.md` Admin bootstrap, `SECURITY.md` L446, `deployment.md` madde 5).

### Definition of Done

- [x] ENV admin forced change'e düşmüyor; mekanizma kodu ve diğer akışlar sağlam.

## Task 4 — Google Authenticator compatible TOTP enrollment

### Amaç

Admin için 2FA zorunlu: 2FA'sı olmayan admin, parola doğrulandıktan sonra **oturum almadan** QR ile kurulum yapar; ilk doğru kodla aktivasyon olur, ancak o zaman admin oturumu açılır.

### Neden bu sırada?

Task 5'in her girişte TOTP isteyebilmesi için admin'in bağlı bir authenticator'ı olmalı.

### Prerequisite

Task 1, Task 3.

### Etkilenecek alanlar

- Backend: mevcut `TotpService.beginSetup`/`enable` **yeniden kullanılır** (yeni TOTP motoru yok); admin enrollment ticket'ı (`PDA_ADMIN_ENROLL`, kısa ömürlü, tek kullanımlık, yalnız admin enrollment uçlarında geçerli) ve uçlar `POST /auth/admin/2fa/setup`, `POST /auth/admin/2fa/enable` (başarıda 10 yedek kod + admin-doğrulanmış oturum). Secret yalnız setup yanıtında, `no-store`.
- Database: yok (V65 tabloları).
- Frontend: `/pd-admin` enrollment adımı — QR (`qrcode.react`), erişilebilir talimat, manuel anahtar fallback, 6 haneli kod, yedek kodların bir kez gösterimi + "kaydettim" onayı; mevcut `two-factor-panel` parçaları paylaşılabilir.
- Authentication: QR gösterildi diye 2FA aktif olmaz (D3).
- Authorization: enrollment uçları yalnız geçerli admin enrollment ticket'ı ile.
- Security: secret localStorage/sessionStorage/JWT'de yok; `TOTP_ENCRYPTION_KEY` yoksa admin login fail-closed (503 `two_factor_unavailable`, anlamlı mesaj).
- Cache/session: yok.
- i18n/a11y: TR/EN/DE talimatlar; QR `role="img"` + label; odak yönetimi.
- Tests: backend (Test 5, 6 + ticket tek kullanım/süre), E2E `admin-totp-enrollment.spec.ts` (`e2e/totp.ts` ile gerçek kod).

### Checklist

- [x] 4.1 Enrollment ticket + uçlar (mevcut servis üstünde). (backend: `PDA_ADMIN_ENROLL`, `/auth/admin/2fa/setup|enable`)
- [x] 4.2 Yanlış kodla aktivasyon yok; doğru kodla aktivasyon + oturum + yedek kodlar. (backend testleri)
- [x] 4.3 UI adımı.
- [x] 4.4 Testler.

### Definition of Done

- [x] QR → ilk doğru kod → aktivasyon → admin paneli; yanlış kodla 2FA aktif değil; secret sızmıyor.

## Task 5 — Admin login + TOTP verification flow

### Amaç

Sonraki girişler: e-posta + parola → TOTP challenge → admin-doğrulanmış oturum → admin paneli.

### Neden bu sırada?

Enrollment (Task 4) sonrası düzenli akış.

### Prerequisite

Task 4.

### Etkilenecek alanlar

- Backend: `POST /auth/admin/login/2fa` (mevcut `completeSecondFactor` + admin oturum bayrağı); admin MFA ticket'ı **tek kullanımlık** (sunucu tarafı nonce/jti); yedek kod ile giriş (mevcut).
- Database: tek kullanımlık ticket için gerekirse küçük tablo veya mevcut TOTP credential üzerinde nonce (Task 1 migration'ına dahil edilebilir).
- Frontend: TOTP adımı (6 hane, boşluk normalizasyonu, yedek kod seçeneği, süre dolunca credentials'a dönüş), başarıda `/admin/users`.
- Authentication: parola tek başına tam token/refresh üretmez (H1/H2).
- Authorization: Test 8 (parola-only → admin API 401/403).
- Security: generic credential hatası; TOTP hata kodları mevcut (`two_factor_code_invalid`, `two_factor_locked`, `two_factor_session_expired`).
- Cache/session: logout `PDA_MFA`/admin ticket'larını da temizler (H3); frontend logout `["auth","2fa"]` önbelleğini temizler.
- i18n/a11y: TR/EN/DE.
- Tests: Test 7, 8, 9, 12 (backend + E2E).

### Checklist

- [x] 5.1 Challenge uçları + tek kullanımlık ticket. (backend: `PDA_ADMIN_MFA` tek kullanımlık, `admin_auth_tickets`)
- [x] 5.2 UI adımı + hata durumları.
- [x] 5.3 Logout temizliği (backend + frontend). (backend tamam: ticket cookie'leri temizleniyor; frontend `["auth","2fa"]` Phase 2)
- [x] 5.4 Testler.

### Definition of Done

- [x] Parola + doğru TOTP → admin paneli; yanlış TOTP → oturum yok; logout sonrası korunan durum erişilemez.

## Task 6 — Security hardening / authorization regression

### Amaç

Brute-force, sızıntı ve izolasyon kontrollerini doğrulamak ve eksikleri kapatmak.

### Neden bu sırada?

Tüm akış kurulduktan sonra uçtan uca sertleştirme.

### Prerequisite

Task 5.

### Etkilenecek alanlar

- Backend: `AuthRateLimitFilter` — admin login uçları için sıkı kova (sensitive 5/10 dk/IP) + mevcut TOTP hesap kilidi; `TOTP_ENCRYPTION_KEY` yok/bozuk iken 500 yerine kontrollü 503 (genel login'de de); admin auth olayları için güvenli log satırları (actor id, sonuç; secret/parola/kod yok).
- Database: yok.
- Frontend: E2E admin spec'lerinin yeni girişe taşınması (`admin-users`, `admin-analytics`, `auth-session-audit` admin kısmı, `localized-routing` admin satırları) — `promoteToAdmin` + `/pd-admin` + TOTP yardımcı fonksiyonu.
- Authentication/Authorization: Part I matrisi (anonim / USER / admin parola-only / tam admin).
- Security: Test 11 (secret log/JWT/storage/API/bundle taraması).
- Cache/session: hesap değişiminde admin önbelleği izolasyonu.
- i18n/a11y: hata metinleri TR/EN/DE.
- Tests: Test 10, 11 + regresyon.

### Checklist

- [x] 6.1 Rate limit/lockout doğrulaması ve admin kovası. (admin uçları sensitive kova 5/10 dk + TOTP hesap kilidi)
- [x] 6.2 Key-missing fail-closed davranışı. (503 `two_factor_unavailable`, normal + admin)
- [x] 6.3 Güvenli audit log satırları.
- [x] 6.4 Admin E2E'lerinin yeni akışa taşınması.
- [x] 6.4b (Phase 2, önceki çalışmadan devir) `landing-page.spec.ts:203` palet testinin ilk `toBe` kontrolünü otomatik bekleyen `toHaveCSS`'e çevir (0,01 ms geçiş yarışı).
- [x] 6.5 Secret sızıntı testleri. (backend tamam: `/me`, `/2fa`, admin liste, log hijyeni; storage/bundle Phase 2)
- [x] 6.6 Docs (`SECURITY.md`, `authentication.md`, `api.md`, `frontend-design-rules.md`, `folder-structure.md`) + `docs/compliation/` Phase 1 kaydı.
- [x] 6.7 Phase 1 hedefli kontroller (backend: `clean verify` 850/0 tamam; frontend Phase 2): etkilenen backend testleri, lint, `tsc`, admin/auth Playwright.

### Definition of Done (Phase 1 branch completion)

- [x] Global DoD'nin Phase 1–2 kısmı (test 1–12 hedefli) karşılandı.
- [x] Commit/push yapılmadı (staging ajan, commit/push kullanıcı).

STOP (backend kısmı bitince) → `BRANCH COMPLETE — auth-service-backend`; frontend kısmı bitince → `BRANCH COMPLETE — auth-service-frontend`.

Task 2 ve Task 4/5/6'nın frontend/E2E maddeleri Phase 2'de (`auth-service-frontend`) yapılır; backend maddeleri Phase 1'de. Her task'ın checkbox'ı iki tarafı da tamamlanınca `[x]` olur.

## Transition Gates

- [x] Gate 1 — `auth-service-backend` commit/push/merge doğrulandı (PR #139); `auth-service-frontend` main'den güncellendi (eski worktree kaldırıldı).
- [ ] Gate 2 — `auth-service-frontend` commit/push/merge doğrulandı; main güncellendi.

---

## Phase 3 — main üzerinde final verification

## Task 7 — Full regression / final verification

### Amaç

Birleşik main üzerinde md'nin FINAL VALIDATION listesi ve completion dokümanı.

### Neden bu sırada?

Global completion yalnız tam regresyon + canonical pre-push sonrası ilan edilir.

### Prerequisite

Transition Gate.

### Etkilenecek alanlar

- Backend/Frontend/Tests: tam `mvn clean verify`, lint, `tsc`, production build, full Chromium, canonical `.\pre-push\pre-push.cmd` (Docker build/start/health dahil).
- Docs: `PDA_ADMIN_AUTH_2FA_REFINEMENTS_COMPLETION.md` (md'deki 20 başlık).

### Checklist

- [ ] 7.1 Backend full verify.
- [ ] 7.2 Frontend lint / `tsc` / build.
- [ ] 7.3 Hedefli admin/auth Playwright + full Chromium.
- [ ] 7.4 Canonical pre-push.
- [ ] 7.5 Completion dokümanı.

### Definition of Done

- [ ] md'deki global DoD maddelerinin tamamı.
