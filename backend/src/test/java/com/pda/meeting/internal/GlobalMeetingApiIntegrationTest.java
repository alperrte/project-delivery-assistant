package com.pda.meeting.internal;

import com.jayway.jsonpath.JsonPath;
import com.pda.BackendApplication;
import com.pda.meeting.MeetingMediaPort;
import com.pda.user.UserAccounts;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Meetings belong to users, not projects: the real HTTP API, real PostgreSQL and real cookie sessions.
 * Scenario: Alice works in projects A, B and C, Bob only in B, Carol only in C, Dave in none, and Eve shares project A with Alice
 * without being invited. Nobody ever sends or needs a project id.
 */
@SpringBootTest(classes=BackendApplication.class,properties={"pda.meeting.enabled=true"})
@AutoConfigureMockMvc
@Testcontainers @DirtiesContext(classMode=DirtiesContext.ClassMode.AFTER_CLASS)
class GlobalMeetingApiIntegrationTest {
    static final byte[] KEY=new byte[32]; static { new SecureRandom().nextBytes(KEY); }
    @Container static PostgreSQLContainer postgres=new PostgreSQLContainer("postgres:18-alpine");
    @DynamicPropertySource static void properties(DynamicPropertyRegistry r) {
        r.add("spring.datasource.url",postgres::getJdbcUrl); r.add("spring.datasource.username",postgres::getUsername);
        r.add("spring.datasource.password",postgres::getPassword); r.add("JWT_SECRET",()->Base64.getEncoder().encodeToString(KEY));
        r.add("FRONTEND_URL",()->"http://localhost:3000");
    }
    @MockitoBean MeetingMediaPort media;
    @Autowired MockMvc mvc;
    @Autowired UserAccounts users;
    @Autowired JdbcTemplate db;
    record Account(UUID id,String nickname,Cookie access) {}

    Account alice,bob,carol,dave,eve;
    UUID projectA,projectB,projectC;

    @BeforeEach void fixture() throws Exception {
        reset(media); when(media.roomExists(anyString())).thenReturn(true); when(media.listParticipants(anyString())).thenReturn(List.of());
        when(media.issueToken(anyString(),anyString(),anyString(),any())).thenReturn(new MeetingMediaPort.MediaJoin("wss://example.test","TEST-ONLY",Instant.now().plusSeconds(60)));
        alice=account("alice"); bob=account("bob"); carol=account("carol"); dave=account("dave"); eve=account("eve");
        projectA=project("A",alice,eve); projectB=project("B",alice,bob); projectC=project("C",alice,carol);
    }

