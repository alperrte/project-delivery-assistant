# Npm güvenlik uyarıları — araştırma raporu

## 1. Teslim ve durum

Tarih: 2026-10-05. **Araştırma tamamlandı; güvenlik açığı giderilmedi.** Bu kayıt bir remediation veya production onayı değildir.

Kapsam: iki worktree'nin npm audit sonuçları, pull sonrası main karşılaştırması, bağımlılık/kullanım zinciri, yerel yeniden üretim, upstream durum ve uygulanabilir çözüm seçenekleri. Production kodu, manifest/lock, ENV, güvenlik politikası, Git index ve servisler değiştirilmedi. Commit/push/pull/merge yapılmadı. Yalnız bu rapor ve Git dışında yerel araştırma araçları/kanıtları oluşturuldu.

İncelenen kaynaklar:

| Kaynak | HEAD / sonuç |
| --- | --- |
| Kök worktree, `project-service-frontend` | `0b8b2e4f4fa090473fca4a7afa80a87cf05a4250` |
| Mevcut yerel `origin/main` referansı | Aynı HEAD: `0b8b2e4` |
| `.local/backend-source`, `project-service-backend` | `77243da180ece05ef768d91f70f4eaf372ada41e`; bu worktree main ile güncellenmemiş |
| Araçlar | Node `v24.19.0`, npm `11.17.0` |

Remote yeniden fetch edilmedi. Main sonucu, kullanıcının pull işlemiyle güncellenmiş yerel `origin/main` referansına aittir. Başlangıçta iki worktree de temizdi.

## 2. Pull sonrası main sonucu

Önceki frontend teslimi `d8df137` ile mevcut HEAD arasında organization backend birleşmesi, landing/animasyon tercihleri ve simple/advanced task model/workflow değişiklikleri bulunuyor. Şu iki dosya **değişmemiş**:

- [frontend/package.json](../../frontend/package.json)
- [frontend/package-lock.json](../../frontend/package-lock.json)

Kontroller:

```powershell
git diff d8df137 HEAD -- frontend/package.json frontend/package-lock.json
git diff --quiet HEAD origin/main -- frontend/package.json frontend/package-lock.json
```

İlk komutun diff çıktısı boş; ikinci komut exit `0`. Ayrıca `git diff --quiet HEAD origin/main -- frontend` exit `0`: mevcut frontend ağacı yerel origin/main ile aynı.

**Sonuç:** main'den alınan değişiklikler bu npm bağımlılık ağacına yeni paket veya sürüm getirmemiş. Aynı npm uyarıları güncel main'de de var; bu uyarıların artışını Alper'in son task değişikliklerine bağlayan kanıt yok. Bu araştırma yeni task/landing kodunun genel doğruluğunu veya Maven bağımlılıklarını denetlemez.

## 3. Gerçek audit sonuçları

| Çalıştırılan kontrol | Frontend worktree | Backend worktree içindeki frontend |
| --- | --- | --- |
| `npm audit --json` | 8 high, 0 critical; exit `1` | 8 high, 0 critical; exit `1` |
| `npm audit --omit=dev --json` | 6 high, 0 critical; exit `1` | 6 high, 0 critical; exit `1` |
| `npm ls braces micromatch fast-glob ts-morph shadcn eslint-config-next --json` | exit `0` | exit `0` |

Low/moderate uyarı yok. **8 ayrı açık değil: tek doğrudan advisory ve ondan etkilenen 8 paket kaydı.** Audit JSON'unda nesne biçimindeki advisory yalnız `braces.via` içinde; diğer kayıtlar paket adlarıyla bu zincire işaret ediyor.

