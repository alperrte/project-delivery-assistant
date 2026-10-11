package com.pda.shared.web;

import com.pda.shared.HttpErrorCounters;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.Ordered;

/** Registers the counting filter before everything else, including the security filter chain. */
@Configuration(proxyBeanMethods = false)
class HttpErrorCountingConfiguration {

    @Bean
    FilterRegistrationBean<HttpErrorCountingFilter> httpErrorCountingFilter(HttpErrorCounters counters) {
        FilterRegistrationBean<HttpErrorCountingFilter> registration =
                new FilterRegistrationBean<>(new HttpErrorCountingFilter(counters));
        registration.setOrder(Ordered.HIGHEST_PRECEDENCE);
        return registration;
    }
}
