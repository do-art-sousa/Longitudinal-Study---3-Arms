import React, { useState, useEffect, useRef } from "react";
import { getSheetForSession } from "../data/activity_sheets";
import ActivitySheetPanel from "./ActivitySheetPanel.jsx";
import { useTwoMinuteTimerFlash } from "../hooks/useTwoMinuteTimerFlash.js";
import { useActivitySheetAutosave } from "../hooks/useActivitySheetAutosave.js";
import { useStudyHeartbeat } from "../hooks/useStudyHeartbeat.js";
import {
  getRequiredCheckedTasksForSession,
  countCompleteActivityTasks,
} from "../utils/activitySheetRequirements.js";

/**
 * Control arm (A3): no chat — book + full-width activity sheet in the interaction zone.
 */
export default function ControlStudyInteraction({
  studyCondition,
  studyContext,
  /** Mirrors backend progress `showComprehension` (RCQ after session on global 1, 3, 6, 9). */
  showComprehension = false,
  slotIndex,
  globalSessionIndex,
  onStudyLocked,
  onRequestEndSession,
}) {
  const usePersonalisedSheet = studyCondition === "personalized";
  const sessionForSheet = globalSessionIndex ?? slotIndex ?? 1;
  const requiredTasksForEnd = getRequiredCheckedTasksForSession(sessionForSheet);
  const currentSheet = getSheetForSession(usePersonalisedSheet, sessionForSheet);

  const [checkedTasks, setCheckedTasks] = useState({});
  const [taskNotes, setTaskNotes] = useState({});
  const [secondsUntilLock, setSecondsUntilLock] = useState(null);
  const [sheetEndAttempted, setSheetEndAttempted] = useState(false);
  const lockEmittedRef = useRef(false);

  useEffect(() => {
    lockEmittedRef.current = false;
  }, [studyContext?.studySessionId]);

  useEffect(() => {
    if (!studyContext?.sessionStartedAtISO || !studyContext?.maxSessionMinutes) {
      setSecondsUntilLock(null);
      return;
    }
    const capSec = studyContext.maxSessionMinutes * 60;
    const tick = () => {
      const start = new Date(studyContext.sessionStartedAtISO).getTime();
      if (Number.isNaN(start)) {
        setSecondsUntilLock(null);
        return;
      }
      const elapsed = (Date.now() - start) / 1000;
      const left = Math.max(0, Math.floor(capSec - elapsed));
      setSecondsUntilLock(left);
      if (left <= 0 && !lockEmittedRef.current) {
        lockEmittedRef.current = true;
        onStudyLocked?.("time_cap");
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [
    studyContext?.sessionStartedAtISO,
    studyContext?.maxSessionMinutes,
    onStudyLocked,
  ]);

  const timerEndingFlash = useTwoMinuteTimerFlash(
    studyContext?.studySessionId,
    secondsUntilLock
  );

  // Heartbeat keeps last_activity_at fresh on the backend so writing on the
  // sheet (without ever sending a chat message — control arm has no chat)
  // doesn't trigger the inactivity lock.
  useStudyHeartbeat({
    studySessionId: studyContext?.studySessionId,
    authToken: studyContext?.authToken,
    enabled: Boolean(studyContext?.studySessionId),
  });

  const handleTaskToggle = (taskId) => {
    setCheckedTasks((prev) => ({ ...prev, [taskId]: !prev[taskId] }));
  };

  const handleTaskNoteChange = (taskId, value) => {
    setTaskNotes((prev) => ({ ...prev, [taskId]: value }));
  };

  const hasSheet = Boolean(currentSheet?.tasks?.length);

  useActivitySheetAutosave({
    studySessionId: studyContext?.studySessionId,
    sessionForSheet,
    hasSheet,
    checkedTasks,
    taskNotes,
    setCheckedTasks,
    setTaskNotes,
  });

  const checkedCount = currentSheet?.tasks?.length
    ? countCompleteActivityTasks(currentSheet.tasks, checkedTasks, taskNotes)
    : 0;
  const hasCheckedWithoutNote =
    currentSheet?.tasks?.some(
      (t) => checkedTasks[t.id] && !String(taskNotes[t.id] ?? "").trim()
    ) ?? false;
  const submissionOk =
    !hasSheet || (checkedCount >= requiredTasksForEnd && !hasCheckedWithoutNote);

  useEffect(() => {
    if (submissionOk) setSheetEndAttempted(false);
  }, [submissionOk]);

  const handleEnd = () => {
    if (hasSheet) setSheetEndAttempted(true);
    if (!submissionOk) return;
    onRequestEndSession?.(checkedTasks);
  };

  return (
    <div className="control-study-interaction">
      <header className="control-study-header">
        <div>
          <h1 className="control-study-title">Sessão de leitura (grupo controlo)</h1>
          {globalSessionIndex != null ? (
            <p className="study-session-book-meta control-study-book-meta">
              Leitura: «Os Piratas» · Sessão {globalSessionIndex}
            </p>
          ) : null}
          <p className="control-study-sub">
            Usa o teu livro físico ou texto da sessão. Preenche a ficha (abre o separador «Ficha»)
            quando precisares. No fim, carrega em terminar para os questionários.
          </p>
          {showComprehension ? (
            <p className="session-rcq-cue session-rcq-cue--compact" role="status">
              Nesta sessão inclui também perguntas de compreensão sobre a história depois de terminares.
            </p>
          ) : null}
        </div>
        {secondsUntilLock !== null ? (
          <p
            className={`chat-timer${timerEndingFlash ? " chat-timer--ending-flash" : ""}`}
            role="status"
          >
            Tempo: {Math.floor(secondsUntilLock / 60)}:
            {String(secondsUntilLock % 60).padStart(2, "0")}
          </p>
        ) : null}
      </header>

      <div className="control-study-sheet-scroll">
        {currentSheet ? (
          <ActivitySheetPanel
            currentSheet={currentSheet}
            checkedTasks={checkedTasks}
            onTaskToggle={handleTaskToggle}
            taskNotes={taskNotes}
            onTaskNoteChange={handleTaskNoteChange}
            requiredCheckedTasks={requiredTasksForEnd}
            highlightNoteErrors={sheetEndAttempted}
          />
        ) : (
          <p className="hero-sub">Não há ficha para esta sessão.</p>
        )}
      </div>

      <footer className="control-study-footer">
        {hasSheet && !submissionOk ? (
          <p className="activity-submission-hint" role="status">
            Completa pelo menos {requiredTasksForEnd} tarefas com resposta escrita na caixa para poderes
            terminar a sessão. ({checkedCount}/{requiredTasksForEnd})
          </p>
        ) : null}
        <button
          type="button"
          className="study-primary-btn control-end-btn"
          onClick={handleEnd}
          title={
            !submissionOk && hasSheet
              ? `Completa pelo menos ${requiredTasksForEnd} tarefas com resposta escrita na caixa.`
              : undefined
          }
        >
          Terminar sessão e questionários
        </button>
      </footer>
    </div>
  );
}
