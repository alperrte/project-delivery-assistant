package com.pda.admin.infrastructure.bootstrap;

import com.pda.user.UserAdministration;
import java.util.regex.Pattern;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

/**
 * Creates the first administrator from {@code ADMIN_EMAIL} / {@code ADMIN_INITIAL_PASSWORD} when the instance has
 * none. It never overwrites, promotes or resets an existing account, and never logs the email or the password. A
 * missing, malformed or weak (under 12 characters, e.g. the {@code .env.example} placeholder) value is skipped.
 */
@Component
public class AdminBootstrapRunner implements ApplicationRunner {

    static final int MIN_PASSWORD_LENGTH = 12;
    private static final Pattern EMAIL = Pattern.compile("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$");
    private static final Logger log = LoggerFactory.getLogger(AdminBootstrapRunner.class);

    private final UserAdministration administration;
    private final String email;
    private final String password;

    public AdminBootstrapRunner(UserAdministration administration, @Value("${ADMIN_EMAIL:}") String email,
                                @Value("${ADMIN_INITIAL_PASSWORD:}") String password) {
        this.administration = administration;
        this.email = email == null ? "" : email.strip();
        this.password = password == null ? "" : password;
    }

    @Override
    public void run(ApplicationArguments args) {
        if (email.isEmpty() || password.isEmpty()) {
            log.info("Admin bootstrap skipped: ADMIN_EMAIL or ADMIN_INITIAL_PASSWORD is not set.");
            return;
        }
        if (!EMAIL.matcher(email).matches() || email.length() > 254) {
            log.warn("Admin bootstrap skipped: ADMIN_EMAIL is not a valid email address.");
            return;
        }
        if (password.length() < MIN_PASSWORD_LENGTH || password.length() > 72) {
            log.warn("Admin bootstrap skipped: ADMIN_INITIAL_PASSWORD must be {}-72 characters.", MIN_PASSWORD_LENGTH);
            return;
        }
        switch (administration.bootstrapAdmin(email, password)) {
            case CREATED -> log.info("Initial administrator created; it signs in at the separate administrator sign-in and enrols an authenticator app at first use.");
            case ADMIN_EXISTS -> log.info("Admin bootstrap skipped: an administrator already exists.");
            case EMAIL_TAKEN -> log.warn("Admin bootstrap skipped: ADMIN_EMAIL belongs to an existing non-admin account; it was not modified.");
        }
    }
}