| Etkilenen paket | Kurulu sürüm | Uyarının nedeni |
| --- | --- | --- |
| `braces` | 3.0.3 | Açığın bulunduğu paket |
| `micromatch` | 4.0.8 | braces bağımlılığı |
| `fast-glob` | 3.3.1 / 3.3.3 | micromatch bağımlılığı |
| `@next/eslint-plugin-next` | 16.3.6 | fast-glob bağımlılığı |
| `eslint-config-next` | 16.3.6 | Next ESLint plugin bağımlılığı |
| `@ts-morph/common` | 0.27.0 | fast-glob bağımlılığı |
| `ts-morph` | 26.0.0 | common bağımlılığı |
| `shadcn` | 4.21.0 | fast-glob ve ts-morph bağımlılığı |

Backend worktree'deki npm uyarıları da `frontend/` manifestine ait. Java backend'de 8 ayrı npm açığı bulunduğu anlamına gelmiyor.

## 4. Kök neden

`braces`, `{a,b}` gibi glob desenlerinin açılması/derlenmesi için kullanılıyor. Advisory: **CVE-2026-93687 / GHSA-vfj7-8cjw-p6xm**, severity HIGH. Derin iç içe yapılar recursive AST yürüyüşünde çağrı yığınını tüketebiliyor; yakalanmayan `RangeError` ilgili Node sürecini sonlandırabilir. Duyuru 3.0.3 ve önceki sürümleri etkilenmiş gösteriyor. [GitHub güvenlik duyurusu](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)

Kurulu pakette doğrudan doğrulanan yerler:

- `frontend/node_modules/braces/lib/constants.js:4`: `MAX_LENGTH: 10000`.
- `lib/parse.js:37`: karakter sayısı sınırı; nesting derinliği üst sınırı yok.
- `lib/compile.js:50`: `walk(child, node)` recursive çağrısı.
- `lib/expand.js:103`: aynı şekilde recursive çağrı.
- `braces/index.js`: hem string hem doğrudan AST kabul eden public compile API.

Karakter sınırı, nesting derinliği sınırı yerine geçmiyor. Bu açık veri tabanı, organization medya implementasyonu veya sohbet API'sinden kaynaklanmıyor; frontend araç zincirindeki üçüncü parti paket üzerinden geliyor.

### Bağımlılık yolları

```text
eslint-config-next
  → @next/eslint-plugin-next
    → fast-glob → micromatch → braces

shadcn
  → fast-glob → micromatch → braces
  → ts-morph → @ts-morph/common
                → fast-glob → micromatch → braces
```

## 5. PDA'da kullanım ve gerçek risk sınırı

### ESLint tarafı

[frontend/eslint.config.mjs](../../frontend/eslint.config.mjs) Next core-web-vitals ve TypeScript kurallarını yükler. Kurulu plugin'in `dist/utils/get-root-dirs.js:11–17` bölümü fast-glob yükler ve `settings.next.rootDir` verilirse dizin glob'u çalıştırır. Mevcut config böyle bir `rootDir` deseni tanımlamıyor; plugin bu durumda `context.cwd` kullanıyor.

Bu gözlem yalnız incelenen plugin çağrı yolu içindir; tüm üçüncü parti toolchain için kapsamlı erişilebilirlik garantisi değildir. ESLint kurallarını kaldırmak, açığı düzeltmek yerine kalite kontrolünü eksiltir.

### Shadcn tarafı

[frontend/src/app/globals.css:3](../../frontend/src/app/globals.css) `shadcn/tailwind.css` import eder. Production kaynakları ve `frontend/scripts` aramasında shadcn JavaScript CLI/registry/ts-morph API import'u görülmedi. `global-search.tsx` içindeki shadcn sözcüğü yorumdur.

Shadcn CSS gerçekten kullanılıyor: `dialog.tsx`, `select.tsx`, `dropdown-menu.tsx`, `tooltip.tsx` gibi UI bileşenlerinde `data-open:` / `data-closed:` varyantları var. Kurulu `shadcn/dist/tailwind.css` bu varyantları, keyframe'leri ve başka utility'leri tanımlar. **Paketi CSS karşılığını korumadan kaldırmak stil/animasyon regresyonuna yol açabilir.** Shadcn'in resmi CLI belgesi bileşen ekleme aracını açıklar. [Shadcn CLI](https://ui.shadcn.com/docs/cli)

