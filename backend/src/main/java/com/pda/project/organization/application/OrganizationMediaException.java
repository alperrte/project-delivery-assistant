package com.pda.project.organization.application;
public class OrganizationMediaException extends RuntimeException {
    private final String code;
    public OrganizationMediaException(String code) { super(code); this.code=code; }
    public String code(){return code;}
}
