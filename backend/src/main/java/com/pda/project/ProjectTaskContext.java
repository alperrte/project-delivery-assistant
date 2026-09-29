package com.pda.project;

import java.util.UUID;

public record ProjectTaskContext(UUID projectId, String slug, boolean archived) {}
