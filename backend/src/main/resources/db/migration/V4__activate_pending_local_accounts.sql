UPDATE users
SET account_status = 'ACTIVE', updated_at = CURRENT_TIMESTAMP
WHERE account_status = 'PENDING_VERIFICATION'
  AND email_verification_status = 'PENDING'
  AND password_hash IS NOT NULL;
