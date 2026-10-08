import { test, expect } from "@playwright/test";
import { QueryClient } from "@tanstack/react-query";
import { notificationKeys, clearPrivateNotifications, reconcileNotificationRead } from "../src/features/notifications/query-keys";
import { notificationListPath } from "../src/features/notifications/api";

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

test("read scopes encode the actual server filter and isolate every page and recipient", () => {
  expect(notificationListPath(2, { read: false })).toBe("/notifications?page=2&size=20&read=false");
  expect(notificationListPath(1, { read: true, size: 10, type: "SQUAD_DELETED" })).toBe("/notifications?page=1&size=10&read=true&type=SQUAD_DELETED");
  expect(notificationListPath()).toBe("/notifications?page=0&size=20");
  const scopes = [notificationKeys.list("A", 0), notificationKeys.list("A", 0, { read: false }),
    notificationKeys.list("A", 0, { read: true }), notificationKeys.list("A", 1, { read: true }),
    notificationKeys.list("B", 0, { read: true })];
  expect(new Set(scopes.map(key => JSON.stringify(key))).size).toBe(5);
});

test("confirmed read reconciliation cancels late active/history/count results and invalidates all own pages only", async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const old = [] as Promise<unknown>[]; const release = [] as (() => void)[];
  for (const key of [notificationKeys.list("A", 0, { read: false }), notificationKeys.list("A", 2, { read: true }), notificationKeys.count("A")]) {
    const pending = new Promise(resolve => release.push(() => resolve({ old: true })));
    old.push(client.fetchQuery({ queryKey: key, queryFn: () => pending }).catch(() => undefined));
  }
  const history = notificationKeys.list("A", 1, { read: true });
  const other = notificationKeys.list("B", 0, { read: true });
  client.setQueryData(history, { retained: true }); client.setQueryData(other, { privateB: true });
  client.setQueryData(["unrelated"], { retained: true });
  await reconcileNotificationRead(client, "A"); release.forEach(resolve => resolve()); await Promise.all(old);
  expect(client.getQueryData(notificationKeys.list("A", 0, { read: false }))).toBeUndefined();
  expect(client.getQueryState(history)?.isInvalidated).toBe(true);
  expect(client.getQueryState(other)?.isInvalidated).toBe(false);
  expect(client.getQueryData(other)).toEqual({ privateB: true });
  expect(client.getQueryData(["unrelated"])).toEqual({ retained: true });
  clearPrivateNotifications(client);
  expect(client.getQueryData(history)).toBeUndefined(); expect(client.getQueryData(other)).toBeUndefined();
  client.clear();
});
