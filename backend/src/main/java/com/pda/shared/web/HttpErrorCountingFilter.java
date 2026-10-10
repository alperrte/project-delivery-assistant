package com.pda.shared.web;

import com.pda.shared.HttpErrorCounters;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Reports the final status code of every answer to {@link HttpErrorCounters}. It runs outermost (see
 * {@code HttpErrorCountingConfiguration}) so the 401/403 answers of the security chain are counted too. It reads nothing
 * from the request.
 */
public class HttpErrorCountingFilter extends OncePerRequestFilter {

    private final HttpErrorCounters counters;

    public HttpErrorCountingFilter(HttpErrorCounters counters) {
        this.counters = counters;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        try {
            chain.doFilter(request, response);
        } catch (IOException | ServletException | RuntimeException exception) {
            // The container answers an escaped exception with 500.
            counters.count(500);
            throw exception;
        }
        counters.count(response.getStatus());
    }
}
