"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleNotch, Plus } from "@phosphor-icons/react";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { invitationsApi } from "@/features/invitations/api";
import { MessageField, RolePicker } from "@/features/invitations/components/invite-fields";
import type { ProjectRole } from "@/features/projects/types";
import { errorKey } from "@/lib/api/error-message";
import { squadsApi } from "../api";
import { teamsKey } from "../hooks";
import type { TeamCandidate } from "../types";

type Mode = "user" | "email";

/** Waits for the user to stop typing before a value is used for a request. */
function useDebounced(value: string, delay = 250) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

/**
 * One place to put people in a team: someone already in the project is added straight away, someone outside it is
 * invited to the team, and anyone without a PDA account is invited by e-mail. `teamId` fixes the team; without it the
 * dialog asks for one.
 */
export function AddTeamMemberDialog({
  projectId,
  teamId,
  trigger,
}: {
  projectId: string;
  teamId?: string;
  trigger?: ReactNode;
}) {
  const t = useTranslations("squads.addMember");
  const ti = useTranslations("invitations");
  const te = useTranslations("errors");
  const queryClient = useQueryClient();
  const ids = useId();

  const [open, setOpen] = useState(false);
  const [chosenTeam, setChosenTeam] = useState<string>("");
  const [mode, setMode] = useState<Mode>("user");
  const [query, setQuery] = useState("");
  const [target, setTarget] = useState<TeamCandidate | null>(null);
  const [roles, setRoles] = useState<ProjectRole[]>([]);
  const [message, setMessage] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");

  const activeTeam = teamId ?? chosenTeam;
  const search = useDebounced(query.trim());

  const teams = useQuery({
    queryKey: [...teamsKey(projectId), "all"],
    queryFn: () => squadsApi.listAll(projectId),
    enabled: open && !teamId,
  });
  const candidates = useQuery({
    queryKey: [...teamsKey(projectId), activeTeam, "candidates", search],
    queryFn: () => squadsApi.candidates(projectId, activeTeam, search),
    enabled: open && mode === "user" && !!activeTeam && search.length >= 2,
  });

  function reset() {
    setChosenTeam("");
    setMode("user");
    setQuery("");
    setTarget(null);
    setRoles([]);
    setMessage("");
    setFirstName("");
    setLastName("");
    setEmail("");
  }

  async function refresh() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: teamsKey(projectId) }),
      queryClient.invalidateQueries({ queryKey: ["projects", projectId, "invitations"] }),
      queryClient.invalidateQueries({ queryKey: ["projects", projectId, "members"] }),
    ]);
  }

  const addToTeam = useMutation({
    mutationFn: (userId: string) => squadsApi.addMember(projectId, activeTeam, userId),
    onSuccess: async () => {
      await refresh();
      toast.success(t("added"));
      setOpen(false);
      reset();
    },
    onError: (err) => toast.error(te(errorKey(err))),
  });

  const invite = useMutation({
    mutationFn: () =>
      invitationsApi.create(
        projectId,
        mode === "email"
          ? { teamId: activeTeam, email: email.trim(), firstName: firstName.trim(), lastName: lastName.trim(), roles, message: message.trim() || undefined }
          : { teamId: activeTeam, userId: target!.userId, roles, message: message.trim() || undefined },
      ),
    onSuccess: async () => {
      await refresh();
      toast.success(ti("sent"));
      setOpen(false);
      reset();
    },
    onError: (err) => toast.error(te(errorKey(err))),
  });

  const busy = addToTeam.isPending || invite.isPending;
  const inviteReady =
    !!activeTeam && roles.length > 0 && (mode === "email" ? !!email.trim() && !!firstName.trim() && !!lastName.trim() : !!target);

  const defaultTrigger = (
    <Button>
      <Plus data-icon="inline-start" size={16} aria-hidden="true" />
      {t("button")}
    </Button>
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger render={(trigger ?? defaultTrigger) as React.ReactElement} />
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        {!teamId && (
          <div className="space-y-1.5">
            <Label>{t("team")}</Label>
            {teams.isLoading ? (
              <Skeleton className="h-9 w-full" />
            ) : (
              <Select value={chosenTeam} onValueChange={(next) => { setChosenTeam(next ?? ""); setTarget(null); }}>
                <SelectTrigger className="w-full" aria-label={t("team")}>
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
          </div>
        )}

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
                onChange={(event) => { setQuery(event.target.value); setTarget(null); }}
              />
            </div>

            {candidates.isFetching && <Skeleton className="h-12 w-full" />}
            {candidates.isError && <p role="alert" className="text-sm text-destructive">{te(errorKey(candidates.error))}</p>}
            {!candidates.isFetching && candidates.data && candidates.data.length === 0 && (
              <p className="text-sm text-muted-foreground">{t("noResults")}</p>
            )}
            {!candidates.isFetching && candidates.data && candidates.data.length > 0 && (
              <ul className="max-h-56 divide-y overflow-y-auto rounded-lg border" aria-label={t("results")}>
                {candidates.data.map((person) => (
                  <li key={person.userId} className="flex items-center justify-between gap-3 px-3 py-2">
                    <span className="flex min-w-0 items-center gap-2.5">
                      <Avatar name={person.nickname} className="bg-muted text-foreground" />
                      <span className="min-w-0 truncate text-sm font-medium">{person.nickname}</span>
                    </span>
                    {person.status === "PROJECT_MEMBER" && (
                      <Button
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
                <Input id={`${ids}-first`} maxLength={100} value={firstName} onChange={(event) => setFirstName(event.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`${ids}-last`}>{ti("lastName")}</Label>
                <Input id={`${ids}-last`} maxLength={100} value={lastName} onChange={(event) => setLastName(event.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`${ids}-email`}>{ti("email")}</Label>
              <Input id={`${ids}-email`} type="email" maxLength={320} value={email} onChange={(event) => setEmail(event.target.value)} />
            </div>
          </div>
        )}

        {(mode === "email" || target) && (
          <div className="space-y-4">
            <RolePicker value={roles} onChange={setRoles} />
            <MessageField value={message} onChange={setMessage} />
          </div>
        )}

        {(mode === "email" || target) && (
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
              {t("cancel")}
            </Button>
            <Button onClick={() => invite.mutate()} disabled={!inviteReady || busy}>
              {invite.isPending && <CircleNotch size={16} className="animate-spin" aria-hidden="true" />}
              {ti("send")}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
