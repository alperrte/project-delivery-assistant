package com.pda.squad.api.dto.request;

import jakarta.validation.constraints.NotNull;

import java.util.UUID;

public record AddSquadMemberRequest(@NotNull UUID userId) {
}
