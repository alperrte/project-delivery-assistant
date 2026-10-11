<!-- markdownlint-disable MD024 -->
# PDA — Username Rules, Public UI Polish, Theme Performance & Teams Member Cards — Persistent Plan

Kaynak talep: `.agents/PDA_Account_Public_UI_Theme_Teams_Refinements_Plan_and_Implementation.md` (5 talep).
Bu dosya implementation boyunca source of truth'tur; checkbox'lar gerçek zamanlı güncellenir.

Yürütme: implementation → targeted test → bug fix → re-test → DoD → `[x]` → sonraki bağımlı task.
Git (kullanıcı kararı, önceki çalışmadan devam): staging, branch değiştirme ve `git pull --ff-only origin main` ajan tarafından yapılır; `git commit` ve `git push` yalnız kullanıcıdadır. Ajan merge/rebase/cherry-pick/reset yapmaz. Her branch fazı sonunda DURUR.
Kodlama: Sonnet 5.5 (high) alt-ajanları; orkestrasyon/inceleme/test/dokümantasyon Opus.

## Branch execution status

- [x] Phase 0 — Global read-only audit
- [x] Phase 1 — `general-features`
- [x] Transition Gate 1 — user commit/push confirmation
- [x] Phase 2 — `squad-service-backend`
- [x] Transition Gate 2 — user commit/push confirmation
- [x] Phase 3 — Final integrated verification (kayıtlı test istisnasıyla; bkz. final completion)

---

## Phase 0 — Global read-only audit (TAMAMLANDI 2026-10-10)

`general-features` main'den fast-forward edildi (`d140b75`, PR #134).

### Bulgular

| Talep | Gerçek durum (kanıt) | Backend? | Branch |
| --- | --- | --- | --- |
| 1 Kullanıcı adı | Alan `nickname`. Kural `[\p{L}\p{N}_]{3,32}` 9 yerde kopya: `User.java` L51 `@Pattern`, `NicknameRules.REGEX`, `RegisterRequest` L10, `InvitationRegisterRequest` L13, `features/auth/schemas.ts` L14, `features/account/nickname.ts`, `features/tasks/mentions.ts` L10/L71, i18n ipuçları, OpenAPI metni. Profilde trim var (`NicknameRules.normalize`), kayıtta yok. Benzersizlik büyük/küçük harfe duyarlı (`uk_users_nickname`). Login e-posta, JWT subject UUID → kimlik etkilenmez. Mention backend'i yalnız `@[uuid]` parse eder; frontend `activeMention` boşlukta kapanır, `encodeMentions` literal `@nickname` arar (boşluklu adlarda belirsizlik riski). OAuth üretici boşluğu `_` yapar. Rename sonrası `nicknameIdentityQuery` proje liste kartları `["projects", page]`, dashboard, `["project-home",id]`, by-slug/detail, hatırlatıcılar ve admin listesini kapsamıyor. | Var (validation) | general-features |
| 2 Scrollbar | Mevcut standart `globals.css` L7–39 yalnız `html:has(.app-shell)` + `[data-workspace-scroll]` (`--label-blue`, thin, şeffaf track, forced-colors auto). Landing/Login/public sayfalarda `.app-shell` yok → tarayıcı varsayılanı. Kaydırıcı her yerde document root. | Yok | general-features |
| 3 Cookie banner | `features/consent/cookie-banner.tsx` L43: `sm`+ sol alt (`sm:left-4 bottom-3 max-w-lg z-40`), mobilde tam genişlik. `--cookie-banner-offset` + `body padding-bottom`. Login ≥970px yükseklikte `h-dvh overflow-hidden` kilidi → footer banner altında kalabiliyor (kod okuması). | Yok | general-features |
| 4 Tema performansı | `ThemeProvider disableTransitionOnChange`; `useThemeSelection` → View Transition + `flushSync(setTheme)`. Global `transition: all` yok. Adaylar (ölçülecek): Login'de gizli temadaki tam ekran SVG `feGaussianBlur` + blend + 3 `backdrop-blur` yüzeyi + logo filtresi ilk kez raster ediliyor; Landing'de 4 tam demo çalışma alanı (5 `ThemeToggle` `layoutId` spring, 4 `backdrop-blur-2xl` header) büyük DOM style recalc'ı `flushSync` içinde; 60 ms swap gecikmesi. | Yok | general-features |
| 5 Ekip üyeleri | `team-member-preview.tsx` en yeni 5 üye, `w-10` kolon, yalnız avatar + baş harf (ad yalnız `title`/aria). Pozisyon için gerçek kaynak proje rolleri (`ProjectMembership.roles`, 8 enum, çoklu, birincil rol yok); ekip-özel rol ve unvan alanı yok. `SquadService.views()` `ProjectAccess.membersByIds` ile rolleri zaten aynı sorguda yüklüyor ama `MemberPreview`'a koymuyor → ek sorgu/migration gerekmiyor. | Var (DTO alanı) | squad-service-backend |

