# F5-00 — Task backend contract audit

Date: 2026-09-29. Source: current code on `task-service-backend`, not the draft phase plan.

| Contract | Verified state |
| --- | --- |
| ProjectRole | `PROJECT_MANAGER`, `BACKEND_DEVELOPER`, `FRONTEND_DEVELOPER`, `FULL_STACK_DEVELOPER`, `AI_ML_DEVELOPER`, `UI_UX_DEVELOPER`, `TESTER`, `ANALYST` in `com.pda.user.ProjectRole`. Multiple roles combine by permission union. |
| Project read | Active member with `PROJECT_VIEW`, via public `ProjectAccess.hasPermission`. Unknown or archived projects return no access. |
| Project write | `PROJECT_MANAGER` has `TASK_MANAGE`; contributors have `TASK_WORK`. Task create, basic edit, assignment and archive use `TASK_MANAGE`. Assigned contributors can change status and blocked state using `TASK_WORK`. Global `ADMIN` has no implicit project permission. |
| Project archive | `Project.archivedAt != null`; public `ProjectAccess` currently reports no access for archived projects. Task mutations on archived projects must return 409; reads follow Project's active-only rule. |
| Membership lookup | Public `ProjectAccess.isMember(projectId,userId)` checks active project and active membership, one user at a time. A batch lookup must be added for assignment; Task must not use Project repository or entity. |
| Member removal event | None. `ProjectMembershipService.removeMember` must publish a scalar-data integration event after removal; Task cleans stale assignments idempotently. |
| Slug | `Project.slug` exists but is absent from public contract. Add a small public Task context method to expose slug and archived state. |
| Current user ID | `@AuthenticationPrincipal UserAccounts.AuthenticatedUser`; `.id()` via `AuthenticatedActor.id` pattern. |
| Global ADMIN | `GlobalRole.ADMIN` / Spring `ROLE_ADMIN`, only platform permissions. No Task bypass. |
| UUID and audit | `java.util.UUID`, `Instant` timestamps; Project uses `@PrePersist`/`@PreUpdate`. |
| Highest Flyway | `V27__project_repository_connections.sql`; next Task migration begins at V28. |
| Task package | Placeholder only. No Task implementation or tests. |
| Docs drift | Draft F5 role matrix (`OWNER/MANAGER/MEMBER/VIEWER`) and ADMIN Task bypass contradict canonical `RolePolicy` and Auth Faz 7. `.agents/api.md` contains older Auth wording but its current role section matches code. |

## Frozen Task authorization

All operations require active project membership. Read requires `PROJECT_VIEW`. Create, basic edit, replace assignees and archive require `TASK_MANAGE`. Status and block changes require either `TASK_MANAGE`, or `TASK_WORK` **and an active assignment to that task**. A creator who is not assigned receives no special write privilege. Task API does not grant ADMIN an exception. This uses the existing permission model without changing `RolePolicy`.

## Integration changes

Add a Project public context method for slug/archive classification and a batch active member lookup. Publish a `ProjectMemberRemovedEvent` from Project when a member is removed; Task consumes it to remove assignments. This preserves the modular boundary. Security routes for Task API must be explicitly authenticated while retaining cookie CSRF and project service checks.
