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

### Project Teams ve kayıtlı kullanıcı davetleri (2026-09-30)

Swagger kontrolü: `API_DOCS_ENABLED=true` ile `/swagger-ui/index.html`; önce `GET /api/v1/auth/csrf`, ardından oturum açma. Tüm yollar access cookie ister; POST/PUT/DELETE işlemleri ayrıca `X-XSRF-TOKEN` ister. `PROJECT_VIEW` aktif proje üyeliği, `SQUAD_MANAGE` ve davet yönetimi Project Manager yetkisi gerektirir. Hatalar `ProblemDetail` döner. `page>=0`, `size=1..100`.

| Endpoint | Yetki | Güvenli örnek girdi | Başarı | Önemli hatalar |
| --- | --- | --- | --- | --- |
| `GET /api/v1/projects/{projectId}/teams` | `PROJECT_VIEW` | `?page=0&size=20` | `200` sayfalı ekipler, `general`, `parentTeamId`, `memberCount` | `400`, `401`, `403` |
| `GET /api/v1/projects/{projectId}/teams/{teamId}` | `PROJECT_VIEW` | UUID path | `200` ekip | `401`, `403`, `404` |
| `POST /api/v1/projects/{projectId}/teams` | `SQUAD_MANAGE` | `{"name":"Backend","parentTeamId":"<general-team-uuid>"}` | `201` ekip | `400`, `401`, `403`, `404` parent |
| `PUT /api/v1/projects/{projectId}/teams/{teamId}` | `SQUAD_MANAGE` | `{"name":"API","description":"Services"}` | `200` ekip | `400`, `403`, `404`, `409` General Team |
| `PUT /api/v1/projects/{projectId}/teams/{teamId}/parent` | `SQUAD_MANAGE` | `{"parentTeamId":"<team-uuid>"}` | `200` ekip | `400`, `403`, `404`, `409` döngü/General |
| `DELETE /api/v1/projects/{projectId}/teams/{teamId}` | `SQUAD_MANAGE` | UUID path | `204` | `403`, `404`, `409` General/aktif alt ekip |
| `GET /api/v1/projects/{projectId}/teams/{teamId}/members` | `PROJECT_VIEW` | `?page=0&size=20` | `200` sayfalı nickname/email/project roles | `400`, `403`, `404` |
| `POST /api/v1/projects/{projectId}/teams/{teamId}/members` | `SQUAD_MANAGE` | `{"userId":"<active-project-member-uuid>"}` | `201` üye | `400`, `403`, `404`, `409` tekrar/General |
| `DELETE /api/v1/projects/{projectId}/teams/{teamId}/members/{userId}` | `SQUAD_MANAGE` | UUID path | `204` | `403`, `404`, `409` General |
| `GET /api/v1/project-invitations/me` | Oturum sahibi | `?page=0&size=20` | `200` yalnız kendine gelen davetler | `400`, `401` |
| `POST /api/v1/project-invitations/{invitationId}/accept` | Yalnız davet edilen hesap | Body yok | `200` project membership | `401`, `403` CSRF, `404` başka alıcı, `409` beklemiyor/üye |
| `POST /api/v1/project-invitations/{invitationId}/reject` | Yalnız davet edilen hesap | `{"message":"Şu an uygun değilim"}`; isteğe bağlı, en çok 500 | `204` | `400`, `401`, `403` CSRF, `404` başka alıcı, `409` beklemiyor |
| `GET /api/v1/projects/{projectId}/invitations/all` | Project Manager | `?page=0&size=20` | `200` durum ve rejectionMessage içeren sayfalı geçmiş | `400`, `401`, `403` |

Mevcut `POST .../invitations` artık yalnız aktif kayıtlı `userId` veya kayıtlı hesap e-postasını kabul eder (`{"userId":"<registered-user-uuid>","roles":["TESTER"]}` → `201`; bilinmeyen hesap `404`, tekrar/aktif üye `409`). Eski tokenlı accept/reject yolları yalnız gerçek hedef hesap için çalışır. Yeni davet yanıt yolları da 10 istek/10 dakika/IP/yol hız sınırına dahildir (`429`). `.env`, auth cookie, CSRF veya rol matrisi değişmedi.

### Notification Service endpoints

Swagger check path: `/swagger-ui/index.html` with `API_DOCS_ENABLED=true`; call `GET /api/v1/auth/csrf`, log in, then use the routes below. All routes require the access cookie and address only the current user's records. PATCH additionally requires `X-XSRF-TOKEN`. Errors use `ProblemDetail`.

