-- Timed deadline (date + time) with reminder bookkeeping. due_date (date only) is migrated to 23:59 Istanbul time.
ALTER TABLE tasks
    ADD COLUMN deadline_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN deadline_reminded_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN deadline_overdue_notified_at TIMESTAMP WITH TIME ZONE;

UPDATE tasks
   SET deadline_at = (due_date + TIME '23:59') AT TIME ZONE 'Europe/Istanbul'
 WHERE due_date IS NOT NULL;

ALTER TABLE tasks DROP CONSTRAINT ck_tasks_dates;
ALTER TABLE tasks DROP COLUMN due_date;

CREATE INDEX ix_tasks_deadline_open ON tasks (deadline_at)
    WHERE archived_at IS NULL AND status <> 'DONE' AND deadline_at IS NOT NULL;
