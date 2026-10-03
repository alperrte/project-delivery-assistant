package com.pda.chat.domain;

import java.util.Objects;

/**
 * A chat rule violation. {@link #kind()} picks the HTTP status and {@link #code()} is the stable property the frontend
 * translates; the message never reaches a client.
 */
public class ChatException extends RuntimeException {

    public enum Kind { INVALID, FORBIDDEN, NOT_FOUND, RATE_LIMITED }

    private final Kind kind;
    private final String code;

    public ChatException(Kind kind, String code) {
        super(code);
        this.kind = Objects.requireNonNull(kind);
        this.code = Objects.requireNonNull(code);
    }

    public static ChatException invalid(String code) {
        return new ChatException(Kind.INVALID, code);
    }

    public static ChatException forbidden() {
        return new ChatException(Kind.FORBIDDEN, "CHAT_FORBIDDEN");
    }

    public static ChatException notFound(String code) {
        return new ChatException(Kind.NOT_FOUND, code);
    }

    public static ChatException rateLimited() {
        return new ChatException(Kind.RATE_LIMITED, "CHAT_RATE_LIMITED");
    }

    public Kind kind() {
        return kind;
    }

    public String code() {
        return code;
    }
}
