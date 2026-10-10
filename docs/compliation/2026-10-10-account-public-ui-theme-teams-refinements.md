# PDA — Kullanıcı adı, Public UI, Tema performansı ve Ekip üye kartları — Final Completion

Kaynak talep: `.agents/PDA_Account_Public_UI_Theme_Teams_Refinements_Plan_and_Implementation.md` (5 talep). Plan ve ilerleme: [PDA_ACCOUNT_PUBLIC_UI_THEME_TEAMS_REFINEMENTS_PLAN.md](../../PDA_ACCOUNT_PUBLIC_UI_THEME_TEAMS_REFINEMENTS_PLAN.md). Faz kayıtları:

- [general-features](2026-10-10-general-features-account-public-ui-theme.md) — PR #137 (`5f524bb`, main ile merge çözümü `3da350a` dahil)
- [squad-service-backend](2026-10-10-squad-service-teams-member-cards.md) — PR #138 (`90f7c7c`)

## Final verdict

5 talebin tamamı uygulandı ve iki faz da kullanıcının commit/push/merge'üyle main'e girdi. Birleşik main (`90f7c7c`) üzerinde tek seferlik tam pre-push koşuldu (kullanıcı kararı: ara fazlarda yalnız hedefli kontroller, tam pre-push sonda bir kez):

- Backend `mvnw clean verify`: **827 / 0 failure / 0 error / 0 skip**.
- ESLint, `tsc --noEmit`, `next build`: temiz.
- Tam Chromium: 814 geçti, 19 skip, 3 başarısız, 40 koşmadı — **koşu kirlendi**: E2E sürerken orkestratör `auth-service-backend`'e geçti; `git switch` bir anlığına eski dosyaları yükledi ve Playwright `form-submit-results.spec.ts`'yi bulamadı (`Cannot find module`). Etkilenen dosyalar temiz ağaçta yeniden koşuldu: `form-submit-results` + `team-member-preview` + `landing-page` → **60 / 61**.
- Kalan tek başarısız: `landing-page.spec.ts:203` palet testi — kod hatası değil, test yarışı (aşağıda). Docker stack build/start adımı E2E başarısız olduğu için pre-push içinde koşmadı; backend imajı aynı kodla ayrıca build edilip sağlıklı çalıştı.

Global durum: **tamamlandı, kayıtlı test istisnasıyla** — md'nin "Full regression PASS / canonical pre-push PASS" şartı katı anlamda sağlanmadı (palet testi yarışı + kirli koşu); kalan düzeltme bir sonraki frontend branch'inde yapılacak.

## Task checklist

- [x] 1 — Kullanıcı adı sözleşmesi + rename önbellek yayılımı
- [x] 2 — Oturumsuz sayfalarda mevcut scrollbar standardı (Firefox koşusu yapılmadı)
- [x] 3 — Cookie banner alt-orta
- [x] 4 — Landing/Login tema geçişi performansı
- [x] 5 — Phase 1 regresyon + dokümantasyon
- [x] 6 — Ekip üyesi veri sözleşmesi (rol)
- [x] 7 — Ekip kartında avatar + ad + pozisyon
- [x] 8 — Phase 2 regresyon (hedefli; tam pre-push burada)

## Username contract