    @Test void aMeetingCreatedInOneProjectIsSharedAcrossProjectsAndSurvivesEverythingAboutProjects() throws Exception {
        UUID id=create(alice,Set.of(bob.id(),carol.id(),dave.id()),"Cross-project sync");
        // Organizer, attendees from other projects and an attendee with no project all list and open it from their one global page.
        for(Account who:List.of(alice,bob,carol,dave)) {
            assertTrue(listIds(who).contains(id.toString()),who.nickname()+" lists it");
            send(get("/api/v1/meetings/"+id),who).andExpect(status().isOk());
        }
        var detail=JsonPath.<Map<String,Object>>read(send(get("/api/v1/meetings/"+id),bob).andReturn().getResponse().getContentAsString(),"$");
        assertFalse(detail.containsKey("projectId")); assertEquals(alice.id().toString(),detail.get("organizerId"));
        assertEquals(3,((List<?>)detail.get("attendees")).size());
        assertFalse(detail.toString().contains("@example.test"),"no e-mail address is exposed to attendees");
        // Switching, leaving or even deleting every project the organizer has changes nothing about the meeting.
        db.update("DELETE FROM project_membership_roles"); db.update("DELETE FROM project_memberships");
        db.update("DELETE FROM projects WHERE id IN (?,?,?)",projectA,projectB,projectC);
        for(Account who:List.of(alice,bob,carol,dave)) assertTrue(listIds(who).contains(id.toString()),who.nickname()+" still lists it");
        send(get("/api/v1/meetings/"+id),dave).andExpect(status().isOk());
        assertEquals(1,db.queryForObject("SELECT count(*) FROM meetings WHERE id=?",Integer.class,id));
        // The earlier project-scoped route is gone.
        assertTrue(send(get("/api/v1/projects/"+projectA+"/meetings"),alice).andReturn().getResponse().getStatus()>=400);
    }
    @Test void aUserWithNoProjectAtAllCreatesAMeetingWithoutAnyProjectContext() throws Exception {
        UUID id=create(dave,Set.of(),"Solo");
        assertTrue(listIds(dave).contains(id.toString()));
        assertNull(db.queryForObject("SELECT project_id FROM meetings WHERE id=?",UUID.class,id));
        assertEquals(dave.id(),db.queryForObject("SELECT organizer_id FROM meetings WHERE id=?",UUID.class,id));
        assertEquals("INDEPENDENT",JsonPath.read(send(get("/api/v1/meetings/"+id),dave).andReturn().getResponse().getContentAsString(),"$.meetingType"));
        // An independent meeting never names a project: a body that does (or that leaves the type out) is refused, not silently reinterpreted.
        String withProject=body("Contradiction",Set.of()).replace("{","{\"projectId\":\""+projectA+"\",");
        send(post("/api/v1/meetings").contentType(MediaType.APPLICATION_JSON).content(withProject),dave).andExpect(status().isBadRequest());
        send(post("/api/v1/meetings").contentType(MediaType.APPLICATION_JSON).content(withProject.replace("{","{\"meetingType\":\"INDEPENDENT\",")),dave).andExpect(status().isBadRequest());
    }
    @Test void aProjectMeetingBelongsToAProjectOfTheCreatorAndGrantsMembersNothingByItself() throws Exception {
        // alice is in A, B and C; bob in B; eve in A (never invited); dave in none.
        String own=body("Project meeting",Set.of(bob.id(),dave.id())).replace("{","{\"meetingType\":\"PROJECT\",\"projectId\":\""+projectA+"\",");
        var created=send(post("/api/v1/meetings").contentType(MediaType.APPLICATION_JSON).content(own),alice).andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        UUID id=UUID.fromString(JsonPath.read(created,"$.id"));
        assertEquals(projectA,db.queryForObject("SELECT project_id FROM meetings WHERE id=?",UUID.class,id));
        assertEquals("PROJECT",JsonPath.read(created,"$.meetingType")); assertEquals(projectA.toString(),JsonPath.read(created,"$.project.id"));
        // The members of the project were NOT added: only the two named people attend.
        assertEquals(2,db.queryForObject("SELECT count(*) FROM meeting_attendees WHERE meeting_id=?",Integer.class,id));
        // The creator sees the project; bob (an attendee in project B) learns it is a project meeting but never which project; dave (no project) neither.
        assertEquals("PROJECT",JsonPath.read(send(get("/api/v1/meetings/"+id),bob).andReturn().getResponse().getContentAsString(),"$.meetingType"));
        assertNull(JsonPath.read(send(get("/api/v1/meetings/"+id),bob).andReturn().getResponse().getContentAsString(),"$.project"));
        assertNull(JsonPath.read(send(get("/api/v1/meetings/"+id),dave).andReturn().getResponse().getContentAsString(),"$.project"));
        // eve is a member of that very project but was not invited: the project membership is no meeting membership.
        send(get("/api/v1/meetings/"+id),eve).andExpect(status().isNotFound());
        assertFalse(listIds(eve).contains(id.toString()));
        send(post("/api/v1/meetings/"+id+"/join"),eve).andExpect(status().isNotFound());
        // The project of a project meeting must be one the caller belongs to; the server decides, whatever the client says.
        String foreign=body("Foreign",Set.of()).replace("{","{\"meetingType\":\"PROJECT\",\"projectId\":\""+projectB+"\",");
        send(post("/api/v1/meetings").contentType(MediaType.APPLICATION_JSON).content(foreign),eve).andExpect(status().isForbidden());
        send(post("/api/v1/meetings").contentType(MediaType.APPLICATION_JSON).content(foreign.replace(projectB.toString(),UUID.randomUUID().toString())),eve).andExpect(status().isForbidden());
        send(post("/api/v1/meetings").contentType(MediaType.APPLICATION_JSON).content(body("No project",Set.of()).replace("{","{\"meetingType\":\"PROJECT\",")),alice).andExpect(status().isBadRequest());
        // The type and the project are fixed once the meeting exists.
        String move=body("Project meeting",Set.of(bob.id())).replace("{","{\"meetingType\":\"PROJECT\",\"projectId\":\""+projectB+"\",");
        send(put("/api/v1/meetings/"+id).contentType(MediaType.APPLICATION_JSON).content(move),alice).andExpect(status().isBadRequest());
        String toIndependent=body("Project meeting",Set.of(bob.id())).replace("{","{\"meetingType\":\"INDEPENDENT\",");
        send(put("/api/v1/meetings/"+id).contentType(MediaType.APPLICATION_JSON).content(toIndependent),alice).andExpect(status().isBadRequest());
        send(put("/api/v1/meetings/"+id).contentType(MediaType.APPLICATION_JSON).content(body("Renamed",Set.of(bob.id(),dave.id()))),alice).andExpect(status().isOk());
        assertEquals(projectA,db.queryForObject("SELECT project_id FROM meetings WHERE id=?",UUID.class,id));
        // Switching projects changes nothing; deleting the project makes it an independent meeting that nobody loses.
        for(Account who:List.of(alice,bob,dave)) assertTrue(listIds(who).contains(id.toString()),who.nickname());
        db.update("DELETE FROM projects WHERE id=?",projectA);
        assertEquals(1,db.queryForObject("SELECT count(*) FROM meetings WHERE id=? AND project_id IS NULL",Integer.class,id));
        for(Account who:List.of(alice,bob,dave)) assertTrue(listIds(who).contains(id.toString()),who.nickname()+" after the project is gone");
        var after=send(get("/api/v1/meetings/"+id),alice).andReturn().getResponse().getContentAsString();
        assertEquals("INDEPENDENT",JsonPath.read(after,"$.meetingType")); assertNull(JsonPath.read(after,"$.project"));
        assertEquals(2,db.queryForObject("SELECT count(*) FROM meeting_attendees WHERE meeting_id=?",Integer.class,id));
    }
    @Test void aProjectMateWhoWasNotInvitedAndAnonymousCallersLearnNothing() throws Exception {
        UUID id=create(alice,Set.of(bob.id()),"Private");
        assertFalse(listIds(eve).contains(id.toString()));
        for(MockHttpServletRequestBuilder request:List.of(get("/api/v1/meetings/"+id),get("/api/v1/meetings/"+id+"/participants"),get("/api/v1/meetings/"+id+"/chat"),
                post("/api/v1/meetings/"+id+"/join"),post("/api/v1/meetings/"+id+"/start"),post("/api/v1/meetings/"+id+"/cancel"),post("/api/v1/meetings/"+id+"/end"),
                get("/api/v1/meetings/"+id+"/invites"),put("/api/v1/meetings/"+id).contentType(MediaType.APPLICATION_JSON).content(body("Hijack",Set.of())))) {
            send(request,eve).andExpect(status().isNotFound());
        }
        // Same answer as for an id that never existed.
        send(get("/api/v1/meetings/"+UUID.randomUUID()),eve).andExpect(status().isNotFound());
        mvc.perform(get("/api/v1/meetings")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/meetings/"+id)).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/meetings/attendees/search?q=abc")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/v1/meetings").contentType(MediaType.APPLICATION_JSON).content(body("Anonymous",Set.of()))).andExpect(status().is4xxClientError());
        assertEquals(1,db.queryForObject("SELECT count(*) FROM meetings WHERE title='Private'",Integer.class));
    }
    @Test void anAttendeeJoinsAndChatsButOnlyTheOrganizerManagesAndNoProjectRoleChangesThat() throws Exception {
        UUID id=create(alice,Set.of(bob.id(),dave.id()),"Roles");
        // Bob (project B) is attendee only; give him the PROJECT_MANAGER role of Alice's project too: it must not matter.
        db.update("INSERT INTO project_membership_roles(membership_id,role) SELECT id,'PROJECT_MANAGER' FROM project_memberships WHERE user_id=? AND project_id=?",bob.id(),projectB);
        for(MockHttpServletRequestBuilder request:List.of(post("/api/v1/meetings/"+id+"/start"),post("/api/v1/meetings/"+id+"/cancel"),get("/api/v1/meetings/"+id+"/invites"),
                post("/api/v1/meetings/"+id+"/invites").contentType(MediaType.APPLICATION_JSON).content("{\"expiresAt\":\""+Instant.now().plusSeconds(3600)+"\",\"maxUses\":1}"),
                put("/api/v1/meetings/"+id).contentType(MediaType.APPLICATION_JSON).content(body("Hijack",Set.of())))) {
            send(request,bob).andExpect(status().isForbidden());
        }
        send(post("/api/v1/meetings/"+id+"/start"),alice).andExpect(status().isOk());
        // The attendees (one in project B, one in none) enter the room; the project mate does not even know it exists.
        send(post("/api/v1/meetings/"+id+"/join"),bob).andExpect(status().isOk());
        send(post("/api/v1/meetings/"+id+"/join"),dave).andExpect(status().isOk());
        send(post("/api/v1/meetings/"+id+"/join"),eve).andExpect(status().isNotFound());
        UUID daveParticipant=db.queryForObject("SELECT id FROM meeting_participants WHERE meeting_id=? AND user_id=?",UUID.class,id,dave.id());
        send(post("/api/v1/meetings/"+id+"/participants/"+daveParticipant+"/mute"),bob).andExpect(status().isForbidden());
        send(post("/api/v1/meetings/"+id+"/participants/"+daveParticipant+"/kick"),bob).andExpect(status().isForbidden());
        send(post("/api/v1/meetings/"+id+"/end"),bob).andExpect(status().isForbidden());
        send(post("/api/v1/meetings/"+id+"/participants/"+daveParticipant+"/mute"),alice).andExpect(status().isNoContent());
        verify(media).muteParticipant(anyString(),eq("user-"+dave.id()));
    }
    @Test void historyAndCalendarFollowThePersonNotTheProject() throws Exception {
        UUID id=create(alice,Set.of(bob.id()),"Calendar");
        var from=Instant.now().minusSeconds(3600); var to=Instant.now().plusSeconds(86400);
        for(Account who:List.of(alice,bob)) {
            var calendar=send(get("/api/v1/meetings/calendar?from="+from+"&to="+to),who).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
            assertTrue(JsonPath.<List<String>>read(calendar,"$.content[*].id").contains(id.toString()));
        }
        var other=send(get("/api/v1/meetings/calendar?from="+from+"&to="+to),carol).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        assertFalse(JsonPath.<List<String>>read(other,"$.content[*].id").contains(id.toString()));
        send(get("/api/v1/meetings/history"),carol).andExpect(status().isOk());
        send(post("/api/v1/meetings/history/clear"),carol).andExpect(status().isOk());
    }
    @Test void searchingForAttendeesIsGlobalNicknameOnlyAndLeaksNoEmail() throws Exception {
        // Dave belongs to no project at all and is still findable: that is what lets a meeting include people outside every project.
        var found=send(get("/api/v1/meetings/attendees/search?q="+dave.nickname().substring(0,6)),alice).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        assertTrue(JsonPath.<List<String>>read(found,"$[*].userId").contains(dave.id().toString()));
        assertFalse(JsonPath.<List<String>>read(found,"$[*].userId").contains(alice.id().toString()),"the caller never finds themselves");
        assertFalse(found.contains("@"),"no address in the answer"); assertFalse(found.toLowerCase().contains("email"));
        // An address is never looked up, and a too-short query is refused.
        assertEquals("[]",send(get("/api/v1/meetings/attendees/search?q="+dave.nickname()+"@example.test"),alice).andReturn().getResponse().getContentAsString());
        send(get("/api/v1/meetings/attendees/search?q=ab"),alice).andExpect(status().isBadRequest());
        send(get("/api/v1/meetings/attendees/search?q=abc"),alice).andExpect(status().is2xxSuccessful());
        // A person who does not exist cannot be invited.
        mvcCreate(alice,Set.of(UUID.randomUUID()),"Ghost").andExpect(status().isBadRequest());
    }

