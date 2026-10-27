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

/**
 * Meetings belong to users, not to projects: every route is global and authorised by ownership or attendance only.
 * A meeting the caller neither organizes nor attends answers 404, exactly like an unknown id.
 */
@RestController @RequestMapping("/api/v1/meetings")
public class MeetingController {
    private final MeetingService service;
    private final MeetingModeration moderation;
    public MeetingController(MeetingService service,MeetingModeration moderation) { this.service=service; this.moderation=moderation; }
    @PostMapping @ResponseStatus(HttpStatus.CREATED)
    public View create(@AuthenticationPrincipal UserAccounts.AuthenticatedUser actor,@Valid @RequestBody Command command) { return service.create(actor(actor),command); }
    @GetMapping public PageView<View> list(@AuthenticationPrincipal UserAccounts.AuthenticatedUser actor,
        @RequestParam(required=false) Meeting.Status status,@RequestParam(required=false) Instant from,@RequestParam(required=false) Instant to,
        @RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size,@RequestParam(defaultValue="startsAt,asc") String sort,
        @RequestParam(defaultValue="EXCLUDE") MeetingService.HiddenMode hidden) { return service.list(actor(actor),status,from,to,page,size,sort,hidden); }
    /** Who the caller may invite: a nickname lookup over active accounts (id, nickname and photo version only), independent of any project. */
    @GetMapping("/attendees/search") public ResponseEntity<List<PersonView>> searchPeople(@AuthenticationPrincipal UserAccounts.AuthenticatedUser actor,@RequestParam("q") String query) {
        return ResponseEntity.ok().header(HttpHeaders.CACHE_CONTROL,"private, no-store").body(service.searchPeople(actor(actor),query));
    }
    /** How many meetings the caller has cleared from their own history (for the restore control). */
    @GetMapping("/history") public HistoryResult historyCount(@AuthenticationPrincipal UserAccounts.AuthenticatedUser actor) { return service.hiddenCount(actor(actor)); }
    /** Clears the caller finished and cancelled meetings from their own list; nobody else list and no meeting data change. */
    @PostMapping("/history/clear") public HistoryResult clearHistory(@AuthenticationPrincipal UserAccounts.AuthenticatedUser actor) { return service.clearHistory(actor(actor)); }
    @PostMapping("/history/restore") public HistoryResult restoreHistory(@AuthenticationPrincipal UserAccounts.AuthenticatedUser actor) { return service.restoreHistory(actor(actor)); }
    @GetMapping("/{meetingId}") public View detail(@PathVariable UUID meetingId,@AuthenticationPrincipal UserAccounts.AuthenticatedUser actor) { return service.detail(meetingId,actor(actor)); }
    @GetMapping("/calendar") public PageView<View> calendar(
        @AuthenticationPrincipal UserAccounts.AuthenticatedUser actor,@RequestParam Instant from,@RequestParam Instant to,
        @RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="100") int size) {
        return service.list(actor(actor),null,from,to,page,size,"startsAt,asc");
    }
    @PutMapping("/{meetingId}") public View update(@PathVariable UUID meetingId,@AuthenticationPrincipal UserAccounts.AuthenticatedUser actor,@Valid @RequestBody Command command) { return service.update(meetingId,actor(actor),command); }
    @PostMapping("/{meetingId}/cancel") public View cancel(@PathVariable UUID meetingId,@AuthenticationPrincipal UserAccounts.AuthenticatedUser actor) { return service.cancel(meetingId,actor(actor)); }
    @PostMapping("/{meetingId}/start") public View start(@PathVariable UUID meetingId,@AuthenticationPrincipal UserAccounts.AuthenticatedUser actor) { return service.start(meetingId,actor(actor)); }
    @PostMapping("/{meetingId}/end") public View end(@PathVariable UUID meetingId,@AuthenticationPrincipal UserAccounts.AuthenticatedUser actor) { return moderation.end(meetingId,actor(actor)); }
    @PostMapping("/{meetingId}/join") public Join join(@PathVariable UUID meetingId,@AuthenticationPrincipal UserAccounts.AuthenticatedUser actor) { return service.join(meetingId,actor(actor)); }
    @PostMapping("/{meetingId}/leave") @ResponseStatus(HttpStatus.NO_CONTENT) public void leave(@PathVariable UUID meetingId,@AuthenticationPrincipal UserAccounts.AuthenticatedUser actor) { service.leave(meetingId,actor(actor)); }
    @GetMapping("/{meetingId}/participants") public List<ParticipantView> participants(@PathVariable UUID meetingId,@AuthenticationPrincipal UserAccounts.AuthenticatedUser actor) { return service.participants(meetingId,actor(actor)); }
    @PostMapping("/{meetingId}/participants/{participantId}/mute") @ResponseStatus(HttpStatus.NO_CONTENT)
    public void mute(@PathVariable UUID meetingId,@PathVariable UUID participantId,@AuthenticationPrincipal UserAccounts.AuthenticatedUser actor) { service.mute(meetingId,actor(actor),participantId); }
    @PostMapping("/{meetingId}/participants/{participantId}/kick") @ResponseStatus(HttpStatus.NO_CONTENT)
    public void kick(@PathVariable UUID meetingId,@PathVariable UUID participantId,@AuthenticationPrincipal UserAccounts.AuthenticatedUser actor) { moderation.kick(meetingId,actor(actor),participantId); }
    @GetMapping("/{meetingId}/invites")
    public ResponseEntity<PageView<InviteMetadata>> invites(@PathVariable UUID meetingId,@AuthenticationPrincipal UserAccounts.AuthenticatedUser actor,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size) { return ResponseEntity.ok().header(HttpHeaders.CACHE_CONTROL,"private, no-store").body(service.listInvites(meetingId,actor(actor),page,size)); }
    @PostMapping("/{meetingId}/invites") @ResponseStatus(HttpStatus.CREATED)
    public InviteView invite(@PathVariable UUID meetingId,@AuthenticationPrincipal UserAccounts.AuthenticatedUser actor,@Valid @RequestBody InviteRequest request) { return service.invite(meetingId,actor(actor),request); }
    @DeleteMapping("/{meetingId}/invites/{inviteId}") @ResponseStatus(HttpStatus.NO_CONTENT)
    public void revoke(@PathVariable UUID meetingId,@PathVariable UUID inviteId,@AuthenticationPrincipal UserAccounts.AuthenticatedUser actor) { service.revokeInvite(meetingId,actor(actor),inviteId); }
    @PostMapping("/{meetingId}/chat") @ResponseStatus(HttpStatus.CREATED)
    public ChatView chat(@PathVariable UUID meetingId,@AuthenticationPrincipal UserAccounts.AuthenticatedUser actor,@Valid @RequestBody ChatRequest request) { return service.chat(meetingId,actor(actor),request); }
    @GetMapping("/{meetingId}/chat") public PageView<ChatView> history(@PathVariable UUID meetingId,@AuthenticationPrincipal UserAccounts.AuthenticatedUser actor,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="50") int size) { return service.history(meetingId,actor(actor),page,size); }
    @GetMapping("/{meetingId}/chat/{messageId}") public ChatView message(@PathVariable UUID meetingId,@PathVariable UUID messageId,@AuthenticationPrincipal UserAccounts.AuthenticatedUser actor) { return service.message(meetingId,actor(actor),messageId); }
    @GetMapping("/{meetingId}/chat/{messageId}/page") public ChatLocation locate(@PathVariable UUID meetingId,@PathVariable UUID messageId,@AuthenticationPrincipal UserAccounts.AuthenticatedUser actor,@RequestParam(defaultValue="50") int size) { return service.locate(meetingId,actor(actor),messageId,size); }
    @PutMapping("/{meetingId}/chat/{messageId}/reactions") public ChatView react(@PathVariable UUID meetingId,@PathVariable UUID messageId,@AuthenticationPrincipal UserAccounts.AuthenticatedUser actor,@Valid @RequestBody ReactionRequest request) { return service.react(meetingId,actor(actor),messageId,request.emoji()); }
    @DeleteMapping("/{meetingId}/chat/{messageId}/reactions") public ChatView unreact(@PathVariable UUID meetingId,@PathVariable UUID messageId,@AuthenticationPrincipal UserAccounts.AuthenticatedUser actor,@RequestParam String emoji) { return service.unreact(meetingId,actor(actor),messageId,emoji); }
    private static UUID actor(UserAccounts.AuthenticatedUser actor) { if(actor==null) throw new MeetingException(401,"MEETING_AUTHENTICATION_REQUIRED"); return actor.id(); }
}
