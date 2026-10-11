# PDA Migration Consolidation Plan

## Execution status

- [x] Phase 0 — `cleanup` — Read-only Flyway/schema audit
- [x] Task 1 — Current migration graph inventory
- [x] Task 2 — Migration safety/deployment classification
- [x] Task 3 — CREATE/ALTER dependency mapping
- [x] Task 4 — Safe migration consolidation
- [x] Task 5 — Entity/schema/API consistency verification
- [x] Task 6 — Fresh database migration verification
- [x] Task 7 — Existing database upgrade verification — new-history upgrade N/A, disposable DB decision
- [x] Task 8 — `cleanup` branch regression
- [x] Transition Gate — user commit confirmation; push/merge deferred until all gates pass
- [x] Phase 2 — `cleanup` — integrated pre-merge verification resumed per user request; literal uninterrupted full pre-push / main parity not claimed

## Accepted decisions — 2026-10-11

The user explicitly selected `cleanup` instead of `general-features` and confirmed that only disposable development/test databases exist; rewriting historical migrations is authorized. Commit/staging/push/merge/branch switching remain the user's responsibility. Latest user decision: commit now, push/merge after all phases; Phase 2 runs on cleanup before merge. Main has not been verified.

The running local database has all 59 original migrations applied successfully. Its named volume and data are retained. The consolidated history is for an **empty database**; it cannot upgrade that old database. No `repair`, `baseline-on-migrate`, validation bypass, default migration-location change or ENV-contract change is allowed. All isolated QA databases must be distinguished from the current application DB.

## Implementation strategy

1. Execute the original 59 migrations on separate PostgreSQL 18 audit database `pda_migration_reference_20261011` and capture its final catalog.
2. Preserve CREATE ownership and table order (later user request renumbers runtime files to V1–V40); move final columns, constraints, defaults, indexes and cascade rules into their table's CREATE. Production SQL files: **59 → 40**, tables: **55**. Current runtime versions are contiguous V1–V40; the inventory below uses original historical versions for traceability.
3. Retain only two forward-reference ALTERs: invitation team FK after squads in V25, task sprint FK after sprints in V45. Self-references are inline; no business behavior changes.
4. Preserve the original SQL bytes in a compressed **test-only** archive. Original historical upgrade tests use that archive. A new independent PostgreSQL 17/18 test compares the complete final schema and rejects use of consolidated SQL against old history.
5. Run targeted migration tests, full backend verify (JPA validation and actual API fixtures), frontend lint/type/build, critical Chromium workflows and isolated Docker startup/health.

## Data migration treatment

The new runtime history contains no old data transforms because its input is empty. No DML is disguised as a CREATE default. The following original behavior is retained verbatim in the reference archive:

- V4: activate legacy pending local accounts; auth/security data.
- V32: General Team creation/parent backfill; squad member user→membership conversion and deletion of invalid memberships.
- V34: project last editor backfill from creator.
- V36: General Team→ordinary team conversion, explicit membership backfill, pending invitation team assignment and updated_by backfill.
- V37: due_date→deadline_at at 23:59 Europe/Istanbul; obsolete date column/check removed in fresh schema.
- V40: status history→activity backfill; history table itself is retained.
- V54: existing project policy BOTH and old manual followers TRUE; new project policy remains nullable, fresh manual_watch defaults FALSE, task creation_mode defaults ADVANCED.
- V68: administrator forced-password flag reset; fresh users keep FALSE default, administrator bootstrap code is unchanged.

Historical deployed upgrade support is deliberately N/A under the user's disposable-only decision. The historical tests are reference regression evidence, **not** evidence that the new history upgrades old databases.

## Deferred verification

Phase 2 on `cleanup` before merge includes full Chromium and the **full** canonical `pre-push/pre-push.cmd`. Phase 1 cannot be called globally complete until that later gate passes. No completion mark may stand for a skipped/failed check.

## Migration inventory and classification

For each file below, operations identify touched objects; UPDATE/INSERT/DELETE entries are data migration/backfill, CREATE TABLE entries own their initial table, ALTER includes additions, drops, type/nullability/default/constraint changes. The mapping below records every table's actual migration chain. The reference archive preserves full SQL for detailed column-level inspection.

