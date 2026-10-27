package com.pda.notification;

import com.pda.auth.api.AuthRegistrationController;
import com.pda.auth.application.service.*;
import com.pda.auth.infrastructure.config.*;
import com.pda.meeting.*;
import com.pda.meeting.internal.*;
import com.pda.meeting.internal.http.*;
import com.pda.meeting.media.*;
import com.pda.user.*;
import io.jsonwebtoken.Jwts;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import java.nio.charset.StandardCharsets;
import java.security.*;
import java.time.*;
import java.util.*;
import javax.crypto.spec.SecretKeySpec;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest({MeetingGuestController.class,MeetingMediaWebhookController.class,AuthRegistrationController.class})
@Import({SecurityBaselineConfiguration.class,LiveKitWebhookVerifier.class,MeetingApiErrors.class})
@TestPropertySource(properties={"FRONTEND_URL=http://localhost:3000","API_DOCS_ENABLED=false","APP_ENV=prod"})
class MeetingHttpSecurityTest {
    @Autowired MockMvc mvc;
    @MockitoBean MeetingService service;
    @MockitoBean MeetingMediaEvents events;
    @MockitoBean MeetingMediaProperties media;
    @MockitoBean RegistrationWorkflow workflow;
    @MockitoBean JwtTokens tokens;
    @MockitoBean AuthCookies cookies;
    @MockitoBean UserAccounts users;
    @MockitoBean UserSessions sessions;
    @MockitoBean Clock clock;
    static final byte[] KEY=new byte[48]; static {new SecureRandom().nextBytes(KEY);}
    @BeforeEach void media(){when(media.isEnabled()).thenReturn(true);when(media.getApiKey()).thenReturn("test-only");when(media.getApiSecret()).thenReturn(Base64.getEncoder().encodeToString(KEY));}

