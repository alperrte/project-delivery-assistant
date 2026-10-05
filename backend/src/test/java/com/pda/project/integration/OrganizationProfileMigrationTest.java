package com.pda.project.integration;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;
import java.util.UUID;
import static org.junit.jupiter.api.Assertions.*;
@Testcontainers
class OrganizationProfileMigrationTest {
 @Container static PostgreSQLContainer postgres = new PostgreSQLContainer("postgres:17-alpine");
 @Test void legacyOrganizationSurvivesUpgrade() {
  Flyway.configure().dataSource(postgres.getJdbcUrl(),postgres.getUsername(),postgres.getPassword()).target("51").load().migrate();
  JdbcTemplate jdbc = new JdbcTemplate(new DriverManagerDataSource(postgres.getJdbcUrl(),postgres.getUsername(),postgres.getPassword()));
  UUID id=UUID.randomUUID();
  jdbc.update("INSERT INTO organizations(id,name,slug,owner_user_id,status,created_at,updated_at) VALUES (?, 'Legacy', 'legacy', ?, 'ACTIVE', now(), now())",id,UUID.randomUUID());
  Flyway.configure().dataSource(postgres.getJdbcUrl(),postgres.getUsername(),postgres.getPassword()).target("52").load().migrate();
  jdbc.update("UPDATE organizations SET location='Existing location' WHERE id=?", id);
  Flyway.configure().dataSource(postgres.getJdbcUrl(),postgres.getUsername(),postgres.getPassword()).load().migrate();
  assertNull(jdbc.queryForObject("SELECT notes FROM organizations WHERE id=?",String.class,id));
  assertEquals("Existing location",jdbc.queryForObject("SELECT location FROM organizations WHERE id=?",String.class,id));
  assertEquals("Legacy",jdbc.queryForObject("SELECT name FROM organizations WHERE id=?",String.class,id));
  assertNull(jdbc.queryForObject("SELECT logo_key FROM organizations WHERE id=?",String.class,id));
  assertNull(jdbc.queryForObject("SELECT website FROM organizations WHERE id=?",String.class,id));
 }
}
