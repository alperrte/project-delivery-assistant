-- Consolidated fresh-install schema; legacy transformations are retained in the test reference archive.
-- This history replaces disposable pre-consolidation databases; do not repair an old database into it.

CREATE TABLE project_task_counters (
    project_id uuid NOT NULL,
    key_prefix VARCHAR(100) NOT NULL,
    last_value bigint NOT NULL,
    CONSTRAINT project_task_counters_last_value_check CHECK ((last_value > 0)),
    CONSTRAINT project_task_counters_pkey PRIMARY KEY (project_id),
    CONSTRAINT project_task_counters_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE TABLE tasks (
    id uuid NOT NULL,
    project_id uuid NOT NULL,
    task_number bigint NOT NULL,
    task_key VARCHAR(125) NOT NULL,
    title VARCHAR(160) NOT NULL,
    description text,
    status VARCHAR(20) NOT NULL,
    priority VARCHAR(20) NOT NULL,
    start_date date,
    blocked boolean DEFAULT false NOT NULL,
    blocked_reason VARCHAR(500),
    created_by uuid NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_by uuid,
    updated_at TIMESTAMPTZ NOT NULL,
    archived_by uuid,
    archived_at TIMESTAMPTZ,
    version bigint DEFAULT 0 NOT NULL,
    deadline_at TIMESTAMPTZ,
    deadline_reminded_at TIMESTAMPTZ,
    deadline_overdue_notified_at TIMESTAMPTZ,
    pool_open boolean DEFAULT false NOT NULL,
    pool_team_id uuid,
    claimed_from_pool boolean DEFAULT false NOT NULL,
    parent_task_id uuid,
    estimate_points smallint,
    time_estimate_minutes integer,
    sprint_id uuid,
    creation_mode VARCHAR(16) DEFAULT 'ADVANCED'::character varying NOT NULL,
    CONSTRAINT ck_tasks_creation_mode CHECK ((creation_mode IN ('SIMPLE', 'ADVANCED'))),
    CONSTRAINT ck_tasks_done_blocked CHECK ((((status)::text <> 'DONE'::text) OR (blocked = false))),
    CONSTRAINT ck_tasks_not_own_parent CHECK (((parent_task_id IS NULL) OR (parent_task_id <> id))),
    CONSTRAINT tasks_estimate_points_check CHECK ((estimate_points = ANY (ARRAY[0, 1, 2, 3, 5, 8, 13, 21]))),
    CONSTRAINT tasks_parent_task_id_fkey FOREIGN KEY (parent_task_id) REFERENCES tasks(id),
    CONSTRAINT tasks_pkey PRIMARY KEY (id),
    CONSTRAINT tasks_pool_team_id_fkey FOREIGN KEY (pool_team_id) REFERENCES squads(id),
    CONSTRAINT tasks_priority_check CHECK ((priority IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL'))),
    CONSTRAINT tasks_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    CONSTRAINT tasks_status_check CHECK ((status IN ('BACKLOG', 'TODO', 'IN_PROGRESS', 'IN_REVIEW', 'TESTING', 'DONE'))),
    CONSTRAINT tasks_time_estimate_minutes_check CHECK (((time_estimate_minutes >= 1) AND (time_estimate_minutes <= 100000))),
    CONSTRAINT uk_tasks_project_key UNIQUE (project_id, task_key),
    CONSTRAINT uk_tasks_project_number UNIQUE (project_id, task_number)
);

CREATE INDEX ix_tasks_deadline_open ON tasks USING btree (deadline_at) WHERE ((archived_at IS NULL) AND ((status)::text <> 'DONE'::text) AND (deadline_at IS NOT NULL));

CREATE INDEX ix_tasks_parent ON tasks USING btree (parent_task_id) WHERE (parent_task_id IS NOT NULL);

CREATE INDEX ix_tasks_project_active_updated ON tasks USING btree (project_id, archived_at, updated_at);

CREATE INDEX ix_tasks_project_creation_mode ON tasks USING btree (project_id, creation_mode) WHERE (archived_at IS NULL);

CREATE INDEX ix_tasks_project_pool ON tasks USING btree (project_id) WHERE (pool_open AND (archived_at IS NULL));

CREATE INDEX ix_tasks_sprint ON tasks USING btree (sprint_id) WHERE (sprint_id IS NOT NULL);
