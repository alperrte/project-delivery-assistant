-- Stored support / contact messages (12-month retention, see the retention job). contact_requests (V63) stays the
-- content-free delivery counter behind the dashboard; this table is the only place that keeps what a person wrote, so
-- the privacy boundary is one table that only the administrator API (USER_MANAGE) can read.
-- A row is written whether or not the notification mail was accepted (delivery_status SENT/FAILED), so an outage of the
-- mail server never loses a message that was stored.
CREATE TABLE support_requests (
    id UUID PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    category VARCHAR(16) NOT NULL CHECK (category IN ('GENERAL', 'BUG', 'DATA_REQUEST', 'ACCESSIBILITY')),
    first_name VARCHAR(80) NOT NULL,
    last_name VARCHAR(80),
    email VARCHAR(254) NOT NULL,
    message VARCHAR(5000) NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'NEW' CHECK (status IN ('NEW', 'IN_PROGRESS', 'CLOSED')),
    status_changed_at TIMESTAMP WITH TIME ZONE NOT NULL,
    delivery_status VARCHAR(16) NOT NULL CHECK (delivery_status IN ('SENT', 'FAILED'))
);

CREATE INDEX idx_support_requests_created_at ON support_requests (created_at);
CREATE INDEX idx_support_requests_status_created_at ON support_requests (status, created_at);
CREATE INDEX idx_support_requests_category_created_at ON support_requests (category, created_at);
