# Project Invitations & Create UX

## Final verdict

**Onaylanan scope tamamlandı; canonical pre-push PASSED, exit0.** 2026-10-08.

[Onaylı plan](../../PDA_PROJECT_SERVICE_INVITATIONS_AND_CREATE_UX_PLAN.md), [kaynak prompt](../../.agents/PDA_Project_Service_Invitations_and_Create_UX_Plan_and_Implementation.md). Tasklar sırayla implementation -> targeted test -> fix/retest -> DoD -> checkbox -> next task akışıyla kapatıldı.

Branch `project-service-backend`, HEAD `677607eb6d09950377ca45ecb7dde12146a8d1e2`; HEAD/index/kullanıcı prompt hash'i korundu. Commit/push/staging/pull/merge yok. Ayrı Next.js dependency security follow-up açık; bu kayıt global release waiver değildir.

## Task checklist

| Task | Durum |
| --- | --- |
|1 Preflight/baseline |[x] |
|2 Effective pending list/count |[x] |
|3 Event-time name/V60 foundation |[x] |
|4 Count hooks/nested nav/badges |[x] |
|5 Banner lifecycle/verified gaps |[x] |
|6 Notification context/read/cache |[x] |
|7 Combined real regression |[x] |
|8 Full gate/docs/health/Git checks |[x] |

Organization excluded; archived incoming PENDING exclusion retained. Details and per-task evidence are in the plan.

## Invitation domain audit

Existing project invitation model/create/accept/reject/resend/cancel/token/TTL/role/team membership retained. Incoming effective PENDING now applies active-project EXISTS to both content and totals; unfiltered history keeps archived physical PENDING rows. Manager history/count behavior keeps existing effective expiry. No organization invitation entity/API/UI was invented.

## Sidebar Teams navigation

Native Teams disclosure exposes All Teams and manager-only Team Invitations. Existing canonical ?section=teams and aliases/deep team routes retained. Logical route/project/actor remount boundaries reset stale disclosure; ordinary filters do not. Collapsed sidebar uses existing nonmodal Base UI flyout; mobile child navigation closes drawer. Navbar stays viewport centered with existing reserve/history/chat behavior.

## Global incoming invitation badge

Own recipient page-total query size1 serves sidebar and heading; no count endpoint/client filtering. Unknown/error/disabled has no stale/fake0 badge.0-1-2-1-0 real flow; 99+ visual with exact accessible count and three languages.

## Project team invitation badge

Separate actor+project manager total, reused by parent/child and manager heading. Manager/contained visibility guard hides cached disabled totals. No mixing with own incoming or notification unread.

## Project creation banner preview

Existing ImagePicker/usePickedImage/ProjectCard and POST201 then PUT204 reused. Opt-in create-banner decode reports corrupt image and preserves prior valid preview/draft; generation guard prevents stale completion, bitmap/temp URLs released. Existing MIME/empty/2MiB bounds remain; no upload on selection. Replace/remove/reselect/unmount, negative create/upload and fresh DB bytes/version proved. German320 sticky row wraps; explicit one-column EntityGrid bounds narrow cards. Server existing MIME/magic/size/auth authority unchanged; client decode is a UX check, not a replacement for server validation.

## Project invitation notification context

Public scalar Created/Accepted/Rejected gain nullable event-time projectName; compatible old constructors/JSON. V60 nullable bounded snapshot with subset CHECK; no backfill/older migration edits. Existing AFTER_COMMIT/REQUIRES_NEW and recipient/self policy unchanged. TR/EN/DE plain-text context survives rename/read/history; no per-row name lookup or dead project link. Legacy null uses generic localized body. popupPresentedAt remains distinct from readAt; task/repository read-on-open retained.

## Organization invitation capability

MISSING FEATURE / Pending product decision, approved outside this scope.

## Cache / polling behavior

Private actor keys, project actor keys, AbortSignal and existing cancel/remove boundaries; mutation prefixes reused. staleTime0 plus focus/reconnect and30s foreground polling for active count/list observers; no new socket/provider. Count transport error recovery never invents0. Real account-switch late response regression and warm legacy/external acceptance passed.

## Authorization / account isolation

Existing session/cookie/CSRF/CORS/roles/permission model and ENV unchanged. Own recipient API and active project MEMBER_MANAGE manager API remain separate; unauthorized403/foreign404/token expiry and uniqueness preserved. Plain text only; names bounded160. No dependency/lock/config changes, user data/volumes not deleted. QA fixtures are explicitly labelled; own projects archived through existing API, metadata may remain.

## Responsive / accessibility / i18n

