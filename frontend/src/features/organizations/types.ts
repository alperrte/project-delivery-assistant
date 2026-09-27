export type OrganizationStatus = "ACTIVE" | "ARCHIVED";

export type Organization = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  ownerUserId: string;
  status: OrganizationStatus;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
};
