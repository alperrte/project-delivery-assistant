package com.pda.backend;

import com.pda.BackendApplication;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;

@Import(TestcontainersConfiguration.class)
@SpringBootTest(classes = BackendApplication.class)
class BackendApplicationTests {

	@Test
	void contextLoads() {
	}

}