320/390/768/1024/1440, TR/EN/DE, light/dark/reduced motion; native keyboard/touch44, flyout/disclosure/current child/drawer focus and clipping. Actual screenshots inspected. Existing navbar/header reserve, full-close/dock persistence and landing inert isolation passed.

## Changed files

Backend: ProjectInvitationRepository/MyProjectInvitationController; ProjectInvitationService/public events; Notification entity/InvitationContext/factory/writer/listener/controller; V60. Frontend: count hooks/keys/shared badge; AppShell/ProjectSidebarNav/TeamsSidebarMenu; invitation headings/PageHeader; create-banner/ImagePicker/image-validation/sticky actions; EntityGrid; notification types/body and TR/EN/DE. Tests: real pending/count/context/banner/repository specs, owned prepared DB/isolated invitation-registration helpers, related navigation/chat/nickname/teams fixtures and backend repository/API/notification/migration tests. Scoped API/database/architecture/folder/design/SECURITY/checklist notes updated; global checklist boxes unchanged.


Review entry points:

- [Incoming repository predicate](../../backend/src/main/java/com/pda/project/infrastructure/repository/ProjectInvitationRepository.java), [public events](../../backend/src/main/java/com/pda/project/ProjectInvitationEvents.java), [V60](../../backend/src/main/resources/db/migration/V60__invitation_notification_context.sql).
- [Count hooks](../../frontend/src/features/invitations/hooks.ts), [Teams disclosure](../../frontend/src/components/layout/teams-sidebar-menu.tsx), [shared badge](../../frontend/src/features/invitations/components/pending-invitation-badge.tsx).
- [Create banner](../../frontend/src/features/projects/components/create/banner-pick-field.tsx), [decode validation](../../frontend/src/lib/media/image-validation.ts), [notification center](../../frontend/src/features/notifications/components/notification-center.tsx).
- [Real badge regression](../../frontend/e2e/invitation-badges.spec.ts), [banner lifecycle](../../frontend/e2e/project-banner-lifecycle.spec.ts), [context/read regression](../../frontend/e2e/invitation-notification-context.spec.ts).

## Test results

| Command / stage | Actual result |
| --- | --- |
|Task7 clean targeted backend |83 tests,0 failure/error/skip,exit0 |
|Task5 final banner/settings/logo package; final responsive package |34 PASS;13 PASS, lint/type/build0 |
|Task6 notification package; extended context |12 PASS;1 PASS, lint/type/build0 |
|Task7 combined Chromium; final count/nav |34 PASS;2 PASS, lint/type/build0 |
|First canonical |Backend548 PASS; Chromium306 PASS,6 failed,1 expected skip,16 did not run;exit1 |
|Second canonical |Backend548 PASS; Chromium327 PASS,1 failure,1 expected skip;exit1 |
|Fixed full-failure target |47 PASS;lint/type/build0 |
|Default-quota fixture target |9 PASS;lint/type/build0 |
|Final `.\pre-push\pre-push.cmd` |**PASSED exit0;backend548/0/0/0;Chromium328 PASS+1 expected skip;lint/type/build/Docker build/start/health** |
|`npm.cmd audit --json`; `npm.cmd audit --omit=dev --json` |6 high /1 high;both exit1, independent follow-up |
|Final runtime/source |V60;frontend3000/backend8080/Swagger/API docs200; context schema present; HEAD/index/prompt/protected60 files unchanged, staged0, diff-check0 |

Canonical runs execute full `mvnw.cmd clean verify`, frontend lint/TypeScript/production build, `npm run test:e2e` and Docker stack build/start/HTTP smoke. node_modules existed: canonical optional npm ci step was skipped, not claimed as executed. Only expected Chromium skip is the existing disabled production controlled crash route; backend/Testcontainers skipped0.

First full run exposed shared-recipient0 assumptions, undisclosed old Teams anchors/stale nickname fixture and genuine implicit grid track overflow. Tests now use an isolated real invitation-registration recipient and current principal, exercise the disclosure, and preserve all business/draft/socket assertions. Explicit grid-cols-1 fixed measured320px overflow. Second full run caught real429 in existing onboarding: three new recipient registrations consumed its quota. A manager-run-scoped private QA recipient fixture is reused across those three specs; actual signup/login/membership remains real, quota/ENV/assertions unchanged. Target47 and quota9 then final full canonical passed. Earlier failures never counted as PASS; no retries/timeouts used to mask them.

Final Docker backend running (HTTP health200), PostgreSQL healthy; Next dev restored on3000 after canonical stopped its own production test server. Post-cleanup health/schema rechecked200, Flyway latest60.46 current-suite own QA projects archived through authenticated existing API; user accounts/volumes not deleted, old QA/account/archive metadata may remain. Private safe command/JUnit/DB/geometry/screenshots are under `.local/project-invitations-create-implementation/` and scoped `.local/notification-history/project-task*`; auth traces/credentials not published.

