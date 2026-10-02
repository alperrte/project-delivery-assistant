package com.pda.user.domain.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

/** The photo bytes live apart from {@link User} so nothing that lists users ever reads them. */
@Entity
@Table(name = "user_profile_photos")
public class UserProfilePhoto {

    public static final int MAX_BYTES = 5 * 1024 * 1024;

    @Id
    @Column(name = "user_id")
    private UUID userId;

    @Column(name = "content_type", nullable = false, length = 32)
    private String contentType;

    @Column(nullable = false, columnDefinition = "bytea")
    private byte[] data;

    @Column(name = "size_bytes", nullable = false)
    private int sizeBytes;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected UserProfilePhoto() {
    }

    public static UserProfilePhoto of(UUID userId, String contentType, byte[] data, Instant at) {
        UserProfilePhoto photo = new UserProfilePhoto();
        photo.userId = Objects.requireNonNull(userId, "userId is required");
        photo.replace(contentType, data, at);
        return photo;
    }

    public void replace(String contentType, byte[] data, Instant at) {
        Objects.requireNonNull(contentType, "contentType is required");
        Objects.requireNonNull(data, "data is required");
        if (data.length == 0 || data.length > MAX_BYTES) {
            throw new IllegalArgumentException("profile photo size is out of range");
        }
        this.contentType = contentType;
        this.data = data.clone();
        this.sizeBytes = data.length;
        this.updatedAt = Objects.requireNonNull(at, "at is required");
    }

    public UUID getUserId() { return userId; }
    public String getContentType() { return contentType; }
    public byte[] getData() { return data.clone(); }
    public int getSizeBytes() { return sizeBytes; }
    public Instant getUpdatedAt() { return updatedAt; }
}
