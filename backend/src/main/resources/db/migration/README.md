# Consolidated fresh-install history

The 2026-10-11 consolidation is authorized for disposable development/test databases only. There are 40 versioned SQL files creating the same 55 application tables as the previous 59-file history. At the user's explicit request, versions are contiguous V1–V40; table creation order and SQL contents are preserved. The next migration must be V41.

Final columns, defaults, nullability, named constraints, indexes and cascade rules are declared with their table's CREATE. Two forward references remain:

- V9 adds `project_invitations.team_id`'s foreign key after `squads` exists.
- V24 adds `tasks.sprint_id`'s foreign key after `sprints` exists.

Self-referencing task/team/chat constraints are declared inline. The production history has no data backfills: it starts with an empty database. Historical data transforms are preserved in `src/test/resources/migration-reference/pre-consolidation.zip`; that fixture is not packaged in the application JAR or scanned by production Flyway.

**An already migrated pre-consolidation database is incompatible with these rewritten scripts.** Do not use `repair`, `baseline-on-migrate`, or disable validation to make it start. Use a separate empty development/test database. Existing databases/volumes are never reset automatically. This is not an upgrade path for deployed or shared databases; if such a database exists, stop and revisit the deployment strategy before installing this history.

`MigrationConsolidationTest` independently runs the archived history and this history on PostgreSQL 17 and 18, compares their complete final catalogs, validates both and verifies rejection of an old-history upgrade. Detailed inventory, ownership, data treatment and execution status are in the root `PDA_MIGRATION_CONSOLIDATION_PLAN.md`.
