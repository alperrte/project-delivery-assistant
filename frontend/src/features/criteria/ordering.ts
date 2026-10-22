import type { Criterion } from "./types";

/** Completion is a display group; sortOrder remains the manual order within it. */
export function sortCriteriaForDisplay(criteria: readonly Criterion[]): Criterion[] {
  return criteria.map((criterion, index) => ({ criterion, index }))
    .sort((a, b) => Number(b.criterion.completed) - Number(a.criterion.completed)
      || a.criterion.sortOrder - b.criterion.sortOrder || a.index - b.index)
    .map(({ criterion }) => criterion);
}

/** The API requires the entire project list, even when only one status group moves. */
export function moveCriterionWithinStatus(
  criteria: readonly Criterion[], criterionId: string, direction: -1 | 1,
): string[] | null {
  const ordered = sortCriteriaForDisplay(criteria);
  if (new Set(ordered.map((criterion) => criterion.id)).size !== ordered.length) return null;
  const index = ordered.findIndex((criterion) => criterion.id === criterionId);
  const target = index + direction;
  if (index < 0 || !ordered[target] || ordered[index].completed !== ordered[target].completed) return null;
  // Swap only these two manual slots; the other group's persisted ranks stay intact.
  const manual = criteria.map((criterion, originalIndex) => ({ criterion, originalIndex }))
    .sort((a, b) => a.criterion.sortOrder - b.criterion.sortOrder || a.originalIndex - b.originalIndex)
    .map(({ criterion }) => criterion.id);
  const sourceSlot = manual.indexOf(ordered[index].id);
  const targetSlot = manual.indexOf(ordered[target].id);
  [manual[sourceSlot], manual[targetSlot]] = [manual[targetSlot], manual[sourceSlot]];
  return manual;
}
