# Landing Product Story — gerçek PDA UI ve navbar logosu

**Durum:** Tamamlandı. **Tamamlanma tarihi:** 2026-10-04.

Bu teslim, [önceki landing tesliminin](2026-10-03-landing-page-scroll-story.md) iki düzeltmesini kapsar: Product Story içindeki taklit arayüzün gerçek PDA componentleriyle değiştirilmesi ve mevcut navbar logosunun büyütülmesi. Welcome, hikâye başlıkları, bölüm navigasyonu, CMD, teknoloji açılışı, final CTA ve footer tasarımları korunmuştur.

## Gerçek UI reuse

- `product-demo.tsx` içindeki alternatif sidebar/topbar, div tabanlı sahte form, özel üye satırları ve workflow rail kaldırıldı. İlgili landing CSS stilleri de kaldırıldı.
- `AppShell` içindeki sunum katmanı `AppShellView` olarak ayrıldı. Gerçek uygulama aynı view üzerinden çalışmaya devam eder; auth/session, logout, kullanıcı tercihleri ve API client’ları mevcut container’da kalır.
- Demo aynı `AppHeader`, `GlobalSearch`, `ProjectSidebarNav`, `TasksNavLink`, Logo, Phosphor ikonları, nav selected state ve 240px sidebar geometrisini kullanır.
- Proje sahnesi: gerçek `ProjectCreatePage` ve canlı `ProjectCard` önizlemesi; oluşturma sonrasında gerçek `ProjectDetail` / `ProjectOverview`.
- Ekip sahnesi: gerçek `TeamDetailPage` / `TeamMembersTable`, üyeler, rol rozetleri, arama ve filtre kontrolleri.
- Görev sahnesi: gerçek `TaskFormBody`, `AssigneePicker`, `TaskPreview` ve ortak input/button/form section bileşenleri. Formlara optional `presentationValues` eklendi; normal uygulamadaki varsayılan davranış korunur.
- Görev oluşturma/teslim: gerçek `TasksPage`, `TaskFilterBar`, `TaskRow` ve status bileşenleri. Akış gerçek `TASK_STATUSES` kaynağından `TODO → IN_PROGRESS → IN_REVIEW → TESTING → DONE` olarak gelir.

## Demo verisi ve viewport

`features/landing/demo/demo-data.ts` tipli, yerel proje/ekip/üye/görev verilerini sağlar. `LandingPdaDemoProvider` ayrı TanStack Query client’ında bu verileri query sözleşmelerine bağlar; sorgular disabled, query fonksiyonları kapalı ve mutation fonksiyonları reddedilir. Demo backend’e veri yazmaz veya gerçek kullanıcı oturumu oluşturmaz.

GSAP story progress gerçek form değerlerini, üye görünürlüğünü, atama seçimini ve görev status cache’ini yönetir. Kamera formun gerçek `scrollTop` değerini kullanır; yapışkan aksiyonlar ve önizleme kartı korunur. Dört dış hikâye adımı, bölüm linkleri, desktop sticky, reduced-motion ve normal akış fallback’i sürer.

Demo salt okunur bir uygulama görüntüsüdür (`inert`, aria-hidden içerik); kontroller landing’in klavye sırasına girmez ve Ctrl+K kısayolunu yakalamaz. Ortak üst barın auto-hide davranışı yalnız bu gösterimde kapalıdır.

`globals.css` içindeki mevcut Titanium token bloğu `.workspace-preview` ile paylaşılır. Yeni renk paleti kopyası yoktur; **hiçbir global custom-property değeri değiştirilmemiştir**. `.app-shell` landing kökünde kullanılmaz; landing kendi mevcut paletinde kalır. CSS contain ve orantılı viewport ölçeği fixed uygulama navbar’ını gösterimin içinde tutar. İframe/public demo rotası eklenmedi; güvenlik başlıkları değişmedi.

## Navbar logosu

Mevcut Logo ve aynı marka assetleri kullanıldı. Render genişliği desktop **110px**, tablet **90px**, mobile **70px** oldu. Desktop header 88px, mobile header 76px minimum yüksekliğini korur; aspect ratio, dikey hizalama ve asset seçimi değişmedi. 320px’de yatay taşma engellendi; 1440px ve 1920px’de logo ayrıca doğrulandı.

## Önemli dosyalar

