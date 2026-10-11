-- Consolidated fresh-install schema; legacy transformations are retained in the test reference archive.
-- This history replaces disposable pre-consolidation databases; do not repair an old database into it.

CREATE TABLE event_publication (
    id uuid NOT NULL,
    listener_id text NOT NULL,
    event_type text NOT NULL,
    serialized_event text NOT NULL,
    publication_date TIMESTAMPTZ NOT NULL,
    completion_date TIMESTAMPTZ,
    status text,
    completion_attempts integer,
    last_resubmission_date TIMESTAMPTZ,
    CONSTRAINT event_publication_pkey PRIMARY KEY (id)
);

CREATE INDEX event_publication_by_completion_date_idx ON event_publication USING btree (completion_date);

CREATE INDEX event_publication_serialized_event_hash_idx ON event_publication USING hash (serialized_event);
