-- Consolidated fresh-install schema; legacy transformations are retained in the test reference archive.
-- This history replaces disposable pre-consolidation databases; do not repair an old database into it.

CREATE TABLE project_reminders (
    id uuid NOT NULL,
    project_id uuid NOT NULL,
    creator_user_id uuid NOT NULL,
    title VARCHAR(100) NOT NULL,
    description VARCHAR(500),
    type VARCHAR(20) NOT NULL,
    scope VARCHAR(20) NOT NULL,
    reminder_date date NOT NULL,
    reminder_time time without time zone,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT ck_project_reminders_scope CHECK ((scope IN ('PERSONAL', 'PROJECT'))),
    CONSTRAINT ck_project_reminders_type CHECK ((type IN ('MEETING', 'DEADLINE', 'PRESENTATION', 'REVIEW', 'DELIVERY', 'WORK', 'OTHER'))),
    CONSTRAINT project_reminders_pkey PRIMARY KEY (id),
    CONSTRAINT project_reminders_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX ix_project_reminders_project_date ON project_reminders USING btree (project_id, reminder_date);
