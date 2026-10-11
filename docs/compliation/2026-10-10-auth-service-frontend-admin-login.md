# auth-service-frontend — Ayrı yönetici girişi `/pd-admin`, zorunlu Authenticator kurulumu ve admin E2E taşıması

## 1. Özet

- Branch: `auth-service-frontend` — Phase 2 / `PDA_ADMIN_AUTH_2FA_REFINEMENTS_PLAN.md` (Task 2, Task 4/5 arayüzü, Task 6 E2E/admin spec taşıması).
- Kaynak talep: `.agents/PDA_Admin_Auth_2FA_Refinements_Plan_and_Implementation.md`. Backend (Phase 1) PR #139 ile main'de (`c87d776`); bu fazda `backend/` değişmedi.
- Durum: frontend/E2E kapsamı tamamlandı; hedefli kontroller yeşil (bölüm 6). Tam `mvn clean verify`, tam Chromium ve canonical pre-push kullanıcı kararıyla Phase 3'tedir. Commit/push kullanıcıya aittir; ajan commit, push, stage yapmadı.
- Tek cümlelik sonuç: yöneticiler artık yalnız `/pd-admin` adresinden (parola → ilk girişte QR ile Authenticator kurulumu ve bir kez gösterilen 10 yedek kod, sonraki girişlerde Authenticator/yedek kod → panel) giriş yapar; normal `/login` ve public yüzeyler admin'den hiç söz etmez, panel yalnız admin-doğrulanmış oturumda açılır.

## 2. Rota ve proxy kararı

- Rota `frontend/src/app/pd-admin/{layout,template,page}.tsx`: `(auth)`/`(app)` gruplarının **dışında** tek, önek­siz adres. `layout` `AuthShell`i, `template` `(auth)/template`i yeniden kullanır (aynı sahne, giriş animasyonu, logo, dil/tema, footer).
- `PAGE_ROUTES`a eklenmedi (yerelleştirilmez); sabit `ADMIN_ENTRY_PATH` (`i18n/routing.ts`). `authenticated-history.spec.ts` `(app)` rota karşılaştırması ve `AUTHENTICATED_ROUTES` değişmedi, yeşil.
- `proxy.ts`: `/pd-admin` (sondaki `/` dahil) **bilerek** geçirilir: yerel ayar yeniden yazımı ve oturum ipucu yönlendirmesi yoktur (çıkış yapmış ve eski admin oturumlu ziyaretçi sayfayı görmeli), yanıta `X-Robots-Tag: noindex, nofollow` eklenir. `/tr/pd-admin`, `/en/pd-admin`, `/pd-admin/x` 404 verir.
- Dil: `i18n/request.ts` zaten `x-pda-locale` yoksa `NEXT_LOCALE` cookie'sine, o da yoksa `Accept-Language`a düşer; ek kod gerekmedi. Dil değiştirici `/pd-admin`'de ana sayfaya atıyordu (`switchLocale` bilinmeyen yolu `/<dil>` yapar) — `switchLocale` bu adres için adresi olduğu gibi bırakır, cookie yazılır ve sayfa yenilenir.
- Metadata: başlık `adminLogin.metaTitle` ("Yönetici girişi · PDA" / "Administrator sign-in · PDA" / "Administratoranmeldung · PDA"), `robots: { index: false, follow: false }`; canonical/hreflang/OG yok. `robots.txt`, `sitemap.xml`, `llms.txt` ve hiçbir public bağlantı `/pd-admin` içermez (E2E ile taranır). Analitik izleyicisi bu adresi saymaz (aksi hâlde "bilinmeyen sayfa" olarak görünürdü).

## 3. Arayüz kararları

