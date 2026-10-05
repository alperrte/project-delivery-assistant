# Organization ↔ Project Integration Remediation

## Final verdict

**FULLY ALIGNED — yalnız Organization ↔ Project temel ilişki ve onaylı remediation kapsamı.**

2026-10-05. [Source of truth plan](../../PDA_ORGANIZATION_PROJECT_INTEGRATION_PLAN.md) Task1–8 sırasıyla uygulandı: implementation → targeted test → DoD → checkbox → next task. Bu, [ilk audit kaydından](2026-10-05-organization-project-integration-audit.md) ayrı implementation teslimidir. Başlangıç/final branch `project-service-backend`, HEAD `9831a0b`; index değişmedi. Commit/push/staging/pull/merge/branch değişimi yok. Kullanıcının mevcut dosyaları korundu.

Canonical **pre-push PASSED, exit0**: backend full464 test (failure/error/skip0), lint, TypeScript, production build, full Chromium232 passed+1 expected skip, Docker build/start/health. Backend healthy; önceki Next dev3000 yeniden başlatıldı HTTP200.

## Closed findings (OP-001…OP-006, OP-R1)

| Finding | Durum / minimum düzeltme | Kapanış kanıtı |
| --- | --- | --- |
| OP-001 HIGH | CLOSED: expected absent/archived org için non-throwing Optional lookup; outer Home transaction rollback-only olmuyor | ProjectHomeApiIntegrationTest; gerçek co-manager archive/Home200, FK retained |
| OP-002 MEDIUM | CLOSED: create/settings explicit none; create omitted, update explicitnull; owned liste boşken de field mevcut | Gerçek UI POST/PUT/body/GET ve her adımda PostgreSQL prepared UUID read |
| OP-003 MEDIUM | CLOSED: project root + affected old/new org projects prefix/bütün sayfalar invalidation | Sıcak client navigation move/remove/assign/rename/linked create/archive; mutation sonrası hard reload yok |
| OP-004 MEDIUM | CLOSED: current association label safe Home summary’den; unavailable retained FK standalone sanılmıyor | Co-manager doğru label+same-ID save; archived label/remove DBnull |
| OP-005 LOW | CLOSED: safe server capability ile owner link/non-owner plain text | Owner true/co-manager false; owner-only profile GET403 hâlâ geçerli |
| OP-006 LOW | CLOSED: ayrı projects loading/error/retry/visibility-filtered empty ve page clamp | Gerçek success; ayrı TEST-ONLY abort/latency;21-row last-page shrink/retry gerçek DB dataset |
| OP-R1 | CLOSED: önce gerçek race yeniden üretildi, sonra mevcut owner row lock reuse edildi | Baseline barrier: archiveCommittedBeforeAssociation=true (1 failure,0 errors); fix create ve changed update=false; bounded futures tamamlandı |

Race testindeki ilk repository spy delegation hatası düzeltildikten sonra invariant’tan kaynaklanan gerçek kırmızı kanıt alındı; hata PASS sayılmadı. Archive lock ile association validation/write aynı transaction boundary’de serialize oluyor; yeni infrastructure/trigger/lock modeli eklenmedi.

## DB / API behavior

Schema/migration değişmedi. Nullable `projects.organization_id` UUID FK, Organization0..N Project / Project0..1 Organization, NO ACTION delete ve mevcut index korunuyor. Organization archive FK'leri **retained** tutar; projeler otomatik detach/archive/cascade edilmez. Project archive organization ve sibling projeleri değiştirmez. Organization owner ile ProjectMembership ayrı; owner otomatik proje erişimi almaz.

Yeni endpoint yok. Home active organization summary’sine additive `canViewOrganization` boolean eklendi; yalnız navigation hint, authorization boundary değil. Owner/email/private metadata eklenmedi. Archived/absent org Home200 `organization:null`; Project detail non-null retained UUID’yi sunmaya devam eder. `requireActive` ve owner-protected profile/media reject davranışı korunur.

### API / Swagger inventory

Base `/api/v1`. Session mevcut cookie auth; mutasyonlar mevcut CSRF ister. Genel hatalar: malformed/validation400, session401 (CSRF-valid request), yetki/CSRF403, missing/archived404. No ADMIN bypass. Full project PUT’ta omitted/null organizationId clear; sameID preserve; changed non-null hedef active actor-owned olmalı.

