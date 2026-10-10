# Security Policy

This document defines the mandatory security rules for **PDA — Project Delivery Assistant**.

These rules apply to all contributors, coding agents, backend/frontend implementations, configuration changes, pull requests, and releases.

Security-sensitive decisions must not be weakened or bypassed for convenience.

---

## 1. Environment Variables and Secrets

### Mandatory rules

- Secrets must **never be hard-coded** in source code, configuration classes, Dockerfiles, frontend bundles, test fixtures, documentation examples, or committed configuration files.
- Sensitive values must be provided through environment variables or an approved deployment secret mechanism.
- The real `.env` file must **never be committed or pushed to GitHub**.
- `.env.example` may be committed, but it must contain only placeholder/example values and must not expose any real credential, token, password, signing key, API key, or production endpoint secret.
- Frontend variables prefixed with `NEXT_PUBLIC_` are considered public and must **never contain secrets**.
- Production secrets must never be bundled into frontend JavaScript.

### `.env` change approval rule

Any contributor or coding agent that needs to:

- add a new environment variable,
- rename an existing environment variable,
- remove an environment variable,
- change the meaning of an existing environment variable,
- modify `.env`,
- modify `.env.example`,

must **ask for explicit approval before making the change**.

After approval:

1. `.env.example` must be updated with a safe placeholder/default.
2. The local `.env` contract must be updated consistently.
3. The change must be documented in the related task/PR/handoff.
4. No real secret may appear in committed files, logs, screenshots, Swagger examples, issue descriptions, PR descriptions, or chat output.

Production must fail fast when a required security-sensitive configuration is missing.

---

## 2. GitHub and Repository Safety

Coding agents must **not push, merge, publish releases, modify repository settings, or perform GitHub actions on behalf of the team** unless explicitly authorized for that exact action.

Agents may:

- prepare code,
- prepare commands,
- prepare commit messages,
- prepare PR descriptions,
- prepare security recommendations,
- report files that should be committed.

The human developer remains responsible for:

- `git add`,
- commits,
- pushes,
- merges,
- releases,
- repository security settings.

Before every push, the repository's local pre-push quality gate must be run:

```powershell
.\pre-push\pre-push.cmd
```

A push must not proceed unless the result is:

```text
PDA PRE-PUSH CHECK PASSED
Safe to git push.
```

---

## 3. Authentication Token Storage

Authentication tokens must **never** be stored in:

- `localStorage`,
- `sessionStorage`,
- IndexedDB,
- readable frontend state persisted to disk.

Access and refresh tokens must be stored in **HttpOnly cookies**.

Production authentication cookies must use secure cookie settings, including:

- `HttpOnly`,
- `Secure`,
- an explicitly selected `SameSite` policy,
- an appropriate path/domain scope.

`SameSite` must be finalized according to the deployment/domain topology.

Because authentication uses cookies, **CSRF protection must not be blindly disabled**.

---

## 4. JWT and Session Security

- JWT signing secrets/keys must come only from backend environment/deployment secrets.
- JWT signing material must never be sent to the frontend.
- Access tokens must remain short-lived.
- Refresh tokens must support rotation and revocation.
- Persisted refresh tokens must never be stored as plaintext.
- Persisted refresh token values must be stored as secure hashes.
- Logout must revoke the appropriate refresh/session state.
- Reusing an invalidated refresh token must not silently create a new session.
- Sensitive authentication values must never be logged.
- An anonymous request (for example a `401` probe) must not allocate a server-side `HttpSession`: the security chain uses `NullRequestCache`, so no `JSESSIONID` is issued outside the OAuth login flow (`SecurityBaselineTest` guards this).

---

## 5. Password Security

- Passwords must never be stored as plaintext.
- Passwords must never be stored using reversible encryption.
- PDA uses Spring Security `BCryptPasswordEncoder`.
- Passwords must never appear in logs, exceptions, Swagger examples, audit events, or debugging output.
- Password reset / initial-password flows must not expose persisted plaintext credentials.

---

## 6. Authorization and RBAC

Authorization must always be enforced by the backend.

Frontend role-based visibility is a UX feature only and must never be treated as a security boundary.

### Mandatory RBAC rules

- Access must follow **deny-by-default** behavior.
- No endpoint may remain unintentionally public.
- Public endpoints must be explicitly allowlisted and documented.
- All protected endpoints must have appropriate authentication and authorization checks.
- Global and project-scoped authorization rules must not be mixed accidentally.
- Technical positions such as `BACKEND_ENGINEER`, `FRONTEND_ENGINEER`, `FULL_STACK_DEVELOPER`, `TESTER`, and `UI_DESIGNER` must not implicitly grant API authorization unless the project authorization model explicitly requires it.
- No role, endpoint, administrative action, project action, or sensitive operation may be left without a defined authorization rule.
- Cross-project resource access must be prevented.
- A user must not gain access to another project merely by knowing an entity ID.

Authorization decisions must be verified server-side before reading or mutating protected data.

---

## 7. SQL Injection and Database Security

- Database access must use Spring Data JPA, Hibernate, parameterized queries, or safe query builders.
- User input must never be directly concatenated into SQL strings.
- Dynamic sort fields, column names, filters, and similar query controls must use explicit enums or allowlists.
- Native SQL, when genuinely required, must use parameter binding.
- Database credentials must come from environment/deployment secrets.
- Production database accounts should follow the principle of least privilege.
- Hibernate schema mutation modes such as `create`, `create-drop`, or `update` must not be used in production.
- Production schema evolution must be managed by Flyway.
- Target production behavior remains:

```properties
spring.jpa.hibernate.ddl-auto=validate
```

---

## 8. Input Validation

All external input must be treated as untrusted.

Backend validation is the source of truth.

Use:

- Jakarta Validation,
- strongly typed DTOs,
- UUID/date/number/enum types where appropriate,
- explicit allowlists,
- length/range constraints,
- format validation,
- nullability rules.

Frontend validation may improve UX but must never replace backend validation.

Invalid input must fail safely and must not expose internal implementation details.

---

## 9. CORS

Production CORS configuration must use an explicit origin allowlist.

The following must **not** remain in production:

```text
*
allow all origins
allow all headers without need
allow all methods without need
```

Allowed origins must come from approved configuration such as:

```text
ALLOWED_ORIGINS
```

Credentials-based requests must never be combined with an unsafe wildcard-origin configuration.

---

## 10. CSRF

Because PDA uses cookie-based authentication:

- CSRF protection must be explicitly designed and tested.
- CSRF must not be disabled globally merely to make development easier.
- State-changing requests must use the selected CSRF protection strategy.
- CORS is not a replacement for CSRF protection.

---

## 11. API and Swagger Security

### Organization profile and media (2026-10-04)

2026-10-05 notes extension: organization POST/PUT JSON and profile response also include optional `notes` (<=1000, trimmed plain text, blank/missing→null on full PUT). Existing owner/CSRF checks apply. Notes are separate from description and rendered as escaped text, never HTML; no new endpoint or authorization model.


All reads require an authenticated active organization owner; global ADMIN has no owner bypass. Mutations require CSRF. Creation assigns the owner from the session, never JSON.

| Method/path | Request | Success | Important failures |
|---|---|---|---|
| `POST /api/v1/organizations` | JSON `{name,description?,website?,contactEmail?,location?}` | `201` profile + Location; caller becomes owner | `400` validation, `401` session, `403` CSRF |
| `PUT /api/v1/organizations/{id}` | Same JSON; omitted/blank optional metadata becomes null; media unchanged | `200` profile | `400`, `401`, `403` owner/CSRF, `404` missing/archived |
| `GET /api/v1/organizations` | `page=0`, `size=20` | `200` owned paginated profiles | `400`, `401` |
| `GET /api/v1/organizations/{id}` | UUID | `200` profile + nullable metadata + opaque `logoVersion`/`coverVersion` | `401`, `403`, `404` |
| `PUT /api/v1/organizations/{id}/logo` or `/cover` | multipart `file`; PNG/JPEG/WebP | `204` replacement stored | `400` empty/type/size/dimensions, `401`, `403`, `404`, `409` conflict, `503` storage |
| `GET /api/v1/organizations/{id}/logo` or `/cover` | UUID, optional `v` cache buster | `200` detected MIME + bytes; private/no-store, nosniff, sandbox | `401`, `403`, `404` missing/archived/no image, `503` storage |
| `DELETE /api/v1/organizations/{id}/logo` or `/cover` | UUID, no body | `204` idempotent removal | `401`, `403`, `404` |

Safe JSON: `{"name":"Example Studio","website":"https://example.com","contactEmail":"team@example.com","location":"İstanbul"}`. Name <=160, description <=2000, website <=2048, email <=254, location <=200. Website allows only HTTP/HTTPS with host and without credentials/control characters; no remote fetch. Logo <=512 KiB; cover <=2 MiB; dimensions <=6000 each and <=24 million pixels through `ImageSniffer`. Signature/header/dimension checks are not full decoding. Client MIME/filename never select paths.

Media `ProblemDetail.code`: `ORGANIZATION_MEDIA_EMPTY`, `ORGANIZATION_MEDIA_INVALID_TYPE`, `ORGANIZATION_MEDIA_TOO_LARGE`, `ORGANIZATION_MEDIA_DIMENSIONS`, `ORGANIZATION_MEDIA_CONFLICT`, `ORGANIZATION_MEDIA_UNAVAILABLE`. Metadata retains generic ProblemDetail/invalidFields. Existing servlet upload rejection maps to `400`, not `413`. Swagger only with existing `API_DOCS_ENABLED=true`: `/swagger-ui/index.html`, `/v3/api-docs`. Authenticate through normal cookie session; mutations use existing CSRF token. Storage approval/controls are in §18.


### Project Teams ve kayıtlı kullanıcı davetleri (2026-09-30)

Swagger kontrolü: `API_DOCS_ENABLED=true` ile `/swagger-ui/index.html`; önce `GET /api/v1/auth/csrf`, ardından oturum açma. Tüm yollar access cookie ister; POST/PUT/DELETE işlemleri ayrıca `X-XSRF-TOKEN` ister. `PROJECT_VIEW` aktif proje üyeliği, `SQUAD_MANAGE` ve davet yönetimi Project Manager yetkisi gerektirir. Hatalar `ProblemDetail` döner. `page>=0`, `size=1..100`.

