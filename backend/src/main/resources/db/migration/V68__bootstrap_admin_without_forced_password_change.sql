-- The ENV-provided administrator no longer has to change its password at first sign-in (the authenticator app is the
-- compensating control). must_change_password was only ever set by the administrator bootstrap, so clearing it for
-- administrators leaves no other temporary-password flow touched.
UPDATE users SET must_change_password = FALSE WHERE global_role = 'ADMIN' AND must_change_password = TRUE;
