package com.pda.chat.domain.enums;

import com.pda.chat.domain.ChatException;

public enum ChatReactionCode {
    THUMBS_UP("👍"), HEART("❤️"), LAUGH("😂"), SURPRISED("😮"), SAD("😢"), THANKS("🙏");

    private final String emoji;
    ChatReactionCode(String emoji) { this.emoji = emoji; }
    public String emoji() { return emoji; }

    public static ChatReactionCode parse(String value) {
        try { return valueOf(value); }
        catch (IllegalArgumentException | NullPointerException invalid) {
            throw ChatException.invalid("CHAT_REACTION_INVALID");
        }
    }
}
