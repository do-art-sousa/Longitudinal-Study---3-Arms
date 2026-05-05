/**
 * CAIQ-PANAS Survey Data
 * Full version (sessions 1, 5, 9): 29 items (19 CAIQ + 10 PANAS)
 * Mini version (sessions 2, 3, 4, 6, 7, 8): 10 items (6 CAIQ + 4 PANAS)
 */

export const CAIQ_PANAS_INSTRUCTION = "Pensa na sessão de hoje em relação à tua interação. Diz-nos quanto concordas com cada frase. Não há respostas certas nem erradas.";

export const PANAS_INSTRUCTION = "Durante a sessão de leitura de hoje, eu senti-me...";

export const LIKERT_SCALE = [
  { value: 1, label: "Discordo totalmente", emoji: "😢" },
  { value: 2, label: "Discordo", emoji: "😕" },
  { value: 3, label: "Nem concordo nem discordo", emoji: "😐" },
  { value: 4, label: "Concordo", emoji: "🙂" },
  { value: 5, label: "Concordo totalmente", emoji: "😊" }
];

export const PANAS_LIKERT_SCALE = [
  { value: 1, label: "Nada ou muito pouco" },
  { value: 2, label: "Um pouco" },
  { value: 3, label: "Moderadamente" },
  { value: 4, label: "Bastante" },
  { value: 5, label: "Muitíssimo" }
];

// CAIQ items (19 items for Full, 6 items for Mini)
export const CAIQ_ITEMS = [
  {
    id: "caiq_1",
    text: "Senti que estava no mesmo espaço que o meu companheiro de leitura."
  },
  {
    id: "caiq_2",
    text: "Senti que o meu companheiro de leitura prestou atenção a mim."
  },
  {
    id: "caiq_3",
    text: "Senti que o meu companheiro de leitura notou quando eu precisava de ajuda."
  },
  {
    id: "caiq_4",
    text: "Senti que o meu companheiro de leitura prestou atenção àquilo que eu estava a ler."
  },
  {
    id: "caiq_5",
    text: "Sinto-me confortável perto do meu companheiro de leitura."
  },
  {
    id: "caiq_6",
    text: "O meu companheiro de leitura parece um amigo para mim."
  },
  {
    id: "caiq_7",
    text: "Sinto que posso confiar no meu companheiro de leitura."
  },
  {
    id: "caiq_8",
    text: "Sinto que o meu companheiro de leitura é de confiança."
  },
  {
    id: "caiq_9",
    text: "Tenho confiança de que a informação da conversa é verdadeira."
  },
  {
    id: "caiq_10",
    text: "Se eu estivesse em apuros, o meu companheiro de leitura estaria disposto a ajudar-me."
  },
  {
    id: "caiq_11",
    text: "O meu companheiro de leitura respondeu às minhas perguntas de forma relevante."
  },
  {
    id: "caiq_12",
    text: "Quando fazia perguntas, o meu companheiro de leitura respondia rapidamente."
  },
  {
    id: "caiq_13",
    text: "Senti que podia escolher quando pedir ajuda ao companheiro."
  },
  {
    id: "caiq_14",
    text: "O companheiro deixou-me ler ao meu próprio ritmo."
  },
  {
    id: "caiq_15",
    text: "Gostaria de interagir com o meu companheiro de leitura novamente."
  },
  {
    id: "caiq_16",
    text: "Gostaria de voltar a ver o meu companheiro de leitura."
  },
  {
    id: "caiq_17",
    text: "As respostas do meu companheiro de leitura foram ajustadas para mim."
  },
  {
    id: "caiq_18",
    text: "As respostas pareciam basear-se no que eu gosto ou disse antes."
  },
  {
    id: "caiq_19",
    text: "O companheiro parecia saber coisas sobre mim."
  }
];

// PANAS items (10 for Full, 4 for Mini)
export const PANAS_ITEMS = [
  { id: "pa_1", text: "Animado/a", type: "positive" },
  { id: "pa_2", text: "Feliz", type: "positive" },
  { id: "pa_3", text: "Orgulhoso/a", type: "positive" },
  { id: "pa_4", text: "Infeliz", type: "negative" },
  { id: "pa_5", text: "Assustado/a", type: "negative" },
  { id: "pa_6", text: "Triste", type: "negative" },
  { id: "pa_7", text: "Entusiasmado/a", type: "positive" },
  { id: "pa_8", text: "Nervoso/a", type: "negative" },
  { id: "pa_9", text: "Determinado/a", type: "positive" },
  { id: "pa_10", text: "Culpado/a", type: "negative" }
];

