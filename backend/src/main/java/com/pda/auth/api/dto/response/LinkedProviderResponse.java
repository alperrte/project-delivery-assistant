package com.pda.auth.api.dto.response;

import java.time.Instant;

public record LinkedProviderResponse(String provider, String email, Instant linkedAt) {}
