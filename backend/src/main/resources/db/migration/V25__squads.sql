CREATE TABLE squads (
    id UUID PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES projects (id),
    name VARCHAR(120) NOT NULL,
    description VARCHAR(2000),
    created_by UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    archived_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX ix_squads_project_active ON squads (project_id, archived_at);

CREATE TABLE squad_members (
    id UUID PRIMARY KEY,
    squad_id UUID NOT NULL REFERENCES squads (id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    added_by UUID NOT NULL,
    added_at TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT uk_squad_members_squad_user UNIQUE (squad_id, user_id)
);

CREATE INDEX ix_squad_members_user ON squad_members (user_id);
