type SelectionNode = { id: string; type: string; parentId?: string };

/** A press on a member of the current selection, or on a child of a selected group, keeps that selection. */
export function keepsCurrentSelection(elements: readonly SelectionNode[], selectedIds: readonly string[], id: string | undefined, additive: boolean): boolean {
  if (!id || additive) return false;
  if (selectedIds.includes(id)) return true;
  return selectedIds.some((selected) => {
    if (!elements.some((element) => element.id === selected && element.type === "group")) return false;
    let parent = elements.find((element) => element.id === id)?.parentId;
    const guard = new Set<string>();
    while (parent && !guard.has(parent)) {
      if (parent === selected) return true;
      guard.add(parent);
      parent = elements.find((element) => element.id === parent)?.parentId;
    }
    return false;
  });
}

/** Members drawn above a selected group. They should not take the hit while the group stays selected. */
export function coveredBySelectedGroup(elements: readonly SelectionNode[], selectedIds: readonly string[]): Set<string> {
  const covered = new Set<string>();
  for (const id of selectedIds) {
    if (!elements.some((element) => element.id === id && element.type === "group")) continue;
    const pending = elements.filter((element) => element.parentId === id).map((element) => element.id);
    const guard = new Set<string>();
    while (pending.length) {
      const child = pending.pop()!;
      if (guard.has(child)) continue;
      guard.add(child);
      covered.add(child);
      for (const element of elements) if (element.parentId === child) pending.push(element.id);
    }
  }
  return covered;
}
