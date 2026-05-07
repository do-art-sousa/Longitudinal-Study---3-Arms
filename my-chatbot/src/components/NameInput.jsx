import React, { useEffect, useState } from "react";

const MAX_NAME_LEN = 48;

export default function NameInput({ onSubmit, enrollmentName = "" }) {
  const [name, setName] = useState("");

  useEffect(() => {
    const seed = (enrollmentName || "").trim();
    if (seed) {
      setName(seed.slice(0, MAX_NAME_LEN));
      return;
    }
    const saved = localStorage.getItem("userName");
    if (saved && saved.trim()) setName(saved.slice(0, MAX_NAME_LEN));
  }, [enrollmentName]);

  const handleSubmit = () => {
    const trimmed = name.trim().slice(0, MAX_NAME_LEN);
    if (!trimmed) return;

    localStorage.setItem("userName", trimmed);
    onSubmit(trimmed);
  };

  return (
    <div className="name-input-screen">
      <div className="name-input-header minimal">
        <h1 className="hero-title">Agente de Compreensão de Leitura</h1>
        <p className="hero-sub">Bem-vindo!</p>
      </div>

      <div className="name-input-center">
        <div className="name-card flat">
          <input
            id="username"
            className="name-input name-input-underline"
            type="text"
            value={name}
            autoFocus
            maxLength={MAX_NAME_LEN}
            onChange={(e) => setName(e.target.value.slice(0, MAX_NAME_LEN))}
            placeholder="Escreve o teu nome..."
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          />
          <button
            className="outline-gradient-btn"
            onClick={handleSubmit}
            disabled={!name.trim()}
          >
            Continuar
          </button>
        </div>
      </div>
    </div>
  );
}
