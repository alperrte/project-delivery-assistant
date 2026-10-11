# Frontend başarısız test düzeltmeleri

## Teslim ve durum

11 Ekim 2026, `general-features`: önceki frontend koşumundaki 18 başarısız test ve seri admin grubunda çalışmayan 6 test hedefli olarak düzeltildi/doğrulandı. Etkilenen navbar regresyonlarıyla birlikte 39 senaryonun tamamı son halleriyle başarılı olarak doğrulanmıştır: ilk hedefli koşum 38 başarılı/1 başarısız; kalan ölçüm hazırlığı düzeltildikten sonra tek test tekrar geçti. Tam 945 testlik paket ve backend/pre-push tekrar çalıştırılmadı. Commit/push yapılmadı.

## Yapılanlar

- `frontend/src/features/contact/contact-page.tsx`: mevcut ortak `Breadcrumb` ile görünür ana sayfa/iletişim yolu eklendi. Mevcut JSON-LD ile TR/EN/DE eşleşir.
- `frontend/e2e/helpers.ts`: `revealWorkspaceHeader` navbar'ın yatay merkezindeki üst reveal alanını kullanır ve navbar'ın açıldığını doğrular. Sol üst/scrollbar kenarında açılma varsayımı kaldırıldı.
- `workspace-history.spec.ts`, `workspace-history-context.spec.ts`, `invitation-remediation.spec.ts`, `team-deletion-notifications.spec.ts`, `team-invitation-response-badge.spec.ts`, `admin-login.spec.ts`: gizli düğmelere tıklamak yerine gerçek reveal etkileşimi kullanılır. Navbar konumu ölçülürken sidebar'a tıklama nedeniyle idle hide başlamasına izin verilmez; sidebar sonrası yeniden reveal edilir. Mevcut görünürlük, sınır, native history, iptal, chat/inert ve hesap izolasyonu assertion'ları korunur.
- `admin-login.spec.ts`: çerezler temizlendikten sonra polling'in zaten login'e yönlendirmiş olabileceği hesaba katılır. Kaybolmuş Analitik linkine tıklamak için beklemek yerine mevcut client router üzerinden aynı hedefe geçilir veya gerçekleşmiş yönlendirme beklenir. `session-expired` adresi ve bildirimi hâlâ doğrulanır; altı seri klavye/responsive senaryo da geçti.
- `team-deletion-notifications.spec.ts`, `team-member-preview.spec.ts`: başka spec'lerden kalmış, refresh cookie'si döndürülmüş veya iptal edilmiş session dosyaları yeniden kullanılmaz; ilgili fixture gerçek login ile kendi yeni session'ını oluşturur. Production token/session politikası değişmedi.
- `12-theme-transition.spec.ts`, `home-return.spec.ts`: cihazın reduced-motion tercihi açıkken animasyon oynanmaması doğrulanır; tercih açıkken animasyon bekleyen eski testler güncellendi. Gerçek uygulamanın erişilebilirlik davranışı değiştirilmedi.
- `about-page.spec.ts`: Hamza'nın güncel `/in/hamza-tasbay` LinkedIn adresi beklenir; CV PDF linki ve HTTP content-type kontrolleri korunur.
- `contact-delivery.spec.ts`, `privacy-regression.spec.ts`: mevcut kategori etiketli mail konusu ve sabit `pdassistant.info@gmail.com` alıcısı beklenir. Header injection, sabit alıcı, markup'ın düz metin taşınması ve duplicate delivery kontrolleri korunur.
- Checklist ve frontend tasarım özeti ilgili kapsamda güncellendi. `.env`/`.env.example` ve API/auth/security sözleşmeleri değiştirilmedi.

## Doğrulama

`frontend` içinde:

- `npx.cmd tsc --noEmit`: başarılı.
- `npm.cmd run lint`: başarılı, 0 hata; önceki iki kullanılmayan değişken uyarısı aynı (`ui-ux-app.spec.ts` / `ui-ux-public.spec.ts`).
- `npm.cmd run build`: başarılı, 44 sayfa üretildi.
- Production build üzerinde, mevcut Docker backend/PostgreSQL/Mailpit ile gerçek oturumlar kullanıldı. `E2E_REUSE_USERS=1`; global setup girişleri yeniler. `.env` yalnız sürece okundu; geçici test sunucusu her koşum sonunda kapatıldı.
- Hedefli ilk komut: `node node_modules/playwright/cli.js test e2e/12-theme-transition.spec.ts e2e/about-page.spec.ts e2e/home-return.spec.ts e2e/contact-delivery.spec.ts e2e/privacy-regression.spec.ts e2e/localized-routing.spec.ts e2e/admin-login.spec.ts e2e/invitation-remediation.spec.ts e2e/team-deletion-notifications.spec.ts e2e/team-invitation-response-badge.spec.ts e2e/team-member-preview.spec.ts e2e/workspace-history-context.spec.ts e2e/workspace-history.spec.ts e2e/navbar-auto-hide.spec.ts --grep "(animations|about page shows|home return|logged-out visitor sends|abuse through the real API|keeps markup as text|public information pages show|administrator lifecycle|INV-003|foreground polling delivers|same-document recipient logout|inviter|real onboarding names|history header|PDA and browser traversal|native PDA traversal|desktop upward scroll|hover, focus|actual touch drawer|touch upward)" --reporter=list,json`: **38 passed, 1 failed**, skip/flaky yok. JSON raporu: `%TEMP%/pda-frontend-targeted.json`.
- İlk koşumun tek kalan hatası: sidebar etkileşimi sonrasında idle hide, header x konumunu gizlenme scale animasyonuyla değiştirmişti. Ölçüm hazırlığı düzeltildi.
- Son tekrar: `node node_modules/playwright/cli.js test e2e/workspace-history.spec.ts --grep "history header stays" --reporter=list,json`: **1 passed**, skip/flaky yok. JSON raporu: `%TEMP%/pda-header-recheck.json`.
- `git diff --check`: başarılı; çözülmemiş Git conflict yok.
- `frontend/public/cv/hamza-tasbay-cv.pdf` Git blob hash'i HEAD ile aynı (`631c84671a9d2e5da8215cd720156d5de48a5b47`); CV değişikliği korundu.

## Açık konular

Sonuç etkilenen 39 senaryonun doğrulamasıdır; bütün 945 testlik paketin yeni koşumunun sonucu değildir. Tam pre-push'ın Docker build/smoke aşaması bu görevde çalıştırılmadı. Yerel merge kullanıcı commitini bekler; dosyalar bu görevde stage edilmedi.

## Kullanıcı kontrolü

1. Test ve iletişim sayfası diff'ini inceleyin; assertion'ların gerçek kullanıcı etkileşimine ve kabul edilmiş güncel değerlere karşı çalıştığını kontrol edin.
2. İletişim sayfasında üç dilde ana sayfa/iletişim breadcrumb'ını; navbar'ın scrollbar kenarında açılmadığını ve kendi üst merkezinde açıldığını kontrol edin.
3. Düzeltilen frontend dosyaları, checklist/tasarım özeti ve istenen completion kayıtlarını stage ederek mevcut merge commitine ekleyin. Backend admin mail testi düzeltmesi de commit kapsamına alınmalıdır.
4. Commit/push kullanıcıya bırakıldı; bu kayıt tam pre-push'ın geçtiği anlamına gelmez.
