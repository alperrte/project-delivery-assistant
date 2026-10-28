-- Meetings belong to users (organizer + attendees), never to a project. Staged and data preserving:
--   1. every person who could reach a meeting through its old project becomes an explicit attendee, so nobody loses a record;
--   2. meetings.project_id stays as a nullable legacy column (no code reads or writes it any more) and no longer cascades,
--      so deleting a project cannot delete a meeting; a later migration drops the column once this one is verified in production;
--   3. meeting notifications no longer need a project.
INSERT INTO meeting_attendees (meeting_id, user_id)
SELECT m.id, pm.user_id
FROM meetings m
JOIN project_memberships pm ON pm.project_id = m.project_id AND pm.status = 'ACTIVE'
WHERE m.project_id IS NOT NULL AND pm.user_id <> m.organizer_id
ON CONFLICT DO NOTHING;

-- People who actually took part (for example members removed from the project later) keep the meeting they attended.
INSERT INTO meeting_attendees (meeting_id, user_id)
SELECT DISTINCT mp.meeting_id, mp.user_id
FROM meeting_participants mp
JOIN meetings m ON m.id = mp.meeting_id
WHERE mp.user_id IS NOT NULL AND mp.user_id <> m.organizer_id
ON CONFLICT DO NOTHING;

ALTER TABLE meetings DROP CONSTRAINT IF EXISTS meetings_project_id_fkey;
ALTER TABLE meetings ALTER COLUMN project_id DROP NOT NULL;
ALTER TABLE meetings ADD CONSTRAINT meetings_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL;
COMMENT ON COLUMN meetings.project_id IS 'Legacy, unused since V57: meetings are user-owned. Safe to drop in a later migration.';

DROP INDEX IF EXISTS meeting_project_schedule_idx;
CREATE INDEX meeting_organizer_schedule_idx ON meetings(organizer_id, starts_at, id);
CREATE INDEX meeting_attendees_user_idx ON meeting_attendees(user_id, meeting_id);

ALTER TABLE notifications DROP CONSTRAINT ck_notification_meeting_event;
ALTER TABLE notifications ADD CONSTRAINT ck_notification_meeting_event CHECK (
    (type NOT IN ('MEETING_CREATED','MEETING_UPDATED','MEETING_CANCELLED','MEETING_OPENED','MEETING_OVERTIME','MEETING_ENDED')
        AND resource_type <> 'MEETING')
    OR
    (type IN ('MEETING_CREATED','MEETING_UPDATED','MEETING_CANCELLED','MEETING_OPENED','MEETING_OVERTIME','MEETING_ENDED')
        AND resource_type = 'MEETING' AND source_event_id IS NOT NULL
        AND task_status_previous IS NULL AND task_status_current IS NULL AND task_key IS NULL
        AND task_title IS NULL AND actor_nickname IS NULL AND repo_project_name IS NULL
        AND repo_full_name IS NULL AND repo_branch IS NULL AND repo_commit_count IS NULL
        AND repo_commits_truncated IS NULL AND repo_head_message IS NULL AND repo_head_author IS NULL
        AND invitation_project_name IS NULL)
);
