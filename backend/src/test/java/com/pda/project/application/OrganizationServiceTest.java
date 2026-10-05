package com.pda.project.application;

import com.pda.project.organization.application.OrganizationService;
import com.pda.project.organization.domain.Organization;
import com.pda.project.organization.infrastructure.OrganizationRepository;
import org.junit.jupiter.api.Test;
import org.springframework.security.access.AccessDeniedException;

import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class OrganizationServiceTest {

    private final OrganizationRepository organizations = mock(OrganizationRepository.class);
    private final OrganizationService service = new OrganizationService(organizations);

    @Test
    void createAssignsAuthenticatedActorAsOwner() {
        UUID actorId = UUID.randomUUID();
        when(organizations.saveAndFlush(any(Organization.class))).thenAnswer(invocation -> invocation.getArgument(0));

        Organization created = service.create(actorId, "PDA Team", null);

        assertEquals(actorId, created.getOwnerUserId());
        verify(organizations).saveAndFlush(created);
    }

    @Test
    void anotherUserCannotUpdateOrganization() {
        UUID ownerId = UUID.randomUUID();
        UUID organizationId = UUID.randomUUID();
        Organization organization = Organization.create("PDA", "pda", null, ownerId);
        when(organizations.lockActive(organizationId)).thenReturn(Optional.of(organization));

        assertThrows(AccessDeniedException.class, () ->
                service.update(UUID.randomUUID(), organizationId, "Changed", null));
        assertEquals("PDA", organization.getName());
    }
}
