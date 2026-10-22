import { expect, test } from "@playwright/test";
import type { Criterion } from "../src/features/criteria/types";
import { moveCriterionWithinStatus, sortCriteriaForDisplay } from "../src/features/criteria/ordering";
import { buildCriteriaTrend } from "../src/features/projects/criteria-trend";

// Pure PSF contracts: no browser or backend is needed for these cases.
const criterion = (id: string, overrides: Partial<Criterion> = {}): Criterion => ({
  id, projectId: "project", title: id, description: null, completed: false, sortOrder: 0,
  createdBy: "manager", createdAt: "2026-01-01T00:00:00Z", completedBy: null, completedAt: null,
  ...overrides,
});
const ids = (items: Criterion[]) => items.map(item => item.id);
const now = new Date("2026-10-22T12:00:00Z");

test.describe("PSF-02 criterion order", () => {
  const raw = [criterion("open-a", { sortOrder: 0 }), criterion("done-b", { sortOrder: 1, completed: true }),
    criterion("open-c", { sortOrder: 2 }), criterion("done-d", { sortOrder: 3, completed: true })];

  test("completed first, manual rank inside each group, stable ties and no input mutation", () => {
    expect(ids(sortCriteriaForDisplay([...raw].reverse()))).toEqual(["done-b", "done-d", "open-a", "open-c"]);
    expect(ids(raw)).toEqual(["open-a", "done-b", "open-c", "done-d"]);
    expect(ids(sortCriteriaForDisplay([criterion("first"), criterion("second")]))).toEqual(["first", "second"]);
  });

  test("manual movement swaps only same-group raw slots and sends the full unique permutation", () => {
    const result = moveCriterionWithinStatus(raw, "done-d", -1);
    expect(result).toEqual(["open-a", "done-d", "open-c", "done-b"]);
    expect(new Set(result).size).toBe(raw.length);
    expect([...(result ?? [])].sort()).toEqual(ids(raw).sort());
    expect(moveCriterionWithinStatus(raw, "open-a", 1)).toEqual(["open-c", "done-b", "open-a", "done-d"]);
    expect(ids(raw)).toEqual(["open-a", "done-b", "open-c", "done-d"]);
  });

  test("group edges, missing ids, empty/single groups and malformed duplicate lists cannot move", () => {
    for (const [id, direction] of [["done-b", -1], ["done-d", 1], ["open-a", -1], ["open-c", 1], ["absent", 1]] as const) {
      expect(moveCriterionWithinStatus(raw, id, direction), id).toBeNull();
    }
    expect(moveCriterionWithinStatus([], "absent", 1)).toBeNull();
    expect(moveCriterionWithinStatus([criterion("single")], "single", 1)).toBeNull();
    expect(moveCriterionWithinStatus([raw[0], raw[0]], "open-a", 1)).toBeNull();
  });

  test("completing and undoing a criterion moves display groups without mutating manual ranks", () => {
    const changed = raw.map(item => item.id === "open-c" ? { ...item, completed: true } : item);
    expect(ids(sortCriteriaForDisplay(changed))).toEqual(["done-b", "open-c", "done-d", "open-a"]);
    expect(ids(sortCriteriaForDisplay(changed.map(item => item.id === "open-c" ? { ...item, completed: false } : item))))
      .toEqual(["done-b", "done-d", "open-a", "open-c"]);
  });
});

