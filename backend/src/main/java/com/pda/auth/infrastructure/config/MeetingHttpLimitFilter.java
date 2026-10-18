package com.pda.auth.infrastructure.config;

import jakarta.servlet.*;
import jakarta.servlet.http.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import org.springframework.web.filter.OncePerRequestFilter;

/** Bounded actual bytes (including chunked requests) and bounded per-IP admission tables. */
final class MeetingHttpLimitFilter extends OncePerRequestFilter {
    private static final int MAX_CLIENTS = 10_000;
    private final Map<String,ArrayDeque<Long>> requests = new HashMap<>();
    @Override protected boolean shouldNotFilter(HttpServletRequest request) {
        String path=path(request);
        return !path.startsWith("/api/v1/meetings/guest/") && !path.equals("/api/v1/meetings/media/webhook")
                && !projectMeeting(path);
    }
    @Override protected void doFilterInternal(HttpServletRequest request,HttpServletResponse response,FilterChain chain)
            throws IOException,ServletException {
        String path=path(request);
        boolean webhook=path.equals("/api/v1/meetings/media/webhook");
        boolean project=projectMeeting(path);
        if(!webhook && !project && !allow(request.getRemoteAddr(),path.endsWith("/guest/session"))) {
            refuse(response,429,"MEETING_RATE_LIMITED");response.setHeader("Retry-After","60");return;
        }
        if(!Set.of("POST","PUT","PATCH").contains(request.getMethod())) {chain.doFilter(request,response);return;}
        int limit=project?196_608:webhook?65_536:path.endsWith("/guest/session")?2_048:16_384;
        if(request.getContentLengthLong()>limit) {refuse(response,413,"MEETING_BODY_TOO_LARGE");return;}
        byte[] body=request.getInputStream().readNBytes(limit+1);
        if(body.length>limit) {refuse(response,413,"MEETING_BODY_TOO_LARGE");return;}
        chain.doFilter(new HttpServletRequestWrapper(request) {
            @Override public ServletInputStream getInputStream() {
                ByteArrayInputStream input=new ByteArrayInputStream(body);
                return new ServletInputStream() {
                    @Override public int read() {return input.read();}
                    @Override public int read(byte[] bytes,int offset,int length) {return input.read(bytes,offset,length);}
                    @Override public boolean isFinished() {return input.available()==0;}
                    @Override public boolean isReady() {return true;}
                    @Override public void setReadListener(ReadListener listener) {throw new UnsupportedOperationException();}
                };
            }
            @Override public BufferedReader getReader() {return new BufferedReader(new InputStreamReader(getInputStream(),StandardCharsets.UTF_8));}
            @Override public int getContentLength() {return body.length;}
            @Override public long getContentLengthLong() {return body.length;}
        },response);
    }
    private boolean projectMeeting(String path) {
        return path.matches("/api/v1/projects/[^/]+/meetings(?:/.*)?");
    }
    private synchronized boolean allow(String address,boolean session) {
        long now=System.currentTimeMillis();
        requests.values().removeIf(q->{while(!q.isEmpty()&&q.peekFirst()<=now-60_000) q.removeFirst();return q.isEmpty();});
        String key=(session?"session:":"guest:")+address;
        ArrayDeque<Long> times=requests.get(key);
        if(times==null) {
            if(requests.size()>=MAX_CLIENTS) return false;
            times=new ArrayDeque<>();requests.put(key,times);
        }
        if(times.size()>=(session?10:120)) return false;
        times.addLast(now);return true;
    }
    private String path(HttpServletRequest request) {return request.getRequestURI().substring(request.getContextPath().length());}
    private void refuse(HttpServletResponse response,int status,String code) throws IOException {
        response.setStatus(status);response.setContentType("application/problem+json");response.setHeader("Cache-Control","no-store");
        response.getWriter().write("{\"type\":\"about:blank\",\"status\":"+status+",\"code\":\""+code+"\"}");
    }
}
