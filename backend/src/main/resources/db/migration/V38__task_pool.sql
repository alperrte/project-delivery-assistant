-- Task pool (pool_team_id stays after a claim so a released task returns to the same audience): an unassigned task a project manager offers to everyone (or to one team) to claim.
ALTER TABLE tasks
    ADD COLUMN pool_open BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN pool_team_id UUID REFERENCES squads (id),
    ADD COLUMN claimed_from_pool BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX ix_tasks_project_pool ON tasks (project_id)
    WHERE pool_open AND archived_at IS NULL;