### Kullanıcı kararları (2026-10-10)

1. Kullanıcı adı: harf/rakam (Unicode), `_`, `-` ve **tek normal boşluk (U+0020)**; baş/son boşluk her yolda (kayıt, davetli kayıt, profil) kırpılır; **ardışık boşluk açık validation hatası** (sessiz düzeltme yok); sekme/NBSP/kontrol/görünmez karakterler reddedilir; uzunluk 3–32 aynı.
2. Benzersizlik büyük/küçük harfe duyarlı **kalır** (migration yok).
3. Pozisyon = üyenin proje rolü: **ana rol** (enum sırası, Proje Yöneticisi önce) görünür, fazlası **"+N"**; tüm roller tooltip/aria'da.
4. Scrollbar: oturumlu sayfalardaki mevcut standart **aynen tüm oturumsuz sayfalara** uygulanır (Landing, Login/Kayıt/Şifre, public bilgi sayfaları); yeni palet yok, iç kaydırma alanları etkilenmez.

### Ajan kararları (gerekçeli)

- OAuth ile otomatik üretilen kullanıcı adı artık boşluğu `_`'ya çevirmez; ardışık boşlukları teke indirip yeni kurala uyan doğal adı üretir (kullanıcı metni değil, sistem üretimi olduğu için normalize etmek uygundur).
- Mention öneri listesi boşluklu adlarda kapanmaz (sorgu tek boşluk içerebilir); kodlama en uzun ad önce eşleşmeyi korur; belirsizlik testlerle sabitlenir.

---

## Phase 1 — `general-features` (Talep 1, 2, 3, 4)

## Task 1 — Kullanıcı adı sözleşmesi + rename önbellek yayılımı

### Amaç

Doğal adları (`Hamza Taşbay`, `Çağrı Öztürk`, `Hamza_Taşbay-27`) kabul eden tek bir kural; frontend ve backend aynı kuralı uygular; ad değişikliği tüm ilgili yüzeylere yenilemeden yansır.

### Neden bu sırada?

Hesap kimliğine dokunan tek backend değişikliği; diğer Phase 1 taskları saf frontend.

### Prerequisite

Phase 0.

### Etkilenecek alanlar

- Backend: `user/domain/NicknameRules` (tek kaynak regex + normalize), `User.java` `@Pattern`, `RegisterRequest`, `InvitationRegisterRequest` (normalize + aynı kural), `UserProfileController` OpenAPI metni, `UserAccountService.availableNickname` (OAuth), gerekirse `AuthRegistrationController`
- Database: yok (VARCHAR(32), case-sensitive unique aynı)
- Frontend: `features/account/nickname.ts`, `features/auth/schemas.ts`, `external-invitation-registration.tsx`, `register-form.tsx` (alan hatası metni), `features/tasks/mentions.ts`, `mention-textarea.tsx`
- Cache: `nicknameIdentityQuery` → `["projects", page]`, `["projects","dashboard"]`, `["project-home", id]`, by-slug/detail, hatırlatıcılar, admin kullanıcı listesi
- Security: kontrol/görünmez karakter reddi; render her yerde düz metin; rename yalnız `/me`
- Performance: yok
- Shared Components: yok
- i18n/a11y: `register.nicknameHint`, `validation.nickname`, `account.nicknameEdit.hint/invalid` + ardışık boşluk mesajı (TR/EN/DE)
- Tests: `UserProfileApiIntegrationTest`, `UserDomainTest`, `AuthRegistrationHttpTest`, yeni `NicknameRulesTest`; E2E `nickname-editing.spec.ts`, kayıt spec'i, mention spec'leri

