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

---

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
