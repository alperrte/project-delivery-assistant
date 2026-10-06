# Invitations Integration Remediation

## Final verdict

**Onaylı dört invitation bulgusu CLOSED; canonical pre-push PASSED, exit0.** 2026-10-06.

[Remediation planı](../../PDA_INVITATIONS_REMEDIATION_PLAN.md) sırayla INV-AUD-003 →001 →002 →004 uygulandı: implementation → targeted test → DoD → checkbox → next finding. [Audit completion](2026-10-06-invitations-integration-audit.md) tarihsel bırakıldı; bu ayrı implementation teslimidir.

Full gate: **469 backend tests,0 failure/error/skip;248 Chromium passed+1 expected skip; lint/TypeScript/production build/Docker build/start/health PASS**. Branch `project-service-backend`, HEAD `63a2127`, index korundu. Commit/push/staging/pull/merge yok. Domain entity, migrations, backend authorization/session/CSRF/CORS, ENV, package/lock ve Compose değiştirilmedi.

Bağımsız dependency kontrolünde güncel **npm6 high / production audit1 high** bulundu; bu dört fix'in dışında kalan source-map-js advisory'si açık. Bu nedenle global “Kalan blocker yok.” veya release güvenlik onayı verilmedi. Dört invitation finding'i kapsamında açık bug/gate failure kalmadı.

## Closed findings

| Finding | Minimum implementation | Kapanış kanıtı |
| --- | --- | --- |
| INV-AUD-003 HIGH | me/preview/project history/count actor-scoped keys; query AbortSignal; private family cancel/remove sign-in/out/session boundary; recipient modal state actor key ile remount | gerçek üçüncü hesap same-document switch, delayed new-principal GET ve late gerçek previous-user response; new actor old data görmedi; project403/invitation404 kaldı; cache cancellation unit |
| INV-AUD-001 MEDIUM | pending target row pessimistic lock → expired EXPIRED + flush → new insert; effective pending/history/count/candidate filters; expired resend fresh ID/token, expired cancel204 retained EXPIRED; active team check | registered/email fresh DB, expiry UI/history/resend/cancel/reinvite, unique409, expired accept deny, archived-team reject; deterministic barrier2 blocked transactions→1 new pending commit |
| INV-AUD-002 MEDIUM | legacy accepted success mevcut projects root + private invitation root invalidates, sonra accepted view | warm client navigation, prepared DB ACTIVE/roles/team1, single POST/card visible/no reload; signed-in external baseline passed unchanged |
| INV-AUD-004 LOW | invalid/missing/404/token-field validation expired;429 rate copy, network separate, server contextual unavailable; retry token/attempt-bound snapshot+abort/cancel | controlled failure copy + actual server recovery; gerçek429 shows rate limit/retry and quota stays enforced; normal external registration gerçek |

## DB / API behavior

Existing ProjectInvitation/ProjectMembership/SquadMembership modeli, scalar IDs, roles ve membership transaction/event sınırı korundu. Automatic General Team yok; invitation seçilen gerçek team'e bağlıdır. Token SHA-256, TTL7 gün, single-use ve principal/identity enforcement değişmedi.

Expired pending materialization **mutation transaction'ında** olur; GET read-only ve effective status/filter kullanır. Geçmiş expired row retained EXPIRED, yeni pending row fresh ID/hash/expiry alır; partial unique indexes korunur. Nonexpired pending resend eskiyi CANCELLED yapar. Expired cancel204 hiçbir grant oluşturmaz ve EXPIRED'i korur; accepted/rejected/cancelled durumlarda mevcut409 devam eder. Backend expired accept/reject'e izin vermedi.

Resend için active same-project team revalidation arşivlenmiş team'e yenileme yapılıp ekipsiz membership oluşmasını engeller. FK, schema ve eski migration'lar değiştirilmedi.

### Endpoint / Swagger inventory

Base `/api/v1`; existing cookie authentication ve mutation CSRF. MEMBER_MANAGE aktif proje manager'ı; global ADMIN bypass yok. Recipient operations current principal/token/identity ile scope edilir.

