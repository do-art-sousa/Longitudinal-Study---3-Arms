import React, {
  useState,
  useRef,
  useLayoutEffect,
  useCallback,
  useEffect,
} from "react";
import { defaultCharacter, characters } from "../data/characters";
import { getSheetForSession } from "../data/activity_sheets";
import LatencyCue from "./LatencyCue";
import ActivitySheetPanel from "./ActivitySheetPanel.jsx";
import { useTwoMinuteTimerFlash } from "../hooks/useTwoMinuteTimerFlash.js";
import { useActivitySheetAutosave } from "../hooks/useActivitySheetAutosave.js";
import { useStudyHeartbeat } from "../hooks/useStudyHeartbeat.js";
import {
  getRequiredCheckedTasksForSession,
  countCompleteActivityTasks,
} from "../utils/activitySheetRequirements.js";
import { renderChatMessageText } from "../utils/renderChatMessageText.jsx";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

if (import.meta.env.DEV) {
  console.log("API URL:", API_URL);
}

/** Per-call timeouts. The chat endpoint hits the LLM so we give it a bigger
 *  budget; save-message and start-conversation are quick DB writes. */
const CHAT_FETCH_TIMEOUT_MS = 30_000;
const SHORT_FETCH_TIMEOUT_MS = 10_000;

/** fetch() wrapper with an AbortController-backed timeout so flaky tablet
 *  Wi-Fi can never leave the chat loading spinner stuck forever. */
