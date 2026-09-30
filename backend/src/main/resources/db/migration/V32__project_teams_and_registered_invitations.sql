-- Extend the existing squad organization model in place. Existing squad IDs remain stable.
ALTER TABLE squads ADD COLUMN parent_squad_id UUID;
ALTER TABLE squads ADD COLUMN is_general BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE squads ADD CONSTRAINT uk_squads_id_project UNIQUE (id, project_id);
ALTER TABLE squads ADD CONSTRAINT fk_squads_parent_same_project
    FOREIGN KEY (parent_squad_id, project_id) REFERENCES squads (id, project_id);
ALTER TABLE squads ADD CONSTRAINT ck_squads_general_root
    CHECK (NOT is_general OR (parent_squad_id IS NULL AND archived_at IS NULL));
CREATE UNIQUE INDEX uk_squads_general_per_project ON squads (project_id) WHERE is_general;
CREATE INDEX ix_squads_parent_active ON squads (parent_squad_id) WHERE archived_at IS NULL;

-- Backfill one root for every existing project; General membership is derived from active ProjectMembership.
INSERT INTO squads (id, project_id, name, description, created_by, created_at, updated_at, archived_at, is_general)
SELECT gen_random_uuid(), p.id, 'General Team', NULL, p.created_by, p.created_at, p.created_at, NULL, TRUE
FROM projects p;
UPDATE squads child SET parent_squad_id = root.id
FROM squads root WHERE root.project_id = child.project_id AND root.is_general AND NOT child.is_general;

-- Existing custom-team assignments are converted to authoritative membership IDs.
ALTER TABLE squad_members ADD COLUMN project_membership_id UUID;
UPDATE squad_members sm SET project_membership_id = pm.id
FROM squads s JOIN project_memberships pm ON pm.project_id = s.project_id
WHERE sm.squad_id = s.id AND sm.user_id = pm.user_id AND pm.status = 'ACTIVE';
DELETE FROM squad_members WHERE project_membership_id IS NULL;
ALTER TABLE squad_members ALTER COLUMN project_membership_id SET NOT NULL;
ALTER TABLE squad_members ADD CONSTRAINT fk_squad_members_project_membership
    FOREIGN KEY (project_membership_id) REFERENCES project_memberships (id);
ALTER TABLE squad_members DROP CONSTRAINT uk_squad_members_squad_user;
DROP INDEX ix_squad_members_user;
ALTER TABLE squad_members DROP COLUMN user_id;
ALTER TABLE squad_members ADD CONSTRAINT uk_squad_members_squad_membership
    UNIQUE (squad_id, project_membership_id);
CREATE INDEX ix_squad_members_membership ON squad_members (project_membership_id);

-- New invitations are registered-user only. Historical email invitations remain readable for compatibility.
ALTER TABLE project_invitations ADD COLUMN rejection_message VARCHAR(500);
CREATE INDEX ix_project_invitations_invitee_status
    ON project_invitations (invited_user_id, status, created_at DESC);
