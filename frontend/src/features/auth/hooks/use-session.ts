import { useQuery } from "@tanstack/react-query";
import { authApi } from "../api";

export const sessionQueryKey = ["session"] as const;

export function useSession(enabled = true) {
  return useQuery({
    queryKey: sessionQueryKey,
    queryFn: ({ signal }) => authApi.me(signal),
    retry: false,
    enabled,
  });
}
