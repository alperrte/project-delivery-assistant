# Next.js Dependency Security Remediation

## Final verdict

**Onaylanan resmi Next yamas? tamamlandı; production npm audit0/exit0 ve canonical pre-push PASSED/exit0.** 2026-10-08.

Kullanıcı kararı: Next resmi yaması uygulansın; resmi yamalı sürümü olmayan braces upstream takibi açık kalsın. Full npm audit **5 high/exit1**, yalnız mevcut development zincirinde; full audit0 veya genel release waiver iddiası yok.

Branch `project-service-backend`, HEAD `adf0c2f14785de5790f50f918d1d3f4ddb032f4d`; HEAD/index korundu, staged0. Commit/push/staging/pull/merge yok. Uygulama/invitation/backend/config/migration/ENV/auth/CSRF/CORS kaynakları değişmedi.

## Kapsam ve dependency chain

- [package.json](../../frontend/package.json): `next` ve dev `eslint-config-next` exact16.3.6 ->16.3.8; aynı release ailesi.
- [package-lock.json](../../frontend/package-lock.json): gerçek `npm install --save-exact next@16.3.8` ve `npm install --save-dev --save-exact eslint-config-next@16.3.8`; root metadata +12 Next/eslint/env/SWC entry. SWC Linux libc metadata yayımlanmış yeni paketin parçası. İlgisiz fast-deep-equal flag normalizasyonu eski haline döndürülüp tekrar temiz npm ci geçti.
- Node24.19.0 Next'in >=20.9.0 engine'ini; React/ReactDOM19.2.8 mevcut ^19 peer'ini karşılar. Diğer paket sürümleri aynı; sharp0.35.5 ve source-map-js1.2.2 korunur.
- Major upgrade, downgrade, npm audit fix --force, yeni dependency/override/custom security patch veya npm script onay politikası değişikliği yok.

## Kapatılan advisory'ler ve sınır

16.3.8 resmi yamalı sürüm; kurulu graph'ta Next advisory'leri audit'ten kalktı:

