import { infoMetadata, PublicInfoPage } from "@/features/public-info/info-page";

export function generateMetadata() {
  return infoMetadata("faq");
}

export default function Page() {
  return <PublicInfoPage page="faq" />;
}
