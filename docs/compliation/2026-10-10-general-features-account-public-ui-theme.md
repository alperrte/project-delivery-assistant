# general-features — Kullanıcı adı sözleşmesi, oturumsuz sayfa scrollbar'ı, cookie banner yerleşimi, tema geçişi performansı

## 1. Özet

- Branch: `general-features` — Phase 1 / `PDA_ACCOUNT_PUBLIC_UI_THEME_TEAMS_REFINEMENTS_PLAN.md` (Task 1–4; Task 5 dokümantasyon + regresyon).
- Kaynak talep: `.agents/PDA_Account_Public_UI_Theme_Teams_Refinements_Plan_and_Implementation.md` (Talep 1–4). Talep 5 (Ekip üyesi kartı) `squad-service-backend` fazındadır, bu kayda dahil değildir.
- Durum: Task 1–5 tamamlandı; test sonuçları bölüm 8'de. Commit/push kullanıcıya aittir; ajan commit ve push yapmadı.
- Tek cümlelik sonuç: kullanıcı adı artık `Hamza Taşbay` gibi doğal adları kabul ediyor (tek kural, backend + frontend); Landing/Login/public sayfalar oturumlu sayfalarla aynı scrollbar'ı kullanıyor; cookie banner alt-ortada ve Login'in `h-dvh` kilidiyle çakışmıyor; Login tema geçişindeki takılmanın kök nedeni (kullanıcının Chrome'unda donanım hızlandırması kapalı + tam ekran blend katmanı) bulunup yazılım render'da kapatıldı.

## 2. Task 1 — Kullanıcı adı sözleşmesi

- **Tek kaynak:** `backend/src/main/java/com/pda/user/NicknameRules.java`. Önceki `user/domain/NicknameRules` silindi. **Neden taşındı:** `RegisterRequest` ve `InvitationRegisterRequest` (Auth modülü) kuralı kullanmak zorunda; `user.domain` User modülünün iç paketi olduğu için Spring Modulith sınırını ihlal ederdi. Modül köküne taşınan sınıf User modülünün public API'sidir; `User` entity, `UserProfileService`, `UserProfileController`, `UserAccountService` aynı sınıfı kullanır, backend'de ikinci regex kopyası kalmadı.
- **Final regex:** `(?=[\p{L}\p{N}_ -]{3,32}\z)[\p{L}\p{N}_-]+(?: [\p{L}\p{N}_-]+)*` — Unicode harf/rakam, `_`, `-` ve kelimeler arasında **tek** normal boşluk (U+0020); 3–32 kod noktası. `Hamza Taşbay`, `Çağrı Öztürk`, `Hamza_Taşbay-27` geçerli.
- **Trim:** baş/son Unicode White_Space her yolda (kayıt, davetli kayıt, profil) kırpılır: DTO kurucuları (`RegisterRequest`, `InvitationRegisterRequest`) ve profil servisi `NicknameRules.normalize` çağırır; saklanan değer doğrulanan değerdir. İç karakterlere dokunulmaz.
- **Reddedilenler (sessiz düzeltme yok):** art arda boşluk, sekme, NBSP ve diğer Unicode boşluklar, kontrol ve görünmez karakterler (sıfır genişlikli boşluk, BOM), `.` gibi izinsiz karakterler, 3'ten kısa / 32'den uzun (kod noktası bazında).
- **Ardışık boşluk mesajı:** istemcide ayrı mesaj: `validation.nicknameSpaces` ("Kullanıcı adında art arda boşluk olamaz; kelimeler arasında tek boşluk kullanın.") ve profil alanında `account.nicknameEdit.invalidSpaces`. `nicknameProblem(value)` `"spaces" | "invalid" | null` döner. Sunucu bu durumda diğer geçersiz adlarla aynı kodu verir.
- **Hata kodları değişmedi:** profil `400 NICKNAME_INVALID` / `409 NICKNAME_TAKEN`; kayıt `400` + `invalidFields: ["nickname"]` (kayıt formu bu durumda `validation.nickname` metnini alanın yanında gösterir). Benzersizlik büyük/küçük harfe duyarlı (`uk_users_nickname`), migration/backfill yok, mevcut adlar yeni kuralda da geçerli.
- **OAuth üretici:** `UserAccountService.nicknameBase` (paket içi `static`): NFC normalize, boşluk dizilerini tek boşluğa indirir, geçerli karakterleri (`_`, `-`, harf, rakam) korur, diğer karakter dizilerini tek `_` yapar, kenarları kırpar, 24 kod noktasına surrogate-güvenli keser (benzersizlik soneki için yer bırakır), 3'ten kısaysa `user`. Eski davranış boşluğu `_` yapıyordu.
- **Frontend tek doğrulayıcı:** `features/account/nickname.ts` (`NICKNAME_PATTERN`, `normalizeNickname`, `validNickname`, `hasConsecutiveSpaces`, `nicknameProblem`). Kayıt (`features/auth/schemas.ts`: önce kırp sonra doğrula), davetli kayıt (`external-invitation-registration.tsx` kırpılmış `validation.data.nickname`'i gönderir) ve profil alanı (`nickname-field.tsx`) aynı fonksiyonları kullanır. TR/EN/DE: `register.nicknameHint`, `validation.nickname`, `validation.nicknameSpaces`, `account.nicknameEdit.hint/invalid/invalidSpaces`; OpenAPI metni (`UserProfileController`) güncellendi.
- **Mention kuralları (`features/tasks/mentions.ts`):** `NICKNAME_CHAR` artık `-` içerir. Yazarken `@` sonrası sorgu, tek boşlukla bağlı kelimeler ve bir sondaki boşluk olabilir (`MENTION_QUERY`); art arda boşluk ve satır sonu mention'ı kapatır; sorgu en çok 32 kod noktası (`Array.from`). `encodeMentions` en uzun ad önce eşleşir (`@Ali` / `@Ali Veli` belirsizliği testle sabit). Sunucu yine yalnız `@[uuid]` ayrıştırır.
- **Rename önbelleği (`nicknameIdentityQuery`) kapsadığı anahtarlar:** `["projects", <sayfa numarası>]` (proje liste kartları), `["projects","dashboard"]`, `["projects","by-slug"|"detail",...]`, `["projects",id,"members"|"squads"|"chat"|"home"|"reminders"]`, `["projects",id,"tasks",...]` (`counts`/`labels` hariç), actor'a ait `invitations`, `["project-home", id]`, `["organizations","projects",...]`, `["admin", actorId, "users"]`, `["tasks","mine"|"pool"]`, `project-invitations` ve `notifications` (actor'a ait). Global cache temizliği yok; ilgisiz anahtarlar (criteria, counts, labels) dokunulmaz.
- **`@@` mention chip düzeltmesi:** `activity-section.tsx` mention chip'i `@{segment.value}` çiziyordu; `segment.value` zaten `@` içerdiği için `@@Ad` görünüyordu. Ek `@` kaldırıldı.
- **Avatar baş harfleri:** `components/ui/avatar.tsx` yalnız `-`/`_` olan kelimeleri baş harften saymaz ve baş harfi kod noktası bazında alır (surrogate çifti ikiye bölünmez).
- **Güvenlik:** kontrol/görünmez karakter reddi; render her yerde düz metin; kimlik (UUID, e-posta, oturum, üyelikler) kullanıcı adından bağımsız; rename yalnız `/me`. Ayrıntı: `.agents/SECURITY.md` "Nickname contract (2026-10-10)".
- **Testler:** backend `NicknameRulesTest` (yeni), `UserAccountServiceNicknameTest` (yeni, OAuth üretici), `UserDomainTest`, `AuthRegistrationHttpTest`, `UserProfileApiIntegrationTest` genişletildi; E2E yeni `nickname-contract.spec.ts` (kural, önbellek kapsamı, mention, kayıt, profil alanı üç dilde, rename'in navbar/hesap/proje/ekip yüzeylerine yenilemesiz yansıması, boşluklu adlı üyeye mention) ve `nickname-editing.spec.ts` güncellendi.

## 3. Task 2 — Scrollbar

- `globals.css` içindeki standart (`--label-blue` thumb, hover'da `color-mix`, `scrollbar-width: thin`, şeffaf track, WebKit 8px yuvarlak thumb, `forced-colors` altında `auto`) `html:has(.app-shell)` koşulundan çıkarılıp **her sayfanın document root'una (`html`)** uygulandı. Tek kural, tek token/alias; ikinci palet yok.
- Miras sıfırlaması (`html > body`, `[data-workspace-scroll] > *` `auto`) korundu; iç kaydırma alanları (textarea, `pre`, dialog, landing demo `<main>`, cookie banner) tarayıcı varsayılanında kalır.
- Kapsam: Landing, Login/Kayıt/Şifre, public bilgi sayfaları + oturumlu sayfalar aynı scrollbar.
- Testler: `public-scrollbars.spec.ts` (yeni: Landing/Login/public × light/dark × TR/EN/DE root rengi oturumlu sayfayla aynı; landing demo iç kaydırıcıları kendi native hâlinde) ve `workspace-scrollbars.spec.ts` genişletildi; `playwright.public.config.ts` yeni spec'i `testMatch` listesine ekler.
- Checklist 2.3: Chromium doğrulandı; standart `scrollbar-color` kullanıldığı için Firefox uyumlu, **Firefox koşusu yapılmadı** (bölüm 9).

## 4. Task 3 — Cookie banner

- `features/consent/cookie-banner.tsx`: sol alt yerine alt-orta: `fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] mx-auto … sm:max-w-lg`. Consent davranışı (analytics varsayılan kapalı, eşit ağırlıklı düğmeler, tercih penceresi) değişmedi.
- `--cookie-banner-offset` artık banner yüksekliği + alt mesafe (12px veya safe-area) + 12px boşluk; banner açıkken `<html data-cookie-banner-open>` da yazılır, kapanınca ikisi silinir.
- **Kilit davranışı:** Login/Kayıt ≥970px yükseklikte `h-dvh overflow-hidden` ile viewport'a kilitleniyordu ve footer banner'ın altında kalabiliyordu. Kilit Tailwind sınıfından `globals.css` içindeki `html:not([data-cookie-banner-open]) .auth-shell:has([data-auth-fixed])` kuralına taşındı. Banner açıkken kilit **kalkar**, kolon `min-h-[calc(100dvh - var(--cookie-banner-offset))]` ile banner'ın üstünde biter, gerekirse kayar; karar verilince kilit geri gelir.
- **Ölçümler (1440x1000 Login):** içerik ~967px, banner offset ~276px; footer bağlantıları ve form banner açıkken tıklanabilir.
- Testler: `cookie-consent.spec.ts` genişletildi (Landing/Login/public × 320/390/768/1024/1440 × light/dark: banner yatay ortada, footer ve form erişilebilir; kilitli uzun Login banner'ın üstünde biter, seçim sonrası yeniden kilitlenir).

## 5. Task 4 — Tema geçişi performansı

Kök neden araştırması (ölçüm: CDP trace + katman probu, 2560×1440 ve 4× CPU kısıtlı koşular):

| Bulgu | Kanıt | Sonuç |
| --- | --- | --- |
| GPU'lu tarayıcıda Landing/Login | 60 fps, uzun görev 0; React'ta tüm sayfa rerender yok (yalnız toggle'lar + overlay) | Kod sorunu değil; geliştirici makinesinde yeniden üretilemedi |
| Kullanıcının Chrome'u | `Local State` → `hardware_acceleration_mode.enabled=false` (donanım hızlandırması kapalı) | **Kök koşul:** yazılımla çizimde Login 2560×1440'ta ~7 fps |
| Katman probu: taban | 21–25 kare / 1,5 sn | Takılma yeniden üretildi |
| Katman probu: `.auth-neon` kapalı | **64 kare** / 1,5 sn | **Kök neden:** tam ekran `screen` grup + %300 genişlikte `multiply` bant CPU'da her karede yeniden harmanlanıyor |
| Katman probu: `backdrop-blur` kapalı | etkisiz | Neden değil |
| Katman probu: SVG filtreleri kapalı | etkisiz | Neden değil |
| Katman probu: gölgeler kapalı | etkisiz | Neden değil |
| Katman probu: blend kısmen kapalı | 35–42 kare | Kısmi iyileşme; asıl yük neon grubunun tamamı |

**Reddedilen hipotezler:**

- `next-themes` guard'ının kaldırılması: ölçümde **daha kötü** çıktı, geri alındı.
- `content-visibility`: mobilde **daha kötü**, uygulanmadı.
- Gizli temadaki SVG filtre/görsel ilk raster'ı, Landing demo toggle'ları, blur header'lar ve View Transition: ölçümde belirleyici değil.

**Düzeltmeler:**

1. **Döngü duraklatma:** Login'in sonsuz animasyonları (`.logo-current`, `.auth-neon-band`, `.auth-slogan::after`) `html.theme-reveal` / `html.theme-close-in` sırasında `animation-play-state: paused`; geçiş bitince kaldığı yerden sürer. Sayfa view transition'a canlı yakalandığı için her döngü karesi ayrıca stil/boya/kompozit oluyordu (4× CPU kısıtında boya -%40, ana iş parçacığı -%8).
2. **Yazılım render tespiti:** `lib/rendering.ts` (`detectSoftwareRendering`: WebGL `failIfMajorPerformanceCaveat` bağlamı reddedilirse veya yazılım renderer adı — SwiftShader/llvmpipe/softpipe/WARP/"software"/"basic render" — dönerse) ve `components/layout/rendering-probe.tsx` (`RenderingProbe`, `AuthShell` içinde). Karar `<html data-renderer="software">` olarak yazılır, sekme başına `sessionStorage` (`pda:renderer`) içinde tutulur ve `app/layout.tsx` `<head>` içindeki `RENDERER_BOOT_SCRIPT` ile ilk boyamadan önce uygulanır (flash yok). `html[data-renderer="software"] .auth-neon { display: none }`. Tespit hata verirse tam sahne korunur.

**Öncesi / sonrası (yazılım render, 2560×1440):**

| Ölçü | Önce | Sonra |
| --- | --- | --- |
| Kare sayısı / 1,5 sn | 21–25 | 60–63 |
| >50 ms kare | 15–18 | 2 |
| En büyük kare boşluğu | 133 ms | 67 ms |

GPU'lu kullanıcılar için görsel değişiklik **yok** (yalnız `data-renderer="software"` iken neon gizlenir; döngü duraklatma yalnız ~0,5 sn'lik daire süresince). `transition: all` eklenmedi, reduced-motion korundu, route değişimi/remount/odak kaybı ve hydration uyarısı yok.

**Testler:** `theme-switch-performance.spec.ts` (yeni): işlevsel korumalar (route/odak korunur, hydration uyarısı yok, koyu açılış, motion kapalıyken daire oynamaz), döngülerin daire sırasında durup sonra devam etmesi, yazılım tespiti + önbelleğe alınmış kararın belge ayrıştırılırken uygulanması, donanım kararında neon'un kalması, ölçüm koşuları (önce/sonra, CPU kısıtı) ve rerender sayımı.

### Test spec düzeltmesi

`landing-page.spec.ts` "landing follows live changes to the global semantic palette" testi CTA rengini `data-motion` uygulanmadan okuyordu (0.15 sn renk geçişi yarışı → aralıklı hata). Test artık `html[data-motion="off"]` bekliyor ve rengi `toHaveCSS` ile yeniden deniyor.

## 6. Değişen dosyalar (git status)

Backend (kaynak):

- `backend/src/main/java/com/pda/user/NicknameRules.java` (yeni; `user/domain/NicknameRules.java` silindi)
- `backend/src/main/java/com/pda/auth/api/dto/request/InvitationRegisterRequest.java`
- `backend/src/main/java/com/pda/auth/api/dto/request/RegisterRequest.java`
- `backend/src/main/java/com/pda/user/api/UserProfileController.java`
- `backend/src/main/java/com/pda/user/application/service/UserAccountService.java`
- `backend/src/main/java/com/pda/user/application/service/UserProfileService.java`
- `backend/src/main/java/com/pda/user/domain/entity/User.java`

Backend (test):

- `backend/src/test/java/com/pda/user/NicknameRulesTest.java` (yeni)
- `backend/src/test/java/com/pda/user/application/service/UserAccountServiceNicknameTest.java` (yeni)
- `backend/src/test/java/com/pda/auth/api/AuthRegistrationHttpTest.java`
- `backend/src/test/java/com/pda/user/application/UserDomainTest.java`
- `backend/src/test/java/com/pda/user/integration/UserProfileApiIntegrationTest.java`

Frontend (kaynak):

- `frontend/src/app/globals.css`
- `frontend/src/app/layout.tsx`
- `frontend/src/components/layout/auth-shell.tsx`
- `frontend/src/components/layout/rendering-probe.tsx` (yeni)
- `frontend/src/components/ui/avatar.tsx`
- `frontend/src/lib/rendering.ts` (yeni)
- `frontend/src/features/account/components/nickname-field.tsx`
- `frontend/src/features/account/nickname.ts`
- `frontend/src/features/auth/components/register-form.tsx`
- `frontend/src/features/auth/schemas.ts`
- `frontend/src/features/consent/cookie-banner.tsx`
- `frontend/src/features/invitations/components/external-invitation-registration.tsx`
- `frontend/src/features/tasks/components/detail/activity-section.tsx`
- `frontend/src/features/tasks/mentions.ts`
- `frontend/src/i18n/messages/de.json`, `en.json`, `tr.json`

Frontend (test/config):

- `frontend/e2e/nickname-contract.spec.ts` (yeni)
- `frontend/e2e/public-scrollbars.spec.ts` (yeni)
- `frontend/e2e/theme-switch-performance.spec.ts` (yeni)
- `frontend/e2e/cookie-consent.spec.ts`
- `frontend/e2e/landing-page.spec.ts`
- `frontend/e2e/nickname-editing.spec.ts`
- `frontend/e2e/workspace-scrollbars.spec.ts`
- `frontend/playwright.public.config.ts`

Dokümanlar:

- `PDA_ACCOUNT_PUBLIC_UI_THEME_TEAMS_REFINEMENTS_PLAN.md` (yeni, kalıcı plan)
- `.agents/PDA_Account_Public_UI_Theme_Teams_Refinements_Plan_and_Implementation.md` (yeni, talep)
- `.agents/SECURITY.md`, `.agents/frontend-design-rules.md`, `.agents/architecture.md`, `.agents/folder-structure.md`, `.agents/web-rules/WEB_SITE_MASTER_CHECKLIST_TR.md`
- `docs/compliation/2026-10-10-general-features-account-public-ui-theme.md` (bu kayıt)

## 7. API

Yeni endpoint yok. Değişen sözleşme: `POST /api/v1/auth/register`, `POST /api/v1/auth/register/invitation` ve `PUT /api/v1/users/me/profile` aynı genişletilmiş kullanıcı adı kuralını uygular (yeni izinli karakterler: `-`, tek boşluk). Hata kodları ve durum kodları değişmedi (`400 NICKNAME_INVALID`, `409 NICKNAME_TAKEN`, kayıtta `400` + `invalidFields`). Swagger kontrol yolu: `/swagger-ui/index.html`; `/api/v1/auth/csrf` + login sonrası `PUT /api/v1/users/me/profile` gövde `{"nickname":"Hamza Taşbay"}` → `200`; `{"nickname":"Hamza  Taşbay"}` (çift boşluk) → `400 NICKNAME_INVALID`. Migration, ENV ve bağımlılık değişikliği yok.

## 8. Test sonuçları

| Kontrol | Komut / kapsam | Sonuç |
| --- | --- | --- |
| Backend `mvnw clean verify` | `backend` (ModularityTest dahil), pre-push içinde | 719 / 0 failure / 0 error / 0 skip |
| Lint / `tsc` / build | `npm run lint`, `tsc --noEmit`, `next build` (pre-push) | Temiz (lint 0 hata, diğer spec'lerde önceden var olan 2 uyarı) |
| Hedefli Playwright | 19 spec: `01/02/03/04/07/09/12/14/16-*`, `nickname-*`, `member-initials`, `task-comment-keyboard`, `admin-users`, `auth-session-audit`, `authenticated-history`, `workspace-scrollbars`, `theme-switch-performance`, `motion-preferences` | 97 geçti, 18 skip (opt-in ölçüm testleri), 2 başarısız: `auth-session-audit` "oturum bitince…" (kayıtlı istisna) ve `authenticated-history:26` (uzun koşuda bir kez; tek başına ve komşularıyla `--repeat-each=3` 27/27) |
| `landing-page` palette testi | `--repeat-each=5` (zamanlama yarışı düzeltmesinden sonra) | 5/5 |
| Public paket | `playwright.public.config.ts` (`public-scrollbars`, `cookie-consent`, `landing-page`, `ui-ux-public`, `a11y-public` …) | 287 / 287 |
| Pre-push | `.\pre-push\pre-push.cmd` (backend verify, lint, build, tam Chromium E2E) | 843 geçti, 19 skip, 2 başarısız → **katı anlamda FAIL**: `auth-session-audit` "oturum bitince…" (kayıtlı istisna) ve `team-member-preview` oturum 401'i (bilinen aralıklı; tek başına 1/1 geçti) |

## 9. Kalan konular

- **Firefox koşusu yapılmadı.** Scrollbar standart `scrollbar-color`/`scrollbar-width` kullanıyor, bu yüzden Firefox'ta uyumlu olması beklenir; gerçek Firefox görsel testi yapılmadı (plan 2.3 bu nedenle `[ ]`).
- **`TeamDeletion` uzunluk kontrolü (önceden var olan uç durum):** `backend/.../notification/domain/TeamDeletion.java` `actorNickname.length() > 32` ile UTF-16 uzunluğuna bakıyor. Kullanıcı adı kuralı kod noktası sayar; 32 kod noktalık ama 32'den fazla UTF-16 birimi olan (ör. çok sayıda supplementary-plane harfi) bir ad ekip silme bildiriminde reddedilebilir. Bu değişiklikten bağımsız, önceden vardı; kuralı gevşetmek ihtimali artırmaz (ad uzunluğu sınırı aynı), ayrı düzeltme önerilir.
- **`auth-session-audit` "oturum bitince kullanıcıya ne gösteriliyor"** testi: Alper'in denetim testi, uygulamada henüz olmayan oturum sona erdi açıklaması ve giriş sonrası `?next=` dönüşünü arıyor. Kayıtlı istisna (bkz. `2026-10-10-invitation-conflict-codes.md`); bu işle ilgisi yok, tam pakette düşmeye devam eder.
- **Software tespiti regex'i dışındaki yazılım renderer adları:** `SOFTWARE_RENDERER` yalnız SwiftShader, llvmpipe, softpipe, "software", "basic render", WARP adlarını tanır. Başka bir yazılım rasterizer adı, `failIfMajorPerformanceCaveat` bağlamını da reddettirmiyorsa tespit edilmez ve tam sahne (neon dahil) kalır; tespit hatası her zaman tam sahne yönünde güvenlidir.
- Dış kaynak: kullanıcının kendi Chrome'unda donanım hızlandırmasını açmak takılmayı kökten giderir; kod düzeltmesi yalnız kapalı olduğu durum içindir.

## 10. Bekleyen ürün kararları

- **E-posta doğrulama** hâlâ açık karar (değiştirilmedi).
- **BASIC commit sayfalama** ertelendi; `+N` rozeti yalnız davet edende kalır (karar verildi).

## 11. Kullanıcının kontrol adımları

1. Kayıt veya Hesap sayfasında kullanıcı adını `Hamza Taşbay` yap; kaydet. Navbar, Hesap, proje kartları ve ekip üyelerinde sayfayı yenilemeden güncellendiğini gör. Aynı alana `Hamza  Taşbay` (iki boşluk) yaz: art arda boşluk için ayrı mesajı gör. Başına/sonuna boşluk koyup kaydet: boşluksuz kaydedilir.
2. Bir görev yorumunda `@Ham` yaz, boşluklu adlı üyeyi seç: chip `@Hamza Taşbay` (tek `@`) görünür.
3. Landing ve Login'de sayfa scrollbar'ının oturumlu sayfalardaki mavi ince scrollbar ile aynı olduğunu açık ve koyu temada kontrol et.
4. Çerezleri sıfırla (site verisini sil): banner alt-ortada çıkmalı; Landing'de footer'ın üstünde, Login'de (uzun ekran) formun ve footer'ın altında kalmamalı; karar verince Login yeniden viewport'a kilitlenmeli.
5. Login'de tema düğmesine bas; Chrome'da donanım hızlandırması kapalıyken de geçiş akıcı olmalı. Donanım hızlandırması açıkken neon ışık şeridi eskisi gibi görünmeli.