- `V1__spring_modulith_event_publication.sql` — CREATE TABLE, INDEX. CREATE TABLE IF NOT EXISTS event_publication; CREATE INDEX IF NOT EXISTS event_publication_serialized_event_hash_idx; CREATE INDEX IF NOT EXISTS event_publication_by_completion_date_idx.
- `V2__auth_user_session.sql` — CREATE TABLE, INDEX. CREATE TABLE users; CREATE TABLE user_sessions; CREATE INDEX ix_user_sessions_active_by_user.
- `V3__email_verification_challenges.sql` — CREATE TABLE. CREATE TABLE email_verification_challenges.
- `V4__activate_pending_local_accounts.sql` — DATA MIGRATION / BACKFILL. UPDATE users.
- `V5__user_session_refresh_rotation.sql` — ALTER TABLE / COLUMN / CONSTRAINT / FOREIGN KEY, INDEX. ALTER TABLE user_sessions; ALTER TABLE user_sessions; CREATE INDEX ix_user_sessions_previous_refresh_token_hash.
- `V6__user_oauth_identities.sql` — CREATE TABLE. CREATE TABLE user_oauth_identities.
- `V7__user_must_change_password.sql` — ALTER TABLE / COLUMN / CONSTRAINT / FOREIGN KEY. ALTER TABLE users.
- `V8__password_reset_challenges.sql` — CREATE TABLE. CREATE TABLE password_reset_challenges.
- `V21__project_organization_initial.sql` — CREATE TABLE, INDEX. CREATE TABLE organizations; CREATE INDEX ix_organizations_archived_at; CREATE TABLE projects; CREATE INDEX ix_projects_archived_at; CREATE INDEX ix_projects_organization_active.
- `V22__project_initial_membership.sql` — CREATE TABLE, INDEX. CREATE TABLE project_memberships; CREATE INDEX ix_project_memberships_user; CREATE TABLE project_membership_roles.
- `V23__project_membership_lifecycle_roles.sql` — ALTER TABLE / COLUMN / CONSTRAINT / FOREIGN KEY, INDEX. ALTER TABLE project_memberships; ALTER TABLE project_membership_roles; ALTER TABLE project_membership_roles; CREATE INDEX ix_project_memberships_project_status.
- `V24__project_invitations.sql` — CREATE TABLE, INDEX. CREATE TABLE project_invitations; CREATE INDEX ix_project_invitations_project_status; CREATE UNIQUE INDEX uk_project_invitations_pending_user; CREATE UNIQUE INDEX uk_project_invitations_pending_email; CREATE TABLE project_invitation_roles.
- `V25__squads.sql` — CREATE TABLE, INDEX. CREATE TABLE squads; CREATE INDEX ix_squads_project_active; CREATE TABLE squad_members; CREATE INDEX ix_squad_members_user.
- `V26__project_criteria.sql` — CREATE TABLE, INDEX. CREATE TABLE project_criteria; CREATE INDEX ix_project_criteria_project_sort.
- `V27__project_repository_connections.sql` — CREATE TABLE. CREATE TABLE project_repository_connections.
- `V28__task_core.sql` — CREATE TABLE, INDEX. CREATE TABLE project_task_counters; CREATE TABLE tasks; CREATE INDEX ix_tasks_project_active_updated.
- `V29__task_assignments.sql` — CREATE TABLE, INDEX. CREATE TABLE task_assignments; CREATE INDEX ix_task_assignments_task; CREATE INDEX ix_task_assignments_user.
- `V30__task_status_history.sql` — CREATE TABLE, INDEX. CREATE TABLE task_status_history; CREATE INDEX ix_task_status_history_task_changed.
- `V31__notifications.sql` — CREATE TABLE, INDEX. CREATE TABLE notifications; CREATE INDEX ix_notifications_recipient_created; CREATE INDEX ix_notifications_recipient_unread.
- `V32__project_teams_and_registered_invitations.sql` — ALTER TABLE / COLUMN / CONSTRAINT / FOREIGN KEY, INDEX, DATA MIGRATION / BACKFILL. ALTER TABLE squads; ALTER TABLE squads; ALTER TABLE squads; ALTER TABLE squads; ALTER TABLE squads; CREATE UNIQUE INDEX uk_squads_general_per_project; CREATE INDEX ix_squads_parent_active; INSERT INTO squads; UPDATE squads; ALTER TABLE squad_members; UPDATE squad_members; DELETE FROM squad_members; ALTER TABLE squad_members; ALTER TABLE squad_members; ALTER TABLE squad_members; DROP INDEX ix_squad_members_user; ALTER TABLE squad_members; ALTER TABLE squad_members; CREATE INDEX ix_squad_members_membership; ALTER TABLE project_invitations; CREATE INDEX ix_project_invitations_invitee_status.
- `V33__external_project_invitations.sql` — ALTER TABLE / COLUMN / CONSTRAINT / FOREIGN KEY, INDEX. ALTER TABLE project_invitations; ALTER TABLE users; CREATE UNIQUE INDEX uk_project_invitations_pending_email_ci; CREATE UNIQUE INDEX uk_users_email_ci.
- `V34__project_identity.sql` — ALTER TABLE / COLUMN / CONSTRAINT / FOREIGN KEY, DATA MIGRATION / BACKFILL, CREATE TABLE. ALTER TABLE projects; UPDATE projects; CREATE TABLE project_logos.
- `V35__project_reminders.sql` — CREATE TABLE, INDEX. CREATE TABLE project_reminders; CREATE INDEX ix_project_reminders_project_date.
- `V36__teams_without_general.sql` — ALTER TABLE / COLUMN / CONSTRAINT / FOREIGN KEY, DATA MIGRATION / BACKFILL, INDEX. ALTER TABLE squads; UPDATE squads; ALTER TABLE squads; INSERT INTO squad_members; ALTER TABLE project_invitations; UPDATE project_invitations; CREATE INDEX ix_project_invitations_team_status; ALTER TABLE squads; DROP INDEX uk_squads_general_per_project; ALTER TABLE squads.
- `V37__task_deadline.sql` — ALTER TABLE / COLUMN / CONSTRAINT / FOREIGN KEY, DATA MIGRATION / BACKFILL, INDEX. ALTER TABLE tasks; UPDATE tasks; ALTER TABLE tasks; ALTER TABLE tasks; CREATE INDEX ix_tasks_deadline_open.
- `V38__task_pool.sql` — ALTER TABLE / COLUMN / CONSTRAINT / FOREIGN KEY, INDEX. ALTER TABLE tasks; CREATE INDEX ix_tasks_project_pool.
- `V39__task_subtasks_checklist.sql` — ALTER TABLE / COLUMN / CONSTRAINT / FOREIGN KEY, INDEX, CREATE TABLE. ALTER TABLE tasks; CREATE INDEX ix_tasks_parent; CREATE TABLE task_checklist_items; CREATE INDEX ix_task_checklist_task_position.
- `V40__task_comments_activity.sql` — CREATE TABLE, INDEX, DATA MIGRATION / BACKFILL. CREATE TABLE task_comments; CREATE INDEX ix_task_comments_task_created; CREATE TABLE task_comment_mentions; CREATE TABLE task_activities; CREATE INDEX ix_task_activities_task_created; INSERT INTO task_activities.
- `V41__task_labels_estimates.sql` — CREATE TABLE, INDEX, ALTER TABLE / COLUMN / CONSTRAINT / FOREIGN KEY. CREATE TABLE project_labels; CREATE UNIQUE INDEX uk_project_labels_name; CREATE TABLE task_labels; CREATE INDEX ix_task_labels_label; ALTER TABLE tasks.
- `V42__task_relations.sql` — CREATE TABLE, INDEX. CREATE TABLE task_relations; CREATE INDEX ix_task_relations_target.
- `V43__task_watchers.sql` — CREATE TABLE, INDEX. CREATE TABLE task_watchers; CREATE INDEX ix_task_watchers_user.
- `V44__task_attachments.sql` — CREATE TABLE, INDEX. CREATE TABLE task_attachments; CREATE INDEX ix_task_attachments_task; CREATE TABLE task_attachment_data.
- `V45__sprints.sql` — CREATE TABLE, INDEX, ALTER TABLE / COLUMN / CONSTRAINT / FOREIGN KEY. CREATE TABLE sprints; CREATE UNIQUE INDEX uk_sprints_one_active; CREATE INDEX ix_sprints_project; ALTER TABLE tasks; CREATE INDEX ix_tasks_sprint.
- `V46__task_worklogs.sql` — CREATE TABLE, INDEX. CREATE TABLE task_worklogs; CREATE INDEX ix_task_worklogs_task.
- `V47__project_banners.sql` — ALTER TABLE / COLUMN / CONSTRAINT / FOREIGN KEY, CREATE TABLE. ALTER TABLE projects; CREATE TABLE project_banners.
- `V48__user_preferences.sql` — CREATE TABLE. CREATE TABLE user_preferences.
- `V49__user_profile_photos.sql` — ALTER TABLE / COLUMN / CONSTRAINT / FOREIGN KEY, CREATE TABLE. ALTER TABLE users; CREATE TABLE user_profile_photos.
- `V50__password_reset_failure_window.sql` — ALTER TABLE / COLUMN / CONSTRAINT / FOREIGN KEY. ALTER TABLE password_reset_challenges.
- `V51__project_chat.sql` — CREATE TABLE, INDEX. CREATE TABLE chat_conversations; CREATE UNIQUE INDEX uk_chat_conversations_project; CREATE UNIQUE INDEX uk_chat_conversations_direct; CREATE INDEX ix_chat_conversations_direct_high; CREATE TABLE chat_messages; CREATE INDEX ix_chat_messages_conversation; CREATE TABLE chat_read_states.
- `V52__organization_profile_and_media.sql` — ALTER TABLE / COLUMN / CONSTRAINT / FOREIGN KEY, CREATE TABLE, INDEX. ALTER TABLE organizations; CREATE TABLE organization_media_objects; CREATE INDEX ix_organization_media_cleanup.
- `V53__organization_notes.sql` — ALTER TABLE / COLUMN / CONSTRAINT / FOREIGN KEY. ALTER TABLE organizations.
- `V54__task_creation_modes.sql` — ALTER TABLE / COLUMN / CONSTRAINT / FOREIGN KEY, DATA MIGRATION / BACKFILL, INDEX. ALTER TABLE projects; UPDATE projects; ALTER TABLE projects; ALTER TABLE tasks; ALTER TABLE tasks; CREATE INDEX ix_tasks_project_creation_mode; ALTER TABLE task_watchers; UPDATE task_watchers.
- `V55__chat_replies_and_reactions.sql` — ALTER TABLE / COLUMN / CONSTRAINT / FOREIGN KEY, INDEX, CREATE TABLE. ALTER TABLE chat_messages; ALTER TABLE chat_messages; ALTER TABLE chat_messages; ALTER TABLE chat_messages; ALTER TABLE chat_messages; ALTER TABLE chat_messages; CREATE INDEX ix_chat_messages_reply; CREATE TABLE chat_message_reactions.
- `V56__task_status_notification_snapshots.sql` — ALTER TABLE / COLUMN / CONSTRAINT / FOREIGN KEY. ALTER TABLE notifications.
- `V57__team_deletion_notifications.sql` — ALTER TABLE / COLUMN / CONSTRAINT / FOREIGN KEY, INDEX. ALTER TABLE notifications; CREATE UNIQUE INDEX uk_notifications_source_recipient; CREATE INDEX ix_notifications_team_popup_pending.
- `V58__project_delete_cascade.sql` — ALTER TABLE / COLUMN / CONSTRAINT / FOREIGN KEY. ALTER TABLE project_memberships; ALTER TABLE project_invitations; ALTER TABLE squads; ALTER TABLE project_criteria; ALTER TABLE project_repository_connections; ALTER TABLE project_task_counters; ALTER TABLE tasks; ALTER TABLE project_reminders; ALTER TABLE task_comments; ALTER TABLE task_activities; ALTER TABLE project_labels; ALTER TABLE task_relations; ALTER TABLE task_attachments; ALTER TABLE sprints; ALTER TABLE task_worklogs; ALTER TABLE chat_conversations; ALTER TABLE task_assignments; ALTER TABLE task_status_history; ALTER TABLE task_checklist_items; ALTER TABLE task_comments; ALTER TABLE task_activities; ALTER TABLE task_labels; ALTER TABLE task_relations; ALTER TABLE task_relations; ALTER TABLE task_watchers; ALTER TABLE task_attachments; ALTER TABLE task_worklogs; ALTER TABLE task_comment_mentions; ALTER TABLE task_labels; ALTER TABLE chat_messages; ALTER TABLE chat_read_states; ALTER TABLE squad_members.
- `V59__repository_commit_tracking.sql` — ALTER TABLE / COLUMN / CONSTRAINT / FOREIGN KEY, INDEX. ALTER TABLE project_repository_connections; CREATE INDEX ix_project_repository_connections_scan; ALTER TABLE notifications.
- `V60__invitation_notification_context.sql` — ALTER TABLE / COLUMN / CONSTRAINT / FOREIGN KEY. ALTER TABLE notifications.
- `V61__repository_tracking_mode.sql` — ALTER TABLE / COLUMN / CONSTRAINT / FOREIGN KEY. ALTER TABLE project_repository_connections.
- `V62__analytics_sessions_and_page_views.sql` — CREATE TABLE, INDEX. CREATE TABLE analytics_sessions; CREATE INDEX idx_analytics_sessions_started_at; CREATE TABLE analytics_page_views; CREATE INDEX idx_analytics_page_views_occurred_at; CREATE INDEX idx_analytics_page_views_session_id.
- `V63__contact_requests.sql` — CREATE TABLE, INDEX. CREATE TABLE contact_requests; CREATE INDEX idx_contact_requests_created_at.
- `V64__password_reset_completion.sql` — ALTER TABLE / COLUMN / CONSTRAINT / FOREIGN KEY, CREATE TABLE. ALTER TABLE password_reset_challenges; CREATE TABLE password_change_challenges.
- `V65__totp_two_factor.sql` — CREATE TABLE, INDEX. CREATE TABLE totp_credentials; CREATE TABLE totp_recovery_codes; CREATE INDEX ix_totp_recovery_codes_user.
- `V66__account_deletion.sql` — ALTER TABLE / COLUMN / CONSTRAINT / FOREIGN KEY, CREATE TABLE. ALTER TABLE users; ALTER TABLE users; CREATE TABLE account_deletion_requests.
- `V67__admin_verified_sessions_and_tickets.sql` — ALTER TABLE / COLUMN / CONSTRAINT / FOREIGN KEY, CREATE TABLE, INDEX. ALTER TABLE user_sessions; CREATE TABLE admin_auth_tickets; CREATE INDEX ix_admin_auth_tickets_user; CREATE INDEX ix_admin_auth_tickets_expires.
- `V68__bootstrap_admin_without_forced_password_change.sql` — DATA MIGRATION / BACKFILL. UPDATE users.
- `V69__support_requests.sql` — CREATE TABLE, INDEX. CREATE TABLE support_requests; CREATE INDEX idx_support_requests_created_at; CREATE INDEX idx_support_requests_status_created_at; CREATE INDEX idx_support_requests_category_created_at.
- `V70__admin_audit_events.sql` — CREATE TABLE, INDEX. CREATE TABLE admin_audit_events; CREATE INDEX idx_admin_audit_events_occurred_at; CREATE INDEX idx_admin_audit_events_action_occurred_at.
- `V71__analytics_cta_clicks_and_client_errors.sql` — CREATE TABLE, INDEX. CREATE TABLE analytics_cta_clicks; CREATE INDEX idx_analytics_cta_clicks_occurred_at; CREATE INDEX idx_analytics_cta_clicks_session_id; CREATE TABLE analytics_client_errors; CREATE INDEX idx_analytics_client_errors_occurred_at; CREATE INDEX idx_analytics_client_errors_session_id; CREATE INDEX idx_analytics_page_views_session_occurred.

