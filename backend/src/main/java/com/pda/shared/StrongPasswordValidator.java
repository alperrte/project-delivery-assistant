package com.pda.shared;

import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;

public class StrongPasswordValidator implements ConstraintValidator<StrongPassword, String> {

    static final int MIN_LENGTH = 8;
    static final int MAX_LENGTH = 128;

    @Override
    public boolean isValid(String value, ConstraintValidatorContext context) {
        if (value == null || value.isBlank()) {
            return true;
        }
        if (value.length() < MIN_LENGTH || value.length() > MAX_LENGTH) {
            return false;
        }
        boolean upper = false;
        boolean digit = false;
        boolean special = false;
        for (int i = 0; i < value.length(); ) {
            int cp = value.codePointAt(i);
            i += Character.charCount(cp);
            if (Character.isUpperCase(cp)) {
                upper = true;
            } else if (Character.isDigit(cp)) {
                digit = true;
            } else if (!Character.isLetter(cp) && !Character.isWhitespace(cp)) {
                special = true;
            }
        }
        return upper && digit && special;
    }
}
