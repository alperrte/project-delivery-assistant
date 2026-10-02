import { Suspense } from "react";
import { MyTasksPage } from "@/features/tasks/components/my-tasks-page";

export default function MyTasksRoute() {
  return (
    <Suspense>
      <MyTasksPage />
    </Suspense>
  );
}