- **Ayrı özellik:** `features/admin-auth/` (api, schemas, `use-complete-admin-login`, 7 bileşen). `LoginForm`un koşullu kopyası değildir; ortak parçalar yeniden kullanılır: `AuthShell`, `AuthCard` (yeni `eyebrow` ve `headingRef` özellikleri), `FormField`, `SubmitButton`, `authCtaClass`, `useShake`, `errorKey`.
- **Adım makinesi:** kimlik bilgileri → (kurulum → yedek kodlar | Authenticator kodu) → panel. Kurulum gerekiyorsa `setup` çağrısı kimlik adımında yapılır (olay işleyicide; React Strict Mode'da çift `setup` ve secret yarışı olmaz). Secret yalnız kurulum adımının belleğindedir; storage/cookie/URL'ye yazılmaz.
- **Kurulum adımı:** sıralı liste (1. Google Authenticator/TOTP uygulamasını aç, 2. QR'ı okut, 3. 6 haneli kodu gir), QR `role="img"` + etiket (beyaz zemin, ortak `AuthenticatorQr`), elle anahtar (4'lü gruplar) + kopyala düğmesi (satır içi "Kopyalandı"/hata durumu), kod alanı `inputMode="numeric"`, `autocomplete="one-time-code"`, yapıştırılan boşluklar temizlenir. Yanlış kod `role="alert"` + odak alana döner; süresi dolan bilet kimlik adımına bildirimle döner.
- **Yedek kodlar:** 10 kod yalnız bir kez, kopyala düğmesiyle; "Kaydettim, panele git" onayından sonra oturum önbelleği hazırlanır ve panele geçilir.
- **TOTP adımı:** 6 hane + yedek kod geçişi (alan değişir, odak alana gider), kimliğe dön, bilet süresi dolunca kimliğe dön (bildirimle), 5 yanlış kod → `twoFactorLocked` mesajı.
- **Odak ve erişilebilirlik:** adım değişince odak adım başlığına (`tabIndex=-1`); hatalar `role="alert"`, bildirimler `role="status"`; tüm hedefler ≥44 px; tamamen klavyeyle tamamlanır. Admin markası: "Yönetici alanı" rozeti + "PDA Yönetici Girişi / PDA Administrator Sign-in / PDA-Administratoranmeldung" başlığı; kayıt, şifre unuttum, "beni hatırla", OAuth yok. Hata dili: genel kimlik hatası, 429, 503 (`two_factor_unavailable`).
- **Oturum varsa:** sunucu bileşeni `PDA_SESSION` ipucunu okur; ipucu yoksa `/auth/me` hiç çağrılmaz. Admin-doğrulanmış oturumda sayfa panele yönlendirir (`?next=` yalnız site içi `/admin` sayfası); normal oturumda **yine yönetici girişi** gösterilir.
- **Başarıdan sonra:** `useCompleteLogin` ile aynı önbellek hijyeni (davet/bildirim/ekip/admin aileleri + yeni `["auth"]` ailesi temizlenir, `["session"]` `/auth/me` ile yazılır), ardından `router.replace("/admin/users")` → `/tr/yonetim/kullanicilar`.
- Screenshot'lar (incelendi): `pd-admin-{1-credentials,2-enrollment,3-totp}-{1440-light,390-dark}.png` (scratchpad).

## 4. Panel koruması, çıkış ve oturum davranışı

- `AdminArea` (`admin-guard.tsx`): yalnız `globalRole === "ADMIN"` **ve** `adminVerified === true` için içerik; `adminVerified` olmayan admin → `/pd-admin?reason=reauthenticate` (bildirimle), admin olmayan → `/dashboard` (değişmedi). `AuthenticatedUser.adminVerified?: boolean` eklendi.
- **Yönetim bağlantıları (karar):** yan menü (`data-admin-link`) ve hesap menüsü bağlantısı yalnız `ADMIN` **ve** `adminVerified` iken görünür; eski admin oturumuna tıklanınca geri atılacak bir hedef sunulmaz (admin URL'yi zaten bilir).
- **Oturum sonu:** panel içinde oturum biterse `AppShell` `/pd-admin?reason=session-expired&next=…` adresine gönderir (normal `/login` admin'i genel hatayla reddeder); diğer alanlarda `/login` aynen kalır.
- **Çıkış/önbellek:** çıkış, oturum sonu ve her giriş `["auth"]` ailesini (`["auth","2fa"]` dahil; yeni `features/auth/query-keys.ts`) de siler. Çıkış sonrası hedef `/login` olarak korundu.
- **Hesap ayarları:** admin için iki adımlı doğrulama panelinde "Kapat" düğmesi yoktur, "zorunludur" notu gösterilir (backend zaten `403 admin_two_factor_required` verir); yedek kod yenileme kalır.
- **Hata kodları:** `admin_reauthentication_required`, `admin_two_factor_required` `errorKey` + `errors.*` (TR/EN/DE) ile eşlendi. Yeni 4 admin yolu `client.ts` `NO_REFRESH` listesine eklendi.
- **Normal giriş:** admin için genel 401'den başka bir şey yok; `/login`, `/register`, `/forgot-password` metin/bağlantı taraması admin'e dair hiçbir şey bulmaz (E2E).

## 5. E2E taşıması

- Yeni yardımcılar `e2e/helpers.ts`: `adminSignIn(page, user, { viaBackupCode? })` (`/pd-admin`; ilk girişte elle anahtarı okuyup kod girerek **kurulum yapar**, anahtarı ve yedek kodları test kullanıcısı için saklar; sonraki girişlerde TOTP/yedek kod; paneli bekler), `nextAdminCode` (sunucunun kullanılmış adımı reddetmesine uygun bir sonraki adım kodu, gerekirse bekler), `adminAuthenticator`, `rememberAdminAuthenticator`, `submitAdminCredentials`.
- Taşınanlar (niyet korunarak): `admin-users` ve `admin-analytics` (`newAdmin` artık kayıt → `promoteToAdmin` → `adminSignIn`), `auth-session-audit` RBAC testi (+ `adminVerified=false` ve `/pd-admin`in normal oturumda yönetici girişini gösterdiği kontrolleri; açık-yönlendirme testi anonim `/admin` → `/giris` olarak aynen geçerli), `localized-routing` (anonim admin satırları aynen; yeni `/pd-admin` tek adres testi). `authenticated-history` değişmedi.
- Yeni `e2e/admin-login.spec.ts` (19 test): normal `/login` izolasyonu (USER girişi + admin metni/bağlantısı yok), ADMIN'in `/login`de genel hatası ve oturumsuzluğu, `/pd-admin` hiçbir public sayfa/robots/sitemap/llms.txt'ten bağlanmaz + `noindex` (meta ve başlık), anonim `/pd-admin` ayrı yönetici girişi, normal oturum admin yetkisi vermez (403 + panelden geri çevirme), dil (cookie > Accept-Language, TR/EN/DE başlıkları, dil değiştirici `/pd-admin`de kalır), eski admin oturumu (403 `admin_reauthentication_required`, bağlantı yok, `/pd-admin?reason=reauthenticate`), ilk giriş (QR + elle anahtar + sıralı talimat + odak; yanlış kod 2FA'yı açmaz ve yeniden kurulum sunulur; doğru kod → 10 yedek kod bir kez, oturum admin-doğrulanmış, secret/kodlar `/auth/me`, `/auth/2fa`, storage, cookie'de yok; "Kaydettim" → panel; `/pd-admin` panele yönlendirir; `/auth/2fa/disable` 403 + panelde "Kapat" yok), sonraki giriş (parola-only iken admin API 401/403, yanlış kod oturum açmaz, boşluklu doğru kod açar), süresi dolan bilet, yedek kod bir kez (ikinci kullanım reddedilir), çıkış (panel/API/eski cookie 401, `/pd-admin` giriş), panelde oturum sonu → `/pd-admin?reason=session-expired`, yalnız klavye (Tab/Enter, odak sırası), 320/390/768/1024/1440 × light/dark (yatay taşma yok, tüm adımlar, ≥44 px hedefler).
- `landing-page.spec.ts:203` aralıklı hata (0,01 ms geçişin ilk karesi): ilk kontrol `#landing-main` üst öğesinde otomatik bekleyen `toHaveCSS("background-color", "rgb(245, 235, 219)")` yapıldı.

## 6. Doğrulama komutları ve sonuçlar

Hepsi `frontend/` içinde, `--output=test-results-p2a`; klasör iş sonunda silindi. Backend konteyneri main + e2e override (Mailpit, gevşek limitler), yeniden build edilmedi.

| Komut | Sonuç |
| --- | --- |
| `npx tsc --noEmit` | Temiz |
| `npm run lint` | 0 hata; 2 eski uyarı (`ui-ux-app.spec.ts`, `ui-ux-public.spec.ts`, bu iş dışı) |
| `npx playwright test e2e/admin-login.spec.ts e2e/admin-users.spec.ts e2e/admin-analytics.spec.ts e2e/auth-session-audit.spec.ts e2e/localized-routing.spec.ts e2e/authenticated-history.spec.ts e2e/auth-two-factor-and-deletion.spec.ts e2e/landing-page.spec.ts` | **91 geçti**, 0 başarısız, 0 skip (5,0 dk): admin-login 19, admin-users 9, admin-analytics 11, auth-session-audit 4, localized-routing 24, authenticated-history 2, auth-two-factor-and-deletion 4, landing-page 18 |
| `npx playwright test --config=playwright.public.config.ts` | **289 geçti**, 0 başarısız (8,2 dk; `AuthCard`/auth yüzeyi dokunulduğu için) |
| `admin-login.spec.ts` yeniden (`proxy.ts` sondaki `/` düzeltmesinden sonra) | 19/19 |
| `git diff --check` | Temiz (LF) |

- `auth-session-audit` "oturum bitince kullanıcıya ne gösteriliyor": önceden kayıtlı istisna bu koşuda **geçti** (4/4).
- Tam Chromium paketi, tam `mvn clean verify`, `next build` ve canonical pre-push bilerek çalıştırılmadı (kullanıcı politikası: bu fazda hedefli kontrol).

## 7. Değişen önemli dosyalar

Yeni: `frontend/src/app/pd-admin/{layout,template,page}.tsx`, `frontend/src/features/admin-auth/**`, `frontend/src/features/account/components/authenticator-qr.tsx`, `frontend/src/features/auth/query-keys.ts`, `frontend/e2e/admin-login.spec.ts`, bu kayıt.

Değişen: `frontend/src/proxy.ts`, `i18n/routing.ts` (`ADMIN_ENTRY_PATH`, `switchLocale`), `i18n/messages/{tr,en,de}.json` (`adminLogin`, 2 hata kodu, `securityFlow.twoFactor.adminRequired`), `lib/api/{client,error-message}.ts`, `features/auth/api.ts`, `features/auth/components/{auth-card,use-complete-login}.ts(x)`, `features/admin/components/admin-guard.tsx`, `components/layout/{app-shell,app-header}.tsx`, `features/account/components/two-factor-panel.tsx`, `features/analytics/tracker.tsx`; E2E: `helpers.ts`, `admin-users`, `admin-analytics`, `auth-session-audit`, `localized-routing`, `landing-page`; dokümanlar: `.agents/{frontend-design-rules,folder-structure,SECURITY,authentication}.md`, web checklist (scoped not).

## 8. Açık konular

- **Dil dosyalarında önceden var olan fark:** `tr.json` ile `en.json` arasında `squads.membersPage.*` (27 anahtar) ve `squads.archiveConfirmTitle`, `squads.columns.*` (3 anahtar) uyuşmazlığı bu işten önce de vardı (HEAD'de 2710 / 2686 anahtar). Bu işin anahtarları üç dilde birebir aynıdır; eski farka dokunulmadı.
- `/pd-admin` dizesi istemci paketinde bulunur (dil değiştirici ve analitik izleyicisi sabiti kullanır). Bu bir bağlantı veya gizlilik iddiası değildir; yetki yalnız backend'dedir.
- Çıkış sonrası admin de `/login`e gider (admin oradan giremez, URL'yi bilir); ayrı bir "yönetici çıkışı → `/pd-admin`" kararı verilmedi.
- Yönetici paneli içinde başka bir yöntemle ortaya çıkan `403 admin_reauthentication_required` (ör. sunucu tarafında bayrak düşerse) için ayrı bir istek-seviyesi yönlendirme yoktur; panel koruması `adminVerified`a bakar ve sonraki `/auth/me` ile yönlendirir.
- Plan dosyası (`PDA_ADMIN_AUTH_2FA_REFINEMENTS_PLAN.md`) bu ajan tarafından düzenlenmedi.

## 9. Kullanıcı kontrolü

1. Gizli pencerede `http://localhost:3000/pd-admin`: "PDA Yönetici Girişi" görünür; sayfada kayıt/şifre unuttum/Google/GitHub yok. Aynı sayfanın dilini sağ üstten değiştirin: adres `/pd-admin` kalır.
2. `/login`da e-posta/şifre alanlarında yönetici hesabıyla giriş deneyin: "E-posta veya şifre hatalı." (yanlış şifreyle aynı).
3. `/pd-admin`: yönetici e-postası + şifre → ilk girişte QR + anahtar. Yanlış kodla "Kod geçersiz"; Google Authenticator ile okutup doğru kodu girin → 10 yedek kod → "Kaydettim, panele git" → `/tr/yonetim/kullanicilar`.
4. Çıkış yapıp tekrar `/pd-admin`: parola sonrası yalnız kod istenir; "Yedek kod kullan" ile bir yedek kod bir kez çalışır.
5. Normal bir kullanıcıyla girişliyken `/pd-admin` açın: yönetici girişi görünür, `/tr/yonetim/kullanicilar` sizi panoya geri atar.
6. Sayfa kaynağında/robots/sitemap'te `/pd-admin` bağlantısı olmadığını, yanıt başlığında `x-robots-tag: noindex, nofollow` olduğunu doğrulayın.
