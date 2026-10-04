export type OrganizationStatus = "ACTIVE" | "ARCHIVED";

export type Organization = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  website: string | null;
  contactEmail: string | null;
  location: string | null;
  notes: string | null;
  logoVersion: string | null;
  coverVersion: string | null;
  ownerUserId: string;
  status: OrganizationStatus;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
};
