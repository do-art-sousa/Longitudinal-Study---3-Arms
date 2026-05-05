/**
 * Activity Sheets Data
 * Maps the exact instructions and interaction contracts for all 9 sessions.
 * Separated by Generic and Personalised conditions.
 */

export const activitySheets = {
  generic: {
    1: {
      title: "Sessão 1 (Marco)",
      steps: [
        "Abertura: Mini-tutorial e check-in com o teu companheiro.",
        "Leitura + Atividades (20 min): Lê o capítulo de 'Os Piratas' e cumpre a Ficha de Atividade abaixo.",
        "Término (10 min): Responde ao Questionário Completo (16 itens) sobre a tua experiência."
      ],
      tasks: [
        { id: "g1_1", label: "Definição: Pergunta o significado de uma palavra que não saibas." },
        { id: "g1_2", label: "Facto: Pergunta algo sobre o mundo ou personagem." },
        { id: "g1_3", label: "Enredo: Faz uma previsão ou resumo (ex: 'O que vai acontecer no próximo capítulo?')" },
        { id: "g1_4", label: "Opinião: Dá a tua opinião e pergunta a do companheiro (ex: 'Achei isto injusto, e tu?')" },
        { id: "g1_5", label: "Esclarecimento: Pede para explicar uma parte difícil de forma simples." },
        { id: "g1_6", label: "Sessão 1: Pede uma dica ou exemplo simples." },
        { id: "g1_7", label: "Expressa confusão, interesse ou curiosidade." },
        { id: "g1_8", label: "Toma uma decisão sobre o que ler a seguir ou o que discutir." }
      ]
    },
    2: {
      title: "Sessão 2 (Rotina)",
      steps: [
        "Leitura Fluida (15 min): Foca-te na história com o teu companheiro.",
        "Término (5 min): Responde apenas às 4 perguntas rápidas (Interessado, Divertido, Aborrecido, Confuso)."
      ],
      rules: [
        "Mantém as mensagens curtas (1-2 frases).",
        "Podes usar o que aprendeste nas sessões anteriores para falar com o teu companheiro."
      ],
      tasks: [
        { id: "g2_1", label: "Definição: Pergunta o significado de uma palavra que não saibas." },
        { id: "g2_2", label: "Enredo: Faz uma previsão ou resumo." },
        { id: "g2_3", label: "Opinião: Dá a tua opinião e pergunta a do companheiro." },
        { id: "g2_4", label: "Facto: (Opcional) Pergunta algo sobre o mundo ou personagem." },
        { id: "g2_5", label: "Esclarecimento: (Opcional) Pede para explicar uma parte difícil." },
        { id: "g2_6", label: "Pede uma pergunta de volta para testares o que aprendeste." }
      ]
    },
    3: {
      title: "Sessão 3 (Rotina)",
      steps: [
        "Leitura Fluida (15 min): Foca-te na história com o teu companheiro.",
        "Término (5 min): Responde apenas às 4 perguntas rápidas (Interessado, Divertido, Aborrecido, Confuso)."
      ],
      rules: [
        "Mantém as mensagens curtas (1-2 frases).",
        "Podes usar o que aprendeste nas sessões anteriores para falar com o teu companheiro."
      ],
      tasks: [
        { id: "g3_1", label: "Definição: Pergunta o significado de uma palavra que não saibas." },
        { id: "g3_2", label: "Enredo: Faz uma previsão ou resumo." },
        { id: "g3_3", label: "Opinião: Dá a tua opinião e pergunta a do companheiro." },
        { id: "g3_4", label: "Facto: (Opcional) Pergunta algo sobre o mundo ou personagem." },
        { id: "g3_5", label: "Esclarecimento: (Opcional) Pede para explicar uma parte difícil." },
        { id: "g3_6", label: "Pede uma pergunta de volta para testares o que aprendeste." }
      ]
    },
    4: {
      title: "Sessão 4 (Rotina)",
      steps: [
        "Leitura Fluida (15 min): Foca-te na história com o teu companheiro.",
        "Término (5 min): Responde apenas às 4 perguntas rápidas (Interessado, Divertido, Aborrecido, Confuso)."
      ],
      rules: [
        "Mantém as mensagens curtas (1-2 frases).",
        "Podes usar o que aprendeste nas sessões anteriores para falar com o teu companheiro."
      ],
      tasks: [
        { id: "g4_1", label: "Definição: Pergunta o significado de uma palavra que não saibas." },
        { id: "g4_2", label: "Enredo: Faz uma previsão ou resumo." },
        { id: "g4_3", label: "Opinião: Dá a tua opinião e pergunta a do companheiro." },
        { id: "g4_4", label: "Facto: (Opcional) Pergunta algo sobre o mundo ou personagem." },
        { id: "g4_5", label: "Esclarecimento: (Opcional) Pede para explicar uma parte difícil." },
        { id: "g4_6", label: "Pede uma pergunta de volta para testares o que aprendeste." }
      ]
    },
    5: {
      title: "Sessão 5 (Marco)",
      steps: [
        "Abertura: Mini-tutorial e check-in.",
        "Leitura + Atividades (20 min): Lê o capítulo de 'Os Piratas' e cumpre a Ficha de Atividade abaixo.",
        "Término (10 min): Responde ao Questionário Completo (16 itens)."
      ],
      tasks: [
        { id: "g5_1", label: "Definição: Pergunta o significado de uma palavra que não saibas." },
        { id: "g5_2", label: "Facto: Pergunta algo sobre o mundo ou personagem." },
        { id: "g5_3", label: "Enredo: Faz uma previsão ou resumo (ex: 'O que vai acontecer no próximo capítulo?')" },
        { id: "g5_4", label: "Opinião: Dá a tua opinião e pergunta a do companheiro (ex: 'Achei isto injusto, e tu?')" },
        { id: "g5_5", label: "Esclarecimento: Pede para explicar uma parte difícil de forma simples." },
        { id: "g5_6", label: "Sessão 5: Faz uma ligação a outro livro ou filme ('Isto lembra-me...')." },
        { id: "g5_7", label: "Expressa confusão, interesse ou curiosidade." },
        { id: "g5_8", label: "Toma uma decisão sobre o que ler a seguir ou o que discutir." }
      ]
    },
    6: {
      title: "Sessão 6 (Rotina)",
      steps: [
        "Leitura Fluida (15 min): Foca-te na história com o teu companheiro.",
        "Término (5 min): Responde apenas às 4 perguntas rápidas (Interessado, Divertido, Aborrecido, Confuso)."
      ],
      rules: [
        "Mantém as mensagens curtas (1-2 frases).",
        "Podes usar o que aprendeste nas sessões anteriores para falar com o teu companheiro."
      ],
      tasks: [
        { id: "g6_1", label: "Definição: Pergunta o significado de uma palavra que não saibas." },
        { id: "g6_2", label: "Enredo: Faz uma previsão ou resumo." },
        { id: "g6_3", label: "Opinião: Dá a tua opinião e pergunta a do companheiro." },
        { id: "g6_4", label: "Facto: (Opcional) Pergunta algo sobre o mundo ou personagem." },
        { id: "g6_5", label: "Esclarecimento: (Opcional) Pede para explicar uma parte difícil." },
        { id: "g6_6", label: "Pede uma pergunta de volta para testares o que aprendeste." }
      ]
    },
    7: {
      title: "Sessão 7 (Rotina)",
      steps: [
        "Leitura Fluida (15 min): Foca-te na história com o teu companheiro.",
        "Término (5 min): Responde apenas às 4 perguntas rápidas (Interessado, Divertido, Aborrecido, Confuso)."
      ],
      rules: [
        "Mantém as mensagens curtas (1-2 frases).",
        "Podes usar o que aprendeste nas sessões anteriores para falar com o teu companheiro."
      ],
      tasks: [
        { id: "g7_1", label: "Definição: Pergunta o significado de uma palavra que não saibas." },
        { id: "g7_2", label: "Enredo: Faz uma previsão ou resumo." },
        { id: "g7_3", label: "Opinião: Dá a tua opinião e pergunta a do companheiro." },
        { id: "g7_4", label: "Facto: (Opcional) Pergunta algo sobre o mundo ou personagem." },
        { id: "g7_5", label: "Esclarecimento: (Opcional) Pede para explicar uma parte difícil." },
        { id: "g7_6", label: "Pede uma pergunta de volta para testares o que aprendeste." }
      ]
    },
    8: {
      title: "Sessão 8 (Rotina)",
      steps: [
        "Leitura Fluida (15 min): Foca-te na história com o teu companheiro.",
        "Término (5 min): Responde apenas às 4 perguntas rápidas (Interessado, Divertido, Aborrecido, Confuso)."
      ],
      rules: [
        "Mantém as mensagens curtas (1-2 frases).",
        "Podes usar o que aprendeste nas sessões anteriores para falar com o teu companheiro."
      ],
      tasks: [
        { id: "g8_1", label: "Definição: Pergunta o significado de uma palavra que não saibas." },
        { id: "g8_2", label: "Enredo: Faz uma previsão ou resumo." },
        { id: "g8_3", label: "Opinião: Dá a tua opinião e pergunta a do companheiro." },
        { id: "g8_4", label: "Facto: (Opcional) Pergunta algo sobre o mundo ou personagem." },
        { id: "g8_5", label: "Esclarecimento: (Opcional) Pede para explicar uma parte difícil." },
        { id: "g8_6", label: "Pede uma pergunta de volta para testares o que aprendeste." }
      ]
    },
    9: {
      title: "Sessão 9 (Marco - Final)",
      steps: [
        "Abertura: Última sessão de leitura com o companheiro.",
        "Leitura + Atividades (20 min): Conclui o livro 'Os Piratas'.",
        "Término (10 min): Responde ao Questionário Completo Final."
      ],
      tasks: [
        { id: "g9_1", label: "Definição: Pergunta o significado de uma palavra que não saibas." },
        { id: "g9_2", label: "Facto: Pergunta algo sobre o mundo ou personagem." },
        { id: "g9_3", label: "Enredo: Faz uma previsão ou resumo." },
        { id: "g9_4", label: "Opinião: Dá a tua opinião e pergunta a do companheiro." },
        { id: "g9_5", label: "Esclarecimento: Pede para explicar uma parte difícil de forma simples." },
        { id: "g9_6", label: "Sessão 9: Avalia o teu progresso ou desafia o agente ('Como é que sabias aquela pista?')." },
        { id: "g9_7", label: "Expressa confusão, interesse ou curiosidade." },
        { id: "g9_8", label: "Toma uma decisão sobre o que ler a seguir ou o que discutir." }
      ]
    }
  },
  
  personalised: {
    1: {
      title: "Sessão 1 (Marco: Familiarização)",
      steps: [
        "Abertura: Mini-tutorial e check-in inicial com o teu companheiro personalizado.",
        "Leitura + Atividades (20 min): Lê o capítulo de 'Os Piratas' e cumpre a Ficha de Atividade abaixo.",
        "Término (10 min): Responde ao Questionário Completo (16 itens) sobre a tua experiência."
      ],
      tasks: [
        { id: "p1_1", label: "Definição: Pergunta o significado de uma palavra que não saibas." },
        { id: "p1_2", label: "Facto: Pergunta algo sobre o mundo ou personagem." },
        { id: "p1_3", label: "Enredo: Faz uma previsão ou resumo (ex: 'O que vai acontecer no próximo capítulo?')" },
        { id: "p1_4", label: "Opinião: Dá a tua opinião e pergunta a do companheiro." },
        { id: "p1_5", label: "Esclarecimento: Pede para explicar uma parte difícil de forma simples." },
        { id: "p1_6", label: "Sessão 1: Pede uma dica ou exemplo simples." },
        { id: "p1_7", label: "Expressa confusão, interesse ou curiosidade." },
        { id: "p1_8", label: "Toma uma decisão sobre o que ler a seguir ou o que discutir." }
      ]
    },
    2: {
      title: "Sessão 2 (Rotina: Interação Fluida)",
      steps: [
        "Leitura Ativa (15 min): Foca-te na história. O teu companheiro irá lembrar-se do que discutiram antes.",
        "Término (5 min): Responde apenas às 4 perguntas rápidas (Interessado, Divertido, Aborrecido, Confuso)."
      ],
      rules: [
        "Mantém as mensagens curtas e diretas.",
        "Sente-te à vontade para referir coisas que conversaram em sessões passadas."
      ],
      tasks: [
        { id: "p2_1", label: "Definição: Esclarece uma palavra nova." },
        { id: "p2_2", label: "Enredo: Faz uma previsão rápida sobre o que vai acontecer." },
        { id: "p2_3", label: "Opinião: Partilha o que achaste de uma ação de uma personagem." },
        { id: "p2_4", label: "Facto: Pergunta algo sobre o mundo ou personagem." },
        { id: "p2_5", label: "Esclarecimento: Pede para explicar uma parte difícil de forma simples." },
        { id: "p2_6", label: "Pede ao teu companheiro para te fazer uma pergunta e responde-a." }
      ]
    },
    3: {
      title: "Sessão 3 (Rotina: Interação Fluida)",
      steps: [
        "Leitura Ativa (15 min): Foca-te na história. O teu companheiro irá lembrar-se do que discutiram antes.",
        "Término (5 min): Responde apenas às 4 perguntas rápidas (Interessado, Divertido, Aborrecido, Confuso)."
      ],
      rules: [
        "Mantém as mensagens curtas e diretas.",
        "Sente-te à vontade para referir coisas que conversaram em sessões passadas."
      ],
      tasks: [
        { id: "p3_1", label: "Definição: Esclarece uma palavra nova." },
        { id: "p3_2", label: "Enredo: Faz uma previsão rápida sobre o que vai acontecer." },
        { id: "p3_3", label: "Opinião: Partilha o que achaste de uma ação de uma personagem." },
        { id: "p3_4", label: "Facto: Pergunta algo sobre o mundo ou personagem." },
        { id: "p3_5", label: "Esclarecimento: Pede para explicar uma parte difícil de forma simples." },
        { id: "p3_6", label: "Pede ao teu companheiro para te fazer uma pergunta e responde-a." }
      ]
    },
    4: {
      title: "Sessão 4 (Rotina: Interação Fluida)",
      steps: [
        "Leitura Ativa (15 min): Foca-te na história. O teu companheiro irá lembrar-se do que discutiram antes.",
        "Término (5 min): Responde apenas às 4 perguntas rápidas (Interessado, Divertido, Aborrecido, Confuso)."
      ],
      rules: [
        "Mantém as mensagens curtas e diretas.",
        "Sente-te à vontade para referir coisas que conversaram em sessões passadas."
      ],
      tasks: [
        { id: "p4_1", label: "Definição: Esclarece uma palavra nova." },
        { id: "p4_2", label: "Enredo: Faz uma previsão rápida sobre o que vai acontecer." },
        { id: "p4_3", label: "Opinião: Partilha o que achaste de uma ação de uma personagem." },
        { id: "p4_4", label: "Facto: Pergunta algo sobre o mundo ou personagem." },
        { id: "p4_5", label: "Esclarecimento: Pede para explicar uma parte difícil de forma simples." },
        { id: "p4_6", label: "Pede ao teu companheiro para te fazer uma pergunta e responde-a." }
      ]
    },
    5: {
      title: "Sessão 5 (Marco: Conexão e Memória)",
      steps: [
        "Leitura Ativa (15 min): Foca-te na história. O teu companheiro irá lembrar-se do que discutiram antes."
      ],
      tasks: [
        { id: "p5_1", label: "Definição: Pergunta o significado de uma palavra ou expressão do texto." },
        { id: "p5_2", label: "Facto do Mundo/Personagem: Pergunta sobre um facto da história ou de uma personagem." },
        { id: "p5_3", label: "Enredo: Faz uma previsão, resume uma parte ou reconta um momento com as tuas palavras." },
        { id: "p5_4", label: "Opinião: Diz a tua preferência ou avaliação e coloca uma pergunta ao companheiro." },
        { id: "p5_5", label: "Esclarecimento: Pede uma re-explicação em palavras mais simples se tiveres dúvidas." },
        { id: "p5_6", label: "Sessão 5: Faz uma ligação a outro livro, filme ou experiência pessoal ('Isto faz-me lembrar...')." },
        { id: "p5_7", label: "Expressa confusão, interesse ou curiosidade." },
        { id: "p5_8", label: "Toma uma decisão sobre o que ler a seguir ou sobre o rumo da conversa." }
      ]
    },
    6: {
      title: "Sessão 6 (Rotina: Interação Fluida)",
      steps: [
        "Leitura Ativa (15 min): Foca-te na história. O teu companheiro irá lembrar-se do que discutiram antes.",
        "Término (5 min): Responde apenas às 4 perguntas rápidas (Interessado, Divertido, Aborrecido, Confuso)."
      ],
      rules: [
        "Mantém as mensagens curtas e diretas.",
        "Sente-te à vontade para referir coisas que conversaram em sessões passadas."
      ],
      tasks: [
        { id: "p6_1", label: "Definição: Esclarece uma palavra nova." },
        { id: "p6_2", label: "Enredo: Faz uma previsão rápida sobre o que vai acontecer." },
        { id: "p6_3", label: "Opinião: Partilha o que achaste de uma ação de uma personagem." },
        { id: "p6_4", label: "Facto: Pergunta algo sobre o mundo ou personagem." },
        { id: "p6_5", label: "Esclarecimento: Pede para explicar uma parte difícil de forma simples." },
        { id: "p6_6", label: "Pede ao teu companheiro para te fazer uma pergunta e responde-a." }
      ]
    },
    7: {
      title: "Sessão 7 (Rotina: Interação Fluida)",
      steps: [
        "Leitura Ativa (15 min): Foca-te na história. O teu companheiro irá lembrar-se do que discutiram antes.",
        "Término (5 min): Responde apenas às 4 perguntas rápidas (Interessado, Divertido, Aborrecido, Confuso)."
      ],
      rules: [
        "Mantém as mensagens curtas e diretas.",
        "Sente-te à vontade para referir coisas que conversaram em sessões passadas."
      ],
      tasks: [
        { id: "p7_1", label: "Definição: Esclarece uma palavra nova." },
        { id: "p7_2", label: "Enredo: Faz uma previsão rápida sobre o que vai acontecer." },
        { id: "p7_3", label: "Opinião: Partilha o que achaste de uma ação de uma personagem." },
        { id: "p7_4", label: "Facto: Pergunta algo sobre o mundo ou personagem." },
        { id: "p7_5", label: "Esclarecimento: Pede para explicar uma parte difícil de forma simples." },
        { id: "p7_6", label: "Pede ao teu companheiro para te fazer uma pergunta e responde-a." }
      ]
    },
    8: {
      title: "Sessão 8 (Rotina: Interação Fluida)",
      steps: [
        "Leitura Ativa (15 min): Foca-te na história. O teu companheiro irá lembrar-se do que discutiram antes.",
        "Término (5 min): Responde apenas às 4 perguntas rápidas (Interessado, Divertido, Aborrecido, Confuso)."
      ],
      rules: [
        "Mantém as mensagens curtas e diretas.",
        "Sente-te à vontade para referir coisas que conversaram em sessões passadas."
      ],
      tasks: [
        { id: "p8_1", label: "Definição: Esclarece uma palavra nova." },
        { id: "p8_2", label: "Enredo: Faz uma previsão rápida sobre o que vai acontecer." },
        { id: "p8_3", label: "Opinião: Partilha o que achaste de uma ação de uma personagem." },
        { id: "p8_4", label: "Facto: Pergunta algo sobre o mundo ou personagem." },
        { id: "p8_5", label: "Esclarecimento: Pede para explicar uma parte difícil de forma simples." },
        { id: "p8_6", label: "Pede ao teu companheiro para te fazer uma pergunta e responde-a." }
      ]
    },
    9: {
      title: "Sessão 9 (Marco: Mestria e Reflexão)",
      steps: [
        "Leitura Ativa (15 min): Foca-te na história. O teu companheiro irá lembrar-se do que discutiram antes."
      ],
      tasks: [
        { id: "p9_1", label: "Definição: Pergunta o significado de uma palavra ou expressão do texto." },
        { id: "p9_2", label: "Facto do Mundo/Personagem: Pergunta sobre um facto da história ou de uma personagem." },
        { id: "p9_3", label: "Enredo: Faz uma previsão, resume uma parte ou reconta um momento com as tuas palavras." },
        { id: "p9_4", label: "Opinião: Diz a tua preferência ou avaliação e coloca uma pergunta ao companheiro." },
        { id: "p9_5", label: "Esclarecimento: Pede uma re-explicação em palavras mais simples se tiveres dúvidas." },
        { id: "p9_6", label: "Sessão 9: Avalia o teu progresso ou desafia o agente ('Como é que sabias aquela pista no texto?')." },
        { id: "p9_7", label: "Expressa confusão, interesse ou curiosidade." },
        { id: "p9_8", label: "Toma uma decisão sobre o que ler a seguir ou sobre o rumo da conversa." }
      ]
    }
  }
};

/**
 * Helper function to retrieve the correct activity sheet
 * @param {boolean} isPersonalised - true if in the personalized condition
 * @param {number} sessionNumber - 1 through 9
 * @returns {Object|null} The sheet data for the given session and group
 */
export const getSheetForSession = (isPersonalised, sessionNumber) => {
  const group = isPersonalised ? "personalised" : "generic";
  return activitySheets[group][sessionNumber] || null;
};