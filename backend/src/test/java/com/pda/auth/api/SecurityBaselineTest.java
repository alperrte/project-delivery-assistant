package com.pda.auth.api;

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.pda.auth.infrastructure.config.SecurityBaselineConfiguration;
import com.pda.auth.application.service.RegistrationWorkflow;
import com.pda.auth.application.service.JwtTokens;
import com.pda.auth.infrastructure.config.AuthCookies;
import com.pda.user.UserAccounts;
import com.pda.user.UserSessions;
import java.time.Clock;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.csrf.CsrfFilter;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

@WebMvcTest(AuthRegistrationController.class)
@Import(SecurityBaselineConfiguration.class)
@TestPropertySource(properties = "FRONTEND_URL=http://localhost:3000")
class SecurityBaselineTest {

    @Autowired MockMvc mvc;
    @Autowired SecurityFilterChain filterChain;
    @MockitoBean RegistrationWorkflow workflow;
    @MockitoBean JwtTokens tokens;
    @MockitoBean AuthCookies cookies;
    @MockitoBean UserAccounts users;
    @MockitoBean UserSessions sessions;
    @MockitoBean Clock clock;

    @Test
    void protectedRequestsAreDeniedAndCsrfFilterIsPresent() throws Exception {
        assertTrue(filterChain.getFilters().stream().anyMatch(CsrfFilter.class::isInstance));
        mvc.perform(get("/api/v1/users")).andExpect(status().isForbidden());
        mvc.perform(post("/api/v1/users")).andExpect(status().isForbidden());
    }

    @Test
    void onlyHealthActuatorEndpointIsPublic() throws Exception {
        // No actuator in this slice: a permitted path reaches routing (404), a denied one stops at 403.
        mvc.perform(get("/actuator/health")).andExpect(status().isNotFound());
        mvc.perform(get("/actuator/env")).andExpect(status().isForbidden());
        mvc.perform(get("/actuator/health/liveness")).andExpect(status().isForbidden());
    }
}