| Method/path | Auth/scope | Request | Success / association effect |
| --- | --- | --- | --- |
| POST `/organizations` | session+CSRF | name, optional profile metadata/notes | 201 profile+Location; principal owner |
| GET `/organizations` | session, own active | page≥0/size1..100 | 200 owned page/picker |
| GET `/organizations/{id}` | active owner | UUID | 200 profile; foreign403 |
| PUT `/organizations/{id}` | active owner+CSRF | full metadata | 200 profile, association unchanged |
| POST `/organizations/{id}/archive` | active owner+CSRF | body yok | 204, project FK retained |
| GET `/organizations/{id}/projects` | session, active org + caller project membership | page/size | 200 visible ProjectResponse page; owner inheritance yok |
| POST `/projects` | session+CSRF | name, organizationId?, projectType?, other metadata | 201 ProjectResponse+Location; null/owned target; first manager |
| GET `/projects` | session, active memberships | page/size | 200 same ProjectResponse/card page for standalone+linked |
| GET `/projects/{id}` | PROJECT_VIEW | UUID | 200, nullable organizationId |
| GET `/projects/by-slug/{slug}` | PROJECT_VIEW | slug | 200 settings source |
| GET `/projects/{id}/home` | PROJECT_VIEW | UUID | 200; `{organization:null}` or `{id,name,slug,canViewOrganization}` |
| PUT `/projects/{id}` | PROJECT_UPDATE+CSRF; active owned changed target | name/priority/status required; full metadata; organizationId nullable | 200 ProjectResponse; assign/remove/move; foreign403, missing/archived new target404 |
| POST `/projects/{id}/archive` | PROJECT_ARCHIVE+CSRF | body yok | 204; org/sibling unchanged |

