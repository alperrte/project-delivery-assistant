package com.pda.project;

import java.util.List;
import java.util.UUID;

/**
 * Public Project module contract for the account-deletion flow: what a user still owns here. A founder of an active
 * project or the owner of an active organization must hand it over or delete it before the account can be deleted.
 */
public interface ProjectOwnership {

    /** Active projects founded by the user and active organizations owned by the user, by name. */
    List<OwnedResource> ownedBy(UUID userId);

    enum Kind { PROJECT, ORGANIZATION }

    record OwnedResource(Kind kind, UUID id, String name, String slug) {}
}
