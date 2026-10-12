package com.pda.shared;

import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

/** Validate production settings at startup even though the domain mail adapters are lazy. No network access. */
@Component
public class ProductionMailConfigurationValidator {
    public ProductionMailConfigurationValidator(Environment environment) {
        if ("prod".equalsIgnoreCase(environment.getProperty("APP_ENV", "dev"))) {
            SmtpMailSettings.from(environment);
        }
    }
}
