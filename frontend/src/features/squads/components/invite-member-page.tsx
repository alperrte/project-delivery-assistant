"use client";

import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import Link from "@/i18n/navigation";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CircleNotch, Lock } from "@phosphor-icons/react";
import { toast } from "sonner";
import { z } from "zod";
import { FormErrorSummary, focusFormSection, type FormErrorSection } from "@/components/common/form-error-summary";
import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { StickyFormActions } from "@/components/common/sticky-form-actions";
import { Avatar } from "@/components/ui/avatar";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { invitationsApi } from "@/features/invitations/api";
import { MessageField, RolePicker } from "@/features/invitations/components/invite-fields";
import type { ProjectRole } from "@/features/projects/types";
import { ProjectGate, type ProjectGateContext } from "@/features/tasks/components/project-gate";
import { errorKey } from "@/lib/api/error-message";
import { squadsApi } from "../api";
import { teamsKey } from "../hooks";
import type { TeamCandidate } from "../types";

type Mode = "user" | "email";

/** A team id from the address is only ever interpolated into API paths, so anything but a UUID is ignored. */
const TEAM_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Waits for the user to stop typing before a value is used for a request. */
function useDebounced(value: string, delay = 250) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

function Section({ id, title, description, children }: { id: string; title: string; description: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="space-y-4 border-t pt-6 first:border-t-0 first:pt-0">
      <div className="space-y-1">
        <h2 id={id} className="font-heading text-base font-semibold text-foreground">
          {title}
        </h2>
        <p className="text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  );
}

function Unavailable({ slug, message }: { slug: string; message: string }) {
  const t = useTranslations("squads.detail");
  return (
    <div className="space-y-4">
      <p role="alert" className="text-sm text-destructive">{message}</p>
      <Link href={`/projects/${slug}?section=teams`} className={buttonVariants({ variant: "outline" })}>
        {t("backToTeams")}
      </Link>
    </div>
  );
}

/**
 * One place to put people in a team: someone already in the project is added straight away, someone outside it is
 * invited to the team, and anyone without a PDA account is invited by e-mail. `lockedTeamId` (from `?team=`) fixes the
 * team and decides where success returns to; without it the page asks for a team and returns to the invitations list.
 */
function InviteMemberBody({ slug, projectId, lockedTeamId }: { slug: string; projectId: string; lockedTeamId?: string }) {
  const t = useTranslations("squads.addMember");
  const ti = useTranslations("invitations");
  const tf = useTranslations("forms.summary");
  const te = useTranslations("errors");
  const tv = useTranslations("validation");
  const queryClient = useQueryClient();
  const router = useRouter();
  const ids = useId();

  const [chosenTeam, setChosenTeam] = useState("");
  const [mode, setMode] = useState<Mode>("user");
  const [query, setQuery] = useState("");
  const [target, setTarget] = useState<TeamCandidate | null>(null);
  const [roles, setRoles] = useState<ProjectRole[]>([]);
  const [message, setMessage] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [emailTouched, setEmailTouched] = useState(false);
  const [firstTouched, setFirstTouched] = useState(false);
  const [lastTouched, setLastTouched] = useState(false);
  const [rolesTouched, setRolesTouched] = useState(false);
  const [submitCount, setSubmitCount] = useState(0);
  const [formError, setFormError] = useState<string | null>(null);

  const activeTeam = lockedTeamId ?? chosenTeam;
  const search = useDebounced(query.trim());

  // Also names the locked team. A team that is not in this project (a stale or foreign `?team=`) is simply not in the
  // list: the server stays the authority and answers 404 to the search and to the invitation.
  const teams = useQuery({
    queryKey: [...teamsKey(projectId), "all"],
    queryFn: () => squadsApi.listAll(projectId),
  });
  const candidates = useQuery({
    queryKey: [...teamsKey(projectId), activeTeam, "candidates", search],
    queryFn: () => squadsApi.candidates(projectId, activeTeam, search),
    enabled: mode === "user" && !!activeTeam && search.length >= 2,
  });

  const listHref = `/projects/${slug}?section=invitations`;
  const doneHref = lockedTeamId ? `/projects/${slug}/teams/${lockedTeamId}` : listHref;

  async function refresh() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: teamsKey(projectId) }),
      queryClient.invalidateQueries({ queryKey: ["projects", projectId, "invitations"] }),
      queryClient.invalidateQueries({ queryKey: ["projects", projectId, "members"] }),
    ]);
  }

  // Adding a project member is an immediate action of its own, not a form submit: the page stays and the row turns into "in team".
  const addToTeam = useMutation({
    mutationFn: (userId: string) => squadsApi.addMember(projectId, activeTeam, userId),
    onSuccess: async () => {
      await refresh();
      toast.success(t("added"));
    },
    onError: (err) => toast.error(te(errorKey(err))),
  });

  const saved = useRef(false);
  const invite = useMutation({
    mutationFn: () =>
      invitationsApi.create(
        projectId,
        mode === "email"
          ? { teamId: activeTeam, email: email.trim(), firstName: firstName.trim(), lastName: lastName.trim(), roles, message: message.trim() || undefined }
          : { teamId: activeTeam, userId: target!.userId, roles, message: message.trim() || undefined },
      ),
    onMutate: () => setFormError(null),
    onSuccess: async () => {
      // Flips synchronously, before React re-renders, so navigating right after sending never warns.
      saved.current = true;
      await refresh();
      toast.success(ti("sent"));
      router.push(doneHref);
    },
    onError: (err) => setFormError(te(errorKey(err))),
  });

  const busy = addToTeam.isPending || invite.isPending;
  const showErrors = submitCount > 0;
  const emailValid = z.email().safeParse(email.trim()).success;
  const teamMissing = showErrors && !activeTeam;
  const personMissing = showErrors && mode === "user" && !!activeTeam && !target;
  const firstMissing = (firstTouched || showErrors) && !firstName.trim();
  const lastMissing = (lastTouched || showErrors) && !lastName.trim();
  const emailMissing = (emailTouched || showErrors) && !email.trim();
  const emailError = (emailTouched || showErrors) && !!email.trim() && !emailValid;
  const rolesMissing = roles.length === 0 && (rolesTouched || showErrors || (mode === "email" && (emailTouched || firstTouched || lastTouched)));
  const inviteReady =
    !!activeTeam && roles.length > 0 && (mode === "email" ? emailValid && !!firstName.trim() && !!lastName.trim() : !!target);

  const dirty = !!(chosenTeam || target || roles.length || message || firstName || lastName || email);
  const leaving = dirty && !invite.isPending && !invite.isSuccess;
  useEffect(() => {
    if (!leaving) return;
    const warn = (event: BeforeUnloadEvent) => {
      if (!saved.current) event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [leaving]);

  const teamHeading = `${ids}-team`;
  const personHeading = `${ids}-person`;
  const rolesHeading = `${ids}-roles`;
  const summarySections: FormErrorSection[] = showErrors
    ? ([
        [teamHeading, t("sections.team.title"), teamMissing],
        [personHeading, t("sections.person.title"), personMissing || (mode === "email" && (firstMissing || lastMissing || emailMissing || emailError))],
        [rolesHeading, t("sections.roles.title"), rolesMissing],
      ] as [string, string, boolean][])
        .filter(([, , failed]) => failed)
        .map(([id, label]) => ({ id, label, focus: () => focusFormSection(id) }))
    : [];
  // `submitCount` and the derived errors update in one render, so `aria-invalid` is on the page when this runs and the first
  // failed section (page order) focuses its first invalid field. Typing never changes `submitCount`, so focus never jumps.
  useEffect(() => {
    summarySections[0]?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submitCount]);

  const errorRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (formError) errorRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [formError]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitCount((count) => count + 1);
    if (!inviteReady || busy) return;
    invite.mutate();
  }

  const lockedTeamName = teams.data?.find((team) => team.id === lockedTeamId)?.name;
  const backHref = lockedTeamId ? `/projects/${slug}/teams/${lockedTeamId}` : listHref;

  return (
    <PageContainer width="centered">
      <Link href={backHref} className="mb-5 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft size={16} aria-hidden="true" />
        {t(lockedTeamId ? "backToTeam" : "backToInvitations")}
      </Link>
      <PageHeader title={t("title")} description={t("description")} />

      <form onSubmit={submit} noValidate>
        <div className="space-y-8">
            <Section id={teamHeading} title={t("sections.team.title")} description={t(lockedTeamId ? "sections.team.lockedDescription" : "sections.team.description")}>
              {lockedTeamId ? (
                <div className="space-y-1.5">
                  <Label>{t("team")}</Label>
                  {teams.isPending ? (
                    <Skeleton className="h-10 w-full" />
                  ) : (
                    <p className="flex min-h-10 items-center gap-2 rounded-lg border bg-muted/40 px-3 text-sm font-medium" data-testid="locked-team">
                      <Lock size={14} aria-hidden="true" className="shrink-0 text-muted-foreground" />
                      <span className="min-w-0 truncate">{lockedTeamName ?? t("teamUnknown")}</span>
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Label>{t("team")}</Label>
                  {teams.isPending ? (
                    <Skeleton className="h-10 w-full" />
                  ) : (
                    <Select value={chosenTeam} onValueChange={(next) => { setChosenTeam(next ?? ""); setTarget(null); }}>
                      <SelectTrigger
                        className="w-full"
                        aria-label={t("team")}
                        aria-invalid={teamMissing}
                        aria-describedby={teamMissing ? `${ids}-team-error` : undefined}
                      >
                        <SelectValue placeholder={t("teamPlaceholder")}>
                          {(value: string) => teams.data?.find((team) => team.id === value)?.name ?? t("teamPlaceholder")}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {(teams.data ?? []).map((team) => (
                          <SelectItem key={team.id} value={team.id}>
                            {team.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  {teams.isError && <p role="alert" className="text-sm text-destructive">{te(errorKey(teams.error))}</p>}
                  {teamMissing && <p id={`${ids}-team-error`} role="alert" className="text-sm text-destructive">{t("errors.teamRequired")}</p>}
                </div>
              )}
            </Section>

            <Section id={personHeading} title={t("sections.person.title")} description={t("sections.person.description")}>
              <Tabs value={mode} onValueChange={(next) => { setMode(next as Mode); setTarget(null); }}>
                <TabsList aria-label={t("modeLabel")} className="w-full">
                  <TabsTrigger value="user">{t("modeUser")}</TabsTrigger>
                  <TabsTrigger value="email">{t("modeEmail")}</TabsTrigger>
                </TabsList>
              </Tabs>

              {mode === "user" && (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor={`${ids}-search`}>{t("searchLabel")}</Label>
                    <Input
                      id={`${ids}-search`}
                      autoComplete="off"
                      value={query}
                      disabled={!activeTeam}
                      placeholder={activeTeam ? t("searchPlaceholder") : t("pickTeamFirst")}
                      aria-invalid={personMissing}
                      aria-describedby={personMissing ? `${ids}-person-error` : undefined}
                      onChange={(event) => { setQuery(event.target.value); setTarget(null); }}
                    />
                    {personMissing && <p id={`${ids}-person-error`} role="alert" className="text-sm text-destructive">{t("errors.personRequired")}</p>}
                  </div>

                  {candidates.isFetching && <Skeleton className="h-12 w-full" />}
                  {candidates.isError && <p role="alert" className="text-sm text-destructive">{te(errorKey(candidates.error))}</p>}
                  {!candidates.isFetching && candidates.data && candidates.data.length === 0 && (
                    <p className="text-sm text-muted-foreground">{t("noResults")}</p>
                  )}
                  {!candidates.isFetching && candidates.data && candidates.data.length > 0 && (
                    <ul className="max-h-72 divide-y overflow-y-auto rounded-lg border" aria-label={t("results")}>
                      {candidates.data.map((person) => (
                        <li key={person.userId} className="flex items-center justify-between gap-3 px-3 py-2">
                          <span className="flex min-w-0 items-center gap-2.5">
                            <Avatar name={person.nickname} className="bg-muted text-foreground" />
                            <span className="min-w-0 truncate text-sm font-medium">{person.nickname}</span>
                          </span>
                          {person.status === "PROJECT_MEMBER" && (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={busy}
                              aria-label={t("addNamed", { name: person.nickname })}
                              onClick={() => addToTeam.mutate(person.userId)}
                            >
                              {addToTeam.isPending && addToTeam.variables === person.userId && <CircleNotch size={14} className="animate-spin" aria-hidden="true" />}
                              {t("addAction")}
                            </Button>
                          )}
                          {person.status === "NONE" && (
                            <Button
                              type="button"
                              size="sm"
                              variant={target?.userId === person.userId ? "default" : "outline"}
                              disabled={busy}
                              aria-pressed={target?.userId === person.userId}
                              aria-label={t("inviteNamed", { name: person.nickname })}
                              onClick={() => setTarget(person)}
                            >
                              {t("inviteAction")}
                            </Button>
                          )}
                          {person.status === "TEAM_MEMBER" && <span className="text-xs text-muted-foreground">{t("inTeam")}</span>}
                          {person.status === "INVITED" && <span className="text-xs text-muted-foreground">{t("alreadyInvited")}</span>}
                        </li>
                      ))}
                    </ul>
                  )}
                  {target && <p className="text-sm text-muted-foreground">{t("outsideProject", { name: target.nickname })}</p>}
                </div>
              )}

              {mode === "email" && (
                <div className="space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor={`${ids}-first`}>{ti("firstName")}</Label>
                      <Input
                        id={`${ids}-first`}
                        maxLength={100}
                        autoComplete="off"
                        value={firstName}
                        aria-invalid={firstMissing}
                        aria-describedby={firstMissing ? `${ids}-first-error` : undefined}
                        onChange={(event) => setFirstName(event.target.value)}
                        onBlur={() => setFirstTouched(true)}
                      />
                      {firstMissing && <p id={`${ids}-first-error`} role="alert" className="text-sm text-destructive">{tv("required")}</p>}
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor={`${ids}-last`}>{ti("lastName")}</Label>
                      <Input
                        id={`${ids}-last`}
                        maxLength={100}
                        autoComplete="off"
                        value={lastName}
                        aria-invalid={lastMissing}
                        aria-describedby={lastMissing ? `${ids}-last-error` : undefined}
                        onChange={(event) => setLastName(event.target.value)}
                        onBlur={() => setLastTouched(true)}
                      />
                      {lastMissing && <p id={`${ids}-last-error`} role="alert" className="text-sm text-destructive">{tv("required")}</p>}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor={`${ids}-email`}>{ti("email")}</Label>
                    <Input
                      id={`${ids}-email`}
                      type="email"
                      maxLength={320}
                      autoComplete="off"
                      value={email}
                      aria-invalid={emailError || emailMissing}
                      aria-describedby={emailError || emailMissing ? `${ids}-email-error` : undefined}
                      onChange={(event) => setEmail(event.target.value)}
                      onBlur={() => setEmailTouched(true)}
                    />
                    {(emailError || emailMissing) && <p id={`${ids}-email-error`} role="alert" className="text-sm text-destructive">{tv(emailMissing ? "required" : "email")}</p>}
                  </div>
                </div>
              )}
            </Section>

            <Section id={rolesHeading} title={t("sections.roles.title")} description={t("sections.roles.description")}>
              <div className="space-y-4">
                <RolePicker value={roles} onChange={(next) => { setRoles(next); setRolesTouched(true); }} showError={rolesMissing} />
                <MessageField value={message} onChange={setMessage} />
              </div>
            </Section>
        </div>

        {formError && (
          <div ref={errorRef} id={`${ids}-form-error`} role="alert" className="mt-8 scroll-mb-24 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
            {formError}
          </div>
        )}
        <FormErrorSummary
          key={submitCount}
          id={`${ids}-summary`}
          title={tf("memberInviteTitle")}
          description={tf("description")}
          sectionsLabel={tf("sectionsLabel")}
          sections={summarySections}
        />
        <StickyFormActions className={summarySections.length > 0 || formError ? "mt-4" : undefined}>
          <div className="flex items-center justify-between gap-2">
            <Link href={backHref} className={buttonVariants({ variant: "outline" })}>
              {t("cancel")}
            </Link>
            <Button
              type="submit"
              disabled={busy}
              aria-describedby={summarySections.length > 0 ? `${ids}-summary` : formError ? `${ids}-form-error` : undefined}
            >
              {invite.isPending && <CircleNotch size={16} className="animate-spin" aria-hidden="true" />}
              {ti("send")}
            </Button>
          </div>
        </StickyFormActions>
      </form>
    </PageContainer>
  );
}

function InviteMemberView({ slug, projectId, isManager, teamHint }: ProjectGateContext & { teamHint?: string }) {
  const te = useTranslations("errors");
  // The server stays the authority (MEMBER_MANAGE); this only avoids offering a form that would be refused.
  if (!isManager) return <Unavailable slug={slug} message={te("forbidden")} />;
  return <InviteMemberBody key={teamHint ?? "none"} slug={slug} projectId={projectId} lockedTeamId={teamHint} />;
}

/** Full-page replacement of the old "add member" dialog. `teamId` (the `?team=` hint) fixes the team. */
export function InviteMemberPage({ slug, teamId }: { slug: string; teamId?: string }) {
  const teamHint = teamId && TEAM_ID.test(teamId) ? teamId.toLowerCase() : undefined;
  return <ProjectGate slug={slug}>{(context) => <InviteMemberView {...context} teamHint={teamHint} />}</ProjectGate>;
}