## Table dependency graph

- `account_deletion_requests` — CREATE owner `V66__account_deletion.sql`; chain: V66.
- `admin_audit_events` — CREATE owner `V70__admin_audit_events.sql`; chain: V70.
- `admin_auth_tickets` — CREATE owner `V67__admin_verified_sessions_and_tickets.sql`; chain: V67.
- `analytics_client_errors` — CREATE owner `V71__analytics_cta_clicks_and_client_errors.sql`; chain: V71.
- `analytics_cta_clicks` — CREATE owner `V71__analytics_cta_clicks_and_client_errors.sql`; chain: V71.
- `analytics_page_views` — CREATE owner `V62__analytics_sessions_and_page_views.sql`; chain: V62.
- `analytics_sessions` — CREATE owner `V62__analytics_sessions_and_page_views.sql`; chain: V62.
- `chat_conversations` — CREATE owner `V51__project_chat.sql`; chain: V51 → V58.
- `chat_message_reactions` — CREATE owner `V55__chat_replies_and_reactions.sql`; chain: V55.
- `chat_messages` — CREATE owner `V51__project_chat.sql`; chain: V51 → V55 → V58.
- `chat_read_states` — CREATE owner `V51__project_chat.sql`; chain: V51 → V58.
- `contact_requests` — CREATE owner `V63__contact_requests.sql`; chain: V63.
- `email_verification_challenges` — CREATE owner `V3__email_verification_challenges.sql`; chain: V3.
- `event_publication` — CREATE owner `V1__spring_modulith_event_publication.sql`; chain: V1.
- `notifications` — CREATE owner `V31__notifications.sql`; chain: V31 → V56 → V57 → V59 → V60.
- `organization_media_objects` — CREATE owner `V52__organization_profile_and_media.sql`; chain: V52.
- `organizations` — CREATE owner `V21__project_organization_initial.sql`; chain: V21 → V52 → V53.
- `password_change_challenges` — CREATE owner `V64__password_reset_completion.sql`; chain: V64.
- `password_reset_challenges` — CREATE owner `V8__password_reset_challenges.sql`; chain: V8 → V50 → V64.
- `project_banners` — CREATE owner `V47__project_banners.sql`; chain: V47.
- `project_criteria` — CREATE owner `V26__project_criteria.sql`; chain: V26 → V58.
- `project_invitation_roles` — CREATE owner `V24__project_invitations.sql`; chain: V24.
- `project_invitations` — CREATE owner `V24__project_invitations.sql`; chain: V24 → V32 → V33 → V36 → V58.
- `project_labels` — CREATE owner `V41__task_labels_estimates.sql`; chain: V41 → V58.
- `project_logos` — CREATE owner `V34__project_identity.sql`; chain: V34.
- `project_membership_roles` — CREATE owner `V22__project_initial_membership.sql`; chain: V22 → V23.
- `project_memberships` — CREATE owner `V22__project_initial_membership.sql`; chain: V22 → V23 → V58.
- `project_reminders` — CREATE owner `V35__project_reminders.sql`; chain: V35 → V58.
- `project_repository_connections` — CREATE owner `V27__project_repository_connections.sql`; chain: V27 → V58 → V59 → V61.
- `project_task_counters` — CREATE owner `V28__task_core.sql`; chain: V28 → V58.
- `projects` — CREATE owner `V21__project_organization_initial.sql`; chain: V21 → V34 → V47 → V54.
- `sprints` — CREATE owner `V45__sprints.sql`; chain: V45 → V58.
- `squad_members` — CREATE owner `V25__squads.sql`; chain: V25 → V32 → V36 → V58.
- `squads` — CREATE owner `V25__squads.sql`; chain: V25 → V32 → V36 → V58.
- `support_requests` — CREATE owner `V69__support_requests.sql`; chain: V69.
- `task_activities` — CREATE owner `V40__task_comments_activity.sql`; chain: V40 → V58.
- `task_assignments` — CREATE owner `V29__task_assignments.sql`; chain: V29 → V58.
- `task_attachment_data` — CREATE owner `V44__task_attachments.sql`; chain: V44.
- `task_attachments` — CREATE owner `V44__task_attachments.sql`; chain: V44 → V58.
- `task_checklist_items` — CREATE owner `V39__task_subtasks_checklist.sql`; chain: V39 → V58.
- `task_comment_mentions` — CREATE owner `V40__task_comments_activity.sql`; chain: V40 → V58.
- `task_comments` — CREATE owner `V40__task_comments_activity.sql`; chain: V40 → V58.
- `task_labels` — CREATE owner `V41__task_labels_estimates.sql`; chain: V41 → V58.
- `task_relations` — CREATE owner `V42__task_relations.sql`; chain: V42 → V58.
- `task_status_history` — CREATE owner `V30__task_status_history.sql`; chain: V30 → V58.
- `task_watchers` — CREATE owner `V43__task_watchers.sql`; chain: V43 → V54 → V58.
- `task_worklogs` — CREATE owner `V46__task_worklogs.sql`; chain: V46 → V58.
- `tasks` — CREATE owner `V28__task_core.sql`; chain: V28 → V37 → V38 → V39 → V41 → V45 → V54 → V58.
- `totp_credentials` — CREATE owner `V65__totp_two_factor.sql`; chain: V65.
- `totp_recovery_codes` — CREATE owner `V65__totp_two_factor.sql`; chain: V65.
- `user_oauth_identities` — CREATE owner `V6__user_oauth_identities.sql`; chain: V6.
- `user_preferences` — CREATE owner `V48__user_preferences.sql`; chain: V48.
- `user_profile_photos` — CREATE owner `V49__user_profile_photos.sql`; chain: V49.
- `user_sessions` — CREATE owner `V2__auth_user_session.sql`; chain: V2 → V5 → V67.
- `users` — CREATE owner `V2__auth_user_session.sql`; chain: V2 → V4 → V7 → V33 → V49 → V66 → V68.

