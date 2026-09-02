import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { CliRunner } from "./cli-runner.mjs";

/**
 * Harness Master — O Orquestrador Central do Spec-Driven Development (SDD)
 * 
 * Conhece profundamente todo o ciclo de vida:
 * 1. Lean Inception (Discovery) -> docs/product/ (vision, stakeholders, journeys, features, mvp-canvas, roadmap)
 * 2. DDD & Arquitetura -> docs/architecture/ (overview 5 eixos, context-map, diagrams, adr/), docs/glossary.md
 * 3. TDD / Design Técnico -> Technical Design Docs, alternativas e trade-offs
 * 4. SDD (Especificação e Contrato) -> specs/NNNN-<nome>/ (spec.md, tasks.md)
 *    - Tiers: Trivial (<=3 arquivos / quick), Pequeno (spec+tasks), Arquitetural (product+design+domain+spec+tasks)
 *    - Definition of Ready (DoR) e Matriz de Decisão
 *    - Critérios de Aceite em Given/When/Then
 * 5. Dev Agent Loop -> Implementação respeitando camadas DDD (src/README.md) e DoD
 * 6. QA Agent Validation -> /validar, mapeamento AC -> teste, SPEC_DEVIATION check
 * 7. Handoff & Memória Viva -> /handoff, docs/STATE.md, poda de docs/lessons.md
 * 8. 15 Skills Nativas -> /kickoff, /integracoes, /mapear, /diagramar, /roadmap, /camada-agentica,
 *                       /nova-feature, /clarificar, /validar, /revisar-pr, /setup-ci, /metricas,
 *                       /auditar, /evals, /handoff
 */
export class HarnessMaster {
  constructor(projectDir = process.cwd(), cliRunner = new CliRunner()) {
    this.projectDir = projectDir;
    this.cliRunner = cliRunner;
  }

