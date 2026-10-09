-- Operational record of public contact-form submissions. It deliberately holds NO name, e-mail address or message: the
-- message is only mailed to the PDA inbox. The row exists to count successful submissions (the admin dashboard) and to
-- show delivery failures; FAILED rows are never counted as requests.
CREATE TABLE contact_requests (
    id UUID PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    delivery_status VARCHAR(16) NOT NULL CHECK (delivery_status IN ('SENT', 'FAILED'))
);

CREATE INDEX idx_contact_requests_created_at ON contact_requests (created_at);
