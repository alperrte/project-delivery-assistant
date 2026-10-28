package com.pda.shared.testing;

import java.sql.DriverManager;
import java.sql.SQLException;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import org.testcontainers.lifecycle.Startable;
import org.testcontainers.postgresql.PostgreSQLContainer;

/**
 * One ephemeral PostgreSQL server per image and JVM; each handle owns a fresh database.
 * JUnit manages the database handle, not the shared server. No external DB, persistent
 * volume or Testcontainers cross-run reuse is used. Testcontainers/Ryuk cleans
 * the servers after the JVM exits, including forced exits. Do not stop servers
 * in a JVM hook: Spring must finish its own shutdown while the DB is available.
 */
public final class TestPostgres implements Startable, AutoCloseable {
    private static final Map<String, PostgreSQLContainer> SERVERS = new ConcurrentHashMap<>();
    private final String image;
    private final String database = "pda_test_" + UUID.randomUUID().toString().replace("-", "");
    private PostgreSQLContainer server;
    private boolean started;
    private boolean closed;

    public TestPostgres(String image) {
        if (!image.matches("postgres:(16|17|18)-alpine")) {
            throw new IllegalArgumentException("Only the existing test PostgreSQL images are supported");
        }
        this.image = image;
    }

    @Override
    public synchronized void start() {
        if (closed) throw new IllegalStateException("Test database handle is closed");
        if (started) return;
        server = SERVERS.computeIfAbsent(image, key -> {
            var container = new PostgreSQLContainer(key);
            container.withPassword(UUID.randomUUID().toString());
            container.start();
            return container;
        });
        try (var connection = DriverManager.getConnection(server.getJdbcUrl(), server.getUsername(), server.getPassword());
             var statement = connection.createStatement()) {
            // Identifier is generated above, never supplied by a test or application request.
            statement.execute("CREATE DATABASE " + database);
            started = true;
        } catch (SQLException exception) {
            throw new IllegalStateException("Cannot create isolated test database", exception);
        }
    }

    public String getJdbcUrl() {
        start();
        String base = server.getJdbcUrl();
        int query = base.indexOf('?');
        String suffix = query < 0 ? "" : base.substring(query);
        String address = query < 0 ? base : base.substring(0, query);
        return address.substring(0, address.lastIndexOf('/') + 1) + database + suffix;
    }

    public String getUsername() { start(); return server.getUsername(); }
    public String getPassword() { start(); return server.getPassword(); }

    @Override
    public synchronized void stop() {
        if (!started || closed) return;
        try (var connection = DriverManager.getConnection(server.getJdbcUrl(), server.getUsername(), server.getPassword());
             var statement = connection.createStatement()) {
            statement.execute("DROP DATABASE IF EXISTS " + database + " WITH (FORCE)");
            closed = true;
        } catch (SQLException exception) {
            throw new IllegalStateException("Cannot remove isolated test database", exception);
        }
    }

    @Override
    public void close() { stop(); }
}
