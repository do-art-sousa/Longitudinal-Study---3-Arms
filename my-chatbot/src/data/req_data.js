/**
 * Reading Experience Questionnaire (REQ) — 8 dimensions, 1–5 Likert.
 * Keys match backend export / StudySession.req_scores.
 */
export const REQ_ITEMS = [
  {
    id: "social_presence",
    text: "Senti que o companheiro de leitura estava “presente” comigo nesta sessão.",
  },
  {
    id: "connection",
    text: "Senti uma ligação ou proximidade com o companheiro de leitura.",
  },
  {
    id: "responsiveness",
    text: "O companheiro de leitura respondeu de forma adequada ao que eu dizia ou perguntava.",
  },
  {
    id: "autonomy",
    text: "Senti que podia seguir a leitura ao meu ritmo e tomar iniciativa.",
  },
  {
    id: "motivation",
    text: "Esta sessão aumentou a minha vontade de ler ou de continuar a conversa.",
  },
  {
    id: "latent_demand",
    text: "Senti que o companheiro de leitura pedia ou sugeria mais do que eu queria neste momento.",
  },
  {
    id: "unmet_need",
    text: "Houve momentos em que precisava de mais apoio ou clarificação e não os recebi.",
  },
  {
    id: "isolation",
    text: "Senti-me sozinho/a ou desligado/a durante a interação.",
  },
];
