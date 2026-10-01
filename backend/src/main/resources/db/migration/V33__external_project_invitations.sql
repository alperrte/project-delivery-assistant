ALTER TABLE project_invitations
    ADD COLUMN invitee_first_name VARCHAR(100),
    ADD COLUMN invitee_last_name VARCHAR(100),
    ADD COLUMN message VARCHAR(100);

ALTER TABLE users
    ADD COLUMN first_name VARCHAR(100),
    ADD COLUMN last_name VARCHAR(100);

-- Historical email invitations can have no names; the service validates all newly created external invitations.

CREATE UNIQUE INDEX uk_project_invitations_pending_email_ci
    ON project_invitations (project_id, lower(email))
    WHERE status = 'PENDING' AND email IS NOT NULL;

CREATE UNIQUE INDEX uk_users_email_ci ON users (lower(email));
