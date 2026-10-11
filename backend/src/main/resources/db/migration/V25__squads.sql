-- Consolidated fresh-install schema; legacy transformations are retained in the test reference archive.
-- This history replaces disposable pre-consolidation databases; do not repair an old database into it.

CREATE TABLE squads (
    id uuid NOT NULL,
    project_id uuid NOT NULL,
    name VARCHAR(120) NOT NULL,
    description VARCHAR(2000),
    created_by uuid NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    archived_at TIMESTAMPTZ,
    parent_squad_id uuid,
    updated_by uuid NOT NULL,
    CONSTRAINT fk_squads_parent_same_project FOREIGN KEY (parent_squad_id, project_id) REFERENCES squads(id, project_id),
    CONSTRAINT squads_pkey PRIMARY KEY (id),
    CONSTRAINT squads_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    CONSTRAINT uk_squads_id_project UNIQUE (id, project_id)
);

CREATE INDEX ix_squads_parent_active ON squads USING btree (parent_squad_id) WHERE (archived_at IS NULL);

CREATE INDEX ix_squads_project_active ON squads USING btree (project_id, archived_at);

CREATE TABLE squad_members (
    id uuid NOT NULL,
    squad_id uuid NOT NULL,
    added_by uuid NOT NULL,
    added_at TIMESTAMPTZ NOT NULL,
    project_membership_id uuid NOT NULL,
    CONSTRAINT fk_squad_members_project_membership FOREIGN KEY (project_membership_id) REFERENCES project_memberships(id) ON DELETE CASCADE,
    CONSTRAINT squad_members_pkey PRIMARY KEY (id),
    CONSTRAINT squad_members_squad_id_fkey FOREIGN KEY (squad_id) REFERENCES squads(id) ON DELETE CASCADE,
    CONSTRAINT uk_squad_members_squad_membership UNIQUE (squad_id, project_membership_id)
);

CREATE INDEX ix_squad_members_membership ON squad_members USING btree (project_membership_id);

-- Referenced tables now exist; these forward references cannot be declared in the earlier CREATE.
ALTER TABLE project_invitations ADD CONSTRAINT project_invitations_team_id_fkey FOREIGN KEY (team_id) REFERENCES squads(id);