| Method/path | Request/scope | Success / önemli hatalar |
| --- | --- | --- |
| POST `/projects/{p}/invitations` | teamId,roles; exactly-one userId/email; external names; message?; manager+CSRF |201 token once/no-store;400 validation,401 session,403 permission/CSRF,404 target/team,409 active member/live pending/unique |
| GET `/projects/{p}/invitations` | page,size;manager |200 effective live pending;400/401/403 |
| GET `/projects/{p}/invitations/all` | status?,page,size;manager |200 all/effective status; PENDING excludes elapsed, EXPIRED includes physical+logical elapsed;400/401/403 |
| POST `/projects/{p}/invitations/{i}/resend` | body yok;manager+CSRF;active target team |200 fresh ID/token/no-store;401/403/404/409; expired allowed |
| DELETE `/projects/{p}/invitations/{i}` | body yok;manager+CSRF |204 live→CANCELLED, expired→EXPIRED/no grant;401/403/404/409 |
| POST `/projects/{p}/invitations/{i}/accept` / reject | token;recipient+CSRF+same project/ID |200 member /204;400/401/403/404/409;expired denied |
| GET `/project-invitations/me` | principal only;page,size,status=PENDING or omitted |200 actor-owned page;400/401 |
| GET `/project-invitations/{i}/preview` /logo | recipient,pending/unexpired,active project |200 safe card/image private,no-store;401/404 |
| POST `/project-invitations/{i}/accept` /reject | recipient+CSRF;accept body yok,reject optional message<=500 |200 member /204;400/401/403/404/409 |
| POST `/project-invitations/external/preview` | public+CSRF;token |200 no-store;400/403/404/429;UI accurate error/retry |
| POST `/project-invitations/external/accept` | session+CSRF,live token+matching account email |200 Accepted;400/401/403/404/409/429 |
| POST `/auth/register/invitation` | public+CSRF,token/email/names/nickname/password confirmation |200 Accepted;400 identity/validation,403 CSRF,404 token,409 conflict,429 |

Yeni route/method/auth matcher yok. Sensitive and invitation quotas unchanged. Güvenli örnek: `{"teamId":"<QA-team-uuid>","userId":"<QA-user-uuid>","roles":["TESTER"],"message":"Ekibe katılın"}`. Swagger `http://localhost:8080/swagger-ui/index.html`, `/v3/api-docs`; normal login/CSRF. Raw password/token/cookie raporda yok.

## Cache / account boundary

[query-keys.ts](../../frontend/src/features/invitations/query-keys.ts) protected scopes'u user ID ile ayırır. Cleanup yalnız private invitation family'lerini hedefler; backend permission modelini genişletmez, unrelated application query modelini yeniden tasarlamaz. Old in-flight query data cancel/remove ve user-key isolation ile yeni kullanıcıya görünmez. Local preview/rejection state actor identity'de reset olur.

[invalidation.ts](../../frontend/src/features/invitations/invalidation.ts) legacy membership success'te existing projects+private invitation roots invalidate eder; reload yok. External signed-in accept iki baseline koşumunda ve final regression'da warm same-document flow'u geçti; o callback'e speculative invalidation eklenmedi. Final fixture kullanıcıyı başka gerçek invitation'dan kayıt edip hâlâ pending target invitation'a signed-in katılır.

Public preview state token+attempt ile bağlanır; eski response/error overwrite etmez. Error404/invalid token ile temporary failure ayrılır. Retry gerçek server response ile toparlandı; actual429 retry quota'yı bypass etmez.

## Changed files

- Backend: [ProjectInvitationService](../../backend/src/main/java/com/pda/project/application/service/ProjectInvitationService.java), [repository](../../backend/src/main/java/com/pda/project/infrastructure/repository/ProjectInvitationRepository.java), [ProjectAccessService](../../backend/src/main/java/com/pda/project/application/service/ProjectAccessService.java), [controller metadata](../../backend/src/main/java/com/pda/project/api/ProjectInvitationController.java).
- Frontend: global invitation page, project invitation page/count hook, preview dialog, API signal forwarding, legacy accept; [external preview/registration](../../frontend/src/features/invitations/components/external-invitation-registration.tsx), [error classification](../../frontend/src/features/invitations/external-preview-error.ts), query-key/invalidation helpers; AppShell/login/register invitation cache boundary;TR/EN/DE strings. Navbar/layout konumu bu taskta değiştirilmedi.
- Tests: [service PostgreSQL tests](../../backend/src/test/java/com/pda/project/application/ProjectInvitationServiceTest.java), [real remediation E2E](../../frontend/e2e/invitation-remediation.spec.ts), [prepared DB helper](../../frontend/e2e/invitation-db.ts), [cache test](../../frontend/e2e/invitations-cache.spec.ts), [error/rate E2E](../../frontend/e2e/invitations-errors.spec.ts).
- Documents: source plan, scoped architecture/folder/API/database/security/design/checklist notes; original audit records cross-link this separate completion. Global checklist boxes topluca[x] yapılmadı.

## Test results

