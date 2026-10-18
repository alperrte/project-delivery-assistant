# Meeting frontend handoff

## Branch ownership

Frontend changes belong to the current `meeting-system-frontend` working directory. The approved backend extension belongs exclusively to `.branch-worktrees/meeting-guest-contract`, checked out on `meeting-system-backend`. No commits or pushes were performed. Inspect and commit the two worktrees separately; integrate the backend contract before deploying the frontend.

The backend extension supplies non-consuming invitation preview, scoped guest meeting state, paged organizer/manager invitation metadata, existing-origin guest CORS registration, and exposed `Retry-After`. No backend sources were copied into this branch. While branches remain separate, read `.branch-worktrees/meeting-guest-contract/docs/meeting-guest-contract.md`. No migration was added.

## Routes and integration

Logical routes are localized through the existing TR/EN/DE router:

- `/projects/[slug]/meetings`: paged selected-project meetings with status filters.
- `/projects/[slug]/meetings/new`: immediate start or scheduling; title, description, agenda, real project member selection, local datetime to UTC conversion and timezone display.
- `/projects/[slug]/meetings/calendar`: existing month-grid component plus day agenda; global `/calendar` reads the same meeting source with cross-midnight overlap and no duplicate reminders.
- `/projects/[slug]/meetings/[meetingId]`, `/edit`, `/room`: details, organizer, planned attendee count, current participants, authorized mutations, invitation metadata and media room.
- `/meeting-guest`, `/meeting-guest/[meetingId]`: public guest exchange and room, outside the authenticated app layout.

Sidebar adds Meetings > Create / My meetings / Calendar. Project switching retains shared meeting list/calendar surfaces and discards resource IDs. MEETING notifications use the existing read/navigation owner, resolve the authorized project slug and link to real details. Event labels are localized; snapshot meeting titles remain user content. ONLINE is the only supported meeting type; no repeat/draft/physical controls are invented. “My meetings” shows the selected project's accessible meetings; no unsupported personal-attendee filter is added.

## Media lifetime

Official `livekit-client` 2.23.0 is pinned with its lockfile. SDK logs are silent. Audio/video/screens go through WebRTC/LiveKit. Chat uses authorized REST plus reliable `pda.meeting` invalidation and periodic reconciliation; central chat/STOMP is unchanged. Tokens stay in memory, outside logs, analytics, storage and React Query caches.

Join is explicit with mic/camera initially off. Camera preview/microphone test require user action and publish nothing. Track ownership/cleanup, device selection, device-change events, permission errors and audio autoplay recovery belong to the room. Volume affects only this browser and survives rotation in memory. Browser output-device support varies.

Unexpected disconnect or changed room epoch obtains fresh authorization and a new SDK Room. Reconnect is serialized, at least 2.5 seconds apart, with bounded exponential backoff, server Retry-After and at most six consecutive automatic retries. 401/403/404/409 stop retries. Duplicate identity stops instead of fighting another tab. Removed participants cannot obtain another token. REST reconciles rotation; the deleted room's data channel is not trusted to announce its replacement.

Previously chosen mic/camera is restored only when Permissions reports already-granted access; unsupported permission queries require explicit restoration. A remote mute clears mic intent. Screen sharing must be restarted explicitly. Meeting/chat state survives rotation. Explicit Leave calls the leave API; guest Leave revokes its session. Navigation/reload stops tracks and disconnects without a late REST leave that could revoke/remove the replacement connection. BFCache restoration re-authorizes. Server presence/empty-room reconciliation remains authoritative.

Elapsed/remaining time derives from instants. Planned end displays a non-blocking warning and never invokes End. End preserves meeting/calendar history and releases client tracks. Retention policy is displayed; there is no invented ended-chat archive.

## Security and local configuration

User approved camera/microphone/display-capture `(self)` only on room/guest pages; other rendered pages retain denied device permissions. Nonce CSP remains intact. Meeting pages add only the exact configured signaling origin and its HTTP(S) counterpart plus blob media. Origin parsing rejects credentials, path/query/fragment, insecure non-loopback WS and non-WS schemes. Guest pages have no-referrer, private/no-store and noindex/nofollow. Invitation capabilities arrive in fragments, are immediately removed, and are exchanged in CSRF-protected bodies. Guest 401 never invokes PDA refresh.

`frontend/.env.example` documents public `NEXT_PUBLIC_LIVEKIT_URL`; production uses the deployed WSS origin and requires a new build. API credentials remain backend-only. Approved local `.env.dev`/active `.env` now enable media with generated, unprinted credentials. `.env.prod` is untouched. Ignored `frontend/.env.local` uses `ws://localhost:7880`.

The running local backend image was built from the backend worktree with an ignored build-context override:

```powershell
docker compose -f docker-compose.yml -f docker-compose.meeting.yml -f tmp/docker-compose.meeting-contract.yml --profile meeting up -d --build
cd frontend
npm run dev
```

After integrating backend changes, base + meeting overlay can build the main backend source. Rebuilding this branch's old main backend source before integration removes the new endpoints. Do not print expanded Compose configuration or ENV files. Production DNS/TLS/ICE/firewall/NAT/TURN requirements remain in `docs/meeting-media-operations.md`.

Invitations are returned once: metadata survives reload and remains revocable, while only links still held in page memory can be copied. Guest-invalid intentionally combines wrong scope, expiry and revocation; expired/revoked access stops admission. No anonymous real-world identity guarantee is claimed.

## Verification

`npx playwright test --config playwright.meetings.config.ts` has isolated artifacts and disabled trace/video. Test-only local QA accounts are seeded using existing BCrypt/PostgreSQL fixtures without registration mail or changing real users. Normal success uses actual API, PostgreSQL and LiveKit; Chromium's capture devices and desktop picker automation are test inputs. RTC stats check received audio bytes/samples and decoded video frames. This does not prove physical speaker/mic quality, remote TURN, Safari/Firefox, full WCAG or manual screen-reader operation.

Exact final results and manual acceptance steps: `docs/compliation/2026-10-18-meeting-frontend.md`. SDK: https://docs.livekit.io/reference/client-sdk-js/ . UI review: https://github.com/vercel-labs/web-interface-guidelines . Existing development-only braces follow-up remains open: https://github.com/advisories/GHSA-vfj7-8cjw-p6xm ; production npm audit after installing LiveKit found zero vulnerabilities.