    @Test void theSearchBrakeAnswers429WithAnHonestRetryAfterAndOnlyForTheOneWhoSearchedTooMuch() throws Exception {
        // Dave searches until the brake closes (30 a minute; earlier tests may already have used a few).
        MvcResult refused=null;
        for(int i=0;i<40&&refused==null;i++) { var result=send(get("/api/v1/meetings/attendees/search?q=abc"),dave).andReturn(); if(result.getResponse().getStatus()==429) refused=result; }
        assertNotNull(refused,"the 31st search inside a minute is refused");
        assertEquals("60",refused.getResponse().getHeaderValue("Retry-After"),"the window is a minute, so a minute is the honest wait");
        assertEquals("no-store",refused.getResponse().getHeader("Cache-Control"));
        assertTrue(refused.getResponse().getContentAsString().contains("MEETING_SEARCH_RATE_LIMITED"));
        // The brake is Dave's alone: someone else is not slowed down by it, and neither is the rest of the meeting API for Dave.
        send(get("/api/v1/meetings/attendees/search?q=abc"),alice).andExpect(status().is2xxSuccessful());
        send(get("/api/v1/meetings?size=5"),dave).andExpect(status().isOk());
    }

    /**
     * The chat is for people who are really in the room. "Really in the room" is the media server's own list (LiveKit), and the participant record the
     * join created. The record's `connected` flag is only a copy of that list kept up to date by a webhook, so a webhook that is late must not lock
     * out someone the media server already lists, and a stale flag must never let in someone it no longer lists.
     */
    @Test void chatAuthorizationFollowsTheLivePresenceNotTheLateWebhookFlag() throws Exception {
        UUID id=create(alice,Set.of(bob.id(),dave.id()),"Presence");
        send(post("/api/v1/meetings/"+id+"/start"),alice).andExpect(status().isOk());
        send(post("/api/v1/meetings/"+id+"/join"),bob).andExpect(status().isOk());
        send(post("/api/v1/meetings/"+id+"/join"),dave).andExpect(status().isOk());
        String chat="/api/v1/meetings/"+id+"/chat", message="{\"content\":\"hello\",\"mentionIds\":[]}";
        assertEquals(Boolean.FALSE,db.queryForObject("SELECT connected FROM meeting_participants WHERE meeting_id=? AND user_id=?",Boolean.class,id,bob.id()),"no webhook has run in this test: the flag is still false");
        // 1. Admitted (a record exists) but the media server does not list the person: refused, for reading and for writing.
        send(get(chat),bob).andExpect(status().isForbidden()).andExpect(result -> assertTrue(result.getResponse().getContentAsString().contains("MEETING_PARTICIPANT_REQUIRED")));
        send(post(chat).contentType(MediaType.APPLICATION_JSON).content(message),bob).andExpect(status().isForbidden());
        // 2. The media server lists Bob and Dave; the webhook (the flag) has not arrived yet: they are in the room, so the chat works at once.
        when(media.listParticipants(anyString())).thenReturn(List.of(new MeetingMediaPort.MediaParticipant("user-"+bob.id(),"Bob"),new MeetingMediaPort.MediaParticipant("user-"+dave.id(),"Dave")));
        send(get(chat),bob).andExpect(status().isOk());
        send(post(chat).contentType(MediaType.APPLICATION_JSON).content(message),bob).andExpect(status().isCreated());
        UUID daveParticipant=db.queryForObject("SELECT id FROM meeting_participants WHERE meeting_id=? AND user_id=?",UUID.class,id,dave.id());
        Thread.sleep(800); // one message per 750 ms and person
        send(post(chat).contentType(MediaType.APPLICATION_JSON).content("{\"content\":\"@dave\",\"mentionIds\":[\""+daveParticipant+"\"]}"),bob).andExpect(status().isCreated());
        // 3. A flag that says "connected" while the media server no longer lists the person (a missed "left" event) lets nobody in.
        db.update("UPDATE meeting_participants SET connected=true WHERE meeting_id=? AND user_id=?",id,bob.id());
        when(media.listParticipants(anyString())).thenReturn(List.of());
        send(get(chat),bob).andExpect(status().isForbidden());
        // 4. Someone who was removed stays out even while the media server still lists them.
        when(media.listParticipants(anyString())).thenReturn(List.of(new MeetingMediaPort.MediaParticipant("user-"+bob.id(),"Bob")));
        db.update("UPDATE meeting_participants SET revoked=true WHERE meeting_id=? AND user_id=?",id,bob.id());
        send(get(chat),bob).andExpect(status().isForbidden());
        // 5. Being invited is not being in the room: an attendee who never joined has no record, whatever the media server lists; a stranger learns nothing.
        db.update("DELETE FROM meeting_participants WHERE meeting_id=? AND user_id=?",id,dave.id());
        send(get(chat),dave).andExpect(status().isForbidden());
        send(get(chat),eve).andExpect(status().isNotFound());
        // 6. The organizer is held to the same rule.
        send(get(chat),alice).andExpect(status().isForbidden());
        send(post("/api/v1/meetings/"+id+"/join"),alice).andExpect(status().isOk());
        when(media.listParticipants(anyString())).thenReturn(List.of(new MeetingMediaPort.MediaParticipant("user-"+alice.id(),"Alice")));
        send(get(chat),alice).andExpect(status().isOk());
    }

