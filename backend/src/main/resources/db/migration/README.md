# Consolidated fresh-install history

The 2026-10-11 consolidation is authorized for disposable development/test databases only. Its 40 baseline SQL files create the same 55 application tables as the previous 59-file history. At the user's explicit request, baseline versions are contiguous V1–V40; table creation order and SQL contents are preserved. Feature migrations append to that baseline; the next migration must be V43.
The 2026-10-11 consolidation is authorized for disposable development/test databases only. Its 40 baseline SQL files create the same 55 application tables as the previous 59-file history. At the user's explicit request, baseline versions are contiguous V1–V40; table creation order and SQL contents are preserved. Feature migrations append to that baseline; the next migration must be V49.
The 2026-10-11 consolidation is authorized for disposable development/test databases only. Its 40 baseline SQL files create the same 55 application tables as the previous 59-file history. At the user's explicit request, baseline versions are contiguous V1–V40; table creation order and SQL contents are preserved. Feature migrations append to that baseline; the next migration must be V48.


Final columns, defaults, nullability, named constraints, indexes and cascade rules are declared with their table's CREATE. Two forward references remain:

- V9 adds `project_invitations.team_id`'s foreign key after `squads` exists.
- V24 adds `tasks.sprint_id`'s foreign key after `sprints` exists.

Self-referencing task/team/chat constraints are declared inline. The production history has no data backfills: it starts with an empty database. Historical data transforms are preserved in `src/test/resources/migration-reference/pre-consolidation.zip`; that fixture is not packaged in the application JAR or scanned by production Flyway.

**An already migrated pre-consolidation database is incompatible with these rewritten scripts.** Do not use `repair`, `baseline-on-migrate`, or disable validation to make it start. Use a separate empty development/test database. Existing databases/volumes are never reset automatically. This is not an upgrade path for deployed or shared databases; if such a database exists, stop and revisit the deployment strategy before installing this history.

`MigrationConsolidationTest` independently runs the archived history and this history on PostgreSQL 17 and 18, compares their complete final catalogs, validates both and verifies rejection of an old-history upgrade. Detailed inventory, ownership, data treatment and execution status are in the root `PDA_MIGRATION_CONSOLIDATION_PLAN.md`.

Forward feature migrations after the consolidated baseline: V41 chat deletion, V42 independent project/organization logo shape (default SQUARE, NOT NULL, enum CHECK). The original consolidation catalog comparison targets V40; fresh application startup and logo-shape upgrade tests run the latest history. The next version is V43.
Forward feature migrations after the consolidated baseline: V41 chat deletion, V42 independent project/organization logo shape (default SQUARE, NOT NULL, enum CHECK), V43–V46 central chat/attachments/message receipts/legacy group read evidence, V47 nullable navbar visibility preference, V48 nonempty canonical project type arrays, V49 message delivery receipts, V50 nullable language transition preference (existing rows default to true in application layer). The original consolidation catalog comparison targets V40; fresh application startup and feature upgrade tests cover their respective versions. The next version is V51.

## V51 — message search (2026-10-14)

V51 adds trusted `pg_trgm`, immutable NFC/mixed Turkish-English case folding and a partial expression GIN on non-deleted chat content. It leaves the V50 schema's existing records, history cursor btree, read/delivery evidence and permissions intact. Both fresh PostgreSQL 17 Testcontainers startup and the existing local PostgreSQL 18 V50→V51 startup were verified. The next feature version is V52.

## V55 — meeting icon, per-user history and reminder skip reasons (2026-10-23)

V55 adds `meetings.icon` (NOT NULL, default `video`, allowlist CHECK), the `meeting_user_hidden` table (per-user hidden finished/cancelled meetings, PK(meeting_id,user_id), FK cascade) with a user index, and widens the `meeting_reminder_deliveries.error_code` CHECK with the four skip reasons. Existing rows keep valid defaults; no data backfill. The next migration is V56.

## V56 — meeting chat replies and reactions (2026-10-24)

V56 adds `meeting_chat_messages.reply_to_message_id` with a composite foreign key `(reply_to_message_id, meeting_id) → (id, meeting_id)` (a reply can only point into its own meeting; deleting the answered message clears just the link), a self-reply CHECK, and the `meeting_chat_reactions` table (PK message+participant+emoji, CASCADE with the message and the participant). Existing messages keep working without a reply or reactions; no backfill. The next migration is V57.

## V57 — global meetings (2026-10-27)