## Remaining issues

Current npm audit6 high/exit1, omit=dev1 high/exit1: independent Next16.3.6 advisory follow-up; prior5/production0 historical. Reviewed advisory patched16.3.8; npm suggests16.4.0. No images.remotePatterns in current config (specific SSRF advisory excludes this configuration), no draftMode/use-cache use found; limited source check is not exploit/reachability audit or release waiver. Separate dependency decision required, existing dev debt remains. [Reviewed Next SSRF advisory](https://github.com/advisories/GHSA-cjq9-62q9-8jv4), [reviewed cache advisory](https://github.com/advisories/GHSA-mcj8-r9mp-w47p). SMTP delivery remains unverified/out of scope. No global blocker-free/release claim.

## API / Swagger inventory

Cookie session for protected APIs; mutations require existing CSRF. No new route/matcher. Full contract notes: [SECURITY11](../../.agents/SECURITY.md#11-api-and-swagger-security), [API](../../.agents/api.md).

| Method / path under `/api/v1` | Request / scope | Success / important errors |
| --- | --- | --- |
|GET `/project-invitations/me` |principal;page,size,status=PENDING or omitted |200;400/401;active-project pending predicate, omitted history retained |
|GET `/projects/{p}/invitations/all` |active manager MEMBER_MANAGE;status,page,size |200;400/401/403/404;effective expiry |
|POST `/projects/{p}/invitations` |manager+CSRF;teamId,roles,exactly-one userId/email;external names,message? |201 token once/no-store;400/401/403/404/409 |
|POST `/projects/{p}/invitations/{i}/resend`; DELETE same `{i}` |manager+CSRF;no body;active target team |200 fresh token/id;204 cancel;401/403/404/409;expired clear/renew semantics retained |
|POST `/project-invitations/{i}/accept` /reject |principal recipient+CSRF;accept no body,reject optional message |200 membership /204;400/401/403/404/409 |
|POST `/projects/{p}/invitations/{i}/accept` /reject |token body;recipient+CSRF;matching scope/identity/expiry |200 /204;400/401/403/404/409 |
|POST `/project-invitations/external/preview` |public+CSRF;token |200;400/403/404/429;temporary error remains distinct |
|POST `/project-invitations/external/accept` |session+CSRF;token,matching account email |200 accepted;400/401/403/404/409/429 |
|POST `/auth/register/invitation` |public+CSRF;token+matching identity/nickname/credentials |200 accepted;400/403/404/409/429 |
|GET `/notifications` /unread-count |own principal;page,size,read filter |200;400/401;only nullable invitationContext response addition |
|PATCH `/notifications/{id}/read` /read-all |own+CSRF;no actor body |200;401/403/404;readAt/context retained |
|POST `/notifications/team-deletions/claim` |own+CSRF;no body |200 /204;401/403;presentation remains distinct from read |
|POST `/projects` |session+CSRF;name,projectType and existing optional fields |201;400/401/403/404 |
|PUT `/projects/{p}/banner`; GET; DELETE |multipart file/active PM+CSRF for writes;active member read |204 /200 /204;400/401/403/404;existing MIME/magic/2MiB bounds |

Safe create example: `{"teamId":"<QA-team-uuid>","userId":"<QA-user-uuid>","roles":["TESTER"]}`. Own count uses `?status=PENDING&page=0&size=1`; nullable notification context is display only, no grant. Swagger `http://localhost:8080/swagger-ui/index.html`, `/v3/api-docs`; normal login/CSRF for mutations. No raw credential/token published.

## User controls

1. Own incoming two projects: accept/reject changes global/sidebar/heading total together; archived project excluded from PENDING but remains in history.
2. Manager selected project: Teams toggle/All Teams/Team Invitations, collapsed flyout/mobile drawer, count distinct from incoming; navbar stays original center.
3. Before save choose/replace/remove banner, then corrupt file: prior valid preview preserved, visible localized error; successful save loads real card, upload failure leaves created project with warning.
4. Invite named project, rename, open notifications/read/history: old context retains name; future event uses new name, legacy generic remains; popup alone does not read.
5. Review final completion/plan and separate Next dependency follow-up. Commit/push/staging left to user.

## Dependency follow-up update - 2026-10-08

The Next16.3.6 production finding above is the historical pre-patch state. User-approved separate official Next/eslint16.3.8 patch is now verified: production audit0/exit0, full audit5 dev high from braces (user-approved upstream follow-up), clean ci/lint/type/build/targeted/full canonical PASS. Original UX gate/source numbers remain historical; see [separate Next security completion](2026-10-08-next-security-remediation.md).
