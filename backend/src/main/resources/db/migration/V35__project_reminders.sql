CREATE TABLE project_reminders (
    id UUID PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES projects (id),
    creator_user_id UUID NOT NULL,
    title VARCHAR(100) NOT NULL,
    description VARCHAR(500),
    type VARCHAR(20) NOT NULL,
    scope VARCHAR(20) NOT NULL,
    reminder_date DATE NOT NULL,
    reminder_time TIME,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT ck_project_reminders_type CHECK (type IN
        ('MEETING', 'DEADLINE', 'PRESENTATION', 'REVIEW', 'DELIVERY', 'WORK', 'OTHER')),
    CONSTRAINT ck_project_reminders_scope CHECK (scope IN ('PERSONAL', 'PROJECT'))
);

-- Calendar reads are always "one project, one date range"; personal/project visibility is a cheap filter on that slice.
CREATE INDEX ix_project_reminders_project_date ON project_reminders (project_id, reminder_date);
