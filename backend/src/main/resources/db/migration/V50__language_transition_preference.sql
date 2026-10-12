-- Independent preference for language transition animation; defaults to enabled when null.
ALTER TABLE user_preferences ADD COLUMN language_transition boolean;