    /** A project meeting's chat follows exactly the same rule as an independent one's, and removing someone through the API closes the chat to them. */
    @Test void aProjectMeetingChatsLikeAnIndependentOneAndRemovalClosesTheChat() throws Exception {
        String own=body("Project chat",Set.of(bob.id(),dave.id())).replace("{","{\"meetingType\":\"PROJECT\",\"projectId\":\""+projectA+"\",");
        UUID id=UUID.fromString(JsonPath.read(send(post("/api/v1/meetings").contentType(MediaType.APPLICATION_JSON).content(own),alice).andExpect(status().isCreated()).andReturn().getResponse().getContentAsString(),"$.id"));
        send(post("/api/v1/meetings/"+id+"/start"),alice).andExpect(status().isOk());
        send(post("/api/v1/meetings/"+id+"/join"),bob).andExpect(status().isOk());
        send(post("/api/v1/meetings/"+id+"/join"),dave).andExpect(status().isOk());
        String chat="/api/v1/meetings/"+id+"/chat";
        // Eve belongs to the project but was not invited: a project member is not an attendee, so she does not even learn the meeting exists.
        send(get(chat),eve).andExpect(status().isNotFound());
        when(media.listParticipants(anyString())).thenReturn(List.of(new MeetingMediaPort.MediaParticipant("user-"+bob.id(),"Bob"),new MeetingMediaPort.MediaParticipant("user-"+dave.id(),"Dave")));
        send(get(chat),bob).andExpect(status().isOk());
        send(post(chat).contentType(MediaType.APPLICATION_JSON).content("{\"content\":\"hi\",\"mentionIds\":[]}"),dave).andExpect(status().isCreated());
        // The organizer removes Dave (the server stages the removal and rotates the room): he is refused from then on, Bob is not.
        UUID daveParticipant=db.queryForObject("SELECT id FROM meeting_participants WHERE meeting_id=? AND user_id=?",UUID.class,id,dave.id());
        when(media.roomExists(anyString())).thenReturn(false); // the old room is gone after the removal, so the rotation completes within the request
        send(post("/api/v1/meetings/"+id+"/participants/"+daveParticipant+"/kick"),alice).andExpect(status().isNoContent());
        when(media.roomExists(anyString())).thenReturn(true);
        assertEquals(Boolean.TRUE,db.queryForObject("SELECT revoked FROM meeting_participants WHERE id=?",Boolean.class,daveParticipant));
        send(get(chat),dave).andExpect(status().isForbidden());
        send(post("/api/v1/meetings/"+id+"/join"),dave).andExpect(status().isForbidden());
        send(get(chat),bob).andExpect(status().isOk());
    }

