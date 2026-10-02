import { infoMetadata, PublicInfoPage } from "@/features/public-info/info-page";

export function generateMetadata() {
  return infoMetadata("accessibility");
}

export default function Page() {
  return <PublicInfoPage page="accessibility" />;
}