  // Analisa detalhadamente a memória viva e a esteira do projeto
  analyzeCurrentState() {
    const analysis = {
      currentStage: "Discovery / Greenfield",
      activeFeature: null,
      nextStep: "Executar /kickoff ou /nova-feature para abrir o primeiro requisito.",
      blockers: [],
      recentDecisions: [],
      stats: { totalSpecs: 0, completedSpecs: 0, hasGlossary: false, hasArchitecture: false },
      skills: [
        "/kickoff", "/integracoes", "/mapear", "/diagramar", "/roadmap",
        "/camada-agentica", "/nova-feature", "/clarificar", "/validar",
        "/revisar-pr", "/setup-ci", "/metricas", "/auditar", "/evals", "/handoff"
      ]
    };

    // Lê STATE.md
    const statePath = join(this.projectDir, "docs", "STATE.md");
    if (existsSync(statePath)) {
      try {
        const stateContent = readFileSync(statePath, "utf8");
        
        // Feature ativa e próximo passo
        const inProgressMatch = stateContent.match(/## Em andamento \/ próximo passo[\s\S]*?(?=##|$)/);
        if (inProgressMatch) {
          const lines = inProgressMatch[0].split("\n");
          for (const line of lines) {
            if (line.includes("Feature ativa:")) analysis.activeFeature = line.replace(/.*Feature ativa:\s*/, "").trim();
            if (line.includes("Próximo passo:")) analysis.nextStep = line.replace(/.*Próximo passo:\s*/, "").trim();
          }
        }

        // Bloqueios
        const blockersMatch = stateContent.match(/## Bloqueios[\s\S]*?(?=##|$)/);
        if (blockersMatch) {
          const bLines = blockersMatch[0].split("\n").filter(l => l.includes("[ ]") || l.includes("[x]"));
          analysis.blockers = bLines.map(l => l.replace(/^-\s*\[.\]\s*/, "").trim());
        }
      } catch {}
    }

    // Verifica Glossário e Arquitetura
    analysis.stats.hasGlossary = existsSync(join(this.projectDir, "docs", "glossary.md"));
    analysis.stats.hasArchitecture = existsSync(join(this.projectDir, "docs", "architecture", "overview.md"));

    // Verifica Specs
    const specsDir = join(this.projectDir, "specs");
    if (existsSync(specsDir)) {
      try {
        const specs = readdirSync(specsDir).filter(e => !e.startsWith("_"));
        analysis.stats.totalSpecs = specs.length;
        if (specs.length > 0 && !analysis.activeFeature) {
          analysis.activeFeature = specs[specs.length - 1];
          analysis.currentStage = "SDD Execution (Features em andamento)";
        }
      } catch {}
    }

    return analysis;
  }

  // Gera a resposta inteligente do Harness Master para o Spec Editor & Chat
  async processUserMessage(userMessage, conversationHistory = [], cliType = "auto") {
    const analysis = this.analyzeCurrentState();

    // Sistema de Instruções Canônicas do SDD
    const systemPrompt = `
Você é o HARNESS MASTER e AI ARCHITECT da esteira SDD (Spec-Driven Development).
Você conhece todo o framework:
- Lean Inception (Visão, Personas, MVP Canvas, Roadmap)
- DDD (Domínio, Linguagem Ubíqua, Bounded Contexts, Camadas)
- Technical Design (5 Eixos: Stack, Arquitetura, Infra, Qualidade, Observabilidade, ADRs)
- SDD (A Spec é o contrato. Tiers: Trivial, Pequeno, Arquitetural. ACs em Given/When/Then, Definition of Ready, Definition of Done).
- Sabatina de Clarificação: quando há ambiguidade, você sabatina fazendo perguntas objetivas.

Estado Atual do Workspace:
- Fase: ${analysis.currentStage}
- Feature Ativa: ${analysis.activeFeature || "Nenhuma no momento"}
- Próximo Passo do STATE: ${analysis.nextStep}
- Bloqueios Ativos: ${analysis.blockers.join("; ") || "Nenhum"}
- Total de Specs: ${analysis.stats.totalSpecs}

Diretrizes da sua resposta:
1. Atue como o engenheiro arquiteto líder. Seja claro, pragmático e rigoroso com as convenções SDD.
2. Se o usuário estiver descrevendo uma nova funcionalidade, requisito, tela ou endpoint:
   - Responda explicando como a funcionalidade se encaixa na arquitetura.
   - Sempre forneça no final da sua mensagem a estrutura do card em JSON para inclusão direta no Kanban do SDD:
\`\`\`json
{
  "title": "Nome da Feature em formato claro",
  "summary": "Resumo executivo do requisito",
  "tasks": [
    "Tarefa 1 acionável (Domínio/UI)",
    "Tarefa 2 acionável (Integração/Lógica)",
    "Tarefa 3 acionável (Validação de ACs)",
    "Tarefa 4 de conformidade (Testes e DoD)"
  ],
  "acs": [
    "AC-1: [Dado/Quando/Então do cenário principal]",
    "AC-2: [Cenário de validação ou erro/borda]"
  ]
}
\`\`\`
3. Se o usuário fizer perguntas sobre o processo SDD, como criar ADRs, como rodar testes, ou o que está pendente, oriente-o com base no estado real do projeto e nas 15 skills (/kickoff, /nova-feature, /clarificar, /validar, /handoff, etc.).

Mensagem do Desenvolvedor:
"${userMessage}"
`;

    let aiResponseText = "";
    let generatedCard = null;

    // 1. Tenta consultar a LLM instalada (Gemini, Claude, etc.)
    try {
      const queryResult = await this.cliRunner.queryLlmCli({
        cliType,
        prompt: systemPrompt,
        cwd: this.projectDir,
      });

      if (queryResult.success && queryResult.text) {
        aiResponseText = queryResult.text;
        
        // Extrai bloco JSON do card
        const jsonMatch = aiResponseText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (jsonMatch) {
          try {
            generatedCard = JSON.parse(jsonMatch[1]);
            aiResponseText = aiResponseText.replace(/```(?:json)?\s*[\s\S]*?\s*```/, "").trim();
          } catch {}
        }
      }
    } catch {}

    // 2. Fallback heurístico inteligente se o CLI não estiver conectado ou sem crédito
    if (!generatedCard && (userMessage.length > 15 || userMessage.includes("criar") || userMessage.includes("remover") || userMessage.includes("tela") || userMessage.includes("ajustar"))) {
      const title = userMessage.split(".")[0].replace(/^quero\s+|^preciso\s+que\s+/i, "").slice(0, 70).trim();
      const cleanMsg = userMessage.toLowerCase();
      const tasks = [];

      if (cleanMsg.includes("botão") || cleanMsg.includes("menu") || cleanMsg.includes("tela") || cleanMsg.includes("front")) {
        tasks.push(`Identificar o componente de UI correspondente a: ${title}`);
        tasks.push("Implementar as alterações visuais e vincular os estados reativos");
        tasks.push("Validar integridade de rotas e navegação");
        tasks.push("Executar testes de renderização e verificar conformidade com DoD");
      } else {
        tasks.push(`Modelar entidades e contratos no domínio para: ${title}`);
        tasks.push("Implementar serviços e handlers de aplicação");
        tasks.push("Adicionar suíte de testes unitários cobrindo todos os ACs");
        tasks.push("Executar gate de qualidade automatizado e atualizar docs/STATE.md");
      }

      generatedCard = {
        title: title || "Nova Funcionalidade SDD",
        summary: `Especificação de requisito: ${userMessage}`,
        tasks,
        acs: [
          `AC-1: Fluxo principal de ${title} executado com sucesso`,
          `AC-2: Validação de entradas e tratamento de cenários de borda`
        ]
      };

      if (!aiResponseText) {
        aiResponseText = `Analisei seu pedido com base nas regras do framework SDD. O requisito foi decomposto em critérios de aceite e tarefas técnicas aderentes à esteira. Veja o card abaixo pronto para inserção no Kanban.`;
      }
    } else if (!aiResponseText) {
      aiResponseText = `Sou o Harness Master do SDD. No momento, o projeto está na fase "${analysis.currentStage}". Próximo passo registrado: "${analysis.nextStep}". Como posso ajudar a detalhar novos requisitos ou esclarecer o fluxo da esteira?`;
    }

    return {
      sender: "architect",
      senderName: "AI Architect",
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      text: aiResponseText,
      generatedCard,
    };
  }

  // Construtor de prompts para disparo do Dev Agent e QA Agent via CLI
  buildAgentExecutionPrompt({ agentType, cardId, specPath, tasksPath, projectDir = this.projectDir }) {
    const analysis = this.analyzeCurrentState();
    let specContent = "";
    let tasksContent = "";

    if (specPath && existsSync(join(projectDir, specPath))) {
      try { specContent = readFileSync(join(projectDir, specPath), "utf8"); } catch {}
    }
    if (tasksPath && existsSync(join(projectDir, tasksPath))) {
      try { tasksContent = readFileSync(join(projectDir, tasksPath), "utf8"); } catch {}
    }

    if (agentType === "dev") {
      return `
[DEV AGENT - EXECUÇÃO SDD]
Você é o Agente Desenvolvedor encarregado de implementar a feature ${cardId}.
Princípios:
1. A Spec é a fonte da verdade e o contrato imutável.
2. Siga estritamente os Critérios de Aceite (ACs).
3. Respeite as camadas de arquitetura (DDD / Clean Arch) definidas no projeto.
4. Não introduza SPEC_DEVIATION sem justificativa técnica.

${specContent ? `### SPEC.MD ATIVA:\n${specContent}\n` : ""}
${tasksContent ? `### TASKS.MD:\n${tasksContent}\n` : ""}

Execute a implementação do código no diretório de trabalho.
`;
    }

    if (agentType === "qa") {
      return `
[QA AGENT - VALIDAÇÃO E GATES SDD]
Você é o Agente de QA responsável por validar a entrega da feature ${cardId}.
Princípios:
1. Rode a suíte de testes automatizados do projeto.
2. Mapeie cada AC-N da spec com o seu teste correspondente.
3. Valide o Definition of Done (DoD).
4. Emita o relatório de conformidade.

${specContent ? `### CRITÉRIOS DE ACEITE:\n${specContent}\n` : ""}
`;
    }

    return `[AI ARCHITECT] Conduzindo feature ${cardId}`;
  }
}
