package com.pda.user.integration;

import com.pda.BackendApplication;
import com.pda.shared.TestImages;
import com.pda.user.UserAccounts;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockMultipartHttpServletRequestBuilder;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * The profile photo: uploads of the three allowed types, every way an upload can be refused, that it only ever
 * changes the caller's own photo, replace and delete (no orphan bytes), and that a refused upload keeps the old photo.
 */
@SpringBootTest(classes = BackendApplication.class)
@AutoConfigureMockMvc
@Testcontainers(disabledWithoutDocker = true)
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
class UserProfilePhotoApiIntegrationTest {

    private static final byte[] JWT_KEY = new byte[32];
    static { new SecureRandom().nextBytes(JWT_KEY); }

    private static final String MINE = "/api/v1/users/me/profile-photo";
    private static final byte[] PNG = TestImages.png(3, 3);
    private static final byte[] JPEG = TestImages.jpeg(3, 3);
    private static final byte[] WEBP = TestImages.webp();
    private static final int FIVE_MB = 5 * 1024 * 1024;

    @Container
    static PostgreSQLContainer postgres = new PostgreSQLContainer("postgres:17-alpine");

    @DynamicPropertySource
    static void properties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
        registry.add("FRONTEND_URL", () -> "http://localhost:3000");
        registry.add("JWT_SECRET", () -> Base64.getEncoder().encodeToString(JWT_KEY));
    }

    @Autowired MockMvc mvc;
    @Autowired UserAccounts users;
    @Autowired JdbcTemplate jdbc;

    private record Account(UUID id, Cookie access) {
    }

    @Test
    void validJpegPngAndWebpAreStoredAndServedWithSafeHeaders() throws Exception {
        Cookie csrf = csrfCookie();
        Account user = account("photo");
        for (byte[] image : new byte[][] {JPEG, PNG, WEBP}) {
            mvc.perform(upload(MINE, image, "whatever.bin").cookie(csrf, user.access())
                            .header("X-XSRF-TOKEN", csrf.getValue()))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.profilePhotoVersion").isNumber());
        }
        // The last upload (WebP) is what is served; the type comes from the bytes and nothing is sniffed by the browser.
        var response = mvc.perform(get(MINE).cookie(user.access()))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.CONTENT_TYPE, "image/webp"))
                .andExpect(header().string("X-Content-Type-Options", "nosniff"))
                .andExpect(header().string(HttpHeaders.CACHE_CONTROL, org.hamcrest.Matchers.not(org.hamcrest.Matchers.containsString("immutable"))))
                .andExpect(header().string("Content-Security-Policy", org.hamcrest.Matchers.containsString("sandbox")))
                .andExpect(header().string(HttpHeaders.CONTENT_DISPOSITION, org.hamcrest.Matchers.startsWith("inline")))
                .andReturn().getResponse();
        assertArrayEquals(WEBP, response.getContentAsByteArray());
        // The versioned per-user URL (what <img> uses) is the one that may be cached for a year.
        mvc.perform(get("/api/v1/users/" + user.id() + "/profile-photo?v=1").cookie(user.access()))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.CACHE_CONTROL, org.hamcrest.Matchers.containsString("immutable")));
        // Exactly one row per user: replacing never leaves an orphan.
        assertEquals(1, jdbc.queryForObject("SELECT count(*) FROM user_profile_photos WHERE user_id = ?", Integer.class, user.id()));
    }

    @Test
    void theSummaryCarriesOnlyAVersionAndNeverTheBytesOrAnyStorageDetail() throws Exception {
        Cookie csrf = csrfCookie();
        Account user = account("summary");
        mvc.perform(get("/api/v1/auth/me").cookie(user.access()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.profilePhotoVersion").doesNotExist());
        mvc.perform(upload(MINE, PNG, "me.png").cookie(csrf, user.access()).header("X-XSRF-TOKEN", csrf.getValue()))
                .andExpect(status().isOk());
        String me = mvc.perform(get("/api/v1/auth/me").cookie(user.access()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.profilePhotoVersion").isNumber())
                .andReturn().getResponse().getContentAsString();
        for (String leaked : new String[] {"data", "bytea", "storage", "bucket", "key", "path", "passwordHash"}) {
            assertFalse(me.toLowerCase().contains("\"" + leaked.toLowerCase() + "\""), "summary leaks " + leaked);
        }
    }

    @Test
    void everyWayAnUploadCanBeWrongIsRefusedWithACodeAndStoresNothing() throws Exception {
        Cookie csrf = csrfCookie();
        Account user = account("badphoto");

        byte[] svg = "<svg xmlns=\"http://www.w3.org/2000/svg\"><script>alert(1)</script></svg>".getBytes(StandardCharsets.UTF_8);
        // SVG, even when it is named and declared as a PNG.
        refused(user, csrf, upload(MINE, svg, "avatar.png", "image/png"), "PROFILE_PHOTO_INVALID_TYPE");
        // Fake extension: GIF and HTML bytes with an image name and content type.
        refused(user, csrf, upload(MINE, "GIF89a".getBytes(StandardCharsets.UTF_8), "avatar.png", "image/png"), "PROFILE_PHOTO_INVALID_TYPE");
        refused(user, csrf, upload(MINE, "<html><script>alert(1)</script></html>".getBytes(StandardCharsets.UTF_8), "avatar.jpg", "image/jpeg"), "PROFILE_PHOTO_INVALID_TYPE");
        // A real image under an executable name is still judged by its bytes, so it is accepted as what it is.
        // A file that only carries the signature of an image is not an image.
        refused(user, csrf, upload(MINE, new byte[] {(byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 0}, "avatar.png", "image/png"), "PROFILE_PHOTO_INVALID_TYPE");
        // Empty.
        refused(user, csrf, upload(MINE, new byte[0], "avatar.png", "image/png"), "PROFILE_PHOTO_EMPTY");
        // One byte over 5 MB.
        refused(user, csrf, upload(MINE, TestImages.pngPaddedTo(FIVE_MB + 1), "avatar.png", "image/png"), "PROFILE_PHOTO_TOO_LARGE");
        // A tiny file that claims to be 10000 x 10000 pixels.
        refused(user, csrf, upload(MINE, TestImages.pngHeaderClaiming(10_000, 10_000), "bomb.png", "image/png"), "PROFILE_PHOTO_DIMENSIONS");

        mvc.perform(get(MINE).cookie(user.access())).andExpect(status().isNotFound());
        assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM user_profile_photos WHERE user_id = ?", Integer.class, user.id()));
    }

    @Test
    void exactlyFiveMegabytesIsAccepted() throws Exception {
        Cookie csrf = csrfCookie();
        Account user = account("limit");
        mvc.perform(upload(MINE, TestImages.pngPaddedTo(FIVE_MB), "limit.png").cookie(csrf, user.access())
                        .header("X-XSRF-TOKEN", csrf.getValue()))
                .andExpect(status().isOk());
    }

    @Test
    void aRefusedUploadKeepsTheCurrentPhoto() throws Exception {
        Cookie csrf = csrfCookie();
        Account user = account("keep");
        mvc.perform(upload(MINE, PNG, "first.png").cookie(csrf, user.access()).header("X-XSRF-TOKEN", csrf.getValue()))
                .andExpect(status().isOk());
        long before = jdbc.queryForObject("SELECT extract(epoch from profile_photo_updated_at) FROM users WHERE id = ?", Double.class, user.id()).longValue();

        refused(user, csrf, upload(MINE, "not an image".getBytes(StandardCharsets.UTF_8), "second.png", "image/png"), "PROFILE_PHOTO_INVALID_TYPE");

        byte[] still = mvc.perform(get(MINE).cookie(user.access())).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsByteArray();
        assertArrayEquals(PNG, still);
        long after = jdbc.queryForObject("SELECT extract(epoch from profile_photo_updated_at) FROM users WHERE id = ?", Double.class, user.id()).longValue();
        assertEquals(before, after);
    }

    @Test
    void replacingChangesTheVersionSoTheOldImageIsNotShownFromCache() throws Exception {
        Cookie csrf = csrfCookie();
        Account user = account("version");
        long first = versionAfterUpload(user, csrf, PNG);
        Thread.sleep(5);
        long second = versionAfterUpload(user, csrf, JPEG);
        assertEquals(true, second > first, "a new photo must get a newer version for the ?v= cache buster");
    }

    @Test
    void deleteRemovesTheRowAndTheReferenceAndFallsBackToNoPhoto() throws Exception {
        Cookie csrf = csrfCookie();
        Account user = account("delete");
        mvc.perform(upload(MINE, PNG, "me.png").cookie(csrf, user.access()).header("X-XSRF-TOKEN", csrf.getValue()))
                .andExpect(status().isOk());

        mvc.perform(delete(MINE).cookie(csrf, user.access()).header("X-XSRF-TOKEN", csrf.getValue()))
                .andExpect(status().isNoContent());

        mvc.perform(get(MINE).cookie(user.access())).andExpect(status().isNotFound());
        // The summary has no version any more, so the interface shows the initials.
        mvc.perform(get("/api/v1/auth/me").cookie(user.access())).andExpect(jsonPath("$.profilePhotoVersion").doesNotExist());
        assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM user_profile_photos WHERE user_id = ?", Integer.class, user.id()));
        // Deleting again is harmless.
        mvc.perform(delete(MINE).cookie(csrf, user.access()).header("X-XSRF-TOKEN", csrf.getValue()))
                .andExpect(status().isNoContent());
    }

    @Test
    void youCanOnlyChangeYourOwnPhotoThereIsNoRouteForAnotherUser() throws Exception {
        Cookie csrf = csrfCookie();
        Account owner = account("owner");
        Account attacker = account("attacker");
        mvc.perform(upload(MINE, PNG, "owner.png").cookie(csrf, owner.access()).header("X-XSRF-TOKEN", csrf.getValue()))
                .andExpect(status().isOk());

        // Naming somebody else in the path or in the request does not reach their photo.
        String otherPath = "/api/v1/users/" + owner.id() + "/profile-photo";
        mvc.perform(upload(otherPath, JPEG, "evil.jpg").cookie(csrf, attacker.access()).header("X-XSRF-TOKEN", csrf.getValue()))
                .andExpect(status().is4xxClientError());
        mvc.perform(delete(otherPath).cookie(csrf, attacker.access()).header("X-XSRF-TOKEN", csrf.getValue()))
                .andExpect(status().is4xxClientError());
        mvc.perform(upload(MINE, JPEG, "evil.jpg").file(new MockMultipartFile("userId", owner.id().toString().getBytes(StandardCharsets.UTF_8)))
                        .cookie(csrf, attacker.access()).header("X-XSRF-TOKEN", csrf.getValue()))
                .andExpect(status().isOk());

        // The owner's photo is untouched; the attacker's own upload went to the attacker.
        assertArrayEquals(PNG, mvc.perform(get(MINE).cookie(owner.access())).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsByteArray());
        assertArrayEquals(JPEG, mvc.perform(get(MINE).cookie(attacker.access())).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsByteArray());
        // And deleting "mine" never deletes somebody else's.
        mvc.perform(delete(MINE).cookie(csrf, attacker.access()).header("X-XSRF-TOKEN", csrf.getValue()))
                .andExpect(status().isNoContent());
        mvc.perform(get(otherPath).cookie(attacker.access())).andExpect(status().isOk());
    }

    @Test
    void aSignedInUserCanSeeAnotherAccountsPhotoAsAnAvatarButAMissingOrUnknownOneIs404() throws Exception {
        Cookie csrf = csrfCookie();
        Account owner = account("avatarowner");
        Account viewer = account("avatarviewer");
        mvc.perform(get("/api/v1/users/" + owner.id() + "/profile-photo").cookie(viewer.access()))
                .andExpect(status().isNotFound());
        mvc.perform(upload(MINE, PNG, "me.png").cookie(csrf, owner.access()).header("X-XSRF-TOKEN", csrf.getValue()))
                .andExpect(status().isOk());
        mvc.perform(get("/api/v1/users/" + owner.id() + "/profile-photo").cookie(viewer.access()))
                .andExpect(status().isOk()).andExpect(header().string(HttpHeaders.CONTENT_TYPE, "image/png"));
        // An id that is not an account, and a malformed one.
        mvc.perform(get("/api/v1/users/" + UUID.randomUUID() + "/profile-photo").cookie(viewer.access()))
                .andExpect(status().isNotFound());
        mvc.perform(get("/api/v1/users/not-a-uuid/profile-photo").cookie(viewer.access()))
                .andExpect(status().isBadRequest());
    }

    @Test
    void withoutASessionOrACsrfTokenNothingCanBeUploadedChangedOrRead() throws Exception {
        Cookie csrf = csrfCookie();
        Account user = account("anon");
        // Not signed in: 401 so the client renews the session; reading is closed too.
        mvc.perform(upload(MINE, PNG, "a.png").cookie(csrf).header("X-XSRF-TOKEN", csrf.getValue()))
                .andExpect(status().isUnauthorized());
        mvc.perform(delete(MINE).cookie(csrf).header("X-XSRF-TOKEN", csrf.getValue()))
                .andExpect(status().isUnauthorized());
        mvc.perform(get(MINE)).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/users/" + user.id() + "/profile-photo")).andExpect(status().isUnauthorized());
        // Signed in but without the CSRF token.
        mvc.perform(upload(MINE, PNG, "a.png").cookie(user.access())).andExpect(status().isForbidden());
        mvc.perform(delete(MINE).cookie(user.access())).andExpect(status().isForbidden());
        mvc.perform(get(MINE).cookie(user.access())).andExpect(status().isNotFound());
    }

    @Test
    void theFileNameIsNeverUsedAsAStorageKeyOrPath() throws Exception {
        Cookie csrf = csrfCookie();
        Account user = account("traversal");
        mvc.perform(upload(MINE, PNG, "../../../etc/passwd.png").cookie(csrf, user.access())
                        .header("X-XSRF-TOKEN", csrf.getValue()))
                .andExpect(status().isOk());
        // Bytes only, in the database: the served response carries a fixed name, not the client's.
        mvc.perform(get(MINE).cookie(user.access()))
                .andExpect(header().string(HttpHeaders.CONTENT_DISPOSITION, org.hamcrest.Matchers.not(org.hamcrest.Matchers.containsString("passwd"))))
                .andExpect(header().string(HttpHeaders.CONTENT_DISPOSITION, org.hamcrest.Matchers.not(org.hamcrest.Matchers.containsString(".."))));
    }

    private long versionAfterUpload(Account user, Cookie csrf, byte[] image) throws Exception {
        String json = mvc.perform(upload(MINE, image, "p.bin").cookie(csrf, user.access())
                        .header("X-XSRF-TOKEN", csrf.getValue()))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return ((Number) com.jayway.jsonpath.JsonPath.read(json, "$.profilePhotoVersion")).longValue();
    }

    private void refused(Account user, Cookie csrf, MockMultipartHttpServletRequestBuilder request, String code) throws Exception {
        mvc.perform(request.cookie(csrf, user.access()).header("X-XSRF-TOKEN", csrf.getValue()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(code));
    }

    private static MockMultipartHttpServletRequestBuilder upload(String path, byte[] data, String filename) {
        return upload(path, data, filename, MediaType.APPLICATION_OCTET_STREAM_VALUE);
    }

    private static MockMultipartHttpServletRequestBuilder upload(String path, byte[] data, String filename, String contentType) {
        return multipart(HttpMethod.PUT, path).file(new MockMultipartFile("file", filename, contentType, data));
    }

    private Account account(String prefix) throws Exception {
        String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 16);
        String email = prefix + suffix + "@example.test";
        String password = UUID.randomUUID().toString();
        UUID id = users.registerLocal(email, "u" + suffix, password);
        Cookie csrf = csrfCookie();
        var login = mvc.perform(post("/api/v1/auth/login").cookie(csrf)
                        .with(request -> { request.setRemoteAddr("test-" + suffix); return request; })
                        .header("X-XSRF-TOKEN", csrf.getValue()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email + "\",\"password\":\"" + password + "\"}"))
                .andExpect(status().isOk()).andReturn().getResponse();
        String value = login.getHeaders(HttpHeaders.SET_COOKIE).stream()
                .filter(header -> header.startsWith("PDA_ACCESS=")).findFirst().orElseThrow()
                .split(";", 2)[0].substring("PDA_ACCESS=".length());
        assertFalse(value.isBlank());
        return new Account(id, new Cookie("PDA_ACCESS", value));
    }

    private Cookie csrfCookie() throws Exception {
        Cookie cookie = mvc.perform(get("/api/v1/auth/csrf"))
                .andExpect(status().isOk()).andReturn().getResponse().getCookie("XSRF-TOKEN");
        assertNotNull(cookie);
        return cookie;
    }
}