    // ---- helpers ------------------------------------------------------------------------------------------------------------------
    String body(String title,Set<UUID> attendees) {
        Instant start=Instant.now().plusSeconds(120);
        return "{\"title\":\""+title+"\",\"description\":\"\",\"startsAt\":\""+start+"\",\"endsAt\":\""+start.plusSeconds(3600)+"\",\"zoneId\":\"Europe/Istanbul\",\"agenda\":[],\"attendeeIds\":["
            +String.join(",",attendees.stream().map(id->"\""+id+"\"").toList())+"]}";
    }
    ResultActions mvcCreate(Account who,Set<UUID> attendees,String title) throws Exception { return send(post("/api/v1/meetings").contentType(MediaType.APPLICATION_JSON).content(body(title,attendees)),who); }
    UUID create(Account who,Set<UUID> attendees,String title) throws Exception {
        var response=mvcCreate(who,attendees,title).andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        return UUID.fromString(JsonPath.read(response,"$.id"));
    }
    List<String> listIds(Account who) throws Exception {
        return JsonPath.read(send(get("/api/v1/meetings?size=100"),who).andExpect(status().isOk()).andReturn().getResponse().getContentAsString(),"$.content[*].id");
    }
    /** Every call is made by a signed-in cookie session, with the CSRF pair on writes. */
    ResultActions send(MockHttpServletRequestBuilder request,Account who) throws Exception {
        Cookie csrf=csrf();
        return mvc.perform(request.cookie(who.access(),csrf).header("X-XSRF-TOKEN",csrf.getValue()));
    }
    Cookie csrf() throws Exception { return Objects.requireNonNull(mvc.perform(get("/api/v1/auth/csrf")).andReturn().getResponse().getCookie("XSRF-TOKEN")); }
    Account account(String prefix) throws Exception {
        String suffix=UUID.randomUUID().toString().replace("-","").substring(0,12);
        String email=prefix+suffix+"@example.test",password=UUID.randomUUID().toString(),nickname=prefix+"_"+suffix;
        UUID id=users.registerLocal(email,nickname,password);
        Cookie csrf=csrf();
        var login=mvc.perform(post("/api/v1/auth/login").cookie(csrf).with(request->{request.setRemoteAddr("meeting-"+suffix);return request;})
                .header("X-XSRF-TOKEN",csrf.getValue()).contentType(MediaType.APPLICATION_JSON).content("{\"email\":\""+email+"\",\"password\":\""+password+"\"}"))
            .andExpect(status().isOk()).andReturn().getResponse();
        String header=login.getHeaders(HttpHeaders.SET_COOKIE).stream().filter(h->h.startsWith("PDA_ACCESS=")).findFirst().orElseThrow();
        return new Account(id,nickname,new Cookie("PDA_ACCESS",header.split(";",2)[0].substring("PDA_ACCESS=".length())));
    }
    UUID project(String name,Account... members) {
        UUID project=UUID.randomUUID();
        db.update("INSERT INTO projects(id,name,slug,status,priority,visibility,created_by,created_at,updated_at) VALUES (?,?,?,'ACTIVE','MEDIUM','PRIVATE',?,now(),now())",project,"Project "+name,project.toString(),members[0].id());
        for(Account member:members) {
            UUID membership=UUID.randomUUID(); db.update("INSERT INTO project_memberships(id,project_id,user_id,joined_at) VALUES (?,?,?,now())",membership,project,member.id());
            db.update("INSERT INTO project_membership_roles(membership_id,role) VALUES (?,?)",membership,member==members[0]?"PROJECT_MANAGER":"TESTER");
        }
        return project;
    }
}