| Endpoint | Yetki | Güvenli örnek girdi | Başarı | Önemli hatalar |
| --- | --- | --- | --- | --- |
| `GET /api/v1/projects/{projectId}/teams` | `PROJECT_VIEW` | `?page=0&size=20` | `200` sayfalı ekipler, `parentTeamId`, `memberCount`, `updatedBy`, `memberPreview`, `lastJoined` | `400`, `401`, `403` |
| `GET /api/v1/projects/{projectId}/teams/{teamId}` | `PROJECT_VIEW` | UUID path | `200` ekip | `401`, `403`, `404` |
| `POST /api/v1/projects/{projectId}/teams` | `SQUAD_MANAGE` | `{"name":"Backend","description":"API","parentTeamId":null,"includeCreator":true}` | `201` ekip; ilk ekipte oluşturan zorla eklenir | `400`, `401`, `403`, `404` parent |
| `PUT /api/v1/projects/{projectId}/teams/{teamId}` | `SQUAD_MANAGE` | `{"name":"API","description":"Services"}` | `200` ekip | `400`, `403`, `404` |
| `PUT /api/v1/projects/{projectId}/teams/{teamId}/parent` | `SQUAD_MANAGE` | `{"parentTeamId":"<team-uuid>"}` | `200` ekip | `400`, `403`, `404`, `409` `TEAM_CIRCULAR_PARENT` |
| `DELETE /api/v1/projects/{projectId}/teams/{teamId}` | `SQUAD_MANAGE` | UUID path | `204` | `403`, `404`, `409` `TEAM_HAS_CHILDREN`, `TEAM_ARCHIVE_WOULD_ORPHAN` (ekipsiz kalacak üye adları body'de); bekleyen davetler iptal edilir |
| `GET /api/v1/projects/{projectId}/teams/{teamId}/candidates` | `SQUAD_MANAGE` | `?q=ali` (en az 2 karakter, en çok 20 sonuç) | `200` `[{userId,nickname,status}]`, `status`: `TEAM_MEMBER`, `PROJECT_MEMBER`, `INVITED`, `NONE` | `400`, `403`, `404` |
| `GET /api/v1/projects/{projectId}/teams/{teamId}/members` | `PROJECT_VIEW` | `?page=0&size=20` | `200` sayfalı nickname/email/project roles | `400`, `403`, `404` |
| `POST /api/v1/projects/{projectId}/teams/{teamId}/members` | `SQUAD_MANAGE` | `{"userId":"<active-project-member-uuid>"}` | `201` üye | `400`, `403`, `404`, `409` `TEAM_MEMBER_EXISTS` |
| `DELETE /api/v1/projects/{projectId}/teams/{teamId}/members/{userId}` | `SQUAD_MANAGE` | UUID path | `204` | `403`, `404`, `409` `TEAM_LAST_MEMBERSHIP` |
| `GET /api/v1/project-invitations/me` | Oturum sahibi | `?page=0&size=20` | `200` yalnız kendine gelen davetler; `teamName` dahil | `400`, `401` |
| `GET /api/v1/project-invitations/{invitationId}/preview` | Yalnız davet edilen hesap | Kendi davetinin UUID'si | `200` ad, slug, açıklama, durum, tür, teknoloji, üye sayısı, güncelleme zamanı, logo sürümü ve (2026-10-10) nullable `bannerVersion`; `Cache-Control: private, no-store` | `401`, `404` başka alıcı/silinmiş proje |
| `GET /api/v1/project-invitations/{invitationId}/logo` | Yalnız davet edilen hesap | Kendi davetinin UUID'si | `200` proje logosu; `private, no-store`, `nosniff` | `401`, `404` başka alıcı/logo yok |
| `GET /api/v1/project-invitations/{invitationId}/banner` (2026-10-10) | Yalnız davet edilen hesap, yalnız bekleyen (PENDING) kendi daveti, canlı proje | Kendi davetinin UUID'si | `200` proje kapak görseli; kayıtlı Content-Type, `private, no-store`, `nosniff`, `inline` | `401`, `404` başka alıcı/üye, cevaplanmış veya süresi dolmuş davet, arşivlenmiş/silinmiş proje, banner yok; GET dışı yöntemler `403` (deny-by-default) |
| `POST /api/v1/project-invitations/{invitationId}/accept` | Yalnız davet edilen hesap | Body yok | `200` project membership | `401`, `403` CSRF, `404` başka alıcı, `409` beklemiyor/üye |
| `POST /api/v1/project-invitations/{invitationId}/reject` | Yalnız davet edilen hesap | `{"message":"Şu an uygun değilim"}`; isteğe bağlı, en çok 500 | `204` | `400`, `401`, `403` CSRF, `404` başka alıcı, `409` beklemiyor |
| `GET /api/v1/projects/{projectId}/invitations/all` | Project Manager | `?status=PENDING&page=0&size=20` | `200` durum ve rejectionMessage içeren sayfalı geçmiş | `400`, `401`, `403` |

Mevcut `POST .../invitations` artık zorunlu `teamId` (projenin aktif ekibi; başka projenin ekibi `404`, eksik `400`) taşır ve aktif kayıtlı `userId` veya e-posta kabul eder (`{"userId":"<registered-user-uuid>","roles":["TESTER"]}` → `201`; bilinmeyen hesap `404`, tekrar/aktif üye `409`). Eski tokenlı accept/reject yolları yalnız gerçek hedef hesap için çalışır. Yeni davet yanıt yolları da 10 istek/10 dakika/IP/yol hız sınırına dahildir (`429`). `.env`, auth cookie, CSRF veya rol matrisi değişmedi.

Ekipler yeniden tasarımı (2026-10-01): proje kurucusu `projects.created_by` projeden çıkarılamaz ve Project Manager rolü düşürülemez (`409` `PROJECT_OWNER_PROTECTED`); son Project Manager `409` `LAST_PROJECT_MANAGER` döner. `candidates` yalnız aktif kullanıcı adı döner, e-posta sızdırmaz. Dış davet önizlemesi ve kabul yanıtı ekip adını açığa çıkarmaz.

### Notification Service endpoints

Swagger check path: `/swagger-ui/index.html` with `API_DOCS_ENABLED=true`; call `GET /api/v1/auth/csrf`, log in, then use the routes below. All routes require the access cookie and address only the current user's records. PATCH additionally requires `X-XSRF-TOKEN`. Errors use `ProblemDetail`.

| Endpoint | Auth / scope | Input / safe example | Success | Important errors |
| --- | --- | --- | --- | --- |
| `GET /api/v1/notifications` | Authenticated, own records | `?page=0&size=20&read=false&type=TASK_ASSIGNED; optional read=true for history; legacy unreadOnly retained`; size 1–100 | `200` paged content with type, text, read timestamps, actor/project/resource IDs and nullable task statusChange snapshot | `400` invalid filter/page, `401` unauthenticated |
| `GET /api/v1/notifications/unread-count` | Authenticated, own records | None | `200 {"count": 5}` | `401` |
| `PATCH /api/v1/notifications/{notificationId}/read` | Authenticated, own record + CSRF | UUID path, no body | `200` updated notification | `400` bad UUID, `401`, `403` CSRF, `404` missing or other user's record |
| `PATCH /api/v1/notifications/read-all` | Authenticated, own records + CSRF | No body | `200 {"count": 2}` (number changed) | `401`, `403` CSRF |
| `DELETE /api/v1/notifications/{notificationId}` (2026-10-10) | Authenticated, own READ record + CSRF | UUID path, no body | `204`, `Cache-Control: private, no-store`; physical delete | `400` bad UUID, `401`, `403` CSRF, `404` unknown, other user's, or own UNREAD record (indistinguishable) |
| `DELETE /api/v1/notifications?read=true` (2026-10-10) | Authenticated, own READ records + CSRF | `read` required and must be `true`; body ignored | `200 {"count": n}`; deletes only the principal's read (history) rows, unread never touched | `400` missing/false/invalid `read`, `401`, `403` CSRF |

Deletion (2026-10-10): one new matcher line `DELETE /api/v1/notifications/*` and `/api/v1/notifications` (`authenticated`), deny-by-default kept; parameterized JPQL scoped to `recipientUserId = principal AND read = true`. No table references `notifications` (physical delete safe, no migration). `TeamDeletionPublicationRecovery` replays only incomplete publications, so a deleted read `SQUAD_DELETED` row is not recreated; the popup claim works only on unread rows. Covered by `NotificationDeletionIntegrationTest`.



### Squad deletion and own notification presentation - 2026-10-06

Existing team DELETE and legacy archive adapters enforce active project SQUAD_MANAGE/PROJECT_MANAGER, CSRF and scoped IDs; no founder/global ADMIN bypass. Permission checks after waiting use fresh scalar active-role data with the existing RolePolicy. Project-first/ordered-team/invitation lock revalidation serializes invitation grants with deletion. Soft-delete retains history and current pool semantics; no authorization/session/CORS/cookie/ENV model change.

| Endpoint | Scope/body | Success | Important failures |
| --- | --- | --- | --- |
| POST `/api/v1/notifications/team-deletions/claim` | Session principal own records + CSRF; no body/actor/ID |200 one own notification or204; private/no-store |400 nonempty body,401 no active session,403 CSRF |
| DELETE `/api/v1/projects/{p}/teams/{t}` | Active PROJECT_MANAGER + CSRF; no body |204 retained soft-delete/history, one committed event |403 permission/CSRF,404 missing/deleted/wrong project,409 children/orphan |

Claim sets popupPresentedAt atomically on oldest unread SQUAD_DELETED; read/readAt stays independent. At-most-once grant may lose a popup when the response is lost after commit; durable own history remains. Fanout uses committed immutable recipient snapshot, replay event/recipient dedup and existing registry recovery; rollback creates no notification. Additive nullable teamDeletion snapshot carries bounded plain text. Actor-scoped frontend notification cache/AbortSignal/lifetime cleanup prevents prior-user responses/toasts surfacing after logout/login. No browser auth/private list persistence.

Team memberPreview adds safe real first/last names only after project/team authorization; no email/global directory expansion. Each preview item also returns `roles` (project role names in enum order, 2026-10-10) from the existing membership batch; roles are labels only, never grant access, and add no query or email. Existing manager invitation list batch adds safe inviter nickname/photo version and target photo version; target email privacy/token rules retained. Swagger `/swagger-ui/index.html` and `/v3/api-docs`, normal login/CSRF. Delete/claim have no JSON body; safe team create `{"name":"Example Team","includeCreator":true}`.


### Own nickname profile update - 2026-10-07

| Endpoint | Auth / request | Success | Expected errors |
| --- | --- | --- | --- |
| PUT `/api/v1/users/me/profile` |Active authenticated own principal+CSRF, nickname-only JSON `{"nickname":"Yeni_ad"}` |200 existing own AuthenticatedUser, private/no-store |400 NICKNAME_INVALID/unknown identity fields;409 NICKNAME_TAKEN;401 session;403 CSRF/foreign route/forced password |

Nickname alphabet and length: see "Nickname contract (2026-10-10)" below (supersedes the 2026-10-07 letter/number/underscore-only rule); case-sensitive uk_users_nickname constraint retained; shared Unicode White_Space trim, no NFC/casefold/migration/backfill. Active own row lock and unique flush prevent concurrent duplicate; narrow constraint mapping does not expose another user. User DynamicUpdate prevents unrelated stale photo/password writes reverting nickname; actual PostgreSQL barriers verified. No email/UUID/session/refresh/provider/role fields changed or accepted from client. JWT subject remains UUID and fresh UserAccounts principal supplies nickname. Existing current/future email login/refresh/forced-password/admin/OAuth/photo tests pass.

### Nickname contract (2026-10-10)

One rule for every path that stores a nickname: local registration (`POST /api/v1/auth/register`), invitation registration (`POST /api/v1/auth/register/invitation`) and own profile update (`PUT /api/v1/users/me/profile`). The only source is `com.pda.user.NicknameRules` (public API at the root of the User module, so Auth DTOs may use it without breaking Modulith boundaries; it moved from `user.domain`). `RegisterRequest`, `InvitationRegisterRequest`, the `User` entity (`@Pattern`) and the profile service all use `NicknameRules.REGEX` / `normalize` / `valid`; there is no second copy of the regex on the backend.

- **Allowed:** Unicode letters (`\p{L}`), Unicode digits (`\p{N}`), `_`, `-` and a single ordinary space (U+0020) between words; 3 to 32 code points (surrogate pairs count once). Regex: `(?=[\p{L}\p{N}_ -]{3,32}\z)[\p{L}\p{N}_-]+(?: [\p{L}\p{N}_-]+)*`. Examples: `Hamza Taşbay`, `Çağrı Öztürk`, `Hamza_Taşbay-27`.
- **Trim on every path:** leading and trailing Unicode White_Space is removed (`NicknameRules.normalize`) by the DTO constructors and the profile service before validation, so the stored value is the validated value. Inner characters are never rewritten: consecutive spaces, tab, NBSP and other Unicode spaces, control characters and invisible characters (zero-width space, BOM, ...) are rejected, never silently converted to `_`/`-` or collapsed. Consecutive spaces are a distinct, explicit validation message on the client; the server answers the same way as for any invalid nickname.
- **Error contract unchanged:** profile update `400 NICKNAME_INVALID` (and unknown identity fields), `409 NICKNAME_TAKEN`; registration returns `400` with `invalidFields: ["nickname"]` (no new code). Uniqueness stays case-sensitive (`uk_users_nickname`), no NFC/casefold, no migration or backfill; existing nicknames remain valid under the wider rule.
- **System-generated nicknames (OAuth):** `UserAccountService.nicknameBase` keeps letters/digits/`_`/`-`, collapses whitespace runs to one space, turns other character runs into one `_`, trims edges, cuts surrogate-safely to 24 code points (room for the uniqueness suffix) and falls back to `user`. This is server-generated text, not user input, so normalising is intentional.
- **Identity is unaffected:** login is by e-mail, the JWT subject is the user UUID, memberships and sessions are keyed by UUID; a nickname containing spaces never reaches a path, header or query as an identifier.
- **Rendering:** a nickname is always rendered as plain text (React text nodes, no `dangerouslySetInnerHTML`, no markup parsing). `@mention` storage stays `@[uuid]` on the server; the client only offers a space-containing query while typing and encodes the longest nickname first.
- **Frontend mirror (UX only, the server decides):** `features/account/nickname.ts` (`NICKNAME_PATTERN`, `normalizeNickname`, `validNickname`, `nicknameProblem`) is the single client validator used by `features/auth/schemas.ts`, the invitation registration form and the profile field.
- **Rename propagation:** `nicknameIdentityQuery` clears only cached projections that carry display identities (project list pages, dashboard, project home, by-slug/detail, reminders, admin user list, in addition to members/squads/chat/tasks); no global cache clear.

Fresh DTO session cache writes and query cancellation are same-actor/lifetime guarded; prior-user late mutation cannot overwrite next account. PDA history checks readonly actual adjacent native entry against authenticated app route policy; unavailable/public/auth/external boundaries disabled, browser controls/route authorization unchanged. No auth token/private history storage or global history rewrite. Swagger `/swagger-ui/index.html`/`/v3/api-docs`, normal login/CSRF; no credentials in examples.

Swagger/OpenAPI is intended for development and testing.

- Swagger/OpenAPI must be enabled in development/test environments as required.
- Production Swagger must be disabled by default.
- Its state must be controlled through:

```text
API_DOCS_ENABLED
```

When a backend API group or feature is completed, the implementer/agent must report:

1. the endpoint,
2. the HTTP method,
3. authentication requirements,
4. required role/access scope,
5. request body or query parameters,
6. example safe input,
7. expected success response/status,
8. important expected error cases.

The developer may then verify the completed API through Swagger.

Swagger examples must never contain real passwords, JWTs, cookies, API keys, production emails used as secrets, or other sensitive data.

### Auth Faz 4 endpoints (refresh rotation and active sessions)

Swagger check path: `/swagger-ui/index.html` with `API_DOCS_ENABLED=true`; call `GET /api/v1/auth/csrf` first, then login, refresh, sessions, revoke. All POSTs require `X-XSRF-TOKEN`; errors are `ProblemDetail`; responses are `Cache-Control: no-store`.

| Endpoint | Auth / scope | Input | Success | Important errors |
| --- | --- | --- | --- | --- |
| `POST /api/v1/auth/refresh` | Public route; needs valid `PDA_REFRESH` cookie + CSRF | No body | `200`, new `PDA_ACCESS`/`PDA_REFRESH` cookies | `401` invalid/expired/logged-out/reused token (cookies cleared; reuse revokes the session), `403` CSRF, `429` IP limit (30/10 min) |
| `GET /api/v1/auth/sessions` | Access cookie; USER/ADMIN, own sessions only | No body | `200`, list of `{id, createdAt, lastUsedAt, expiresAt, userAgent, current}` | `401` no/invalid access cookie |
| `POST /api/v1/auth/sessions/{sessionId}/revoke` | Access cookie + CSRF; own sessions only | `sessionId` UUID path | `200` (auth cookies cleared if it is the current session) | `401`, `403` CSRF, `404` not owned or inactive |
| `POST /api/v1/auth/sessions/revoke-others` | Access cookie + CSRF | No body | `200`, `{"revoked": 1}` | `401`, `403` CSRF |

### Auth Faz 5 endpoints (Google OAuth login and account linking)

Google login is optional: with `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` empty the two redirect routes are not registered and stay deny-by-default (`403`), and link start returns `404`. Setting only one variable stops startup. Authorized redirect URI to register at Google: `http://localhost:8080/api/v1/auth/oauth2/callback/google`. Swagger cannot run the redirect flow: open `http://localhost:8080/api/v1/auth/oauth2/authorization/google` in the browser; the result lands on `FRONTEND_URL` as `/` (cookies set) or `/login?oauth_error=<code>`. Use Swagger for `identities`, `link`, `unlink` after logging in.

| Endpoint | Auth / scope | Input | Success | Important errors |
| --- | --- | --- | --- | --- |
| `GET /api/v1/auth/oauth2/authorization/google` | Public (only when Google is configured) | Optional `intent=link` (only honoured after `POST .../google/link` in the same HTTP session) | `302` to `accounts.google.com` with `state`, `nonce`, PKCE `code_challenge` | `403` disabled or unknown provider, `429` IP limit (30/10 min) |
| `GET /api/v1/auth/oauth2/callback/google` | Public, called by Google; needs the state-bound HTTP session | `code`, `state` | `302` to `FRONTEND_URL/` with PDA cookies, or `/?oauth_link=<code>` in link mode | `302` to `/login?oauth_error=` `email_not_verified`, `account_exists`, `access_denied`, `provider_error`; `429` |
| `GET /api/v1/auth/oauth/identities` | Access cookie, own identities only | No body | `200`, `[{provider, email, linkedAt}]` | `401` |
| `POST /api/v1/auth/oauth/google/link` | Access cookie + CSRF | No body | `200`, `{authorizationUrl}` to navigate the browser to | `401`, `403` CSRF, `404` Google not configured |
| `POST /api/v1/auth/oauth/google/unlink` | Access cookie + CSRF | No body | `200` | `401`, `403` CSRF, `404` not linked, `409` Google is the only login method |

Rules: no automatic account merge (an existing email returns `account_exists`); provider tokens are never stored or logged; new accounts need a verified provider email; the provider-side HTTP session is invalidated after the callback and PDA issues its own cookies; redirects go only to `FRONTEND_URL`.

### Auth Faz 6 endpoints (GitHub OAuth login and account linking)

GitHub uses the same model and the same handlers as Google. It is optional: with `GITHUB_CLIENT_ID`/`GITHUB_CLIENT_SECRET` empty its two redirect routes are not registered (`403`) and link start returns `404`; setting only one variable stops startup. Register an OAuth App at GitHub with the callback URL `http://localhost:8080/api/v1/auth/oauth2/callback/github`. Scopes: `read:user`, `user:email`. GitHub is plain OAuth2 (no ID token) and its profile email is optional and unverified, so after the token exchange the backend calls `GET https://api.github.com/user/emails` once and accepts only the primary, verified address; otherwise login is rejected with `email_not_verified`. The token is never stored or logged. Login start is `http://localhost:8080/api/v1/auth/oauth2/authorization/github` in the browser.

| Endpoint | Auth / scope | Input | Success | Important errors |
| --- | --- | --- | --- | --- |
| `GET /api/v1/auth/oauth2/authorization/github` | Public (only when GitHub is configured) | Optional `intent=link` (honoured only after `POST .../github/link` in the same HTTP session) | `302` to `github.com` with `state`, PKCE `code_challenge` | `403` disabled or unknown provider, `429` |
| `GET /api/v1/auth/oauth2/callback/github` | Public, called by GitHub; needs the state-bound HTTP session | `code`, `state` | `302` to `FRONTEND_URL/` with PDA cookies, or `/?oauth_link=<code>` | `302` to `/login?oauth_error=` `email_not_verified`, `account_exists`, `access_denied`, `provider_error`; `429` |
| `POST /api/v1/auth/oauth/{provider}/link` (`google` or `github`) | Access cookie + CSRF | No body | `200`, `{authorizationUrl}` | `401`, `403` CSRF, `404` unknown or unconfigured provider |
| `POST /api/v1/auth/oauth/{provider}/unlink` (`google` or `github`) | Access cookie + CSRF | No body | `200` | `401`, `403` CSRF, `404` unknown or not linked, `409` last login method |

Link result codes on `/?oauth_link=`: `linked`, `already_linked`, `linked_to_another_account`, `provider_already_linked`, `account_unavailable`. `GET /api/v1/auth/oauth/identities` lists both providers.


### Auth Faz 7 (roles and permissions; no new endpoints)

Faz 7 adds no HTTP endpoint, ENV key, dependency or migration. Roles are labels; what they may do is defined only in `com.pda.user.RolePolicy` (deny by default, unknown/empty/`null` input grants nothing, no custom roles). `ADMIN` is a platform operator (`GlobalRole`): it holds `PlatformPermission` (`USER_MANAGE`, `SESSION_MANAGE`, `AUDIT_VIEW`, `SYSTEM_VIEW`; enforced from Faz 8) and has **no** implicit project authority; it is never a project membership. A project role grants no platform permission.

| Project role | Project permissions |
| --- | --- |
| `PROJECT_MANAGER` | all: `PROJECT_VIEW`, `PROJECT_UPDATE`, `PROJECT_ARCHIVE`, `MEMBER_MANAGE`, `TASK_MANAGE`, `LABEL_MANAGE`, `TASK_WORK`, `ISSUE_PARTICIPATE`, `ISSUE_MANAGE`, `TEST_REPORT_WRITE` |
| `BACKEND_DEVELOPER`, `FRONTEND_DEVELOPER`, `FULL_STACK_DEVELOPER`, `AI_ML_DEVELOPER`, `UI_UX_DEVELOPER`, `ANALYST` | `PROJECT_VIEW`, `TASK_WORK`, `ISSUE_PARTICIPATE` (identical contributor rights) |
| `TESTER` | contributor rights + `TEST_REPORT_WRITE` |

Several roles in one project combine by union. Project creation is open to any authenticated user, who becomes the first `PROJECT_MANAGER`. Task, label and test-report endpoints do not exist yet; their permissions are defined so those services enforce them with `ProjectAccess.hasPermission(projectId, userId, permission)`.

Authorization rule of every sensitive endpoint that exists today:

| Endpoint | Rule |
| --- | --- |
| `POST /api/v1/projects` | authenticated user; becomes `PROJECT_MANAGER` |
| `GET /api/v1/projects`, `GET /api/v1/organizations/{id}/projects` | authenticated; only projects the caller is a member of |
| `GET /api/v1/projects/{id}`, `/by-slug/{slug}` | `PROJECT_VIEW` in that project (else `403`) |
| `PUT /api/v1/projects/{id}` | `PROJECT_UPDATE` |
| `POST /api/v1/projects/{id}/archive` | `PROJECT_ARCHIVE` |
| `DELETE /api/v1/projects/{id}` | `PROJECT_ARCHIVE` **and** the caller is the project's founder (`createdBy`); permanent delete, `204`, no body. `401` no session, `403` CSRF missing / not a member / not a Project Manager / not the founder, `404` unknown or archived project. No global `ADMIN` bypass; a second Project Manager is refused |
| `GET /api/v1/projects/{id}/members`, `/members/{userId}` | `PROJECT_VIEW` |
| `POST|PUT|DELETE .../members/**` (roles, remove member) | `MEMBER_MANAGE`; the last Project Manager cannot be removed |
| `/api/v1/organizations/**` | organization owner rules (not project roles) |
| `/api/v1/auth/**` | public entries listed above; everything else own-account only |
| everything else | denied |

### Auth Faz 8 endpoints (admin backend, password change)

New migration `V7__user_must_change_password.sql` (`users.must_change_password`, default false). No new ENV keys (`ADMIN_EMAIL`, `ADMIN_INITIAL_PASSWORD` already exist). Admin routes are `hasRole("ADMIN")` at the URL layer **and** re-checked in the service with `RolePolicy` (`AdminAuthorization`); unauthenticated admin calls return `401`, non-admins `403`. All responses are `Cache-Control: no-store`, errors are `ProblemDetail`, all POSTs need `X-XSRF-TOKEN`.

Swagger check path: `/swagger-ui/index.html` with `API_DOCS_ENABLED=true`: `GET /api/v1/auth/csrf`, log in as the bootstrapped admin, call `POST /api/v1/auth/password/change`, log in again with the new password, then use the admin endpoints below.

| Endpoint | Auth / scope | Input | Success | Important errors |
| --- | --- | --- | --- | --- |
| `POST /api/v1/auth/password/change` | Access cookie + CSRF (also allowed while a forced change is pending) | `{currentPassword, newPassword (8-128), confirmNewPassword}` | `200`; other sessions revoked, forced-change flag cleared | `400` wrong current / same password / mismatch / invalid, `401`, `403` CSRF, `429` IP limit (5/10 min) |
| `GET /api/v1/admin/users?page&size&search&status` | ADMIN (`USER_MANAGE`) | size clamped 1..100; `status` is only `ACTIVE`, `DISABLED` or `PENDING_VERIFICATION` (`DELETED` anonymised accounts and unknown values are rejected) | `200` page of `{id,email,nickname,accountStatus,emailVerificationStatus,globalRole,mustChangePassword,createdAt}` | `400` invalid `status`/`search`, `401`, `403` |
| `GET /api/v1/admin/users/{id}` | ADMIN | UUID path | `200` user + linked providers + active session count | `400` bad UUID, `404` |
| `POST /api/v1/admin/users/{id}/disable` | ADMIN + CSRF | none | `200`; revokes all target sessions | `404`, `409` self or last active admin |
| `POST /api/v1/admin/users/{id}/enable` | ADMIN + CSRF | none | `200` | `404` |
| `GET /api/v1/admin/users/{id}/sessions` | ADMIN (`SESSION_MANAGE`) | none | `200` active sessions (no token material) | `404` |
| `POST /api/v1/admin/users/{id}/sessions/revoke-all` | ADMIN + CSRF | none | `200 {"revoked": n}` | `404` |
| `POST /api/v1/admin/users/{id}/sessions/{sessionId}/revoke` | ADMIN + CSRF | UUID paths | `200` | `404` |
| `GET /api/v1/admin/overview` | ADMIN (`SYSTEM_VIEW`) | none | `200` user counts + project counts | `401`, `403` |
| `GET /api/v1/admin/projects?page&size` | ADMIN (`SYSTEM_VIEW`) | paging | `200` `{id,name,slug,status,archived,activeMembers,createdAt}` only | `401`, `403` |
| `GET /api/v1/admin/system/status` | ADMIN (`SYSTEM_VIEW`) | none | `200` `{status,database,googleLoginConfigured,githubLoginConfigured,mailEnabled,apiDocsEnabled}` booleans only | `401`, `403` |

Rules: the bootstrapped admin is blocked (`403 password_change_required`) everywhere except `me`, `password/change`, `logout`, `refresh`, `csrf` until the password is changed; the initial password gives no authority afterwards. An administrator cannot disable self or the last active administrator (row lock prevents two admins disabling each other). Disabling revokes every session. The project overview is aggregate metadata, not an access path: an admin who is not a member still gets `403` on project endpoints. Admin actions are logged with actor/target ids only.

### Auth Faz 9 endpoints (forgot / reset password)

New migration `V8__password_reset_challenges.sql` (`password_reset_challenges` table, one row per user, `UNIQUE(user_id)`). No new ENV key: the existing `EMAIL_VERIFICATION_HMAC_KEY` is reused with a domain-separated prefix (`pwd-reset` vs `email-verify`) inside `VerificationCodeHasher`, so a reset code and an email-verification code for the same user/digits never hash to the same value. Reuses the email-verification challenge shape (`PasswordResetChallenge`: hashed 6-digit code, 10 min lifetime, 60 s resend cooldown, 5 attempt limit, one active challenge per user) and the existing `VerificationMailPort`/`SmtpVerificationMailAdapter` (extended with `sendPasswordResetCode`, gated by `MAIL_ENABLED`) rather than duplicating SMTP wiring inside the `auth` module. Both endpoints are `permitAll` + CSRF and IP rate-limited at 5/10 min, the same limit as register (login allows 30/10 min).

Swagger check path: `/swagger-ui/index.html` with `API_DOCS_ENABLED=true`: `GET /api/v1/auth/csrf`, then `POST /api/v1/auth/password/forgot` with a registered email, read the code from server logs/mailbox (`MAIL_ENABLED=true` required), then `POST /api/v1/auth/password/reset`.

| Endpoint | Auth / scope | Input | Success | Important errors |
| --- | --- | --- | --- | --- |
| `POST /api/v1/auth/password/forgot` | Public + CSRF | `{email}` | `202` always, regardless of whether the account exists or is active (no enumeration); a 6-digit code is emailed only when it belongs to an active account and the per-account resend cooldown has elapsed | `400` invalid email, `403` CSRF, `429` IP limit (5/10 min), `503` mail temporarily unavailable |
| `POST /api/v1/auth/password/reset` | Public + CSRF | `{email, code (6 digits), newPassword (8-128), confirmPassword}` | `200`; password replaced, **every session of the account revoked**, a pending forced change (`mustChangePassword`) cleared | `400` invalid fields / confirmation mismatch / wrong or expired code / too many attempts / unknown or inactive account (all reported as the same "code is invalid"-style detail, never distinguishing account existence), `403` CSRF, `429` IP limit (5/10 min) |

**Cumulative wrong-guess limit (V50, 2026-10-03).** Besides the 5 attempts per code, wrong guesses are counted across all codes of the account inside a one-hour window (`window_failures`, `failure_window_started_at`). The 5th wrong guess in the window blocks the reset until the window ends: even the correct code is then refused (`reset_too_many_attempts`) and `forgot` sends no new code, so asking for a fresh code is no way around the limit. The window and counter restart after a successful reset. Trade-off accepted by the product owner: somebody who knows the email can block that account's password reset for up to an hour (the per-IP limit of 5/10 min still applies to them).

Rules: `forgot` checks mail availability before looking up the account, so a `503` never leaks whether the email exists. `reset` never checks the current password (identity is proven by the emailed code instead) and calls the same `UserSessions.revokeAll` used by the admin disable-user flow, so a stolen password immediately loses every existing session, not just future ones. Every `400` from `/password/reset` and `/password/change` carries a machine-readable `ProblemDetail.code` alongside `detail` (`reset_code_invalid`, `reset_code_expired`, `reset_too_many_attempts`, `password_confirmation_mismatch`, `current_password_incorrect`, `password_unchanged`) so the frontend can show a distinct message per case without matching on the human-readable `detail` string; `account_unavailable` on `/password/change` uses the same `code` convention on its `403`.
### External project invitation onboarding endpoints

Swagger check path: `/swagger-ui/index.html` with `API_DOCS_ENABLED=true`. Call `GET /api/v1/auth/csrf` before each public or authenticated POST. Invitation tokens are bearer secrets: submit them only in JSON bodies. The emailed external link keeps the token in the browser fragment (`/register#invitation=...`), so it does not appear in HTTP request paths or query logs. Token-bearing and onboarding responses use `Cache-Control: no-store`.

| Endpoint | Auth / scope | Input | Success | Important errors |
| --- | --- | --- | --- | --- |
| `POST /api/v1/projects/{projectId}/invitations` | Project member with `MEMBER_MANAGE` + CSRF | `{userId, roles, message?}` for an account, or `{email, firstName, lastName, roles, message?}` for an external invite; message at most 100 characters | `201`, one-time token and expiry | `400` invalid fields, `403` no permission/CSRF, `409` pending duplicate or existing member, `429` 10/10 min |
| `POST /api/v1/project-invitations/external/preview` | Public + CSRF | `{token}` | `200`, project name, inviter nickname, roles, message, invitee identity, expiry | `404` invalid, expired, cancelled or used token; `429` 5/10 min |
| `POST /api/v1/auth/register/invitation` | Public + CSRF | `{token,email,firstName,lastName,nickname,password,confirmPassword}` | `200`, `{projectId,projectSlug}`; account and project membership created in one transaction | `400` identity/validation mismatch, `404` unavailable token, `409` account identity already used, `429` 5/10 min |
| `POST /api/v1/project-invitations/external/accept` | Authenticated account whose email matches the invitation + CSRF | `{token}` | `200`, `{projectId,projectSlug}` | `403` wrong account/CSRF, `404` unavailable token, `409` already member, `429` 10/10 min |

Resend and cancel remain manager-only. Resend cancels the prior record and rotates the token. External recipients receive email only; account recipients retain in-app notification and optional email. The inviter receives an in-app acceptance notification after commit. No new environment key is introduced.

### HMZ-PROJ Faz 10 (authorization/security hardening; one new mechanism, no new endpoint)

No new endpoint, ENV key, dependency or migration. `POST /api/v1/projects/{projectId}/invitations`, `.../invitations/{id}/resend`, `.../accept`, `.../reject` are now rate-limited: 10 requests per 10 minutes per IP per exact path (`ProjectInvitationRateLimitFilter`, same sliding-window pattern as `AuthRateLimitFilter`, registered in `SecurityBaselineConfiguration`). A comprehensive authorization-matrix and `ProblemDetail`-shape test pass was added across Project/Membership/Invitation/Criterion/Repository/Squad controllers; no behavior changed, only test coverage.

### HMZ-PROJ Faz 7 endpoints (Project Home aggregate)

New read-only aggregate endpoint; no new ENV key, dependency or migration. Composes only data that already has a safe source inside the Project module (own entities/repositories, `OrganizationService.requireActive`) — never reaches into another module's internals. A GitHub failure on the repository card never fails the whole response; it surfaces as `repository.githubUnavailable: true` instead. Task counts and recent activity are intentionally absent (Work Service and Activity modules expose no public contract yet); squad count is intentionally absent (Squad already depends on Project via `ProjectAccess`, so the reverse direction would create a module cycle — callers get the squad count from the existing squad list endpoint's pagination total instead).

