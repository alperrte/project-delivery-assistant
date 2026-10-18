package com.pda.meeting.internal.http;
import com.pda.meeting.MeetingMediaEvents;
import com.pda.meeting.media.LiveKitWebhookVerifier;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
@RestController
public class MeetingMediaWebhookController {
    private final LiveKitWebhookVerifier verifier;
    private final MeetingMediaEvents events;
    public MeetingMediaWebhookController(LiveKitWebhookVerifier verifier,MeetingMediaEvents events) {this.verifier=verifier;this.events=events;}
    @PostMapping(value="/api/v1/meetings/media/webhook")
    public ResponseEntity<Void> webhook(@RequestBody byte[] raw,@RequestHeader(value="Authorization",required=false) String authorization) {
        var event=verifier.verify(raw,authorization);
        events.accept(event.id(),event.event(),event.roomName(),event.identity(),event.createdAt());
        return ResponseEntity.noContent().cacheControl(CacheControl.noStore()).build();
    }
}
