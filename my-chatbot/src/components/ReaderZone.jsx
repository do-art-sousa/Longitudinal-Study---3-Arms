import React from "react";

/**
 * Left zone: physical book / reading context. Replace inner content with EPUB/PDF when available.
 */
export default function ReaderZone({
  weekIndex,
  slotIndex,
  globalSessionIndex,
  title = "Os Piratas",
}) {
  return (
    <aside className="tablet-reader-zone" aria-label="Zona de leitura">
      <div className="tablet-reader-inner">
        <p className="tablet-reader-kicker">Leitura da sessão</p>
        <h2 className="tablet-reader-title">{title}</h2>
        {(weekIndex != null && slotIndex != null) || globalSessionIndex != null ? (
          <p className="tablet-reader-meta">
            {globalSessionIndex != null ? (
              <>Sessão {globalSessionIndex} do estudo</>
            ) : (
              <>
                Semana {weekIndex} · Sessão {slotIndex}
              </>
            )}
          </p>
        ) : null}
        <p className="tablet-reader-hint">
          Usa o teu livro ou texto neste espaço. Na zona à direita registas as tarefas da ficha
          {globalSessionIndex ? " e, no fim, os questionários." : "."}
        </p>
        <div className="tablet-reader-placeholder" aria-hidden="true">
          <span className="tablet-reader-placeholder-icon">📖</span>
        </div>
      </div>
    </aside>
  );
}
