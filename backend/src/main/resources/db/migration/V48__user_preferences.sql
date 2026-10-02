-- Each user's saved interface defaults (Settings page). A missing row, or a NULL column, means "never chosen":
-- the browser then keeps whatever it already has. Temporary header changes are never stored here.
CREATE TABLE user_preferences (
    user_id UUID PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
    locale VARCHAR(8) CHECK (locale IN ('tr', 'en', 'de')),
    theme VARCHAR(8) CHECK (theme IN ('system', 'light', 'dark')),
    motion VARCHAR(8) CHECK (motion IN ('system', 'on', 'off')),
    theme_transition BOOLEAN,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);