V57 makes meetings user-owned without losing a record. It (1) adds every active member of a meeting's old project and every past participant of that meeting to `meeting_attendees` (organizer excluded, existing attendees kept, `ON CONFLICT DO NOTHING`), so nobody loses access to a meeting they could reach before; (2) makes `meetings.project_id` nullable and replaces its `ON DELETE CASCADE` foreign key with `ON DELETE SET NULL` (the column stays, unused, for one release; drop it in a later migration once V57 is verified in production); (3) replaces the project index with `meeting_organizer_schedule_idx(organizer_id, starts_at, id)` and adds `meeting_attendees_user_idx(user_id, meeting_id)`; (4) removes the `project_id IS NOT NULL` requirement from `ck_notification_meeting_event` (all other invariants kept; existing notification rows are untouched). Side effect to know before deploying: upcoming scheduled meetings gain the former project members as attendees, so they can also receive the one-hour reminder e-mail. `MeetingV57MigrationTest` upgrades a real V56 database and checks the data. The next migration is V59.

## V58 — hybrid meetings (2026-10-27)

V58 lets a meeting optionally belong to a project again, without reviving the stale values V57 left behind. It drops `meetings_project_id_fkey`, renames the old `project_id` column to `legacy_project_id` (archival, never read; every existing meeting therefore stays independent), adds a new nullable `project_id` with a fresh `meetings_project_id_fkey ... ON DELETE SET NULL` (deleting a project turns its meetings independent instead of deleting them), and creates the partial index `meeting_project_idx(project_id, starts_at, id) WHERE project_id IS NOT NULL`. The meeting type is derived (`project_id IS NULL` = independent); no type column exists. No row is deleted or rewritten. `MeetingV58MigrationTest` and `MeetingV57ReminderUpgradeIntegrationTest` upgrade real V56/V57 databases. Drop `legacy_project_id` in a later migration once V58 is verified in production.

## V59 — remove the obsolete meeting project archive (2026-10-27)

This section supersedes V58's earlier proposal to wait for a separate production release before dropping the archive. V58 has not run in production and can run immediately before V59, subject to the mandatory backup gate below.

`V59__drop_legacy_meeting_project_id.sql` drops only `meetings.legacy_project_id` with `RESTRICT`, in Flyway's configured schema/search path as used by V58. V58 already removed its foreign key and V57 removed its index; no additional dependency is dropped. An unexpected dependent view blocks the transaction instead of being removed through `CASCADE`. The active nullable `project_id`, its `meetings_project_id_fkey ON DELETE SET NULL`, `meeting_project_idx`, meeting rows, organizer, attendees, participants and other meeting data remain. No application code maps or queries the removed archive. Earlier SQL migrations remain immutable. Next version: V60.

**Mandatory production deployment gate (operator-owned):** before starting the new backend, stop writers using the normal maintenance procedure, take a fresh consistent full PostgreSQL backup outside Git in restricted storage, and verify its restore in an isolated environment. Before V58 the historical links are named `meetings.project_id`; after V58 they are `meetings.legacy_project_id`. A local backup does not protect production. Verify that the production backup contains those historical links, current meeting data and Flyway history; compare counts and private fingerprints without logging user data. Do not start the V58/V59 deployment unless backup and restore verification pass. SQL cannot verify an external backup; this gate must be enforced by the operator. No production connection, backup or deployment was performed in this task.

**Recovery:** recreating an empty column cannot recover the discarded historical associations. Keep the full pre-upgrade backup and its version manifest. Restore it to a separate isolated database first; extract historical meeting-ID/project-ID mappings privately if required. Never write those mappings into the active `project_id`: V57-era meetings intentionally stay independent. Use a reviewed forward corrective migration for any needed archive recovery; full database rollback requires a maintenance window, a compatible application build and reconciliation of all writes since the backup. Do not edit old migrations, delete/repair Flyway history or bypass validation.

Verification: `MeetingV59MigrationTest` covers V57→V58→V59, V58 hybrid data, full fresh history, project deletion, alternate-schema isolation and refusal of an unexpected dependent view. The full local V58 backup was restored in a network-isolated PostgreSQL 18 container; applying the exact V59 SQL there preserved all 71 tables' row fingerprints except the intentionally removed column (2,739 meetings, one active project link). Synthetic Flyway and backend regression results and operator checks: `docs/compliation/2026-10-27-meeting-legacy-project-cleanup.md`.