`--omit=dev` sonucundaki 6 high'ın nedeni shadcn'in `dependencies` altında olmasıdır. Bu sayım, altı paketin browser'a veya HTTP request handler'a yüklendiğini tek başına kanıtlamaz.

### Kullanıcı girdisinden erişim

İncelenen `src`, `scripts`, Next/ESLint config içinde kullanıcı girdisini braces/micromatch/fast-glob/ts-morph'a gönderen doğrudan çağrı yolu bulunmadı. **PDA'ya HTTP isteği göndererek açığı tetikleyen bir saldırı yeniden üretilmedi.** Genel advisory'nin network etkisi otomatik olarak PDA endpoint erişilebilirliği sayılmadı.

Her worktree'deki mevcut 48 `.nft.json` dosyasında bu 6 hedef paketin bağımsız `node_modules` yolları ve aynı adlarla `next/dist/compiled` yolları görülmedi. Ancak bu çıktılar **pull öncesi mevcut build'lere aittir**. Yeni main build'i bu görevde yapılmadı; NFT kontrolü bütün bundled kodun veya nihai deployment içeriğinin yokluk kanıtı değildir.

Risk değerlendirmesi: doğrulanmış paket açığı mevcut; görülen kullanım ağırlıkla geliştirme/build araçları. Production üzerinden sömürülebilirlik henüz kanıtlanmış değil, güvenli olduğu da kesin ilan edilmedi. Production öncesi güncel build/deployment içeriği ve input-to-sink değerlendirmesi gerekiyor; SECURITY §16 high/critical incelemesini zorunlu tutuyor.

## 6. Yerel yeniden üretim

Kontroller yalnız ayrı, kısa ömürlü Node process'lerinde çalıştırıldı; exception yakalandı. Çalışan frontend/backend'e veya kullanıcı verisine saldırı isteği gönderilmedi. Bu bir remediation testi değildir.

| Deney | Sonuç |
| --- | --- |
| Basit nested fixture, 5 seviye; compile/expand | Başarılı |
| `a,b` içeren fixture, 4500 seviye; compile/expand | Başarılı; bu fixture'da stack overflow yeniden üretilemedi |
| Tek yapraklı nested string, 4998 seviye, 9997 karakter; compile | Başarılı |
| Aynı string; expand | `RangeError: Maximum call stack size exceeded` |
| Doğrudan AST; compile, 5 seviye | Başarılı |
| Doğrudan AST; compile, 12000 seviye | `RangeError: Maximum call stack size exceeded` |

Fixture ve yöntem sonucu etkiliyor; “her derin desen bütün yöntemleri çökertiyor” iddiası yapılmıyor. String expand sonucu karakter sınırı içindeki gerçek açığı, doğrudan AST sonucu ise yalnız parser'a konan guard'ın public AST girişleri için yetersiz olabileceğini gösterir. Ayrıntılı, lokal kanıt: `.local/npm-security-research/{local-probes,depth-probes}.json`.

## 7. Upstream araştırması ve güncel sürümler

Registry'den `npm view <package> version dependencies --json` ile doğrulandı:

| Paket | Araştırma anındaki latest | Çözüm durumu |
| --- | --- | --- |
| braces | 3.0.3 | Güvenlik duyurusunda patched version yok |
| micromatch | 4.0.8 | Hâlâ braces `^3.0.3` |
| fast-glob | 3.3.3 | Hâlâ micromatch `^4.0.8` |
| shadcn | 4.21.1 | Hâlâ fast-glob `^3.3.3`, ts-morph `^26.0.0` |
| @next/eslint-plugin-next | 16.3.8 | Hâlâ fast-glob `3.3.1` |
| eslint-config-next | 16.3.8 | Yukarıdaki plugin 16.3.8'i kullanıyor |

Dolayısıyla bu latest güncellemeleri tek başına bu advisory'yi çözmüyor. Sürüm bilgileri zamanla değişebilir; uygulamadan hemen önce tekrar sorgulanmalı.