### Checklist

- [x] 1.1 Backend tek kural: `[\p{L}\p{N}_\- ]`, 3–32 kod noktası, baş/son boşluk yok, ardışık boşluk yok; `normalize` yalnız baş/son White_Space kırpar; tüm DTO/entity bu kaynağı kullanır; kayıt yolları da normalize eder.
- [x] 1.2 Hata kodları: profil `NICKNAME_INVALID`/`NICKNAME_TAKEN` korunur; kayıtta `invalidFields: ["nickname"]` korunur.
- [x] 1.3 OAuth üretici yeni kurala uyar (boşluk korunur, geçersiz karakter temizlenir, kesme surrogate-güvenli).
- [x] 1.4 Frontend tek validator (`validNickname`/`normalizeNickname`) kayıt, davetli kayıt ve profil formunda; ardışık boşluk için ayrı mesaj.
- [x] 1.5 Mention: öneri sorgusu tek boşluk içerebilir; `encodeMentions` en uzun ad önce; `@Ali` / `@Ali Veli` belirsizliği test edilir.
- [x] 1.6 Rename önbelleği eksik yüzeyleri kapsar (global clear yok).
- [x] 1.7 TR/EN/DE metinleri.
- [x] 1.8 Testler: backend Test 1 matrisi (geçerli 7 örnek + trim + geçersiz/güvenlik), E2E Test 1 (kayıt + profil gerçek backend) ve Test 2 (rename → navbar/hesap/ekip/proje kartı, yenilemesiz).

### Definition of Done

- [x] Frontend ve backend aynı sonucu verir; iç boşluk hiçbir katmanda `_`/`-`'ye çevrilmez.
- [x] Kimlik (UUID, e-posta, oturum, üyelikler) değişmez; XSS'e karşı düz metin render korunur.
- [x] Rename sonrası ilgili yüzeyler yenilemesiz güncel.

## Task 2 — Oturumsuz sayfalarda mevcut scrollbar standardı

### Amaç

Oturumlu sayfalardaki scrollbar'ın aynısını Landing, Login/Kayıt/Şifre ve public bilgi sayfalarında da kullanmak.

### Neden bu sırada?

Bağımsız, yalnız CSS; Task 3/4'ün görsel doğrulamalarıyla aynı yüzeyler.

### Prerequisite

Yok.

### Etkilenecek alanlar

