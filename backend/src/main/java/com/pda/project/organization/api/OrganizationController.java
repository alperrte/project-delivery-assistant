package com.pda.project.organization.api;

import com.pda.project.api.AuthenticatedActor;
import com.pda.project.api.dto.response.PageResponse;
import com.pda.project.api.dto.response.ProjectResponse;
import com.pda.project.application.service.ProjectService;
import com.pda.project.organization.application.OrganizationService;
import com.pda.user.UserAccounts;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import jakarta.validation.Valid;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.net.URI;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/organizations")
public class OrganizationController {

    private final OrganizationService organizations;
    private final ProjectService projects;

    public OrganizationController(OrganizationService organizations, ProjectService projects) {
        this.organizations = organizations;
        this.projects = projects;
    }

    @PostMapping
    @Operation(summary = "Create an organization", description = "Authenticated user becomes the organization owner. Requires CSRF.")
    @ApiResponse(responseCode = "201", description = "Organization created")
    public ResponseEntity<OrganizationResponse> create(
            @AuthenticationPrincipal UserAccounts.AuthenticatedUser principal,
            @Valid @RequestBody CreateOrganizationRequest request) {
        OrganizationResponse response = OrganizationResponse.from(organizations.create(
                AuthenticatedActor.id(principal), request.name(), request.description(), request.website(), request.contactEmail(), request.location(), request.notes()));
        return ResponseEntity.created(URI.create("/api/v1/organizations/" + response.id())).body(response);
    }

    @GetMapping
    @Operation(summary = "List owned organizations", description = "Only organizations owned by the authenticated user are returned.")
    public PageResponse<OrganizationResponse> list(
            @AuthenticationPrincipal UserAccounts.AuthenticatedUser principal,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return PageResponse.from(organizations.listOwned(AuthenticatedActor.id(principal), pageRequest(page, size)),
                OrganizationResponse::from);
    }

    @GetMapping("/{organizationId}")
    @Operation(summary = "Get an owned organization")
    public OrganizationResponse detail(@AuthenticationPrincipal UserAccounts.AuthenticatedUser principal,
                                       @PathVariable UUID organizationId) {
        return OrganizationResponse.from(organizations.detail(AuthenticatedActor.id(principal), organizationId));
    }

    @GetMapping("/{organizationId}/projects")
    @Operation(summary = "List visible projects in an organization",
            description = "Only projects where the authenticated user has a membership are returned.")
    public PageResponse<ProjectResponse> projects(@AuthenticationPrincipal UserAccounts.AuthenticatedUser principal,
                                                  @PathVariable UUID organizationId,
                                                  @RequestParam(defaultValue = "0") int page,
                                                  @RequestParam(defaultValue = "20") int size) {
        return PageResponse.from(projects.visibleInOrganization(AuthenticatedActor.id(principal),
                organizationId, pageRequest(page, size)), ProjectResponse::from);
    }

    @PutMapping("/{organizationId}")
    @Operation(summary = "Update an owned organization", description = "Owner only. Requires CSRF.")
    public OrganizationResponse update(@AuthenticationPrincipal UserAccounts.AuthenticatedUser principal,
                                       @PathVariable UUID organizationId,
                                       @Valid @RequestBody UpdateOrganizationRequest request) {
        return OrganizationResponse.from(organizations.update(AuthenticatedActor.id(principal),
                organizationId, request.name(), request.description(), request.website(), request.contactEmail(), request.location(), request.notes()));
    }

    @PostMapping("/{organizationId}/archive")
    @Operation(summary = "Archive an owned organization", description = "Owner only. Requires CSRF.")
    @ApiResponse(responseCode = "204", description = "Organization archived")
    public ResponseEntity<Void> archive(@AuthenticationPrincipal UserAccounts.AuthenticatedUser principal,
                                        @PathVariable UUID organizationId) {
        organizations.archive(AuthenticatedActor.id(principal), organizationId);
        return ResponseEntity.noContent().build();
    }

    private static PageRequest pageRequest(int page, int size) {
        if (page < 0 || size < 1 || size > 100) {
            throw new IllegalArgumentException("Invalid pagination");
        }
        return PageRequest.of(page, size, Sort.by("name").ascending());
    }
}
