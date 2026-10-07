package com.pda.squad.api;

import com.pda.squad.application.service.SquadService;
import com.pda.squad.application.service.TeamCandidate;
import com.pda.squad.application.service.TeamView;
import com.pda.squad.api.dto.response.PageResponse;
import com.pda.squad.api.dto.response.SquadMemberResponse;
import com.pda.squad.domain.entity.Squad;
import com.pda.user.UserAccounts;
import io.swagger.v3.oas.annotations.Operation;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/projects/{projectId}/teams")
public class TeamController {
    private final SquadService teams;
    public TeamController(SquadService teams) { this.teams = teams; }

    @GetMapping
    @Operation(summary = "List project teams", description = "PROJECT_VIEW; paginated; cards carry member preview and last update")
    public PageResponse<TeamResponse> list(@AuthenticationPrincipal UserAccounts.AuthenticatedUser principal,
                                           @PathVariable UUID projectId,
                                           @RequestParam(defaultValue = "0") int page,
                                           @RequestParam(defaultValue = "20") int size) {
        return PageResponse.from(teams.listTeams(actor(principal), projectId, page(page, size)), TeamResponse::from);
    }

    @GetMapping("/{teamId}")
    @Operation(summary = "Get project team", description = "PROJECT_VIEW")
    public TeamResponse detail(@AuthenticationPrincipal UserAccounts.AuthenticatedUser principal,
                               @PathVariable UUID projectId, @PathVariable UUID teamId) {
        return TeamResponse.from(teams.detail(actor(principal), projectId, teamId));
    }

    @PostMapping
    @Operation(summary = "Create a project team",
            description = "SQUAD_MANAGE; the first team always includes its creator; CSRF")
    public ResponseEntity<TeamResponse> create(@AuthenticationPrincipal UserAccounts.AuthenticatedUser principal,
                                                @PathVariable UUID projectId, @Valid @RequestBody TeamRequest request) {
        UUID actor = actor(principal);
        Squad team = teams.create(actor, projectId, request.name(), request.description(), request.parentTeamId(),
                request.includeCreator() == null || request.includeCreator());
        return ResponseEntity.status(201).body(TeamResponse.from(teams.detail(actor, projectId, team.getId())));
    }

    @PutMapping("/{teamId}")
    @Operation(summary = "Update a project team's name and description", description = "SQUAD_MANAGE; CSRF")
    public TeamResponse update(@AuthenticationPrincipal UserAccounts.AuthenticatedUser principal,
                               @PathVariable UUID projectId, @PathVariable UUID teamId,
                               @Valid @RequestBody TeamRequest request) {
        return TeamResponse.from(teams.update(actor(principal), projectId, teamId, request.name(),
                request.description()));
    }

    @PutMapping("/{teamId}/parent")
    @Operation(summary = "Move a project team", description = "SQUAD_MANAGE; null parent means top level; no cycles; CSRF")
    public TeamResponse move(@AuthenticationPrincipal UserAccounts.AuthenticatedUser principal,
                             @PathVariable UUID projectId, @PathVariable UUID teamId,
                             @Valid @RequestBody MoveRequest request) {
        return TeamResponse.from(teams.move(actor(principal), projectId, teamId, request.parentTeamId()));
    }

    @DeleteMapping("/{teamId}")
    @Operation(summary = "Delete a project team",
            description = "SQUAD_MANAGE; child teams must move first; refused when it would leave a member without a team; CSRF")
    public ResponseEntity<Void> delete(@AuthenticationPrincipal UserAccounts.AuthenticatedUser principal,
                                       @PathVariable UUID projectId, @PathVariable UUID teamId) {
        teams.deleteTeam(actor(principal), projectId, teamId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{teamId}/candidates")
    @Operation(summary = "Search people to add to a team",
            description = "SQUAD_MANAGE; at least 2 characters, at most 20 results; status says whether to add or invite")
    public List<CandidateResponse> candidates(@AuthenticationPrincipal UserAccounts.AuthenticatedUser principal,
                                              @PathVariable UUID projectId, @PathVariable UUID teamId,
                                              @RequestParam(defaultValue = "") String q) {
        return teams.candidates(actor(principal), projectId, teamId, q).stream()
                .map(candidate -> new CandidateResponse(candidate.userId(), candidate.nickname(), candidate.status()))
                .toList();
    }

    @GetMapping("/{teamId}/members")
    @Operation(summary = "List team members", description = "PROJECT_VIEW; each row lists the member's other teams")
    public PageResponse<SquadMemberResponse> members(@AuthenticationPrincipal UserAccounts.AuthenticatedUser principal,
                                                      @PathVariable UUID projectId, @PathVariable UUID teamId,
                                                      @RequestParam(defaultValue = "0") int page,
                                                      @RequestParam(defaultValue = "20") int size) {
        return PageResponse.from(teams.listMembers(actor(principal), projectId, teamId, memberPage(page, size)),
                SquadMemberResponse::from);
    }

    @PostMapping("/{teamId}/members")
    @Operation(summary = "Add an active project member to a team", description = "SQUAD_MANAGE; CSRF")
    public ResponseEntity<SquadMemberResponse> addMember(@AuthenticationPrincipal UserAccounts.AuthenticatedUser principal,
                                                          @PathVariable UUID projectId, @PathVariable UUID teamId,
                                                          @Valid @RequestBody MemberRequest request) {
        return ResponseEntity.status(201).body(SquadMemberResponse.from(
                teams.addMember(actor(principal), projectId, teamId, request.userId())));
    }

    @DeleteMapping("/{teamId}/members/{userId}")
    @Operation(summary = "Remove member from a team only",
            description = "SQUAD_MANAGE; refused for the member's last team; project membership stays; CSRF")
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
    public record TeamRequest(@NotBlank @Size(max = 120) String name, @Size(max = 2000) String description,
                              UUID parentTeamId, Boolean includeCreator) {}
    public record MoveRequest(UUID parentTeamId) {}
    public record MemberRequest(@NotNull UUID userId) {}
    public record CandidateResponse(UUID userId, String nickname, TeamCandidate.Status status) {}
    public record UserRefResponse(UUID userId, String nickname, Long profilePhotoVersion) {}
    public record MemberPreviewResponse(UUID userId, String nickname, Long profilePhotoVersion, String firstName, String lastName) {}
    public record LastJoinedResponse(UUID userId, String nickname, Instant joinedAt) {}
    public record TeamResponse(UUID id, UUID projectId, String name, String description, UUID parentTeamId,
                               long memberCount, UUID createdBy, Instant createdAt, Instant updatedAt,
                               UserRefResponse updatedBy, List<MemberPreviewResponse> memberPreview,
                               LastJoinedResponse lastJoined) {
        static TeamResponse from(TeamView view) {
            Squad team = view.team();
            return new TeamResponse(team.getId(), team.getProjectId(), team.getName(), team.getDescription(),
                    team.getParentSquadId(), view.memberCount(), team.getCreatedBy(), team.getCreatedAt(),
                    team.getUpdatedAt(), new UserRefResponse(view.updatedBy().userId(), view.updatedBy().nickname(),
                            view.updatedBy().profilePhotoVersion()),
                    view.memberPreview().stream()
                            .map(user -> new MemberPreviewResponse(user.userId(), user.nickname(), user.profilePhotoVersion(), user.firstName(), user.lastName())).toList(),
                    view.lastJoined() == null ? null : new LastJoinedResponse(view.lastJoined().userId(),
                            view.lastJoined().nickname(), view.lastJoined().joinedAt()));
        }
    }
}
