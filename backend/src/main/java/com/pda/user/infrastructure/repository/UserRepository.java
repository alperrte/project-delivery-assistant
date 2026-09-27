package com.pda.user.infrastructure.repository;

import com.pda.user.domain.entity.User;
import com.pda.user.domain.enums.AccountStatus;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserRepository extends JpaRepository<User, UUID> {
    Optional<User> findByEmail(String email);
    boolean existsByEmail(String email);
    boolean existsByEmailIgnoreCase(String email);
    boolean existsByNickname(String nickname);
    Optional<User> findByEmailAndAccountStatus(String email, AccountStatus accountStatus);
    List<User> findByAccountStatusAndNicknameContainingIgnoreCase(AccountStatus accountStatus, String nickname,
                                                                   Pageable pageable);
}
