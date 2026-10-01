package com.pda.reminder.integration;

import com.jayway.jsonpath.JsonPath;
import com.pda.BackendApplication;
import com.pda.project.application.service.ProjectMembershipService;
import com.pda.reminder.infrastructure.repository.ReminderRepository;
import com.pda.user.ProjectRole;
import com.pda.user.UserAccounts;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

import java.security.SecureRandom;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.Base64;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.hamcrest.Matchers.startsWith;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(classes = BackendApplication.class)
@AutoConfigureMockMvc
@Testcontainers(disabledWithoutDocker = true)
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
class ReminderApiIntegrationTest {

    private static final byte[] JWT_KEY = new byte[32];
    static { new SecureRandom().nextBytes(JWT_KEY); }

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
    @Autowired ProjectMembershipService memberships;
    @Autowired ReminderRepository reminderRepository;

    private final LocalDate day = LocalDate.now(ZoneOffset.UTC).plusDays(10);

    // ---- personal reminders -------------------------------------------------------------------------------------

    @Test
    void memberCreatesAPersonalReminderThatOnlyTheyCanSee() throws Exception {
        Fixture f = fixture();

        var created = create(f.member, f.projectId, json("Backend API'yi bitir", "WORK", null, day, null))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.scope").value("PERSONAL"))
                .andExpect(jsonPath("$.type").value("WORK"))
                .andExpect(jsonPath("$.creator.userId").value(f.member.id().toString()))
                .andReturn();
        UUID reminderId = idOf(created);

        assertEquals(List.of("Backend API'yi bitir"), titles(list(f.member, f.projectId, day, day)));
        assertEquals(List.of(), titles(list(f.manager, f.projectId, day, day)));
        assertEquals(List.of(), titles(list(f.otherMember, f.projectId, day, day)));
        mvc.perform(get(url(f.projectId, reminderId)).cookie(f.member.access())).andExpect(status().isOk());
        mvc.perform(get(url(f.projectId, reminderId)).cookie(f.manager.access())).andExpect(status().isNotFound());
        mvc.perform(get(url(f.projectId, reminderId)).cookie(f.otherMember.access()))
                .andExpect(status().isNotFound());
    }

    @Test
    void managerPersonalRemindersStayPersonalWhetherOrNotTheScopeIsSent() throws Exception {
        Fixture f = fixture();

        create(f.manager, f.projectId, json("Kendime not", "OTHER", "PERSONAL", day, null))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.scope").value("PERSONAL"));
        create(f.manager, f.projectId, json("Scope gönderilmedi", "OTHER", null, day, null))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.scope").value("PERSONAL"));

        assertEquals(2, titles(list(f.manager, f.projectId, day, day)).size());
        assertEquals(List.of(), titles(list(f.member, f.projectId, day, day)));
    }