## Removed runtime files

- `V4__activate_pending_local_accounts.sql`
- `V5__user_session_refresh_rotation.sql`
- `V7__user_must_change_password.sql`
- `V23__project_membership_lifecycle_roles.sql`
- `V32__project_teams_and_registered_invitations.sql`
- `V33__external_project_invitations.sql`
- `V36__teams_without_general.sql`
- `V37__task_deadline.sql`
- `V38__task_pool.sql`
- `V50__password_reset_failure_window.sql`
- `V53__organization_notes.sql`
- `V54__task_creation_modes.sql`
- `V56__task_status_notification_snapshots.sql`
- `V57__team_deletion_notifications.sql`
- `V58__project_delete_cascade.sql`
- `V59__repository_commit_tracking.sql`
- `V60__invitation_notification_context.sql`
- `V61__repository_tracking_mode.sql`
- `V68__bootstrap_admin_without_forced_password_change.sql`

## Original CREATE owners — historical pre-renumber mapping

- `V1__spring_modulith_event_publication.sql`
- `V2__auth_user_session.sql`
- `V3__email_verification_challenges.sql`
- `V6__user_oauth_identities.sql`
- `V8__password_reset_challenges.sql`
- `V21__project_organization_initial.sql`
- `V22__project_initial_membership.sql`
- `V24__project_invitations.sql`
- `V25__squads.sql`
- `V26__project_criteria.sql`
- `V27__project_repository_connections.sql`
- `V28__task_core.sql`
- `V29__task_assignments.sql`
- `V30__task_status_history.sql`
- `V31__notifications.sql`
- `V34__project_identity.sql`
- `V35__project_reminders.sql`
- `V39__task_subtasks_checklist.sql`
- `V40__task_comments_activity.sql`
- `V41__task_labels_estimates.sql`
- `V42__task_relations.sql`
- `V43__task_watchers.sql`
- `V44__task_attachments.sql`
- `V45__sprints.sql`
- `V46__task_worklogs.sql`
- `V47__project_banners.sql`
- `V48__user_preferences.sql`
- `V49__user_profile_photos.sql`
- `V51__project_chat.sql`
- `V52__organization_profile_and_media.sql`
- `V55__chat_replies_and_reactions.sql`
- `V62__analytics_sessions_and_page_views.sql`
- `V63__contact_requests.sql`
- `V64__password_reset_completion.sql`
- `V65__totp_two_factor.sql`
- `V66__account_deletion.sql`
- `V67__admin_verified_sessions_and_tickets.sql`
- `V69__support_requests.sql`
- `V70__admin_audit_events.sql`
- `V71__analytics_cta_clicks_and_client_errors.sql`

