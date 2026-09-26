package com.pda.user.infrastructure.repository;

import com.pda.user.OAuthProvider;
import com.pda.user.domain.entity.UserOAuthIdentity;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserOAuthIdentityRepository extends JpaRepository<UserOAuthIdentity, UUID> {
    Optional<UserOAuthIdentity> findByProviderAndProviderSubject(OAuthProvider provider, String providerSubject);
    Optional<UserOAuthIdentity> findByUserIdAndProvider(UUID userId, OAuthProvider provider);
    List<UserOAuthIdentity> findByUserIdOrderByCreatedAtAsc(UUID userId);
    long countByUserId(UUID userId);
}
