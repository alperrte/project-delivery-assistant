-- Teams without the automatic General Team. Every active project member belongs to at least one team and
-- invitations are issued through a team.

-- Who last changed a team (name, parent, members); backfilled with the creator.
ALTER TABLE squads ADD COLUMN updated_by UUID;
UPDATE squads SET updated_by = created_by;
ALTER TABLE squads ALTER COLUMN updated_by SET NOT NULL;

-- Each existing General Team becomes a regular team. Active members that were only implicitly in it (no other
-- active team) get an explicit row, so nobody ends up outside every team.
INSERT INTO squad_members (id, squad_id, project_membership_id, added_by, added_at)
SELECT gen_random_uuid(), g.id, pm.id, p.created_by, pm.joined_at
FROM squads g
JOIN projects p ON p.id = g.project_id
JOIN project_memberships pm ON pm.project_id = g.project_id AND pm.status = 'ACTIVE'
WHERE g.is_general
  AND NOT EXISTS (
      SELECT 1 FROM squad_members sm JOIN squads s ON s.id = sm.squad_id
      WHERE sm.project_membership_id = pm.id AND s.archived_at IS NULL AND NOT s.is_general);

-- Invitations carry the team the invitee joins. Pending legacy invitations land in the former General Team.
ALTER TABLE project_invitations ADD COLUMN team_id UUID REFERENCES squads (id);
UPDATE project_invitations i SET team_id = g.id
FROM squads g WHERE g.project_id = i.project_id AND g.is_general AND i.status = 'PENDING';
CREATE INDEX ix_project_invitations_team_status ON project_invitations (team_id, status);

ALTER TABLE squads DROP CONSTRAINT ck_squads_general_root;
DROP INDEX uk_squads_general_per_project;
ALTER TABLE squads DROP COLUMN is_general;
