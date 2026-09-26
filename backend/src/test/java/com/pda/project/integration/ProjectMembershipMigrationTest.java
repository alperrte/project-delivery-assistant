package com.pda.project.integration;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;

@Testcontainers(disabledWithoutDocker = true)
class ProjectMembershipMigrationTest {

    @Container
    static PostgreSQLContainer postgres = new PostgreSQLContainer("postgres:17-alpine");

    @Test
    void v23PreservesExistingManagerMembershipFromV22() {
        Flyway.configure().dataSource(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword())
                .target("22").load().migrate();
        JdbcTemplate jdbc = new JdbcTemplate(new DriverManagerDataSource(
                postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword()));
        UUID projectId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        UUID membershipId = UUID.randomUUID();
        jdbc.update("INSERT INTO projects (id, name, slug, status, priority, visibility, created_by, "
                        + "created_at, updated_at) VALUES (?, 'Legacy', 'legacy', 'PLANNING', 'MEDIUM', "
                        + "'PRIVATE', ?, now(), now())", projectId, userId);
        jdbc.update("INSERT INTO project_memberships (id, project_id, user_id, joined_at) "
                + "VALUES (?, ?, ?, now())", membershipId, projectId, userId);
        jdbc.update("INSERT INTO project_membership_roles (membership_id, role) VALUES (?, 'PROJECT_MANAGER')",
                membershipId);

        Flyway.configure().dataSource(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword())
                .load().migrate();

        assertEquals("ACTIVE", jdbc.queryForObject("SELECT status FROM project_memberships WHERE id = ?",
                String.class, membershipId));
        assertEquals("PROJECT_MANAGER", jdbc.queryForObject(
                "SELECT role FROM project_membership_roles WHERE membership_id = ?", String.class, membershipId));
    }
}