## Reference integrity

Source commit: `148d2f1`. Archive SHA-256: `11598040f1527c8835364fb0aa37e4cc33b76f27fc58aef87d467eb2ded7a98c`.
All 59 archive entries match the source commit after only Git line-ending normalization.

## Phase 1 verification — BRANCH COMPLETE — cleanup

- PostgreSQL 17 and 18 independent old/new schema comparison: PASS; 55 tables, 473 columns, 55 PK, 62 FK, 89 CHECK, 24 UNIQUE and 69 standalone indexes. Defaults, nullability, live column order and backing indexes match; no sequences/custom schemas are introduced.
- Fresh Flyway migrate/validate and repeat migrate: PASS; 40 SQL migrations, final version V71. Old-history validation rejects rewritten scripts without changing history.
- Original V66→V71/V68→V71 data-upgrade tests: PASS using test-only legacy archive. New-history old-DB upgrade: N/A under disposable-only decision.
- Backend `mvnw.cmd clean verify`: PASS, 894 tests / 0 failures / 0 errors / 0 skipped.
- Frontend lint: PASS, 0 errors; two pre-existing unused-variable warnings in ui-ux-app/public specs. TypeScript and production build: PASS.
- Critical Chromium: PASS, 42 + 56 = 98 tests, no failures/skips; real Mailpit registration/password flows, org/project/team/task/notification, invitations/roles/calendar/chat/admin-2FA.
- Isolated Docker build/start: PASS on PostgreSQL 18; fresh Flyway and JPA validate startup, backend health UP, frontend canonical route HTTP200. Backend restart validates all 40 migrations with no pending work; smoke counts unchanged.
- Runtime JAR: exactly 40 SQL migrations, no legacy reference archive/helper.
- Current original backend restored with its original image; original database/media volumes retained. Temporary QA containers/network and frontend server stopped. Separate empty reference audit DB pda_migration_reference_20261011 remains available for read-only inspection.
- No frontend/main Java/API/ENV/Compose contract changes. `git diff --check`: PASS. No staging/commit/push/merge/branch switch.