- Backend: yok
- Database: yok
- Frontend: `app/globals.css` (mevcut kural seçicisinin oturumsuz sayfa root'unu da kapsaması; alias değişkenleri ortak yere taşınması)
- Cache: yok
- Security: yok
- Performance: yok
- Shared Components: yok
- i18n/a11y: forced-colors `auto` korunur
- Tests: `workspace-scrollbars.spec.ts` genişletme (Landing, Login, bir public sayfa; light/dark; iç textarea/pre/dialog `auto` kalır)

### Checklist

- [x] 2.1 Tek kural: aynı token/alias, aynı thin/şeffaf track/webkit stilleri; ikinci palet yok.
- [x] 2.2 Body miras sıfırlaması ve iç alanların (textarea, pre, dialog, landing demo `<main>`, cookie banner) etkilenmemesi.
- [ ] 2.3 Chromium + Firefox (`scrollbar-color`) davranışı; gizleme yok. (Chromium doğrulandı; standart `scrollbar-color` kullanıldığı için Firefox uyumlu, Firefox koşusu yapılmadı)
- [x] 2.4 E2E: Landing/Login/public × light/dark × TR/EN/DE root scrollbar renkleri oturumlu sayfayla aynı.

### Definition of Done

- [x] Oturumlu ve oturumsuz sayfalar aynı scrollbar'ı kullanır; iç kaydırma alanları değişmez.

## Task 3 — Cookie banner alt-orta yerleşimi

### Amaç

Banner'ı sol alttan yatay ortalanmış alt bölgeye almak; Landing'de footer'ın üstünde, Login'de içerik alt bölgesinde; footer ve form erişilebilir kalır.

### Neden bu sırada?

Bağımsız; tema/scrollbar ile aynı oturumsuz yüzeyler.

### Prerequisite

Yok.

### Etkilenecek alanlar

- Backend: yok
- Database: yok
- Frontend: `features/consent/cookie-banner.tsx` (konum sınıfları), `--cookie-banner-offset` / body padding; Login ≥970px `h-dvh` kilidinde footer'ın banner altında kalmaması
- Cache: yok
- Security: consent semantiği aynı (analytics varsayılan kapalı, kabul/ret/yönet/geri çekme)
- Performance: yok
- Shared Components: yok
- i18n/a11y: region rolü, odak sırası, safe-area
- Tests: `cookie-consent.spec.ts` genişletme (Landing + Login + public, 320/390/768/1024/1440, light/dark; banner yatay ortada; footer bağlantıları ve login formu tıklanabilir)

### Checklist

- [x] 3.1 Desktop: `left-1/2 -translate-x-1/2` benzeri ortalama, mevcut `max-w` korunur; mobil: güvenli kenar boşluğu + `safe-area-inset-bottom`.
- [x] 3.2 Footer/form çakışması gerçek ölçümle çözülür (tek sabit `bottom` yalnız tüm düzenlerde doğruysa).
- [x] 3.3 Tercih penceresi (dialog) değişmez.
- [x] 3.4 E2E Test 4.

### Definition of Done

- [x] Banner her viewportta alt-orta; footer bağlantıları ve login butonları erişilebilir; consent davranışı aynı.

## Task 4 — Landing/Login tema geçişi performansı

### Amaç

Takılmanın gerçek nedenini ölçmek ve kök nedeni düzeltmek; FOUC/hydration regresyonu yok, reduced-motion korunur.

### Neden bu sırada?

En çok ölçüm gerektiren iş; Task 2/3'ün CSS değişikliklerinden sonra ölçülürse son durum ölçülür.

### Prerequisite

Task 2, Task 3.

### Etkilenecek alanlar

- Backend: yok
- Database: yok
- Frontend: kanıta göre: `components/layout/{theme-switcher,theme-transition,theme-toggle}.tsx`, `components/layout/auth-shell.tsx`, `components/common/logo.tsx`, `features/landing/**`, `components/providers.tsx`
- Cache: yok
- Security: yok
- Performance: ana hedef
- Shared Components: tema altyapısı değişirse oturumlu uygulama da test edilir
- i18n/a11y: tema düğmesi klavye/odak, reduced-motion
- Tests: yeni `theme-switch-performance.spec.ts` (CDP Performance/tracing ölçümü, long task, rerender sayımı; önce/sonra), `12-theme-transition.spec.ts`, `ui-ux-public.spec.ts` (flash yok), `landing-page.spec.ts`, `landing-real-ui.spec.ts`

### Checklist

- [x] 4.1 Ölçüm (fix öncesi): Landing/Login × light→dark, dark→light; tıklamadan swap'a gecikme, en uzun main-thread görevi, style recalc/layout/paint süreleri, rerender olan bileşenler, remount/odak kaybı.
- [x] 4.2 Kök nedeni kanıtla ve raporla (hipotezler: gizli tema filtre/görsel ilk raster'ı, büyük DOM recalc + `flushSync`, demo toggle'ları ve blur header'lar, View Transition).
- [x] 4.3 Hedefli düzeltme (kanıtlanan neden kadar); `transition: all` eklenmez, reduced-motion korunur.
- [x] 4.4 Ölçüm (fix sonrası) + FOUC/hydration/odak kontrolü + oturumlu tema smoke.

**Task 4 bulgusu (2026-10-10):** GPU'lu tarayıcıda Landing/Login 60 fps (uzun görev 0); React'ta tüm sayfa rerender yok (yalnız toggle'lar + overlay). Kullanıcının Chrome'unda **donanım hızlandırması kapalı** (`Local State` → `hardware_acceleration_mode.enabled=false`); yazılımla çizimde Login 2560×1440'ta ~7 fps. Katman probu: yalnız `.auth-neon` (tam ekran `screen` grup + %300 genişlikte `multiply` bant) kapatılınca 21–25 → 64 kare/1,5 sn; backdrop-blur, SVG filtreleri, gölgeler etkisiz. Düzeltme: (1) daire oynarken Login sonsuz döngüleri duraklatılır; (2) `lib/rendering.ts` + `RenderingProbe` WebGL `failIfMajorPerformanceCaveat` (+ yazılım renderer adı) ile tespit, `html[data-renderer="software"] .auth-neon {display:none}`, karar sekme başına sessionStorage'da ve root layout boot script'iyle paint öncesi uygulanır. Sonuç (yazılım, 2560×1440): 60–63 kare, >50 ms kare 15–18 → 2, max boşluk 133 → 67 ms. GPU kullanıcıları için görsel değişiklik yok.

### Definition of Done

- [x] Ölçülebilir iyileşme kanıtı; route değişimi/remount/odak kaybı yok; flash/hydration uyarısı yok.

## Task 5 — Phase 1 entegre regresyon + dokümantasyon

### Amaç

Branch completion gate.

### Neden bu sırada?

Task 1–4 sonrası.

### Prerequisite

Task 1–4 DoD.

### Etkilenecek alanlar

- Backend: `mvnw clean verify` (pre-push içinde)
- Database: yok
- Frontend: lint/type/build
- Cache/Security/Performance: regresyon
- Shared Components: doküman
- i18n/a11y: üç dil
- Tests: hedefli Playwright + pre-push (backend E2E override ile)

### Checklist

- [x] 5.1 lint / `tsc` / build.
- [x] 5.2 Hedefli + etkilenen Playwright.
- [x] 5.3 `.\pre-push\pre-push.cmd`. (843 geçti; 2 kayıtlı istisna: `auth-session-audit`, `team-member-preview` 401)
- [x] 5.4 Docs (`SECURITY.md` nickname kuralı, `frontend-design-rules.md`, `architecture.md`, `folder-structure.md`) + `docs/compliation/` kaydı.

### Definition of Done (Branch completion)

- [x] Username, scrollbar, cookie yerleşimi ve tema performansı tamamlandı/test edildi.
- [x] lint/type/build geçti.
- [x] Commit/push yapılmadı.

STOP → `BRANCH COMPLETE — general-features`

## Transition Gate 1

- [x] Kullanıcı commit/push'u doğruladı.
- [x] `squad-service-backend` main'den güncellendi ve Phase 1 commit'i erişilebilir (PR #137, `5f524bb`).

---

## Phase 2 — `squad-service-backend` (Talep 5)

## Task 6 — Ekip üyesi veri sözleşmesi (rol)

### Amaç

Ekip listesi önizlemesindeki her üyeye proje rollerini eklemek (N+1 yok, migration yok).

### Neden bu sırada?

Task 7'nin veri kaynağı.

### Prerequisite

Transition Gate 1.

### Etkilenecek alanlar

- Backend: `squad/application/service/TeamView.MemberPreview` + `SquadService.views()` (mevcut `ProjectMemberView.roles()` enum sırasına göre), `TeamController.MemberPreviewResponse`
- Database: yok
- Frontend: `features/squads/types.ts` `TeamMemberPreview.roles`
- Cache: aynı sorgu
- Security: e-posta eklenmez; yalnız proje/ekip yetkisinden sonra, en yeni 5 üye
- Performance: sorgu sayısı sabit (`SquadServiceTest` 30 vs 100 ekip)
- Shared Components: yok
- i18n/a11y: yok
- Tests: `SquadServiceTest`, `SquadApiIntegrationTest`

### Checklist

- [x] 6.1 DTO + servis.
- [x] 6.2 Testler (roller doğru, sıralı, sorgu sayısı artmıyor, e-posta yok).
- [x] 6.3 `SECURITY.md`/`api.md` notu.

### Definition of Done

- [x] Roller önizlemede; N+1 yok; `ModularityTest` + hedefli backend testleri geçer (tam verify Phase 3'te; kullanıcı kararı).

## Task 7 — Ekip kartında avatar + ad + pozisyon

### Amaç

Kart (grid) görünümünde üyeler yan yana: profil fotoğrafı, altında ad, altında ana rol (+N).

### Neden bu sırada?

Task 6'ya bağlı.

### Prerequisite

Task 6.

### Etkilenecek alanlar

- Backend: yok
- Database: yok
- Frontend: `features/squads/components/{team-member-preview,team-card}.tsx`, `ProjectRoleLabel`/`role-presentation` yeniden kullanımı, `initials.ts`
- Cache: yok
- Security: düz metin
- Performance: üye başına istek yok
- Shared Components: `Avatar` + `profilePhotoSrc`
- i18n/a11y: rol etiketleri TR/EN/DE (mevcut `roles.*`), ad–rol ilişkisi ekran okuyucuda anlamlı
- Tests: `team-member-preview.spec.ts` genişletme, yeni kenar durumları

### Checklist

- [x] 7.1 Üye kutusu: avatar, ad (kullanıcı geri bildirimiyle kısaltma YOK: tam ad, satıra kayar; tooltip tüm adı + rolleri gösterir), ana rol + "+N" (tooltip/aria tüm roller).
- [x] 7.2 Çok üye: mevcut en fazla 5 + "+N" korunur; satır kaydırma (wrap) ile kart yüksekliği içeriğe göre büyür (uzun adlarda; bkz. completion kaydı "Kalan konular").
- [x] 7.3 Tablo ve Şema görünümleri korunur (tablo/şema üye sunumu değişmez veya uyumlu kalır).
- [x] 7.4 E2E Test 6/7: fotoğraflı, fotoğrafsız, uzun ad, uzun rol, çok rol, çok üye, 0 üye; 320–1440, light/dark.

### Definition of Done

- [x] Grid'de avatar + ad + pozisyon; Table/Schema çalışır; kart yüksekliği kontrollü.

## Task 8 — Phase 2 regresyon

### Amaç

Branch completion gate.

### Neden bu sırada?

Task 6–7 sonrası.

### Prerequisite

Task 6–7 DoD.

### Etkilenecek alanlar

- Backend: tam verify
- Frontend: lint/type/build
- Tests: ekip/davet spec'leri + pre-push

### Checklist

- [x] 8.1 Backend verify. (hedefli 31/31; tam `verify` Phase 3'te)
- [x] 8.2 lint/type/build. (lint + tsc; `next build` Phase 3'te)
- [x] 8.3 Playwright (team-*, teams-view-toggle, team-member-preview).
- [x] 8.4 pre-push. (kullanıcı kararı: Phase 3'te koşuldu)
- [x] 8.5 Docs + completion.

### Definition of Done (Branch completion)

- [x] Talep 5 tamamlandı/test edildi; N+1 yok; Grid/Table/Schema korunur.
- [x] Commit/push yapılmadı.

STOP → `BRANCH COMPLETE — squad-service-backend`

## Transition Gate 2

- [x] Kullanıcı commit/push'u doğruladı (PR #138, `90f7c7c`).

---

## Phase 3 — Final integrated verification

- [x] Her iki faz main'de birleşik (`90f7c7c`).
- [x] Backend `mvnw clean verify`. (827/0)
- [x] Frontend lint / TypeScript / production build.
- [x] Hedefli Playwright paketleri + full Chromium + public paket. (814 + temiz yeniden koşu 60/61; kalan: palet testi yarışı)
- [ ] `.\pre-push\pre-push.cmd` (Docker build/start/health dahil). — katı PASS değil: koşu branch geçişiyle kirlendi; bkz. final completion
- [x] Ayrı final completion dokümanı: `docs/compliation/2026-10-10-account-public-ui-theme-teams-refinements.md`.
