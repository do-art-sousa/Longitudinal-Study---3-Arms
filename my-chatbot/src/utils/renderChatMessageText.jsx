import React from "react";

/** Single-asterisk italics outside of `**bold**` segments. */
function renderItalicSegments(segment, keyPrefix) {
  const parts = segment.split(/(\*[^*\n]+\*)/g);
  return parts.map((part, j) => {
    const key = `${keyPrefix}-${j}`;
    if (
      part.startsWith("*") &&
      part.endsWith("*") &&
      part.length >= 3 &&
      !part.startsWith("**")
    ) {
      return <em key={key}>{part.slice(1, -1)}</em>;
    }
    return part;
  });
}

/**
 * Renders `**bold**` and `*italic*` from the LLM (aligned with COACHING_PROMPT).
 */
export function renderChatMessageText(text) {
  if (text == null || text === "") return null;
  const s = String(text);
  const boldParts = s.split(/(\*\*.+?\*\*)/g);
  return boldParts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length >= 4) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    return <React.Fragment key={i}>{renderItalicSegments(part, i)}</React.Fragment>;
  });
}
