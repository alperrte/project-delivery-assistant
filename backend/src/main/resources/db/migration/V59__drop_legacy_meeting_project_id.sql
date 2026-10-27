-- Deployment prerequisite: back up the database and verify an isolated restore BEFORE
-- V58/V59 run (pre-V58 links are still named project_id). Keep the backup outside Git.
-- This archive is not the active project link. V58 removed its FK and V57 removed
-- its index. RESTRICT deliberately rejects unexpected external dependencies.
-- Flyway's default schema/search_path selects the same meetings table as V58.
ALTER TABLE meetings DROP COLUMN legacy_project_id RESTRICT;
