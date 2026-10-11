-- Consolidated fresh-install schema; legacy transformations are retained in the test reference archive.
-- This history replaces disposable pre-consolidation databases; do not repair an old database into it.

CREATE TABLE analytics_cta_clicks (
    id uuid NOT NULL,
    session_id uuid NOT NULL,
    cta_id VARCHAR(40) NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT analytics_cta_clicks_cta_id_check CHECK (((cta_id)::text ~ '^[a-z][a-z0-9_]*$'::text)),
    CONSTRAINT analytics_cta_clicks_pkey PRIMARY KEY (id),
    CONSTRAINT analytics_cta_clicks_session_id_fkey FOREIGN KEY (session_id) REFERENCES analytics_sessions(id) ON DELETE CASCADE
);

CREATE INDEX idx_analytics_cta_clicks_occurred_at ON analytics_cta_clicks USING btree (occurred_at);

CREATE INDEX idx_analytics_cta_clicks_session_id ON analytics_cta_clicks USING btree (session_id);

CREATE TABLE analytics_client_errors (
    id uuid NOT NULL,
    session_id uuid NOT NULL,
    path VARCHAR(200) NOT NULL,
    error_kind VARCHAR(24) NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT analytics_client_errors_error_kind_check CHECK ((error_kind IN ('RENDER', 'CHUNK_LOAD', 'UNHANDLED_REJECTION', 'NETWORK'))),
    CONSTRAINT analytics_client_errors_pkey PRIMARY KEY (id),
    CONSTRAINT analytics_client_errors_session_id_fkey FOREIGN KEY (session_id) REFERENCES analytics_sessions(id) ON DELETE CASCADE
);

CREATE INDEX idx_analytics_client_errors_occurred_at ON analytics_client_errors USING btree (occurred_at);

CREATE INDEX idx_analytics_client_errors_session_id ON analytics_client_errors USING btree (session_id);
