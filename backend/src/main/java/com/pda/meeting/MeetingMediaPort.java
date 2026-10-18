package com.pda.meeting;

import java.time.Duration;
import java.time.Instant;
import java.util.List;

/** Server-owned media operations. Participant tokens never grant room administration or data publication. */
public interface MeetingMediaPort {
    void createRoom(String roomName, int maxParticipants);
    MediaJoin issueToken(String roomName, String identity, String displayName, Duration ttl);
    void deleteRoom(String roomName);
    void removeParticipant(String roomName, String identity);
    void muteParticipant(String roomName, String identity);
    void sendData(String roomName, byte[] payload);
    List<MediaParticipant> listParticipants(String roomName);
    boolean roomExists(String roomName);
    record MediaJoin(String url, String token, Instant expiresAt) {}
    record MediaParticipant(String identity, String displayName) {}
}
