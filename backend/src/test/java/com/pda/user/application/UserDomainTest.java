package com.pda.user.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.pda.user.domain.entity.User;
import com.pda.user.domain.enums.AccountStatus;
import com.pda.user.domain.enums.EmailVerificationStatus;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

class UserDomainTest {

    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();
    private final Validator validator = Validation.buildDefaultValidatorFactory().getValidator();

    @Test
    void localRegistrationRequiresVerificationAndStoresOnlyBcryptHash() {
        String password = UUID.randomUUID().toString();
        User user = User.registerLocal("Alper@example.test", "Alper_01", password, passwordEncoder);

        assertEquals(AccountStatus.PENDING_VERIFICATION, user.getAccountStatus());
        assertEquals(EmailVerificationStatus.PENDING, user.getEmailVerificationStatus());
        assertTrue(user.matchesPassword(password, passwordEncoder));
        assertFalse(user.matchesPassword(UUID.randomUUID().toString(), passwordEncoder));
        assertTrue(validator.validate(user).isEmpty());

        user.verifyEmail();
        assertEquals(AccountStatus.ACTIVE, user.getAccountStatus());
        assertNotNull(user.getEmailVerifiedAt());
    }

    @Test
    void nicknameAcceptsUnicodeLettersAndRejectsPunctuation() {
        String password = UUID.randomUUID().toString();
        User valid = User.registerLocal("one@example.test", "Çağrı_7", password, passwordEncoder);
        User invalid = User.registerLocal("two@example.test", "name!", password, passwordEncoder);

        assertTrue(validator.validate(valid).isEmpty());
        assertTrue(validator.validate(invalid).stream()
                .anyMatch(violation -> violation.getPropertyPath().toString().equals("nickname")));
    }
}