// Mini PANAS items (4 items for Mini version)
export const PANAS_MINI_INDICES = [1, 2, 3, 4]; // pa_2, pa_3, pa_4, pa_5

export const FULL_CAIQ_PANAS = {
  version: "full",
  caiq_items: CAIQ_ITEMS,
  panas_items: PANAS_ITEMS,
  total_items: 29
};

export const MINI_CAIQ_PANAS = {
  version: "mini",
  caiq_items: CAIQ_ITEMS.slice(0, 6),
  panas_items: PANAS_ITEMS.filter((_, i) => PANAS_MINI_INDICES.includes(i)),
  total_items: 10
};

export function getSurveyForSession(slotIndex) {
  // Full survey for sessions 1, 5, 9
  if ([1, 5, 9].includes(slotIndex)) {
    return FULL_CAIQ_PANAS;
  }
  // Mini survey for sessions 2, 3, 4, 6, 7, 8
  if ([2, 3, 4, 6, 7, 8].includes(slotIndex)) {
    return MINI_CAIQ_PANAS;
  }
  return null;
}

export function calculateSurveyScores(responses, surveyVersion) {
  /**
   * Calculate CAIQ and PANAS scores based on survey version.
   * Returns: { caiq_score, panas_positive, panas_negative, overall_affect }
   */
  
  const scores = {
    version: surveyVersion,
    caiq_score: null,
    panas_positive: null,
    panas_negative: null,
    overall_affect: null
  };

  if (surveyVersion === "full") {
    // Full CAIQ: mean of all 19 items
    const caiqValues = CAIQ_ITEMS.map(item => responses[item.id]).filter(v => v);
    if (caiqValues.length === CAIQ_ITEMS.length) {
      scores.caiq_score = caiqValues.reduce((a, b) => a + b, 0) / CAIQ_ITEMS.length;
    }

    // PANAS positive: mean of PA-1, PA-2, PA-3, PA-7, PA-9 (indices 0, 1, 2, 6, 8)
    const paPositiveIndices = [0, 1, 2, 6, 8];
    const paPositiveValues = paPositiveIndices
      .map(i => responses[PANAS_ITEMS[i].id])
      .filter(v => v);
    if (paPositiveValues.length === paPositiveIndices.length) {
      scores.panas_positive = paPositiveValues.reduce((a, b) => a + b, 0) / paPositiveIndices.length;
    }

    // PANAS negative: mean of NA-1, NA-2, NA-3, NA-4, NA-5 (indices 3, 4, 5, 7, 9)
    const naNegativeIndices = [3, 4, 5, 7, 9];
    const naNegativeValues = naNegativeIndices
      .map(i => responses[PANAS_ITEMS[i].id])
      .filter(v => v);
    if (naNegativeValues.length === naNegativeIndices.length) {
      scores.panas_negative = naNegativeValues.reduce((a, b) => a + b, 0) / naNegativeIndices.length;
    }
  } else if (surveyVersion === "mini") {
    // Mini CAIQ: mean of first 6 items
    const miniCaiqItems = CAIQ_ITEMS.slice(0, 6);
    const caiqValues = miniCaiqItems.map(item => responses[item.id]).filter(v => v);
    if (caiqValues.length === miniCaiqItems.length) {
      scores.caiq_score = caiqValues.reduce((a, b) => a + b, 0) / miniCaiqItems.length;
    }

    // PANAS positive mini: mean of PA-2 and PA-3 (indices 1, 2)
    const paPositiveIndices = [1, 2];
    const paPositiveValues = paPositiveIndices
      .map(i => responses[PANAS_ITEMS[i].id])
      .filter(v => v);
    if (paPositiveValues.length === paPositiveIndices.length) {
      scores.panas_positive = paPositiveValues.reduce((a, b) => a + b, 0) / paPositiveIndices.length;
    }

    // PANAS negative mini: mean of NA-4 and NA-5 (indices 3, 4)
    const naNegativeIndices = [3, 4];
    const naNegativeValues = naNegativeIndices
      .map(i => responses[PANAS_ITEMS[i].id])
      .filter(v => v);
    if (naNegativeValues.length === naNegativeIndices.length) {
      scores.panas_negative = naNegativeValues.reduce((a, b) => a + b, 0) / naNegativeIndices.length;
    }
  }

  // Overall affect: positive minus negative
  if (scores.panas_positive !== null && scores.panas_negative !== null) {
    scores.overall_affect = scores.panas_positive - scores.panas_negative;
  }

  return scores;
}