## Next user action

Review `docs/compliation/2026-10-11-migration-consolidation-cleanup.md` and the SQL/test diff. Commit/push/merge the `cleanup` changes yourself, switch to `main`, and explicitly confirm completion before Phase 2. A new application image requires a separate empty DB; do not rebuild/start against the old local history or repair it. Full Chromium, full canonical pre-push and `PDA_MIGRATION_CONSOLIDATION_COMPLETION.md` are reserved for Phase 2 and remain pending.

## Phase 2 started — 2026-10-11

User confirmed commit and continuation after explicitly deferring push/merge until all phases finish. Branch cleanup, committed implementation 0b38a75, working tree clean before this documentation update. Full canonical pre-push will run against a separate temporary QA Compose project with an empty PostgreSQL18 database and Mailpit sink. The normal PostgreSQL/media volumes remain untouched. Original backend is temporarily stopped for the fixed 8080 E2E address and will be restored afterwards. All canonical steps run; COMPOSE_FILE/project isolation changes the target, not the gate logic. Main/post-merge parity remains a later manual gate.

## User-requested contiguous numbering — 2026-10-11

Production migration files are renamed to V1–V40 without any SQL-byte change. Legacy archive versions remain untouched. New forward-reference locations: V9 invitation→squad and V24 task→sprint. The next production migration is V41. Previously applied pre-renumber disposable schemas cannot reuse this history; only the temporary QA DB is recreated, normal DB/media volumes remain untouched. User requests resuming remaining tests rather than restarting the full pre-push. Completed backend class results are preserved; missing classes and the updated migration test will run before the remaining canonical frontend/Chromium/Docker steps. No uninterrupted full-script PASS will be claimed.

