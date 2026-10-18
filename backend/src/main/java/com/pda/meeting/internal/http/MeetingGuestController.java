package com.pda.meeting.internal.http;

import com.pda.meeting.MeetingException;
import com.pda.meeting.internal.MeetingService;
import com.pda.meeting.internal.MeetingDtos.*;
import jakarta.servlet.http.*;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import java.time.*;
import java.util.*;

/** Guest capability stays in a meeting-scoped cookie, never a PDA authentication principal. */
@RestController
@RequestMapping("/api/v1/meetings/guest")
public class MeetingGuestController {
    public static final String COOKIE = "PDA_MEETING_GUEST";
    private final MeetingService service;
    private final boolean production;
    public MeetingGuestController(MeetingService service,@Value("${APP_ENV:dev}") String appEnv) {
        this.service=service; this.production="prod".equalsIgnoreCase(appEnv)||"production".equalsIgnoreCase(appEnv);
    }
    public record SessionView(UUID meetingId,UUID participantId,Instant expiresAt) {}
    @PostMapping("/preview")
    public GuestView preview(@Valid @RequestBody PreviewRequest body,HttpServletResponse response) {
        noStore(response); return service.guestPreview(body);
    }
    @GetMapping("/{meetingId}/state")
    public GuestView state(@PathVariable UUID meetingId,HttpServletRequest request,HttpServletResponse response) {
        noStore(response); return service.guestState(meetingId,secret(request));
    }
    @PostMapping("/session") @ResponseStatus(HttpStatus.CREATED)
    public SessionView session(@Valid @RequestBody GuestRequest body,HttpServletRequest request,HttpServletResponse response) {
        GuestSession session=service.guestSession(body);
        writeCookie(session.meetingId(),session.secret(),Duration.between(Instant.now(),session.expiresAt()),request,response);
        return new SessionView(session.meetingId(),session.participantId(),session.expiresAt());
    }
    @PostMapping("/{meetingId}/join")
    public Join join(@PathVariable UUID meetingId,HttpServletRequest request,HttpServletResponse response) {
        noStore(response);return service.guestJoin(meetingId,secret(request));
    }
    @GetMapping("/{meetingId}/participants")
    public List<ParticipantView> participants(@PathVariable UUID meetingId,HttpServletRequest request,HttpServletResponse response) {
        noStore(response);return service.guestParticipants(meetingId,secret(request));
    }
    @GetMapping("/{meetingId}/chat")
    public PageView<ChatView> history(@PathVariable UUID meetingId,@RequestParam(defaultValue="0") int page,
                                    @RequestParam(defaultValue="50") int size,HttpServletRequest request,HttpServletResponse response) {
        noStore(response);return service.guestHistory(meetingId,secret(request),page,size);
    }
    @PostMapping("/{meetingId}/chat") @ResponseStatus(HttpStatus.CREATED)
    public ChatView chat(@PathVariable UUID meetingId,@Valid @RequestBody ChatRequest body,HttpServletRequest request,HttpServletResponse response) {
        noStore(response);return service.guestChat(meetingId,secret(request),body);
    }
    @PostMapping("/{meetingId}/leave") @ResponseStatus(HttpStatus.NO_CONTENT)
    public void leave(@PathVariable UUID meetingId,HttpServletRequest request,HttpServletResponse response) {
        service.guestLeave(meetingId,secret(request));writeCookie(meetingId,"",Duration.ZERO,request,response);
    }
    private String secret(HttpServletRequest request) {
        if(request.getCookies()==null) throw new MeetingException(401,"MEETING_GUEST_REQUIRED");
        var values=Arrays.stream(request.getCookies()).filter(c->COOKIE.equals(c.getName())).toList();
        if(values.size()!=1||values.getFirst().getValue().length()>100) throw new MeetingException(401,"MEETING_GUEST_REQUIRED");
        return values.getFirst().getValue();
    }
    private void writeCookie(UUID meeting,String secret,Duration age,HttpServletRequest request,HttpServletResponse response) {
        response.addHeader(HttpHeaders.SET_COOKIE,ResponseCookie.from(COOKIE,secret).httpOnly(true)
                .secure(production||request.isSecure()).sameSite("Lax").path("/api/v1/meetings/guest/"+meeting)
                .maxAge(age.isNegative()?Duration.ZERO:age).build().toString());noStore(response);
    }
    private void noStore(HttpServletResponse response) { response.setHeader(HttpHeaders.CACHE_CONTROL,"private, no-store"); }
}
