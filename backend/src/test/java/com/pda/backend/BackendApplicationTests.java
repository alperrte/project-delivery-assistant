package com.pda.backend;

import com.pda.BackendApplication;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.web.servlet.MockMvc;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@Import(TestcontainersConfiguration.class)
@SpringBootTest(classes = BackendApplication.class)
@AutoConfigureMockMvc
@TestPropertySource(properties = {"FRONTEND_URL=http://localhost:3000", "API_DOCS_ENABLED=false"})
class BackendApplicationTests {
	@Autowired MockMvc mvc;

	private static final byte[] JWT_KEY = new byte[32];
	static { new java.security.SecureRandom().nextBytes(JWT_KEY); }

	@DynamicPropertySource
	static void jwt(DynamicPropertyRegistry registry) {
		registry.add("JWT_SECRET", () -> java.util.Base64.getEncoder().encodeToString(JWT_KEY));
	}

	@Test
	void disabledApiDocsCannotBeReached() throws Exception {
		mvc.perform(get("/swagger-ui/index.html")).andExpect(status().isForbidden());
		mvc.perform(get("/swagger-ui/swagger-ui.css")).andExpect(status().isForbidden());
		mvc.perform(get("/v3/api-docs")).andExpect(status().isForbidden());
		mvc.perform(get("/v3/api-docs/swagger-config")).andExpect(status().isForbidden());
	}

}
