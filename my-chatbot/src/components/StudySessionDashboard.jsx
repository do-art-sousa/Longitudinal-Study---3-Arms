import React, { useState, useEffect, useCallback, useMemo } from "react";
import { defaultCharacter, characters } from "../data/characters";
import NameInput from "./NameInput.jsx";
import CharacterSelection from "./CharacterSelection.jsx";
import Chat from "./Chat.jsx";
import PostSessionSurvey from "./PostSessionSurvey.jsx";
import ControlStudyInteraction from "./ControlStudyInteraction.jsx";
import { clearActivitySheetDraft } from "../utils/activitySheetDraft.js";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

/** Network call timeout (ms) — prevents the UI from hanging on flaky tablet Wi-Fi. */
const STUDY_FETCH_TIMEOUT_MS = 10_000;

async function studyFetch(path, authToken, options = {}) {
  const headers = {
    ...(options.headers || {}),
    Authorization: `Bearer ${authToken}`,
  };
  if (options.body && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }
  // AbortController + timeout: if the backend doesn't respond, throw instead of hang.
  // External AbortSignal (if the caller passed one) wins; otherwise we own the timeout.
  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(new DOMException("timeout", "AbortError")),
    options.timeoutMs || STUDY_FETCH_TIMEOUT_MS,
  );
  try {
    return await fetch(`${API_URL}${path}`, {
      ...options,
      headers,
      signal: options.signal || controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

const STUDY_CHARACTER_KEY = "studySelectedCharacter";

function readStoredCharacterKey() {
  const k = localStorage.getItem(STUDY_CHARACTER_KEY);
  if (k && characters[k]) return k;
  return null;
}

function characterDisplayName(key) {
  if (!key) return "";
  const persona = key === "default" ? defaultCharacter : characters[key];
  return persona?.name || key;
}

/** Renders backend `nextAvailableAt` (ISO string) as a child-friendly hint:
 *  "amanhã" if it's the next calendar day in the user's locale,
 *  "no dia DD/MM" otherwise. Falls back to the raw string on any error. */
function formatNextAvailable(iso) {
  try {
    const target = new Date(iso);
    if (Number.isNaN(target.getTime())) return iso;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const targetDay = new Date(target);
    targetDay.setHours(0, 0, 0, 0);
    const oneDay = 86_400_000;
    const diffDays = Math.round((targetDay - today) / oneDay);
    if (diffDays <= 0) return "em breve";
    if (diffDays === 1) return "amanhã";
    return `no dia ${String(targetDay.getDate()).padStart(2, "0")}/${String(
      targetDay.getMonth() + 1
    ).padStart(2, "0")}`;
  } catch {
    return iso;
  }
}

/** Child-friendly message shown when the backend is unreachable from a tablet. */
const CONNECTION_FAILED_MESSAGE =
  "Não conseguimos ligar agora. Pede ajuda a um adulto e tenta outra vez.";

export default function StudySessionDashboard({ authToken, onLogout }) {
  const [progress, setProgress] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  /** Set when the network call fails (offline, server down, timeout). Shows the retry screen. */
  const [connectionError, setConnectionError] = useState(false);
  const [username, setUsername] = useState(
    () => localStorage.getItem("userName") || ""
  );
  const [selectedCharacter, setSelectedCharacter] = useState(readStoredCharacterKey);
  const [phase, setPhase] = useState("lobby"); // lobby | name | character | chat | survey
  const [playPayload, setPlayPayload] = useState(null);
  const [surveyCtx, setSurveyCtx] = useState(null);

  const loadProgress = useCallback(async () => {
    setErr("");
    setConnectionError(false);
    let res;
    try {
      res = await studyFetch("/api/study/progress/", authToken);
    } catch {
      // Network error / timeout / browser offline — surface a friendly retry screen
      // instead of leaving the child stuck on "A carregar…".
      setConnectionError(true);
      return;
    }
    if (res.status === 401) {
      onLogout();
      return;
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setErr(data.error || "Erro ao carregar progresso");
      return;
    }
    setProgress(data);
  }, [authToken, onLogout]);

  /**
   * Sync enrollment display name into the lobby for personalized arms.
   * Generic arm: do not copy enrollment into `username` — chat must show "User" unless the child
   * enters a name in-session (name step); enrollment-only names should not appear in the chat label.
   */
  useEffect(() => {
    const dn = progress?.displayName?.trim();
    if (!dn) return;
    if (progress?.condition === "generic") return;
    setUsername(dn);
    localStorage.setItem("userName", dn);
  }, [progress?.displayName, progress?.condition]);

  /** Clear stale browser name when loading a generic participant (e.g. previously synced enrollment). */
  useEffect(() => {
    if (progress?.condition !== "generic") return;
    setUsername("");
    localStorage.removeItem("userName");
  }, [progress?.condition]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setConnectionError(false);
      let res;
      try {
        res = await studyFetch("/api/study/progress/", authToken);
      } catch {
        // Backend unreachable: don't leave the tablet stuck on "A carregar…".
        if (!cancelled) {
          setConnectionError(true);
          setLoading(false);
        }
        return;
      }
      if (cancelled) return;
      if (res.status === 401) {
        onLogout();
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(data.error || "Erro ao carregar progresso");
        setLoading(false);
        return;
      }
      setProgress(data);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [authToken, onLogout]);

  /** Retry handler used by the "Tentar outra vez" button on the connection-failed screen. */
  const retryLoad = useCallback(async () => {
    setLoading(true);
    setConnectionError(false);
    setErr("");
    try {
      await loadProgress();
    } finally {
      setLoading(false);
    }
  }, [loadProgress]);

  const condition = progress?.condition;
  const personalized = condition === "personalized";
  const skipChat = progress?.skipChat === true;
  const needCharacter =
    progress?.allowCharacterSelection && personalized;

  /** Stable reference for Chat / control shell — avoids unnecessary context churn to children. */
  const studyChatSessionContext = useMemo(() => {
    if (phase !== "chat" || !playPayload) return null;
    return {
      authToken,
      studySessionId: playPayload.studySessionId,
      conversationId: playPayload.conversationId,
      sessionStartedAtISO: playPayload.sessionStartedAt,
      maxSessionMinutes: playPayload.maxSessionMinutes,
      initialMessages: playPayload.messages,
      slotIndex: playPayload.slotIndex,
      globalSessionIndex: playPayload.globalSessionIndex,
      showComprehension: playPayload.showComprehension === true,
    };
  }, [phase, authToken, playPayload]);

  const beginStartFlow = () => {
    if (needCharacter && !username?.trim()) {
      setPhase("name");
      return;
    }
    if (needCharacter && !selectedCharacter) {
      setPhase("character");
      return;
    }
    startSession();
  };

  const startSession = async () => {
    setErr("");
    const focusId = progress?.focusSessionId;
    if (!focusId) {
      setErr("Não há sessão disponível.");
      return;
    }

    if (needCharacter && !selectedCharacter) {
      setErr("Escolhe um personagem antes de começar.");
      setPhase("character");
      return;
    }

    const charKey = needCharacter
      ? selectedCharacter
      : progress?.defaultCharacter || "default";
    const persona =
      charKey === "default" ? defaultCharacter : characters[charKey];
    const nameForSession =
      condition === "generic"
        ? username?.trim() || ""
        : username?.trim() || progress?.displayName?.trim() || "";
    // Generic arm behaves like a vanilla GenAI: no opener from the bot, the
    // user types first. Control has no chat. Personalized keeps the persona's
    // opening line — with two flavours:
    //   • Session 1 (first meeting): persona.initialMessage
    //   • Sessions 2–9 (returning): persona.returningMessage if defined,
    //     otherwise fall back to initialMessage.
    // {username} is substituted in either template when a name is available.
    const sessionNumber = progress?.focusGlobalSessionIndex ?? 1;
    const isReturningSession = sessionNumber > 1;
    const messageTemplate =
      isReturningSession && persona.returningMessage
        ? persona.returningMessage
        : persona.initialMessage;
    const initialRaw =
      condition === "control" || condition === "generic"
        ? ""
        : nameForSession
          ? messageTemplate.replace("{username}", nameForSession)
          : messageTemplate.replace("{username}", "");

    const startBody = {
      studySessionId: focusId,
      character: charKey,
    };
    const trimmedLobbyName = username?.trim();
    if (trimmedLobbyName) {
      startBody.userName = trimmedLobbyName;
    }
    if (initialRaw) {
      startBody.initialMessage = initialRaw;
    }

    const res = await studyFetch("/api/study/session/start/", authToken, {
      method: "POST",
      body: JSON.stringify(startBody),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setErr(data.error || "Não foi possível iniciar a sessão");
      return;
    }

    const userNameForChat =
      condition === "generic"
        ? username?.trim() || "User"
        : (() => {
            const resolved = (
              data.userName ||
              username?.trim() ||
              progress?.displayName?.trim() ||
              ""
            ).trim();
            return resolved || "Participant";
          })();

    setPlayPayload({
      studySessionId: data.studySessionId,
      conversationId: data.conversationId,
      messages: data.messages || [],
      sessionStartedAt: data.sessionStartedAt,
      maxSessionMinutes: progress?.maxSessionMinutes ?? 20,
      weekIndex: progress?.focusWeekIndex,
      slotIndex: progress?.focusSlotIndex ?? 1,
      globalSessionIndex:
        progress?.focusGlobalSessionIndex ??
        (progress?.focusWeekIndex && progress?.focusSlotIndex
          ? (progress.focusWeekIndex - 1) * 3 + progress.focusSlotIndex
          : 1),
      character: data.character || charKey,
      userName: userNameForChat,
      showComprehension: progress?.showComprehension === true,
    });
    setPhase("chat");
  };

  const handleSurveyDone = async () => {
    if (playPayload?.studySessionId) {
      clearActivitySheetDraft(playPayload.studySessionId);
    }
    setSurveyCtx(null);
    setPlayPayload(null);
    setPhase("lobby");
    await loadProgress();
  };

  // Connection failed: show a child-friendly retry screen instead of the spinner.
  // This is the screen children see on tablets when the Wi-Fi blips or the server
  // is briefly unreachable — without it the UI hangs forever on "A carregar…".
  if (connectionError) {
    return (
      <div className="study-lobby">
        <header className="chat-hero">
          <h1 className="hero-title xl">Sem ligação 📡</h1>
          <p className="hero-sub">{CONNECTION_FAILED_MESSAGE}</p>
        </header>
        <div className="toolbar study-toolbar">
          <button
            type="button"
            className="study-primary-btn"
            onClick={retryLoad}
            disabled={loading}
          >
            {loading ? "A tentar…" : "Tentar outra vez"}
          </button>
        </div>
      </div>
    );
  }

  if (loading && !progress) {
    return (
      <div className="study-lobby">
        <p>A carregar…</p>
      </div>
    );
  }

  if (phase === "name") {
    return (
      <div className="study-lobby">
        <NameInput
          enrollmentName={progress?.displayName || ""}
          onSubmit={(name) => {
            setUsername(name);
            localStorage.setItem("userName", name);
            setPhase("character");
          }}
        />
        <div className="toolbar">
          <button type="button" className="study-secondary-btn" onClick={() => setPhase("lobby")}>
            Voltar
          </button>
        </div>
      </div>
    );
  }

  if (phase === "character") {
    return (
      <div className="study-lobby">
        <CharacterSelection
          onSelect={(key) => {
            setSelectedCharacter(key);
            localStorage.setItem(STUDY_CHARACTER_KEY, key);
            setPhase("lobby");
          }}
        />
        <div className="toolbar">
          <button type="button" className="study-secondary-btn" onClick={() => setPhase("lobby")}>
            Voltar
          </button>
        </div>
      </div>
    );
  }

  if (phase === "survey" && surveyCtx && playPayload) {
    return (
      <PostSessionSurvey
        authToken={authToken}
        studySessionId={playPayload.studySessionId}
        slotIndex={surveyCtx.slotIndex}
        globalSessionIndex={surveyCtx.globalSessionIndex}
        condition={surveyCtx.condition || condition || "generic"}
        endReason={surveyCtx.endReason}
        onDone={handleSurveyDone}
        onCancel={() => {
          setSurveyCtx(null);
          setPhase("chat");
        }}
      />
    );
  }

  if (phase === "chat" && playPayload) {
    const goSurvey = (endReason) => {
      setSurveyCtx({
        slotIndex: playPayload.slotIndex,
        globalSessionIndex: playPayload.globalSessionIndex,
        condition,
        endReason,
      });
      setPhase("survey");
    };

    return (
      <div className="tablet-session-shell tablet-session-shell--full-interaction">
        <div className="tablet-interaction-zone">
          {skipChat ? (
            <ControlStudyInteraction
              studyCondition={condition}
              studyContext={studyChatSessionContext}
              showComprehension={playPayload.showComprehension === true}
              slotIndex={playPayload.slotIndex}
              globalSessionIndex={playPayload.globalSessionIndex}
              onStudyLocked={(reason) => {
                goSurvey(reason === "time_cap" ? "time_cap" : "inactive_timeout");
              }}
              onRequestEndSession={() => goSurvey("completed_content")}
            />
          ) : (
            <Chat
              key={playPayload.studySessionId}
              selectedCharacter={playPayload.character}
              username={playPayload.userName}
              studyCondition={condition}
              embedInTabletSplit
              studyContext={studyChatSessionContext}
              onStudyLocked={(reason) => {
                goSurvey(reason === "time_cap" ? "time_cap" : "inactive_timeout");
              }}
              onRequestEndSession={() => goSurvey("completed_content")}
            />
          )}
        </div>
      </div>
    );
  }

  const focus = progress?.focusStatus;
  const canStart =
    progress?.focusSessionId &&
    (focus === "available" || focus === "in_progress");

  const personalizedReady =
    !needCharacter ||
    (Boolean(username?.trim()) && Boolean(selectedCharacter));

  const handleLogout = () => {
    localStorage.removeItem(STUDY_CHARACTER_KEY);
    localStorage.removeItem("studyLoginCode");
    onLogout();
  };

  let primaryButtonLabel = "Começar sessão";
  if (canStart) {
    if (!needCharacter) {
      primaryButtonLabel =
        focus === "in_progress" ? "Continuar sessão" : "Começar sessão";
    } else if (!username?.trim()) {
      primaryButtonLabel = "Introduz o teu nome para continuar";
    } else if (!selectedCharacter) {
      primaryButtonLabel = "Escolhe um personagem para continuar";
    } else {
      primaryButtonLabel = characterDisplayName(selectedCharacter);
    }
  }

  return (
    <div className="study-lobby">
      <header className="chat-hero">
        <h1 className="hero-title xl">O teu progresso</h1>
        <p className="hero-sub">
          Condição: <strong>{condition}</strong>
          {progress?.releasedWeekIndex != null
            ? ` · Semana do estudo liberada: ${progress.releasedWeekIndex}`
            : null}
        </p>
      </header>

      {err ? <p className="enroll-error">{err}</p> : null}

      <ul className="session-list">
        {(progress?.sessions || []).map((s) => (
          <li
            key={s.id}
            className={
              s.id === progress?.focusSessionId ? "session-focus" : ""
            }
          >
            Semana {s.weekIndex} · Sessão {s.slotIndex}: <strong>{s.status}</strong>
          </li>
        ))}
      </ul>

      <div className="toolbar study-toolbar">
        {canStart ? (
          <button
            type="button"
            className="study-primary-btn"
            onClick={beginStartFlow}
          >
            {primaryButtonLabel}
          </button>
        ) : (
          <p className="hero-sub">
            {progress?.focusSessionId
              ? progress?.nextAvailableAt
                ? `Esta sessão fica disponível ${formatNextAvailable(progress.nextAvailableAt)}.`
                : "Esta sessão não está disponível ainda."
              : progress?.message || "Sem sessões em curso."}
          </p>
        )}
        {needCharacter && personalizedReady ? (
          <button
            type="button"
            className="study-secondary-btn"
            onClick={() => setPhase(username?.trim() ? "character" : "name")}
          >
            Alterar nome ou personagem
          </button>
        ) : null}
        <button type="button" className="study-secondary-btn" onClick={handleLogout}>
          Sair (novo código)
        </button>
      </div>
    </div>
  );
}
