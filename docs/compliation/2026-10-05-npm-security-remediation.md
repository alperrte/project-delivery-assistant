# PDA — NPM Security Remediation

## 1. Executive Summary

2026-10-05. `.agents/PDA_NPM_Security_Remediation_Prompt.md` belgesinin tamamına göre dependency kullanım analizi, minimum yerel CSS, gerçek uninstall/temiz kurulum, hedefli/tam Chromium, pre-push ve temiz production artifact incelemesi tamamlandı.

**Shadcn CLI zinciri kaldırıldı; full audit sıfırlanmadı.** Sonuç: full audit **5 high**, production audit **0**. Kalan ESLint/Next zinciri açık dependency-security debt olarak tutuldu. Custom braces patch, override, major downgrade, warning suppression veya audit gate değişikliği uygulanmadı.

Kaynak HEAD `0b8b2e4f4fa090473fca4a7afa80a87cf05a4250`, branch `project-service-frontend`; raporlanan sonuçlar bu HEAD üzerine commitlenmemiş task değişikliklerini içerir. Commit/push/pull/merge/staging yapılmadı. Başlangıçtaki untracked remediation prompt'u ve araştırma raporu korundu. Backend/config/ENV/auth/CSRF/CORS production kaynakları bu taskta değiştirilmedi.

## 2. Dependency Changes

- [package.json](../../frontend/package.json): `shadcn ^4.21.0` kaldırıldı.
- [package-lock.json](../../frontend/package-lock.json): **`npm uninstall shadcn`** tarafından güncellendi; ardından **`npm ci` exit 0**.
- Uninstall çıktısı: **219 paket kaldırıldı**. Kalan lock kayıtlarında sürüm değişikliği veya yeni paket kaydı yok; paylaşılan bağımlılıklar npm tarafından yeniden prod/dev sınıflandırıldı.
- `shadcn`, `ts-morph`, `@ts-morph/common` ve shadcn'e ait fast-glob zinciri tamamen kaldırıldı. Next, ESLint, Base UI ve `tw-animate-css` sürümleri korundu.
- Yalnız kök frontend worktree düzenlendi. `.local/backend-source` worktree'nin eski frontend manifestine bu değişiklik taşınmadı; o worktree Java backend için hazırlanmış önceki branch durumunda kalıyor.

Kullanım kanıtı: `frontend/src`, `scripts`, Next/ESLint/PostCSS config, package scripts ve `components.json` içinde shadcn JS/CLI/registry/ts-morph import veya invocation bulunmadı. `globals.css` import'u gerçek CSS kullanımıydı; `components.json` schema/preset bilgisi ve `global-search.tsx` yorumu JS kullanım kanıtı değildir. Mevcut `components/ui` bileşenleri Base UI primitive'lerini kullanıyor.

## 3. Shadcn CSS Migration

[globals.css](../../frontend/src/app/globals.css) artık `../styles/shadcn-compat.css` import eder. [Yerel compat CSS](../../frontend/src/styles/shadcn-compat.css) shadcn 4.21.0 stylesheet'inden yalnız kullanılan yedi tanımı korur:

| Varyant | Gerçek tüketiciler |
| --- | --- |
| data-open / data-closed | Dialog, Select, Dropdown Menu, Tooltip |
| data-checked | Checkbox, Radio Group; group/not/dark birleşimleri |
| data-disabled | Select ve Dropdown Menu item'ları |
| data-active | Tabs |
| data-horizontal / data-vertical | Tabs ve Separator; named-group birleşimleri |