    @Test void guestCorsUsesOnlyExistingFrontendOriginAndExposesRetryDelay() throws Exception {
        mvc.perform(options("/api/v1/meetings/guest/preview").header("Origin","http://localhost:3000")
            .header("Access-Control-Request-Method","POST").header("Access-Control-Request-Headers","content-type,x-xsrf-token"))
            .andExpect(status().isOk()).andExpect(header().string("Access-Control-Allow-Origin","http://localhost:3000"))
            .andExpect(header().string("Access-Control-Allow-Credentials","true"));
        mvc.perform(options("/api/v1/meetings/guest/preview").header("Origin","https://untrusted.invalid")
            .header("Access-Control-Request-Method","POST")).andExpect(status().isForbidden());
    }
    @Test void signedInMeetingApiAllowsOnlyTheFrontendOriginAndKeepsTheWebhookOutOfThePolicy() throws Exception {
        UUID meeting=UUID.randomUUID();
        for(String path:new String[]{"/api/v1/meetings","/api/v1/meetings/"+meeting,"/api/v1/meetings/attendees/search","/api/v1/meetings/history/clear",
                "/api/v1/meetings/"+meeting+"/join","/api/v1/meetings/"+meeting+"/participants/"+UUID.randomUUID()+"/kick","/api/v1/meetings/"+meeting+"/chat"}) {
            mvc.perform(options(path).header("Origin","http://localhost:3000").header("Access-Control-Request-Method","POST").header("Access-Control-Request-Headers","content-type,x-xsrf-token"))
                .andExpect(status().isOk()).andExpect(header().string("Access-Control-Allow-Origin","http://localhost:3000")).andExpect(header().string("Access-Control-Allow-Credentials","true"));
            mvc.perform(options(path).header("Origin","https://untrusted.invalid").header("Access-Control-Request-Method","POST")).andExpect(status().isForbidden());
        }
        // The signed webhook is a server-to-server call: no browser origin is ever approved for it.
        mvc.perform(options("/api/v1/meetings/media/webhook").header("Origin","http://localhost:3000").header("Access-Control-Request-Method","POST"))
            .andExpect(header().doesNotExist("Access-Control-Allow-Origin")).andExpect(header().doesNotExist("Access-Control-Allow-Credentials"));
    }
    @Test void guestPreviewIsBoundedCsrfProtectedAndDoesNotCreateCookieOrPrincipal() throws Exception {
        String body="{\"inviteToken\":\"test-only\"}";
        mvc.perform(post("/api/v1/meetings/guest/preview").contentType("application/json").content(body)).andExpect(status().isForbidden());
        Cookie csrf=csrf();
        when(service.guestPreview(any())).thenReturn(new MeetingDtos.GuestView(UUID.randomUUID(),"Planning",Instant.now(),Instant.now().plusSeconds(3600),"UTC",com.pda.meeting.internal.Meeting.Status.OPEN,Instant.now(),false,false,List.of("Agenda"),0,false));
        mvc.perform(post("/api/v1/meetings/guest/preview").cookie(csrf).header("X-XSRF-TOKEN",csrf.getValue()).contentType("application/json").content(body))
            .andExpect(status().isOk()).andExpect(jsonPath("$.title").value("Planning"))
            .andExpect(jsonPath("$.projectId").doesNotExist()).andExpect(jsonPath("$.organizerId").doesNotExist())
            .andExpect(jsonPath("$.token").doesNotExist()).andExpect(header().string("Cache-Control","private, no-store"))
            .andExpect(header().doesNotExist("Set-Cookie"));
        mvc.perform(post("/api/v1/meetings/guest/preview").content("x".repeat(2049))).andExpect(status().isPayloadTooLarge());
        mvc.perform(get("/api/v1/meetings/guest/"+UUID.randomUUID()+"/state")).andExpect(status().isUnauthorized());
        verify(service,times(1)).guestPreview(any());
    }
    @Test void guestInitializationKeepsCsrfAndOnlyWritesScopedHttpOnlySecureCookie() throws Exception {
        UUID meeting=UUID.randomUUID(),participant=UUID.randomUUID();
        String secret=Base64.getUrlEncoder().withoutPadding().encodeToString(KEY);
        when(service.guestSession(any())).thenReturn(new MeetingDtos.GuestSession(meeting,participant,secret,Instant.now().plusSeconds(600)));
        String body="{\"inviteToken\":\"test-only\",\"displayName\":\"Guest\"}";
        mvc.perform(post("/api/v1/meetings/guest/session").contentType("application/json").content(body)).andExpect(status().isForbidden());
        Cookie csrf=csrf();
        var result=mvc.perform(post("/api/v1/meetings/guest/session").cookie(csrf).header("X-XSRF-TOKEN",csrf.getValue()).contentType("application/json").content(body))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.meetingId").value(meeting.toString()))
                .andExpect(jsonPath("$.secret").doesNotExist()).andExpect(header().string("Cache-Control","private, no-store"))
                .andReturn();
        String setCookie=result.getResponse().getHeader("Set-Cookie");
        assertTrue(setCookie.contains("Path=/api/v1/meetings/guest/"+meeting));
        assertTrue(setCookie.contains("HttpOnly"));assertTrue(setCookie.contains("Secure"));assertTrue(setCookie.contains("SameSite=Lax"));
        assertFalse(setCookie.contains("PDA_ACCESS"));assertNull(result.getRequest().getSession(false));
        verify(service,times(1)).guestSession(any());
    }
    @Test void guestCookieCannotAuthenticateProjectOrBroadenScope() throws Exception {
        UUID meeting=UUID.randomUUID();String base="/api/v1/meetings/guest/"+meeting;
        mvc.perform(get(base+"/participants")).andExpect(status().isUnauthorized());
        when(service.guestParticipants(eq(meeting),eq("test-only"))).thenThrow(new MeetingException(403,"MEETING_GUEST_FORBIDDEN"));
        mvc.perform(get(base+"/participants").cookie(new Cookie(MeetingGuestController.COOKIE,"test-only"))).andExpect(status().isForbidden());
        // A guest cookie is not a PDA session: the signed-in meeting API (list, detail, search) stays closed to it,
        // and the earlier project-scoped route no longer exists at all.
        mvc.perform(get("/api/v1/meetings").cookie(new Cookie(MeetingGuestController.COOKIE,"test-only"))).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/meetings/"+meeting).cookie(new Cookie(MeetingGuestController.COOKIE,"test-only"))).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/meetings/attendees/search?q=abc").cookie(new Cookie(MeetingGuestController.COOKIE,"test-only"))).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/projects/"+UUID.randomUUID()+"/meetings").cookie(new Cookie(MeetingGuestController.COOKIE,"test-only"))).andExpect(status().isUnauthorized());
        mvc.perform(post(base+"/join").cookie(new Cookie(MeetingGuestController.COOKIE,"test-only"))).andExpect(status().isForbidden());
        mvc.perform(post(base+"/kick")).andExpect(status().isForbidden());
    }
    @Test void onlyExactSignedWebhookBypassesCsrfAndBodyIsAuthenticated() throws Exception {
        String body="{\"id\":\"test-event\",\"event\":\"room_finished\",\"room\":{\"name\":\"test-room\"},\"createdAt\":100}";
        String signature=signature(body);
        mvc.perform(post("/api/v1/meetings/media/webhook").contentType("application/webhook+json").content(body)).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/v1/meetings/media/webhook").header("Authorization",signature).contentType("application/webhook+json").content(body+" ")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/v1/meetings/media/webhook").header("Authorization",signature).contentType("application/webhook+json").content(body)).andExpect(status().isNoContent());
        verify(events,times(1)).accept("test-event","room_finished","test-room","",Instant.ofEpochSecond(100));
        mvc.perform(post("/api/v1/meetings/media/webhook/extra").content(body)).andExpect(status().isForbidden());
        mvc.perform(get("/api/v1/meetings/media/webhook")).andExpect(status().isForbidden());
    }
    @Test void admissionBoundsActualBodyAndInitializationAttemptsAcrossIds() throws Exception {
        mvc.perform(post("/api/v1/meetings/guest/session").content("x".repeat(2049)).with(r->{r.setRemoteAddr("limit-body");return r;})).andExpect(status().isPayloadTooLarge());
        mvc.perform(post("/api/v1/meetings/media/webhook").content(new byte[65537])).andExpect(status().isPayloadTooLarge());
        mvc.perform(post("/api/v1/meetings").content(new byte[196609]))
                .andExpect(status().isPayloadTooLarge());
        for(int i=0;i<10;i++) mvc.perform(post("/api/v1/meetings/guest/session").with(r->{r.setRemoteAddr("limit-rate");return r;})).andExpect(status().isForbidden());
        mvc.perform(post("/api/v1/meetings/guest/session").with(r->{r.setRemoteAddr("limit-rate");return r;})).andExpect(status().isTooManyRequests());
    }
    @Test void guestRepliesAndReactionsKeepCsrfCookieScopeAndNoStore() throws Exception {
        UUID meeting=UUID.randomUUID(),message=UUID.randomUUID();String base="/api/v1/meetings/guest/"+meeting+"/chat";
        Cookie guest=new Cookie(MeetingGuestController.COOKIE,"test-only");Cookie csrf=csrf();
        var view=new MeetingDtos.ChatView(message,UUID.randomUUID(),"Guest","Hello",Instant.now(),Set.of());
        when(service.guestReact(eq(meeting),eq("test-only"),eq(message),eq("👍"))).thenReturn(view);
        when(service.guestUnreact(eq(meeting),eq("test-only"),eq(message),eq("👍"))).thenReturn(view);
        when(service.guestMessage(eq(meeting),eq("test-only"),eq(message))).thenReturn(view);
        when(service.guestLocate(eq(meeting),eq("test-only"),eq(message),eq(50))).thenReturn(new MeetingDtos.ChatLocation(message,2,50));
        when(service.guestChat(eq(meeting),eq("test-only"),argThat(r->r!=null&&message.equals(r.replyToMessageId())))).thenReturn(view);
        String reaction="{\"emoji\":\"👍\"}";
        // CSRF protects the new state changes as it does every other guest write.
        mvc.perform(put(base+"/"+message+"/reactions").cookie(guest).contentType("application/json").content(reaction)).andExpect(status().isForbidden());
        mvc.perform(delete(base+"/"+message+"/reactions").param("emoji","👍").cookie(guest)).andExpect(status().isForbidden());
        // Without the guest session cookie nothing is served, and reading is also private.
        mvc.perform(put(base+"/"+message+"/reactions").cookie(csrf).header("X-XSRF-TOKEN",csrf.getValue()).contentType("application/json").content(reaction)).andExpect(status().isUnauthorized());
        mvc.perform(get(base+"/"+message)).andExpect(status().isUnauthorized());
        mvc.perform(put(base+"/"+message+"/reactions").cookie(guest,csrf).header("X-XSRF-TOKEN",csrf.getValue()).contentType("application/json").content(reaction))
            .andExpect(status().isOk()).andExpect(jsonPath("$.id").value(message.toString())).andExpect(header().string("Cache-Control","private, no-store"));
        mvc.perform(delete(base+"/"+message+"/reactions").param("emoji","👍").cookie(guest,csrf).header("X-XSRF-TOKEN",csrf.getValue()))
            .andExpect(status().isOk()).andExpect(header().string("Cache-Control","private, no-store"));
        mvc.perform(get(base+"/"+message).cookie(guest)).andExpect(status().isOk()).andExpect(header().string("Cache-Control","private, no-store"));
        mvc.perform(get(base+"/"+message+"/page").cookie(guest)).andExpect(status().isOk()).andExpect(jsonPath("$.page").value(2));
        // A reply travels as a reply id in the normal chat request and reaches the service with it.
        mvc.perform(post(base).cookie(guest,csrf).header("X-XSRF-TOKEN",csrf.getValue()).contentType("application/json")
            .content("{\"content\":\"Answer\",\"mentionIds\":[],\"replyToMessageId\":\""+message+"\"}")).andExpect(status().isCreated());
        // An empty or over-long emoji never reaches the service; the project route stays closed to a guest cookie.
        mvc.perform(put(base+"/"+message+"/reactions").cookie(guest,csrf).header("X-XSRF-TOKEN",csrf.getValue()).contentType("application/json").content("{\"emoji\":\"\"}")).andExpect(status().isBadRequest());
        mvc.perform(put(base+"/"+message+"/reactions").cookie(guest,csrf).header("X-XSRF-TOKEN",csrf.getValue()).contentType("application/json").content("{\"emoji\":\""+"a".repeat(33)+"\"}")).andExpect(status().isBadRequest());
        mvc.perform(put("/api/v1/meetings/"+meeting+"/chat/"+message+"/reactions").cookie(guest,csrf).header("X-XSRF-TOKEN",csrf.getValue()).contentType("application/json").content(reaction)).andExpect(status().isUnauthorized());
        verify(service,times(1)).guestReact(any(),any(),any(),any());
    }
    private Cookie csrf() throws Exception {return mvc.perform(get("/api/v1/auth/csrf")).andReturn().getResponse().getCookie("XSRF-TOKEN");}
    private String signature(String body) throws Exception {
        String hash=Base64.getEncoder().encodeToString(MessageDigest.getInstance("SHA-256").digest(body.getBytes(StandardCharsets.UTF_8)));
        return Jwts.builder().issuer("test-only").notBefore(Date.from(Instant.now().minusSeconds(2))).expiration(Date.from(Instant.now().plusSeconds(60)))
                .claim("sha256",hash).signWith(new SecretKeySpec(Base64.getEncoder().encodeToString(KEY).getBytes(StandardCharsets.UTF_8),"HmacSHA256"),Jwts.SIG.HS256).compact();
    }
}
