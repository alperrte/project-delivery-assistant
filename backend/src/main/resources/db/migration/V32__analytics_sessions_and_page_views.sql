-- Consolidated fresh-install schema; legacy transformations are retained in the test reference archive.
-- This history replaces disposable pre-consolidation databases; do not repair an old database into it.

CREATE TABLE analytics_sessions (
    id uuid NOT NULL,
    visitor_id uuid NOT NULL,
    started_at TIMESTAMPTZ NOT NULL,
    last_seen_at TIMESTAMPTZ NOT NULL,
    engaged_seconds integer DEFAULT 0 NOT NULL,
    page_views integer DEFAULT 0 NOT NULL,
    entry_path VARCHAR(200) NOT NULL,
    source_type VARCHAR(16) NOT NULL,
    referrer_domain VARCHAR(100),
    utm_source VARCHAR(100),
    utm_medium VARCHAR(100),
    utm_campaign VARCHAR(100),
    consent_version integer NOT NULL,
    CONSTRAINT analytics_sessions_consent_version_check CHECK ((consent_version >= 1)),
    CONSTRAINT analytics_sessions_engaged_seconds_check CHECK (((engaged_seconds >= 0) AND (engaged_seconds <= 21600))),
    CONSTRAINT analytics_sessions_page_views_check CHECK ((page_views >= 0)),
    CONSTRAINT analytics_sessions_pkey PRIMARY KEY (id),
    CONSTRAINT analytics_sessions_source_type_check CHECK ((source_type IN ('DIRECT', 'SEARCH', 'REFERRAL', 'CAMPAIGN')))
);

CREATE INDEX idx_analytics_sessions_started_at ON analytics_sessions USING btree (started_at);

CREATE TABLE analytics_page_views (
    id uuid NOT NULL,
    session_id uuid NOT NULL,
    path VARCHAR(200) NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT analytics_page_views_pkey PRIMARY KEY (id),
    CONSTRAINT analytics_page_views_session_id_fkey FOREIGN KEY (session_id) REFERENCES analytics_sessions(id) ON DELETE CASCADE
);

CREATE INDEX idx_analytics_page_views_occurred_at ON analytics_page_views USING btree (occurred_at);

CREATE INDEX idx_analytics_page_views_session_id ON analytics_page_views USING btree (session_id);

CREATE INDEX idx_analytics_page_views_session_occurred ON analytics_page_views USING btree (session_id, occurred_at);
