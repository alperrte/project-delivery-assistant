package com.pda.auth.infrastructure.config;

import jakarta.servlet.Filter;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import java.util.concurrent.atomic.AtomicInteger;
import static org.junit.jupiter.api.Assertions.*;

/** Exercise the existing global trusted-proxy normalizer before the actual meeting quota filter. */
class MeetingProxyRateLimitTest {
    @Test void untrustedForwardedAddressesCannotRotateTheDirectPeerQuota() throws Exception {
        Filter normalizer=new ClientAddressConfiguration().remoteIpFilter("10\\.0\\.0\\.1").getFilter();
        MeetingHttpLimitFilter limiter=new MeetingHttpLimitFilter();
        AtomicInteger admitted=new AtomicInteger();
        for(int i=0;i<11;i++) {
            var response=attempt(normalizer,limiter,"203.0.113.77","198.51.100."+i,admitted);
            assertEquals(i<10?200:429,response.getStatus());
        }
        assertEquals(10,admitted.get());
    }

    @Test void trustedProxyKeepsDifferentClientsInSeparateQuotas() throws Exception {
        Filter normalizer=new ClientAddressConfiguration().remoteIpFilter("10\\.0\\.0\\.1").getFilter();
        MeetingHttpLimitFilter limiter=new MeetingHttpLimitFilter();
        AtomicInteger admitted=new AtomicInteger();
        for(int i=0;i<10;i++) {
            assertEquals(200,attempt(normalizer,limiter,"10.0.0.1","198.51.100.10",admitted).getStatus());
            assertEquals(200,attempt(normalizer,limiter,"10.0.0.1","198.51.100.20",admitted).getStatus());
        }
        assertEquals(429,attempt(normalizer,limiter,"10.0.0.1","198.51.100.10",admitted).getStatus());
        assertEquals(20,admitted.get());
    }

    private MockHttpServletResponse attempt(Filter normalizer,MeetingHttpLimitFilter limiter,String peer,
                                            String forwarded,AtomicInteger admitted) throws Exception {
        var request=new MockHttpServletRequest("POST","/api/v1/meetings/guest/session");
        request.setRemoteAddr(peer);request.setRemoteHost(peer);
        request.addHeader("X-Forwarded-For",forwarded);
        request.setContent("{}".getBytes(java.nio.charset.StandardCharsets.UTF_8));
        var response=new MockHttpServletResponse();
        normalizer.doFilter(request,response,(normalized,output)->limiter.doFilter(normalized,output,
                (accepted,reply)->admitted.incrementAndGet()));
        return response;
    }
}
