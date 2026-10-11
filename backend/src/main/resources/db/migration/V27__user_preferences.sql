-- Consolidated fresh-install schema; legacy transformations are retained in the test reference archive.
-- This history replaces disposable pre-consolidation databases; do not repair an old database into it.

CREATE TABLE user_preferences (
    user_id uuid NOT NULL,
    locale VARCHAR(8),
    theme VARCHAR(8),
    motion VARCHAR(8),
    theme_transition boolean,
    updated_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT user_preferences_locale_check CHECK ((locale IN ('tr', 'en', 'de'))),
    CONSTRAINT user_preferences_motion_check CHECK ((motion IN ('system', 'on', 'off'))),
    CONSTRAINT user_preferences_pkey PRIMARY KEY (user_id),
    CONSTRAINT user_preferences_theme_check CHECK ((theme IN ('system', 'light', 'dark'))),
    CONSTRAINT user_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
