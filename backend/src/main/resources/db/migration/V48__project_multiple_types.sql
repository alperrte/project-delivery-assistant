ALTER TABLE projects ADD COLUMN project_types VARCHAR(16)[];
UPDATE projects SET project_types = ARRAY[project_type];
ALTER TABLE projects ALTER COLUMN project_types SET DEFAULT ARRAY['OTHER']::VARCHAR(16)[];
ALTER TABLE projects ALTER COLUMN project_types SET NOT NULL;
-- A nonempty enum set in domain order; no duplicates, nulls or multiple dimensions.
ALTER TABLE projects ADD CONSTRAINT ck_projects_types CHECK (
    cardinality(project_types) BETWEEN 1 AND 5
    AND array_ndims(project_types) = 1
    AND array_position(project_types, NULL) IS NULL
    AND (array_to_string(project_types, ',') || ',') ~ '^(WEB,)?(MOBILE,)?(AI,)?(DESKTOP,)?(OTHER,)?$'
);
