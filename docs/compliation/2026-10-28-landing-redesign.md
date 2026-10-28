# Landing sayfası yeniden tasarımı — 2026-10-28

## Tamamlanan kapsam

`/` sayfası sinematik, dark-first (açık tema eşit cilalı) bir tanıtım sayfası olarak yeniden yazıldı. Eski scroll-story (`product-story`, `product-demo`, tek parça `pda-demo-workspace`) kaldırıldı.

- Sıra: Header, Hero (dönen kelime, kayıt/GitHub CTA'ları, eğik gerçek uygulama önizlemesi), anonim "araç yığını" anlatısı, beş özellik bölümü (toplantı, sohbet, görev, repository, organizasyon), tek marquee, açık kaynak CMD sahnesi (Apache 2.0, Docker ile kendi sunucunda çalıştırma, katkı CTA'sı), final CTA ve `SiteFooter tone="auth"`.
- Hero mesajı (TR): "Görev, sohbet, toplantı ve kod. Tek çalışma alanında." Metinler TR/EN/DE için `frontend/src/i18n/landing/{tr,en,de}.json` içindedir (her biri 102 anahtar).
- Demolar gerçek PDA componentleridir ve sahte veriyle çalışır; screenshot/video yoktur. Hero `AppShellView contained` + `BoardPage`; toplantı `MeetingCard`, `RoomControls`, `Avatar`; sohbet `MessageList`, `TypingIndicator` (`ChatProvider disabled`); görev `TaskFormBody` (SIMPLE/ADVANCED geçişi); repository `RepositoryOverview`, `RepositoryBranches`; organizasyon `OrganizationProfileHeader` ve `OrganizationCard` (preview). Yedek (fallback) bileşen kullanılmadı.
- Demo yüzeyleri `inert` + `aria-hidden` ve `sr-only` figcaption içerir; `resolveDemoQuery` bilinmeyen anahtarda `undefined` döner, gerçek API'ye istek gitmez.
- Hareket GSAP + ScrollTrigger ile (`use-landing-motion.ts`, `reveal.tsx`): SSR son durumu render eder, from-state mount sonrası kurulur; pin/scrub yalnız ≥1024×700; reduced-motion ve `html[data-motion="off"]` statik sonuç verir; yalnız transform/opacity animasyonu. Metinler soldan/sağdan kayarak girer.
- Mobil: 1024 px altı 44 px hamburger (`#landing-navigation`), 44 px hedefler, 320 px'te yatay taşma yok, mobilde toast altta, oda karoları 4 sütun.
- Son turda bulunan iki gerçek sorun düzeltildi: sticky header odaklanan/kaydırılan öğeleri (özellikle footer bağlantılarını) örtüyordu, `html:has(#landing-main)` için `scroll-padding-top: 5.5rem` eklendi ve eski `.features` scroll-margin kaldırıldı; hero ikinci satırının metin rengi `color-mix()` yerine doğrudan `var(--lp-accent)` oldu.
- İnceleme turu (ekran görüntüleri + tarayıcı ölçümü) sonrası düzeltmeler:
  - Toplantı demosunda organizatör katılımcı listesinde de vardı; bu, React'te `pda-demo-alper` için yinelenen anahtar hatası veriyordu ve avatar satırında "AL" iki kez görünüyordu. Demo katılımcılarından organizatör çıkarıldı.
  - Toplantı demosu çerçeveye sığmıyordu ve alttaki kart kesiliyordu. Demo artık canlı proje toplantısı + oda çubuğu + bağımsız toplantı olarak üç parça (kullanılmayan `demoMeeting2` anahtarı silindi).
  - Görev formundaki sticky işlem çubuğu demo çerçevesine yapışıyordu ve alanlar çubuğun altından görünüyordu. Demo içinde çubuk `position: static`, çerçeve altta yumuşak solma ile bitiyor.
  - Repository çerçevesi temel modda boş kalıyordu; yükseklik 26rem oldu. Gelişmiş mod altta soluyor.
  - Marquee'ye duraklat/başlat düğmesi eklendi (WCAG 2.2.2; `aria-pressed`, 44 px, TR/EN/DE etiket). Hareket kapalıyken düğme gizlenir. Yeni e2e testi klavyeyle duraklatıp yeniden başlatır.
- Dokümanlar: `.agents/frontend-design-rules.md` "Landing page" bölümü ve eski navbar/hikâye notu, `.agents/web-rules/WEB_SITE_MASTER_CHECKLIST_TR.md` içinde yalnız etkilenen dört kayıt (global kutular değişmedi).

## Değişen önemli dosyalar

