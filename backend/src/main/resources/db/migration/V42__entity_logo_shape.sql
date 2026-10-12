-- Defaults backfill existing records and keep legacy inserts compatible.
ALTER TABLE projects ADD COLUMN logo_shape VARCHAR(16) NOT NULL DEFAULT 'SQUARE';
ALTER TABLE organizations ADD COLUMN logo_shape VARCHAR(16) NOT NULL DEFAULT 'SQUARE';
ALTER TABLE projects ADD CONSTRAINT ck_projects_logo_shape CHECK (logo_shape IN ('SQUARE', 'CIRCLE'));
ALTER TABLE organizations ADD CONSTRAINT ck_organizations_logo_shape CHECK (logo_shape IN ('SQUARE', 'CIRCLE'));
