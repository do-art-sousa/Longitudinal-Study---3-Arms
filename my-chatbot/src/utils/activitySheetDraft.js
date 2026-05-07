/**
 * Browser-local draft for activity sheet checkboxes + notes (per study session).
 * Survives refresh / brief crashes; cleared after questionnaires submit successfully.
 */

const STORAGE_PREFIX = "study-activity-draft:v1";

export function activitySheetDraftKey(sessionId) {
  return `${STORAGE_PREFIX}:${sessionId}`;
}

/**
 * @returns {{ sheetSession: number, checkedTasks: Record<string, boolean>, taskNotes: Record<string, string>, savedAt: number } | null}
 */
export function loadActivitySheetDraft(sessionId) {
  if (!sessionId || typeof sessionId !== "string") return null;
  try {
    const raw = localStorage.getItem(activitySheetDraftKey(sessionId));
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data !== "object") return null;
    return {
      sheetSession: Number(data.sheetSession) || 1,
      checkedTasks:
        data.checkedTasks && typeof data.checkedTasks === "object"
          ? data.checkedTasks
          : {},
      taskNotes:
        data.taskNotes && typeof data.taskNotes === "object"
          ? data.taskNotes
          : {},
      savedAt: typeof data.savedAt === "number" ? data.savedAt : 0,
    };
  } catch {
    return null;
  }
}

export function saveActivitySheetDraft(
  sessionId,
  sheetSession,
  checkedTasks,
  taskNotes
) {
  if (!sessionId || typeof sessionId !== "string") return;
  try {
    localStorage.setItem(
      activitySheetDraftKey(sessionId),
      JSON.stringify({
        sheetSession,
        checkedTasks: checkedTasks || {},
        taskNotes: taskNotes || {},
        savedAt: Date.now(),
      })
    );
  } catch (e) {
    console.warn("[activity sheet] draft save failed", e);
  }
}

export function clearActivitySheetDraft(sessionId) {
  if (!sessionId || typeof sessionId !== "string") return;
  try {
    localStorage.removeItem(activitySheetDraftKey(sessionId));
  } catch {
    /* ignore */
  }
}
