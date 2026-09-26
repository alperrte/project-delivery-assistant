package com.pda.auth.infrastructure.config;

import java.time.Clock;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration(proxyBeanMethods = false)
public class AuthTimeConfiguration {

    @Bean
    Clock authClock() {
        return Clock.systemUTC();
    }
}
