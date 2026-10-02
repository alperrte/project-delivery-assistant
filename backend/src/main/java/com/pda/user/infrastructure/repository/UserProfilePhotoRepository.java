package com.pda.user.infrastructure.repository;

import com.pda.user.domain.entity.UserProfilePhoto;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface UserProfilePhotoRepository extends JpaRepository<UserProfilePhoto, UUID> {
}
