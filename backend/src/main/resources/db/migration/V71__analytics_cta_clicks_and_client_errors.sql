-- Two more consented, anonymous analytics event kinds. Both hang off an analytics session (so they inherit its consent
-- version, its retention and its ON DELETE CASCADE) and carry nothing a person typed: a click stores only an allow-listed
-- call-to-action id; a client error stores only the route template and an error kind from a fixed list - never a
-- message, stack trace, URL, query string or id.
CREATE TABLE analytics_cta_clicks (
    id UUID PRIMARY KEY,
    session_id UUID NOT NULL REFERENCES analytics_sessions (id) ON DELETE CASCADE,
    cta_id VARCHAR(40) NOT NULL CHECK (cta_id ~ '^[a-z][a-z0-9_]*$'),
    occurred_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX idx_analytics_cta_clicks_occurred_at ON analytics_cta_clicks (occurred_at);
CREATE INDEX idx_analytics_cta_clicks_session_id ON analytics_cta_clicks (session_id);

CREATE TABLE analytics_client_errors (
    id UUID PRIMARY KEY,
    session_id UUID NOT NULL REFERENCES analytics_sessions (id) ON DELETE CASCADE,
    path VARCHAR(200) NOT NULL,
    error_kind VARCHAR(24) NOT NULL CHECK (error_kind IN ('RENDER', 'CHUNK_LOAD', 'UNHANDLED_REJECTION', 'NETWORK')),
    occurred_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX idx_analytics_client_errors_occurred_at ON analytics_client_errors (occurred_at);
CREATE INDEX idx_analytics_client_errors_session_id ON analytics_client_errors (session_id);

-- Reports read the last page per session; an index on (session, time) keeps that cheap.
CREATE INDEX idx_analytics_page_views_session_occurred ON analytics_page_views (session_id, occurred_at);
