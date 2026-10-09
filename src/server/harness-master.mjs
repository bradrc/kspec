import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { CliRunner } from "./cli-runner.mjs";
import { SddEngine } from "./sdd-engine.mjs";

/**
 * Harness Master — O Orquestrador Central do Spec-Driven Development (SDD)
 *
 * Regras Inegociáveis:
 * 1. Funcionalidade nova sempre nasce de uma spec formal (spec.md + tasks.md).
 * 2. Bugs e melhorias são documentados em cada spec como um subdocumento (adendo).
 * 3. O Harness identifica a qual funcionalidade/spec pertence e faz a associação.
 * 4. Nada pode deixar de ser documentado antes de qualquer alteração de código.
 * 5. Dúvidas e suporte são respondidas normalmente; alterações conduzem estritamente para o fluxo.
 */
export class HarnessMaster {
  constructor(projectDir = process.cwd(), cliRunner = new CliRunner()) {
    this.projectDir = projectDir;
    this.cliRunner = cliRunner;
    this.sddEngine = new SddEngine(projectDir);
  }

  analyzeCurrentState() {
    const analysis = {
      currentStage: "Discovery / Greenfield",
      activeFeature: null,
      nextStep: "Executar /kickoff ou /nova-feature para abrir o primeiro requisito.",
      blockers: [],
      stats: { totalSpecs: 0, hasGlossary: false, hasArchitecture: false },
    };

    const statePath = join(this.projectDir, "docs", "STATE.md");
    if (existsSync(statePath)) {
      try {
        const stateContent = readFileSync(statePath, "utf8");
        const inProgressMatch = stateContent.match(/## Em andamento \/ próximo passo[\s\S]*?(?=##|$)/);
        if (inProgressMatch) {
          const lines = inProgressMatch[0].split("\n");
          for (const line of lines) {
            if (line.includes("Feature ativa:")) analysis.activeFeature = line.replace(/.*Feature ativa:\s*/, "").trim();
            if (line.includes("Próximo passo:")) analysis.nextStep = line.replace(/.*Próximo passo:\s*/, "").trim();
          }
        }

        const blockersMatch = stateContent.match(/## Bloqueios[\s\S]*?(?=##|$)/);
        if (blockersMatch) {
          const bLines = blockersMatch[0].split("\n").filter((l) => l.includes("[ ]") || l.includes("[x]"));
          analysis.blockers = bLines.map((l) => l.replace(/^-\s*\[.\]\s*/, "").trim());
        }
      } catch {}
    }

    const specsDir = join(this.projectDir, "specs");
    if (existsSync(specsDir)) {
      try {
        const specs = readdirSync(specsDir).filter((e) => !e.startsWith("_"));
        analysis.stats.totalSpecs = specs.length;
        if (specs.length > 0 && !analysis.activeFeature) {
          analysis.activeFeature = specs[specs.length - 1];
          analysis.currentStage = "SDD Execution";
        }
      } catch {}
    }

    return analysis;
  }

  // Classifica a intenção da mensagem do usuário
  classifyUserIntent(userMessage) {
    const clean = userMessage
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

    const changeKeywords = [
      "criar", "adicionar", "fazer", "implementar", "desenvolver", "construir", "novo", "nova",
      "corrigir", "consertar", "ajustar", "arrumar", "bug", "erro", "falha", "quebrou", "fix",
      "melhorar", "melhoria", "refatorar", "otimizar", "remover", "alterar", "modificar", "trocar"
    ];

    const isChange = changeKeywords.some((k) => clean.includes(k));

    if (!isChange) {
      return { type: "SUPPORT_QUESTION" };
    }

    const bugKeywords = ["bug", "erro", "falha", "quebrou", "fix", "corrigir", "consertar", "problema", "não funciona", "nao funciona"];
    const improvementKeywords = ["melhorar", "melhoria", "refatorar", "otimizar", "ajustar", "performance", "limpar"];

    const isBug = bugKeywords.some((k) => clean.includes(k));
    const isImprovement = improvementKeywords.some((k) => clean.includes(k));

    if (isBug || isImprovement) {
      return {
        type: "BUG_OR_IMPROVEMENT",
        subType: isBug ? "fix" : "improvement",
      };
    }

    return { type: "NEW_FEATURE" };
  }

  async processUserMessage(userMessage, conversationHistory = [], cliType = "auto") {
    const analysis = this.analyzeCurrentState();
    const intent = this.classifyUserIntent(userMessage);

    // 1. Caso DÚVIDA / SUPORTE: Responde normalmente como Arquiteto e orientador SDD
    if (intent.type === "SUPPORT_QUESTION") {
      const supportPrompt = `
Você é o HARNESS MASTER e AI ARCHITECT do framework SDD (Spec-Driven Development).
O usuário está fazendo uma pergunta de dúvida, suporte ou conceituação arquitetural.
Responda com total clareza técnica, autoridade arquitetural e didática.
Reforce brevemente que, caso o usuário decida implementar ou modificar qualquer funcionalidade ou código, o Harness Master ativará a esteira documental (spec formal para feature nova ou adendo para bug/melhoria).

Mensagem do Usuário: "${userMessage}"
`;

      let answerText = "";
      try {
        const queryResult = await this.cliRunner.queryLlmCli({
          cliType,
          prompt: supportPrompt,
          cwd: this.projectDir,
        });
        if (queryResult.success && queryResult.text) answerText = queryResult.text;
      } catch {}

      if (!answerText) {
        answerText = `Olá! Como Harness Master, estou aqui para apoiar em qualquer dúvida sobre a arquitetura, convenções DDD e a esteira Spec-Driven Development (SDD).

Em nossa esteira:
- **Toda funcionalidade nova** nasce de uma especificação formal em \`specs/NNNN-<nome>/\` com critérios de aceite Given/When/Then e tarefas decompostas em \`tasks.md\`.
- **Bugs e melhorias** são sempre associados à sua respectiva spec existente como um **subdocumento (adendo)** em \`specs/<spec>/addenda/\`.
- **Nada é alterado no código** sem documentação prévia e atualização de \`docs/STATE.md\`.

Fique à vontade para tirar dúvidas técnicas ou conceituais. E quando desejar realizar qualquer alteração, eu o conduzirei para o fluxo!`;
      }

      return {
        sender: "architect",
        senderName: "Harness Master",
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        text: answerText,
        intent: "SUPPORT_QUESTION",
        generatedCard: null,
      };
    }

    // 2. Caso ALTERAÇÃO: Conduz estritamente para o fluxo SDD!
    let generatedCard = null;
    let aiResponseText = "";

    // 2.1. É Bug Fix ou Melhoria: O Harness identifica e associa à Spec correspondente!
    if (intent.type === "BUG_OR_IMPROVEMENT") {
      const match = this.sddEngine.findMatchingSpec(this.projectDir, userMessage);
      const subType = intent.subType || "fix";
      const subTypeLabel = subType === "fix" ? "Correção (Bug Fix)" : "Melhoria";

      let title = userMessage.split(".")[0].replace(/^quero\s+|^preciso\s+que\s+|^corrigir\s+/i, "").slice(0, 60).trim();
      if (!title) title = `${subTypeLabel} na funcionalidade`;

      const summary = `Subdocumento de ${subTypeLabel.toLowerCase()} vinculado à spec pai. Registrado antes de qualquer modificação de código.`;
      const acs = [
        `AC-${subType.toUpperCase()}-1: Validação de conformidade do ajuste de ${title}`,
        `AC-${subType.toUpperCase()}-2: Ausência de efeitos colaterais e regressões no domínio`,
      ];
      const tasks = [
        `Mapear causa raiz / impacto na camada de domínio da spec`,
        `Aplicar ajuste em conformidade com os ACs`,
        `Executar testes automatizados (gate executável)`,
      ];

      generatedCard = {
        type: "addendum",
        subType,
        subTypeLabel,
        targetSpecFolder: match?.specFolder || analysis.activeFeature || "0001-core",
        parentSpec: {
          id: match?.specFolder || analysis.activeFeature || "0001-core",
          code: match?.specCode || "REQ-0001",
          title: match?.title || "Funcionalidade Principal",
        },
        title,
        summary,
        acs,
        tasks,
      };

      aiResponseText = `🛡️ **Trava de Governança SDD Ativada:**
Pela regra inegociável da esteira, **nenhuma alteração de funcionalidade ou código pode ser feita sem documentação prévia**.

Identifiquei que esta solicitação é uma **${subTypeLabel}** associada à funcionalidade existente:
👉 **\`[${generatedCard.parentSpec.code}] ${generatedCard.parentSpec.title}\`** (\`specs/${generatedCard.targetSpecFolder}/\`).

Formulei os critérios de aceite e as tarefas correspondentes como um **Subdocumento (Adendo)** dentro da respectiva spec pai. Clique abaixo para registrar o adendo na esteira antes de prosseguir com a implementação:`;
    }

    // 2.2. É Nova Funcionalidade: Sempre nasce de uma nova Spec!
    if (intent.type === "NEW_FEATURE") {
      let title = userMessage.split(".")[0].replace(/^quero\s+|^preciso\s+que\s+/i, "").slice(0, 60).trim();
      if (!title) title = "Nova Funcionalidade SDD";

      const summary = `Especificação formal criada sob a esteira do Spec-Driven Development: ${userMessage}`;
      const acs = [
        `AC-1: Fluxo principal de '${title}' executado com sucesso e conformidade`,
        `AC-2: Validação de entradas e regras de negócio no domínio`,
        `AC-3: Tratamento de exceção e idempotência`,
      ];
      const tasks = [
        `Modelar entidades de domínio e contratos para ${title}`,
        `Implementar caso de uso na camada de aplicação`,
        `Integrar interfaces e portas`,
        `Escrever testes unitários e de integração cobrindo AC-1 a AC-3 (DoD)`,
      ];

      generatedCard = {
        type: "new_spec",
        title,
        summary,
        acs,
        tasks,
      };

      aiResponseText = `🛡️ **Trava de Governança SDD Ativada:**
Pela regra da esteira, **toda funcionalidade nova SEMPRE deve nascer de uma spec**. Nenhuma linha de código será desenvolvida sem contrato prévio.

Estruturei a especificação com critérios de aceite rigorosos em Given/When/Then e tarefas acionáveis com gates de teste. Clique abaixo para criar a nova spec no projeto:`;
    }

    return {
      sender: "architect",
      senderName: "Harness Master",
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      text: aiResponseText,
      intent: intent.type,
      generatedCard,
    };
  }
}
