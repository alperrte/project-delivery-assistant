package com.pda.meeting.internal;

import jakarta.validation.constraints.*;
import java.time.Instant;
import java.util.*;
import com.pda.meeting.MeetingMediaPort;
import io.swagger.v3.oas.annotations.media.Schema;

public final class MeetingDtos {
    private MeetingDtos() {}
    @Schema(name="MeetingCommand") public record Command(@NotBlank @Size(max=160) String title,@Size(max=4000) String description,
        @NotNull Instant startsAt,@NotNull Instant endsAt,@NotBlank @Size(max=80) String zoneId,
        @NotNull @Size(max=30) List<@NotBlank @Size(max=1000) String> agenda,
        @NotNull @Size(max=100) Set<@NotNull UUID> attendeeIds,
        /** Optional: null keeps the current icon (video for a new meeting). Must be one of the allowlisted icon names. */
        @Size(max=24) String icon,
        /** Optional: true makes the SERVER clock the start time of a new meeting, so a slow client clock cannot be refused as "in the past". */
        Boolean startNow) {
        public Command(String title,String description,Instant startsAt,Instant endsAt,String zoneId,List<String> agenda,Set<UUID> attendeeIds) { this(title,description,startsAt,endsAt,zoneId,agenda,attendeeIds,null,null); }
        Command withStartsAt(Instant start) { return new Command(title,description,start,endsAt,zoneId,agenda,attendeeIds,icon,null); }
    }
    @Schema(name="MeetingView") public record View(UUID id,UUID projectId,UUID organizerId,String title,String description,
        Instant startsAt,Instant endsAt,String zoneId,Meeting.Status status,Instant openedAt,Instant endedAt,
        boolean overtime,boolean chatRetained,long version,List<String> agenda,Set<UUID> attendeeIds,int roomEpoch,boolean reconnectRequired,boolean cleanupPending,
        String icon,boolean hidden) {}
    @Schema(name="MeetingHistoryResult") public record HistoryResult(long count) {}
    @Schema(name="MeetingParticipantView") public record ParticipantView(UUID id,String identity,String displayName,boolean guest,boolean connected,boolean revoked,
        Instant joinedAt,Instant leftAt,UUID userId,Long profilePhotoVersion) {}
    @Schema(name="MeetingJoin") public record Join(UUID participantId,String identity,MeetingMediaPort.MediaJoin media,boolean chatRetained,int roomEpoch,String status) {}
    public record InviteRequest(@NotNull Instant expiresAt,@Min(1) @Max(100) int maxUses) {}
    public record InviteView(UUID id,String token,Instant expiresAt,int maxUses) {}
    @Schema(name="MeetingInviteMetadata") public record InviteMetadata(UUID id,Instant expiresAt,int maxUses,int uses,boolean revoked) {}
    public record GuestRequest(@NotBlank @Size(max=100) String inviteToken,@NotBlank @Size(max=80) String displayName) {}
    public record PreviewRequest(@NotBlank @Size(max=100) String inviteToken) {}
    @Schema(name="MeetingGuestView") public record GuestView(UUID id,String title,Instant startsAt,Instant endsAt,
        String zoneId,Meeting.Status status,Instant openedAt,boolean overtime,boolean chatRetained,
        List<String> agenda,int roomEpoch,boolean reconnectRequired) {}
    public record GuestSession(UUID meetingId,UUID participantId,String secret,Instant expiresAt) {}
    public record ChatRequest(@NotBlank @Size(max=2000) String content,@NotNull @Size(max=20) Set<@NotNull UUID> mentionIds) {}
    @Schema(name="MeetingChatView") public record ChatView(UUID id,UUID participantId,String displayName,String content,Instant sentAt,Set<UUID> mentionIds) {}
    public record PageView<T>(List<T> content,int page,int size,long totalElements,int totalPages) {
        public static <T> PageView<T> of(org.springframework.data.domain.Page<T> p) { return new PageView<>(p.getContent(),p.getNumber(),p.getSize(),p.getTotalElements(),p.getTotalPages()); }
    }
}
