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

import com.pda.user.application.service.UserProfileService;
import com.pda.user.application.service.UserProfilePhotoService;
import com.pda.user.application.service.NicknameTakenException;
import com.pda.user.infrastructure.repository.UserRepository;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import java.util.concurrent.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
@SpringBootTest(classes = BackendApplication.class)
@AutoConfigureMockMvc
@Testcontainers(disabledWithoutDocker = true)
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
class UserProfileApiIntegrationTest {

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

    private record Account(UUID id, Cookie access, String email, String password) {
    }

    @Autowired UserProfileService profiles;
    @Autowired UserProfilePhotoService profilePhotos;
    @Autowired UserRepository repository;
    @Autowired PlatformTransactionManager transactions;

    @Test void ownNicknameSessionAndStrictRequestContract() throws Exception {
        Account a=account("profile"), b=account("other"); Cookie csrf=csrfCookie();
        String nickname="Ipek_"+UUID.randomUUID().toString().replace("-", "").substring(0,12);
        mvc.perform(put("/api/v1/users/me/profile").cookie(csrf,a.access()).header("X-XSRF-TOKEN",csrf.getValue())
            .contentType(MediaType.APPLICATION_JSON).content("{\"nickname\":\" "+nickname+" \"}"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.id").value(a.id().toString()))
            .andExpect(jsonPath("$.nickname").value(nickname)).andExpect(header().string("Cache-Control","private, no-store"));
        mvc.perform(get("/api/v1/auth/me").cookie(a.access())).andExpect(status().isOk()).andExpect(jsonPath("$.nickname").value(nickname));
        var unchanged=repository.findById(a.id()).orElseThrow().getUpdatedAt(); profiles.rename(a.id(),nickname);
        assertEquals(unchanged,repository.findById(a.id()).orElseThrow().getUpdatedAt());
        mvc.perform(put("/api/v1/users/me/profile").cookie(csrf,a.access()).header("X-XSRF-TOKEN",csrf.getValue())
            .contentType(MediaType.APPLICATION_JSON).content("{\"nickname\":\"Other_name\",\"userId\":\""+b.id()+"\"}"))
            .andExpect(status().isBadRequest());
        assertNotEquals("Other_name",repository.findById(b.id()).orElseThrow().getNickname());
        mvc.perform(put("/api/v1/users/"+b.id()+"/profile").cookie(csrf,a.access()).header("X-XSRF-TOKEN",csrf.getValue())
            .contentType(MediaType.APPLICATION_JSON).content("{\"nickname\":\"Other_name\"}"))
            .andExpect(status().isForbidden());
        mvc.perform(put("/api/v1/users/me/profile").cookie(a.access()).contentType(MediaType.APPLICATION_JSON).content("{\"nickname\":\"Other_name\"}"))
            .andExpect(status().isForbidden());
        mvc.perform(put("/api/v1/users/me/profile").cookie(csrf).header("X-XSRF-TOKEN",csrf.getValue()).contentType(MediaType.APPLICATION_JSON).content("{\"nickname\":\"Other_name\"}"))
            .andExpect(status().isUnauthorized());
        mvc.perform(post("/api/v1/auth/login").cookie(csrf).header("X-XSRF-TOKEN",csrf.getValue())
            .with(r->{r.setRemoteAddr("profile-future-"+a.id());return r;}).contentType(MediaType.APPLICATION_JSON)
            .content("{\"email\":\""+a.email()+"\",\"password\":\""+a.password()+"\"}"))
            .andExpect(status().isOk());
    }

    @Test void unicodeTrimValidationCaseAndConflict() throws Exception {
        Account a=account("validation"),b=account("collision"); Cookie csrf=csrfCookie();
        for(String value:new String[]{"ab","a".repeat(33),"a-b"," ","cafe\u0301","\uFEFFname"}) {
            mvc.perform(put("/api/v1/users/me/profile").cookie(csrf,a.access()).header("X-XSRF-TOKEN",csrf.getValue()).contentType(MediaType.APPLICATION_JSON)
                .content("{\"nickname\":\""+value+"\"}"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("NICKNAME_INVALID"));
        }
        assertEquals("\u0130pek_\u00c7elik",profiles.rename(a.id(),"\u00a0\u0130pek_\u00c7elik\u00a0").nickname());
        assertEquals("\uD801\uDC00".repeat(3),profiles.rename(a.id(),"\uD801\uDC00".repeat(3)).nickname());
        String target="case_"+UUID.randomUUID().toString().replace("-", "").substring(0,12);
        profiles.rename(a.id(),target); profiles.rename(b.id(),target.toUpperCase(java.util.Locale.ROOT));
        mvc.perform(put("/api/v1/users/me/profile").cookie(csrf,b.access()).header("X-XSRF-TOKEN",csrf.getValue()).contentType(MediaType.APPLICATION_JSON)
                .content("{\"nickname\":\""+target+"\"}"))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("NICKNAME_TAKEN"));
    }

    @Test void concurrentDuplicateRenameUsesTheRealUniqueConstraint() throws Exception {
        Account a=account("renamea"),b=account("renameb");
        String target="race_"+UUID.randomUUID().toString().replace("-", "").substring(0,12);
        ExecutorService executor=Executors.newFixedThreadPool(2);CountDownLatch staged=new CountDownLatch(1),release=new CountDownLatch(1);
        try {
            Future<?> first=executor.submit(()->new TransactionTemplate(transactions).execute(s->{profiles.rename(a.id(),target);staged.countDown();await(release);return null;}));
            assertTrue(staged.await(10,TimeUnit.SECONDS));
            Future<Boolean> second=executor.submit(()->{try{profiles.rename(b.id(),target);return true;}catch(NicknameTakenException expected){return false;}});
            long end=System.nanoTime()+TimeUnit.SECONDS.toNanos(10);boolean blocked=false;
            while(System.nanoTime()<end){blocked=jdbc.queryForObject("SELECT count(*) FROM pg_stat_activity WHERE datname=current_database() AND pid<>pg_backend_pid() AND wait_event_type='Lock' AND query ILIKE '%update users%'",Integer.class)>0;if(blocked)break;Thread.sleep(20);}
            assertTrue(blocked,"Second rename must wait on the uncommitted unique key");release.countDown();first.get(10,TimeUnit.SECONDS);assertFalse(second.get(10,TimeUnit.SECONDS));
            assertEquals(1,jdbc.queryForObject("SELECT count(*) FROM users WHERE nickname=?",Integer.class,target));
        } finally {release.countDown();executor.shutdownNow();assertTrue(executor.awaitTermination(10,TimeUnit.SECONDS));}
    }

    @Test void aStalePhotoWriteCannotUndoCommittedRename() throws Exception {
        Account a=account("stalepicture");String nickname="new_"+UUID.randomUUID().toString().replace("-", "").substring(0,12);
        ExecutorService executor=Executors.newSingleThreadExecutor();CountDownLatch loaded=new CountDownLatch(1),release=new CountDownLatch(1);
        try {
            Future<?> photo=executor.submit(()->new TransactionTemplate(transactions).execute(s->{repository.findById(a.id()).orElseThrow();loaded.countDown();await(release);profilePhotos.replace(a.id(),PNG);return null;}));
            assertTrue(loaded.await(10,TimeUnit.SECONDS));profiles.rename(a.id(),nickname);release.countDown();photo.get(10,TimeUnit.SECONDS);
            assertEquals(nickname,repository.findById(a.id()).orElseThrow().getNickname());assertNotNull(repository.findById(a.id()).orElseThrow().getProfilePhotoUpdatedAt());
        } finally {release.countDown();executor.shutdownNow();assertTrue(executor.awaitTermination(10,TimeUnit.SECONDS));}
    }
    @Test void stalePasswordWritePreservesNicknameAndPasswordAuthentication() throws Exception {
        Account a=account("stalepassword");String nickname="pwd_"+UUID.randomUUID().toString().replace("-", "").substring(0,12),password=UUID.randomUUID().toString();
        ExecutorService executor=Executors.newSingleThreadExecutor();CountDownLatch loaded=new CountDownLatch(1),release=new CountDownLatch(1);
        try {
            Future<?> changed=executor.submit(()->new TransactionTemplate(transactions).execute(s->{repository.findById(a.id()).orElseThrow();loaded.countDown();await(release);
                assertEquals(UserAccounts.PasswordChangeOutcome.CHANGED,users.changePassword(a.id(),a.password(),password));return null;}));
            assertTrue(loaded.await(10,TimeUnit.SECONDS));profiles.rename(a.id(),nickname);release.countDown();changed.get(10,TimeUnit.SECONDS);
            assertEquals(nickname,users.authenticateLocal(a.email(),password).orElseThrow().nickname());
        } finally {release.countDown();executor.shutdownNow();assertTrue(executor.awaitTermination(10,TimeUnit.SECONDS));}
    }

    @Test void refreshAndForcedPasswordBoundariesRemainIntact() throws Exception {
        Account a=account("profilesession");Cookie csrf=csrfCookie();
        var login=mvc.perform(post("/api/v1/auth/login").cookie(csrf).header("X-XSRF-TOKEN",csrf.getValue())
                .with(r->{r.setRemoteAddr("session-"+a.id());return r;}).contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\""+a.email()+"\",\"password\":\""+a.password()+"\"}"))
                .andExpect(status().isOk()).andReturn().getResponse();
        String refresh=login.getHeaders(HttpHeaders.SET_COOKIE).stream().filter(h->h.startsWith("PDA_REFRESH=")).findFirst().orElseThrow().split(";",2)[0].substring("PDA_REFRESH=".length());
        profiles.rename(a.id(),"session_"+a.id().toString().substring(0,8));
        mvc.perform(post("/api/v1/auth/refresh").cookie(csrf,new Cookie("PDA_REFRESH",refresh)).header("X-XSRF-TOKEN",csrf.getValue())).andExpect(status().isOk());
        jdbc.update("UPDATE users SET must_change_password=TRUE WHERE id=?",a.id());
        mvc.perform(put("/api/v1/users/me/profile").cookie(csrf,a.access()).header("X-XSRF-TOKEN",csrf.getValue()).contentType(MediaType.APPLICATION_JSON).content("{\"nickname\":\"Forbidden_edit\"}"))
                .andExpect(status().isForbidden());
    }

    private static void await(CountDownLatch latch){try{if(!latch.await(10,TimeUnit.SECONDS))throw new IllegalStateException("Barrier timeout");}catch(InterruptedException e){Thread.currentThread().interrupt();throw new IllegalStateException(e);}}

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
        return new Account(id, new Cookie("PDA_ACCESS", value), email, password);
    }

    private Cookie csrfCookie() throws Exception {
        Cookie cookie = mvc.perform(get("/api/v1/auth/csrf"))
                .andExpect(status().isOk()).andReturn().getResponse().getCookie("XSRF-TOKEN");
        assertNotNull(cookie);
        return cookie;
    }
}