- `V1__spring_modulith_event_publication.sql` → `V1__spring_modulith_event_publication.sql`
- `V2__auth_user_session.sql` → `V2__auth_user_session.sql`
- `V3__email_verification_challenges.sql` → `V3__email_verification_challenges.sql`
- `V6__user_oauth_identities.sql` → `V4__user_oauth_identities.sql`
- `V8__password_reset_challenges.sql` → `V5__password_reset_challenges.sql`
- `V21__project_organization_initial.sql` → `V6__project_organization_initial.sql`
- `V22__project_initial_membership.sql` → `V7__project_initial_membership.sql`
- `V24__project_invitations.sql` → `V8__project_invitations.sql`
- `V25__squads.sql` → `V9__squads.sql`
- `V26__project_criteria.sql` → `V10__project_criteria.sql`
- `V27__project_repository_connections.sql` → `V11__project_repository_connections.sql`
- `V28__task_core.sql` → `V12__task_core.sql`
- `V29__task_assignments.sql` → `V13__task_assignments.sql`
- `V30__task_status_history.sql` → `V14__task_status_history.sql`
- `V31__notifications.sql` → `V15__notifications.sql`
- `V34__project_identity.sql` → `V16__project_identity.sql`
- `V35__project_reminders.sql` → `V17__project_reminders.sql`
- `V39__task_subtasks_checklist.sql` → `V18__task_subtasks_checklist.sql`
- `V40__task_comments_activity.sql` → `V19__task_comments_activity.sql`
- `V41__task_labels_estimates.sql` → `V20__task_labels_estimates.sql`
- `V42__task_relations.sql` → `V21__task_relations.sql`
- `V43__task_watchers.sql` → `V22__task_watchers.sql`
- `V44__task_attachments.sql` → `V23__task_attachments.sql`
- `V45__sprints.sql` → `V24__sprints.sql`
- `V46__task_worklogs.sql` → `V25__task_worklogs.sql`
- `V47__project_banners.sql` → `V26__project_banners.sql`
- `V48__user_preferences.sql` → `V27__user_preferences.sql`
- `V49__user_profile_photos.sql` → `V28__user_profile_photos.sql`
- `V51__project_chat.sql` → `V29__project_chat.sql`
- `V52__organization_profile_and_media.sql` → `V30__organization_profile_and_media.sql`
- `V55__chat_replies_and_reactions.sql` → `V31__chat_replies_and_reactions.sql`
- `V62__analytics_sessions_and_page_views.sql` → `V32__analytics_sessions_and_page_views.sql`
- `V63__contact_requests.sql` → `V33__contact_requests.sql`
- `V64__password_reset_completion.sql` → `V34__password_reset_completion.sql`
- `V65__totp_two_factor.sql` → `V35__totp_two_factor.sql`
- `V66__account_deletion.sql` → `V36__account_deletion.sql`
- `V67__admin_verified_sessions_and_tickets.sql` → `V37__admin_verified_sessions_and_tickets.sql`
- `V69__support_requests.sql` → `V38__support_requests.sql`
- `V70__admin_audit_events.sql` → `V39__admin_audit_events.sql`
- `V71__analytics_cta_clicks_and_client_errors.sql` → `V40__analytics_cta_clicks_and_client_errors.sql`

