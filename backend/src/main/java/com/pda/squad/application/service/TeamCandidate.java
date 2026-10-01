package com.pda.squad.application.service;

import java.util.UUID;

/** A user found while adding someone to a team, with where they stand relative to the team and project. */
public record TeamCandidate(UUID userId, String nickname, Status status) {

    public enum Status {
        /** Already in this team. */
        TEAM_MEMBER,
        /** In the project but not in this team: can be added directly. */
        PROJECT_MEMBER,
        /** Not in the project, but an invitation is already pending. */
        INVITED,
        /** Not in the project: can be invited into this team. */
        NONE
    }
}