| Endpoint | Auth / scope | Input / safe example | Success | Important errors |
| --- | --- | --- | --- | --- |
| `GET /api/v1/notifications` | Authenticated, own records | `?page=0&size=20&unreadOnly=true&type=TASK_ASSIGNED`; size 1–100 | `200` paged content with type, text, read timestamps, actor/project/resource IDs | `400` invalid filter/page, `401` unauthenticated |
| `GET /api/v1/notifications/unread-count` | Authenticated, own records | None | `200 {"count": 5}` | `401` |
| `PATCH /api/v1/notifications/{notificationId}/read` | Authenticated, own record + CSRF | UUID path, no body | `200` updated notification | `400` bad UUID, `401`, `403` CSRF, `404` missing or other user's record |
| `PATCH /api/v1/notifications/read-all` | Authenticated, own records + CSRF | No body | `200 {"count": 2}` (number changed) | `401`, `403` CSRF |


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
| `GET /api/v1/admin/users?page&size` | ADMIN (`USER_MANAGE`) | size clamped 1..100 | `200` page of `{id,email,nickname,accountStatus,emailVerificationStatus,globalRole,mustChangePassword,createdAt}` | `401`, `403` |
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

Rules: `forgot` checks mail availability before looking up the account, so a `503` never leaks whether the email exists. `reset` never checks the current password (identity is proven by the emailed code instead) and calls the same `UserSessions.revokeAll` used by the admin disable-user flow, so a stolen password immediately loses every existing session, not just future ones. Every `400` from `/password/reset` and `/password/change` carries a machine-readable `ProblemDetail.code` alongside `detail` (`reset_code_invalid`, `reset_code_expired`, `reset_too_many_attempts`, `password_confirmation_mismatch`, `current_password_incorrect`, `password_unchanged`) so the frontend can show a distinct message per case without matching on the human-readable `detail` string; `account_unavailable` on `/password/change` uses the same `code` convention on its `403`.
### HMZ-PROJ Faz 10 (authorization/security hardening; one new mechanism, no new endpoint)

No new endpoint, ENV key, dependency or migration. `POST /api/v1/projects/{projectId}/invitations`, `.../invitations/{id}/resend`, `.../accept`, `.../reject` are now rate-limited: 10 requests per 10 minutes per IP per exact path (`ProjectInvitationRateLimitFilter`, same sliding-window pattern as `AuthRateLimitFilter`, registered in `SecurityBaselineConfiguration`). A comprehensive authorization-matrix and `ProblemDetail`-shape test pass was added across Project/Membership/Invitation/Criterion/Repository/Squad controllers; no behavior changed, only test coverage.

### HMZ-PROJ Faz 7 endpoints (Project Home aggregate)

New read-only aggregate endpoint; no new ENV key, dependency or migration. Composes only data that already has a safe source inside the Project module (own entities/repositories, `OrganizationService.requireActive`) — never reaches into another module's internals. A GitHub failure on the repository card never fails the whole response; it surfaces as `repository.githubUnavailable: true` instead. Task counts and recent activity are intentionally absent (Work Service and Activity modules expose no public contract yet); squad count is intentionally absent (Squad already depends on Project via `ProjectAccess`, so the reverse direction would create a module cycle — callers get the squad count from the existing squad list endpoint's pagination total instead).

Swagger check path: `/swagger-ui/index.html` with `API_DOCS_ENABLED=true`: `GET /api/v1/auth/csrf`, log in, call `GET /api/v1/projects` to get a `projectId`, then the endpoint below.

| Endpoint | Auth / scope | Input | Success | Important errors |
| --- | --- | --- | --- | --- |
| `GET /api/v1/projects/{projectId}/home` | `PROJECT_VIEW` in that project | UUID path | `200`, `{id,name,slug,status,priority,startDate,targetEndDate,organization\|null,managers[],teamMemberCount,criteriaProgress:{completed,total},repository:{connected,provider,repositoryOwner,repositoryName,defaultBranch,lastCommit\|null,githubUnavailable},createdAt,updatedAt}` | `401` no/invalid access cookie, `403` not a member, `404` project archived/not found |

---

### Task Service backend endpoints (F5)

