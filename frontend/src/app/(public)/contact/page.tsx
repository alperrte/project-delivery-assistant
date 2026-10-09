import { ContactPage, contactMetadata } from "@/features/contact/contact-page";

export function generateMetadata() {
  return contactMetadata();
}

export default function Page() {
  return <ContactPage />;
}
