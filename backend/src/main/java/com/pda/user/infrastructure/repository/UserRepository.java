package com.pda.user.infrastructure.repository;

import com.pda.user.GlobalRole;
import com.pda.user.domain.entity.User;
import com.pda.user.domain.enums.AccountStatus;
import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

public interface UserRepository extends JpaRepository<User, UUID> {
    Optional<User> findByEmail(String email);
    boolean existsByEmail(String email);
    boolean existsByEmailIgnoreCase(String email);
    boolean existsByNickname(String nickname);
    boolean existsByGlobalRole(GlobalRole globalRole);
    long countByAccountStatus(AccountStatus accountStatus);
    long countByGlobalRole(GlobalRole globalRole);

    /** Locks every active administrator row so concurrent demotions cannot remove the last one. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select u from User u where u.globalRole = com.pda.user.GlobalRole.ADMIN "
            + "and u.accountStatus = com.pda.user.domain.enums.AccountStatus.ACTIVE")
    List<User> lockActiveAdmins();
}
