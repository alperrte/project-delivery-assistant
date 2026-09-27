package com.pda.project.api.dto.response;

import com.pda.user.UserAccounts;

import java.util.UUID;

public record UserSearchResponse(UUID userId, String nickname) {
    public static UserSearchResponse from(UserAccounts.UserSearchResult result) {
        return new UserSearchResponse(result.userId(), result.nickname());
    }
}