Tek kural `com.pda.user.NicknameRules` (modül kökü public API; Modulith nedeniyle `user.domain`'den taşındı) ve frontend aynası `features/account/nickname.ts`: Unicode harf/rakam, `_`, `-` ve kelimeler arası tek U+0020; 3–32 kod noktası; baş/son boşluk her yolda kırpılır; ardışık boşluk ayrı mesajla reddedilir; tab/NBSP/kontrol/görünmez karakterler reddedilir. Büyük/küçük harf duyarlı benzersizlik değişmedi; migration yok. OAuth üreticisi doğal adı korur (boşluklar teke indirilir).

## Username rename/cache behavior

`nicknameIdentityQuery` artık proje listesi/dashboard/by-slug/detail, project-home, hatırlatıcılar, organizasyon projeleri ve admin kullanıcı listesini de kapsıyor; global `clear()` yok. Rename sonrası navbar, hesap, ekip ve proje kartları yenilemesiz güncelleniyor (E2E, belge yeniden yüklenmeden doğrulandı). Mention'lar boşluklu adlarla çalışıyor; yorum chip'indeki `@@` hatası düzeltildi.

## Public scrollbar styling

Oturumlu sayfalardaki kural (`--label-blue` thumb, thin, şeffaf track, forced-colors `auto`) `html` köküne genelleştirildi; tek kural, tek palet; iç kaydırma alanları `auto`.

## Cookie banner placement

Her genişlikte alt-orta (`inset-x-3 mx-auto`, `sm:max-w-lg`, safe-area). Banner açıkken `html[data-cookie-banner-open]` Login'in ≥970px `h-dvh` kilidini kaldırır; karar verildikten sonra kilit geri gelir. Footer bağlantıları ve login butonu 320–1440'ta kapanmıyor.

## Theme performance root cause

GPU'lu tarayıcıda Landing/Login 60 fps (uzun görev yok, sayfa ağacı yeniden render olmuyor). Kullanıcının Chrome'unda donanım hızlandırması kapalı; yazılım render'da Login 2560×1440'ta ~7 fps. Katman probu: yalnız `.auth-neon` (tam ekran `screen` grup + %300 genişlikte `multiply` bant) kapatılınca 1,5 sn'de 21–25 → 64 kare; backdrop-blur, SVG filtreleri ve gölgeler etkisiz.

## Theme performance fix/evidence

(1) Daire oynarken Login sonsuz döngüleri duraklatılır; (2) `lib/rendering.ts` + `RenderingProbe` yazılım render'ı tespit eder (WebGL `failIfMajorPerformanceCaveat` + renderer adı), `html[data-renderer="software"] .auth-neon {display:none}`; karar sekme başına saklanır ve paint öncesi uygulanır. Sonuç (yazılım, 2560×1440): >50 ms kare 15–18 → 2, en büyük boşluk 133 → 67 ms. GPU kullanıcıları için görsel değişiklik yok.

## Teams member data source

`TeamView.MemberPreview` / `MemberPreviewResponse` artık `roles` (enum sırası, ilki ana rol) taşıyor; `SquadService.views()` zaten yüklenen `ProjectMemberView.roles()`'dan dolduruyor. E-posta yok.

## Teams member card presentation

Grid kartta üyeler yan yana: avatar → tam ad → ana rol + "+N"; kullanıcı geri bildirimiyle kısaltma kaldırıldı, metin sarılıyor; tooltip ve `aria-label` tüm rolleri listeliyor; en fazla 5 üye + "+N". Tablo/Şema değişmedi. Not: tooltip için üye alanı kart tıklama katmanının üstünde; üyeye tıklamak ekibi açmıyor (kartın geri kalanı ve "Ekibi aç" açıyor).

## N+1 / performance

`SquadServiceTest`: 30 ve 100 ekipte aynı 11 sorgu; E2E'de üye başına istek yok.

## Responsive / accessibility / i18n

Yeni metinler TR/EN/DE (DE "Sie"). Banner, scrollbar ve kartlar 320/390/768/1024/1440, açık/koyu temada doğrulandı; forced-colors ve reduced-motion korunuyor.

## Backend/database changes

Migration ve ENV değişikliği yok. Sözleşme değişiklikleri: kayıt/profil kullanıcı adı kuralı genişledi; ekip listesi önizlemesine `roles`; admin kullanıcı listesi `status=DELETED` filtresini 400 ile reddediyor (Alper'in `DELETED` durumu eklemesiyle kırılan test; kullanıcı kararı).

## Changed files

Faz kayıtlarında tam listeler var. Bu final adımda: bu doküman ve plan dosyası güncellemesi.

## Test results

| Doğrulama (birleşik main `90f7c7c`) | Sonuç |
| --- | --- |
| Backend `mvnw clean verify` | 827 / 0 / 0 / 0 |
| ESLint, `tsc`, `next build` | Temiz |
| Tam Chromium (pre-push) | 814 geçti, 19 skip, 3 başarısız, 40 koşmadı (branch geçişiyle kirlendi) |
| Etkilenen dosyaların temiz yeniden koşusu | 60 / 61 (kalan: palet testi yarışı) |
| Docker stack build/start (pre-push adımı) | Koşmadı (E2E başarısızlığı); backend imajı ayrıca build edildi ve sağlıklı |

## Remaining issues

- **`landing-page.spec.ts:203` test yarışı:** rengi değiştirdikten hemen sonra ilk `toBe` kontrolü 0,01 ms'lik geçişin başlangıç değerini okuyabiliyor; ikinci kontrol gibi otomatik bekleyen `toHaveCSS`'e çevrilmeli. Bir sonraki frontend branch'inde (`auth-service-frontend`) düzeltilecek.
- **`team-member-preview` uzun koşu 401'i:** bilinen aralıklı; tek başına geçiyor.
- **`auth-session-audit` "oturum bitince…":** önceki kayıtlı istisna (bu koşuda düşmedi).
- **Firefox scrollbar koşusu yapılmadı.**
- **`TeamDeletion` 32 UTF-16 uzunluk kontrolü:** önceden var olan uç durum.
- **E2E ortamı:** `docker-compose.e2e.yml` main'den bilinçli olarak kaldırıldı; yerel E2E için override scratchpad'de tutuluyor (repoya eklenmedi).

## Pending product decisions

- E-posta doğrulama: **kapatıldı** (Alper PR #135 ile e-posta kodu doğrulaması).
- BASIC depo modunda commit özeti sayfalaması: ertelendi ("şimdilik beklesin, hatırlat").
