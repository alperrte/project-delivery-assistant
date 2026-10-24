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
