-- A password reset code allows 5 wrong guesses, but asking for a new code used to reset that counter, so an
-- attacker could keep guessing about 5 times a minute. These two columns count wrong guesses across codes inside
-- a one-hour window; reaching the limit blocks the reset until the window ends.
ALTER TABLE password_reset_challenges
    ADD COLUMN window_failures INT NOT NULL DEFAULT 0,
    ADD COLUMN failure_window_started_at TIMESTAMPTZ,
    ADD CONSTRAINT ck_password_reset_challenges_window_failures CHECK (window_failures >= 0);
