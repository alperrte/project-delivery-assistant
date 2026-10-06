# source-map-js Dependency Security Remediation

## Teslim ve durum

2026-10-06. **Onaylanan source-map-js remediation tamamlandı; canonical pre-push PASSED, exit0.** Invitation remediation'dan ayrı dependency teslimidir.

Branch `project-service-backend`, başlangıç/final HEAD `76a5bb6`. HEAD/index ve mevcut kullanıcı dosyaları korundu; commit/push/staging yapılmadı. Uygulama, invitation, backend, migration, ENV, Compose ve test kaynakları değişmedi. Bu teslimin dependency değişikliği yalnız [frontend/package-lock.json](../../frontend/package-lock.json) içindeki tek transitive package entry'dir. `package.json` değişmedi.

## Yapılanlar ve compatibility

- `npm explain source-map-js` mevcut1.2.1 zincirini doğruladı: Next16.3.6→PostCSS8.5.23; Tailwind PostCSS4.3.3→PostCSS8.5.28 ve Tailwind node4.3.3. Üç consumer da `^1.2.1` ister;1.2.2 mevcut semver aralığına uyar.
- Registry metadata:1.2.2, Node>=0.10.0, yeni dependency yok; yerel Node24.19.0/npm11.17.0 uyumlu. [Maintainer release](https://github.com/7rulnik/source-map-js/releases/tag/v1.2.2) ve [reviewed advisory](https://github.com/advisories/GHSA-68fv-2mgg-jv7q) yamalı sürümü doğruladı.
- Gerçek `npm update source-map-js`1.2.2'yi kurup lockfile version/resolved/integrity alanlarını güncelledi. npm'in unrelated fast-deep-equal devOptional metadata değişikliği eski haline geri alındı; onun version/integrity/dependency içeriği değişmedi. Bütün lock entries ve root metadata karşılaştırıldı: yalnız source-map-js değişti.
- Temiz `npm ci`418 package kurdu,419 package audit etti. `npm ls source-map-js --all` bütün consumer'ların tek deduped1.2.2 kullandığını doğruladı. Yeni direct dependency/override eklenmedi; major/downgrade/unrelated package update veya audit force işlemi yapılmadı.
- GHSA-68fv-2mgg-jv7q / CVE-2026-93749 installed audit'ten kaldırıldı. Production dependency graph temiz; untrusted PDA runtime exploit/reachability ayrıca kanıtlanmış sayılmadı.

## Doğrulama

| Komut / kontrol | Sonuç |
| --- | --- |
| `npm.cmd update source-map-js` | exit0; yalnız hedef1.2.1→1.2.2 |
| `npm.cmd ci` | temiz install exit0 |
| `npm.cmd explain source-map-js`; `npm.cmd ls source-map-js --all` | Next/PostCSS/Tailwind bütün yollar1.2.2; exit0 |
| `npm.cmd audit --json` | **5 high, exit1**; yalnız eski ESLint/braces ailesi; önce6 high |
| `npm.cmd audit --omit=dev --json` | **0 vulnerability, exit0**; önce1 high |
| Bounded source-map probe, child process timeout5s | normal mapping/SourceNode round-trip; within-limit1000000 offset hızlı tamamlanır; aşırı1000000000/MAX_SAFE_INTEGER offset reddedilir; exit0 |
| `npm.cmd run lint`; `npx.cmd tsc --noEmit`; `npm.cmd run build` | exit0, hedefli koşum ve canonical kapıda |
| `npx.cmd playwright test e2e/landing-page.spec.ts e2e/landing-real-ui.spec.ts e2e/ui-state-compat.spec.ts e2e/invitation-remediation.spec.ts e2e/invitations-errors.spec.ts e2e/invitations-cache.spec.ts --project=chromium` | **33 passed, exit0** |
| `./pre-push/pre-push.cmd` | **PASSED exit0**; Maven clean verify469 tests,0 failure/error/skip; lint/type/build; tam Chromium248 passed+1 expected skip; Docker build/start/health |
| Final source/lock/index/hash kontrolü | app/invitation/backend/package.json aynı; tek target lock entry; HEAD/index aynı |
| Final runtime | Docker/PostgreSQL healthy; backend8080/frontend3000/Swagger HTTP200; önceki Next dev geri açıldı |

Tek skip mevcut production kontrollü crash route'un kapalı olmasına ait `error-pages.spec.ts` expected skip'idir. Testcontainers skipped0. Hedefli invitation başarı akışları gerçek Chromium/backend/PostgreSQL kullanır; mevcut TEST-ONLY failure fixtures kendi amaçlarıyla kaldı. Bu görev test kaynaklarını değiştirmedi.

Bounded özel probe ilk denemede aşırı offset'i kabul etmesini bekledi; paket bunu güvenli biçimde reddetti. Assertion gerçek patched contract'a göre düzeltildi ve yeniden geçti; ilk başarısız probe PASS sayılmadı. npm mevcut ESLint deprecated/install-script review uyarıları verdi; config/allowScripts değiştirilmedi, temiz kurulum ve build geçti.

Kanıtlar `.local/source-map-security/` altında Git dışındadır: baseline/hash ve lock-before snapshot, update/ci/audit/tree, source-map probe, targeted logs, canonical log, fresh JUnit aggregation, source verification ve final health. Credentials/auth tokens rapora alınmadı. QA testleri kendi kaynaklarını mevcut cleanup ile ele aldı; kullanıcı verisi/volume silinmedi.

## Açık konular

**source-map-js kapsamındaki açık finding/gate failure kalmadı.** Full audit'teki5 high, eski `eslint-config-next→@next/eslint-plugin-next→fast-glob→micromatch→braces` development borcudur. Bu kapsamda değiştirilmedi; SECURITY §16'daki production release öncesi review gereksinimi sürer. Full audit exit1 gizlenmedi; production audit0 genel release waiver değildir.

API/domain/authorization değişikliği yok; mevcut endpoint ve Swagger sözleşmesi aynıdır. Bu kayıt [invitation implementation completion](2026-10-06-invitations-integration-remediation.md) yerine geçmez; oradaki6 high/production1 eski teslim anının sayılarıdır.

## Kullanıcı kontrolü

1. Lockfile diff'inde yalnız source-map-js version/resolved/integrity değişikliğini ve package.json'ın aynı olduğunu incele.
2. Frontend'de `npm.cmd ls source-map-js --all` ile1.2.2'yi; `npm.cmd audit --omit=dev` ile0 açık sonucunu kontrol et. Full audit'te eski5 dev uyarısı beklenir.
3. Dev frontend3000 ve backend8080 açık; landing/tema ve invitation akışlarını olağan kullanımda kontrol et.
4. Bu ayrı completion kaydını incele. Commit/push/staging yapılmadı; gönderim kullanıcıya bırakıldı.

## Frontend branch teslim haz?rl???

Security de?i?ikli?i `project-service-frontend` HEAD7dc5a71 worktree'sine ta??nd?. Yukar?daki469/248 full gate, haz?rl???n yap?ld??? backend HEAD76a5bb6 ?zerindeki do?rulamad?r; frontend branch'i i?in yeni full gate sonucu diye sunulmaz. ?ki branch'in package.json ve yama ?ncesi lockfile'? birebir ayn?d?r; yaln?z bu dependency yamas? ve ona ait belgeler ta??nd?. Invitation remediation commit'i bu ta??ma kapsam?na al?nmad?.
