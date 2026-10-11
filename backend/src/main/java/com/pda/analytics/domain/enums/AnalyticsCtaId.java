package com.pda.analytics.domain.enums;

import java.util.Optional;

/**
 * The fixed allow-list of call-to-action ids the browser may report. The id is the only thing a CTA click carries, so it
 * can never hold a person's text. Adding an id is a code change here and in the frontend, nothing else.
 */
public enum AnalyticsCtaId {
    /** The register button in the landing page body. */
    LANDING_REGISTER("landing_register"),
    /** The sign-in button in the landing page body. */
    LANDING_LOGIN("landing_login"),
    /** The register button in the site header. */
    HEADER_REGISTER("header_register"),
    /** The sign-in button in the site header. */
    HEADER_LOGIN("header_login"),
    /** The registration form was submitted; sessions with this click are the "registration conversions". */
    REGISTER_SUBMIT("register_submit"),
    /** The contact form was submitted. */
    CONTACT_SUBMIT("contact_submit"),
    /** The link to the public source repository. */
    GITHUB_REPO("github_repo");

    private final String id;

    AnalyticsCtaId(String id) {
        this.id = id;
    }

    /** The wire id, e.g. {@code landing_register}. */
    public String id() {
        return id;
    }

    /** Exact, case-sensitive match; empty for anything not on the list. */
    public static Optional<AnalyticsCtaId> parse(String value) {
        for (AnalyticsCtaId cta : values()) {
            if (cta.id.equals(value)) {
                return Optional.of(cta);
            }
        }
        return Optional.empty();
    }
}
