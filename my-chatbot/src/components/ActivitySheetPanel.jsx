import React from "react";

/**
 * Shared activity sheet body (tasks + notes). Used in chat sidebar (A1/A2) and full-zone (A3).
 */
export default function ActivitySheetPanel({
  currentSheet,
  checkedTasks,
  onTaskToggle,
  taskNotes,
  onTaskNoteChange,
  /** Minimum checkboxes to tick before session end (3 routine · 5 milestone) */
  requiredCheckedTasks = 3,
  /** After user tries to end session: rows checked without text get a red border */
  highlightNoteErrors = false,
  className = "",
}) {
  if (!currentSheet) return null;

  return (
    <div className={`activity-sheet-panel-inner ${className}`.trim()}>
      <div className="drawer-header">
        {currentSheet.title || "Ficha de Atividade"}
      </div>
      <div className="drawer-instructions">
        <strong>Passos da sessão</strong>
        <ul className="drawer-steps-list">
          {currentSheet.steps.map((step, idx) => (
            <li key={idx}>{step}</li>
          ))}
        </ul>
        {currentSheet.rules?.length ? (
          <>
            <strong>Regras</strong>
            <ul className="drawer-steps-list">
              {currentSheet.rules.map((rule, idx) => (
                <li key={`r-${idx}`}>{rule}</li>
              ))}
            </ul>
          </>
        ) : null}
      </div>
      <div className="task-list">
        <strong className="task-list-heading">Contrato de interação</strong>
        <p className="task-list-hint">
          Para cada tarefa que marcas como feita, tens de escrever uma resposta ou notas na caixa (é
          obrigatório). Completa pelo menos {requiredCheckedTasks}{" "}
          {requiredCheckedTasks === 1 ? "tarefa" : "tarefas"} (caixa assinalada + texto) antes de
          terminares.
        </p>
        {currentSheet.tasks.map((task) => {
          const trimmed = String(taskNotes[task.id] ?? "").trim();
          const noteMissing = !!checkedTasks[task.id] && trimmed.length === 0;
          const fullyDone = !!checkedTasks[task.id] && trimmed.length > 0;
          const showInvalidOutline = noteMissing && highlightNoteErrors;
          return (
            <div
              key={task.id}
              className={`task-block ${fullyDone ? "completed" : ""}${
                showInvalidOutline ? " task-block--note-invalid" : ""
              }`}
            >
              <label className="task-block-check">
                <input
                  type="checkbox"
                  checked={!!checkedTasks[task.id]}
                  onChange={() => onTaskToggle(task.id)}
                />
                <span>{task.label}</span>
              </label>
              <label className="task-note-label" htmlFor={`task-note-${task.id}`}>
                A tua resposta ou notas
              </label>
              <textarea
                id={`task-note-${task.id}`}
                className={`task-note-input${showInvalidOutline ? " task-note-input--invalid" : ""}`}
                rows={3}
                value={taskNotes[task.id] || ""}
                onChange={(e) => onTaskNoteChange(task.id, e.target.value)}
                placeholder="Escreve aqui…"
                aria-invalid={showInvalidOutline || undefined}
              />
              {showInvalidOutline ? (
                <p className="task-note-required-msg" role="alert">
                  Escreve uma resposta ou notas nesta caixa para poderes terminar a sessão.
                </p>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
