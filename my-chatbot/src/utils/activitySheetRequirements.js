/** Milestone sessions (1, 5, 9): FAZ TODOS (5/5). Routine sessions: FAZ ESTAS 3 ATIVIDADES. */
const MILESTONE_SLOT_INDEXES = new Set([1, 5, 9]);

/**
 * @param {number | string | null | undefined} slotIndex – session slot within the study (1–9), from backend `slotIndex` / `globalSessionIndex`
 * @returns {number} minimum checked tasks required on the ficha before ending the session
 */
export function getRequiredCheckedTasksForSession(slotIndex) {
  const n = Number(slotIndex);
  if (!Number.isFinite(n)) return 3;
  return MILESTONE_SLOT_INDEXES.has(n) ? 5 : 3;
}

/** Checkbox + non-empty note counts toward the session minimum. */
export function countCompleteActivityTasks(tasks, checkedTasks, taskNotes) {
  if (!tasks?.length) return 0;
  return tasks.filter((t) => {
    if (!checkedTasks[t.id]) return false;
    return String(taskNotes[t.id] ?? "").trim().length > 0;
  }).length;
}
