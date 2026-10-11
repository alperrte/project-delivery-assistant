# Performans ve teknik kalite (2026-10-11)

Kapsam: `Web_Sitesi_Master_Checklist.md` bölüm 10 (13 madde). Dal: `auth-service-frontend`. Commit/push yapılmadı; kullanıcı kendi testlerini çalıştırır (Playwright, `mvn test`, pre-push ve Docker bu görevde çalıştırılmadı).

## Ölçüm yöntemi

- `npm run build` ardından `next start -p 3100` (dev sunucusu :3000'e dokunulmadı; Next 16 dev çıktısı `.next/dev` altında olduğu için çakışma olmadı).
- Lighthouse 12, yerel Chrome, mobil preset (simüle Slow 4G + 4x CPU), sayfa başına tek koşu, çerez banner'ı açık (temiz profil). Tek koşu olduğundan skorlar ±5 puan oynayabilir; yön ve büyüklük sıralaması günceldir.
- JS boyutu: `.next/server/app/**/page_client-reference-manifest.js` ve `build-manifest.json` üzerinden rota başına ilk yükleme istemci JS'i (gzip). `nomodule` polyfill dosyası (38,7 KB gz) modern tarayıcılar indirmediği için sayılmaz; "önce" değerleri bu yüzden ilk ölçümden 38,7 KB çıkarılmış hâldedir.

## Önce / sonra: Lighthouse (mobil)

| Sayfa | Skor önce → sonra | LCP önce → sonra | CLS | TBT önce → sonra | FCP önce → sonra | Transfer önce → sonra |
| --- | --- | --- | --- | --- | --- | --- |
| `/tr/ana-sayfa` | 47 → 60 | 9,9 s → 6,1 s | 0 → 0 | 1230 ms → 630 ms | 1,8 s → 1,8 s | 1209 KiB → 1094 KiB |
| `/tr/giris` | 68 → 74 | 8,4 s → 7,1 s | 0 → 0 | 240 ms → 120 ms | 2,2 s → 1,9 s | 1179 KiB → 907 KiB |
| `/tr/hakkimizda` | 96 → 99 | 1,7 s → 1,7 s | 0 → 0 | 180 ms → 60 ms | 1,7 s → 1,7 s | 713 KiB → 636 KiB |
| `/tr/kayit` | 66 → 70 | 8,2 s → 7,3 s | 0 → 0 | 300 ms → 220 ms | 2,2 s → 2,0 s | 1133 KiB → 866 KiB |

LCP bulgusu: ana sayfa, giriş ve kayıtta LCP öğesi arka plan görseli veya başlık değil, `section.fixed > p` yani **çerez banner'ının paragrafıdır**; "element render delay" (6-7 sn) hydration bitene kadar banner'ın çizilmemesidir (TTFB 20-90 ms). Yani bu sayfalarda LCP'yi asıl belirleyen istemci JS'inin hydrate süresidir (ve banner'ın istemcide çizilmesi). `/hakkimizda`da LCP öğesi sayfa içeriğinden, sunucuda çizilen bir paragraftır (1,7 s). Takip: banner'ı sunucuda çizmek veya LCP'ye girmeyecek biçimde konumlamak (davranış değişikliği olduğundan bu görevde yapılmadı).

## Önce / sonra: rota başına ilk yükleme JS'i (gzip KB)

| Rota | Önce | Sonra |
| --- | --- | --- |
| `/` (landing) | 688,2 (ham ~1,95 MB) | **364,9** |
| `/login` | 485,3 | 488,5 |
| `/register` | 484,3 | 487,5 |
| `/about` | 353,3 | 356,5 |
| `/dashboard` | 477,9 | 471,8 |
| `/tasks` | 620,6 | 615,7 |
| `/projects/[slug]` | 633,9 | 627,9 |

Landing 323 KB (%47) küçüldü; hedef 350 KB'a 15 KB kala. `/about` değerinin ~3 KB artması paylaşılan parça yeniden bölünmesinden (ölçüm gürültüsü sınırı). Paylaşılan çekirdek (~350 KB: React DOM, Next istemcisi, next-intl, motion, TanStack Query, base-ui, sonner, tema/rıza/analitik sağlayıcıları) landing'in ve her sayfanın tabanıdır; bunun altına inmek için `npm run analyze` / `npx next experimental-analyze` ile çekirdek incelenmeli (takip).

HTML yükü: `/tr/hakkimizda` ham HTML 289.787 B → 232.089 B (tam i18n kataloğu her sayfaya serileştiriliyordu, bkz. madde 6).

## Önce / sonra: varlık boyutları

| Dosya | Önce | Sonra |
| --- | --- | --- |
| `images/background/bg-dark` | 1,77 MB PNG | 115 KB WebP |
| `images/background/bg-light` | 1,69 MB PNG | 109 KB WebP |
| `images/branding/yazi-light` (2172x724) | 1,41 MB PNG | 88 KB WebP (1000x333, alfa) |
| `images/branding/yazi-dark` (1672x941) | 0,89 MB PNG | 92 KB WebP (1000x563, alfa) |
| `images/branding/icon.png` (768²) | 658 KB | 115 KB (256², kayıpsız) |
| `images/branding/og-image.png` | 521 KB | 128 KB (1200x630 palet PNG, aynı URL) |
| `images/branding/pda-full.png` (JSON-LD) | 1,45 MB | silindi → `pda-logo-512.png` 78 KB |
| `images/branding/yazı.jpeg` | 139 KB (kullanılmıyordu) | silindi |
| `icons/icon-512.png` / `icon-192.png` | 418 / 66 KB | 87 / 18 KB (kayıpsız) |
| `app/icon.png` / `app/apple-icon.png` | 98 / 58 KB | 28 / 16 KB (kayıpsız) |

Görsel doğrulama: arka planlar PSNR 38,5 dB, wordmark'lar 37,6-38,1 dB (orijinal ile); kırpılmış yan yana karşılaştırmada fark görülmüyor; giriş sayfası 1440x900 açık ve koyu ekran görüntüleri incelendi (neon şeritler, wordmark kenar çizgisi korunuyor). Ağ üzerinde `next/image` AVIF üretiyor (örn. bg-dark w=1672 q=95 → 71 KB AVIF).

## 13 madde: durum

Kural: her madde yapılandırma, kod veya ölçümle kanıtlanır.

| # | Madde | Durum | Kanıt / gerekçe |
| --- | --- | --- | --- |
| 1 | Core Web Vitals | Kısmi | Laboratuvar ölçümü (LCP/CLS/TBT/FCP) Lighthouse ile alındı, CLS 0. Geliştirmede `useReportWebVitals` → `console.debug` (`features/analytics/web-vitals-debug.tsx`, prod'a girmez). Alan (field) raporlaması için rıza-bağlı `WEB_VITAL` olay tipi + Flyway migration + DTO + retention + admin bloğu gerekir; saatlik işi aşar ve backend yeniden derleme/test gerektirir → takip. |
| 2 | Lighthouse analizi | Tamam | 4 sayfa, mobil preset, önce/sonra tablosu yukarıda; LCP öğesi ve yeniden harcanan süre analiz edildi. CI'da otomatik Lighthouse yok (takip: Lighthouse CI). |
| 3 | Görsel sıkıştırma ve format | Tamam | Tablo yukarıda; `images.formats = [avif, webp]`, `minimumCacheTTL` 31 gün; ölçüm: AVIF çıktısı. |
| 4 | Lazy loading | Tamam | Ham `<img>`ler `loading="lazy" decoding="async"` (entity-cover, entity-mark, person-avatar; avatar/tech-logo zaten vardı); auth arka planları `fetchPriority="low"`; wordmark `priority` (çift preload) kaldırıldı; landing demosu IntersectionObserver ile yüklenir. Not: tema başına iki dosyada aktif tema sunucuda bilinmediği için ikisi eager kalır (boş kare garantisi korunur); tek temayı yüklemek için tema bilgisi CSS-dışı gerekir. |
| 5 | Font optimizasyonu | Kısmi | `next/font/google` ile kendi origin'imizden, `display: swap`, latin + latin-ext alt kümeleri, değişken ağırlık; `preload:false` bırakıldı. Ölçüm: LCP öğesi Inter ile yazılan banner paragrafı, başlık fontu (Exo 2) LCP'de değil; Exo 2'yi preload etmek LCP'yi iyileştirmez, bu yüzden değiştirilmedi. Takip: gövde fontu (Inter latin) preload denemesi ölçülebilir. |
| 6 | Gereksiz kodun azaltılması | Kısmi | Landing −323 KB gz (demo ayrımı); kök layout i18n yükü: `publicPages` + `brand` istemci sağlayıcısından çıkarıldı (HTML 289→232 KB). Kullanılmayan `Logo variant="full"` ve görseller silindi. Paylaşılan çekirdek (~350 KB) ve rota-grubu bazlı i18n bölme yapılmadı (landing gerçek uygulama bileşenlerini kullandığı için güvenli bir mekanik bölme yok) → analizör ile takip. |
| 7 | Code splitting | Tamam | `next/dynamic`: landing demo (`product-demo.tsx`), sohbet dock/panel (`chat-root.tsx`), QR (`authenticator-qr.tsx`). Tema geçiş overlay'i bölünmedi: `motion` çekirdekte zaten var, overlay kodu ~1 KB, ilk geçişte gecikme riski kazancı aşıyor. Ölçüm: landing 688 → 365 KB. |
| 8 | Cache stratejisi | Tamam | `next.config.ts` `headers()`: `/images`, `/icons` → `max-age=86400, stale-while-revalidate=604800` (curl ile doğrulandı); `/_next/static` Next'ten `immutable` (doğrulandı); `/_next/image` 31 gün; backend `server.compression` (yalnız derlendi, çalışma zamanı doğrulanmadı, backend yeniden başlatılmadı). Politika `architecture.md`'de. |
| 9 | Yavaş ağ testleri | Kısmi | `e2e/slow-network.spec.ts` yazıldı (CDP Slow 4G + 4x CPU, `/` ve `/login`, ana başlık bütçesi + konsol hatası yok; `SLOW_NET=1` ile açılır; tsc geçti, KOŞULMADI). Lighthouse mobil preset de Slow 4G simülasyonudur (ölçüm). `dashboard/tasks/organizations` için `loading.tsx` eklendi. |
| 10 | Bundle boyutu takibi | Tamam | `scripts/check-bundle-size.mjs` + `bundle-budgets.json` (ölçülen + ~%10), `npm run check:bundle`; `@next/bundle-analyzer` + `npm run analyze`; pre-push'ta yalnız uyarı. Son build'de çalıştırıldı: tüm rotalar bütçe içinde. `npm run analyze` çalıştırılmadı (webpack build `.next`'i değiştirir; Turbopack için `next experimental-analyze` alternatifi). |
| 11 | API timeout / retry | Tamam | `client.ts`: 15 sn (yükleme 60 sn) zaman aşımı, `AbortSignal.any` + yedek, `ApiError(0,"timeout")`, `errors.timeout` TR/EN/DE; React Query GET: ağ/502/503/504'te 2 deneme, 0,5/1 sn gecikme; 4xx ve mutation asla; backend `GitHubOAuth2UserService` RestClient 5 sn. Kalan: `DefaultOAuth2UserService` ve token-takas istemcilerinin zaman aşımı (takip). |
| 12 | Responsive görseller | Tamam | `deviceSizes [640,828,1200,1672]`, `imageSizes [32..384]`; `sizes` (`100vw` arka plan, wordmark px, takım fotoğrafı `112px`); AVIF/WebP. Yetkili API görselleri `next/image` ile proxy'lenemez (ham `<img>`, lazy) — gerekçeli. |
| 13 | Kaynak haritası ve debug yönetimi | Tamam | `productionBrowserSourceMaps:false` (build'de `.map` = 0), `console.error` yaması prod'da kapalı, backend `server.error.include-*=never`, `management.endpoints.web.exposure.include=health`, `robots.ts` `/_next/` engeli kaldırıldı. `APP_ENV` varsayılanı DEĞİŞTİRİLMEDİ: repoda `application-dev*`/`@Profile` yok, `dev` bugün davranışsız; risk ve öneri `deployment.md`'de. |

## Yapılanlar (dosya özeti)

- Frontend yapılandırma: `next.config.ts` (images, headers, source map, analyzer), `package.json`/`package-lock.json` (`@next/bundle-analyzer`, scriptler), `scripts/check-bundle-size.mjs`, `scripts/analyze.mjs`, `bundle-budgets.json`, `pre-push/pre-push.ps1` (uyarı adımı).
- Görseller: yukarıdaki tablo; `components/common/logo.tsx` (yeni dosya adları/ölçekli kutular, `full` varyantı kaldırıldı, wordmark eager/preload'sız), `components/layout/auth-shell.tsx`, `lib/seo/json-ld.tsx`.
- Yükleme/split: `entity-cover.tsx`, `entity-mark.tsx`, `person-avatar.tsx`, `about-page.tsx`, `product-demo.tsx`, `demo/pda-demo-workspace.tsx`, `demo/delivery-statuses.ts`, `chat-root.tsx`, `authenticator-qr.tsx`.
- i18n: `i18n/client-messages.ts`, `app/layout.tsx`; `errors.timeout` anahtarı TR/EN/DE (yalnız tek satır eklendi).
- API: `lib/api/client.ts`, `lib/api/error-message.ts`, `lib/api/query-retry.ts`, `components/providers.tsx`.
- Diğer: `app/robots.ts`, `app/(app)/{dashboard,tasks,organizations}/loading.tsx`, `features/analytics/web-vitals-debug.tsx`, `e2e/slow-network.spec.ts`.
- Backend: `application.properties` (compression, error, actuator), `GitHubOAuth2UserService.java` (zaman aşımı).
- Belgeler: `.agents/{architecture,frontend-design-rules,folder-structure,deployment,SECURITY}.md`.

## Doğrulama

`npm run build` (iki kez), `npx tsc --noEmit` temiz, `npm run lint` 0 hata (2 eski uyarı e2e dosyalarında), `backend\mvnw.cmd -q -DskipTests compile` temiz, `npm run check:bundle` tüm rotalar bütçe içinde, `git diff --check` temiz. Playwright, `mvn test`, pre-push ve Docker KOŞULMADI.

## Yapılmayanlar ve nedenleri

- Alan (field) Web Vitals raporlaması (backend olay tipi, migration, admin bloğu): kapsam ve gizlilik/aydınlatma metni etkisi büyük; yalnız geliştirme konsolu yapıldı.
- Rota-grubu bazlı i18n bölme ve paylaşılan çekirdeğin küçültülmesi: landing gerçek uygulama bileşenlerini kullandığı için mekanik/güvenli değil; sunucu-yalnız namespace'ler çıkarıldı.
- Tema başına yalnız aktif arka planı yükleme: aktif tema sunucuda bilinmez; boş kare garantisini bozmamak için ikisi de düşük öncelikli eager.
- Font preload: ölçüm LCP kazancı göstermedi (LCP öğesi Exo 2 değil).
- Tema overlay lazy: kazanç ~1 KB, ilk geçişte gecikme riski.
- `npm run analyze`, yavaş ağ spec'i, backend sıkıştırma çalışma zamanı doğrulaması: kullanıcı kuralı gereği koşulmadı.

## Riskler / test edilirken dikkat

- Landing demosu artık yaklaşınca yükleniyor: `[data-pda-demo-stage]` bekleyen e2e testleri (`landing-page.spec.ts`, `landing-real-ui.spec.ts`) öğeye kaydırmadan önce sorguluyorsa zaman aşımına düşebilir (tarayıcıda elle doğrulandı: yüklemede 0, `#product`'a kaydırınca 4 sahne).
- QR kodu ve sohbet paneli geç yükleniyor: 2FA ve sohbet testleri QR/panele anında erişiyorsa bekleme gerekebilir.
- GET sorgularında ağ hatası artık ~1,5 sn sonra görünür (2 yeniden deneme); testler ağ hatasını anında bekliyorsa etkilenebilir.
- Yeni `loading.tsx` dosyaları kısa bir iskelet gösterir.
- Tüm sayfalar yeni `webp` dosyalarına bağlandı; eski `.png` URL'leri artık yok (başka yerden referans yoktu, grep ile doğrulandı).

## Önerilen takipler

1. Çerez banner'ını sunucuda çizmek / LCP'den çıkarmak (giriş/kayıt/landing LCP'sinin hydration'a bağlılığı kalkar; kazanç ölçülmeli).
2. Paylaşılan JS çekirdeğini `npx next experimental-analyze` ile incele (hedef landing < 350 KB; sonner/tooltip/motion tembel yükleme adayları).
3. `WEB_VITAL` olayı + migration + admin bloğu (rıza bağlı, rota şablonu, yuvarlanmış değer, oturum başına sınır, retention).
4. Lighthouse CI veya sabit bir haftalık ölçüm; `SLOW_NET=1` spec'ini kullanıcı koşsun.
5. `APP_ENV` varsayılanını `prod`'a çevirme veya üretimde zorunlu kılma.
6. `DefaultOAuth2UserService` ve OAuth token takasına zaman aşımı.
