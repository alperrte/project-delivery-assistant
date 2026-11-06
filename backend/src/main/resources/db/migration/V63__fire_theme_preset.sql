-- Extend the allowlist without rewriting existing preferences or historical migrations.
ALTER TABLE user_preferences DROP CONSTRAINT ck_preferences_animation_preset;
ALTER TABLE user_preferences ADD CONSTRAINT ck_preferences_animation_preset
    CHECK (animation_preset IN ('THUNDERSTORM', 'RAIN', 'SNOW', 'WATER', 'FIRE'));
