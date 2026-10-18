package com.pda.meeting;
import java.time.Instant;
/** Only the raw-body signature-verified media webhook adapter may call this port. */
public interface MeetingMediaEvents {
    void accept(String eventId,String eventType,String roomName,String participantIdentity,Instant occurredAt);
}
