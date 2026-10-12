-- Existing users retain desktop auto-hide / mobile always-visible behavior until they choose.
ALTER TABLE user_preferences ADD COLUMN navbar_mode VARCHAR(16);
ALTER TABLE user_preferences ADD CONSTRAINT ck_user_preferences_navbar_mode
    CHECK (navbar_mode IN ('always-visible', 'auto-hide'));
