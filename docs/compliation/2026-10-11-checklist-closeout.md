# Web Sitesi Master Checklist kapanış turu (2026-10-11)

Kapsam: `.agents/faz-md/Web_Sitesi_Master_Checklist.md` içindeki 62 açık maddenin koddan doğrulanması, eksiklerin tamamlanması ve tiklenmesi. Dal: `general-features`. Commit/push yapılmadı. Mail gönderilmedi: backend `docker-compose.e2e.yml` override'ıyla (Mailpit) çalıştı, CI'da `MAIL_ENABLED=false`.

Sonuç: **62 açık madde → 12** (ilk teslimde 19'du; ikinci turda 7 madde daha kapandı). 50 madde tiklendi veya karara bağlandı; 12 madde gerekçesiyle açık (aşağıda).

## Yapılan kod değişiklikleri (kullanıcı onayıyla)

| Alan | Değişiklik |
| --- | --- |
| CSP | `frontend/src/proxy.ts` her sayfa yanıtına istek başına nonce'lu CSP ekler (`frontend/src/lib/security/csp.ts`); nonce `app/layout.tsx` ve `components/providers.tsx` (next-themes) içine iner. `upgrade-insecure-requests` yalnız `NEXT_PUBLIC_SITE_URL` https ise eklenir (aksi halde WebKit'te ve http kurulumlarda sayfayı kırıyordu). Zod `jitless` (`zod/v4/core` hafif import) |
| HSTS / başlıklar | `next.config.ts`: production'da `Strict-Transport-Security`. Backend `SecurityBaselineConfiguration`: API yanıtlarına `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'` ve `Referrer-Policy: no-referrer` (Swagger açıkken CSP eklenmez); `SecurityBaselineTest` başlık testi (`API_DOCS_ENABLED=false` sabitlendi) |
| Service worker | `public/sw.js`, `public/offline.html`, `components/service-worker-registration.tsx`, `/sw.js` başlıkları |
| Çeviri fallback | `i18n/request.ts`: seçili dil TR kataloğunun üstüne birleştirilir |
| LCP | Çerez banner'ı sunucuda çizilir, kararı olan ziyaretçide `<head>` betiğiyle (`CONSENT_BOOT_SCRIPT`) ilk boyamadan önce gizlenir; düğmeler hydration'a kadar devre dışı; Inter fontu preload. A/B ölçüm: landing LCP 6,3 → 2,0 sn, giriş 7,3 → 2,1 sn |
| Kontrast | Koyu temada `auth-cta` düğmelerinde (landing/üstbilgi) metin rengi (`text-(--auth-cta-ink)`); auth kartı yardımcı metni `--auth-muted` açık `#363f4b`, koyu `#c0c8d3` |
| Testler/araçlar | `e2e/csp-signed-in.spec.ts`, `e2e/a11y-signed-in.spec.ts`, `scripts/check-site.mjs` (`npm run check:site`), `playwright.public.config.ts` (isteğe bağlı Firefox/WebKit: `E2E_CROSS_BROWSER=1`) |
| CI / bağımlılık | `.github/workflows/ci.yml`, `.github/dependabot.yml` |
| Yedekleme | `ops/backup.ps1`, `ops/restore.ps1` |
| Belgeler | `.agents/operations.md` (yeni), `SECURITY.md` §15, `architecture.md`, `deployment.md`, `folder-structure.md`, `AGENTS.md` rota satırı |

Yeni ortam değişkeni yok; `.env`/`.env.example` değişmedi (pre-push yalnız okur). Yeni genel endpoint yok. Kimlik doğrulama/yetki mantığı değişmedi. CSP nedeniyle `NEXT_PUBLIC_API_URL` ve (https için) `NEXT_PUBLIC_SITE_URL` frontend derlenmeden önce tanımlı olmalıdır.

Çalıştırma ortamı notu: yığın kullanıcı onayıyla `docker compose down -v` ile sıfırlandı (eski DB Flyway geçmişi V1–V71, 59 kayıt; yeni sürüm V1–V40 ister) ve güncel kodla Mailpit override'ıyla yeniden kuruldu (40 migration, sağlıklı).

## Doğrulamalar ve sonuçlar