- [Demo viewport](../../frontend/src/features/landing/product-demo.tsx), [story progress](../../frontend/src/features/landing/product-story.tsx), [gerçek ekran adapter’i](../../frontend/src/features/landing/demo/pda-demo-workspace.tsx), [yerel provider](../../frontend/src/features/landing/demo/landing-pda-demo-provider.tsx), [demo data](../../frontend/src/features/landing/demo/demo-data.ts).
- [Ortak uygulama kabuğu](../../frontend/src/components/layout/app-shell.tsx), [üst bar](../../frontend/src/components/layout/app-header.tsx), [sidebar](../../frontend/src/components/layout/project-sidebar-nav.tsx), [arama](../../frontend/src/components/layout/global-search.tsx), [auto-hide](../../frontend/src/components/layout/use-auto-hide.ts).
- [Proje formu](../../frontend/src/features/projects/components/project-create-page.tsx), [görev formu](../../frontend/src/features/tasks/components/task-form-page.tsx), [ortak tema scope’u](../../frontend/src/app/globals.css), [landing stilleri](../../frontend/src/features/landing/landing.module.css).
- [Görsel karşılaştırma testleri](../../frontend/e2e/landing-real-ui.spec.ts), [landing testleri](../../frontend/e2e/landing-page.spec.ts), [public test config](../../frontend/playwright.public.config.ts).
- `.agents/folder-structure.md`, `.agents/frontend-design-rules.md`, `.agents/web-rules/WEB_SITE_MASTER_CHECKLIST_TR.md`: yalnız etkilenen standardın notları güncellendi; proje genelindeki eksik maddeler tamamlanmış işaretlenmedi.

## Doğrulama

Frontend dizininde:

| Komut | Sonuç |
| --- | --- |
| `node node_modules/typescript/bin/tsc --noEmit` | Başarılı. Son production build’in TypeScript aşaması da başarılı. |
| `npm.cmd run lint` | Başarılı; hata veya warning yok. |
| `npm.cmd run build` | Son değişikliklerle başarılı. |
| `npx.cmd playwright test --config playwright.public.config.ts` | Footer/hata kapsamındaki 28 kontrol başarılı. Son kamera düzeltmesinden önce 49/51; kalan iki kontrol sonraki landing tekrarında geçti. |
| `npx.cmd playwright test --config playwright.public.config.ts landing-page.spec.ts landing-real-ui.spec.ts` | **Son kodla 23/23 başarılı.** Toplam doğrulanan kapsam: 28 public + 23 landing = 51 farklı kontrol. |
| `node tmp/landing-qa/corrective-production-qa.cjs http://localhost:3003` | Son production build’de 1440/1920/390px, light/dark başarılı; yatay taşma, API isteği, console error ve hydration warning yok. Global token değerleri HEAD ile aynı. |
| `git -c core.safecrlf=false -c core.whitespace=cr-at-eol diff --check -- <değişen dosyalar>` | Etkilenen kapsamda başarılı; repository ayarı değiştirilmedi. |

Playwright gerçek korumalı `/projects/new`, proje overview, ekip detayı, görev oluşturma ve görev listesi rotalarını statik HTTP/WebSocket fixture’larıyla açtı. Aynı veriyle landing counterpart’ı karşılaştırıldı. Sidebar, header, search input, account/button, selected nav, h1, form input/label/textarea/button, üye tablosu ve task row için computed style ölçüleri eşleşti. Atama adımında gerçek iç scroll ve viewport içinde kalan sticky submit ayrıca test edildi.

Gerçek route ve demo screenshot’ları yan yana incelendi; belirgin layout/stil farkı kalmadı. Görseller `tmp/landing-qa/compare-{light,dark}-{project,team,delivery,project-form,task-form}.png`; production görüntüleri `production-*.png`, production raporu `corrective-production-qa.json` altındadır. Bu geçici QA çıktıları git dışında tutulur. Fixture referansı gerçek component/route görünümünü doğrular; canlı kullanıcı verisi veya backend mutation testi yapılmadı.

Geçici production QA sunucuları kapatıldı. Mevcut 3000 portundaki development sunucusuna dokunulmadı. Git add/commit/push veya dış yayın yapılmadı.

## Açık konular

Bu iki düzeltme kapsamında açık teknik konu yok. Proje genelindeki responsive/erişilebilirlik checklist maddeleri, yalnız landing doğrulandı diye kapatılmadı.

## Kullanıcı kontrolü

1. Oturumsuz `/` sayfasını 1440px ve 1920px’de aç; aynı logonun daha okunur olduğunu ve navbar yüksekliğinin korunmasını kontrol et.
2. Product Story’yi ileri/geri kaydır: gerçek proje formu/overview, ekip tablosu, görev formu/atama ve gerçek görev listesinde status değişimini gör.
3. Atama bölümünde önizleme kartının ve “Görevi oluştur” aksiyonunun görünmesini kontrol et. Demo butonları veri yazmaz.
4. Light/dark temaları, 390px mobile ve reduced motion ile dene; dış landing tasarımının korunduğunu doğrula.
5. `tmp/landing-qa/compare-*.png` yan yana görüntülerini incele; gerçek çalışma ekranınla marka/sidebar/üst bar/form/tablo görünümünü karşılaştır.