### PR #72 hakkında yeni bilgi

Araştırmanın ilk bölümünde PR açık görünüyordu. Son kontrolünde **merge edilmeden CLOSED** durumda. Önerilen değişiklik parser ve AST işleyicilerine depth guard ekliyor; yayımlanmış resmi paket değil. PR'ın önceki revizyonlarında stringify uyumluluğu gibi düzeltmeler de tartışılmış. Dolayısıyla kodunu incelemeden bir fork'u kullanmak uygun değil. [Upstream PR #72](https://github.com/micromatch/braces/pull/72)

PR sahibinin kapanış gerekçesi kendi beyanıdır; bu rapor bakımcıların niyetini veya kesin gelecek release takvimini doğrulamıyor. **“Açık PR yakında çıkar, yalnız bekleyelim” yaklaşımı için artık yeterli dayanak yok.** Duyuru hâlâ yamalı sürüm belirtmiyor. [Advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)

## 8. Nasıl çözeriz?

| Seçenek | Kazanç | Sınır / öneri |
| --- | --- | --- |
| Resmi yamalı braces veya bu zinciri kaldıran consumer sürümü | Standart güncelleme; uygun advisory verisiyle audit temizlenebilir | Şu anda yok; takip edilmeli, release tarihi varsayılmamalı |
| Shadcn CSS'ini uyumlu yerel dosyada koruyup kullanılmayan CLI bağımlılığını kaldırmak | Gereksiz CLI/ts-morph zinciri ve production bağımlılık yükü azalır | Next ESLint zinciri kalır; full audit sıfır garantisi yok |
| Shadcn'i yalnız devDependency yapmak | Production kurulum kapsamı küçülür | Kod açığını gidermez; full audit kalır, build devDependencies ister |
| İncelenmiş, sürümü/hash'i sabitlenmiş depth-guard backport | Resmi release beklemeden kurulu kodu koruyabilir | Projenin patch bakım sorumluluğu; compile/expand/stringify/parse, string/AST ve consumer regresyonları gerekir; version-based audit uyarısı kalabilir |
| Glob consumer'larını korunan API'lerle braces kullanmayan alternatiflere geçirmek | Etkilenen paketi zincirden gerçekten kaldırabilir | Geniş araç zinciri değişikliği; glob semantiği/Windows path/sync-async davranışları ve lint kuralları korunmalı |
| `npm audit fix --force` ile downgrade | Audit farklı bir dependency ağacı seçer | Next ESLint 14.2.35 ve shadcn 1.0.0 önerisi mevcut ana sürümlerle uyumsuz olabilir; önerilmiyor |

`fast-glob` yerine başka paket alias'ı koymak API eşdeğerliği kanıtlanmadan çözüm değildir. `braces` ile `brace-expansion` ayrı paketlerdir; birini güncellemek diğerinin açığını gidermez. Sadece node_modules'u elle düzenlemek `npm ci` sonrası kaybolur. Audit seviyesini yükseltmek/uyarıları bastırmak veya paket sürümünü sahte biçimde değiştirmek remediation değildir. Npm `--force` manifest aralığı dışındaki ana sürüm değişikliklerini de yapabilir. [Npm audit belgesi](https://docs.npmjs.com/cli/v11/commands/npm-audit/)

### Önerilen sıra

1. **Downgrade yapma.** Mevcut işlevsel sürümleri koru; bu açık için sahip, takip kaydı ve production release öncesi karar belirle.
2. İlk ayrı değişiklik olarak shadcn CSS/CLI ayrımını değerlendir: mevcut CSS'in gereken davranışlarını lisans/provenance bilgisiyle koru, JS CLI bağımlılığını kaldır, lock'u gerçek install ile güncelle. Dialog/select/menu/tooltip, tema ve animasyon regresyonlarını doğrula. Bu, tam çözüm değil bağımlılık azaltımıdır.
3. Yakın production hedefi varsa yalnız resmi sürüm beklemeye dayanma: dar kapsamlı, incelenmiş depth guard backport için somut patch ve test planı hazırla. String ve public AST yolları birlikte korunmalı. Npm audit'in hâlâ uyarı vermesi ile kurulu kodun korunması ayrı raporlanmalı.
4. Daha kalıcı hedef, resmi yamalı sürüm veya consumer'ların braces bağımlılığını kaldırmasıdır. Backport uygulanmışsa uygun resmi release geldiğinde kaldır.
5. Kabul kontrolü: temiz `npm ci`, full ve production audit, güvenlik regresyonları, ESLint kurallarının korunması, TypeScript/build, ilgili UI testleri ve tam pre-push. İki worktree'de ortak manifest değişikliklerinin hangisine taşınacağı ayrıca belirlenmeli; otomatik merge/cherry-pick yapılmamalı.

Bu önerilerin hiçbiri bu araştırma görevi kapsamında uygulanmadı. Yeni bir güvenlik istisnası veya audit gate gevşetmesi gerekiyorsa SECURITY kararı olarak ayrıca açık onay alınmalı.

## 9. Pre-push neden geçmişti?

[pre-push/pre-push.ps1](../../pre-push/pre-push.ps1) node_modules yoksa `npm ci` çalıştırır; sonra lint, type-check, build, E2E ve Docker kontrollerine devam eder. Mevcut betikte ayrı bir `npm audit` sonucu başarı/başarısızlık gate'i yok. `npm ci` uyarı basabilir; bu tek başına kurulumu başarısız yapmaz.

Bu nedenle geçmişte pre-push'ın geçmesiyle bugünkü `npm audit` exit `1` birbiriyle çelişmiyor. Ayrıca geçmiş pre-push sonuçları **yeni main task değişiklikleri için güncel test kanıtı değildir**. Bu görevde tam pre-push, Maven, browser/E2E veya yeni production build çalıştırılmadı; servisler yeniden başlatılmadı.

## 10. Kanıtlar, açık konular ve kullanıcı kontrolü

Yerel özel kanıt klasörü: `.local/npm-security-research/` (Git dışında).

- `frontend-audit.json`, `frontend-audit-production.json`, `backend-audit.json`, `backend-audit-production.json`: tam çıktı ve exit code.
- `frontend-tree.json`, `backend-tree.json`: kurulu bağımlılık ağacı.
- `registry.json`: latest/dependency sorguları.
- `state.json`: HEAD, başlangıç Git durumu, manifest/lock SHA-256, araç sürümleri.
- `existing-build-traces.json`: eski NFT incelemesi; yeni main build kanıtı değil.
- `local-probes.json`, `depth-probes.json`: fixture bazında gerçek sonuçlar.
- `collect.py`, `probe-depth.py`: salt okunur ölçümler ve izole yerel paket kontrolü.

Önceki otomatik onay incelemesi kullanım sınırından çalışmamıştı; devam turunda toplu kontrol gerçekten çalıştı. Audit komutlarının exit `1` nedeni güvenlik bulguları; bağlantı/komut hatası gibi gizlenmedi.

**Açık konular:** runtime üzerinden exploitability, pull sonrası production artefact/deployment içeriği, seçilecek remediation ve test sonuçları. Araştırmanın tamamlanması bu konuları çözülmüş saymaz.

Kullanıcı kontrolü:

1. Bu raporun özellikle §5, §7 ve §8 bölümlerini incele.
2. Güncel sonuçları yeniden görmek için ilgili worktree'nin `frontend` terminalinde `npm audit` ve `npm audit --omit=dev` çalıştır; mevcut durumda nonzero exit beklenir.
3. İlk implementasyon için CSS/CLI ayrımı mı, release ihtiyacına göre incelenmiş backport mu yapılacağına karar ver. Uygulama kapsamı ve beklenen kalan audit uyarıları önceden netleştirilsin.
4. Production yayını kararı öncesi SECURITY §16 incelemesini ve güncel kaynak için pre-push doğrulamasını tamamla. Bu rapor production yayınına onay vermez.
