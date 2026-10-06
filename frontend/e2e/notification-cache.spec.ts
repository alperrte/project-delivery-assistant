import { test, expect } from "@playwright/test";
import { QueryClient } from "@tanstack/react-query";
import { notificationKeys, clearPrivateNotifications } from "../src/features/notifications/query-keys";

test("notification private families reject old principal cache and late in-flight completion", async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  let finish!: (data: unknown) => void;
  const promise = new Promise(resolve => { finish = resolve; });
  const old = client.fetchQuery({ queryKey: notificationKeys.list("B", 0), queryFn: () => promise }).catch(() => undefined);
  client.setQueryData(notificationKeys.count("B"), { count: 12 });
  clearPrivateNotifications(client);
  client.setQueryData(notificationKeys.list("C", 0), { content: [], totalElements: 0 });
  finish({ content: [{ message: "private B" }], totalElements: 1 });
  await old;
  expect(client.getQueryData(notificationKeys.list("B", 0))).toBeUndefined();
  expect(client.getQueryData(notificationKeys.count("B"))).toBeUndefined();
  expect(client.getQueryData(notificationKeys.list("C", 0))).toEqual({ content: [], totalElements: 0 });
  client.clear();
});