Radix `data-state` ve Base UI boolean attribute davranışı, açık `false` değerleri dahil, upstream ile aynı. Fade/zoom/slide/enter/exit utility'leri mevcut `tw-animate-css` tarafından sağlanmaya devam ediyor. Kullanılmayan unchecked/selected varyantları, accordion keyframe'leri, no-scrollbar, scroll-fade ve shimmer kopyalanmadı. Compat dosyasında provenance ve tam MIT notice var. [Upstream lisans](https://raw.githubusercontent.com/shadcn-ui/ui/main/LICENSE.md)

CSS kanıtı: aynı Tailwind/PostCSS sürümleriyle before **173000 byte / 1435 rule**, after **171869 byte / 1433 rule**. Ortak kurallardaki kullanılan deklarasyonlar değişmedi; yeni rule yok. Çıkanlar yalnız kullanılmayan `.shimmer` reduced-motion kuralı ve shimmer/scroll-fade property başlangıç kayıtları. Renk/font/theme token'ları, global focus/overlay/z-index, mevcut reduced-motion ve circular reveal kodu korunuyor.

Stylesheet konumu ve bakım kuralı `.agents/folder-structure.md` / `frontend-design-rules.md` içinde güncellendi. Web checklist'e yalnız bu kapsam için kanıt notu eklendi; global kutular topluca işaretlenmedi.

## 4. Audit Before / After

| Kontrol | Önce | Sonra | Son exit |
| --- | ---: | ---: | ---: |
| `npm audit --json` high | 8 | **5** | 1 |
| `npm audit --omit=dev --json` high | 6 | **0** | 0 |
| Critical | 0 | 0 | — |
| `npm ls braces micromatch fast-glob ts-morph shadcn eslint-config-next --json` | Shadcn + ESLint zincirleri | Yalnız ESLint zinciri | 0 |

Son ölçüm pre-push sonrasında tekrar alındı. Full audit exit 1 kalan advisory'nin gerçek sonucu; hata gizlenmedi. Production sonucunun sıfır olması tek başına runtime güvenliği veya tüm uygulamanın güvenli olduğu anlamına gelmez. Full audit görünür bırakıldı.

## 5. Remaining Vulnerability Chain

```text
eslint-config-next@16.3.6 (dev)
  → @next/eslint-plugin-next@16.3.6
    → fast-glob@3.3.1
      → micromatch@4.0.8
        → braces@3.0.3
```

Beş high kaydı tek braces advisory'sinin bu zincire yansımasıdır. Uygulama sırasında registry `braces latest=3.0.3`; güvenlik duyurusu patched version belirtmiyor. Latest Next ESLint plugin 16.3.8 de fast-glob 3.3.1 kullanıyor. Bu nedenle Next/ESLint zinciri değiştirilmedi. [GHSA-vfj7-8cjw-p6xm / CVE-2026-93687](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)

Upstream PR #72 son kontrolde merge edilmeden kapalıydı; resmi release sayılmadı. Custom backport uygulanmadı. [PR #72](https://github.com/micromatch/braces/pull/72)

`npm ci` ayrıca ESLint 9.39.5 deprecation ve üç mevcut native paketin allow-scripts review uyarılarını verdi. Bunlar ayrı kurulum/bakım uyarılarıdır; dependency izinleri veya major sürümler sessizce değiştirilmedi. Native script approval otomatik verilmedi; lint/type/build yine başarılı oldu.

## 6. Runtime Reachability

| Ayrım | Kanıt / sonuç |
| --- | --- |
| A — Advisory exists? | **Evet**; yukarıdaki gerçek advisory |
| B — Installed vulnerable version? | **Evet**; full npm ci kurulumunda braces 3.0.3 var, lock'ta dev=true |
| C — Reachable production/user-input path? | **Doğrulanmış yol bulunmadı**; tüm olası yolların yokluğu garanti edilmedi |

PDA production `src/scripts` içinde kullanıcı girdisini bu paketlere taşıyan doğrudan import/call bulunmadı. İncelenen Next ESLint plugin yolu `settings.next.rootDir` glob'unu işler; mevcut config böyle bir desen tanımlamaz, `context.cwd` kullanır. Bu geliştirme/CI yolu kullanıcı form/API girdisiyle eş tutulmadı.

Önceki araştırmanın izole braces expand stack-overflow bulgusu geçerliliğini korur; bu task bir braces code patch uygulamadı. Yetkilendirme veya input validation açığı yokmuş gibi genel bir hüküm verilmedi.

## 7. Production Artifact Check

İnceleme son başarılı pre-push'ın **yeni temiz build'i** üzerinde yapıldı:

- Build ID: `PnAIfnbAGwY1MnXMIRRsY`; BUILD_ID zamanı `2026-10-05T13:09:01.736Z`.
- **48 `.nft.json`**: braces/micromatch/fast-glob/ts-morph/shadcn için bağımsız node_modules veya aynı isimli Next compiled yollarına eşleşme yok.
- **464 browser/server JS dosyası**, bunların **94'ü browser JS**: bu paketlerin module-path marker'ları ve kontrol edilen braces sink metinlerine eşleşme yok.
- Standalone output yapılandırılmamış; `.next/standalone` yok. Var olmayan bir deployment image'i doğrulanmış sayılmadı.
- Full development installation: braces, micromatch, fast-glob mevcut ve dev=true. Shadcn/ts-morph yok. Build-time lint kuralları korunuyor; bu kurulum production runtime bundle ile aynı şey değil.
- Compose frontend imajı üretmiyor. Çalışan backend imajı `project-delivery-assistant-backend`, digest `sha256:2f03b39bea5e34427d3969066815bf20713f2c1dc9bce8b8dede795e644a77f9`: `node`/`npm` yok, `/app/node_modules` yok, `/app/app.jar` var. PostgreSQL/frontend sınırları karıştırılmadı.

Tracing ve metin taraması sınırlı artefact kanıtıdır; minified/bundled kodun tümüne dair matematiksel yokluk veya farklı production topolojilerine güvenlik garantisi değildir. Nihai frontend deployment tüm dev node_modules'u taşırsa kurulu dev paketler orada da bulunabilir; release incelemesi gerçek dağıtım biçimini kapsamalı.

## 8. Regression Results

| Kontrol | Sonuç |
| --- | --- |
| `npm uninstall shadcn` | exit 0 |
| `npm ci` | exit 0 |
| Üretilen CSS eşdeğerliği | PASS; yalnız kullanılmayan kayıtlar çıkarıldı |
| `npm run lint` | PASS, exit 0 |
| `npx tsc --noEmit` | PASS, exit 0 |
| `npm run build` | PASS, exit 0; pre-push'ta tekrar temiz build |
| Hedefli Chromium: UI state, project create/settings/logo, org create/edit/cache, settings/theme/motion, chat, task models | **73 passed**, exit 0 |
| Landing hedefli doğrulama | **23 passed**, exit 0 |
| `npx playwright test --project=chromium` | **208 passed + 1 expected skip**, exit 0 |

[Yeni CSS kontrat testleri](../../frontend/e2e/ui-state-compat.spec.ts) light/dark temasında gerçek uygulama stylesheet'iyle boolean/legacy attribute ve `false`, enter/exit süresi, checked/active renk eşlemesi, disabled pointer/opacity, orientation davranışlarını kontrol eder. Bu DOM fixture testi production veri kanıtı değildir; mevcut gerçek sayfa akışları ayrı E2E'lerle doğrulandı. Dialog/Select/Dropdown/Tooltip CSS ve keyboard/focus/overlay davranışları ortak kuralların eşdeğerliği ve mevcut gerçek UI senaryolarıyla kapsandı; ayrı shadcn Popover/Sheet primitive dosyası bulunmadı. Organizasyon light/dark ve proje logo ekran görüntüleri üretildi; organizasyon light/dark görüntüleri görsel olarak incelendi.

### Test koşumlarında bulunan ve giderilen sorunlar

- İlk backend Docker build'i Maven Central TLS handshake kesilmesiyle başarısız oldu; aynı build güvenlik ayarı değişmeden retry'da geçti.
- İlk targeted koşum: 70 passed, 1 failed, 2 did not run. Sohbet testi periyodik session check'in en az üç saniye bekleyeceğini varsayıyordu; scheduler bu süre içinde çalışabilir. [Chat E2E](../../frontend/e2e/17-project-chat.spec.ts) yalnız bu geçersiz minimum gecikme beklentisini kaldırdı; revoked session'ın login'e yönlendirilmesi zorunluluğu korundu. Production chat kodu değişmedi.
- Ardışık targeted setup'ta register sonrası app shell bekleme timeout'u görüldü; yerel backend restart sonrası 73 test geçti. Testler arası in-memory auth bütçesi sıfırlandı; hız sınırı veya ENV değiştirilmedi.
- İlk full koşum: 204 passed, 4 failed, 1 expected skip. Main'in belgelenmiş monotonic demo davranışı ile eski geri-sarma testleri uyuşmuyordu. [Landing page](../../frontend/e2e/landing-page.spec.ts) status'ları ileri sırada doğrular; geri kaydırınca chapter seçimi dönebilir fakat DONE ilerlemesi korunur. Gizli tema/lazy görsellerinin yüklenmesi zorunlu tutulmaz; görünür görsellerin gerçek yüklenmesi poll ile doğrulanır. [Landing gerçek UI testi](../../frontend/e2e/landing-real-ui.spec.ts) önceki form aşamasını yeni belge yüklemesiyle test eder ve reset'i doğrular. Landing production kodu değiştirilmedi. Ara retry sonuçları özel loglarda; son full 208 passed.
- Bu değişiklikler assertion silerek gerçek ürün davranışını görmezden gelmez: lifecycle/animation, gerçek UI metrikleri, no-backend-request ve image/error kontrolleri korunur. Eski beklentinin kaynağı [main landing kaydı](2026-10-05-landing-ux-animasyon-duzeltmeleri.md) ve `animation-progress.ts` / `product-story.tsx` ile karşılaştırıldı.

## 9. Pre-Push

**`.\pre-push\pre-push.cmd` → PDA PRE-PUSH CHECK PASSED, exit 0.** Komut repo kökünde çalıştırıldı.

- Maven clean verify: **449 tests, 0 failures/errors/skips**.
- Lint, TypeScript, production build: başarılı.
- Tam Chromium: **208 passed, 1 expected skip**. Skip: production'da kapalı `/dev/error-test` controlled crash rotası; `error-pages.spec.ts` gerekçeyi açıklar.
- Docker build/start, backend health ve frontend HTTP smoke: başarılı.
- İlk gate 3000 portu kullanımda olduğu için browser aşamasına geçmeden durdu; o denemede backend/lint/type/build geçmişti. Özel harness'in göreli komut yoluyla çalışan Next 16 test sürecini kaçırması giderildi; kendi process handle'ıyla kapatma ve exited-server kontrolü eklendi. Yalnız doğrulanan test listener'ı durduruldu; ikinci tam gate geçti. Tracked pre-push script'i değiştirilmedi.
- Audit mevcut gate'in parçası değil; gate'e sessizce eklenmedi ve full audit 5 high ayrı raporlandı.

API endpoint/schema/policy değişikliği yok; yeni Swagger sözleşmesi N/A. Yerel Docker Desktop test için başlatıldı; root main backend yeniden oluşturuldu, mevcut data/media volume'leri korundu. Gate sonunda geçici Next test server'ı kapandı; backend health GET 200.

## 10. Security Recommendation

**SAFE TO KEEP TEMPORARILY** — bu kaynak ve incelenen yerel build bağlamında kalan **dev lint toolchain** için.

Gerekçe: gereksiz production CLI zinciri gerçekten kaldırıldı, production audit 0, kullanılan stiller/regresyonlar ve gate başarılı, kalan paketler dev-only işaretli, temiz browser/server çıktılarında bu paketlerin izi veya doğrulanmış kullanıcı girdisi yolu bulunmadı. Bu sonuç full audit'in temiz olduğu veya başka deployment biçimlerinin otomatik güvenli olduğu anlamına gelmez; SECURITY §16 release incelemesi sürer.

Kalan advisory görünür kalacak; resmi fix/consumer değişikliği takip edilmeli. Yakın production release için gerçek deployment'ta erişilebilirlik ortaya çıkarsa incelenmiş backport veya bağımlılık zincirini kaldıran çözüm release öncesi ayrı kararla uygulanmalı. Bu task hiçbir audit istisnası/waiver veya custom security patch eklemedi.

## 11. Remaining Work ve kullanıcı kontrolü

1. Resmi braces/Next ESLint fix veya consumer değişikliğini takip et; uygulama öncesi registry/advisory tekrar doğrulansın. ESLint deprecation/native script review ayrı bakım işidir; major upgrade için somut uyum planı hazırlanmalı.
2. Yeni UI component'i üretirken yalnız gereken local varyantı ekle; CLI paketi ve tam upstream CSS'i tekrar bağımlılık olarak ekleme.
3. Nihai frontend deployment için minimum runtime içeriğini doğrula. Custom backport gerekiyorsa exact diff/provenance, string/AST parse/compile/expand/stringify, depth sınırları, Windows glob ve consumer regression test planı ayrı onaya sunulsun.
4. Manuel UI: `frontend` terminalinde `npm run dev`; light/dark proje ve organizasyon formlarında dropdown/dialog aç-kapat, klavyeyle Escape/Enter, ayarlar, chat ve tema geçişini kontrol et. Animasyonlar kapalı davranışı da korunmalı.
5. `npm audit` hâlâ 5 high ve exit 1; `npm audit --omit=dev` 0 ve exit 0 beklenir. Commit/push kullanıcıya bırakıldı; Source Control'de bu taskın kod/test/doc değişikliklerini ve önceden var olan untracked belgeleri ayrı incele.

Özel kanıtlar Git dışında `.local/npm-remediation/`: `before.json`, `after.json`, `css-equivalence.json`, `artifacts.json`, uninstall/ci/lint/type/build logları, `targeted.log` (73), `landing.log` (23), `full.log` (208+skip), `pre-push.log` (449+208+skip). İlk başarısız koşumlar ayrıca saklandı. Ham auth storage/trace dosyaları rapora veya Git'e eklenmedi.