test.describe("PSF-01 current-criteria UTC completion projection", () => {
  test("always has seven UTC calendar months, including zero and a year boundary", () => {
    const trend = buildCriteriaTrend([], new Date("2026-01-01T00:00:00Z"));
    expect(trend.months.map(month => month.key)).toEqual(["2025-07", "2025-08", "2025-09", "2025-10", "2025-11", "2025-12", "2026-01"]);
    expect(trend.months.every(month => month.completed === 0 && month.percentage === 0 && month.monthlyCriteria.length === 0)).toBe(true);
    expect(trend.months.filter(month => month.isCurrent).map(month => month.key)).toEqual(["2026-01"]);
  });

  test("uses today's full denominator even for later-created criteria and distinguishes cumulative/monthly counts", () => {
    const trend = buildCriteriaTrend([
      criterion("before-window", { completed: true, completedAt: "2026-02-01T00:00:00Z" }),
      criterion("may", { completed: true, completedAt: "2026-05-31T23:59:59Z" }),
      criterion("october", { completed: true, createdAt: "2026-10-10T00:00:00Z", completedAt: "2026-10-11T00:00:00Z" }),
      criterion("later-open", { createdAt: "2026-10-20T00:00:00Z" }),
    ], now);
    expect(trend.total).toBe(4);
    expect(trend.months.map(month => month.completed)).toEqual([1, 2, 2, 2, 2, 2, 3]);
    expect(trend.months.map(month => month.percentage)).toEqual([25, 50, 50, 50, 50, 50, 75]);
    expect(ids(trend.months[1].monthlyCriteria)).toEqual(["may"]);
    expect(ids(trend.months[6].monthlyCriteria)).toEqual(["october"]);
  });

  test("uses absolute UTC month boundaries regardless of browser timezone or API offset", () => {
    const trend = buildCriteriaTrend([
      criterion("april", { completed: true, completedAt: "2026-05-01T00:30:00+03:00" }),
      criterion("may", { completed: true, completedAt: "2026-04-30T23:30:00-02:00" }),
    ], now);
    expect(ids(trend.months[0].monthlyCriteria)).toEqual(["april"]);
    expect(ids(trend.months[1].monthlyCriteria)).toEqual(["may"]);
    expect(trend.months[0].percentage).toBe(50);
    expect(buildCriteriaTrend([], new Date("2026-11-01T00:30:00+03:00")).months.at(-1)?.key).toBe("2026-10");
  });

  test("missing, impossible, local, future or pre-creation dates never fabricate history; current snapshot stays accurate", () => {
    const invalid = [null, "not-a-date", "2026-02-30T00:00:00Z", "2026-09-01T00:00:00", "2026-11-01T00:00:00Z"];
    const items = invalid.map((completedAt, index) => criterion(`invalid-${index}`, { completed: true, completedAt }));
    items.push(criterion("before-created", { completed: true, createdAt: "2026-09-02T00:00:00Z", completedAt: "2026-09-01T00:00:00Z" }));
    items.push(criterion("invalid-creation", { completed: true, createdAt: "invalid", completedAt: "2026-09-01T00:00:00Z" }));
    const trend = buildCriteriaTrend(items, now);
    expect(trend.unknownCompletionCount).toBe(items.length);
    expect(trend.months.slice(0, -1).every(month => month.completed === 0 && month.monthlyCriteria.length === 0)).toBe(true);
    expect(trend.months.at(-1)).toMatchObject({ completed: items.length, percentage: 100, monthlyCriteria: [] });
  });

  test("zero complete, all complete and undo use the current status rather than stale completion timestamps", () => {
    const items = [criterion("a"), criterion("b")];
    expect(buildCriteriaTrend(items, now).months.every(month => month.percentage === 0)).toBe(true);
    const done = items.map(item => ({ ...item, completed: true, completedAt: "2026-08-10T00:00:00Z" }));
    expect(buildCriteriaTrend(done, now).months.at(-1)?.percentage).toBe(100);
    const undone = done.map(item => item.id === "a" ? { ...item, completed: false } : item);
    const trend = buildCriteriaTrend(undone, now);
    expect(trend.completed).toBe(1);
    expect(trend.months.at(-1)?.percentage).toBe(50);
    expect(ids(trend.months[4].monthlyCriteria)).toEqual(["b"]);
    expect(trend.unknownCompletionCount).toBe(0);
  });
});
