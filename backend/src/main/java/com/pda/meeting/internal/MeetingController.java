package com.pda.meeting.internal;

import com.pda.user.UserAccounts;
import com.pda.meeting.MeetingException;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.*;
import java.time.Instant;
import java.util.*;
import static com.pda.meeting.internal.MeetingDtos.*;

@RestController @RequestMapping("/api/v1/projects/{projectId}/meetings")
public class MeetingController {
    private final MeetingService service;
    private final MeetingModeration moderation;
    public MeetingController(MeetingService service,MeetingModeration moderation) { this.service=service; this.moderation=moderation; }
    @PostMapping @ResponseStatus(HttpStatus.CREATED)
    public View create(@PathVariable UUID projectId,@AuthenticationPrincipal UserAccounts.AuthenticatedUser actor,@Valid @RequestBody Command command) { return service.create(projectId,actor(actor),command); }
    @GetMapping public PageView<View> list(@PathVariable UUID projectId,@AuthenticationPrincipal UserAccounts.AuthenticatedUser actor,
        @RequestParam(required=false) Meeting.Status status,@RequestParam(required=false) Instant from,@RequestParam(required=false) Instant to,
        @RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size,@RequestParam(defaultValue="startsAt,asc") String sort) { return service.list(projectId,actor(actor),status,from,to,page,size,sort); }
    @GetMapping("/{meetingId}") public View detail(@PathVariable UUID projectId,@PathVariable UUID meetingId,@AuthenticationPrincipal UserAccounts.AuthenticatedUser actor) { return service.detail(projectId,meetingId,actor(actor)); }
    @GetMapping("/calendar") public PageView<View> calendar(@PathVariable UUID projectId,
        @AuthenticationPrincipal UserAccounts.AuthenticatedUser actor,@RequestParam Instant from,@RequestParam Instant to,
        @RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="100") int size) {
        return service.list(projectId,actor(actor),null,from,to,page,size,"startsAt,asc");
    }
    @PutMapping("/{meetingId}") public View update(@PathVariable UUID projectId,@PathVariable UUID meetingId,@AuthenticationPrincipal UserAccounts.AuthenticatedUser actor,@Valid @RequestBody Command command) { return service.update(projectId,meetingId,actor(actor),command); }
    @PostMapping("/{meetingId}/cancel") public View cancel(@PathVariable UUID projectId,@PathVariable UUID meetingId,@AuthenticationPrincipal UserAccounts.AuthenticatedUser actor) { return service.cancel(projectId,meetingId,actor(actor)); }
    @PostMapping("/{meetingId}/start") public View start(@PathVariable UUID projectId,@PathVariable UUID meetingId,@AuthenticationPrincipal UserAccounts.AuthenticatedUser actor) { return service.start(projectId,meetingId,actor(actor)); }
    @PostMapping("/{meetingId}/end") public View end(@PathVariable UUID projectId,@PathVariable UUID meetingId,@AuthenticationPrincipal UserAccounts.AuthenticatedUser actor) { return moderation.end(projectId,meetingId,actor(actor)); }
    @PostMapping("/{meetingId}/join") public Join join(@PathVariable UUID projectId,@PathVariable UUID meetingId,@AuthenticationPrincipal UserAccounts.AuthenticatedUser actor) { return service.join(projectId,meetingId,actor(actor)); }
    @PostMapping("/{meetingId}/leave") @ResponseStatus(HttpStatus.NO_CONTENT) public void leave(@PathVariable UUID projectId,@PathVariable UUID meetingId,@AuthenticationPrincipal UserAccounts.AuthenticatedUser actor) { service.leave(projectId,meetingId,actor(actor)); }
    @GetMapping("/{meetingId}/participants") public List<ParticipantView> participants(@PathVariable UUID projectId,@PathVariable UUID meetingId,@AuthenticationPrincipal UserAccounts.AuthenticatedUser actor) { return service.participants(projectId,meetingId,actor(actor)); }
    @PostMapping("/{meetingId}/participants/{participantId}/mute") @ResponseStatus(HttpStatus.NO_CONTENT)
    public void mute(@PathVariable UUID projectId,@PathVariable UUID meetingId,@PathVariable UUID participantId,@AuthenticationPrincipal UserAccounts.AuthenticatedUser actor) { service.mute(projectId,meetingId,actor(actor),participantId); }
    @PostMapping("/{meetingId}/participants/{participantId}/kick") @ResponseStatus(HttpStatus.NO_CONTENT)
    public void kick(@PathVariable UUID projectId,@PathVariable UUID meetingId,@PathVariable UUID participantId,@AuthenticationPrincipal UserAccounts.AuthenticatedUser actor) { moderation.kick(projectId,meetingId,actor(actor),participantId); }
    @GetMapping("/{meetingId}/invites")
    public ResponseEntity<PageView<InviteMetadata>> invites(@PathVariable UUID projectId,@PathVariable UUID meetingId,@AuthenticationPrincipal UserAccounts.AuthenticatedUser actor,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size) { return ResponseEntity.ok().header(HttpHeaders.CACHE_CONTROL,"private, no-store").body(service.listInvites(projectId,meetingId,actor(actor),page,size)); }
    @PostMapping("/{meetingId}/invites") @ResponseStatus(HttpStatus.CREATED)
    public InviteView invite(@PathVariable UUID projectId,@PathVariable UUID meetingId,@AuthenticationPrincipal UserAccounts.AuthenticatedUser actor,@Valid @RequestBody InviteRequest request) { return service.invite(projectId,meetingId,actor(actor),request); }
    @DeleteMapping("/{meetingId}/invites/{inviteId}") @ResponseStatus(HttpStatus.NO_CONTENT)
    public void revoke(@PathVariable UUID projectId,@PathVariable UUID meetingId,@PathVariable UUID inviteId,@AuthenticationPrincipal UserAccounts.AuthenticatedUser actor) { service.revokeInvite(projectId,meetingId,actor(actor),inviteId); }
    @PostMapping("/{meetingId}/chat") @ResponseStatus(HttpStatus.CREATED)
    public ChatView chat(@PathVariable UUID projectId,@PathVariable UUID meetingId,@AuthenticationPrincipal UserAccounts.AuthenticatedUser actor,@Valid @RequestBody ChatRequest request) { return service.chat(projectId,meetingId,actor(actor),request); }
    @GetMapping("/{meetingId}/chat") public PageView<ChatView> history(@PathVariable UUID projectId,@PathVariable UUID meetingId,@AuthenticationPrincipal UserAccounts.AuthenticatedUser actor,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="50") int size) { return service.history(projectId,meetingId,actor(actor),page,size); }
    private static UUID actor(UserAccounts.AuthenticatedUser actor) { if(actor==null) throw new MeetingException(401,"MEETING_AUTHENTICATION_REQUIRED"); return actor.id(); }
}
