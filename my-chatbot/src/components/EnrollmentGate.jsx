import React, { useState } from "react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";
const STUDY_LOGIN_CODE_KEY = "studyLoginCode";

// We removed the old rigid formatting so it perfectly supports formats like "AB-12"
function formatLoginCodeForDisplay(code) {
  if (!code) return "";
  return String(code).trim().toUpperCase();
}

export default function EnrollmentGate({ onEnrolled }) {
  const [loginCode, setLoginCode] = useState(
    () => localStorage.getItem(STUDY_LOGIN_CODE_KEY) || ""
  );
  
  const [mode, setMode] = useState(() =>
    localStorage.getItem(STUDY_LOGIN_CODE_KEY) ? "return" : "first"
  ); 
  
  const [code, setCode] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [pin, setPin] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [loginPin, setLoginPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [registeredInfo, setRegisteredInfo] = useState(null);

  const submitFirstTime = async (e) => {
    e.preventDefault();
    setError("");

    // 1. VALIDATION: Check if code contains "pers" or "gen"
    const lowerCode = code.trim().toLowerCase();
    if (!lowerCode.includes("pers") && !lowerCode.includes("gen")) {
      setError("Código inválido. Tem de incluir 'Pers' ou 'Gen'.");
      return;
    }

    // 2. VALIDATION: Check if PINs match
    if (pin.trim() !== pinConfirm.trim()) {
      setError("Os PINs não coincidem. Tenta novamente.");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch(`${API_URL}/api/study/register/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enrollmentCode: code.trim(),
          displayName: displayName.trim(),
          pin: pin.trim(),
          pinConfirm: pinConfirm.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Não foi possível registar.");
        return;
      }
      if (data.loginCode) {
        localStorage.setItem(STUDY_LOGIN_CODE_KEY, data.loginCode);
      }
      setRegisteredInfo({
        loginCode: data.loginCode,
        authToken: data.authToken,
      });
    } catch {
      setError("Não foi possível ligar ao servidor.");
    } finally {
      setBusy(false);
    }
  };

  const submitReturn = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const res = await fetch(`${API_URL}/api/study/login/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          loginCode: loginCode.trim(),
          pin: loginPin.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Código ou PIN incorretos.");
        return;
      }
      if (data.loginCode) {
        localStorage.setItem(STUDY_LOGIN_CODE_KEY, data.loginCode);
      }
      onEnrolled(data.authToken);
    } catch {
      setError("Não foi possível ligar ao servidor.");
    } finally {
      setBusy(false);
    }
  };

  if (registeredInfo) {
    return (
      <div className="auth-screen-container">
        <div className="study-enroll">
          <h1 className="hero-title xl" style={{textAlign: "center", marginBottom: "16px"}}>Guarda estes dados</h1>
          <p className="hero-sub" style={{textAlign: "center", marginBottom: "24px"}}>
            Usa o <strong>código</strong> e o <strong>PIN</strong> da próxima vez em "Já estive aqui".
          </p>
          <div className="enroll-success-card" style={{background: "#f8fafc", padding: "24px", borderRadius: "12px", textAlign: "center", marginBottom: "24px", border: "1px solid #e2e8f0"}}>
            <p className="enroll-success-label" style={{fontSize: "14px", color: "#64748b", margin: "0 0 8px 0"}}>O teu código de regresso</p>
            <p className="enroll-success-code" aria-live="polite" style={{fontSize: "32px", fontWeight: "800", color: "#1e293b", margin: "0 0 16px 0", letterSpacing: "2px"}}>
              {formatLoginCodeForDisplay(registeredInfo.loginCode)}
            </p>
            <p className="hero-sub" style={{fontSize: "13px"}}>
              Anota também o PIN que escolheste (não o mostramos de novo).
            </p>
          </div>
          <button
            type="button"
            className="study-primary-btn"
            style={{width: "100%"}}
            onClick={() => onEnrolled(registeredInfo.authToken)}
          >
            Entrar no estudo
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-screen-container">
      <div className="study-enroll">
        <h1 className="hero-title xl" style={{textAlign: "center", marginBottom: "24px"}}>Entrar no estudo</h1>
        
        <div className="enroll-mode-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={mode === "return"}
            className={`enroll-tab ${mode === "return" ? "enroll-tab-active" : ""}`}
            onClick={() => {
              setMode("return");
              setError("");
            }}
          >
            Já estive aqui
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "first"}
            className={`enroll-tab ${mode === "first" ? "enroll-tab-active" : ""}`}
            onClick={() => {
              setMode("first");
              setError("");
            }}
          >
            Primeira vez
          </button>
        </div>

        {mode === "return" ? (
          <form key="enroll-return" onSubmit={submitReturn} className="enroll-form" autoComplete="on">
            <p className="hero-sub enroll-mode-hint" style={{textAlign: "center", marginBottom: "24px"}}>
              Insere o teu código de participante e o PIN que criaste na primeira sessão.
            </p>
            
            <div className="input-group">
              <label htmlFor="study-return-login-code">Código de regresso (ex: AB-12)</label>
              <input
                id="study-return-login-code"
                className="enroll-field-input"
                type="text"
                value={loginCode}
                onChange={(e) => setLoginCode(e.target.value)}
                autoComplete="username"
                autoCapitalize="characters"
                required
              />
            </div>
            
            <div className="input-group">
              <label htmlFor="study-return-pin">PIN (ex: AB-12)</label>
              {/* Changed type to text so children can see letters/dashes while typing */}
              <input
                id="study-return-pin"
                className="enroll-field-input"
                type="text"
                value={loginPin}
                onChange={(e) => setLoginPin(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>
            
            {error ? <p className="enroll-error">{error}</p> : null}
            <button type="submit" className="study-primary-btn" disabled={busy} style={{marginTop: "8px"}}>
              {busy ? "A entrar…" : "Entrar e continuar"}
            </button>
          </form>
        ) : (
          <form key="enroll-first" onSubmit={submitFirstTime} className="enroll-form" autoComplete="off">
            <p className="hero-sub enroll-mode-hint" style={{textAlign: "center", marginBottom: "24px", lineHeight: "1.5"}}>
              Usa o <strong>código de inscrição</strong> que o estudo te deu.
              <br/><br/>
              <span className="enroll-hint-secondary" style={{fontSize: "13px"}}>
                (Tem de incluir a palavra "Pers" ou "Gen")
              </span>
            </p>
            
            <div className="input-group">
              <label htmlFor="study-enrollment-code">Código de inscrição ao estudo</label>
              <input
                id="study-enrollment-code"
                className="enroll-field-input"
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                autoComplete="off"
                required
              />
            </div>
            
            <div className="input-group">
              <label htmlFor="study-enroll-display-name">Nome (opcional)</label>
              <input
                id="study-enroll-display-name"
                className="enroll-field-input"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                autoComplete="name"
              />
            </div>
            
            <div className="input-group">
              <label htmlFor="study-enroll-pin">Cria um PIN (ex: AB-12)</label>
              {/* Changed type to text for easier input validation by the child */}
              <input
                id="study-enroll-pin"
                className="enroll-field-input"
                type="text"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                autoComplete="new-password"
                required
              />
            </div>
            
            <div className="input-group">
              <label htmlFor="study-enroll-pin-confirm">Confirmar PIN</label>
              <input
                id="study-enroll-pin-confirm"
                className="enroll-field-input"
                type="text"
                value={pinConfirm}
                onChange={(e) => setPinConfirm(e.target.value)}
                autoComplete="new-password"
                required
              />
            </div>
            
            {error ? <p className="enroll-error">{error}</p> : null}
            <button type="submit" className="study-primary-btn" disabled={busy} style={{marginTop: "8px"}}>
              {busy ? "A criar conta…" : "Criar e continuar"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}