package com.pda.meeting;
public class MeetingException extends RuntimeException {
    private final int status;
    private final String code;
    public MeetingException(int status,String code) { super(code); this.status=status; this.code=code; }
    public int status() { return status; }
    public String code() { return code; }
}
