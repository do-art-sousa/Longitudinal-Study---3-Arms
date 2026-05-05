import React from "react";
import { characters } from "../data/characters";

export default function CharacterSelection({ onSelect }) {
  return (
    <div className="character-selection-screen">
      <span className="corner tl" aria-hidden="true"></span>
      <span className="corner tr" aria-hidden="true"></span>
      <span className="corner bl" aria-hidden="true"></span>
      <span className="corner br" aria-hidden="true"></span>

      <div className="character-selection-content">
        <div className="character-selection-header">
          <h1 className="hero-title">Escolhe o teu personagem</h1>
          <p className="hero-sub">Com quem queres conversar?</p>
        </div>

        <div className="character-grid">
          {Object.entries(characters).map(([key, c]) => (
            <button
              key={key}
              className="character-card image-only"
              onClick={() => onSelect(key)}
              aria-label={`Selecionar ${c.name}`}
              title={c.name}
            >
              {c.image && (
                <img
                  src={c.image}
                  alt=""
                  className="character-image large"
                  loading="eager"
                />
              )}

              <span className="character-name">{c.name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}