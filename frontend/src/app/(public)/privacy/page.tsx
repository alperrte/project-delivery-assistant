import { infoMetadata, PublicInfoPage } from "@/features/public-info/info-page";

export function generateMetadata() {
  return infoMetadata("privacy");
}

export default function Page() {
  return <PublicInfoPage page="privacy" />;
}
