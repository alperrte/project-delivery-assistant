# Meeting guest UI contract extension

Approved on 2026-10-18 for the frontend integration. These changes belong to `meeting-system-backend`, in the separate `.branch-worktrees/meeting-guest-contract` worktree. No commit, push, migration or production deployment was performed.

## Preview

`POST /api/v1/meetings/guest/preview`, JSON `{ "inviteToken": "<capability from URL fragment>" }`. Public with the existing CSRF cookie/header pair. The capability is hashed before lookup. Revoked, expired, exhausted or unknown invitations return `403 MEETING_INVITE_INVALID`. Missing/blank/overlong values return 400 through validation. Preview does not consume a use, create a participant, issue a guest cookie, or connect media.

200 `MeetingGuestView`: `id, title, startsAt, endsAt, zoneId, status, openedAt, overtime, chatRetained, agenda, roomEpoch, reconnectRequired`. Times are UTC Instants. A valid invitation may preview SCHEDULED or closed status; session creation still requires OPEN. No project/member/organizer identities, description, secret, token hash or internal room name are returned. Response: `Cache-Control: private, no-store`.

Preview shares session admission's existing 10 requests/minute/IP bucket and 2048-byte actual body limit; it does not get an unlimited separate quota. Existing bounded/process-local admission limitations remain.

## Session state

`GET /api/v1/meetings/guest/{meetingId}/state` returns the same minimal view. The existing `PDA_MEETING_GUEST` HttpOnly cookie must match this meeting and an unrevoked, unexpired session. Missing cookie is 401; invalid/wrong-meeting/expired/revoked session is 403. Invite revocation does not revoke an established session. Closed meeting state is readable by an otherwise valid session, allowing the client to stop reconnecting and release tracks.

## Invitation management

`GET /api/v1/projects/{projectId}/meetings/{meetingId}/invites?page=0&size=20` uses PDA authentication, current membership and organizer-or-PROJECT_MANAGER authorization. No global ADMIN bypass. Other members receive 403; foreign meeting scope receives 404. Page bounds: 0–10000, size 1–100. Stable descending `(expiresAt,id)` order.

200 page: `{ content:[{id,expiresAt,maxUses,uses,revoked}],page,size,totalElements,totalPages }`. No invitation capability or hash is recoverable. Existing POST generates a capability once; existing DELETE revokes it. After a frontend reload an old invitation can be revoked, but its secret cannot be copied again. Response: `private, no-store`.

## Browser transport

The existing exact `FRONTEND_URL` CORS policy is also registered for `/api/v1/meetings/guest/**`; origins, methods, request headers and credentials rules are unchanged. No wildcard or browser allowance for signed webhook paths is added. `Retry-After` is exposed so cross-origin clients can respect the existing rate-limit/rotation delays. Guest calls must not invoke PDA refresh on 401. No new CSRF exemption is introduced.

OpenAPI/Swagger, when already enabled: `/v3/api-docs`, `/swagger-ui/index.html`. For preview use GET `/api/v1/auth/csrf` and the resulting `X-XSRF-TOKEN`; obtain a real invitation with normal authorized project access. Session state additionally needs the scoped guest cookie. Invitation metadata uses ordinary cookie login. Never paste capabilities into URLs, examples, logs or screenshots.

## Validation

Tests cover real PostgreSQL invitation persistence, non-consuming preview, expiry/revocation/exhaustion, minimal DTO fields, metadata pagination/authorization, matching session scope, closed state, CSRF/body limits, exact CORS admission and rejection. See `docs/compliation/2026-10-18-meeting-guest-contract.md`.