Yeni: `frontend/src/features/landing/{reveal.tsx,use-landing-motion.ts}`, `frontend/src/features/landing/sections/{hero,tool-stack,features,feature-section,mode-toggle,marquee,cta-pair,final-cta}.tsx`, `frontend/src/features/landing/demo/{chat-demo,demo-root,hero-demo,lazy-demo,meeting-demo,organization-demo,repository-demo,task-demo}.tsx`.

Değişen: `frontend/src/features/landing/{landing-page.tsx,landing.module.css,open-source-scene.tsx,animation-progress.ts}`, `frontend/src/features/landing/demo/demo-data.ts`, `frontend/src/i18n/landing/{tr,en,de}.json`, `frontend/e2e/{landing-page,landing-real-ui,home-return}.spec.ts` (home-return: mobilde logo dönüşünden sonra giriş bağlantısı yerine menü düğmesi kontrol edilir), `.agents/frontend-design-rules.md`, `.agents/web-rules/WEB_SITE_MASTER_CHECKLIST_TR.md`.

Silinen: `frontend/src/features/landing/{product-story.tsx,product-demo.tsx}`, `frontend/src/features/landing/demo/{pda-demo-workspace.tsx,delivery-statuses.ts}`.

`app/page.tsx` (metadata, JSON-LD, `PDA_SESSION` yönlendirmesi), `globals.css`, güvenlik başlıkları, backend ve bağımlılıklar değişmedi.

## Çalıştırılan doğrulama komutları

`frontend/` içinde:

```powershell
npm run lint
npx tsc --noEmit
npm run build
npm run check:bundle
# next start -p 3100 (3000'deki geliştirme sunucusuna dokunulmadı)
$env:E2E_BASE_URL="http://localhost:3100"
npx playwright test --config playwright.public.config.ts e2e/landing-page.spec.ts e2e/landing-real-ui.spec.ts e2e/a11y-public.spec.ts e2e/public-scrollbars.spec.ts e2e/cookie-consent.spec.ts e2e/footer-public-pages.spec.ts e2e/ui-ux-public.spec.ts
$env:E2E_REUSE_AUTH="1"
npx playwright test --config playwright.config.ts e2e/home-return.spec.ts
```

## Test/doğrulama sonuçları

Hepsi `frontend/` içinde, `next start -p 3100` üzerinde (son build ile):

- `npm run lint`: 0 problem (ilk koşuda `landing-page.spec.ts:276` için `'key' assigned but never used` uyarısı çıktı; `toHaveText(tr[key])` ile düzeltildi).
- `npx tsc --noEmit`: exit 0.
- `npm run build`: exit 0.
- `npm run check:bundle`: exit 0, "All routes within budget" (`/` = 374.8 / 405 gzip KB).
- Public Playwright toplu koşusu (landing-page, landing-real-ui, a11y-public, public-scrollbars, cookie-consent, footer-public-pages, ui-ux-public): 268 passed (7.9 dk). Spec düzeltmesinden sonra `landing-page.spec.ts` yeniden koşuldu: 29 passed.
- `home-return.spec.ts` (`E2E_REUSE_AUTH=1`): 6 passed.

İlk koşuda bulunan ve düzeltilen hatalar:

- `cookie-consent.spec.ts`: "landing light 320x700: covered controls" (sticky header footer bağlantılarını örtüyordu). Düzeltme: `html:has(#landing-main)` için `scroll-padding-top: 5.5rem`.
- `ui-ux-public.spec.ts`: `/ (dark): en düşük metin kontrastı >= 4.5 -> 1.09 "Tek"` (test `color-mix()` kaynaklı `oklab()` rengini RGB sanıyor). Düzeltme: `.accentLine` doğrudan `var(--lp-accent)` kullanıyor; test değişmedi.
- Yük altında bir kez `keyboard: skip link...` ve `hover ve active` testleri başarısız oldu; yeniden koşuda geçti (klavye testi 8 tekrarda da geçti). Kök neden kanıtlanmadı.

Ekran görüntüleri (git dışı, `frontend/.playwright-mcp/`): `f390d-01..09.png`, `f390l-01..09.png`, `f1440d-01..09.png`, `f1440l-01..09.png` (sıra: üst, araç yığını, toplantı, sohbet, görev, repository, organizasyon, açık kaynak, footer). Mobil repository toast'u, 4 oda karosu, açık temada açık kaynak paneli (ters renkli koyu panel) ve footer bağlantılarının header altında kalmaması bu görüntülerde gözle kontrol edildi.

## Açık kalan konular ve doğrulanmayan sınırlar

