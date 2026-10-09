import { Suspense } from "react";
import { MyTasksPage } from "@/features/tasks/components/my-tasks-page";
import { pageTitle } from "@/lib/seo/page-title";

export const generateMetadata = () => pageTitle("myTasks");

export default function MyTasksRoute() {
  return (
    <Suspense>
      <MyTasksPage />
    </Suspense>
  );
}
