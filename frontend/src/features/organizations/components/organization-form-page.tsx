"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CircleNotch, Eye } from "@phosphor-icons/react";
import { toast } from "sonner";
import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useSession } from "@/features/auth/hooks/use-session";
import { PageFailure } from "@/features/errors/page-failure";
import { errorKey } from "@/lib/api/error-message";
import { organizationsApi } from "../api";
import { organizationFormSchema, type OrganizationFormValues } from "../schemas";
import { OrganizationCard, type OrganizationCardData } from "./organization-card";

/**
 * Create (`organizationId` absent) and edit (`organizationId` given) in one full page, like the team and reminder
 * forms. The server decides who may edit; the page only declines to show a form the owner could not submit anyway.
 */
export function OrganizationFormPage({ organizationId }: { organizationId?: string }) {
  const t = useTranslations("organizations");
  const tf = useTranslations("organizations.form");
  const tv = useTranslations("validation");
  const te = useTranslations("errors");
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: user } = useSession();
  const editing = organizationId !== undefined;

  const existing = useQuery({
    queryKey: ["organizations", organizationId],
    queryFn: () => organizationsApi.detail(organizationId!),
    enabled: editing,
  });
  const organization = existing.data;

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<OrganizationFormValues>({
    resolver: zodResolver(organizationFormSchema),
    values: organization
      ? { name: organization.name, description: organization.description ?? undefined }
      : { name: "", description: "" },
  });

  const values = useWatch({ control });

  const mutation = useMutation({
    mutationFn: (values: OrganizationFormValues) =>
      editing ? organizationsApi.update(organizationId, values) : organizationsApi.create(values),
    onSuccess: async (saved) => {
      await queryClient.invalidateQueries({ queryKey: ["organizations"] });
      toast.success(editing ? tf("updated") : tf("created"));
      router.push(`/organizations/${saved.id}`);
    },
    onError: (err) => toast.error(te(errorKey(err))),
  });

  const backHref = editing ? `/organizations/${organizationId}` : "/organizations";
  const backLink = (
    <Link href={backHref} className="mb-5 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground">
      <ArrowLeft size={16} aria-hidden="true" />{editing ? tf("backToOrganization") : t("backToOrganizations")}
    </Link>
  );

  if (editing && existing.isLoading) return <Skeleton className="h-64 w-full rounded-2xl" />;
  if (editing && existing.isError) return <PageFailure error={existing.error} onRetry={() => { void existing.refetch(); }} />;
  if (editing && (!user || !organization)) return <Skeleton className="h-64 w-full rounded-2xl" />;

  if (editing && organization && (organization.status === "ARCHIVED" || user?.id !== organization.ownerUserId)) {
    return (
      <PageContainer width="form">
        {backLink}
        <p role="alert" className="text-sm text-muted-foreground">{tf("notEditable")}</p>
      </PageContainer>
    );
  }

  const draft: OrganizationCardData = {
    id: organization?.id ?? "preview",
    name: values.name ?? "",
    description: values.description ?? null,
    status: organization?.status ?? "ACTIVE",
    updatedAt: organization?.updatedAt ?? new Date().toISOString(),
  };
  const descriptionLength = values.description?.length ?? 0;

  return (
    <PageContainer width="form">
      {backLink}
      <PageHeader
        title={editing ? tf("editTitle") : tf("createTitle")}
        description={editing ? tf("editDescription") : tf("createDescription")}
      />

      <form onSubmit={handleSubmit((form) => mutation.mutate(form))} noValidate>
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-12">
          <section aria-labelledby="org-general" className="space-y-5 lg:col-span-7">
            <div>
              <h2 id="org-general" className="text-sm font-semibold text-foreground">{tf("sections.general.title")}</h2>
              <p className="mt-1.5 text-sm leading-5 text-muted-foreground">{tf("sections.general.description")}</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="org-name">{tf("name")}</Label>
              <Input id="org-name" autoFocus maxLength={160} placeholder={tf("namePlaceholder")} aria-invalid={!!errors.name} {...register("name")} />
              {errors.name && <p role="alert" className="text-sm text-destructive">{tv(errors.name.message!)}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="org-description">{tf("description")}</Label>
              <Textarea id="org-description" rows={6} maxLength={2000} placeholder={tf("descriptionPlaceholder")} aria-invalid={!!errors.description} {...register("description")} />
              <div className="flex items-start justify-between gap-3">
                {errors.description ? (
                  <p role="alert" className="text-sm text-destructive">{tv(errors.description.message!)}</p>
                ) : (
                  <p className="text-sm text-muted-foreground">{tf("descriptionHint")}</p>
                )}
                <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{descriptionLength}/2000</span>
              </div>
            </div>
          </section>

          <aside id="organization-preview" aria-label={tf("preview.title")} className="scroll-mt-24 lg:col-span-5">
            <div className="space-y-3 lg:sticky lg:top-24">
              <div className="space-y-0.5">
                <h2 className="font-heading text-base font-semibold text-foreground">{tf("preview.title")}</h2>
                <p className="text-sm text-muted-foreground">{tf("preview.caption")}</p>
              </div>
              <div className="mx-auto max-w-sm lg:max-w-none">
                <OrganizationCard organization={draft} preview={{ updatedLabel: tf("preview.now") }} />
              </div>
            </div>
          </aside>
        </div>

        <div className="sticky bottom-0 z-20 -mx-4 -mb-6 mt-10 border-t bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:-mx-8 sm:-mb-8 sm:px-8">
          <div className="flex items-center justify-between gap-2">
            <Link href={backHref} className={buttonVariants({ variant: "outline" })}>{tf("cancel")}</Link>
            <div className="flex items-center gap-2">
              <a href="#organization-preview" className={buttonVariants({ variant: "ghost", className: "lg:hidden" })}>
                <Eye size={16} data-icon="inline-start" aria-hidden="true" />
                <span className="sr-only min-[440px]:not-sr-only">{tf("preview.show")}</span>
              </a>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending && <CircleNotch size={16} className="animate-spin" aria-hidden="true" />}
                {editing ? tf("save") : tf("create")}
              </Button>
            </div>
          </div>
        </div>
      </form>
    </PageContainer>
  );
}
