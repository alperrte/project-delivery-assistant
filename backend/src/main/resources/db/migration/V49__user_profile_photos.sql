-- A user's profile photo. Like the project logo and banner, the bytes live in their own table (never read by list
-- queries) and the user row only carries a version, which becomes the cache-busting `?v=` of the photo URL.
ALTER TABLE users
    ADD COLUMN profile_photo_updated_at TIMESTAMP WITH TIME ZONE;

CREATE TABLE user_profile_photos (
    user_id UUID PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
    content_type VARCHAR(32) NOT NULL CHECK (content_type IN ('image/png', 'image/jpeg', 'image/webp')),
    data BYTEA NOT NULL,
    size_bytes INTEGER NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 5242880),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);
