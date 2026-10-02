package com.pda.user.api;

import com.pda.user.UserAccounts;
import com.pda.user.application.service.UserProfilePhotoService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import org.springframework.http.CacheControl;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.Duration;
import java.util.UUID;

/**
 * A user's profile photo. Changing or removing it is only ever about the signed-in caller (the route says `me`, there
 * is no user id to tamper with); reading a photo is open to any signed-in user, because it is an avatar shown next to
 * a person's name in teams, comments and invitations.
 */
@RestController
@RequestMapping("/api/v1/users")
public class UserProfilePhotoController {

    public record PhotoResponse(long profilePhotoVersion) {
    }

    private final UserProfilePhotoService photos;

    public UserProfilePhotoController(UserProfilePhotoService photos) {
        this.photos = photos;
    }

    @PutMapping(value = "/me/profile-photo", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Upload my profile photo", description = "Multipart field `file`; PNG, JPEG or WebP up to "
            + "5 MB and 6000 px per side, detected from the file content. Replaces the current photo. Requires CSRF.")
    @ApiResponse(responseCode = "200", description = "Photo stored; the new version for the cache-busting `?v=`")
    public ResponseEntity<PhotoResponse> replace(@AuthenticationPrincipal UserAccounts.AuthenticatedUser principal,
                                                 @RequestParam("file") MultipartFile file) throws IOException {
        long version = photos.replace(principal.id(), file.getBytes());
        return ResponseEntity.ok().header(HttpHeaders.CACHE_CONTROL, "no-store").body(new PhotoResponse(version));
    }

    @DeleteMapping("/me/profile-photo")
    @Operation(summary = "Remove my profile photo", description = "Requires CSRF. The interface falls back to initials.")
    @ApiResponse(responseCode = "204", description = "Photo removed (also when there was none)")
    public ResponseEntity<Void> remove(@AuthenticationPrincipal UserAccounts.AuthenticatedUser principal) {
        photos.remove(principal.id());
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/me/profile-photo")
    @Operation(summary = "Get my profile photo")
    public ResponseEntity<byte[]> readMine(@AuthenticationPrincipal UserAccounts.AuthenticatedUser principal) {
        // This URL carries no `?v=`, so it must never be cached as immutable: a changed photo shows at once.
        return body(photos.read(principal.id()), CacheControl.noCache().cachePrivate());
    }

    @GetMapping("/{userId}/profile-photo")
    @Operation(summary = "Get a user's profile photo", description = "Any signed-in user. The URL is versioned with "
            + "`?v=profilePhotoVersion` so the response can be cached for a year.")
    public ResponseEntity<byte[]> read(@PathVariable UUID userId) {
        return body(photos.read(userId), CacheControl.maxAge(Duration.ofDays(365)).cachePrivate().immutable());
    }

    private static ResponseEntity<byte[]> body(UserProfilePhotoService.StoredPhoto photo, CacheControl cache) {
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(photo.contentType()))
                .header("X-Content-Type-Options", "nosniff")
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.inline().filename("profile-photo").build().toString())
                .header("Content-Security-Policy", "default-src 'none'; sandbox")
                .cacheControl(cache)
                .body(photo.data());
    }
}
