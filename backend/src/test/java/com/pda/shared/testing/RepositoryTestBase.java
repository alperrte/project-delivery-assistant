package com.pda.shared.testing;

import com.pda.BackendApplication;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.test.context.ContextConfiguration;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.DockerClientFactory;
import org.testcontainers.junit.jupiter.Testcontainers;

/**
 * Compatible repository slices share one context/database within each JVM.
 * DataJpaTest rolls every method back. No HTTP, async worker or migration-upgrade
 * tests use this base; those continue to own separate databases and contexts.
 */
@DataJpaTest(properties = "spring.jpa.hibernate.ddl-auto=validate")
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@ContextConfiguration(classes = BackendApplication.class)
@Testcontainers(disabledWithoutDocker = true)
public abstract class RepositoryTestBase {
    private static final TestPostgres POSTGRES = new TestPostgres("postgres:16-alpine");

    static {
        if (DockerClientFactory.instance().isDockerAvailable()) POSTGRES.start();
    }

    @DynamicPropertySource
    static void databaseProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        registry.add("spring.datasource.username", POSTGRES::getUsername);
        registry.add("spring.datasource.password", POSTGRES::getPassword);
    }
}