Swagger check path: `/swagger-ui/index.html` with `API_DOCS_ENABLED=true`: `GET /api/v1/auth/csrf`, log in, call `GET /api/v1/projects` to get a `projectId`, then the endpoint below.

| Endpoint | Auth / scope | Input | Success | Important errors |
| --- | --- | --- | --- | --- |
| `GET /api/v1/projects/{projectId}/home` | `PROJECT_VIEW` in that project | UUID path | `200`, `{id,name,slug,status,priority,startDate,targetEndDate,organization\|null,managers[],teamMemberCount,criteriaProgress:{completed,total},repository:{connected,provider,repositoryOwner,repositoryName,defaultBranch,lastCommit\|null,githubUnavailable},createdAt,updatedAt}` | `401` no/invalid access cookie, `403` not a member, `404` project archived/not found |

---

### Project identity and logo endpoints (2026-10-01)

New migration `V34__project_identity.sql` (`project_type`, `tagline`, `updated_by`, `logo_updated_at`, `project_logos`); no new ENV key or dependency. `CreateProjectRequest` now requires `projectType` and accepts `tagline` (max 120) and `techStack` (max 1000); `UpdateProjectRequest` accepts `projectType` and `tagline`. `GET /api/v1/projects` list items additionally return `projectType`, `tagline`, `logoVersion`, `updatedBy {userId,nickname}` and `team {memberCount, preview[]}` (first 5 active members, computed with a fixed number of queries per page; the card no longer calls `/home`).

Logo storage is an approved exception to §18 (see there). Bytes live in the separate `project_logos` table, never in list queries. No new `RolePolicy` action: existing `PROJECT_UPDATE` and `PROJECT_VIEW` apply (deny-by-default kept).

| Endpoint | Auth / scope | Input | Success | Important errors |
| --- | --- | --- | --- | --- |
| `PUT /api/v1/projects/{projectId}/logo` | `PROJECT_UPDATE` + CSRF | multipart `file`, max 512 KB | `204` | `400` `PROJECT_LOGO_INVALID_TYPE` / `PROJECT_LOGO_TOO_LARGE` / empty file, `403` role/CSRF, `404` |
| `DELETE /api/v1/projects/{projectId}/logo` | `PROJECT_UPDATE` + CSRF | none | `204` | `403`, `404` |
| `GET /api/v1/projects/{projectId}/logo` | `PROJECT_VIEW` | none | `200` image bytes; `Content-Type` is the stored type, `X-Content-Type-Options: nosniff`, `Content-Disposition: inline`, `Cache-Control: private, max-age=31536000, immutable` (URL is versioned with `?v=logoVersion`) | `403` not a member, `404` no logo |

