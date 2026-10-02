package com.pda.user.infrastructure.repository;

import com.pda.user.domain.entity.UserPreference;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface UserPreferenceRepository extends JpaRepository<UserPreference, UUID> {
}
