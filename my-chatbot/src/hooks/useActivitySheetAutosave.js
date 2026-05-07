import { useEffect, useRef } from "react";
import {
  loadActivitySheetDraft,
  saveActivitySheetDraft,
} from "../utils/activitySheetDraft.js";

const DEFAULT_DEBOUNCE_MS = 450;

/**
 * Restores checkbox + textarea state from localStorage when the study session loads,
 * and debounces writes on each change (auto-save).
 *
 * @param {object} opts
 * @param {string | undefined} opts.studySessionId
 * @param {number} opts.sessionForSheet — global session index used to pick the sheet (1–9)
 * @param {boolean} opts.hasSheet — whether this session has an activity sheet
 * @param {Record<string, boolean>} opts.checkedTasks
 * @param {Record<string, string>} opts.taskNotes
 * @param {function} opts.setCheckedTasks
 * @param {function} opts.setTaskNotes
 * @param {number} [opts.debounceMs]
 */
export function useActivitySheetAutosave({
  studySessionId,
  sessionForSheet,
  hasSheet,
  checkedTasks,
  taskNotes,
  setCheckedTasks,
  setTaskNotes,
  debounceMs = DEFAULT_DEBOUNCE_MS,
}) {
  /** Skip the first persist after loading/restoring so we never clobber storage mid-hydrate. */
  const skipNextPersistRef = useRef(false);

  // Restore draft when session / sheet index changes
  useEffect(() => {
    skipNextPersistRef.current = true;
    if (!studySessionId || !hasSheet) {
      setCheckedTasks({});
      setTaskNotes({});
      return;
    }
    const draft = loadActivitySheetDraft(studySessionId);
    const hasDraftContent =
      draft &&
      draft.sheetSession === sessionForSheet &&
      (Object.keys(draft.checkedTasks || {}).some((k) => draft.checkedTasks[k]) ||
        Object.keys(draft.taskNotes || {}).some((k) =>
          String(draft.taskNotes[k] || "").trim()
        ));

    if (hasDraftContent) {
      setCheckedTasks(draft.checkedTasks || {});
      setTaskNotes(draft.taskNotes || {});
    } else {
      setCheckedTasks({});
      setTaskNotes({});
    }
  }, [studySessionId, sessionForSheet, hasSheet, setCheckedTasks, setTaskNotes]);

  // Debounced persist
  const timerRef = useRef(null);
  useEffect(() => {
    if (!studySessionId || !hasSheet) return;

    if (skipNextPersistRef.current) {
      skipNextPersistRef.current = false;
      return;
    }

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      saveActivitySheetDraft(
        studySessionId,
        sessionForSheet,
        checkedTasks,
        taskNotes
      );
    }, debounceMs);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [
    studySessionId,
    sessionForSheet,
    hasSheet,
    checkedTasks,
    taskNotes,
    debounceMs,
  ]);

  // Flush immediately before tab close so last keystrokes within debounce window are not lost
  useEffect(() => {
    if (!studySessionId || !hasSheet) return;
    const flush = () => {
      saveActivitySheetDraft(
        studySessionId,
        sessionForSheet,
        checkedTasks,
        taskNotes
      );
    };
    window.addEventListener("beforeunload", flush);
    return () => window.removeEventListener("beforeunload", flush);
  }, [studySessionId, hasSheet, sessionForSheet, checkedTasks, taskNotes]);
}