    @Test
    void ownerEditsAndDeletesAPersonalReminderAndNobodyElseCan() throws Exception {
        Fixture f = fixture();
        UUID id = idOf(create(f.member, f.projectId, json("İlk ad", "WORK", null, day, null)).andReturn());

        mvc.perform(patchReq(f.member, url(f.projectId, id), json("Yeni ad", "REVIEW", null, day.plusDays(1), "09:30")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("Yeni ad"))
                .andExpect(jsonPath("$.type").value("REVIEW"))
                .andExpect(jsonPath("$.date").value(day.plusDays(1).toString()))
                .andExpect(jsonPath("$.time", startsWith("09:30")));

        mvc.perform(patchReq(f.otherMember, url(f.projectId, id), json("Ele geçir", "WORK", null, day, null)))
                .andExpect(status().isNotFound());
        mvc.perform(deleteReq(f.otherMember, url(f.projectId, id))).andExpect(status().isNotFound());
        mvc.perform(deleteReq(f.manager, url(f.projectId, id))).andExpect(status().isNotFound());
        mvc.perform(get(url(f.projectId, id)).cookie(f.member.access()))
                .andExpect(jsonPath("$.title").value("Yeni ad"));

        mvc.perform(deleteReq(f.member, url(f.projectId, id))).andExpect(status().isNoContent());
        mvc.perform(get(url(f.projectId, id)).cookie(f.member.access())).andExpect(status().isNotFound());
    }

    @Test
    void theScopeIsImmutableEvenIfAnEditRequestAsksForAnotherOne() throws Exception {
        Fixture f = fixture();
        UUID id = idOf(create(f.member, f.projectId, json("Kişisel", "WORK", null, day, null)).andReturn());

        mvc.perform(patchReq(f.member, url(f.projectId, id), json("Kişisel", "WORK", "PROJECT", day, null)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.scope").value("PERSONAL"));

        assertEquals(List.of(), titles(list(f.otherMember, f.projectId, day, day)));
    }

    // ---- project reminders --------------------------------------------------------------------------------------

    @Test
    void managerCreatesAProjectReminderEveryMemberSeesButNoOutsiderDoes() throws Exception {
        Fixture f = fixture();

        create(f.manager, f.projectId, json("Sprint Toplantısı", "MEETING", "PROJECT", day, "14:00"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.scope").value("PROJECT"))
                .andExpect(jsonPath("$.type").value("MEETING"))
                .andExpect(jsonPath("$.creator.userId").value(f.manager.id().toString()))
                .andExpect(jsonPath("$.creator.nickname").isNotEmpty());

        for (Account viewer : List.of(f.manager, f.member, f.otherMember)) {
            assertEquals(List.of("Sprint Toplantısı"), titles(list(viewer, f.projectId, day, day)));
        }
        mvc.perform(get(listUrl(f.projectId, day, day)).cookie(f.outsider.access())).andExpect(status().isForbidden());
        // A manager of another project is not a member of this one either.
        mvc.perform(get(listUrl(f.projectId, day, day)).cookie(f.otherProjectManager.access()))
                .andExpect(status().isForbidden());
    }

    @Test
    void aMemberCannotCreateAProjectReminderByManipulatingTheRequest() throws Exception {
        Fixture f = fixture();

        create(f.member, f.projectId, json("Herkese duyuru", "MEETING", "PROJECT", day, null))
                .andExpect(status().isForbidden());

        assertEquals(List.of(), titles(list(f.manager, f.projectId, day, day)));
    }

    @Test
    void onlyTheManagerMayEditOrDeleteAProjectReminder() throws Exception {
        Fixture f = fixture();
        UUID id = idOf(create(f.manager, f.projectId, json("Demo", "PRESENTATION", "PROJECT", day, null)).andReturn());

        mvc.perform(patchReq(f.member, url(f.projectId, id), json("Değiştirildi", "PRESENTATION", null, day, null)))
                .andExpect(status().isForbidden());
        mvc.perform(deleteReq(f.member, url(f.projectId, id))).andExpect(status().isForbidden());
        // Members can still read it.
        mvc.perform(get(url(f.projectId, id)).cookie(f.member.access())).andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("Demo"));

        mvc.perform(patchReq(f.manager, url(f.projectId, id), json("Demo v2", "REVIEW", null, day, null)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.title").value("Demo v2"))
                .andExpect(jsonPath("$.scope").value("PROJECT"));
        mvc.perform(deleteReq(f.manager, url(f.projectId, id))).andExpect(status().isNoContent());
        mvc.perform(get(url(f.projectId, id)).cookie(f.member.access())).andExpect(status().isNotFound());
    }

    // ---- types, validation and dates ----------------------------------------------------------------------------

    @Test
    void everyDeclaredTypeIsAcceptedAndAnArbitraryStringIsNot() throws Exception {
        Fixture f = fixture();

        for (String type : List.of("MEETING", "DEADLINE", "PRESENTATION", "REVIEW", "DELIVERY", "WORK", "OTHER")) {
            create(f.member, f.projectId, json("Tür " + type, type, null, day, null))
                    .andExpect(status().isCreated()).andExpect(jsonPath("$.type").value(type));
        }
        create(f.member, f.projectId, json("Geçersiz", "BIRTHDAY", null, day, null)).andExpect(status().isBadRequest());
        create(f.member, f.projectId, json("Küçük harf", "meeting", null, day, null)).andExpect(status().isBadRequest());
        create(f.member, f.projectId, json("Scope", "WORK", "EVERYONE", day, null)).andExpect(status().isBadRequest());
        assertEquals(7, titles(list(f.member, f.projectId, day, day)).size());
    }

    @Test
    void titleAndDateAreRequiredAndLimitsAreEnforced() throws Exception {
        Fixture f = fixture();

        create(f.member, f.projectId, json("   ", "WORK", null, day, null)).andExpect(status().isBadRequest());
        create(f.member, f.projectId, "{\"type\":\"WORK\",\"date\":\"" + day + "\"}").andExpect(status().isBadRequest());
        create(f.member, f.projectId, json("x".repeat(101), "WORK", null, day, null)).andExpect(status().isBadRequest());
        create(f.member, f.projectId, "{\"title\":\"Tarihsiz\",\"type\":\"WORK\"}").andExpect(status().isBadRequest());
        create(f.member, f.projectId, "{\"title\":\"Bozuk\",\"type\":\"WORK\",\"date\":\"2026-13-45\"}")
                .andExpect(status().isBadRequest());
        create(f.member, f.projectId, "{\"title\":\"Saat\",\"type\":\"WORK\",\"date\":\"" + day + "\",\"time\":\"25:99\"}")
                .andExpect(status().isBadRequest());
        create(f.member, f.projectId, "{\"title\":\"Uzun\",\"type\":\"WORK\",\"date\":\"" + day
                + "\",\"description\":\"" + "x".repeat(501) + "\"}").andExpect(status().isBadRequest());
        create(f.member, f.projectId, json("x".repeat(100), "WORK", null, day, null)).andExpect(status().isCreated());
        assertEquals(1, titles(list(f.member, f.projectId, day, day)).size());
    }

    @Test
    void descriptionAndTimeAreOptionalAndABlankDescriptionIsDropped() throws Exception {
        Fixture f = fixture();

        create(f.member, f.projectId, "{\"title\":\"Sade\",\"type\":\"OTHER\",\"date\":\"" + day
                + "\",\"description\":\"   \"}")
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.description").doesNotExist())
                .andExpect(jsonPath("$.time").doesNotExist());
    }

    @Test
    void aDateOnlyReminderKeepsExactlyTheDayThatWasSent() throws Exception {
        Fixture f = fixture();
        // First day of a month: the classic casualty of a UTC conversion ("1 Ekim" turning into "30 Eylül").
        LocalDate firstOfMonth = day.plusMonths(1).withDayOfMonth(1);

        UUID id = idOf(create(f.member, f.projectId, json("Gün kayması", "DEADLINE", null, firstOfMonth, null))
                .andExpect(jsonPath("$.date").value(firstOfMonth.toString())).andReturn());

        mvc.perform(get(url(f.projectId, id)).cookie(f.member.access()))
                .andExpect(jsonPath("$.date").value(firstOfMonth.toString()));
        assertEquals(List.of("Gün kayması"), titles(list(f.member, f.projectId, firstOfMonth, firstOfMonth)));
        assertEquals(List.of(), titles(list(f.member, f.projectId, firstOfMonth.minusDays(1),
                firstOfMonth.minusDays(1))));
    }

    @Test
    void creatingInThePastIsRejectedButEditingTheTextOfAnOldReminderIsNot() throws Exception {
        Fixture f = fixture();
        LocalDate longAgo = LocalDate.now(ZoneOffset.UTC).minusDays(5);

        create(f.member, f.projectId, json("Geçmiş", "WORK", null, longAgo, null)).andExpect(status().isBadRequest());
        // Today and "yesterday" (a user west of UTC may still be on it) are fine.
        create(f.member, f.projectId, json("Bugün", "WORK", null, LocalDate.now(ZoneOffset.UTC), null))
                .andExpect(status().isCreated());
        create(f.member, f.projectId, json("Dün", "WORK", null, LocalDate.now(ZoneOffset.UTC).minusDays(1), null))
                .andExpect(status().isCreated());

        UUID id = idOf(create(f.member, f.projectId, json("Yakında", "WORK", null, day, null)).andReturn());
        mvc.perform(patchReq(f.member, url(f.projectId, id), json("Yakında", "WORK", null, longAgo, null)))
                .andExpect(status().isBadRequest());
    }

    // ---- date-range query ---------------------------------------------------------------------------------------

    @Test
    void theRangeQueryReturnsOnlyTheRequestedDaysInCalendarOrder() throws Exception {
        Fixture f = fixture();
        create(f.member, f.projectId, json("Üçüncü", "WORK", null, day.plusDays(2), null)).andExpect(status().isCreated());
        create(f.member, f.projectId, json("Öğleden sonra", "MEETING", null, day, "15:00")).andExpect(status().isCreated());
        create(f.member, f.projectId, json("Sabah", "MEETING", null, day, "08:00")).andExpect(status().isCreated());
        create(f.member, f.projectId, json("Saatsiz", "WORK", null, day, null)).andExpect(status().isCreated());
        create(f.member, f.projectId, json("Aralık dışı", "WORK", null, day.plusDays(20), null))
                .andExpect(status().isCreated());

        assertEquals(List.of("Sabah", "Öğleden sonra", "Saatsiz", "Üçüncü"),
                titles(list(f.member, f.projectId, day, day.plusDays(3))));
        assertEquals(List.of("Aralık dışı"), titles(list(f.member, f.projectId, day.plusDays(20), day.plusDays(20))));
    }

    @Test
    void theRangeIsRequiredOrderedAndBounded() throws Exception {
        Fixture f = fixture();
        String base = "/api/v1/projects/" + f.projectId + "/reminders";

        mvc.perform(get(base).cookie(f.member.access())).andExpect(status().isBadRequest());
        mvc.perform(get(base + "?from=" + day).cookie(f.member.access())).andExpect(status().isBadRequest());
        mvc.perform(get(base + "?from=" + day + "&to=" + day.minusDays(1)).cookie(f.member.access()))
                .andExpect(status().isBadRequest());
        mvc.perform(get(base + "?from=bugun&to=" + day).cookie(f.member.access())).andExpect(status().isBadRequest());
        mvc.perform(get(base + "?from=" + day + "&to=" + day.plusDays(92)).cookie(f.member.access()))
                .andExpect(status().isOk());
        mvc.perform(get(base + "?from=" + day + "&to=" + day.plusDays(93)).cookie(f.member.access()))
                .andExpect(status().isBadRequest());
    }

    // ---- isolation and security ---------------------------------------------------------------------------------

    @Test
    void aReminderOfOneProjectIsNotReachableThroughAnotherProject() throws Exception {
        Fixture f = fixture();
        // The manager belongs to both projects, so only the projectId/reminderId pairing can stop this.
        UUID otherProject = createProject(f.manager, "Ikinci proje");
        UUID id = idOf(create(f.manager, f.projectId, json("Proje A", "MEETING", "PROJECT", day, null)).andReturn());

        mvc.perform(get(url(otherProject, id)).cookie(f.manager.access())).andExpect(status().isNotFound());
        mvc.perform(patchReq(f.manager, url(otherProject, id), json("Ele geçir", "WORK", null, day, null)))
                .andExpect(status().isNotFound());
        mvc.perform(deleteReq(f.manager, url(otherProject, id))).andExpect(status().isNotFound());
        assertEquals(List.of(), titles(list(f.manager, otherProject, day, day)));
        mvc.perform(get(url(f.projectId, id)).cookie(f.manager.access())).andExpect(status().isOk());
    }

    @Test
    void remindersRequireAuthenticationAndCsrfForEveryWrite() throws Exception {
        Fixture f = fixture();
        UUID id = idOf(create(f.member, f.projectId, json("Gizli", "WORK", null, day, null)).andReturn());
        Cookie csrf = csrfCookie();

        // Like every project route, an anonymous request is refused (403) before it reaches the service.
        mvc.perform(get(listUrl(f.projectId, day, day))).andExpect(status().isForbidden());
        mvc.perform(post(base(f.projectId)).contentType(MediaType.APPLICATION_JSON)
                        .content(json("Anonim", "WORK", null, day, null)))
                .andExpect(status().isForbidden());
        // Authenticated but without the CSRF token: still refused.
        mvc.perform(post(base(f.projectId)).cookie(f.member.access()).contentType(MediaType.APPLICATION_JSON)
                        .content(json("CSRF yok", "WORK", null, day, null)))
                .andExpect(status().isForbidden());
        mvc.perform(patch(url(f.projectId, id)).cookie(f.member.access()).contentType(MediaType.APPLICATION_JSON)
                        .content(json("CSRF yok", "WORK", null, day, null)))
                .andExpect(status().isForbidden());
        mvc.perform(delete(url(f.projectId, id)).cookie(f.member.access())).andExpect(status().isForbidden());
        // With the token the very same request is accepted.
        mvc.perform(delete(url(f.projectId, id)).cookie(csrf, f.member.access())
                        .header("X-XSRF-TOKEN", csrf.getValue()))
                .andExpect(status().isNoContent());
    }

    @Test
    void aNonMemberCannotCreateOrReadAnything() throws Exception {
        Fixture f = fixture();
        UUID id = idOf(create(f.manager, f.projectId, json("Proje", "MEETING", "PROJECT", day, null)).andReturn());

        create(f.outsider, f.projectId, json("Sızma", "WORK", null, day, null)).andExpect(status().isForbidden());
        mvc.perform(get(url(f.projectId, id)).cookie(f.outsider.access())).andExpect(status().isForbidden());
        mvc.perform(deleteReq(f.outsider, url(f.projectId, id))).andExpect(status().isForbidden());
    }

    // ---- membership lifecycle -----------------------------------------------------------------------------------

    @Test
    void aRemovedMembersPersonalRemindersAreKeptButNoLongerReachableByThem() throws Exception {
        Fixture f = fixture();
        UUID personalId = idOf(create(f.member, f.projectId, json("Kişisel kalır", "WORK", null, day, null)).andReturn());
        UUID projectReminderId = idOf(create(f.manager, f.projectId, json("Proje kalır", "MEETING", "PROJECT", day, null))
                .andReturn());

        memberships.removeMember(f.manager.id(), f.projectId, f.member.id());

        // The removed member is locked out of every reminder operation, their own reminder included.
        mvc.perform(get(listUrl(f.projectId, day, day)).cookie(f.member.access())).andExpect(status().isForbidden());
        mvc.perform(get(url(f.projectId, personalId)).cookie(f.member.access())).andExpect(status().isForbidden());
        mvc.perform(patchReq(f.member, url(f.projectId, personalId), json("Hâlâ benim", "WORK", null, day, null)))
                .andExpect(status().isForbidden());
        mvc.perform(deleteReq(f.member, url(f.projectId, personalId))).andExpect(status().isForbidden());
        create(f.member, f.projectId, json("Yeni", "WORK", null, day, null)).andExpect(status().isForbidden());

        // Nothing was deleted: both rows are still there, unchanged.
        assertEquals("Kişisel kalır", reminderRepository.findByIdAndProjectId(personalId, f.projectId).orElseThrow().getTitle());
        assertEquals("Proje kalır", reminderRepository.findByIdAndProjectId(projectReminderId, f.projectId).orElseThrow().getTitle());
        assertEquals(2, reminderRepository.findAll().stream().filter(r -> r.getProjectId().equals(f.projectId)).count());

        // Everyone else is unaffected: the project reminder works as before, the departed member's personal one stays private.
        assertEquals(List.of("Proje kalır"), titles(list(f.manager, f.projectId, day, day)));
        assertEquals(List.of("Proje kalır"), titles(list(f.otherMember, f.projectId, day, day)));
        mvc.perform(get(url(f.projectId, personalId)).cookie(f.manager.access())).andExpect(status().isNotFound());

        // The membership is reactivated when the same person is added back, and so is access to their own reminders.
        memberships.addMember(f.manager.id(), f.projectId, f.member.id(), Set.of(ProjectRole.BACKEND_DEVELOPER));
        assertEquals(List.of("Kişisel kalır", "Proje kalır").stream().sorted().toList(),
                titles(list(f.member, f.projectId, day, day)).stream().sorted().toList());
        mvc.perform(get(url(f.projectId, personalId)).cookie(f.member.access())).andExpect(status().isOk());
    }

    @Test
    void aProjectReminderOutlivesTheManagerWhoCreatedItAndStaysManageable() throws Exception {
        Fixture f = fixture();
        Account secondManager = account("remmanager2");
        memberships.addMember(f.manager.id(), f.projectId, secondManager.id(), Set.of(ProjectRole.PROJECT_MANAGER));
        UUID id = idOf(create(secondManager, f.projectId, json("Ortak plan", "DELIVERY", "PROJECT", day, null))
                .andExpect(jsonPath("$.creator.nickname").isNotEmpty()).andReturn());

        memberships.removeMember(f.manager.id(), f.projectId, secondManager.id());

        mvc.perform(get(url(f.projectId, id)).cookie(f.member.access()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("Ortak plan"))
                .andExpect(jsonPath("$.creator.userId").value(secondManager.id().toString()))
                .andExpect(jsonPath("$.creator.nickname").doesNotExist());
        mvc.perform(patchReq(f.manager, url(f.projectId, id), json("Ortak plan v2", "DELIVERY", null, day, null)))
                .andExpect(status().isOk());
        mvc.perform(deleteReq(f.manager, url(f.projectId, id))).andExpect(status().isNoContent());
    }

    // ---- fixture and helpers ------------------------------------------------------------------------------------

    private record Fixture(UUID projectId, Account manager, Account member, Account otherMember, Account outsider,
                           Account otherProjectManager) {
    }

    private Fixture fixture() throws Exception {
        Account manager = account("remmanager");
        Account member = account("remmember");
        Account otherMember = account("remother");
        Account outsider = account("remoutsider");
        Account otherProjectManager = account("remforeign");
        UUID projectId = createProject(manager, "Reminder project");
        createProject(otherProjectManager, "Foreign project");
        memberships.addMember(manager.id(), projectId, member.id(), Set.of(ProjectRole.BACKEND_DEVELOPER));
        memberships.addMember(manager.id(), projectId, otherMember.id(), Set.of(ProjectRole.TESTER));
        return new Fixture(projectId, manager, member, otherMember, outsider, otherProjectManager);
    }

    private static String base(UUID projectId) {
        return "/api/v1/projects/" + projectId + "/reminders";
    }

    private static String url(UUID projectId, UUID reminderId) {
        return base(projectId) + "/" + reminderId;
    }

    private static String listUrl(UUID projectId, LocalDate from, LocalDate to) {
        return base(projectId) + "?from=" + from + "&to=" + to;
    }

    private static String json(String title, String type, String scope, LocalDate date, String time) {
        return "{\"title\":" + quote(title) + ",\"type\":\"" + type + "\""
                + (scope == null ? "" : ",\"scope\":\"" + scope + "\"")
                + ",\"date\":\"" + date + "\""
                + (time == null ? "" : ",\"time\":\"" + time + "\"") + "}";
    }

    private static String quote(String text) {
        return "\"" + text.replace("\\", "\\\\").replace("\"", "\\\"") + "\"";
    }

    private org.springframework.test.web.servlet.ResultActions create(Account actor, UUID projectId, String body)
            throws Exception {
        Cookie csrf = csrfCookie();
        return mvc.perform(post(base(projectId)).cookie(csrf, actor.access()).header("X-XSRF-TOKEN", csrf.getValue())
                .contentType(MediaType.APPLICATION_JSON).content(body));
    }

    private MockHttpServletRequestBuilder patchReq(Account actor, String url, String body) throws Exception {
        Cookie csrf = csrfCookie();
        return patch(url).cookie(csrf, actor.access()).header("X-XSRF-TOKEN", csrf.getValue())
                .contentType(MediaType.APPLICATION_JSON).content(body);
    }

    private MockHttpServletRequestBuilder deleteReq(Account actor, String url) throws Exception {
        Cookie csrf = csrfCookie();
        return delete(url).cookie(csrf, actor.access()).header("X-XSRF-TOKEN", csrf.getValue());
    }

    private List<String> titles(MvcResult result) throws Exception {
        return JsonPath.read(result.getResponse().getContentAsString(), "$[*].title");
    }

    private MvcResult list(Account actor, UUID projectId, LocalDate from, LocalDate to) throws Exception {
        return mvc.perform(get(listUrl(projectId, from, to)).cookie(actor.access()))
                .andExpect(status().isOk()).andReturn();
    }

    private static UUID idOf(MvcResult result) throws Exception {
        return UUID.fromString(JsonPath.read(result.getResponse().getContentAsString(), "$.id"));
    }

    private UUID createProject(Account actor, String name) throws Exception {
        Cookie csrf = csrfCookie();
        var response = mvc.perform(post("/api/v1/projects").cookie(csrf, actor.access())
                        .header("X-XSRF-TOKEN", csrf.getValue()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"" + name + "\"}"))
                .andExpect(status().isCreated()).andReturn().getResponse();
        return UUID.fromString(JsonPath.read(response.getContentAsString(), "$.id"));
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
        Cookie access = cookie(login.getHeaders(HttpHeaders.SET_COOKIE), "PDA_ACCESS");
        assertFalse(access.getValue().isBlank());
        return new Account(id, access);
    }

    private Cookie csrfCookie() throws Exception {
        Cookie cookie = mvc.perform(get("/api/v1/auth/csrf"))
                .andExpect(status().isOk()).andReturn().getResponse().getCookie("XSRF-TOKEN");
        assertNotNull(cookie);
        assertTrue(cookie.getValue().length() > 10);
        return cookie;
    }

    private static Cookie cookie(java.util.Collection<String> headers, String name) {
        String value = headers.stream().filter(header -> header.startsWith(name + "="))
                .findFirst().orElseThrow().split(";", 2)[0].substring(name.length() + 1);
        return new Cookie(name, value);
    }

    private record Account(UUID id, Cookie access) {
    }
}
