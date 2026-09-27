import { AcceptInvitationView } from "@/features/invitations/components/accept-invitation-view";

export default async function InvitationResponsePage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string; invitationId: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { projectId, invitationId } = await params;
  const { token } = await searchParams;

  return (
    <div className="mx-auto max-w-sm py-16">
      <AcceptInvitationView projectId={projectId} invitationId={invitationId} token={token} />
    </div>
  );
}
