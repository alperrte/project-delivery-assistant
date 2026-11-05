-- Additive, account-owned color settings; all pre-existing interface preferences stay unchanged.
ALTER TABLE user_preferences
    ADD COLUMN theme_type VARCHAR(8) NOT NULL DEFAULT 'SOLID',
    ADD COLUMN solid_color VARCHAR(7) NOT NULL DEFAULT '#1B5FE0',
    ADD COLUMN gradient_start_color VARCHAR(7) NOT NULL DEFAULT '#1B5FE0',
    ADD COLUMN gradient_end_color VARCHAR(7) NOT NULL DEFAULT '#8B5CF6',
    ADD COLUMN gradient_angle INTEGER NOT NULL DEFAULT 135,
    ADD CONSTRAINT ck_preferences_theme_type CHECK (theme_type IN ('SOLID', 'GRADIENT')),
    ADD CONSTRAINT ck_preferences_solid_color CHECK (solid_color ~ '^#[0-9A-F]{6}$'),
    ADD CONSTRAINT ck_preferences_gradient_start CHECK (gradient_start_color ~ '^#[0-9A-F]{6}$'),
    ADD CONSTRAINT ck_preferences_gradient_end CHECK (gradient_end_color ~ '^#[0-9A-F]{6}$'),
    ADD CONSTRAINT ck_preferences_gradient_angle CHECK (gradient_angle BETWEEN 0 AND 360);
