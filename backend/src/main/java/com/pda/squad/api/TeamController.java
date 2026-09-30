package com.pda.squad.api;

import com.pda.squad.application.service.SquadService;
import com.pda.squad.api.dto.response.PageResponse;
import com.pda.squad.api.dto.response.SquadMemberResponse;
import com.pda.squad.domain.entity.Squad;
import com.pda.user.UserAccounts;
import io.swagger.v3.oas.annotations.Operation;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/projects/{projectId}/teams")
public class TeamController {
    private final SquadService teams;
    public TeamController(SquadService teams) { this.teams = teams; }

    @GetMapping
    @Operation(summary = "List project teams including General Team", description = "PROJECT_VIEW; paginated")
    public PageResponse<TeamResponse> list(@AuthenticationPrincipal UserAccounts.AuthenticatedUser principal,
                                           @PathVariable UUID projectId,
                                           @RequestParam(defaultValue = "0") int page,
                                           @RequestParam(defaultValue = "20") int size) {
        UUID actor = actor(principal);
        Page<Squad> result = teams.listTeams(actor, projectId, page(page, size));
        Map<UUID, Long> counts = teams.memberCounts(actor, projectId, result.getContent());
        return PageResponse.from(result, team -> TeamResponse.from(team, counts.getOrDefault(team.getId(), 0L)));
    }

    @GetMapping("/{teamId}")
    @Operation(summary = "Get project team", description = "PROJECT_VIEW")
    public TeamResponse detail(@AuthenticationPrincipal UserAccounts.AuthenticatedUser principal,
                               @PathVariable UUID projectId, @PathVariable UUID teamId) {
        UUID actor = actor(principal);
        Squad team = teams.detail(actor, projectId, teamId);
        return TeamResponse.from(team, teams.memberCounts(actor, projectId, List.of(team))
                .getOrDefault(teamId, 0L));
    }

    @PostMapping
    @Operation(summary = "Create a project team", description = "SQUAD_MANAGE; parent defaults to General Team; CSRF")
    public ResponseEntity<TeamResponse> create(@AuthenticationPrincipal UserAccounts.AuthenticatedUser principal,
                                                @PathVariable UUID projectId, @Valid @RequestBody TeamRequest request) {
        Squad team = teams.create(actor(principal), projectId, request.name(), request.description(),
                request.parentTeamId());
        return ResponseEntity.status(201).body(TeamResponse.from(team, 0));
    }

    @PutMapping("/{teamId}")
    @Operation(summary = "Rename a project team", description = "SQUAD_MANAGE; CSRF")
    public TeamResponse update(@AuthenticationPrincipal UserAccounts.AuthenticatedUser principal,
                               @PathVariable UUID projectId, @PathVariable UUID teamId,
                               @Valid @RequestBody TeamRequest request) {
        Squad team = teams.update(actor(principal), projectId, teamId, request.name(), request.description());
        return TeamResponse.from(team, teams.memberCounts(actor(principal), projectId, List.of(team)).getOrDefault(teamId, 0L));
    }

    @PutMapping("/{teamId}/parent")
    @Operation(summary = "Move a project team", description = "SQUAD_MANAGE; no cycles; CSRF")
    public TeamResponse move(@AuthenticationPrincipal UserAccounts.AuthenticatedUser principal,
                             @PathVariable UUID projectId, @PathVariable UUID teamId,
                             @Valid @RequestBody MoveRequest request) {
        Squad team = teams.move(actor(principal), projectId, teamId, request.parentTeamId());
        return TeamResponse.from(team, teams.memberCounts(actor(principal), projectId, List.of(team)).getOrDefault(teamId, 0L));
    }

    @DeleteMapping("/{teamId}")
    @Operation(summary = "Archive a project team", description = "SQUAD_MANAGE; child teams must move first; CSRF")
    public ResponseEntity<Void> delete(@AuthenticationPrincipal UserAccounts.AuthenticatedUser principal,
                                       @PathVariable UUID projectId, @PathVariable UUID teamId) {
        teams.archive(actor(principal), projectId, teamId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{teamId}/members")
    @Operation(summary = "List team members", description = "PROJECT_VIEW; General Team reflects all active project members")
    public PageResponse<SquadMemberResponse> members(@AuthenticationPrincipal UserAccounts.AuthenticatedUser principal,
                                                      @PathVariable UUID projectId, @PathVariable UUID teamId,
                                                      @RequestParam(defaultValue = "0") int page,
                                                      @RequestParam(defaultValue = "20") int size) {
        return PageResponse.from(teams.listMembers(actor(principal), projectId, teamId, memberPage(page, size)),
                SquadMemberResponse::from);
    }

    @PostMapping("/{teamId}/members")
    @Operation(summary = "Add an active project member to a custom team", description = "SQUAD_MANAGE; CSRF")
    public ResponseEntity<SquadMemberResponse> addMember(@AuthenticationPrincipal UserAccounts.AuthenticatedUser principal,
                                                          @PathVariable UUID projectId, @PathVariable UUID teamId,
                                                          @Valid @RequestBody MemberRequest request) {
        return ResponseEntity.status(201).body(SquadMemberResponse.from(
                teams.addMember(actor(principal), projectId, teamId, request.userId())));
    }

    @DeleteMapping("/{teamId}/members/{userId}")
    @Operation(summary = "Remove member from custom team only", description = "SQUAD_MANAGE; project membership stays; CSRF")
    public ResponseEntity<Void> removeMember(@AuthenticationPrincipal UserAccounts.AuthenticatedUser principal,
                                             @PathVariable UUID projectId, @PathVariable UUID teamId,
                                             @PathVariable UUID userId) {
        teams.removeMember(actor(principal), projectId, teamId, userId);
        return ResponseEntity.noContent().build();
    }

    private static PageRequest page(int page, int size) {
        if (page < 0 || size < 1 || size > 100) throw new IllegalArgumentException("Invalid pagination");
        return PageRequest.of(page, size, Sort.by("createdAt").ascending());
    }
    private static PageRequest memberPage(int page, int size) {
        if (page < 0 || size < 1 || size > 100) throw new IllegalArgumentException("Invalid pagination");
        return PageRequest.of(page, size, Sort.by("addedAt").ascending());
    }
    private static UUID actor(UserAccounts.AuthenticatedUser principal) {
        if (principal == null || principal.id() == null) throw new AccessDeniedException("Authentication required");
        return principal.id();
    }
    public record TeamRequest(@NotBlank @Size(max = 120) String name,
                              @Size(max = 2000) String description, UUID parentTeamId) {}
    public record MoveRequest(@NotNull UUID parentTeamId) {}
    public record MemberRequest(@NotNull UUID userId) {}
    public record TeamResponse(UUID id, UUID projectId, String name, String description, UUID parentTeamId,
                               boolean general, long memberCount, UUID createdBy, Instant createdAt, Instant updatedAt) {
        static TeamResponse from(Squad team, long count) {
            return new TeamResponse(team.getId(), team.getProjectId(), team.getName(), team.getDescription(),
                    team.getParentSquadId(), team.isGeneral(), count, team.getCreatedBy(), team.getCreatedAt(), team.getUpdatedAt());
        }
    }
}
