# PDA — Invitations minimum remediation

2026-10-06. Source of truth: kullanıcı onayı ve [audit finding'leri](PDA_INVITATIONS_END_TO_END_INTEGRATION_AUDIT_REPORT.md#17-findings-by-severity). Sıra:003 →001 →002 →004. Her finding implementation → targeted test → DoD → checkbox → next finding. Commit/push/staging yok.

## INV-AUD-003 — Private actor cache

- [x] List/preview query keys user ID ile scope; abort signal + private family cleanup logout/login/session boundary.
- [x] Gerçek account switch, delayed new-principal GET ve previous-user late response regression geçti.
- [x] DoD: old invitation/preview/in-flight data yeni kullanıcıda render edilmez; backend permission/cookie/CSRF/CORS değişmedi.

## INV-AUD-001 — Expiry lifecycle

- [x] Row lock ile expired pending materialization; create/reinvite/resend/cancel açılır; etkin manager status/filter aynı expiry kullanır.
- [x] Fresh PostgreSQL expiry/reinvite/resend/cancel + unique/concurrency/persistence targeted tests geçti.
- [x] DoD: expired token kabul edilemez; pending unique constraint korunur; eski migration değişmedi.

## INV-AUD-002 — Token mutation cache

- [x] Legacy success projects+private invitation family invalidation.
- [x] Gerçek warm client navigation ve DB regression geçti; external signed-in path önce mevcut source ile yeniden üretildi, yalnız gerekirse dar fix.
- [x] DoD: reload olmadan sidebar/list yeni üyeliği gösterir, duplicate POST oluşmaz.

## INV-AUD-004 — External preview failure

- [x] 404/invalid token ile429/network/server ayrımı, retry ve stale response/error guards.
- [x] Başarılı gerçek external UI, gerçek429 ve ayrı controlled failure regressions geçti.
- [x] DoD: rate limit expired diye gösterilmez; normal success mock değildir.

## Final gate / teslim

- [x] Real Chromium/backend/PostgreSQL birleşik regression; QA own IDs cleanup.
- [x] Backend full tests, lint, TypeScript, production build, full Chromium, canonical pre-push PASS.
- [x] Docker/backend8080/frontend3000 sağlık ve source/index/HEAD kontrolü.
- [x] Ayrı implementation completion; audit completion başarı kanıtı yerine kullanılmadı.

Mevcut domain, authorization ve çalışan create/accept/reject/team flow korunur. No new ENV/dependency/migration. SMTP delivery bu bug-fix scope'unda açılmaz; mevcut dev npm advisory borcu ayrı raporlanır.

### INV-AUD-003 evidence

Lint/TypeScript/build exit0; final targeted12 Chromium passed. Actor-scoped me/preview/project history/count, abort signals, cleanup across logout/session/login/register; real three-account same-document switch and late real response relay plus cache cancellation test passed. Backend permission/session/cookie/CSRF/CORS unchanged.

### INV-AUD-001 evidence

Targeted43 backend tests,0 failure/error/skip; PostgreSQL barrier confirmed two creates waiting on the expired row and only one pending commit. Registered/email reinvite, renewal, expired cancel and archived-team rejection verified. Current lint/type/build0, real Chromium13 passed: expiry history/resend/cancel/reinvite/accept+prepared DB plus existing scope/role/team regressions. Old test expectation rejecting expired cancel/resend was changed to the newly approved contract; expired accept/reject remain denied.

### INV-AUD-002 evidence

Legacy success invalidates projects root and private invitation root, waits refresh, then presents accepted state. Current lint/type/build0 and15 real Chromium passed incl prepared DB, single POST and no reload. External signed-in unchanged callback passed two baseline runs (completed empty cache + same-document marker) and final regression; no speculative callback modification was made.

### INV-AUD-004 evidence

Current lint/type/build0 and9 targeted Chromium passed: actual external registration and four-finding regressions, typed error classification, controlled500/503/network/404/token-validation copy, one recovery from actual server, and real backend429 with enforced quota. Token/retry-specific snapshot and abort/cancel guard prevent stale preview/error overwrite. Failed fixture used same fragment URL first, then exceeded default preview budget during repeated real recoveries; navigation cases isolated and recovery budget reduced, not policy relaxed.

### Full-gate first attempt / fixture isolation

Backend469 passed0 failure/error/skip; first full Chromium247 passed,1 failure,1 expected skip. Existing101-org registration received real429 because added fixture registrations exhausted the default5 normal-register budget. New scope test reuses the existing third QA account (fallback only in isolated target runs); signed-in external test registers through another real invitation before accepting the pending target invitation. No quota/config change, no mock success. Updated targeted9 incl101-org and real429 passed; canonical full rerun pending.

### Final gate evidence

Final canonical PASSED exit0:469 backend0 failure/error/skip,248 Chromium+1 expected production crash-route skip; lint/type/build and Docker build/start/health. Default quotas retained; all four approved finding regressions passed. Final backend8080/frontend3000/Swagger HTTP200, PostgreSQL healthy, Next dev running. HEAD/index unchanged; domain/entity/migration/backend-auth/CSRF/CORS/session/ENV/package/lock/Compose unchanged. Separate completion: docs/compliation/2026-10-06-invitations-integration-remediation.md. New independent npm6 high/production1 source-map-js advisory is a separate release/dependency follow-up; no global no-blocker/release claim was made.
