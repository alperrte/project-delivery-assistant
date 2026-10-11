-- Consolidated fresh-install schema; legacy transformations are retained in the test reference archive.
-- This history replaces disposable pre-consolidation databases; do not repair an old database into it.

CREATE TABLE contact_requests (
    id uuid NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    delivery_status VARCHAR(16) NOT NULL,
    CONSTRAINT contact_requests_delivery_status_check CHECK ((delivery_status IN ('SENT', 'FAILED'))),
    CONSTRAINT contact_requests_pkey PRIMARY KEY (id)
);

CREATE INDEX idx_contact_requests_created_at ON contact_requests USING btree (created_at);
