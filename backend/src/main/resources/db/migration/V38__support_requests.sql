-- Consolidated fresh-install schema; legacy transformations are retained in the test reference archive.
-- This history replaces disposable pre-consolidation databases; do not repair an old database into it.

CREATE TABLE support_requests (
    id uuid NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    category VARCHAR(16) NOT NULL,
    first_name VARCHAR(80) NOT NULL,
    last_name VARCHAR(80),
    email VARCHAR(254) NOT NULL,
    message VARCHAR(5000) NOT NULL,
    status VARCHAR(16) DEFAULT 'NEW'::character varying NOT NULL,
    status_changed_at TIMESTAMPTZ NOT NULL,
    delivery_status VARCHAR(16) NOT NULL,
    CONSTRAINT support_requests_category_check CHECK ((category IN ('GENERAL', 'BUG', 'DATA_REQUEST', 'ACCESSIBILITY'))),
    CONSTRAINT support_requests_delivery_status_check CHECK ((delivery_status IN ('SENT', 'FAILED'))),
    CONSTRAINT support_requests_pkey PRIMARY KEY (id),
    CONSTRAINT support_requests_status_check CHECK ((status IN ('NEW', 'IN_PROGRESS', 'CLOSED')))
);

CREATE INDEX idx_support_requests_category_created_at ON support_requests USING btree (category, created_at);

CREATE INDEX idx_support_requests_created_at ON support_requests USING btree (created_at);

CREATE INDEX idx_support_requests_status_created_at ON support_requests USING btree (status, created_at);
