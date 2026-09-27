-- The bootstrapped administrator must replace the operator-provided initial password on first login.
ALTER TABLE users ADD COLUMN must_change_password BOOLEAN NOT NULL DEFAULT FALSE;