Swagger check path: `/swagger-ui/index.html` with `API_DOCS_ENABLED=true`. Call `GET /api/v1/auth/csrf`, log in, create/select an active project, then use the endpoints below. All mutations require the `X-XSRF-TOKEN` header and `PDA_ACCESS` HttpOnly cookie. `ADMIN` alone grants no project access. All routes are project scoped and return `ProblemDetail` on errors.

| Endpoint | Auth / scope | Safe input | Success | Important errors |
| --- | --- | --- | --- | --- |
| `POST /api/v1/projects/{projectId}/tasks` | `TASK_MANAGE` | `{ "title": "Prepare demo", "priority": "HIGH" }`; optional description/startDate/dueDate | `201`, Task with stable `taskKey`, number and assignee IDs | `400` fields/dates, `401`, `403`, `404` project, `409` archived project |
| `GET /api/v1/projects/{projectId}/tasks` | `PROJECT_VIEW` | `page=0&size=20&sort=updatedAt,desc`; sort fields: taskNumber/createdAt/updatedAt/dueDate | `200`, page, excludes archived tasks | `400` page/sort, `401`, `403`, `404` project |
| `GET /api/v1/projects/{projectId}/tasks/{taskId}` | `PROJECT_VIEW` | UUID path | `200`, Task including `assigneeIds` | `401`, `403`, `404` scoped/archived task |
| `PATCH /api/v1/projects/{projectId}/tasks/{taskId}` | `TASK_MANAGE` | `{ "title": "Prepare final demo", "priority": "HIGH", "description": null, "startDate": null, "dueDate": null }` (full basic-field replacement) | `200`, updated Task | `400`, `401`, `403`, `404`, `409` archived/optimistic conflict |
| `PUT /api/v1/projects/{projectId}/tasks/{taskId}/assignees` | `TASK_MANAGE` | `{ "assigneeIds": ["<active-member-uuid>"] }`; empty array clears | `200`, replacement UUID set | `400` nonmember/invalid ID, `401`, `403`, `404`, `409` archived |
| `PATCH /api/v1/projects/{projectId}/tasks/{taskId}/status` | `TASK_MANAGE` or assigned `TASK_WORK` | `{ "status": "TODO" }` | `200`, Task; true change adds one history row | `400`, `401`, `403`, `404`, `409` invalid transition/archived |
| `PATCH /api/v1/projects/{projectId}/tasks/{taskId}/blocked` | `TASK_MANAGE` or assigned `TASK_WORK` | `{ "blocked": true, "reason": "Awaiting review" }` | `200`, Task; no status history | `400`, `401`, `403`, `404`, `409` DONE/archived |
| `GET /api/v1/projects/{projectId}/tasks/{taskId}/history` | `PROJECT_VIEW` | UUID path | `200`, chronological history array | `401`, `403`, `404` |
| `DELETE /api/v1/projects/{projectId}/tasks/{taskId}` | `TASK_MANAGE` | UUID path | `204`, soft archived | `401`, `403`, `404`, `409` archived |

`TaskPriority` defaults to `MEDIUM`; new tasks start `BACKLOG` and unblocked. The existing role model governs Task: `PROJECT_MANAGER` holds `TASK_MANAGE`; contributors and `TESTER` hold `TASK_WORK` for tasks actively assigned to them. Cross-project task IDs return `404` to callers who can read the path project.

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

---

## 16. Dependency and Supply-Chain Security

- Maven and npm dependencies must be reviewed before introducing them.
- Unnecessary dependencies must not be added.
- Dependabot alerts should remain enabled.
- Secret scanning should remain enabled.
- Known high/critical dependency vulnerabilities must be reviewed before release.
- Lock files such as `package-lock.json` must be committed.
- Dependency versions must not be silently changed by coding agents without the related task/context.

---

## 17. Docker and Container Security

- Secrets must not be baked into Docker images.
- `.env` must not be copied into images.
- Dockerfiles must not contain hard-coded credentials.
- Production images should contain only what is required to run the application.
- Development-only files and build artifacts should be excluded through `.dockerignore`.
- Container logs must follow the same secret-handling rules as application logs.

---

## 18. File and Path Safety

When file handling is introduced:

- user-controlled paths must not be trusted directly,
- path traversal must be prevented,
- filenames must not be treated as trusted identifiers,
- uploaded file type/content validation must be implemented according to the relevant feature's requirements.

File attachment/storage is outside PDA V1 unless explicitly approved.

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
