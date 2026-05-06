import React, { useState } from "react";
import { rcqData } from "../data/rcq_data";
import { REQ_ITEMS } from "../data/req_data";
import {
  CAIQ_PANAS_INSTRUCTION,
  PANAS_INSTRUCTION,
  LIKERT_SCALE,
  PANAS_LIKERT_SCALE,
  getSurveyForSession,
  calculateSurveyScores,
} from "../data/caiq_panas_data";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

function LikertRow({ label, fieldId, value, onChange, scale = LIKERT_SCALE }) {
  return (
    <div className="likert-row">
      <span id={fieldId}>{label}</span>
      <div className="likert-scale" role="group" aria-labelledby={fieldId}>
        {scale.map((option) => (
          <label key={option.value} className="likert-opt" title={option.label}>
            <input
              type="radio"
              name={fieldId}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
            />
            <span className="likert-emoji">{option.emoji || option.value}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

export default function PostSessionSurvey({
  authToken,
  studySessionId,
  /** 1-based index across the study (week×slot); drives RCQ blocks 3 / 6 / 9 and PANAS variant. */
  globalSessionIndex: globalSessionIndexProp,
  /** Within-week slot 1–3 (optional, for display only). */
  slotIndex: slotIndexProp,
  condition = "generic",
  endReason,
  onDone,
  onCancel,
}) {
  const globalSessionIndex = globalSessionIndexProp ?? slotIndexProp ?? 1;
  const isControl = condition === "control";

  const currentRcq = rcqData[globalSessionIndex];
  const caiqPanasSurvey = getSurveyForSession(globalSessionIndex);
  const hasRcq = Boolean(currentRcq);

  const [rcqResponses, setRcqResponses] = useState({});
  const [surveyResponses, setSurveyResponses] = useState({});
  const [reqResponses, setReqResponses] = useState({});
  const [likertResponses, setLikertResponses] = useState({
    rapport: null,
    closeness: null,
    flow: null,
  });
  const [currentStep, setCurrentStep] = useState(() => (hasRcq ? "rcq" : "survey"));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const handleRcqChange = (id, value) => {
    setRcqResponses((prev) => ({ ...prev, [id]: value }));
  };

  const handleSurveyChange = (id, value) => {
    setSurveyResponses((prev) => ({ ...prev, [id]: value }));
  };

  const handleReqChange = (id, value) => {
    setReqResponses((prev) => ({ ...prev, [id]: value }));
  };

  const handleLikertChange = (id, value) => {
    setLikertResponses((prev) => ({ ...prev, [id]: value }));
  };

  const validateRcq = () => {
    if (!currentRcq) return true;
    return currentRcq.questions.every((q) => rcqResponses[q.id]?.trim());
  };

  const validateReq = () => {
    if (!isControl) return true;
    return REQ_ITEMS.every(
      (item) =>
        reqResponses[item.id] !== undefined &&
        reqResponses[item.id] !== null &&
        reqResponses[item.id] !== ""
    );
  };

  const validateLikert = () => {
    return ["rapport", "closeness", "flow"].every(
      (key) => Number.isInteger(likertResponses[key])
    );
  };

  const validateSurvey = () => {
    if (!validateLikert()) {
      return false;
    }
    if (!caiqPanasSurvey) {
      return isControl ? validateReq() : true;
    }
    const items = isControl
      ? caiqPanasSurvey.panas_items
      : [...caiqPanasSurvey.caiq_items, ...caiqPanasSurvey.panas_items];
    const panasOk = items.every(
      (item) =>
        surveyResponses[item.id] !== undefined &&
        surveyResponses[item.id] !== null &&
        surveyResponses[item.id] !== ""
    );
    if (!panasOk) return false;
    return validateReq();
  };

  const handleNextStep = () => {
    setError("");
    if (currentStep === "rcq") {
      if (!validateRcq()) {
        setError("Por favor responde a todas as perguntas de compreensão.");
        return;
      }
      setCurrentStep("survey");
    }
  };

  const handlePreviousStep = () => {
    setError("");
    if (currentStep === "survey" && hasRcq) {
      setCurrentStep("rcq");
    }
  };

  const buildReqScores = () => {
    const out = {};
    for (const item of REQ_ITEMS) {
      out[item.id] = Number(reqResponses[item.id]);
    }
    return out;
  };

  const submit = async (e) => {
    e.preventDefault();
    setError("");

    if (!validateSurvey()) {
      setError(
        isControl
          ? "Por favor responde a Likert, PANAS e experiência de leitura."
          : "Por favor responde a Likert e a todas as perguntas do questionário."
      );
      return;
    }

    setBusy(true);
    try {
      const body = {
        studySessionId,
        endReason: endReason || "completed_content",
        likert: {
          rapport: likertResponses.rapport,
          closeness: likertResponses.closeness,
          flow: likertResponses.flow,
        },
      };

      if (currentRcq) {
        body.comprehension = rcqResponses;
      }

      if (caiqPanasSurvey) {
        const scores = calculateSurveyScores(
          surveyResponses,
          caiqPanasSurvey.version
        );
        body.caiq_panas = {
          version: caiqPanasSurvey.version,
          responses: surveyResponses,
          scores,
          timestamp: new Date().toISOString(),
        };
      }

      if (isControl) {
        body.req_scores = buildReqScores();
      }

      const res = await fetch(`${API_URL}/api/study/session/complete/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify(body),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Erro ao guardar");
        return;
      }
      onDone(data);
    } catch {
      setError("Erro de rede.");
    } finally {
      setBusy(false);
    }
  };

  if (currentStep === "rcq" && currentRcq) {
    return (
      <div className="post-survey">
        <h2 className="hero-title">Compreensão de leitura</h2>
        <p className="hero-sub">
          Responde de forma honesta — não há respostas certas ou erradas.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleNextStep();
          }}
          className="survey-form"
        >
          <div>
            {currentRcq.questions.map((q) => (
              <div key={q.id} className="rcq-question" style={{ marginBottom: "20px" }}>
                <label style={{ display: "block", fontWeight: "500", marginBottom: "8px" }}>
                  {q.text}
                </label>
                <textarea
                  className="survey-textarea"
                  rows={3}
                  value={rcqResponses[q.id] || ""}
                  onChange={(e) => handleRcqChange(q.id, e.target.value)}
                  required
                />
              </div>
            ))}
          </div>

          {error ? <p className="enroll-error">{error}</p> : null}
          <div className="survey-actions">
            <button type="button" className="study-secondary-btn" onClick={onCancel}>
              Cancelar
            </button>
            <button type="submit" className="study-primary-btn" disabled={busy}>
              {busy ? "A processar…" : "Continuar"}
            </button>
          </div>
        </form>
      </div>
    );
  }

  if (caiqPanasSurvey) {
    return (
      <div className="post-survey">
        <h2 className="hero-title">
          {isControl ? "Questionários da sessão" : "Questionário de satisfação"}
        </h2>
        {!isControl ? (
          <>
            <p className="hero-sub" style={{ marginBottom: "8px" }}>
              {CAIQ_PANAS_INSTRUCTION}
            </p>
            <div
              style={{
                fontStyle: "italic",
                fontSize: "0.9em",
                color: "#64748b",
                marginBottom: "24px",
              }}
            >
              😢 Discordo totalmente | 😕 Discordo | 😐 Neutro | 🙂 Concordo | 😊 Concordo totalmente
            </div>
          </>
        ) : (
          <p className="hero-sub" style={{ marginBottom: "16px" }}>
            Indica como te sentiste durante a leitura e a interação (escala 1–5 em cada dimensão).
          </p>
        )}

        <form onSubmit={submit} className="survey-form">
          <div className="survey-section" style={{ marginTop: "8px" }}>
            <h3 className="survey-section-title" style={{ marginBottom: "8px" }}>
              Feedback rápido da sessão
            </h3>
            <LikertRow
              fieldId="likert_rapport"
              label="Senti ligação com o meu companheiro de leitura."
              value={likertResponses.rapport}
              onChange={(value) => handleLikertChange("rapport", value)}
              scale={LIKERT_SCALE}
            />
            <LikertRow
              fieldId="likert_closeness"
              label="Senti proximidade durante a interação."
              value={likertResponses.closeness}
              onChange={(value) => handleLikertChange("closeness", value)}
              scale={LIKERT_SCALE}
            />
            <LikertRow
              fieldId="likert_flow"
              label="A sessão fluiu de forma natural para mim."
              value={likertResponses.flow}
              onChange={(value) => handleLikertChange("flow", value)}
              scale={LIKERT_SCALE}
            />
          </div>

          {!isControl ? (
            <div className="survey-section">
              {caiqPanasSurvey.caiq_items.map((item) => (
                <LikertRow
                  key={item.id}
                  fieldId={item.id}
                  label={item.text}
                  value={surveyResponses[item.id] || ""}
                  onChange={(value) => handleSurveyChange(item.id, value)}
                  scale={LIKERT_SCALE}
                />
              ))}
            </div>
          ) : null}

          <div className="survey-section" style={{ marginTop: isControl ? 0 : "32px" }}>
            <h3 className="survey-section-title" style={{ marginBottom: "8px" }}>
              {PANAS_INSTRUCTION}
            </h3>
            <div
              style={{
                fontStyle: "italic",
                fontSize: "0.9em",
                color: "#64748b",
                marginBottom: "24px",
              }}
            >
              1 = Nada ou muito pouco | 2 = Um pouco | 3 = Moderadamente | 4 = Bastante | 5 = Muitíssimo
            </div>
            {caiqPanasSurvey.panas_items.map((item) => (
              <LikertRow
                key={item.id}
                fieldId={item.id}
                label={item.text}
                value={surveyResponses[item.id] || ""}
                onChange={(value) => handleSurveyChange(item.id, value)}
                scale={PANAS_LIKERT_SCALE}
              />
            ))}
          </div>

          {isControl ? (
            <div className="survey-section" style={{ marginTop: "32px" }}>
              <h3 className="survey-section-title" style={{ marginBottom: "8px" }}>
                Experiência de leitura (REQ)
              </h3>
              <div
                style={{
                  fontStyle: "italic",
                  fontSize: "0.9em",
                  color: "#64748b",
                  marginBottom: "24px",
                }}
              >
                1 = Discordo totalmente … 5 = Concordo totalmente
              </div>
              {REQ_ITEMS.map((item) => (
                <LikertRow
                  key={item.id}
                  fieldId={`req_${item.id}`}
                  label={item.text}
                  value={reqResponses[item.id] || ""}
                  onChange={(value) => handleReqChange(item.id, value)}
                  scale={PANAS_LIKERT_SCALE}
                />
              ))}
            </div>
          ) : null}

          {error ? <p className="enroll-error">{error}</p> : null}
          <div className="survey-actions">
            <button
              type="button"
              className="study-secondary-btn"
              onClick={hasRcq ? handlePreviousStep : onCancel}
            >
              {hasRcq ? "Voltar" : "Cancelar"}
            </button>
            <button type="submit" className="study-primary-btn" disabled={busy}>
              {busy ? "A guardar…" : "Submeter"}
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="post-survey">
      <h2 className="hero-title">Sessão completa</h2>
      <p className="hero-sub">Obrigado pela participação!</p>
      <div className="survey-actions">
        <button type="button" className="study-primary-btn" onClick={() => onDone({})}>
          Terminar
        </button>
      </div>
    </div>
  );
}
