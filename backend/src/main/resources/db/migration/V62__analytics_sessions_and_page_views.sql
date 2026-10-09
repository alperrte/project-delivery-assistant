-- First-party, consent-gated visit analytics. Anonymous by design: there is no user column, no IP, no user agent and no
-- query string. A visitor/session id is a random UUID created in the browser only after the person allowed analytics.
CREATE TABLE analytics_sessions (
    id UUID PRIMARY KEY,
    visitor_id UUID NOT NULL,
    started_at TIMESTAMP WITH TIME ZONE NOT NULL,
    last_seen_at TIMESTAMP WITH TIME ZONE NOT NULL,
    engaged_seconds INTEGER NOT NULL DEFAULT 0 CHECK (engaged_seconds >= 0 AND engaged_seconds <= 21600),
    page_views INTEGER NOT NULL DEFAULT 0 CHECK (page_views >= 0),
    entry_path VARCHAR(200) NOT NULL,
    source_type VARCHAR(16) NOT NULL CHECK (source_type IN ('DIRECT', 'SEARCH', 'REFERRAL', 'CAMPAIGN')),
    referrer_domain VARCHAR(100),
    utm_source VARCHAR(100),
    utm_medium VARCHAR(100),
    utm_campaign VARCHAR(100),
    consent_version INTEGER NOT NULL CHECK (consent_version >= 1)
);

CREATE INDEX idx_analytics_sessions_started_at ON analytics_sessions (started_at);

CREATE TABLE analytics_page_views (
    id UUID PRIMARY KEY,
    session_id UUID NOT NULL REFERENCES analytics_sessions (id) ON DELETE CASCADE,
    path VARCHAR(200) NOT NULL,
    occurred_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX idx_analytics_page_views_occurred_at ON analytics_page_views (occurred_at);
CREATE INDEX idx_analytics_page_views_session_id ON analytics_page_views (session_id);