| Doğrulama | Sonuç |
| --- | --- |
| **pre-push** (`pre-push.cmd`) | Git/Docker/PostgreSQL kontrolleri geçti; **Backend `mvnw clean verify`: 897 test, 0 hata/atlanan, BUILD SUCCESS** (ilk koşuda yalnız benim eklediğim başlık testi, `.env`'deki `API_DOCS_ENABLED=true` yüzünden düştü; test ortamdan bağımsızlaştırıldı); **ESLint 0 hata** (2 eski uyarı), **tsc temiz**, **production build**, bundle bütçeleri tamam; **Playwright E2E: 1036 testten 1005 geçti, 22 atlandı, 6 başarısız → gate "FAILED"**. Sonraki Docker yığın adımına gelinmedi (yığın override ile zaten bu kodla derlenmişti) |
| 6 başarısız E2E | Hiçbiri değişikliklerimden kaynaklanmıyor, temiz HEAD (git worktree'de ayrı build) ile karşılaştırıldı: `legal-pages` 4 test (dil çerezi + yönlendirme yarışı) HEAD'de de 4 koşunun 2'sinde düşüyor; `project-logo-settings.spec.ts:45` HEAD'de de her koşuda düşüyor (sohbet çubuğu ile "kaydedilmemiş değişiklik" çubuğu 6 px çakışıyor); `team-deletion-notifications.spec.ts:117` hem HEAD'de hem benim build'imde tek başına 3/3 geçiyor (pakette sıra/kararsızlık). Bu hatalar düzeltilmedi |
| Oturumlu CSP | `csp-signed-in.spec.ts`: gerçek backend ile proje, görevler, pano, takvim, hesap, ayarlar, davetler, sohbet WebSocket'i: CSP ihlali 0 |
| Erişilebilirlik | `a11y-public.spec.ts` (axe, 180 durum) 180/180; `a11y-signed-in.spec.ts` (13 ekran × 2 tema × 2 genişlik axe 0 ihlal, ≥24 px hedef boyutu, Tab gezintisi) geçti; Lighthouse erişilebilirlik/en iyi uygulamalar/SEO 100 |
| Kontrast (piksel) | Axe'in karar veremediği düğümler piksel örneklemesiyle ölçüldü; 2 gerçek sorun bulunup giderildi; ikon-yalnız 24 kontrol ≥3:1 |
| Performans | Lighthouse (uygulanan Slow 4G + 4x CPU): LCP 1,9-2,1 sn, CLS 0, FCP 1,4-2,1 sn, TBT 40-400 ms, skor 87-98; simülasyonlu (Lantern) skor 73-82 daha kötümser. `slow-network.spec.ts` 2/2 |
| Tarayıcılar | Chromium + Firefox 155 + WebKit: herkese açık paket 392 testten 327 geçti; kalan hatalar test düzeneğinden (WebKit `route.fulfill` CORS mock'u, Tab-ile-bağlantı varsayılanı, Firefox scrollbar hesaplanan değeri); gerçek iletişim formu akışı WebKit ve Firefox'ta çalıştı. Bulunup giderilen gerçek hatalar: WebKit'te `upgrade-insecure-requests`, banner'ın hydration öncesi tıklaması |
| Service worker | Kayıt, çevrimdışı sayfa, `CACHE_VERSION` v1→v2 eski önbellek temizliği tarayıcıda doğrulandı |
| Site taraması | `check:site`: 36 sayfa, 729 bağlantı, kırık bağlantı ve metadata eksiği yok |
| Yedekleme | `backup.ps1` + `restore.ps1` çalışan yığında başarılı (geçici DB'ye açıldı, silindi) |
| Bağımlılık | `npm audit --omit=dev` 0; tam ağaçta 5 high (bilinen ESLint/braces geliştirme zinciri) |

Koşulmayanlar: pre-push'un son "Docker stack build + start" adımı; `mvn` dışı bağımlılık taraması; gerçek NVDA/mobil cihaz.

## Açık kalan 19 madde ve neden

| Madde | Neden / sonraki adım |
| --- | --- |
| Yurt dışına veri aktarımı, GDPR ve yurt dışı yükümlülükleri | Metinler mevcut ve "güvence tamamlandı" demiyor; standart sözleşme / Kurul bildirimi / AB temsilcisi veri sorumlularının kararı |
| Ekran okuyucu desteği, Manuel erişilebilirlik testleri, Klavye ve ekran okuyucu testi | Gerçek NVDA/VoiceOver gerekir |
| Gerçek mobil test | Gerçek iOS/Android cihaz gerekir |
| Otomatik hareketi durdurma | Landing/auth'ta sonsuz dekoratif animasyonlar var (`slogan-sheen`, `pda-orbit`, `neon-sweep`); kullanıcının kararıyla footer duraklatma kontrolü kaldırılmıştı. Çözüm: kontrolü geri koymak ya da animasyonları sonlu yapmak ya da maddeyi "Eklenmeyecek" saymak |
| Gereksiz kodun azaltılması | Paylaşılan çekirdek ~350 KB gz; en büyük parça zod (~88 KB, form sayfaları). `optimizePackageImports` denendi, etkisi yok. Anlamlı kazanç form şemalarını tembel yüklemeyi gerektirir |
| Google Search Console, HTTPS ve yönlendirme, TLS ve HSTS, Mixed Content, Production env, Monitoring/alarm, Sertifika/domain, Deployment smoke test | Production hosting/domain henüz yok |
| CI/CD, Güvenlik güncellemeleri, Bağımlılık taraması | Dosyalar hazır; GitHub'da `main`'e birleşip ilk çalışma/PR'lar görülmeden tiklenmedi |

## Kullanıcının manuel kontrol etmesi gerekenler

1. Pre-push'taki 6 E2E hatasını inceleyin (yukarıdaki tablo): özellikle `project-logo-settings.spec.ts:45` (6 px çakışma) ve `legal-pages` dil testlerinin yarışı; ikisi de bu turdan önce var.
2. Değişiklikleri birleştirdikten sonra GitHub'da Actions ve Dependabot'un çalıştığını doğrulayın.
3. Hosting/domain seçilince `.agents/operations.md` §6-§7 listesini uygulayın.
4. Landing/auth'ta yeni düğme ve yardımcı metin renklerini (koyu temada beyaz düğme metni, biraz koyulaşan açık tema yardımcı metni) gözle onaylayın.


## İkinci tur (aynı gün): kalan maddeler

Kullanıcı kararlarıyla: animasyon maddesi "Eklenmeyecek", gereksiz kod maddesi "kabul edildi", NVDA otomasyonu onaylandı, hosting için Caddy'li production bileşimi seçildi.

| Yapılan | Sonuç |
| --- | --- |
| Tarayıcılar | Chrome (marka), Edge ve Opera 137 (winget ile kuruldu) `playwright.public.config.ts`'e eklendi. Chrome ve Edge'de tüm testler geçti; Opera 195 geçti (1 test düzeneği sınırı). `legal-pages` ve `cookie-consent` testlerindeki gerçek yarışlar (önceki turda "önceden var olan" dediğim) giderildi: dil çerezi değiştirilmeden önce `networkidle` bekleniyor, banner düğmesi için `toBeEnabled` |
| Production bileşimi | `docker-compose.prod.yml` + `ops/Caddyfile` (otomatik HTTPS, tek origin, WebSocket) + `ops/smoke-test.mjs`; yerel Caddy CA'sında **25/25 PASS**; tarayıcıda 8 sayfa karışık içerik/CSP ihlali 0; iletişim formu Caddy üzerinden CSRF ile çalıştı |
| Bu yığında bulunup giderilen gerçek hatalar | (1) `next.config.ts` devDependency olan `@next/bundle-analyzer`'ı statik import ediyordu: production imajında frontend açılışta çöküyordu; artık yalnız `ANALYZE=1` iken yüklenir. (2) `X-Powered-By: Next.js` sızıyordu (`poweredByHeader: false`). (3) `NEXT_LOCALE` çerezi https'te `Secure` değildi (proxy ve istemci). (4) `frontend/Dockerfile` `NEXT_PUBLIC_SITE_URL` argümanını almıyordu |
| Bağımlılık taraması | Trivy (Docker): Maven 0, npm üretim 0 HIGH/CRITICAL; `npm audit --omit=dev` 0. Komutlar `.agents/operations.md` §5 |
| İzleme/alarm | `.github/workflows/uptime.yml` (30 dakikada smoke test + sertifika süresi; günlük alan adı süresi); GitHub'da çalıştırılmadı |
| NVDA | NVDA (Guidepup, taşınabilir) kuruldu ve çalışıyor (Türkçe okudu); ancak işletim sisteminde ön plandaki pencereyi okuduğu için bilgisayar kullanılırken çalıştırılamaz. `ops/nvda-check.cjs` hazır, **çalıştırılmadı** |

Yeni değişken adları: `SITE_ADDRESS`, `SITE_URL`, `HTTP_PORT`, `HTTPS_PORT`, `ENV_FILE` (yalnız `docker-compose.prod.yml` için; `.env`/`.env.example` değişmedi), GitHub değişkenleri `SITE_URL`, `DOMAIN` (isteğe bağlı).

### Açık kalan 12 madde

Yurt dışı aktarım ve GDPR (veri sorumlularının kararı); Ekran okuyucu desteği, Manuel erişilebilirlik testleri, Klavye ve ekran okuyucu testi (NVDA koşusu için bilgisayarın boş olması gerekiyor); Gerçek mobil test (gerçek cihaz); Google Search Console, Geçerli TLS (halka açık CA sertifikası), Sertifika ve domain yenileme (gerçek alan adı); Monitoring ve alarm, CI/CD, Güvenlik güncellemeleri (dosyalar hazır, GitHub'da ilk çalışma/PR görülünce tiklenecek).
