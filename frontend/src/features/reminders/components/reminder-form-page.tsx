"use client";

import { useMemo } from "react";
import Link from "@/i18n/navigation";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CircleNotch } from "@phosphor-icons/react";
import { toast } from "sonner";
import { PageContainer } from "@/components/common/page-container";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useCurrentMember } from "@/features/projects/hooks/use-current-member";
import { useSelectedProject } from "@/features/projects/hooks/use-selected-project";
import { errorKey } from "@/lib/api/error-message";
import { cn } from "@/lib/utils";
import { remindersApi } from "../api";
import { shortTime, todayKey } from "../dates";
import { buildReminderSchema, DESCRIPTION_MAX, TITLE_MAX, type ReminderFormValues } from "../schemas";
import { ReminderTypeIcon } from "../type-config";
import { REMINDER_TYPES, type ReminderType } from "../types";

const BACK_HREF = "/calendar";

function Field({ id, label, error, className, children }: { id: string; label: string; error?: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

/** Create (`/calendar/new`) and edit (`/calendar/reminders/[id]/edit`) share this page; the project is the selected one. */
export function ReminderFormPage({ reminderId, initialDate }: { reminderId?: string; initialDate?: string }) {
  const t = useTranslations("reminders");
  const tf = useTranslations("reminders.form");
  const tv = useTranslations("reminders.validation");
  const te = useTranslations("errors");
  const router = useRouter();
  const queryClient = useQueryClient();
  const editing = reminderId !== undefined;
  const today = useMemo(() => todayKey(), []);

  const { project, isError: projectError } = useSelectedProject();
  const projectId = project?.id ?? "";
  const member = useCurrentMember(projectId);
  const isManager = member.isManager;

  const existing = useQuery({
    queryKey: ["projects", projectId, "reminders", "detail", reminderId],
    queryFn: () => remindersApi.detail(projectId, reminderId!),
    enabled: editing && !!projectId && !!member.data,
    retry: false,
  });
  const original = existing.data;

  const schema = useMemo(() => buildReminderSchema({ today, originalDate: original?.date }), [today, original?.date]);
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<ReminderFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { title: "", description: "", scope: "PERSONAL", date: initialDate ?? "", time: "" },
    values: original
      ? {
          title: original.title,
          description: original.description ?? "",
          type: original.type,
          scope: original.scope,
          date: original.date,
          time: shortTime(original.time) ?? "",
        }
      : undefined,
  });

  const mutation = useMutation({
    mutationFn: (values: ReminderFormValues) => {
      const body = {
        title: values.title.trim(),
        description: values.description?.trim() || undefined,
        type: values.type,
        date: values.date,
        time: values.time || undefined,
      };
      return editing
        ? remindersApi.update(projectId, reminderId, body)
        : remindersApi.create(projectId, { ...body, scope: isManager ? values.scope : "PERSONAL" });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["projects", projectId, "reminders"] });
      toast.success(t(editing ? "toasts.updated" : "toasts.created"));
      router.push(BACK_HREF);
    },
    onError: (error) => toast.error(te(errorKey(error))),
  });

  const backLink = (
    <Link href={BACK_HREF} className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
      <ArrowLeft size={16} aria-hidden="true" />
      {tf("back")}
    </Link>
  );

  if (!project && !projectError) {
    return <div className="space-y-5"><Skeleton className="h-10 w-40" /><Skeleton className="h-96 w-full rounded-2xl" /></div>;
  }
  if (!project) {
    return <div className="space-y-4">{backLink}<p role="alert" className="text-sm text-muted-foreground">{tf("noProject")}</p></div>;
  }
  if (member.isPending || (editing && existing.isPending)) {
    return <div className="space-y-5"><Skeleton className="h-10 w-40" /><Skeleton className="h-96 w-full rounded-2xl" /></div>;
  }
  if (member.error || (editing && existing.error)) {
    return (
      <div className="space-y-4">
        {backLink}
        <p role="alert" className="text-sm text-destructive">{editing && existing.error ? tf("notFound") : te(errorKey(member.error))}</p>
      </div>
    );
  }

  const showScopeChoice = !editing && isManager;

  return (
    <PageContainer width="form" className="space-y-6">
      {backLink}
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{project.name}</p>
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          {tf(editing ? "editTitle" : "createTitle")}
        </h1>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">{tf(editing ? "editDescription" : "createDescription")}</p>
      </header>

      <form onSubmit={handleSubmit((values) => mutation.mutate(values))} noValidate className="workspace-panel grid gap-5 p-6 sm:grid-cols-2 lg:grid-cols-3">
        {showScopeChoice && (
          <Controller
            control={control}
            name="scope"
            render={({ field }) => (
              <fieldset className="space-y-2 sm:col-span-2 lg:col-span-3">
                <legend className="text-sm font-medium">{tf("scopeLabel")}</legend>
                <RadioGroup value={field.value} onValueChange={field.onChange} aria-label={tf("scopeLabel")}>
                  {(["PERSONAL", "PROJECT"] as const).map((scope) => (
                    <div key={scope} className="flex items-start gap-3 rounded-md border p-3">
                      <RadioGroupItem value={scope} id={`reminder-scope-${scope}`} className="mt-0.5" />
                      <Label htmlFor={`reminder-scope-${scope}`} className="flex flex-col items-start gap-0.5">
                        <span>{tf(scope === "PERSONAL" ? "scopePersonal" : "scopeProject")}</span>
                        <span className="text-xs font-normal text-muted-foreground">
                          {tf(scope === "PERSONAL" ? "scopePersonalHint" : "scopeProjectHint")}
                        </span>
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </fieldset>
            )}
          />
        )}

        {editing && original && (
          <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground sm:col-span-2 lg:col-span-3">
            <Badge variant={original.scope === "PROJECT" ? "default" : "outline"}>{t(`scope.${original.scope}`)}</Badge>
            {tf("scopeFixed")}
          </p>
        )}

        <Field id="reminder-title" label={tf("title")} error={errors.title && tv(errors.title.message!)} className="sm:col-span-2 lg:col-span-3">
          <Input
            id="reminder-title"
            autoFocus
            autoComplete="off"
            maxLength={TITLE_MAX + 20}
            placeholder={tf("titlePlaceholder")}
            aria-invalid={!!errors.title}
            {...register("title")}
          />
        </Field>

        <Field id="reminder-description" label={tf("descriptionLabel")} error={errors.description && tv(errors.description.message!)} className="sm:col-span-2 lg:col-span-3">
          <Textarea
            id="reminder-description"
            rows={3}
            placeholder={tf("descriptionPlaceholder")}
            maxLength={DESCRIPTION_MAX + 50}
            aria-invalid={!!errors.description}
            {...register("description")}
          />
        </Field>

        <Field id="reminder-type" label={tf("type")} error={errors.type && tv(errors.type.message!)} className="sm:col-span-2 lg:col-span-1">
          <Controller
            control={control}
            name="type"
            render={({ field }) => (
              <Select value={field.value ?? null} onValueChange={field.onChange}>
                <SelectTrigger id="reminder-type" ref={field.ref} className="w-full" aria-invalid={!!errors.type}>
                  <SelectValue>
                    {(value: ReminderType | null) =>
                      value ? (
                        <span className="flex items-center gap-2">
                          <ReminderTypeIcon type={value} size={16} />
                          {t(`types.${value}`)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">{tf("typePlaceholder")}</span>
                      )
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {REMINDER_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      <ReminderTypeIcon type={type} size={16} />
                      {t(`types.${type}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </Field>

        <Field id="reminder-date" label={tf("date")} error={errors.date && tv(errors.date.message!)}>
          <Input id="reminder-date" type="date" min={editing ? undefined : today} aria-invalid={!!errors.date} {...register("date")} />
        </Field>
        <Field id="reminder-time" label={tf("time")} error={errors.time && tv(errors.time.message!)}>
          <Input id="reminder-time" type="time" aria-invalid={!!errors.time} {...register("time")} />
        </Field>

        <div className="flex flex-wrap justify-end gap-2 border-t pt-5 sm:col-span-2 lg:col-span-3">
          <Link href={BACK_HREF} className={cn(buttonVariants({ variant: "outline" }))}>{tf("cancel")}</Link>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending && <CircleNotch size={16} className="animate-spin" aria-hidden="true" />}
            {tf(editing ? "save" : "create")}
          </Button>
        </div>
      </form>
    </PageContainer>
  );
}
