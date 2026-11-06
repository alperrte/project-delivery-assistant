-- Preferences only: no media infrastructure. Existing colors and appearance choices stay untouched.
ALTER TABLE user_preferences
    DROP CONSTRAINT ck_preferences_theme_type,
    ADD CONSTRAINT ck_preferences_theme_type CHECK (theme_type IN ('SOLID', 'GRADIENT', 'ANIMATED')),
    ADD COLUMN animation_preset VARCHAR(16) NOT NULL DEFAULT 'THUNDERSTORM',
    ADD COLUMN theme_sound_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN theme_sound_volume INTEGER NOT NULL DEFAULT 50,
    ADD COLUMN theme_animation_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    ADD CONSTRAINT ck_preferences_animation_preset CHECK (animation_preset IN ('THUNDERSTORM', 'RAIN', 'SNOW', 'WATER')),
    ADD CONSTRAINT ck_preferences_sound_volume CHECK (theme_sound_volume BETWEEN 0 AND 100);