| Command / stage | Result |
| --- | --- |
| INV-003 lint/type/build + scoped-cache/account/history/preview/team target |12 Chromium passed,exit0 |
| INV-001 `mvnw.cmd -Dtest=ProjectInvitationServiceTest,ProjectInvitationApiIntegrationTest,ProjectInvitationRepositoryTest,SquadApiIntegrationTest test` |43 passed,0 failure/error/skip;real PostgreSQL barrier |
| INV-001 updated backend build/runtime + scope/expiry/roles/team target |13 Chromium passed;lint/type/build0 |
| INV-002 existing signed-in external baseline |2 separate runs1 passed;callback unchanged |
| INV-002 combined real legacy/external/membership target |15 Chromium passed;lint/type/build0 |
| INV-004 final error/real429/four-finding target |9 Chromium passed;lint/type/build0 |
| Default-quota fixture isolation +101-org target |9 Chromium passed;no quota change |
| First canonical |backend469 PASS;Chromium247 passed+1 failure+1 expected skip;exit1;existing org registration received429 |
| Final `./pre-push/pre-push.cmd` |**PASSED exit0;backend469/0/0/0;Chromium248 passed+1 expected skip;lint/type/build/Docker build/start/health** |
| `npm.cmd audit --json`; `npm.cmd audit --omit=dev --json` |6 high /1 high;both exit1;separate dependency follow-up |

Old expired cancel/resend rejection test was updated to approved clear/renew semantics while expired accept/reject deny stayed asserted. Controlled error fixture first reused a same-fragment navigation, then repeated real recoveries exhausted default quota; fixtures were isolated/budgeted without changing rate policy. First full run's added normal-register fixtures consumed the existing org test budget; outsider was reused and external existing-account setup used another genuine invitation registration. Final target and full gate passed; failures were not counted as PASS, no retries/timeouts masked them.

Tek skip existing production controlled crash route disabled olduğu için `error-pages.spec.ts` expected skip'idir; backend/Testcontainers skipped0. Normal successful flows actual backend/PostgreSQL; no route.fulfill. Only failure injection/late real-response relay are explicitly TEST-ONLY. QA expiry timestamp only own UUID; fresh prepared DB outside ORM/cache verified status/roles/team. QA projects archived by their IDs; users/volumes not deleted. Test account/archive metadata remain possible.

Private source/JUnit/command/exit/screenshots `.local/invitations-remediation/`; secrets/raw auth traces yayınlanmadı. Final services/source/Swagger health details are recorded in the final plan evidence.

## Remaining issues

Onaylanan dört INV finding'i kapalı, final quality gate yeşil. **Bağımsız dependency/release follow-up açık:** `source-map-js@1.2.1` is now reported HIGH in npm production graph (`Next16.3.6 → PostCSS8.5.23`), plus Tailwind dev chain. Reviewed advisory affected range>=1.0.0,<1.2.2; patched1.2.2; indexed source-map offsets can cause event-loop DoS. [GitHub reviewed advisory](https://github.com/advisories/GHSA-68fv-2mgg-jv7q).

App source'da direct SourceMapConsumer/source-map parsing kullanımı bulunmadı; CSS tooling imports görüldü. Untrusted PDA runtime reachability/exploit yeniden üretilmedi; `omit=dev` classification tek başına exploit proof değildir. Package/lock files bu remediation'da değişmedi. Existing ESLint/braces5 high dev debt de sürüyor. Eski5 high/production0 sayılarını güncel diye kullanma.

Minimum separate öneri: semver-compatible transitive source-map-js1.2.2 lock update, clean install ve ilgili build/gate validation. Bu dört finding dışında dependency değişikliği için ayrıca karar/onay alınmalı; release waiver verilmedi. SMTP/inbox delivery bu scope'ta açılmadı/doğrulanmadı; API token/UI chains real pass değildir anlamına gelmez, email delivery ayrı sınırdır.

## Kullanıcı kontrolü

1. Aynı sekmede recipient B Davetler/preview aç→logout→başka nonmember C login; C eski name/message/preview görmemeli. Gerçek kişisel hesaplarda leak yeniden üretimi yapma; QA regression bunu kanıtladı.
2. QA expired invitation manager history'de Expired; live pending count/candidate false invitation state yok. Resend fresh pending üretir; expired clear sonra new invite mümkün, old token grant vermez.
3. Projects sıcak iken mail/legacy token accept→Projelere git: new card ve sidebar erişimi reload olmadan görünmeli.
4. External failure404 expired;429 bekleme/rate message; network/server retry. Normal valid link register→real project/team çalışmalı.
5. Bu implementation completion ve [planı](../../PDA_INVITATIONS_REMEDIATION_PLAN.md) incele. Yeni dependency advisory'si için separate1.2.2 patch kararı gerekiyor. Commit/push/staging kullanıcıya bırakıldı.
