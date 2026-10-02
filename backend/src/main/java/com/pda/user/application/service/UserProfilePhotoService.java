package com.pda.user.application.service;

import com.pda.shared.ImageSniffer;
import com.pda.user.domain.entity.User;
import com.pda.user.domain.entity.UserProfilePhoto;
import com.pda.user.domain.enums.AccountStatus;
import com.pda.user.infrastructure.repository.UserProfilePhotoRepository;
import com.pda.user.infrastructure.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Instant;
import java.util.NoSuchElementException;
import java.util.Objects;
import java.util.UUID;

/**
 * Stores one profile photo per user in the database, the same way project logos and banners are stored: the type and
 * the dimensions are decided from the file's own bytes ({@link ImageSniffer}), the client's file name and content type
 * are never used, and nothing is written to disk, so there is no path to traverse and nothing to clean up outside the
 * database. Replacing and removing happen in one transaction: a refused or failed upload leaves the current photo
 * untouched, and a replaced photo leaves no orphan behind.
 *
 * <p>Every write is about the calling user; there is no way to name another user.
 */
@Service
public class UserProfilePhotoService {

    public record StoredPhoto(String contentType, byte[] data) {
    }

    private final UserRepository users;
    private final UserProfilePhotoRepository photos;
    private final Clock clock;

    public UserProfilePhotoService(UserRepository users, UserProfilePhotoRepository photos, Clock clock) {
        this.users = users;
        this.photos = photos;
        this.clock = clock;
    }

    /** Returns the new photo version (epoch milliseconds), the value of the `?v=` cache buster. */
    @Transactional
    public long replace(UUID userId, byte[] data) {
        Objects.requireNonNull(userId, "userId is required");
        if (data == null || data.length == 0) {
            throw new ProfilePhotoException(ProfilePhotoException.EMPTY);
        }
        if (data.length > UserProfilePhoto.MAX_BYTES) {
            throw new ProfilePhotoException(ProfilePhotoException.TOO_LARGE);
        }
        ImageSniffer.Image image;
        try {
            image = ImageSniffer.inspect(data);
        } catch (ImageSniffer.RejectedImageException rejected) {
            throw new ProfilePhotoException(rejected.reason() == ImageSniffer.Reason.DIMENSIONS
                    ? ProfilePhotoException.DIMENSIONS : ProfilePhotoException.INVALID_TYPE);
        }
        User user = activeUser(userId);
        Instant now = clock.instant();
        UserProfilePhoto photo = photos.findById(userId).orElse(null);
        if (photo == null) {
            photos.save(UserProfilePhoto.of(userId, image.contentType(), data, now));
        } else {
            photo.replace(image.contentType(), data, now);
            photos.save(photo);
        }
        user.profilePhotoStored(now);
        users.save(user);
        return now.toEpochMilli();
    }

    @Transactional
    public void remove(UUID userId) {
        Objects.requireNonNull(userId, "userId is required");
        User user = activeUser(userId);
        photos.deleteById(userId);
        user.profilePhotoRemoved();
        users.save(user);
    }

    /** Any signed-in user may see another account's photo (it is an avatar); inactive accounts have none. */
    @Transactional(readOnly = true)
    public StoredPhoto read(UUID userId) {
        Objects.requireNonNull(userId, "userId is required");
        activeUser(userId);
        UserProfilePhoto photo = photos.findById(userId)
                .orElseThrow(() -> new NoSuchElementException("Profile photo not found"));
        return new StoredPhoto(photo.getContentType(), photo.getData());
    }

    private User activeUser(UUID userId) {
        return users.findById(userId).filter(user -> user.getAccountStatus() == AccountStatus.ACTIVE)
                .orElseThrow(() -> new NoSuchElementException("User not found"));
    }
}