## Final pre-merge verification result — user-approved resumed workflow

V1–V40, all 40 SQL byte contents unchanged. Combined backend113 classes/894 tests/0fail/0error/0skip. Chromium current collection1012:992passed/0failed/20expectedskip/0missing, full run plus affected-package reruns. Lint/type/build/Docker health PASS. Canonical steps resumed; no uninterrupted full pre-push.cmd PASS or main execution claimed. New source/test/report changes are uncommitted. Completion: docs/compliation/2026-10-11-migration-renumbering-integrated-verification.md.

## Current CREATE owners

- `account_deletion_requests` → `V36__account_deletion.sql`
- `admin_audit_events` → `V39__admin_audit_events.sql`
- `admin_auth_tickets` → `V37__admin_verified_sessions_and_tickets.sql`
- `analytics_client_errors` → `V40__analytics_cta_clicks_and_client_errors.sql`
- `analytics_cta_clicks` → `V40__analytics_cta_clicks_and_client_errors.sql`
- `analytics_page_views` → `V32__analytics_sessions_and_page_views.sql`
- `analytics_sessions` → `V32__analytics_sessions_and_page_views.sql`
- `chat_conversations` → `V29__project_chat.sql`
- `chat_message_reactions` → `V31__chat_replies_and_reactions.sql`
- `chat_messages` → `V29__project_chat.sql`
- `chat_read_states` → `V29__project_chat.sql`
- `contact_requests` → `V33__contact_requests.sql`
- `email_verification_challenges` → `V3__email_verification_challenges.sql`
- `event_publication` → `V1__spring_modulith_event_publication.sql`
- `notifications` → `V15__notifications.sql`
- `organization_media_objects` → `V30__organization_profile_and_media.sql`
- `organizations` → `V6__project_organization_initial.sql`
- `password_change_challenges` → `V34__password_reset_completion.sql`
- `password_reset_challenges` → `V5__password_reset_challenges.sql`
- `project_banners` → `V26__project_banners.sql`
- `project_criteria` → `V10__project_criteria.sql`
- `project_invitation_roles` → `V8__project_invitations.sql`
- `project_invitations` → `V8__project_invitations.sql`
- `project_labels` → `V20__task_labels_estimates.sql`
- `project_logos` → `V16__project_identity.sql`
- `project_membership_roles` → `V7__project_initial_membership.sql`
- `project_memberships` → `V7__project_initial_membership.sql`
- `project_reminders` → `V17__project_reminders.sql`
- `project_repository_connections` → `V11__project_repository_connections.sql`
- `project_task_counters` → `V12__task_core.sql`
- `projects` → `V6__project_organization_initial.sql`
- `sprints` → `V24__sprints.sql`
- `squad_members` → `V9__squads.sql`
- `squads` → `V9__squads.sql`
- `support_requests` → `V38__support_requests.sql`
- `task_activities` → `V19__task_comments_activity.sql`
- `task_assignments` → `V13__task_assignments.sql`
- `task_attachment_data` → `V23__task_attachments.sql`
- `task_attachments` → `V23__task_attachments.sql`
- `task_checklist_items` → `V18__task_subtasks_checklist.sql`
- `task_comment_mentions` → `V19__task_comments_activity.sql`
- `task_comments` → `V19__task_comments_activity.sql`
- `task_labels` → `V20__task_labels_estimates.sql`
- `task_relations` → `V21__task_relations.sql`
- `task_status_history` → `V14__task_status_history.sql`
- `task_watchers` → `V22__task_watchers.sql`
- `task_worklogs` → `V25__task_worklogs.sql`
- `tasks` → `V12__task_core.sql`
- `totp_credentials` → `V35__totp_two_factor.sql`
- `totp_recovery_codes` → `V35__totp_two_factor.sql`
- `user_oauth_identities` → `V4__user_oauth_identities.sql`
- `user_preferences` → `V27__user_preferences.sql`
- `user_profile_photos` → `V28__user_profile_photos.sql`
- `user_sessions` → `V2__auth_user_session.sql`
- `users` → `V2__auth_user_session.sql`