| Advisory | Konu |
| --- | --- |
|[GHSA-3w37-wq28-93x7](https://github.com/advisories/GHSA-3w37-wq28-93x7) |use-cache/Draft Mode fill disclosure |
|[GHSA-4jqv-mc3x-m676](https://github.com/advisories/GHSA-4jqv-mc3x-m676) |Pages Router SSG/ISR cache poisoning |
|[GHSA-39w2-rjm5-chcv](https://github.com/advisories/GHSA-39w2-rjm5-chcv) |dev MCP origin disclosure |
|[GHSA-f87g-xv8r-7p7x](https://github.com/advisories/GHSA-f87g-xv8r-7p7x) |metadata image dynamicParams bypass |
|[GHSA-mcj8-r9mp-w47p](https://github.com/advisories/GHSA-mcj8-r9mp-w47p) |SSG/ISR cache content substitution/DoS |
|[GHSA-cjq9-62q9-8jv4](https://github.com/advisories/GHSA-cjq9-62q9-8jv4) |Image Optimization SSRF |

[Resmi release](https://github.com/vercel/next.js/releases/tag/v16.3.8) ve npm metadata/peer/engine kontrol edildi. PDA'da Cache Components/Draft Mode, Pages Router veya remotePatterns eklenmedi; app konfigürasyonu aynı. Graph kapanışı tüm CVE'lerin eski PDA kurulumunda exploit edildiği anlamına gelmez. Benign runtime smoke: dev MCP localhost initialize200, foreign example.invalid403, opaque null403; local PNG optimizer200/image/png, unlisted remote URL400. MCP response içeriği/dev log/source/credentials rapora alınmadı.

## Test fixture düzeltmeleri

İlk canonical gerçek login429 nedeniyle iki setup testinde kaldı. Rate limit/ENV/retry/timeout/assertion gevşetilmedi:

- [invitation-fixture](../../frontend/e2e/invitation-fixture.ts): aynı QA actor/run içinde gerçek minted session cookies yeniden kullanılır; current principal e-posta eşleşmesi API'den assert edilir.
- [team-deletion notifications](../../frontend/e2e/team-deletion-notifications.spec.ts): logout/revocation acceptance ayrı fresh session; logout yapmayan setup ayrı reusable session. İlk reuse denemesi logout ile iptal edilen session'ı yeniden kullanmaya çalıştı, targeted3 failure verdi; bu başarı sayılmadı ve session ayrımıyla düzeltildi.
- [chat](../../frontend/e2e/17-project-chat.spec.ts) / [member preview](../../frontend/e2e/team-member-preview.spec.ts): zaten login edilmiş QA outsider/normal member session'ı private `.auth` fixture'da aktarılır; API principal doğrulanır. Tek başına koşumda fixture yoksa eski gerçek login setup'ı kullanılır.

Production browser storage/session/auth modeli değişmedi. Yeni success akışları gerçek backend/PostgreSQL; auth response fabrikasyonu yok. Logout/login, actor isolation, popup once-only, roster/card/101-team ve chat/socket assertions kaldı.

## Doğrulama

| Komut/aşama | Sonuç |
| --- | --- |
|Scoped npm install; clean npm ci (final lock ile) |exit0 |
|Initial/final full npm audit --json |6 high ->5 high;exit1 (deferred braces) |
|Initial/final npm audit --omit=dev --json |1 high ->0;exit0 final |
|Lint, TypeScript, production build |exit0;Next16.3.8 |
|Initial targeted Chromium |46 passed+1 expected production crash-route skip |
|First canonical |backend548/0/0/0 PASS;Chromium326 PASS+2 login429 failures+1 expected skip;exit1 |
|First session reuse target |6 PASS+3 revoked-session failures;exit1, not PASS |
|Corrected real-session targeted |30 passed;lint/type/build0 |
|Final .\pre-push\pre-push.cmd |**PASSED exit0;backend548/0/0/0;full Chromium328 PASS+1 expected skip;lint/type/build/Docker build/start/health** |
|Final patched dev runtime smoke |localhost MCP200, foreign/opaque403, local image200, remote400;exit0 |
|Final health/source |frontend3000/backend8080/Swagger/apiDocs200;HEAD/index unchanged,staged0;app/backend/config hash differences0 |

Docker daemon ilk gate başlangıcında kapalıydı; existing volume'ler korunarak açıldı. Bu startup hata PASS sayılmadı. Canonical full Maven clean verify/Testcontainers geçti, backend skip0. Tek Chromium skip mevcut production controlled crash route kapalı olduğu için expected. Canonical node_modules mevcut olduğu için optional npm ci adımını atlar; clean ci bu teslimde ayrı olarak gerçekten koşuldu. Npm'nin mevcut pending-script uyarısı için approve-scripts/policy override yapılmadı; kurulum ve build exit0.

Next dev restored; Docker backend running/HTTP health200, PostgreSQL sağlıklı.46 current-suite own QA projects existing authenticated archive API'siyle temizlendi,remaining0; kullanıcı kayıtları/volume'ler silinmedi, old QA/account/archive metadata kalabilir. Private sanitized package/audit/JUnit/command/runtime kanıtı `.local/security-high-remediation/`; Completion kaydına raw auth trace/token/password eklenmedi.

## Açık takip / kullanıcı kontrolü

1. **Braces upstream takibi açık:** [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm), <=3.0.3, resmi patched version yok. ESLint-config-next ->plugin ->fast-glob ->micromatch ->braces zinciri full audit5 high yapıyor. Kullanıcı bu tur custom patch istemedi; kapanmış veya full audit0 sayılmadı. Ayrı release takibi, genel security waiver yok.
2. package.json ve lock diff'ini incele: Next/eslint16.3.8, unrelated versions değişmemiş.
3. Lokal login/proje/davet/banner/notification/history akışını aç; navbar ve sidebar eski davranışı korumalı. Production audit'i tekrar kontrol ederken full dev warning'in ayrı olduğunu dikkate al.
4. Bu completion kaydını incele. Commit/push/staging kullanıcıya bırakıldı.
