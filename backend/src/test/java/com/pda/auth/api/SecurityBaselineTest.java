package com.pda.auth.api;

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.pda.auth.infrastructure.config.SecurityBaselineConfiguration;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.csrf.CsrfFilter;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest
@Import(SecurityBaselineConfiguration.class)
class SecurityBaselineTest {

    @Autowired MockMvc mvc;
    @Autowired SecurityFilterChain filterChain;

    @Test
    void protectedRequestsAreDeniedAndCsrfFilterIsPresent() throws Exception {
        assertTrue(filterChain.getFilters().stream().anyMatch(CsrfFilter.class::isInstance));
        mvc.perform(get("/api/v1/users")).andExpect(status().isForbidden());
        mvc.perform(post("/api/v1/users")).andExpect(status().isForbidden());
    }
}
