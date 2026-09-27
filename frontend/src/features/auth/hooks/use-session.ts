import { useQuery } from "@tanstack/react-query";
import { authApi } from "../api";

export const sessionQueryKey = ["session"] as const;

export function useSession() {
  return useQuery({
    queryKey: sessionQueryKey,
    queryFn: authApi.me,
    retry: false,
  });
}
