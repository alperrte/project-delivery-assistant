package com.pda.user;

import java.util.UUID;

/**
 * Published inside the transaction that anonymises an account, after the user module has wiped its own data. Modules
 * that keep scalar (non-foreign-key) references to the user clean them up synchronously in that same transaction.
 */
public record UserAccountDeletedEvent(UUID userId) {}