- `web-design-guidelines` ve `impeccable` critique/audit/polish geçişleri ayrı bir pipeline olarak koşulmadı; inceleme ekran görüntüleri, tarayıcı ölçümü ve e2e ile yapıldı.
- Playwright testleri yalnız Chromium'da koştu; WebKit/Firefox, gerçek mobil cihaz, NVDA/VoiceOver ve gerçek klavye taraması yapılmadı. Erişilebilirlik genel taraması ve Erişilebilirlik Bildirimi ayrı iş olarak bekliyor.
- Ekran görüntüleri yalnız 390 ve 1440 px, açık ve koyu temada incelendi; 768/1024 px görsel olarak elle bakılmadı (taşma ve 44 px hedefler testle kapsandı).
- Yük altında `keyboard: skip link...` (landing-page.spec) ve `hover ve active` (ui-ux-public.spec) testleri ilk koşuda bir kez başarısız oldu, tek başına ve tekrar koşuda geçti; zamanlama kaynaklı olduğu düşünülüyor, kök neden kanıtlanmadı.
- `ui-ux-public.spec.ts` kontrast ölçerinin renk ayrıştırıcısı `oklab()/color()` hesaplanmış renkleri RGB sanıyor; `color-mix()` ile türetilmiş metin renkleri bu testte yanlış düşük kontrast verebilir. Test değiştirilmedi, hero vurgu rengi doğrudan token yapıldı.
- Tam backend/pre-push gate, production deployment ve canlı sunucu ölçümü (LCP/CLS) yapılmadı. Hukuki sayfalar ve analitik kapsam dışıdır. Commit/push yapılmadı.
- Geliştirme sırasında yanlışlıkla bir `git rm --cached` çalıştı ve hemen `git reset -q -- <dosya>` ile geri alındı; indeks değişikliği kalmadı. `npx playwright install chromium` ile yerel tarayıcı indirildi.

İnceleme turu sonrası (yeni build, `next start -p 3100`):

- `npx tsc --noEmit`, `npx eslint src/features/landing e2e/landing-page.spec.ts`: temiz.
- `npm run build` + `npm run check:bundle`: geçti, "All routes within budget".
- `playwright.public.config.ts` ile landing-page, landing-real-ui, home-return, a11y-public, ui-ux-public: 229 passed (6.2 dk).
- 1440 px açık temada toplantı, görev, repository ve marquee alanları yeniden ekran görüntüsüyle kontrol edildi.

## Kullanıcının manuel kontrol adımları

1. Kendi dev sunucunuzda `/tr/ana-sayfa` açın; açık ve koyu temada hero, araç yığını, beş özellik bölümü, CMD sahnesi ve footer'ı baştan sona kaydırarak izleyin.
2. Marquee'deki duraklat düğmesini, görev ve repository bölümlerindeki geçiş düğmelerini fare ve klavyeyle (Enter/Space) deneyin.
3. Telefon genişliğinde (390 px) menüyü açın, bir bağlantıya basın ve sayfada yatay kaydırma olmadığını kontrol edin; Tab ile footer bağlantılarına inin ve header altında kalmadıklarına bakın.
4. Sistem veya PDA ayarlarında hareketi kapatıp sayfanın statik ama tam okunur olduğunu doğrulayın.
5. TR/EN/DE metinlerini ve "Kayıt ol" bağlantılarının kayıt sayfasına gittiğini kontrol edin.


## Kullanıcı onaylı Git teslimi — 2026-10-28

Gönderim öncesi güncel main tabanındaki kaynaklarda `node node_modules/typescript/bin/tsc --noEmit --incremental false` exit 0 ve `playwright.public.config.ts` ile `localized sections, metadata and no backend requests` TR/EN/DE kontrolü **3/3 PASS** (12,2 sn). Bu son hedefli koşum `http://localhost:3000` geliştirme sunucusunda yapıldı; önceki geniş production doğrulamasının yerine geçtiği iddia edilmez. Son commit kapsamı/whitespace ve main'e salt Git birleşme provası da temizdi. Backend, ENV ve bağımlılık sözleşmesi değişmedi.

Landing çalışması, önceki frontend düzeltmelerini içeren güncel origin/main (c26d0c44bfb39c33430bcc260f60ebbe7928f557) tabanına üç yönlü uygulanarak general-features branch'ine ayrıldı. Ortak frontend/checklist belgelerinin önceki servis notları korundu. Kaynaklar önce Git dışındaki tmp/landing-commit/snapshot altında yedeklendi. Kullanıcı bu branch'e commit ve push için açık yetki verdi; main merge/release/deployment bu adımın kapsamında değildir. Commit mevcut Git kullanıcı kimliğiyle, ayrıntılı maddelerle ve ajan/co-author imzası olmadan hazırlanır.
