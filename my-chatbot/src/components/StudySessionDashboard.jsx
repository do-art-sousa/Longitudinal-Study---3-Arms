import React, { useState, useEffect, useCallback, useMemo } from "react";
import { defaultCharacter, characters } from "../data/characters";
import NameInput from "./NameInput.jsx";
import CharacterSelection from "./CharacterSelection.jsx";
import Chat from "./Chat.jsx";
import PostSessionSurvey from "./PostSessionSurvey.jsx";
import ControlStudyInteraction from "./ControlStudyInteraction.jsx";
import { clearActivitySheetDraft } from "../utils/activitySheetDraft.js";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

async function studyFetch(path, authToken, options = {}) {
  const headers = {
    ...(options.headers || {}),
    Authorization: `Bearer ${authToken}`,
  };
  if (options.body && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }
  return fetch(`${API_URL}${path}`, { ...options, headers });
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

export default function StudySessionDashboard({ authToken, onLogout }) {
  const [progress, setProgress] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [username, setUsername] = useState(
    () => localStorage.getItem("userName") || ""
  );
  const [selectedCharacter, setSelectedCharacter] = useState(readStoredCharacterKey);
  const [phase, setPhase] = useState("lobby"); // lobby | name | character | chat | survey
  const [playPayload, setPlayPayload] = useState(null);
  const [surveyCtx, setSurveyCtx] = useState(null);

  const loadProgress = useCallback(async () => {
    setErr("");
    const res = await studyFetch("/api/study/progress/", authToken);
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
      const res = await studyFetch("/api/study/progress/", authToken);
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
    const initialRaw =
      condition === "control"
        ? ""
        : nameForSession
          ? persona.initialMessage.replace("{username}", nameForSession)
          : persona.initialMessage;

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
              ? "Esta sessão não está disponível ainda."
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
