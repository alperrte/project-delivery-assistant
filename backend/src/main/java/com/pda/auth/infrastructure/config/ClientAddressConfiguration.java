package com.pda.auth.infrastructure.config;

import org.apache.catalina.filters.RemoteIpFilter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.Ordered;

/**
 * Makes {@code HttpServletRequest#getRemoteAddr()} report the real client IP when (and only when) the
 * connection actually comes from a trusted reverse proxy — the value {@link AuthRateLimitFilter} and
 * {@link ProjectInvitationRateLimitFilter} key their per-IP sliding windows on.
 *
 * <p>By default (no {@code TRUSTED_PROXY_CIDRS}) {@link RemoteIpFilter#internalProxies} matches nothing, so
 * every {@code X-Forwarded-For}/{@code X-Forwarded-Proto} header is ignored and {@code getRemoteAddr()} stays
 * the direct TCP peer address — exactly today's behaviour, correct for this project's current docker-compose
 * topology where the backend container is reached directly (no reverse proxy in front of it). A future
 * deployment that does sit behind one (Nginx, a cloud load balancer, ...) sets {@code TRUSTED_PROXY_CIDRS} to
 * that proxy's address (regex, Tomcat's own format, e.g. {@code 10\.0\.0\.1} or a whole subnet), and only then
 * does the header get trusted — never blindly, and never from an arbitrary client claiming to be the proxy.</p>
 */
@Configuration(proxyBeanMethods = false)
public class ClientAddressConfiguration {

    @Bean
    FilterRegistrationBean<RemoteIpFilter> remoteIpFilter(@Value("${TRUSTED_PROXY_CIDRS:}") String trustedProxyCidrs) {
        RemoteIpFilter filter = new RemoteIpFilter();
        // Empty regex matches no address, so with no configured proxy the filter is a no-op by construction.
        filter.setInternalProxies(trustedProxyCidrs);
        FilterRegistrationBean<RemoteIpFilter> registration = new FilterRegistrationBean<>(filter);
        // Must run before anything reads getRemoteAddr(), in particular the rate-limit filters below it.
        registration.setOrder(Ordered.HIGHEST_PRECEDENCE);
        return registration;
    }
}
