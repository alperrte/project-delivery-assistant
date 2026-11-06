-- Preserve all preferences while allowing gradient accents and animated backgrounds together.
ALTER TABLE user_preferences
    ALTER COLUMN theme_type TYPE VARCHAR(24),
    DROP CONSTRAINT ck_preferences_theme_type,
    ADD CONSTRAINT ck_preferences_theme_type CHECK (theme_type IN ('SOLID', 'GRADIENT', 'ANIMATED', 'ANIMATED_GRADIENT'));