Swagger check path: `/swagger-ui/index.html` with `API_DOCS_ENABLED=true`: `GET /api/v1/auth/csrf`, log in, pick a `projectId` from `GET /api/v1/projects`, then call the endpoints above.

### User preferences endpoints (2026-10-02)

New migration `V48__user_preferences.sql` (`user_preferences`); no new ENV key, dependency or `RolePolicy` action. The data is the caller's own interface defaults (language, theme, animation choices), never another user's: the controller takes the user id only from the authenticated principal and there is no id in the path. The two routes are listed explicitly in `SecurityBaselineConfiguration` (deny-by-default kept), registered for CORS (`/api/v1/users/**`, the SPA calls them from another origin) and answer `401` for a missing or expired session so the client renews it instead of showing a permission error.

| Endpoint | Permission | Input | Success | Failures |
|---|---|---|---|---|
| `GET /api/v1/users/me/preferences` | any signed-in user, own data | none | `200` the four saved choices, absent until saved; `Cache-Control: no-store` | `401` |
| `PUT /api/v1/users/me/preferences` | any signed-in user, own data + CSRF | JSON `locale`, `theme`, `motion`, `themeTransition`, all required | `200` the saved choices | `400` unsupported or missing value, `401`, `403` CSRF |

### Project banner endpoints (2026-10-02)

New migration `V47__project_banners.sql` (`projects.banner_updated_at`, `project_banners`); no new ENV key or dependency and no new `RolePolicy` action: existing `PROJECT_UPDATE` and `PROJECT_VIEW` apply (deny-by-default kept; the two new routes are listed explicitly in `SecurityBaselineConfiguration`). The banner mirrors the logo: same storage, same validation, a larger limit. Approved by the product owner's request for a project cover image; see the exception in §18.

| Endpoint | Permission | Input | Success | Failures |
|---|---|---|---|---|
| `PUT /api/v1/projects/{projectId}/banner` | `PROJECT_UPDATE` + CSRF | multipart `file`, max 2 MB | `204` | `400` `PROJECT_BANNER_INVALID_TYPE` / `PROJECT_BANNER_TOO_LARGE` / `PROJECT_BANNER_EMPTY`, `403` role/CSRF, `404` |
| `DELETE /api/v1/projects/{projectId}/banner` | `PROJECT_UPDATE` + CSRF | none | `204` | `403`, `404` |
| `GET /api/v1/projects/{projectId}/banner` | `PROJECT_VIEW` | none | `200` image bytes; stored `Content-Type`, `nosniff`, `inline`, `Cache-Control: private, max-age=31536000, immutable` (URL is versioned with `?v=bannerVersion`) | `403` not a member, `404` no banner |

---

### User profile photo endpoints (2026-10-02)