async function fetchWithTimeout(url, options = {}, timeoutMs = SHORT_FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(new DOMException("timeout", "AbortError")),
    timeoutMs,
  );
  try {
    return await fetch(url, { ...options, signal: options.signal || controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

function mapApiMessagesToState(rows) {
  return (rows || []).map((m) => ({
    from: m.sender === "user" ? "user" : "bot",
    text: m.content ?? "",
  }));
}

const MAX_SIDEBAR_NAME_CHARS = 28;

/** Keeps the grey name row readable if someone pastes a sentence into the name field. */
function chatSidebarNameLabel(raw) {
  const s = (raw || "").trim();
  if (!s) return "Tu";
  if (s.length <= MAX_SIDEBAR_NAME_CHARS) return s;
  return `${s.slice(0, MAX_SIDEBAR_NAME_CHARS - 1)}…`;
}

function chatAvatarLetter(raw) {
  const s = (raw || "").trim();
  if (!s) return "🙂";
  const firstWord = s.split(/\s+/)[0];
  return firstWord.charAt(0).toUpperCase();
}

/** Backend / legacy fallbacks that should not appear as a “real” name in the generic UI. */
const GENERIC_DISPLAY_PLACEHOLDER_NAMES = new Set(["participant", "anon", "unknown"]);

export default function Chat({
  selectedCharacter,
  username,
  studyCondition = null,
  studyContext = null,
  /** When true, chat lives in the tablet right column (non-fixed layout); sheet drawer is scoped to that column (~38% width). */
  embedInTabletSplit = false,
  onStudyLocked,
  onRequestEndSession,
}) {
  const isPersonalised = selectedCharacter !== "default";
  const persona = isPersonalised
    ? characters[selectedCharacter] || defaultCharacter
    : defaultCharacter;

  /** Generic study arm or standalone demo with the default coach — distinct UI (no “Reading Coach” labels, gradient avatars). */
  const isGenericCoachUi =
    studyCondition === "generic" ||
    (studyCondition == null && selectedCharacter === "default");

  const trimmedUsername = (username || "").trim();
  const showBotNameLabel = !isGenericCoachUi;
  /** Generic coach: show enrollment/session neutral label “User” unless a real in-session name was provided. */
  const userLabelDisplay = (() => {
    if (!isGenericCoachUi) return chatSidebarNameLabel(username ?? "");
    if (
      !trimmedUsername ||
      GENERIC_DISPLAY_PLACEHOLDER_NAMES.has(trimmedUsername.toLowerCase())
    )
      return "User";
    return chatSidebarNameLabel(username ?? "");
  })();
  const showUserNameLabel = true;

  const usePersonalisedSheet =
    studyCondition != null
      ? studyCondition === "personalized"
      : isPersonalised;

  const initial = username
    ? persona.initialMessage.replace("{username}", username)
    : persona.initialMessage;

  const [messages, setMessages] = useState(() => {
    if (studyContext?.initialMessages?.length) {
      return mapApiMessagesToState(studyContext.initialMessages);
    }
    // Generic arm: the bot must NOT speak first — the user leads the conversation,
    // exactly like opening ChatGPT to a blank thread. Skip the local persona opener.
    if (studyCondition === "generic") {
      return [];
    }
    return [{ from: "bot", text: initial }];
  });

  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isWaiting, setIsWaiting] = useState(false);
  const [conversationId, setConversationId] = useState(studyContext?.conversationId || null);
  const [secondsUntilLock, setSecondsUntilLock] = useState(null);

  // Activity Sheet State
  const [isActivityOpen, setIsActivityOpen] = useState(false);
  const [checkedTasks, setCheckedTasks] = useState({});
  const [taskNotes, setTaskNotes] = useState({});
  const sessionForSheet =
    studyContext?.globalSessionIndex ?? studyContext?.slotIndex ?? 1;
  const requiredTasksForEnd = getRequiredCheckedTasksForSession(sessionForSheet);
  const currentSheet = getSheetForSession(usePersonalisedSheet, sessionForSheet);

  const listRef = useRef(null);
  const endRef = useRef(null);
  const lockEmittedRef = useRef(false);
  /** Prevents re-applying `studyContext.initialMessages` on every parent re-render (new array reference wipes chat). */
  const studyMessagesHydratedForConvRef = useRef(null);
  /** When backend `showComprehension` is true (RCQ after this session), auto-open sheet once as state-driven cue. */
  const comprehensionCueOpenedRef = useRef(null);

  const scrollToBottom = useCallback(() => {
    endRef.current?.scrollIntoView({ block: "end" });
    const el = listRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "auto" });
    requestAnimationFrame(() => {
      endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    });
  }, []);

  useLayoutEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, scrollToBottom]);

  const toLLMHistory = (msgs) =>
    (msgs || []).map((m) => ({
      role: m.from === "user" ? "user" : "assistant",
      content: m.text,
    }));

  const saveMessageToBackend = useCallback(
    async (sender, content) => {
      if (!conversationId || conversationId === "local-only") return;
      const text = content || "";
      const lower = text.toLowerCase();
      let meta = {};

      if (sender === "user") {
        const isQuestion = text.includes("?");
        const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
        const elaborated = wordCount >= 12;
        const confusion_signal = /i don't know|idk|confused|stuck|lost|i'm not sure/.test(lower) ? "HIGH" : "NONE";
        const autonomy_signal = /let me try|i want to try|can i do it|i'll do it myself/.test(lower) ? "HIGH" : "NONE";

        meta = { role: "child", on_task: true, elaborated, is_question: isQuestion, confusion_signal, autonomy_signal };
      } else {
        const hasWarmEmoji = /❄️|✨|🌟|💖|💕|📚|😊|😀|🙂|🌈/.test(text);
        const hasChatter = /lol|haha|lmao|😂/.test(lower);
        let affect = "NEUTRAL";
        if (hasChatter) affect = "OVER_SOCIAL";
        else if (hasWarmEmoji) affect = "WARM_SUPPORTIVE";

        meta = { role: "agent", text_focus: "ON_TEXT", stance: "RESPONSIVE", ladder_step: "NUDGE", affect };
      }

      const headers = { "Content-Type": "application/json" };
      if (studyContext?.authToken) headers.Authorization = `Bearer ${studyContext.authToken}`;

      try {
        const res = await fetchWithTimeout(`${API_URL}/api/save-message/`, {
          method: "POST", headers,
          body: JSON.stringify({ conversationId, sender, content, meta }),
        }, SHORT_FETCH_TIMEOUT_MS);
        if (res.status === 403) {
          const d = await res.json().catch(() => ({}));
          if (d.sessionLocked && !lockEmittedRef.current) {
            lockEmittedRef.current = true;
            onStudyLocked?.(d.lockReason || "time_cap");
          }
        }
      } catch (err) {
        console.error("Failed to save message:", err);
      }
    },
    [conversationId, studyContext?.authToken, onStudyLocked]
  );

  useEffect(() => {
    const cid = studyContext?.conversationId;
    if (!cid) return;
    setConversationId(cid);
    const initial = studyContext?.initialMessages;
    if (!initial?.length) return;
    if (studyMessagesHydratedForConvRef.current === cid) return;
    studyMessagesHydratedForConvRef.current = cid;
    setMessages(mapApiMessagesToState(initial));
  }, [studyContext?.conversationId, studyContext?.initialMessages]);

  useEffect(() => {
    let cancelled = false;
    async function startConversation() {
      if (studyContext?.conversationId) return;
      try {
        const res = await fetchWithTimeout(`${API_URL}/api/start-conversation/`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userName: username || "Anon", character: selectedCharacter || "default", initialMessage: initial }),
        }, SHORT_FETCH_TIMEOUT_MS);
        if (!res.ok) {
          if (!cancelled) setConversationId("local-only");
          return;
        }
        const data = await res.json();
        if (!cancelled) {
          setConversationId(data.conversationId);
          if (initial) saveMessageToBackend("bot", initial);
        }
      } catch {
        if (!cancelled) setConversationId("local-only");
      }
    }
    startConversation();
    return () => { cancelled = true; };
  }, [initial, saveMessageToBackend, selectedCharacter, username, studyContext?.conversationId]);

  useEffect(() => {
    lockEmittedRef.current = false;
  }, [studyContext?.studySessionId]);

  useEffect(() => {
    setIsActivityOpen(false);
    comprehensionCueOpenedRef.current = null;
  }, [studyContext?.studySessionId]);

  // Activity sheet starts CLOSED in every session (including RCQ sessions 1/3/6/9).
  // Children open it themselves when they want to write — auto-opening was distracting
  // and pulled their attention away from the chat at the start of the session.
  // The drawer remains accessible via its toggle button.
  // (Was previously: setIsActivityOpen(true) when studyContext.showComprehension.)

  useEffect(() => {
    if (!studyContext?.sessionStartedAtISO || !studyContext?.maxSessionMinutes) {
      setSecondsUntilLock(null);
      return;
    }
    const capSec = studyContext.maxSessionMinutes * 60;
    const tick = () => {
      const start = new Date(studyContext.sessionStartedAtISO).getTime();
      if (Number.isNaN(start)) { setSecondsUntilLock(null); return; }
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
  }, [studyContext?.sessionStartedAtISO, studyContext?.maxSessionMinutes, onStudyLocked]);

  const timerEndingFlash = useTwoMinuteTimerFlash(
    studyContext?.studySessionId,
    secondsUntilLock
  );

  // Heartbeat keeps last_activity_at fresh on the backend so silent reading
  // or activity-sheet writing doesn't trigger the inactivity lock.
  useStudyHeartbeat({
    studySessionId: studyContext?.studySessionId,
    authToken: studyContext?.authToken,
    enabled: Boolean(studyContext?.studySessionId),
  });

  const sendMessage = async () => {
    const value = input.trim();
    if (!value || isLoading || !conversationId) return;
    if (studyContext && secondsUntilLock !== null && secondsUntilLock <= 0) {
      if (!lockEmittedRef.current) { lockEmittedRef.current = true; onStudyLocked?.("time_cap"); }
      return;
    }

    const userMsg = { from: "user", text: value };

    setMessages((msgs) => [...msgs, userMsg]);
    setInput("");
    setIsLoading(true);
    setIsWaiting(true);
    saveMessageToBackend("user", userMsg.text);

    try {
      const nextMessages = [...messages, userMsg];
      const payload = {
        message: userMsg.text, character: selectedCharacter, userName: username,
        history: toLLMHistory(nextMessages.slice(-8)),
      };
      if (studyContext?.studySessionId) payload.studySessionId = studyContext.studySessionId;

      const headers = { "Content-Type": "application/json" };
      if (studyContext?.authToken) headers.Authorization = `Bearer ${studyContext.authToken}`;

      const res = await fetchWithTimeout(
        `${API_URL}/api/chat/`,
        { method: "POST", headers, body: JSON.stringify(payload) },
        CHAT_FETCH_TIMEOUT_MS,
      );
      const raw = await res.json().catch(() => ({}));
      if (raw.sessionLocked) {
        if (!lockEmittedRef.current) { lockEmittedRef.current = true; onStudyLocked?.(raw.lockReason || "time_cap"); }
        setIsLoading(false);
        return;
      }
      if (!res.ok) {
        const detail =
          (typeof raw.error === "string" && raw.error) ||
          (typeof raw.detail === "string" && raw.detail) ||
          `Não foi possível obter resposta (${res.status}).`;
        throw new Error(detail);
      }
      const replyText = (raw.reply ?? "").trim();
      if (!replyText) {
        throw new Error("O servidor devolveu uma resposta vazia.");
      }

      const botMsg = { from: "bot", text: replyText };
      setMessages((msgs) => [...msgs, botMsg]);
      saveMessageToBackend("bot", botMsg.text);
    } catch (err) {
      const detail = err instanceof Error ? err.message : "";
      const friendly =
        detail && detail.length < 400
          ? detail
          : "Desculpa, ocorreu um erro. Tenta novamente.";
      const errMsg = { from: "bot", text: friendly };
      setMessages((msgs) => [...msgs, errMsg]);
      saveMessageToBackend("bot", errMsg.text);
    } finally {
      setIsLoading(false);
      setIsWaiting(false);
    }
  };

  const handleTaskToggle = (taskId) => {
    setCheckedTasks((prev) => ({ ...prev, [taskId]: !prev[taskId] }));
  };

  const handleTaskNoteChange = (taskId, value) => {
    setTaskNotes((prev) => ({ ...prev, [taskId]: value }));
  };

  const hasActivitySheet = Boolean(currentSheet?.tasks?.length);
  const [sheetEndAttempted, setSheetEndAttempted] = useState(false);

  useActivitySheetAutosave({
    studySessionId: studyContext?.studySessionId,
    sessionForSheet: sessionForSheet,
    hasSheet: hasActivitySheet,
    checkedTasks,
    taskNotes,
    setCheckedTasks,
    setTaskNotes,
  });

  const checkedTaskCount = currentSheet?.tasks?.length
    ? countCompleteActivityTasks(currentSheet.tasks, checkedTasks, taskNotes)
    : 0;
  const hasCheckedWithoutNote =
    currentSheet?.tasks?.some(
      (t) => checkedTasks[t.id] && !String(taskNotes[t.id] ?? "").trim()
    ) ?? false;
  const submissionOkForEnd =
    !hasActivitySheet ||
    (checkedTaskCount >= requiredTasksForEnd && !hasCheckedWithoutNote);

  useEffect(() => {
    if (submissionOkForEnd) setSheetEndAttempted(false);
  }, [submissionOkForEnd]);

  const handleEndSessionClick = () => {
    if (isLoading) return;
    if (hasActivitySheet) setSheetEndAttempted(true);
    if (!submissionOkForEnd) return;
    onRequestEndSession?.(checkedTasks);
  };

  const inputDisabled = isLoading || !conversationId || (studyContext && secondsUntilLock !== null && secondsUntilLock <= 0);

  const drawerEmb = embedInTabletSplit ? " activity-drawer--embedded" : "";

  const sheetOpenClass =
    embedInTabletSplit && currentSheet && isActivityOpen ? " chat-screen--embedded--sheet-open" : "";

  return (
    <div
      className={`chat-screen${embedInTabletSplit ? " chat-screen--embedded" : ""}${sheetOpenClass}${
        isGenericCoachUi ? " chat-screen--generic-coach" : ""
      }`}
    >
      <span className="corner tl" aria-hidden="true"></span>
      <span className="corner tr" aria-hidden="true"></span>
      <span className="corner bl" aria-hidden="true"></span>
      <span className="corner br" aria-hidden="true"></span>

      <header className="chat-hero">
        <h1 className="hero-title xl">Vamos explorar um mundo de histórias!</h1>
        {!isGenericCoachUi ? (
          <p className="hero-sub">
            A conversar com {isPersonalised ? persona.name : "Reading Coach"}
          </p>
        ) : null}
        {studyContext?.globalSessionIndex != null ? (
          <p className="study-session-book-meta">
            Leitura da sessão: «Os Piratas» · Sessão {studyContext.globalSessionIndex}
          </p>
        ) : null}
        {studyContext?.showComprehension ? (
          <p className="session-rcq-cue" role="status">
            Nesta sessão, quando terminares, vais responder a perguntas sobre a história (compreensão).
            A ficha à direita abre automaticamente — usa-a durante a leitura.
          </p>
        ) : null}
        <div className="chat-status-bar">
          {studyContext && secondsUntilLock !== null && (
            <p
              className={`chat-timer${timerEndingFlash ? " chat-timer--ending-flash" : ""}`}
              role="status"
            >
              Tempo: {Math.floor(secondsUntilLock / 60)}:{String(secondsUntilLock % 60).padStart(2, "0")}
            </p>
          )}
          {studyContext && onRequestEndSession && (
            <button
              type="button"
              className="study-secondary-btn chat-end-btn"
              onClick={handleEndSessionClick}
              disabled={isLoading}
              title={
                !submissionOkForEnd
                  ? `Completa pelo menos ${requiredTasksForEnd} tarefas com resposta escrita na caixa.`
                  : undefined
              }
            >
              Terminar sessão
            </button>
          )}
        </div>
      </header>

      <div className="chat-and-activity-wrapper">
        {currentSheet ? (
          <>
            <button
              type="button"
              className={`activity-drawer-tab-fixed${drawerEmb} ${isActivityOpen ? "is-open" : ""}`}
              aria-expanded={isActivityOpen}
              aria-controls="activity-sheet-panel"
              onClick={() => setIsActivityOpen((o) => !o)}
            >
              <span className="activity-drawer-tab-chevron" aria-hidden>
                {isActivityOpen ? "›" : "‹"}
              </span>
              <span className="activity-drawer-tab-label">Ficha</span>
            </button>
            <aside
              id="activity-sheet-panel"
              className={`activity-drawer-panel-fixed${drawerEmb} ${isActivityOpen ? "is-open" : ""}`}
              aria-hidden={!isActivityOpen}
            >
              <ActivitySheetPanel
                currentSheet={currentSheet}
                checkedTasks={checkedTasks}
                onTaskToggle={handleTaskToggle}
                taskNotes={taskNotes}
                onTaskNoteChange={handleTaskNoteChange}
                requiredCheckedTasks={requiredTasksForEnd}
                highlightNoteErrors={sheetEndAttempted}
              />
            </aside>
          </>
        ) : null}

        <div className="chat-main-area">
          <div className="chat-body">
            <div className="messages" ref={listRef}>
              {messages.map((m, i) => {
                const isBot = m.from === "bot";
                return (
                  <div key={i} className={`msg-row ${isBot ? "left" : "right"}`}>
                    {(isBot ? showBotNameLabel : showUserNameLabel) ? (
                      <div
                        className={`name-label ${isBot ? "left" : "right"}`}
                        title={
                          !isBot && trimmedUsername && userLabelDisplay !== "User"
                            ? trimmedUsername
                            : undefined
                        }
                      >
                        {isBot ? persona.name : userLabelDisplay}
                        {!isBot && <span className="name-emoji" aria-hidden></span>}
                      </div>
                    ) : null}
                    {isBot ? (
                      isGenericCoachUi ? (
                        <div className="avatar-circle bot-avatar avatar-generic-coach" aria-hidden />
                      ) : (
                        <div className="avatar-circle bot-avatar" aria-hidden>
                          {persona.image && <img src={persona.image} alt={persona.name} className="avatar-img" />}
                        </div>
                      )
                    ) : isGenericCoachUi ? (
                      <div className="avatar-circle user-avatar avatar-generic-user" aria-hidden />
                    ) : (
                      <div className="avatar-circle user-avatar" aria-hidden>
                        <span className="user-avatar-text">{chatAvatarLetter(username)}</span>
                      </div>
                    )}
                    <div className={`bubble ${isBot ? "bot" : "user"}`}>{renderChatMessageText(m.text)}</div>
                  </div>
                );
              })}
              {isLoading && (
                <div className="msg-row left">
                  {showBotNameLabel ? <div className="name-label left">{persona.name}</div> : null}
                  {isGenericCoachUi ? (
                    <div className="avatar-circle bot-avatar avatar-generic-coach" aria-hidden />
                  ) : (
                    <div className="avatar-circle bot-avatar" aria-hidden>
                      {persona.image && <img src={persona.image} alt={persona.name} className="avatar-img" />}
                    </div>
                  )}
                  <div className="bubble bot"><em>...</em></div>
                </div>
              )}
              <LatencyCue isWaiting={isWaiting} />
              <div ref={endRef} />
            </div>
          </div>

          <footer className="chat-footer-stack">
            <div className="input-wrap">
              <input
                className="chat-input"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !inputDisabled && sendMessage()}
                placeholder={!conversationId ? "A preparar a conversa..." : inputDisabled ? "Tempo da sessão terminou." : "Escreve aqui..."}
                disabled={inputDisabled}
              />
              <button className="send-btn" onClick={sendMessage} disabled={inputDisabled} aria-label="Enviar" title="Enviar">
                <svg className="send-btn-icon" viewBox="0 0 24 24" aria-hidden>
                  <path fill="currentColor" d="M9 5.25L18.75 12 9 18.75z" />
                </svg>
              </button>
            </div>
            <div className="chat-nudge">
              <em>Lembra-te: as minhas respostas são automáticas. Verifica se os factos estão corretos!</em>
            </div>
            {studyContext && hasActivitySheet && !submissionOkForEnd ? (
              <p className="activity-submission-hint activity-submission-hint--inline" role="status">
                Completa pelo menos {requiredTasksForEnd} tarefas com resposta escrita na caixa para terminares
                a sessão. ({checkedTaskCount}/{requiredTasksForEnd})
              </p>
            ) : null}
          </footer>
        </div>
      </div>
    </div>
  );
}