import { infoMetadata, PublicInfoPage } from "@/features/public-info/info-page";

export function generateMetadata() {
  return infoMetadata("license");
}

export default function Page() {
  return <PublicInfoPage page="license" />;
}