New migration `V49__user_profile_photos.sql` (`users.profile_photo_updated_at`, `user_profile_photos`); no new ENV key, dependency or `RolePolicy` action. Writes always target the signed-in user (`/me`, no user id in the path or the body, so another account's photo cannot be changed); reading a photo by user id is open to any signed-in user because teammates, invitation senders and managers show it as an avatar. The routes are listed explicitly in `SecurityBaselineConfiguration` (deny-by-default kept), registered for CORS (`/api/v1/users/**`) and answer `401` for a missing session. The API never returns storage metadata: `GET /api/v1/auth/me` and the member, team, card and invitation DTOs carry only `profilePhotoVersion` (epoch milliseconds, absent when there is no photo), used as the `?v=` cache buster. Approved by the product owner's request for profile photos; see the exception in §18.

| Endpoint | Permission | Input | Success | Failures |
|---|---|---|---|---|
| `PUT /api/v1/users/me/profile-photo` | own account + CSRF | multipart `file`, max 5 MB, PNG/JPEG/WebP | `200` `{profilePhotoVersion}` | `400` `PROFILE_PHOTO_INVALID_TYPE` / `PROFILE_PHOTO_TOO_LARGE` / `PROFILE_PHOTO_EMPTY` / `PROFILE_PHOTO_DIMENSIONS`, `401`, `403` CSRF |
| `DELETE /api/v1/users/me/profile-photo` | own account + CSRF | none | `204` (also when there was none) | `401`, `403` |
| `GET /api/v1/users/me/profile-photo` | own account | none | `200` image bytes, `Cache-Control: private, no-cache` | `401`, `404` no photo |
| `GET /api/v1/users/{userId}/profile-photo` | any signed-in user | none | `200` image bytes; stored `Content-Type`, `nosniff`, `inline`, `Content-Security-Policy: default-src 'none'; sandbox`, `Cache-Control: private, max-age=31536000, immutable` (URL versioned with `?v=profilePhotoVersion`) | `400` malformed id, `401`, `404` no photo or inactive user |

Replacing never leaves an orphan (one row per user, overwritten in place); a refused upload changes nothing. Open items: there is no dedicated per-user upload rate limit, and EXIF data is kept as uploaded (no re-encoding).

---

### Project calendar reminders (2026-10-01)

New migration `V35__project_reminders.sql` (`project_reminders`, one index `(project_id, reminder_date)`); no new ENV key or dependency. New module `com.pda.reminder`; membership comes only from `ProjectAccess`. One new `ProjectPermission`: `REMINDER_MANAGE` (held by `PROJECT_MANAGER` only, through `RolePolicy`'s `allOf`). A personal reminder needs nothing beyond being an active member. The new routes are listed in `SecurityBaselineConfiguration` (the default stays deny-all); `PATCH` was already an allowed CORS method.

A reminder has a `scope` fixed at creation: `PERSONAL` (visible to its creator only) or `PROJECT` (visible to every active member). Dates travel as plain `YYYY-MM-DD` (`date`) and optional `HH:mm` (`time`), never as timestamps, so a day cannot shift with the timezone. The caller is always the authenticated principal; there is no recipient field.

| Endpoint | Auth / scope | Input | Success | Important errors |
| --- | --- | --- | --- | --- |
| `GET /api/v1/projects/{projectId}/reminders?from&to` | active member | `from`, `to` (`YYYY-MM-DD`, a range of at most 93 days) | `200` array: every `PROJECT` reminder + the caller's own `PERSONAL` ones in range, ordered by date, time, creation | `400` missing/invalid/too wide range, `403` not a member |
| `POST /api/v1/projects/{projectId}/reminders` | active member + CSRF; scope `PROJECT` needs `REMINDER_MANAGE` | `title` (1-100), `description` (max 500, optional), `type`, `scope` (optional, default `PERSONAL`), `date`, `time` (optional) | `201` | `400` validation / unknown `type` or `scope` / date more than one day in the past, `403` member asking for `PROJECT` or no CSRF |
| `GET /api/v1/projects/{projectId}/reminders/{reminderId}` | active member | none | `200` | `404` unknown id, another project's id, or someone else's `PERSONAL` reminder (existence is not revealed) |
| `PATCH /api/v1/projects/{projectId}/reminders/{reminderId}` | `PERSONAL`: its creator; `PROJECT`: `REMINDER_MANAGE`; CSRF | `title`, `description`, `type`, `date`, `time` replace the editable fields (no `scope`; it is immutable) | `200` | `400`, `403` member editing a `PROJECT` reminder, `404` |
| `DELETE /api/v1/projects/{projectId}/reminders/{reminderId}` | same as PATCH + CSRF | none | `204` | `403`, `404` |

`type` is one of `MEETING`, `DEADLINE`, `PRESENTATION`, `REVIEW`, `DELIVERY`, `WORK`, `OTHER`. The backend returns only the enum name; icons and labels live in the frontend (`reminderTypeConfig`, `reminders.types.*`). "In the past" tolerates one day (the server clock is UTC), and an edit that leaves the date unchanged is never rejected for being old. A reminder is looked up by `(projectId, reminderId)`, so `/projects/B/reminders/{id of an A reminder}` is a `404`.

**When a member leaves the project.** Reminders are not deleted. Every operation starts with the active-membership check, so a removed member gets `403` on list, detail, create, edit and delete, including for their own `PERSONAL` reminders, and no one else can see those (`404` for another member, as before). The rows stay in `project_reminders` unchanged. `PROJECT` reminders belong to the project: they keep working for everyone else, a remaining manager can still edit or delete them, and `creator.nickname` becomes `null` once the creator has left (`creator.userId` stays). If the same user is added back, their membership is reactivated and their earlier `PERSONAL` reminders are visible to them again. Covered by `ReminderApiIntegrationTest` (`aRemovedMembersPersonalRemindersAreKeptButNoLongerReachableByThem`, `aProjectReminderOutlivesTheManagerWhoCreatedItAndStaysManageable`).

Where the permission and the routes live. `REMINDER_MANAGE` is in `com.pda.user.ProjectPermission` and is granted by `RolePolicy` (the documented single source of truth for what a role may do); the three write routes are in `SecurityBaselineConfiguration`'s central allow-list (default deny-all). That is where squad, criteria, repository, task and notification already declared theirs, so no new shared structure was introduced; the `reminder` module itself only depends on the public `ProjectAccess` contract (checked by `ModularityTest`).

Swagger check path: `/swagger-ui/index.html` with `API_DOCS_ENABLED=true`: `GET /api/v1/auth/csrf`, log in, pick a `projectId`, call `POST` without `scope`, then with `"scope":"PROJECT"` as a non-manager (expect `403`).

---

### Project chat (2026-10-03)

New migration `V51__project_chat.sql` (`chat_conversations`, `chat_messages`, `chat_read_states`) and one new dependency, `spring-boot-starter-websocket`; no new ENV key. New module `com.pda.chat`; membership comes only from `ProjectAccess` and people only from `UserAccounts` (checked by `ModularityTest`). Chat is project scoped: one automatic `PROJECT` group per project plus `DIRECT` 1:1 conversations between two members of the same project. No participants table: a direct conversation stores its two users as a canonically ordered pair (`direct_user_low < direct_user_high`, the unsigned `uuid` order PostgreSQL uses), so A-B and B-A are one row and a chat with oneself cannot exist; the group audience is derived from `ProjectMembership`. A message is one row however many people read it; read state is one `(conversation, user, last_read_at)` row, not one per message.

| Endpoint | Who | Request | Success | Errors |
|---|---|---|---|---|
| `GET /api/v1/projects/{projectId}/chat/conversations` | active member | none | `200` `{group, directs[], totalUnread}`; the group is created on first use; directs with someone who left the project are not listed | `403` not a member |
| `GET /api/v1/projects/{projectId}/chat/members` | active member | none | `200` array of the other active members `{userId, nickname, profilePhotoVersion, conversationId}`; never an email | `403` |
| `POST /api/v1/projects/{projectId}/chat/direct/{userId}` | active member + CSRF | none | `200` conversation summary (find or create, race safe) | `400 CHAT_SELF`, `404 CHAT_RECIPIENT` (not an active member of this project), `403` |
| `GET /api/v1/projects/{projectId}/chat/conversations/{conversationId}/messages?before&after&limit` | participant | `before`/`after` message ids of this conversation (not both), `limit` 1-100 (default 30, clamped) | `200` `{messages (oldest to newest), hasMore}` | `400 CHAT_INVALID_REQUEST` (both cursors, unknown or foreign cursor), `404 CHAT_NOT_FOUND`, `403` |
| `POST /api/v1/projects/{projectId}/chat/conversations/{conversationId}/messages` | participant + CSRF | `{content, replyToMessageId?: UUID}` | `201` enriched message, private/no-store | `400 CHAT_MESSAGE_EMPTY\|TOO_LONG\|INVALID`, `404 CHAT_NOT_FOUND\|CHAT_RECIPIENT`, `429 CHAT_RATE_LIMITED` (`Retry-After: 60`), `403` |
| `POST /api/v1/projects/{projectId}/chat/conversations/{conversationId}/read` | participant + CSRF | none | `204`; the read marker only moves forward | `404`, `403` |

Authorization is evaluated on every request, never cached: the caller must be an active member of that very project (an archived project has no members), the conversation is looked up by `(conversationId, projectId)` so another project's id is `404`, and someone else's direct conversation is `404` as well (indistinguishable from "does not exist", so ids cannot be probed). The sender is always the authenticated principal: the request has no sender or recipient field and unknown JSON properties are ignored. Text is validated only in the domain (`ChatMessage.normalize`): CRLF and CR become `\n`, the outer whitespace is stripped, then it must be non-empty (no-break space and zero-width characters count as blank), at most 2000 characters (code points, as the database `CHECK` counts) and free of control characters other than newline and tab. Content is stored and shown as plain text; the frontend never renders it as HTML. Sending is limited to 30 messages per minute per user (`ChatSendRateLimiter`, in memory, same shape as the other limiters, keyed by user id). Message content is never logged (ids only) and never placed in an application event: the realtime push is a direct call after the transaction commits, not a Spring event, because every `@TransactionalEventListener` publication is persisted in `event_publication`; `ChatApiIntegrationTest.messageContentNeverLandsInTheEventPublicationRegistry` guards that.

### Chat replies and reactions (2026-10-05)

Base: `/api/v1/projects/{projectId}/chat/conversations/{conversationId}`. Every endpoint requires the existing cookie session (`401` missing/invalid); scope is active membership of this project plus conversation participation, without ADMIN bypass. Mutations require existing CSRF (`403` missing). Actor is exclusively the principal. Foreign/unknown conversation, reply target or reaction message is `404 CHAT_NOT_FOUND`. No new ENV, cookie, CORS, origin or session policy.

| Method / suffix | Input | Success | Additional important errors |
| --- | --- | --- | --- |
| POST `/messages` | `{content, replyToMessageId?: UUID}`; same-conversation target | `201` Message with quote/version/reactions; private/no-store | `400` text/UUID; inactive direct peer `404 CHAT_RECIPIENT`; existing send `429` |
| GET `/messages?before&after&limit` | scoped cursors; default30/max100 | `200` enriched history; private/no-store | existing `400` cursor errors |
| PUT `/messages/{messageId}/reactions/{emojiCode}` | no body; canonical code | `200` personalized ReactionSnapshot; idempotent; private/no-store | `400 CHAT_REACTION_INVALID`; `429 CHAT_REACTION_RATE_LIMITED`, `Retry-After: 60` |
| DELETE same suffix | no body; only own same-code reaction | `200` current snapshot; absent=no-op; last removal=empty list with increased version | same errors as PUT |
| GET `/messages/reactions?messageIds=...` | 1..50 UUIDs (repeated or comma-separated), all same conversation | `200` personalized snapshot array; private/no-store | malformed/empty/limit `400`; any unknown/foreign ID rejects whole batch `404` |

Codes: `THUMBS_UP`, `HEART`, `LAUGH`, `SURPRISED`, `SAD`, `THANKS`. Safe request example: `{"content":"Thanks for the update","replyToMessageId":"00000000-0000-0000-0000-000000000001"}`; the target must actually exist in the conversation. Message adds `replyTo: null | {id,sender,preview}` (plain-text 140-code-point preview), decimal-string `reactionVersion`, and `reactions: [{code,emoji,count,reactedByCurrentUser}]`. Snapshot is `{messageId,reactionVersion,reactions}`. Legacy rows: null quote / "0" / empty. No reactor list or email exposed.

Writes serialize on the message row; only changed insert/delete advances BIGINT version, within the same transaction. Version/count/actor flags come from one SQL snapshot. After-commit delivery uses a fresh read transaction and one SQL for all active recipients, then personalizes in memory. `REACTIONS` frames: `{type,projectId,conversationId,messageId,reactionVersion,reactions}`. They never change unread, lastMessage, cursor or read state. No-op/rollback has no event; Notification and Spring publication registry are not used. A late callback can publish a newer coherent snapshot. Removed members cannot mutate/receive; an active remaining direct participant can react to accessible history. Reply send still requires the peer active.

Client applies only newer versions, including empty arrays; late MESSAGE cannot overwrite newer reactions. Reconnect and cached reopen query loaded IDs in batches50 through two shared workers per generation; pre-message frames have a 1000-entry / 120-second buffer. Context cleanup aborts old requests and rejects late callbacks. Own queue, forbidden SEND, origin/session guards and 16KB frame cap remain. Tests: ChatApiIntegrationTest, ChatReplyReactionMigrationTest, ChatWebSocketIntegrationTest, chat-cache/chat-replies-reactions/chat-responsive E2E. Swagger when already enabled: `/swagger-ui/index.html`; do not weaken auth or enable docs solely for testing.

**When a member leaves the project.** Nothing is deleted. Every operation starts with the active-membership check, so a removed member gets `403` on overview, history, send and read, and receives no further pushes. The other participant of a direct conversation keeps the history, no longer sees that conversation in the list and gets `404 CHAT_RECIPIENT` when sending to it. The group history stays for everyone who is still a member. If the user is added back, they get access again; unread for the group counts only messages from after their `joinedAt`, so a new member is not flooded.

**WebSocket (`/api/v1/ws`).** Native WebSocket speaking STOMP (no SockJS), configured in `com.pda.chat.infrastructure.websocket`. The endpoint is under `/api` because the HttpOnly `PDA_ACCESS` cookie is scoped to `Path=/api`: the handshake therefore carries the session and is authenticated by `JwtCookieAuthenticationFilter` like any request (`GET /api/v1/ws` is `authenticated()` in `SecurityBaselineConfiguration` and is on the 401 entry-point list; a missing or invalid cookie is `401`). Browsers must come from the configured `FRONTEND_URL` origin (`setAllowedOrigins`, the cross-site WebSocket hijacking guard). A `HandshakeInterceptor` re-checks that the principal is an application user and a handshake handler names the STOMP user by the user id (the default would use the principal's string form, which contains the email). The model is user scoped: a `ChannelInterceptor` allows `CONNECT` only with that identity, `SUBSCRIBE` only to exactly `/user/queue/chat` (which Spring resolves to the caller's own sessions) and refuses `SEND` and every other frame, so no client can listen to somebody else's queue or conversation and nothing a socket sends is routed to application code. A refused frame ends the session with a STOMP `ERROR` frame. Messages are sent over REST (membership, validation, rate limit live there); after commit `StompChatDelivery` resolves the audience from current membership (direct: the two participants if still members; group: the active members, paged) and pushes `{type: "MESSAGE", projectId, conversationId, conversationType, message}` (the message carries `sender: {userId, nickname, profilePhotoVersion}`, never an email) to each recipient's `/user/queue/chat`; marking read pushes `{type: "READ", projectId, conversationId}` to the reader's own sessions only (multi-tab unread sync). Frames are limited to 16 KB, heartbeats are 10 s. **An open socket does not outlive its session.** The cookie filter stores the authenticated session of every request as the request attribute `com.pda.auth.AuthenticatedSession` (`userId`, `sessionId`, `accessExpiresAt`, a public type of the Auth module); the handshake interceptor requires it (no session information, no socket) and keeps it in the socket's attributes. `ChatSocketRegistry` tracks every open socket (a `WebSocketHandlerDecorator` registers on open and forgets on close) and every `chat.ws.session-check-millis` (default 30 s) closes, on the server and with `1008 policy violation`, each socket whose access token has expired (`accessExpiresAt`), whose session is no longer active (`UserSessions.isActive`: logout, revoke, expiry, an admin disabling the account revokes all sessions) or whose account is no longer active. A healthy client does not even notice: every authenticated response carries `X-Access-Token-Expires-In` (milliseconds the presented access token stays valid; a duration, so a wrong browser clock cannot mislead it; exposed to scripts through CORS `Access-Control-Expose-Headers`), and the chat client renews the session 90 s before that and opens a second socket with the new token; only when that one is connected does it take over, the old one is closed 3 s later (make before break: no gap, no `disconnected` state, duplicates are removed by message id). If a renewal fails or the machine slept, the server still closes the socket at expiry and the ordinary reconnect renews the token and catches up over REST. A revoked session cannot reconnect (the handshake is `401`). Token refreshes of the browser are serialized across tabs with the Web Locks API and skipped when another tab renewed the session less than 8 s ago, because the refresh token rotates on use and presenting the previous one ends the whole session. Only the one session is ended: other sessions of the same account stay connected, and membership checks and the `/user/queue/chat` destination are unchanged (pushes are still membership filtered at send time). Worst case a dead session's socket lives one check period (30 s). The frontend keeps one socket for the selected workspace user/project context across authenticated page navigation. It closes all clients and renewal/reconnect timers when that selection/account changes, project access is lost, or the authenticated app/session ends. Late REST and socket callbacks cannot update a later context generation; project chat queries are cancelled and removed during cleanup. X closes the UI while the same context continues receiving unread updates. The landing demo disables the real chat connection. Covered by `ChatWebSocketIntegrationTest` (connect, rejected handshakes, refused subscriptions and frames, direct/group delivery, removal while connected, read sync, closing on revoked session, a valid session staying open, ending one of two sessions), `ChatSocketRegistryTest` (token expiry, inactive session or account, no session information, isolation of failures) and `JwtTokensTest` (token expiry in the identity).

### Task Service backend endpoints (F5)

Swagger check path: `/swagger-ui/index.html` with `API_DOCS_ENABLED=true`. Call `GET /api/v1/auth/csrf`, log in, create/select an active project, then use the endpoints below. All mutations require the `X-XSRF-TOKEN` header and `PDA_ACCESS` HttpOnly cookie. `ADMIN` alone grants no project access. All routes are project scoped and return `ProblemDetail` on errors.

| Endpoint | Auth / scope | Safe input | Success | Important errors |
| --- | --- | --- | --- | --- |
| `POST /api/v1/projects/{projectId}/tasks` | `TASK_MANAGE` | `{ "title": "Prepare demo", "priority": "HIGH" }`; optional description/startDate/deadlineAt (see the 2026-10-02 section) | `201`, Task with stable `taskKey`, number and assignee IDs | `400` fields/dates, `401`, `403`, `404` project, `409` archived project |
| `GET /api/v1/projects/{projectId}/tasks` | `PROJECT_VIEW` | `page=0&size=20&sort=updatedAt,desc`; sort fields: taskNumber/createdAt/updatedAt/deadlineAt/priority | `200`, page, excludes archived tasks | `400` page/sort, `401`, `403`, `404` project |
| `GET /api/v1/projects/{projectId}/tasks/{taskId}` | `PROJECT_VIEW` | UUID path | `200`, Task including `assigneeIds` | `401`, `403`, `404` scoped/archived task |
| `PATCH /api/v1/projects/{projectId}/tasks/{taskId}` | `TASK_MANAGE` | `{ "title": "Prepare final demo", "priority": "HIGH", "description": null, "startDate": null, "deadlineAt": null }` (full basic-field replacement) | `200`, updated Task | `400`, `401`, `403`, `404`, `409` archived/optimistic conflict |
| `PUT /api/v1/projects/{projectId}/tasks/{taskId}/assignees` | `TASK_MANAGE` | `{ "assigneeIds": ["<active-member-uuid>"] }`; empty array clears | `200`, replacement UUID set | `400` nonmember/invalid ID, `401`, `403`, `404`, `409` archived |
| `PATCH /api/v1/projects/{projectId}/tasks/{taskId}/status` | `TASK_MANAGE` or assigned `TASK_WORK` | `{ "status": "TODO" }` | `200`, Task; true change adds one history row and AFTER_COMMIT notification; IN_PROGRESS/DONE includes active project managers | `400`, `401`, `403`, `404`, `409` invalid transition/archived |
| `PATCH /api/v1/projects/{projectId}/tasks/{taskId}/blocked` | `TASK_MANAGE` or assigned `TASK_WORK` | `{ "blocked": true, "reason": "Awaiting review" }` | `200`, Task; no status history | `400`, `401`, `403`, `404`, `409` DONE/archived |
| `GET /api/v1/projects/{projectId}/tasks/{taskId}/history` | `PROJECT_VIEW` | UUID path | `200`, chronological history array | `401`, `403`, `404` |
| `DELETE /api/v1/projects/{projectId}/tasks/{taskId}` | `TASK_MANAGE` | UUID path | `204`, soft archived | `401`, `403`, `404`, `409` archived |

`TaskPriority` defaults to `MEDIUM`; new tasks start `BACKLOG` and unblocked. The existing role model governs Task: `PROJECT_MANAGER` holds `TASK_MANAGE`; contributors and `TESTER` hold `TASK_WORK` for tasks actively assigned to them. Cross-project task IDs return `404` to callers who can read the path project.

### Task progress and manager notification contract (2026-10-06, V56)

Status PATCH remains cookie + CSRF + active project membership, with TASK_MANAGE or TASK_WORK on a task assigned to the caller. SIMPLE additionally permits BACKLOG -> IN_PROGRESS and IN_PROGRESS -> DONE; ADVANCED review/testing transitions stay enforced. Same-status requests are no-ops. True IN_PROGRESS/DONE changes notify all active PROJECT_MANAGER memberships in the same project plus existing task followers, once per recipient; the actor is excluded. Global ADMIN and management of another project confer no recipient status or task permission. Rollback emits no notification.

Own notification list/read responses retain TASK_STATUS_CHANGED and add nullable statusChange{previousStatus,newStatus,taskKey,taskTitle,actorNickname}. Names/titles are snapshots from the successful status transaction; old notifications and queued pre-V56 events continue without snapshots. No recipient or actor IDs are accepted from the status body. Swagger: /swagger-ui/index.html when already enabled, login through /api/v1/auth/csrf + /api/v1/auth/login and use the existing status/notifications routes with normal access cookies and X-XSRF-TOKEN for mutations. No ENV or security architecture change.

### Task Service genişletmesi (2026-10-02, V37–V46)

Swagger check path: `/swagger-ui/index.html` with `API_DOCS_ENABLED=true`. `GET /api/v1/auth/csrf`, log in, pick a `projectId`, then walk: create task (with `deadlineAt`, `labelIds`, `assigneeIds`) → `PUT .../labels` → pool task (`"pool":{"open":true}`) → second user `POST .../claim` → comment with `@[uuid]` → `POST .../attachments` (multipart `file`) and `GET .../attachments/{id}/content` (check `nosniff`, `Content-Security-Policy: sandbox`, `Cache-Control: private`) → sprint create/start/complete → `GET /api/v1/tasks/mine`. Every route requires the `PDA_ACCESS` HttpOnly cookie; every mutation also needs `X-XSRF-TOKEN`. Unauthenticated callers get `401`, non-members `403` (`404` for archived or unknown projects). Global `ADMIN` grants nothing. A task or child id that belongs to another project returns `404`. Errors are `ProblemDetail` with a stable `code`; bodies never carry stack traces, SQL or file bytes.

`dueDate` was replaced by `deadlineAt` (ISO-8601 instant). V37 converted existing `due_date` rows to 23:59 `Europe/Istanbul`. Enum query values are case-sensitive and upper-case (`scope=OPEN|DONE|ALL`).

| Endpoint | Auth / scope | Notes | Important errors |
| --- | --- | --- | --- |
| `GET /api/v1/projects/{projectId}/tasks` | `PROJECT_VIEW` | Server-side filters `status[]`, `priority[]`, `assigneeId`, `unassigned`, `q` (2–100 chars, `%`/`_` escaped), `labelId[]`, `sprintId`/`backlog`, `pool`, `parentId`/`topLevel`, `overdue`, `blocked`; sort `taskNumber/createdAt/updatedAt/deadlineAt/priority`; `size` ≤ 100 | `400` filter/sort/size |
| `POST` / `PATCH /api/v1/projects/{projectId}/tasks[/{taskId}]` | `TASK_MANAGE` | `assigneeIds` ≤ 20, `labelIds` ≤ 10, `parentTaskId`, `sprintId`, `estimatePoints` (0,1,2,3,5,8,13,21), `timeEstimateMinutes`, `deadlineAt`, `pool{open,teamId}`; description ≤ 10000 | `TASK_INVALID_PARENT`, `TASK_INVALID_ESTIMATE`, `TASK_DATES_INVALID`, `TASK_POOL_HAS_ASSIGNEE`, `TASK_POOL_TEAM_INVALID`, `TASK_DONE_CANNOT_POOL`, `TASK_LABEL_INVALID`, `SPRINT_INVALID`, `SPRINT_COMPLETED` |
| `GET /api/v1/projects/{projectId}/tasks/{taskId}/subtasks` | `PROJECT_VIEW` | One level only; archiving a parent archives its subtasks | – |
| `PUT .../tasks/{taskId}/labels` | `TASK_MANAGE` | At most 10 active project labels | `TASK_LABEL_INVALID`, `TASK_LABEL_LIMIT` |
| `PUT .../tasks/{taskId}/sprint` | `TASK_MANAGE` | `{ "sprintId": null }` = backlog | `SPRINT_INVALID`, `SPRINT_COMPLETED`, `SPRINT_ARCHIVED` |
| `POST .../tasks/{taskId}/claim` | `TASK_WORK` | Row-locked and atomic; team-targeted pool needs active team membership | `TASK_NOT_IN_POOL`, `TASK_ALREADY_CLAIMED` (409), `TASK_POOL_TEAM_ONLY` (403) |
| `POST .../tasks/{taskId}/release` | sole assignee who claimed it | Task returns to the pool | `TASK_NOT_RELEASABLE` |
| `GET/POST .../tasks/{taskId}/checklist`, `PATCH/DELETE .../checklist/{itemId}`, `PUT .../checklist/order` | read `PROJECT_VIEW`; write `TASK_MANAGE` or assigned `TASK_WORK` | Text ≤ 200, 50 items, order must list every item | `TASK_CHECKLIST_LIMIT`, `400` |
| `GET/POST .../tasks/{taskId}/comments`, `PATCH/DELETE .../comments/{commentId}` | read `PROJECT_VIEW`; write `TASK_WORK` | Plain text ≤ 10000; `@[uuid]` mentions, ≤ 20, only active members (others stay plain text); edit by author; soft delete by author or `ISSUE_MANAGE`; deleted comments carry no body | `TASK_TOO_MANY_MENTIONS`, `TASK_COMMENT_DELETED`, `403` |
| `GET .../tasks/{taskId}/activity` | `PROJECT_VIEW` | `filter=ALL\|COMMENTS\|EVENTS`, paged | `400` |
| `GET/POST .../tasks/{taskId}/relations`, `DELETE .../relations/{relationId}` | read `PROJECT_VIEW`; write `TASK_MANAGE` or assigned `TASK_WORK` on the source | Types `BLOCKS`, `RELATES`, `DUPLICATES`; same project only | `TASK_RELATION_INVALID`, `TASK_RELATION_EXISTS`, `TASK_RELATION_CYCLE` |
| `GET .../tasks/{taskId}/watchers`, `PUT/DELETE .../tasks/{taskId}/watch` | `PROJECT_VIEW`, caller only | Idempotent; creator, assignees, claimer, commenters and mentioned users watch automatically | – |
| `GET/POST .../tasks/{taskId}/worklogs`, `PATCH/DELETE .../worklogs/{worklogId}` | read `PROJECT_VIEW`; add `TASK_MANAGE` or assigned `TASK_WORK`; edit/delete owner or `TASK_MANAGE` | 1–1440 minutes; `workDate` at most one day past the UTC date; soft delete | `WORKLOG_INVALID`, `TASK_ARCHIVED` |
| `GET/POST .../tasks/{taskId}/attachments`, `GET .../attachments/{id}/content`, `DELETE .../attachments/{id}` | list/download `PROJECT_VIEW`; upload `TASK_WORK`; delete uploader or `TASK_MANAGE` | See the attachment threat note below | `TASK_ATTACHMENT_TYPE`, `TASK_ATTACHMENT_INVALID`, `TASK_ATTACHMENT_TOO_LARGE`, `TASK_ATTACHMENT_LIMIT` |
| `GET/POST /api/v1/projects/{projectId}/labels`, `PATCH/DELETE .../labels/{labelId}` | read `PROJECT_VIEW`; write `LABEL_MANAGE` | Name ≤ 40, unique per project (case-insensitive); color is a fixed token (`slate\|red\|orange\|amber\|green\|teal\|blue\|violet\|pink`), free hex is rejected; archive keeps existing task tags | `LABEL_NAME_EXISTS` |
| `GET/POST /api/v1/projects/{projectId}/sprints`, `GET/PATCH/DELETE .../sprints/{sprintId}`, `POST .../start`, `POST .../complete`, `GET .../summary` | read `PROJECT_VIEW`; write `TASK_MANAGE` | One `ACTIVE` sprint per project (partial unique index); `complete` takes `moveOpenTasksTo` = sprint UUID or `BACKLOG`; delete only a planned sprint without tasks; summary returns totals, status split, logged minutes and burndown | `SPRINT_INVALID`, `SPRINT_NOT_PLANNED`, `SPRINT_NOT_ACTIVE`, `SPRINT_ACTIVE_EXISTS`, `SPRINT_COMPLETED`, `SPRINT_NOT_EMPTY` |
| `GET /api/v1/tasks/mine` | authenticated; caller identity comes from the principal only, there is no `userId` parameter | `scope=OPEN\|DONE\|ALL`, `status[]`, `projectId`, `overdue`, `sprint=active`, `sort=deadlineAt\|updatedAt\|priority`, `direction`, `page`, `size` ≤ 100; only active projects and non-archived tasks assigned to the caller; `counts{open,overdue,dueSoon,blocked,poolAvailable}` | `400` unknown sort/size |
| `GET /api/v1/tasks/counts`, `GET /api/v1/tasks/pool` | authenticated | Counts for the caller; claimable pool tasks across the caller's active projects, filtered by team target | – |

**Authorization rule of thumb.** `PROJECT_MANAGER` holds every task permission. A member holding `TASK_WORK` (contributors and `TESTER`) can act only on tasks assigned to them, and can always comment, watch, upload and claim. Task data of another user is never returned by `/tasks/mine`.

**Deadline reminders.** `TaskDeadlineScheduler` scans every `pda.task.deadline-scan-interval` (default `PT5M`, env `TASK_DEADLINE_SCAN_INTERVAL`, no `.env` change). Each reminder first wins a conditional `UPDATE ... WHERE deadline_reminded_at IS NULL`, so several instances never notify twice. `TASK_DEADLINE_SOON` (24 h before) and `TASK_OVERDUE` go to assignees and watchers, never to the actor. Changing a deadline starts a new reminder cycle.

**Notifications.** Notification consumes only `com.pda.task.TaskEvents` with `@TransactionalEventListener(AFTER_COMMIT)`. A mention notifies only active project members.

**Attachment threat note (approved file upload, see §18).** Risks: stored XSS through SVG/HTML, content sniffing, polyglot files, path traversal through the file name, oversize/zip-bomb style abuse, and cross-project reads. Controls: extension allow-list (png, jpeg, webp, gif, pdf, txt, csv, md, zip, docx, xlsx, pptx) plus magic-byte proof; the client `Content-Type` is ignored; SVG, HTML-like text and files with NUL bytes in text types are rejected; the file name is sanitized (path separators and control characters removed, length capped) and never used as a path, the bytes live in `task_attachment_data` (`BYTEA`) and never on disk; 10 MB per file and 20 per task (multipart limit 11 MB); downloads send `X-Content-Type-Options: nosniff`, `Content-Security-Policy: sandbox`, `Cache-Control: private` and `Content-Disposition: attachment` (only png/jpeg/webp/gif are `inline`); access needs `PROJECT_VIEW` of the owning project and a task id scoped to that project. Image attachments (png, jpeg, webp, gif) are also measured from their header by `ImageSniffer` / the GIF screen size, so a few bytes that claim an enormous picture are refused (`TASK_ATTACHMENT_INVALID`) before any member's browser draws them. Deleting an attachment also deletes its stored bytes. Open item: there is no dedicated per-user upload rate limit or storage quota; the existing per-IP limiter does not cover these routes.

**Member removal.** `ProjectMemberRemovedEvent` clears the member's task assignments and watches.


### Simple / advanced task policies (2026-10-05, V54)

Project owns nullable `taskManagementMode` (SIMPLE / ADVANCED / BOTH); only its authenticated active founder (`createdBy`) can change it. Other Project Managers and global ADMIN have no bypass. New projects require the first choice; legacy projects are BOTH. Task owns non-null `creationMode` (SIMPLE / ADVANCED); existing tasks and POSTs omitting the type use ADVANCED. Project GET/by-slug/list responses expose the policy and existing createdBy provides the founder hint.

All mutations retain the existing access cookie, CSRF, membership and per-operation permission checks. The new exact PATCH route is authenticated in SecurityBaselineConfiguration; deny-all remains the fallback. No cookie/CORS/CSRF configuration changes.

| Endpoint / affected group | Scope and safe input | Success | Important errors |
| --- | --- | --- | --- |
| `PATCH /api/v1/projects/{projectId}/task-management-mode` | Active founder + CSRF; `{"mode":"BOTH"}` | 200 ProjectResponse including policy | 400 invalid/missing mode, 401 no session, 403 CSRF/non-founder, 404 unknown project or archived outsider, 409 PROJECT_ARCHIVED for archived founder |
| `GET /api/v1/projects`, `/{projectId}`, `/by-slug/{slug}` | Existing project membership scope | 200, additional nullable taskManagementMode | Existing 400/401/403/404 |
| `POST /api/v1/projects/{projectId}/tasks` | TASK_MANAGE + CSRF; `{"title":"Prepare release","creationMode":"SIMPLE"}` | 201 TaskView with creationMode | 400 TASK_SIMPLE_FIELDS_INVALID, 409 PROJECT_TASK_MODE_NOT_CONFIGURED / TASK_MODE_NOT_ALLOWED; existing validation/scope errors |
| `PATCH /api/v1/projects/{projectId}/tasks/{taskId}` | TASK_MANAGE + CSRF; required title/priority, optional creationMode | 200; omitted estimates/parent/sprint are retained; explicit null clears only where advanced writes are enabled | 409 TASK_MODE_CONVERSION_BLOCKED if advanced data remains; 409 TASK_MODE_NOT_ALLOWED for disabled type/features |
| `GET /api/v1/projects/{projectId}/tasks` | PROJECT_VIEW; optional `?creationMode=SIMPLE&page=0&size=20` combined with existing filters | 200, DB-filtered content/count/pages, creationMode in rows | 400 invalid enum/paging; existing scope errors |
| Task GET/subtasks; `GET /api/v1/tasks/mine` / `pool` | Existing project/own-task scope | 200; creationMode in all TaskViews; pool lists/counts include configured SIMPLE, ADVANCED and BOTH projects, with existing membership/team filters | Existing scope/paging errors |
| Advanced task mutations: estimates/parent/sprint/labels, checklist, relations, attachments, worklogs, manual watch/unwatch, new block; project label/sprint mutations | Original permission + CSRF AND project ADVANCED/BOTH AND advanced task (where applicable); relation/parent targets must also be advanced | Existing success status/body | 409 TASK_MODE_NOT_ALLOWED or PROJECT_TASK_MODE_NOT_CONFIGURED; original permission/scope failures still apply |

Simple tasks allow basic fields, people and pool assignments, pool claim/release, comments/mentions, status, archive and read-only history. Pool assignment is common to both task models in any configured project policy, including retained tasks after a policy change. Opening or cleaning a pool still requires TASK_MANAGE; claiming/releasing still requires TASK_WORK, active membership and the existing team/sole-claimant guards. Unconfigured policies reject pool mutations with PROJECT_TASK_MODE_NOT_CONFIGURED. This extension was explicitly authorized by the user on 2026-10-06. Automatic notification followers stay available in both modes; manual subscriptions are advanced. A project switching to SIMPLE retains existing advanced tasks and all data: basic editing/comments/status/unblocking work; advanced mutation is rejected, existing data reads/downloads remain authorized. Normal direct assignment/status operations still close a pool offer when the existing workflow requires it.

Conversion to SIMPLE checks estimates, parent/children (including archived children), sprint, block state, task labels, checklist, either direction of relations, active attachments/worklogs and manual watchers. No automatic deletion occurs; pool/team/claim state, assignees, soft-deleted records and common timeline/comments remain stored. Historical watcher origin was unknown, so V54 conservatively marks legacy watcher rows manual. New automatic followers alone do not prevent conversion.

Task writes first acquire a shared Project public-contract row lock; founder policy change/archive acquires an exclusive Project lock. Advanced ancillary mutations and model conversion serialize on the task row. Project dynamic updates prevent unrelated stale metadata from overwriting the task policy. Related task locks use a consistent UUID order.

Swagger check: existing `API_DOCS_ENABLED=true`, `/swagger-ui/index.html` and `/v3/api-docs`; get CSRF and authenticate normally. Use fixture UUIDs, never put passwords/cookies/tokens in examples. Follow backend completion record for checks; frontend model-selection UI is a separate pending delivery.

### Organization ↔ Project association remediation (2026-10-05)

No new route, ENV, role, membership inheritance, CSRF/CORS/session policy or migration. Existing project POST accepts optional `organizationId` (omitted/null→standalone). Existing project PUT is full metadata: omitted/null `organizationId` clears, identical ID preserves, changed non-null ID requires active actor-owned organization. `PROJECT_UPDATE` remains required, including detach. Same-ID co-manager save remains allowed. New/changed targets use the existing organization owner row lock through the association transaction; organization archive uses that same lock. Deterministic PostgreSQL barrier tests reproduced the old check/write race and guard serialization.

Organization archive **retains** all project FK associations; no automatic detach/archive/cascade. Project Home now uses a non-throwing optional active lookup for absent/archived orgs, avoiding rollback-only/UnexpectedRollbackException; authorized members get `200` with `organization:null`. Organization profile/media still use owner checks; missing/archived lookup rejection elsewhere is unchanged. Project archive does not change the organization or sibling projects.

`GET /api/v1/projects/{projectId}/home` adds `organization.canViewOrganization` (boolean, only when active summary exists). It is derived from current owner equality, contains no owner/email/private metadata, and is only a navigation hint: owner-only organization detail/media endpoints still enforce access. Non-owner co-managers see the already-authorized project summary as plain text; settings uses that same current summary while new targets remain owned-only. Missing capability in an older response fails closed for navigation.

Relevant inventory: POST/GET `/api/v1/projects`, PUT `/api/v1/projects/{id}`, GET `/projects/{id}`, `/projects/by-slug/{slug}`, `/projects/{id}/home`, POST `/projects/{id}/archive`; POST/GET `/organizations`, GET/PUT `/organizations/{id}`, POST archive and GET projects. Mutations require existing cookie+CSRF; no session401, nonmember/foreign target403, unknown/archived new target404, malformed/validation400. Organization projects GET is active-org + caller project membership, not general owner inheritance; profile GET remains owner-only. Safe PUT: `{"name":"Example Project","priority":"MEDIUM","status":"PLANNING","organizationId":null}`. Home active summary: `{id,name,slug,canViewOrganization}`. Swagger uses existing `/swagger-ui/index.html` and normal login/CSRF; no docs ENV changed. Full endpoint matrix is in the remediation completion record.

### Invitations remediation — 2026-10-06

No new endpoint, role, cookie/session/CSRF/CORS policy or ENV. Frontend private invitation queries are principal-scoped and cancelled/removed at sign-in/out/session boundaries. Existing invitation writes lock/expire elapsed pending target rows before fresh insert; manager reads/count/candidates use effective expiry. Resend expired invitation200 creates a fresh token/ID; DELETE expired204 retains EXPIRED, grants no membership. Existing authority checks and DB constraints remain. Full inventory/manual checks in the separate implementation completion. SMTP delivery remains disabled in the audited local environment.

### Project invitation conflict codes - 2026-10-10

Invitation conflicts keep HTTP `409` and the ProblemDetail shape; they now carry a machine-readable `code` (`detail` stays generic and never echoes an email):

| Code | When |
| --- | --- |
| `INVITATION_ALREADY_PENDING` | A live pending invitation already exists for the same registered user or email in this project (create/resend), including the `uk_project_invitations_pending*` unique-index race (previously a generic integrity 409). |
| `INVITATION_TARGET_ALREADY_MEMBER` | The target (by userId or registered email) is already an active project member — on create and on accept. |
| `INVITATION_NOT_PENDING` | Accept/reject (own or token), cancel or resend on an invitation that is no longer pending (accepted, rejected, cancelled, expired), or whose inviter no longer manages the project. |

404 versus 409 decisions, authorization, rate limits, matchers, CSRF and ENV are unchanged. "Account is not available for invitation" stays a generic 409. Covered by `ProjectInvitationApiIntegrationTest.invitationConflictsCarryDedicatedCodesWhileTheStatusStaysConflict` and `ProjectInvitationServiceTest`. Frontend maps the codes centrally (`lib/api/error-message.ts`); the invitee's own accept uses a second-person "already a member" message.

### Notification project/type filter - 2026-10-10

Existing `GET /api/v1/notifications` and `GET /api/v1/notifications/unread-count` accept optional `projectId` (UUID) and repeatable `type` (NotificationType enum names; duplicates collapsed). Omitted → previous behaviour. Recipient is always the principal; no recipient parameter. Invalid type or non-UUID projectId → `400`; anonymous → `401`. Parameterized JPQL, existing `ix_notifications_recipient_unread` index. No new matcher/role/CSRF/ENV/migration (the existing GET matcher covers query parameters). Used by the "Ekip Davetleri +N" badge: unread `PROJECT_INVITATION_ACCEPTED/REJECTED` for the selected project — recipient rule unchanged, so only the inviting manager sees it. Safe example: `GET /api/v1/notifications/unread-count?projectId=<uuid>&type=PROJECT_INVITATION_ACCEPTED&type=PROJECT_INVITATION_REJECTED`.

### Notification read/history compatibility - 2026-10-07

Existing GET /api/v1/notifications adds nullable read: false only unread,true only read,omitted retains unreadOnly/all; read=true with unreadOnly=true400. Recipient predicate always principal-scoped, size1-100 and createdAt DESC,id DESC unchanged. Own PATCH/{id}/read and /read-all retain session+CSRF; no request body selects recipient, foreign ID404 and anonymous/session401 (CSRF-valid), forced-password/CSRF403. No new matcher/role/auth/storage policy or migration.

Conditional own-unread read UPDATE and fresh readback preserve first committed readAt under stale JPA/bulk races. No content/snapshot/presentation deletion; popupPresentedAt remains distinct from readAt. Read-all count is changed rows; badge reconciles real unread-count. UI lifetime/AbortSignal and actor-scoped active/history/count keys block late previous-user results, preserving existing login/logout cleanup. Task-open read behavior retained; existing project hard-delete notification cleanup remains a separate lifecycle. Swagger /swagger-ui/index.html and /v3/api-docs, normal login/CSRF; safe GET ?read=true&page=0&size=20, read PATCH own QA UUID/no body.

### Project invitation count/context compatibility - 2026-10-08

No new matcher/auth/session/CSRF/CORS/ENV policy. Own incoming effective PENDING list/totals exclude archived projects; all-history retains rows. Manager totals retain active-project MEMBER_MANAGE authorization, distinct from recipient and notification unread counts. Existing own notification response has nullable event-time invitation projectName, plain text/bounded160 and recipient-scoped; no private project lookup or forged actor parameter. Frontend count keys include actor (and managed project); AbortSignal/cancel/remove and manager/demo visibility guard prevent stale private data presentation. Create-banner opt-in client decode rejects corrupt previews and preserves prior draft; server MIME/magic/size/authorization remain authoritative. Full API/Swagger/manual inventory belongs to separate implementation completion.

## 12. Error Handling

API errors must not expose:

- stack traces,
- SQL statements,
- database driver errors,
- filesystem paths,
- internal hostnames,
- JWT secrets,
- cookies,
- passwords,
- environment values,
- API keys.

PDA uses a consistent Spring `ProblemDetail`-based API error model.

Client-facing errors should contain only the information required to understand and correct the request.

### 401 versus 403

- **401**: the request has no valid session (no access cookie, or an expired or invalid one). Every route the application serves answers this way: auth, admin, notifications, invitations, and, since 2026-10-01, all `/api/v1/projects/**` (including tasks, teams, squads, criteria, members, reminders, chat) and `/api/v1/organizations/**` routes, and the chat WebSocket handshake (`GET /api/v1/ws`). The access token lives 15 minutes, so the SPA must be able to recognise this case: its API client answers a 401 by renewing the session once through `POST /api/v1/auth/refresh` and repeating the request.
- **403**: the caller is signed in but not allowed (role, membership, CSRF), and the answer for routes that are unknown or switched off (deny-all, e.g. API docs when disabled).

Project and organization routes used to answer 403 to an expired access token because they were missing from the entry point's route list in `SecurityBaselineConfiguration`. The client only renews on 401, so the user saw "you are not allowed to do this" until a page reload (`/auth/me` is on the list, so the reload renewed the session). A new route that serves a controller must be added to that list. Covered by `e2e/08-session-expiry.spec.ts` and the anonymous-request assertions in the project, squad and reminder integration tests.

---

## 13. Security Logging and Audit

The following events may be security/audit relevant:

- successful login,
- failed login,
- logout,
- refresh-token/session revocation,
- password change,
- admin actions,
- role changes,
- membership changes,
- suspicious authorization failures.

The following must **never** be logged:

- passwords,
- JWT values,
- refresh tokens,
- cookies,
- session secrets,
- API keys,
- database passwords,
- secret environment variables.

Logs must not become a secondary secret store.

---

## 14. Rate Limiting and Brute-Force Protection

Sensitive endpoints must receive stricter abuse protection, especially:

- login,
- signup where appropriate,
- token refresh,
- password-related actions,
- invitation/token flows,
- administrative endpoints.

Rate limiting must be introduced in a way that does not require unnecessary V1 infrastructure.

The limits are configuration, with the production values as defaults: `auth.rate-limit.sensitive-max-requests` (5: register, register by invitation, external invitation preview, password change/forgot/reset), `auth.rate-limit.login-max-requests` (30), `auth.rate-limit.refresh-max-requests` (30: refresh and OAuth), `chat.send.max-messages` (30) and `chat.send.window-seconds` (60); as environment variables `AUTH_RATE_LIMIT_SENSITIVE_MAX_REQUESTS` ..., `CHAT_SEND_MAX_MESSAGES`, `CHAT_SEND_WINDOW_SECONDS` (passed through `docker-compose.yml`, documented in `.env.example`). A value below 1 stops the backend from starting, and any value that differs from the default is logged as a warning at startup. Raising them is only for a local machine that runs the browser tests repeatedly (each run signs several throw-away users up from one address); never in production. Every chat send attempt counts, valid or not (a blank or too long message uses up an attempt as well); within the limit a refused message keeps its normal `400` answer.

The in-memory limiters (`AuthRateLimitFilter`, `ProjectInvitationRateLimitFilter`) run before authentication, so their keys must never be built from client-chosen text. The auth limiter keys on the route (the OAuth paths are folded to their fixed prefix) plus the client address; the invitation limiter keeps a per-URI counter (10 per 10 minutes, the limit a manager feels) and adds a per-client total of 200 per 10 minutes across all invitation routes, so one client can neither fill the table with made-up URIs and lock everybody else out nor dodge the limit by changing an id (`RateLimitFilterKeyTest`). The client address is the direct peer unless `TRUSTED_PROXY_CIDRS` lists the reverse proxy; behind a proxy without it every user shares one bucket. Chat sending has its own per-user limit (30 messages per minute, `ChatSendRateLimiter`, `429 CHAT_RATE_LIMITED`); it runs after authorization, keyed by user id rather than address. Reactions have an independent fixed V1 quota of 60 valid-code mutation attempts/min/user, including no-ops (`ChatReactionRateLimiter`, bounded 20,000-user map): `429 CHAT_REACTION_RATE_LIMITED`, `Retry-After: 60`. No reaction ENV or message-budget change.

---

## 15. Security Headers

Spring Security secure defaults should be preserved unless there is a documented reason to change them.

Where appropriate, production should use protections such as:

- HSTS,
- `X-Content-Type-Options: nosniff`,
- frame protection / `frame-ancestors`,
- Content Security Policy,
- appropriate Referrer Policy.

A security header must not be disabled merely to hide a frontend integration problem.

The Next.js frontend sets `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin` and a restrictive `Permissions-Policy` for every page (`frontend/next.config.ts`). A Content-Security-Policy is not set yet: Next.js needs a per-request nonce for its inline scripts, which belongs in the proxy (open item).

**Inline scripts (2026-10-10).** The root layout (`frontend/src/app/layout.tsx`) inlines one static `<script>` in `<head>`: `RENDERER_BOOT_SCRIPT` from `lib/rendering.ts`. It only reads the key `pda:renderer` from `sessionStorage` and sets `data-renderer="software"` on `<html>` (inside `try/catch`); it contains no user data, no interpolated input, no network call and no cookie access, and its content is a build-time constant. The verdict (software vs hardware compositing) is a per-tab rendering hint, never an identifier and never sent anywhere. When the CSP open item above is implemented, this script must receive the per-request nonce (or be hashed) together with Next.js's own inline scripts.

---

## 16. Dependency and Supply-Chain Security

- Maven and npm dependencies must be reviewed before introducing them.
- Unnecessary dependencies must not be added.
- Dependabot alerts should remain enabled.
- Secret scanning should remain enabled.
- Known high/critical dependency vulnerabilities must be reviewed before release.
- Lock files such as `package-lock.json` must be committed.
- Dependency versions must not be silently changed by coding agents without the related task/context.

### Open follow-up — braces advisory (2026-10-05)

- [ ] **Revisit before production release or the next frontend dependency update:** CVE-2026-93687 / GHSA-vfj7-8cjw-p6xm in `eslint-config-next → @next/eslint-plugin-next → fast-glob → micromatch → braces`.
- Last verified state (2026-10-05): full npm audit **5 high**, production audit **0** after removing the unused shadcn CLI. This is an open dependency issue, not a fixed advisory or a release waiver.
- The user deferred custom patch/backport work. At the next relevant task, remind the user of this follow-up, check current official releases/advisory and the actual deployment/runtime path, then propose the appropriate fix. Obtain explicit approval before introducing a custom security patch or major upgrade.
- If a patch becomes necessary, verify string and AST inputs, parse/compile/expand/stringify depth guards, Windows/glob consumers, clean installation, UI regressions and the existing pre-push gate. Keep any remaining version-based audit warning visible.
- Evidence and scope: [remediation report](../docs/compliation/2026-10-05-npm-security-remediation.md).

---

### source-map-js dependency remediation — 2026-10-06

- [x] User-approved remediation: `source-map-js` updated from 1.2.1 to 1.2.2 through a semver-compatible transitive update. Existing consumers require `^1.2.1`. Package manifest and application/invitation code unchanged.
- GHSA-68fv-2mgg-jv7q / CVE-2026-93749 resolved in the validated dependency graph. Next/PostCSS and Tailwind resolve 1.2.2. Untrusted PDA runtime exploitability was not reproduced.
- Clean `npm ci` passed. Post-patch full npm audit: 5 high, exit1, from existing ESLint/braces development debt. Production audit: 0, exit0. Pre-patch counts were 6 high / production1. Existing development debt remains open; this is not a release waiver.
- Validation passed: 33 targeted Chromium tests; canonical pre-push with 469 backend tests (0 failures/errors/skips), 248 Chromium passed + 1 expected skip, lint, TypeScript, production build and Docker health.
- Separate delivery: [source-map-js remediation](../docs/compliation/2026-10-06-source-map-js-security-remediation.md).

## 17. Docker and Container Security

- Secrets must not be baked into Docker images.
- `.env` must not be copied into images.
- Dockerfiles must not contain hard-coded credentials.
- Production images should contain only what is required to run the application.
- Development-only files and build artifacts should be excluded through `.dockerignore`.
- Container logs must follow the same secret-handling rules as application logs.

---

## 18. File and Path Safety

**Approved organization media architecture (2026-10-04):** The user selected private filesystem storage on a Docker persistent volume, with `ORGANIZATION_MEDIA_STORAGE_PATH` configuration and a storage port for future adapters. Organization logo/cover use server-generated identifiers, never client paths or filenames. Only metadata/references are stored in PostgreSQL. Access remains active organization owner only; mutations require CSRF. PNG/JPEG/WebP are validated through `ImageSniffer`, with logo 512 KiB and cover 2 MiB limits and the existing pixel limits. Replacement/removal use persistent lifecycle records for retry after crashes; archived references are retained and cannot be served. Storage stays outside public/static directories; containment and symlink checks are required. Existing Project/User BYTEA media is unchanged.

When file handling is introduced:

- user-controlled paths must not be trusted directly,
- path traversal must be prevented,
- filenames must not be treated as trusted identifiers,
- uploaded file type/content validation must be implemented according to the relevant feature's requirements.

File attachment/storage is outside PDA V1 unless explicitly approved.

**Approved exception (2026-10-01): project logo.** A single image per project is stored in the database (`project_logos`, `BYTEA`), not on disk, so no path or filename is ever used. The uploaded filename and the client `Content-Type` are ignored; the type is derived from magic bytes (PNG `89 50 4E 47`, JPEG `FF D8 FF`, WebP `RIFF....WEBP`). SVG and GIF are rejected (script/active-content risk). Size is capped at 512 KB (also a DB `CHECK`), empty files are rejected, and the image is served with `nosniff` and `inline` disposition. Any other upload feature still needs its own approval.

**Approved exception (2026-10-02): project banner.** A project may carry one cover image, stored in the database exactly like the logo (`project_banners`, `BYTEA`, never on disk, no path or filename used). The filename and client `Content-Type` are ignored; the type is derived from magic bytes through the shared `com.pda.shared.ImageSniffer` (the same one the logo and the profile photo use), SVG and GIF are rejected, the size is capped at 2 MB (also a DB `CHECK`), empty files are rejected, and the image is served with `nosniff` and `inline` disposition. Upload and removal need `PROJECT_UPDATE` and CSRF. Aspect ratio is not enforced on the server; the UI crops with `object-cover`.

**Approved exception (2026-10-02): profile photo.** Every account may carry one profile photo, stored in the database exactly like the logo and banner (`user_profile_photos`, `BYTEA`, one row per user, never on disk, no path, key or filename used or returned). The filename and client `Content-Type` are ignored; the type comes from magic bytes through `ImageSniffer` (PNG, JPEG, WebP only: SVG, GIF and anything else are rejected), the size is capped at 5 MB (also a DB `CHECK`), empty files are rejected, and `ImageSniffer` reads the pixel size from the header (at most 6000 px per side and 24 million pixels) so a small file cannot claim an enormous image (decompression-bomb protection without decoding anything). The same dimension rule now applies to the logo, the banner and the image attachments. Upload and removal only ever concern the signed-in user (`/me` routes) and need CSRF; the image is served with `nosniff`, `inline` disposition, a sandboxing `Content-Security-Policy` and a versioned URL (`?v=profilePhotoVersion`).

**Approved exception (2026-10-02): task attachments.** Files on tasks are stored in the database (`task_attachment_data`, `BYTEA`), never on disk. Type is proven by extension allow-list plus magic bytes, SVG/HTML-like text and NUL-byte text are rejected, the client `Content-Type` and the file name are never trusted (the name is sanitized and only displayed), limits are 10 MB per file and 20 per task, and downloads carry `nosniff`, `CSP: sandbox` and `Cache-Control: private`. Full threat note and endpoint matrix: §11 "Task Service genişletmesi".

---

## 19. Secure Development Rules for Coding Agents

Coding agents must:

- preserve this security policy,
- ask before changing security-sensitive architecture,
- ask before changing `.env` or `.env.example`,
- never weaken authentication/authorization to make a test pass,
- never disable CSRF/CORS/security checks as a shortcut,
- never introduce hard-coded secrets,
- never expose secrets in generated examples,
- never push to GitHub,
- report security-impacting changes before implementation when approval is required,
- report newly added environment variables,
- report newly public endpoints,
- report authentication/authorization changes,
- report migration changes that affect security-sensitive data.

When a requested implementation conflicts with this document, implementation must stop at the conflicting point and the conflict must be reported.

---

## 20. Vulnerability Reporting

Do not publicly disclose a suspected vulnerability through a normal issue containing exploit details, credentials, tokens, or private system information.

Use the repository's approved private security reporting/advisory mechanism when available.

Security reports should include:

- affected component,
- reproduction conditions,
- expected vs. actual behavior,
- security impact,
- minimal safe reproduction information.

Never include real production secrets or personal credentials in a vulnerability report.

---

## 21. Security Checklist Before a Feature Is Considered Complete

For security-sensitive features, verify as applicable:

- [ ] No secret is hard-coded.
- [ ] `.env` is not tracked.
- [ ] New ENV changes were approved and documented.
- [ ] `.env.example` matches the approved ENV contract.
- [ ] Input validation exists on the backend.
- [ ] Authentication requirements are explicit.
- [ ] Authorization/RBAC rules are explicit.
- [ ] No protected endpoint is unintentionally public.
- [ ] Cross-project access is blocked.
- [ ] SQL/query input is parameterized or allowlisted.
- [ ] CORS does not use unsafe wildcard configuration.
- [ ] CSRF behavior is correct for cookie authentication.
- [ ] Tokens are not stored in browser storage.
- [ ] Sensitive values are absent from logs/errors.
- [ ] Swagger examples contain no secrets.
- [ ] Relevant security tests pass.
- [ ] `.\pre-push\pre-push.cmd` passes before push.

---

## 22. Core Principle

> Security controls belong on the backend and must fail safely by default.

Convenience, frontend behavior, development speed, or debugging requirements must not silently weaken PDA's security baseline.

### Independent sharp dependency follow-up - 2026-10-06

Final read-only audit reports6 high total /1 production high. The new production finding is sharp0.35.4, GHSA-wq5f-xc86-pv6w (reviewed2026-10-06), affected<0.35.5/patched0.35.5. Upstream describes conditional librsvg memory vulnerability on glibc Linux while decoding SVG. PDA exploit/runtime reachability was not reproduced; production audit classification alone is not proof. Reviewed source: https://github.com/advisories/GHSA-wq5f-xc86-pv6w .

source-map-js remains patched1.2.2. Existing ESLint/braces5 high dev debt remains. Squad modernization does not update package/lock/ENV; separate compatible sharp patch review is needed before release, no waiver. Earlier5/production0 counts are historical.

### Sharp dependency remediation - 2026-10-07

User-approved separate transitive patch sharp0.35.4->0.35.5 via real npm update sharp; Next16.3.6 already permits ^0.35.4, Node24.19.0 meets >=20.9.0. Lock updates only27 sharp/platform/libvips-family entries; unrelated fast-deep-equal metadata normalization reverted. Manifest/application/invitation/backend/config/migrations/ENV unchanged. One scrollbar E2E setup reuses the real shared member session after an actual full-suite login429; assertions and auth quotas unchanged.

GHSA-wq5f-xc86-pv6w closed in installed graph; native runtime reports librsvg2.63.2. Benign PNG/JPEG/WebP/AVIF/SVG/invalid-image smoke6 PASS; no PDA/Linux exploit proof or production rollout claimed. Final clean npm ci PASS; full npm audit5 high/exit1 (existing ESLint/braces dev debt), production0/exit0. Previous6 high/production1 is historical; source-map-js1.2.2 retained. Remaining dev debt is separate, not a release waiver.

21 targeted Chromium+5 fixture/history regressions PASS; lint/type/build and final canonical pre-push exit0:512 backend0 failure/error/skip,291 Chromium+1 expected production crash-route skip, Docker build/start/health. Final Next dev3000/backend8080/Swagger/API docs200. Separate delivery: [sharp remediation](../docs/compliation/2026-10-07-sharp-security-remediation.md).

## Permanent project deletion (2026-10-07)

`DELETE /api/v1/projects/{projectId}` is the only path that removes a project row. Order in `ProjectService.delete`: `PROJECT_ARCHIVE` check (`403`) -> row lock of an active project (`404`, so an archived or unknown project never reveals itself) -> founder check (`createdBy` equals the caller, else `403`) -> `ProjectDeletedEvent` -> delete + flush. The role matrix (`RolePolicy`) is unchanged and no permission was added; the founder rule follows the task-management-mode precedent. Children go through the database (`V58` `ON DELETE CASCADE`), so modules never delete each other's tables; the notification module removes the project's notifications in the same transaction through a synchronous `@EventListener`. Nobody is notified. The frontend only offers the button to the founder, the server decides. CSRF, cookie auth and the URL whitelist are unchanged apart from the new `DELETE /api/v1/projects/*` row in `SecurityBaselineConfiguration` (authenticated; the authorization above is in the service).

## GitHub depo okuma ve commit bildirimleri (2026-10-07, V59)

Entegrasyon salt okunurdur: clone, push, issue, PR ve webhook yoktur; yalnız **herkese açık** depolar bağlanır (`POST /projects/{id}/repository` özel depoyu `400 REPOSITORY_PRIVATE` ile reddeder, böylece sunucu token'ı tanımlıyken sunucunun erişebildiği özel depolar okunamaz).

- **Yeni uçlar** (hepsi `GET`, aktif proje üyesi, çerez oturumu; `SecurityBaselineConfiguration` içindeki mevcut `GET /api/v1/projects/**` kuralı kapsar, yeni satır gerekmedi): `/projects/{id}/repository/branches`, `/projects/{id}/repository/commits?branch=&author=&page=&limit=` (mevcut uç genişledi), `/projects/{id}/repository/compare?branch=`. Üye olmayan `403`, oturumsuz `401`.
- **Girdi doğrulama:** `branch` en çok 250 karakter ve git ref kurallarına uyar (`..`, boşluk, kontrol karakteri, `~^:?*[\` yok) → `400`; ayrıca önbellekteki dal listesinde olmalı → yoksa `404`, böylece uydurma dal adlarıyla GitHub kotası tüketilemez. `author` GitHub kullanıcı adı kalıbına (`^[A-Za-z0-9-]{1,39}$`) uymalı → `400`. Her ikisi de GitHub'a yalnız kodlanmış URI değişkeni olarak gider (SSRF yüzeyi: host sabit `api.github.com`).
- **Sayfalama başlığı (2026-10-10):** `GET /projects/{id}/repository/commits` gövdesi aynı (commit listesi) kalır; ek olarak `X-Has-Next-Page: true|false` döner. Değer GitHub'ın `Link` başlığındaki `rel="next"` bilgisinden türetilir, sayfa 10'da (izin verilen son sayfa) her zaman `false`'tur. Başlık CORS `exposedHeaders` listesine eklendi (mevcut `X-Access-Token-Expires-In` korunur); yeni uç, matcher, CSRF/izin kuralı yoktur. Yetki, BASIC/ADVANCED kuralları ve okuma sınırı değişmedi.
- **Okuma sınırı (§14):** kullanıcı başına dakikada 60 depo okuması (`pda.github.read-limit-per-minute`); aşılırsa `429` + `Retry-After: 60` + `code=REPOSITORY_READ_LIMIT`. GitHub yanıtları `GitHubReadCache` ile 60 sn önbelleğe alınır (`pda.github.cache-ttl`, `PT0S` önbelleği kapatır).
- **Sunucu token'ı:** `GITHUB_API_TOKEN` isteğe bağlıdır, **varsayılan boştur**; doluysa yalnız sunucudan GitHub'a `Authorization: Bearer` olarak gider (saatlik sınır 60 → 5000). Hiçbir yanıtta, logda, hata metninde ya da `ProblemDetail` içinde yer almaz; tarayıcıya hiç verilmez. Yalnız `.env` içinde tutulur, `.env.example` boş anahtarı gösterir.
- **GitHub hataları:** `NOT_FOUND` → `404`, `RATE_LIMITED` → `429`, `UNAVAILABLE` → `503`; sızdırılan ayrıntı yoktur.
- **Tarama (`RepositoryCommitScanScheduler`, varsayılan 5 dk):** transaction dışında GitHub'a gider; ilerleme koşullu `UPDATE ... WHERE notified_head_sha IS NOT DISTINCT FROM :old` ile "claim" edilir, çoklu örnek ya da tekrar tarama çift bildirim üretmez. Tur büyüklüğü `pda.github.commit-scan-batch` ile sınırlıdır (`0` = otomatik: token yokken 5, token varken 50 depo); `RATE_LIMITED` turu durdurur, hata zamanlamayı öldürmez. Bildirim yalnız varsayılan dal için, tek taramadaki commit'ler tek bildirimde; alıcılar projenin aktif üyeleridir, bildirim metni yalnız depo adı/dal/sayı/son commit mesajı ve yazar adı içerir (snapshot kolonları + CHECK kısıtı).
- **Frontend:** commit bağlantıları yalnız `https://github.com/`, avatarlar yalnız `https://avatars.githubusercontent.com/` ile açılır (`features/repository/links.ts`); diğer her şey düz metin ya da baş harf yedeğidir.

## GitHub depo takip modu ve bildirim anahtarı (2026-10-07, V61)

- **Yeni uç:** `PATCH /api/v1/projects/{projectId}/repository` gövde `{trackingMode: BASIC|ADVANCED, notifyOnCommits: boolean}`. `REPOSITORY_MANAGE` (tüm Proje Yöneticileri), çerez oturumu + CSRF; `SecurityBaselineConfiguration` PATCH listesine `/api/v1/projects/*/repository` eklendi (varsayılan deny-all korunur). Üye `403`, oturumsuz `401`, CSRF'siz `403`, bağlı depo yok `404`, geçersiz mod `400`. `POST` aynı alanları isteğe bağlı alır (varsayılan `BASIC` ve `true`).
- **Mod kuralı:** `BASIC` modda `branches`, `compare`, ana dal dışı ve yazara göre `commits` istekleri `409` + `code=REPOSITORY_ADVANCED_REQUIRED` döner (GitHub'a gidilmez). Bu bir güvenlik sınırı değil, tutarlılık ve GitHub kotasını korumak içindir; ana dalın commit listesi iki modda da açıktır. Yetki kontrolü modlardan bağımsız olarak önce çalışır.
- **Bildirim anahtarı:** `notifyOnCommits=false` olan depolar taramaya hiç alınmaz (`findScanCandidates`). Anahtar kapalıdan açığa dönerse taban çizgisi sıfırlanır (`notifiedHeadSha = null`); kapalıyken gelen commit'ler sonradan bildirilmez. Bildirim iki modda da yalnız varsayılan dal içindir.
- **Frontend:** oluşturma ekranındaki depo adresi `GITHUB_REPOSITORY_URL` ile istemcide, asıl doğrulama sunucuda yapılır; depo bağlanamazsa proje yine oluşur ve uyarı gösterilir. Kenar çubuğundaki "Depo" öğesi ve ayarlar bölümü yalnızca arayüz kolaylığıdır, yetki sunucudadır.

### Independent Next.js advisory follow-up - 2026-10-08 (pre-remediation snapshot)

Pre-remediation npm audit6 high/exit1, omit=dev1 high/exit1 (Next16.3.6); earlier5 high/production0 is historical. Newly reviewed Next advisories: GHSA-3w37-wq28-93x7, GHSA-4jqv-mc3x-m676, GHSA-39w2-rjm5-chcv, GHSA-f87g-xv8r-7p7x, GHSA-mcj8-r9mp-w47p and GHSA-cjq9-62q9-8jv4. Reviewed entries list16.3.8 patched; npm currently proposes16.4.0. Source has no images.remotePatterns (the SSRF advisory explicitly excludes that configuration), no draftMode/use-cache usage found; this limited source review is not an exploit/reachability audit or global release waiver. Package/lock unchanged in this UX task. Separate compatible patch/compatibility/gate decision required; existing ESLint/braces dev debt remains. Primary references: https://github.com/advisories/GHSA-cjq9-62q9-8jv4 and https://github.com/advisories/GHSA-mcj8-r9mp-w47p.

### Official Next security remediation - 2026-10-08

User approved official Next patch only and explicitly kept braces upstream follow-up open. Next/eslint-config-next16.3.6->16.3.8 via real scoped install; root+12 Next/env/eslint/SWC lock entries, no major/downgrade/force/new dependency/custom patch. Unrelated fast-deep-equal metadata restored; final clean npm ci0. Six reviewed Next advisory entries disappear from installed graph; production audit0/exit0, full audit5 high/exit1 (braces dev chain). Source-map-js1.2.2/sharp0.35.5 retained. Application/backend/auth/session/CSRF/CORS/ENV/config hashes unchanged. No global full-audit0 or release waiver claim.

Native dev MCP origin smoke verifies localhost200, unlisted foreign and opaque origin403; existing local PNG optimizer200/unlisted remote400 without remotePatterns changes or publishing MCP content/logs. Target46+1 expected skip; correct real-session quota setup30 PASS; final canonical548 backend0 fail/error/skip,328 Chromium+1 expected production crash-route skip,lint/type/build/Docker health PASS/exit0. First login429 and revoked-session fixture attempts are documented, not PASS. QA-only actual session reuse avoids setup login bursts while logout/revocation/actor checks remain; no policy limits/timeouts/assertions relaxed. Separate [completion/manual review](../docs/compliation/2026-10-08-next-security-remediation.md).

Braces <=3.0.3 has no official patched release as checked2026-10-08; open5-high dev chain remains. User explicitly declined a custom patch for this delivery; keep the earlier open follow-up unchecked.

## Cookie consent, anonymous analytics, public contact form and admin analytics (2026-10-09, V62-V63)

**Consent (device level).** The decision is kept in `localStorage` `pda:cookie-consent` (`{version, necessary: true, analytics, updatedAt}`, central `CONSENT_VERSION` in `features/consent/contract.ts`). Analytics is OFF until a person chooses it; a missing, malformed or older-version record counts as "not decided" (the banner asks again, analytics stays off). Reject all, accept all and "manage" have equal weight. Withdrawing removes `pda:analytics-visitor` and `pda:analytics-session` at once. The consent is a property of the browser, not of an account; signing in or out never changes it.

**Analytics transport.** `features/analytics/transport.ts` is the only place analytics leaves the browser. It re-reads the stored decision before every send and `apiRequest` asks the same guard again right before the request goes out, so a withdrawal during an in-flight preparation still stops it. Identifiers are random UUIDs created only after consent. Only the route template (`/projects/[slug]/tasks`, never a slug, id, query or hash), the referrer host and the three UTM values of the landing document (read once, held in memory) are sent. Engagement counts only while the tab is visible AND the window is focused.

**Analytics API (`POST /api/v1/analytics/events`).** Public, CSRF required, rate limited per address (`analytics.rate-limit.max-requests`, default 600 per 10 minutes), body limit 2 KB (`PublicBodyLimitFilter`: 413, and 411 without a Content-Length). Types are an allow-list (`PAGE_VIEW`, `ENGAGEMENT`); unknown types, malformed ids, a query string in the route or an out-of-range value are `400 ANALYTICS_INVALID`; a user, role, timestamp or any other property in the body is never bound. The server uses its own clock, classifies the source (DIRECT/SEARCH/REFERRAL/CAMPAIGN; CAMPAIGN only with real UTM values) from the first page of a session only, caps engagement per event (120 s) and by the time that really elapsed since the session was last heard from (+5 s), and per session (6 h, 500 page views). A foreign visitor id cannot write into a session (`400`). No user id, address, user agent or query string is stored.

**Contact API (`POST /api/v1/contact`).** Public, CSRF required, per-address limit `contact.rate-limit.max-requests` (default 5 per 10 minutes), body limit 16 KB. Bound fields are exactly `firstName`, `lastName`, `email`, `message`; `to`, `cc`, `bcc`, `from`, `subject` and the like are ignored, so the endpoint cannot be used as a relay. The recipient is `pda.contact.recipient` (`CONTACT_RECIPIENT`, default `pdassistant@gmail.com`, validated as one bare address at start-up). Names and e-mail are rejected when they contain control characters or line separators (CRLF cannot reach a header); the adapter still cuts them to one line (`singleLine`) and parses Reply-To strictly as one bare address. From is `MAIL_FROM`, never the visitor. The same message from the same address inside 60 seconds is `409 CONTACT_DUPLICATE` (in-memory hash, single instance). `503 CONTACT_UNAVAILABLE` when mail is off, `503 CONTACT_DELIVERY_FAILED` when the SMTP server refuses; no server detail reaches the browser. Only `id`, `created_at` and `delivery_status` are stored (V63): no name, address or message.

**Admin.** `GET /api/v1/admin/users` gained server-side `search` and `status`; problem bodies carry `ADMIN_SELF_DENIED`, `ADMIN_LAST_ADMIN`, `USER_NOT_FOUND`. `GET /api/v1/admin/analytics` is ADMIN + `SYSTEM_VIEW` and composes consented traffic with registrations, account counts and delivered contact messages from their own tables; none of those operational numbers depends on analytics consent. Query keys are `["admin", actorId, ...]` and are removed on sign-out, session end, 401 and every sign-in. "Terminate membership" is the existing reversible `DISABLED` state (sessions revoked, login blocked, nothing deleted).

**Public endpoint allow-list additions.** `POST /api/v1/analytics/events` and `POST /api/v1/contact` are `permitAll` with CORS and CSRF; they are also allowed while a forced password change is pending. Both are answered `Cache-Control: no-store`.

## Auth hardening: codes, tickets, 2FA, account deletion (2026-10-10)

New public endpoints (all CSRF-protected, rate limited, none leak whether an account exists): `POST /api/v1/auth/register/verify`, `register/resend`, `password/reset/verify`, `login/2fa`, `account/deletion/confirm`. Session-only endpoints: `password/change/code`, `password/change/verify`, `2fa` (GET), `2fa/setup|enable|disable|recovery-codes`, `account/deletion/request`. Each is listed in `SecurityBaselineConfiguration` and, where it needs no session, in the 401 list.

- **Mailed codes** (registration, reset, password change): 6 digits, HMAC-hashed with a per-purpose prefix (`EMAIL_VERIFICATION_HMAC_KEY`), 15 minutes, at most 5 attempts, single use (`consumed_at`), 60 s resend cooldown. Only the hash is stored.
- **Tickets**: short-lived HttpOnly JWT cookies with a fixed `token_use` — `PDA_RESET` (10 min), `PDA_PWCHANGE` (10 min), `PDA_MFA` (5 min). They carry no session authority and are cleared when used.
- **Passwords**: 8–128 characters with an uppercase letter, a digit and a special character everywhere a new password is chosen.
- **TOTP**: the secret is encrypted with `TOTP_ENCRYPTION_KEY` (AES-256-GCM); a used time step is never accepted again; 5 wrong codes lock the credential for 15 minutes; backup codes are hashed and single use. OAuth logins also pass the second step.
- **Account deletion**: a one-time link (hash only, 15 min, 5 attempts) plus the owner's own credentials; accounts owning a project or organisation are refused; administrators cannot delete themselves. Deletion anonymises (`DELETED`) and revokes every session.
- **Mail pages are not indexed**: `/verify-email` and `/delete-account` are `noindex` and absent from the sitemap.

§14 additions: the sensitive bucket (5 per 10 minutes) covers `register/verify`, `register/resend`, `password/reset/verify`, `password/change/code|verify` and `account/deletion/confirm`; `login/2fa` shares the login bucket. The e2e override raises these limits for local test runs only.