Safe examples: `{"name":"Example Project","projectType":"WEB"}` and `{"name":"Example Project","priority":"MEDIUM","status":"PLANNING","organizationId":null}`. Non-null target must be an actual owned active UUID; UI sentinel never goes on wire. Swagger existing configuration: `http://localhost:8080/swagger-ui/index.html`; normal cookie login/CSRF. Final runtime `/v3/api-docs` GET200 and `canViewOrganization` schema were verified. API docs/ENV/security defaults were not changed. [SECURITY §11](../../.agents/SECURITY.md#11-api-and-swagger-security).

## Standalone / assign / remove / move behavior

- Create A seç→none: POST organizationId omitted; PostgreSQL NULL. İlk create’te hiç org seçmemek de standalone.
- Settings standalone→A→B→none: gerçek PUT UUID/UUID/null, fresh backend GET ve her adımda physical PostgreSQL eşleşmesi.
- Same-ID non-owner co-manager metadata save korunur; org target ownership yeniden genişletilmez. Archived retained association açıklayıcı unavailable label gösterir; explicit detach hâlâ mümkün.
- Cancel/reset/dirty/type/date/task-mode/media davranışları ve TR/EN/DE/keyboard/light-dark/320–1440px mevcut UI token’larıyla doğrulandı.

## Authorization / IDOR

Backend new-target active/owner + project permission kontrolü yapar. Foreign/unknown/archived target, unauthorized move, nonmember, gerçek ADMIN nonmember, missing CSRF ve anonymous senaryoları reddedildi; rejected mutation DB association'ını bozmadı. Co-manager owned target’a meşru move yaptıktan sonra üyelikten çıkarıldı: FK retained, organization owner kendi profile’ını görebilse de project GET403 ve visible organization projects total0. Bu owner→project inheritance olmadığını fiziksel/API kanıtla gösterir. Cookie/CORS/session/CSRF matcher veya RolePolicy gevşetilmedi.

## Cache behavior

[invalidateProjectMutation](../../frontend/src/features/projects/query-invalidation.ts) mevcut projects root invalidation’ı ve old/new organization projects page prefix’lerini birlikte yönetir. Linked create new; remove/archive old; move old+new; aynı-org project metadata update ilgili ProjectRow’u tazeler. Unrelated organization/root metadata için gereksiz refetch zorlanmaz. Org rename mevcut organizations-root + ProjectHome predicate helper ile kalır.

Sıcak listeler gerçek Next client navigation ile kontrol edildi; mutation sonrası hard reload fix olarak kullanılmadı. Fixture başlangıç tazelemesi ve persistence reload testleri ayrı amaçlıdır. Projects retry bütün org projects sayfalarını stale yapar; dataset küçülürse clamp edilen previous page eski count'u göstermez. Page failure/slow response profile header'ı kaldırmaz; loading/error/retry ve caller-visible empty semantiği ayrı.

## Runtime / direct DB evidence

- `organization-project-db.ts` yalnız QA UUID’leri için PostgreSQL container içindeki **prepared UUID query** ile fiziksel organization_id okur; credentials ve kullanıcı verisi basılmaz. UI/network/server/DB her transition’da eşleşti.
- 101 owned organization picker mevcut regression; 101 linked project gerçek backend pages0..5 + API size100/page1 + fiziksel101. FK doğrulandı. Client-only fake filtering/count yok.
- Organization page query ölçümü size30=5, size100=5 prepared statement; per-project lookup büyümesi yok. Performance latency/sınırsız ölçek garantisi verilmedi.
- Başarılı senaryolar gerçek backend/PostgreSQL kullanır; route.fulfill yok. Abort/latency/failed-page sadece açık TEST-ONLY hata fixture’ı; retry response gerçek server’dır.
- QA own IDs archive edildi; kullanıcı kayıtları/volume’leri silinmedi. Test accounts/archived metadata/history kalabilir. `.local/org-project-remediation/` log/JUnit/screenshot/source evidence Git dışında; secrets/auth raw trace yayınlanmadı.

## Changed files

- Backend: [OrganizationService](../../backend/src/main/java/com/pda/project/organization/application/OrganizationService.java), [ProjectService](../../backend/src/main/java/com/pda/project/application/service/ProjectService.java), [ProjectHomeService](../../backend/src/main/java/com/pda/project/application/service/ProjectHomeService.java), [ProjectHomeResponse](../../backend/src/main/java/com/pda/project/api/dto/response/ProjectHomeResponse.java).
- Frontend: create/settings/detail/overview, project types, [query invalidation](../../frontend/src/features/projects/query-invalidation.ts), [organization detail](../../frontend/src/features/organizations/components/organization-detail.tsx), TR/EN/DE catalogs.
- Tests: [Project API](../../backend/src/test/java/com/pda/project/integration/ProjectApiIntegrationTest.java), [Home API](../../backend/src/test/java/com/pda/project/integration/ProjectHomeApiIntegrationTest.java), [association E2E](../../frontend/e2e/organization-project-association.spec.ts), [direct DB helper](../../frontend/e2e/organization-project-db.ts).
- Documents: source plan, audit report closure, API/SECURITY/database/architecture/folder/design scoped notes and relevant web checklist note. Audit completion record was not overwritten as implementation proof.

## Test results

| Command / stage | Result |
| --- | --- |
| OP-R1 baseline `mvnw.cmd -Dtest=ProjectApiIntegrationTest#organizationArchiveCannotCommitBetweenValidationAndAssociationWrite test` | Expected red exit1;1 failure0 errors; archive passed paused association |
| Task2 targeted Home/Project API/repositories/org service | 28 passed, failure/error/skip0 |
| Task3 UI create/association | 9 passed; lint/type/build exit0 |
| Task4 backend + UI | 20 backend +5 Chromium passed |
| Task5 warm cache + existing picker/rename | 6 Chromium passed |
| Task6 organization/association/loading/error/last page | 15 Chromium passed |
| Task7 `mvnw.cmd -Dtest=ProjectApiIntegrationTest,ProjectHomeApiIntegrationTest,ProjectRepositoryTest,OrganizationServiceTest,OrganizationRepositoryTest test` | 31 passed, failure/error/skip0, exit0 |
| Task7 association/picker/org/create/logo/chat/task-mode/landing Chromium package | 68 passed, exit0 |
| `npx.cmd playwright test e2e --project=chromium` | 232 passed+1 expected skip, exit0 |
| `./pre-push/pre-push.cmd` | **PASSED exit0**; clean verify464, lint/type/build, Chromium232+1 expected skip, Docker build/start/health |
| Full backend JUnit aggregation | 464 tests,0 failures/errors/skips; Testcontainers enabled |
| `npm.cmd audit --json`; `npm.cmd audit --omit=dev --json` | Full5 high/exit1, production0/exit0; previous independent dev debt |

Existing production controlled crash route is disabled; `error-pages.spec.ts` has1 expected skip. It is not a hidden application failure or Testcontainers skip. Initial test issues (spy abstract delegate, initial stale API fixture setup, duplicate sidebar/list link, target outside global first page) were fixed and rerun; cached total after last-page retry was a real scoped issue fixed with prefix invalidation. No failed test remains in final gate. Stage commands/exit/logs are in private evidence; old audit counts were not reused as new success evidence.

## Remaining issues

**Kalan blocker yok.** No open OP-001…006 or OP-R1 in approved scope. Existing ESLint→fast-glob→micromatch→braces **5 high dev** advisories remain a separate maintenance issue; production audit0. This verdict is not a dependency/release waiver. New package/lock/ENV/Compose/migration changes were not introduced. Organization card name/logo enrichment, organization membership inheritance and hard-delete are outside this scope.

### Kullanıcı kontrolü

1. Create’te org seçip none’a dön; standalone kaydet. Settings’te none→A→B→none kaydet; reload ve Home’da doğru relation/null olsun.
2. A/B organization listelerini açıp project move/rename/create/archive yap; client navigation ile geri dön, eski row/relation kalmasın.
3. Başka sahibin org'una bağlı projede co-manager doğru name görsün; Home link yerine plain text; metadata same-ID save ve explicit detach çalışsın. Organization profile’a doğrudan access403 kalsın.
4. Yalnız kendi QA org'unu archive ederek linked Project Home200 ve retained association kontrolünü yap; gerçek kullanıcı org'unu test amaçlı archive etme (unarchive yok).
5. Projects list loading/error/retry/empty, pagination ve üç dil/mobile/tema davranışlarını kontrol et. [Planı](../../PDA_ORGANIZATION_PROJECT_INTEGRATION_PLAN.md) ve bu completion kaydını incele. Çalışma ağacı commitlenmemiştir; commit/push kullanıcıya bırakıldı.
