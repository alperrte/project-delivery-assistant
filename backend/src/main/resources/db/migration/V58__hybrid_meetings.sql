-- Hybrid meetings: a meeting is either INDEPENDENT (no project) or a PROJECT meeting (one project), chosen when it is created.
-- The type is not stored: it is "project_id IS NULL" or not, so the two can never disagree, and deleting a project turns its meetings into
-- independent ones through ON DELETE SET NULL (nothing is deleted, owner/attendees/access are untouched).
--
-- Until now meetings.project_id was an unused legacy column that still holds the project every pre-V57 meeting once belonged to. Those meetings
-- were made global by V57 and must stay independent, so that stale value must never become a live project link. It is moved aside, with its
-- data, into legacy_project_id (archival only: nothing reads it, no foreign key) and project_id starts empty for every existing meeting.
ALTER TABLE meetings DROP CONSTRAINT IF EXISTS meetings_project_id_fkey;
ALTER TABLE meetings RENAME COLUMN project_id TO legacy_project_id;
COMMENT ON COLUMN meetings.legacy_project_id IS 'Archival: the project a meeting belonged to before V57 made meetings user-owned. Never read, never a link; may point at a deleted project.';

ALTER TABLE meetings ADD COLUMN project_id UUID;
ALTER TABLE meetings ADD CONSTRAINT meetings_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL;
COMMENT ON COLUMN meetings.project_id IS 'Set only for a PROJECT meeting (chosen at creation, immutable in the API); NULL means INDEPENDENT. Grants no access: access is organizer + meeting_attendees.';
CREATE INDEX meeting_project_idx ON meetings(project_id, starts_at, id) WHERE project_id IS NOT NULL;
