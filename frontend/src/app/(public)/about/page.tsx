import { infoMetadata } from "@/features/public-info/info-page";
import { AboutPage } from "@/features/public-info/about-page";

export function generateMetadata() {
  return infoMetadata("about");
}

export default function Page() {
  return <AboutPage />;
}
