import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { CliRunner } from "./cli-runner.mjs";
import { SddEngine } from "./sdd-engine.mjs";

/**
 * Sintetiza um título limpo, elegante e profissional para a Spec ou Adendo,
 * eliminando vícios de linguagem coloquiais (ex: "apenas um html que consulta...").
 */
export function synthesizeCleanTitle(rawText, parentSpec = null) {
  let cleaned = rawText
    .trim()
    .replace(/^(\s*[-*#>]+\s*)+/, "")
    .replace(/^(quero|preciso|gostaria|fazer|criar|construir|desenvolver|adicionar|implementar|abrir)\s+(um|uma|o|a)?\s*/i, "")
    .replace(/^(apenas|so|só)\s+(um|uma|o|a)?\s*/i, "")
    .replace(/^(fazer|criar|montar|gerar)\s+(um|uma|o|a)?\s*/i, "")
    .replace(/^(tela|pagina|interface)\s+(de|para|pra)?\s*/i, "Interface de ")
    .replace(/\b(pra mim|para mim|no sistema|pro sistema|por favor)\b/gi, "")
    .trim();

  // Caso específico comum: consulta a endpoint público / CEP
  if (/html.*endpoint.*public/i.test(cleaned) || /endpoint.*public.*html/i.test(cleaned)) {
    if (parentSpec?.title) {
      return `Interface Web para ${parentSpec.title}`;
    }
    return "Interface HTML para Consulta a Endpoint Público";
  }

  if (/\bcep\b/i.test(cleaned)) {
    return "Consulta de Endereço por CEP";
  }

  // Capitalização em Title Case
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return parentSpec ? `Ajuste em ${parentSpec.title}` : "Nova Funcionalidade SDD";
  }

  const lowercaseSmallWords = new Set([
    "de", "da", "do", "das", "dos", "em", "na", "no", "nas", "nos",
    "para", "pra", "por", "com", "sem", "e", "ou", "a", "o", "as", "os", "um", "uma"
  ]);

  let formatted = words
    .map((w, idx) => {
      const lower = w.toLowerCase();
      if (idx > 0 && lowercaseSmallWords.has(lower)) {
        return lower;
      }
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ");

  formatted = formatted.charAt(0).toUpperCase() + formatted.slice(1);

  if (formatted.length < 5) {
    return parentSpec ? `Detalhamento de ${parentSpec.title}` : "Nova Funcionalidade SDD";
  }

  return formatted.slice(0, 65).trim();
}

/**
 * Harness Master — O Orquestrador Central do Spec-Driven Development (SDD)
 *
 * Regras Inegociáveis:
 * 1. Funcionalidade nova sempre nasce de uma spec formal (spec.md + tasks.md).
 * 2. Bugs, melhorias e continuações são associados à spec dona (specs/<spec>/addenda/ ou tasks.md).
 * 3. O Harness identifica a qual funcionalidade/spec pertence pelo histórico e contexto.
 * 4. Respostas a perguntas de esclarecimento continuam a spec em discussão, sem criar novas specs indesejadas.
 * 5. Títulos são sempre profissionais e limpos.
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

    const specs = this.sddEngine.getAllSpecs(this.projectDir);
    analysis.stats.totalSpecs = specs.length;
    if (specs.length > 0 && !analysis.activeFeature) {
      analysis.activeFeature = specs[specs.length - 1].folder;
      analysis.currentStage = "SDD Execution";
    }

    return analysis;
  }

  // Detecta se a mensagem atual ou o histórico recente apontam para uma spec existente
  detectConversationContext(userMessage, conversationHistory = [], allSpecs = []) {
    if (allSpecs.length === 0) return null;

    // 1. Menção explícita na mensagem atual (ex: "spec 02", "spec 2", "req 2", "0002")
    const directMatch = userMessage.match(/(?:spec|requisito|req)[^\d]*0*([1-9]\d*)/i);
    if (directMatch) {
      const num = parseInt(directMatch[1], 10);
      const found = allSpecs.find((s) => s.num === num);
      if (found) return { spec: found, isDirectMention: true, isAnsweringQuestion: false };
    }

    // 2. Busca reversa no histórico da conversa (últimas 10 mensagens)
    const reversed = [...conversationHistory].reverse().slice(0, 10);
    for (let i = 0; i < reversed.length; i++) {
      const msg = reversed[i];
      const text = msg.text || "";

      // Verifica menção numérica a spec no histórico
      const histMatch = text.match(/(?:spec|requisito|req)[^\d]*0*([1-9]\d*)/i);
      if (histMatch) {
        const num = parseInt(histMatch[1], 10);
        const found = allSpecs.find((s) => s.num === num);
        if (found) {
          // Verifica se o arquiteto fez uma pergunta após essa menção
          const lastArch = reversed.find((m) => m.sender === "architect");
          const isAnsweringQuestion =
            lastArch && (lastArch.text.includes("?") || /como|qual|descreva|quais/i.test(lastArch.text));
          return { spec: found, isDirectMention: false, isAnsweringQuestion: Boolean(isAnsweringQuestion) };
        }
      }

      // Verifica se houve proposta recente vinculada a uma spec
      if (msg.generatedCard?.targetSpecFolder || msg.generatedCard?.parentSpec?.id) {
        const folder = msg.generatedCard.targetSpecFolder || msg.generatedCard.parentSpec.id;
        const found = allSpecs.find((s) => s.folder === folder);
        if (found) {
          return { spec: found, isDirectMention: false, isAnsweringQuestion: true };
        }
      }
    }

    // 3. Cruzamento semântico com títulos de specs existentes
    const cleanUser = userMessage.toLowerCase();
    for (const spec of allSpecs) {
      const titleClean = spec.title.toLowerCase();
      if (titleClean.length > 3 && cleanUser.includes(titleClean)) {
        return { spec, isDirectMention: false, isAnsweringQuestion: false };
      }
    }

    return null;
  }

  // Classifica a intenção com suporte a contexto conversacional
  classifyUserIntent(userMessage, conversationContext, conversationHistory = []) {
    const clean = userMessage
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

    // Se o usuário está em diálogo ativo sobre uma spec (ex: continuou ou respondeu a pergunta do arquiteto):
    if (conversationContext?.spec && (conversationContext.isAnsweringQuestion || conversationContext.isDirectMention)) {
      const isExplicitNewSpec = /nova spec|novo requisito|outra feature|nova feature independente/i.test(clean);
      if (!isExplicitNewSpec) {
        return {
          type: "CONTINUE_OR_REFINE_SPEC",
          targetSpec: conversationContext.spec,
        };
      }
    }

    // 1. Dúvida / Suporte / Investigação / Diagnóstico:
    // O agente pode utilizar ferramentas e MCPs livremente para auxiliar e investigar sem necessidade de spec.
    const supportKeywords = [
      "como funciona", "o que e", "o que sao", "qual a diferenca", "por que",
      "explica", "explicar", "duvida", "ajuda", "documentacao", "o que significa",
      "investigar", "investigue", "analisar", "analise", "consultar", "consulte",
      "verificar", "verifique", "checar", "olhar", "veja", "diagnosticar", "suporte",
      "log", "logs", "status", "onde fica", "onde esta", "me ajuda", "pesquise", "buscar"
    ];
    const isSupport = userMessage.includes("?") || supportKeywords.some((q) => clean.includes(q));
    const hasChangeIntent = /criar\s+|adicionar\s+|fazer\s+|implementar\s+|desenvolver\s+|construir\s+|corrigir\s+|consertar\s+|remover\s+|alterar\s+|modificar\s+/i.test(clean);

    if (isSupport && !hasChangeIntent) {
      return { type: "SUPPORT_QUESTION" };
    }

    // 2. Verificação de Bug / Correção vs Melhoria
    const bugKeywords = ["bug", "erro", "falha", "quebrou", "fix", "corrigir", "consertar", "problema", "não funciona", "nao funciona", "quebrado"];
    const improvementKeywords = ["melhorar", "melhoria", "refatorar", "otimizar", "ajustar", "performance", "limpar"];
    const isBug = bugKeywords.some((k) => clean.includes(k));
    const isImprovement = improvementKeywords.some((k) => clean.includes(k));

    if (isBug || isImprovement) {
      return {
        type: "BUG_OR_IMPROVEMENT",
        subType: isBug ? "fix" : "improvement",
        targetSpec: conversationContext?.spec || null,
      };
    }

    // 3. Se o usuário pede "continuar", "dar andamento", "seguir", "prosseguir"
    if (/continuar|prosseguir|dar andamento|seguir/i.test(clean) && conversationContext?.spec) {
      return {
        type: "CONTINUE_OR_REFINE_SPEC",
        targetSpec: conversationContext.spec,
      };
    }

    // 4. Se não há palavras de ação nem contexto, trata como suporte
    const actionKeywords = [
      "criar", "adicionar", "fazer", "implementar", "desenvolver", "construir", "novo", "nova",
      "remover", "alterar", "modificar", "trocar", "quero", "preciso", "gostaria"
    ];
    if (!actionKeywords.some((k) => clean.includes(k))) {
      return { type: "SUPPORT_QUESTION" };
    }

    // Se existe spec ativa no contexto de diálogo, associa a ela como refinamento
    if (conversationContext?.spec) {
      return {
        type: "CONTINUE_OR_REFINE_SPEC",
        targetSpec: conversationContext.spec,
      };
    }

    // 5. Caso padrão para novas adições sem contexto anterior: Nova Spec
    return { type: "NEW_FEATURE" };
  }

  async processUserMessage(userMessage, conversationHistory = [], cliType = "auto") {
    const analysis = this.analyzeCurrentState();
    const allSpecs = this.sddEngine.getAllSpecs(this.projectDir);
    const context = this.detectConversationContext(userMessage, conversationHistory, allSpecs);
    const intent = this.classifyUserIntent(userMessage, context, conversationHistory);

    // 1. Caso DÚVIDA / SUPORTE / DIAGNÓSTICO:
    // O agente usa ferramentas MCP e conhecimento livremente para ajudar o usuário sem criar spec.
    // Se for detectada a necessidade de alteração de código, orienta o direcionamento para o fluxo.
    if (intent.type === "SUPPORT_QUESTION") {
      const supportPrompt = `
Você é o HARNESS MASTER e AI ARCHITECT do framework SDD (Spec-Driven Development).
O usuário está solicitando suporte, diagnóstico ou esclarecimento de dúvidas.
Diretrizes:
- Você tem total liberdade para usar ferramentas e MCPs de consulta/diagnóstico para auxiliar o usuário.
- Responda com clareza técnica, autoridade arquitetural (DDD/Clean Arch) e didática.
- Não altere arquivos de código de produção e não crie specs desnecessárias nesta fase de suporte.
- Se a dúvida revelar um bug que realmente demande alteração de código, sinalize ao usuário que a correção deve ser conduzida pelo fluxo do SDD (como um adendo na respectiva spec dona).

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
        answerText = `Olá! Como Harness Master, estou à disposição para suporte, esclarecimento de dúvidas e diagnósticos arquiteturais.

No modo **Suporte e Diagnóstico**:
- Podemos inspecionar logs, consultar documentação, investigar causas e analisar o sistema livremente.
- Nenhuma spec ou alteração de código é exigida para consultas e investigações.
- Caso durante a análise identifiquemos que existe um bug ou necessidade real de alteração de código, conduzirei você diretamente para a esteira SDD (vinculando a correção à spec correspondente através de um adendo formal).

Como posso te ajudar agora?`;
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

    // 2. Caso CONTINUAÇÃO / REFINAMENTO DE SPEC EXISTENTE (Evita criar Spec 03 indevida!)
    if (intent.type === "CONTINUE_OR_REFINE_SPEC") {
      const targetSpec = intent.targetSpec || context?.spec || allSpecs[0];
      const cleanTitle = synthesizeCleanTitle(userMessage, targetSpec);

      const summary = `Detalhamento e tarefas de implementação para '${targetSpec.title}', em conformidade com as diretrizes do SDD.`;
      const acs = [
        `AC-1: Interface e comportamento de '${cleanTitle}' implementados com sucesso`,
        `AC-2: Integração ponta a ponta com validação e tratamento de exceções`,
        `AC-3: Critérios validados pelo gate automatizado (npm test)`,
      ];
      const tasks = [
        `Construir interface/componente para '${cleanTitle}'`,
        `Integrar regras de negócio e chamadas assíncronas ao endpoint`,
        `Tratar estados de carregamento, sucesso e erros de validação`,
        `Garantir cobertura com testes automatizados no gate (DoD)`,
      ];

      const generatedCard = {
        type: "continuation",
        headerTitle: `CONTINUAÇÃO / TAREFAS DA SPEC [${targetSpec.code}]`,
        subType: "improvement",
        subTypeLabel: "Detalhamento de Tarefas",
        targetSpecFolder: targetSpec.folder,
        parentSpec: {
          id: targetSpec.folder,
          code: targetSpec.code,
          title: targetSpec.title,
        },
        title: cleanTitle,
        summary,
        acs,
        tasks,
      };

      const aiResponseText = `🛡️ **Continuidade da [${targetSpec.code}] ${targetSpec.title}:**

Compreendi a especificação fornecida (*"${cleanTitle}"*).

Identifiquei que esta resposta é o **detalhamento de implementação da Spec existente [${targetSpec.code}]**, e **não** uma nova funcionalidade isolada. Formulei os critérios e as tarefas correspondentes vinculados a ela.

👉 **Spec Associada:** \`[${targetSpec.code}] ${targetSpec.title}\` (\`specs/${targetSpec.folder}/\`)

Clique no botão abaixo para anexar essas tarefas ao \`tasks.md\` da **${targetSpec.code}** na esteira:`;

      return {
        sender: "architect",
        senderName: "Harness Master",
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        text: aiResponseText,
        intent: "CONTINUE_OR_REFINE_SPEC",
        generatedCard,
      };
    }

    // 3. Caso BUG FIX OU MELHORIA
    if (intent.type === "BUG_OR_IMPROVEMENT") {
      const match = intent.targetSpec || this.sddEngine.findMatchingSpec(this.projectDir, userMessage);
      const subType = intent.subType || "fix";
      const subTypeLabel = subType === "fix" ? "Correção (Bug Fix)" : "Melhoria";

      const targetSpecFolder = match?.specFolder || match?.folder || analysis.activeFeature || "0001-core";
      const targetCode = match?.specCode || match?.code || "REQ-0001";
      const targetTitle = match?.title || "Funcionalidade Principal";

      const cleanTitle = synthesizeCleanTitle(userMessage, { title: targetTitle });
      const summary = `Subdocumento de ${subTypeLabel.toLowerCase()} vinculado à spec pai. Registrado antes de qualquer modificação de código.`;
      const acs = [
        `AC-${subType.toUpperCase()}-1: Validação de conformidade do ajuste de ${cleanTitle}`,
        `AC-${subType.toUpperCase()}-2: Ausência de efeitos colaterais e regressões no domínio`,
      ];
      const tasks = [
        `Mapear causa raiz e impacto na camada de domínio da spec`,
        `Aplicar ajuste de '${cleanTitle}' em conformidade com os ACs`,
        `Executar testes automatizados no gate executável`,
      ];

      const generatedCard = {
        type: "addendum",
        headerTitle: `PROPOSTA DE SUBDOCUMENTO (${subTypeLabel.toUpperCase()})`,
        subType,
        subTypeLabel,
        targetSpecFolder,
        parentSpec: {
          id: targetSpecFolder,
          code: targetCode,
          title: targetTitle,
        },
        title: cleanTitle,
        summary,
        acs,
        tasks,
      };

      const aiResponseText = `🛡️ **Trava de Governança SDD Ativada:**
Pela regra da esteira, nenhuma alteração de código pode ser feita sem rastreabilidade documental prévia.

Identifiquei que esta solicitação é uma **${subTypeLabel}** associada à funcionalidade existente:
👉 **\`[${generatedCard.parentSpec.code}] ${generatedCard.parentSpec.title}\`** (\`specs/${generatedCard.targetSpecFolder}/\`).

Formulei os critérios de aceite e tarefas como um **Subdocumento (Adendo)** dentro da respectiva spec pai. Clique abaixo para registrar o adendo na esteira antes de codificar:`;

      return {
        sender: "architect",
        senderName: "Harness Master",
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        text: aiResponseText,
        intent: "BUG_OR_IMPROVEMENT",
        generatedCard,
      };
    }

    // 4. Caso NOVA FUNCIONALIDADE GENUÍNA
    const cleanTitle = synthesizeCleanTitle(userMessage, null);
    const summary = `Especificação formal criada sob a esteira do Spec-Driven Development: ${cleanTitle}`;
    const acs = [
      `AC-1: Fluxo principal de '${cleanTitle}' executado com sucesso e conformidade`,
      `AC-2: Validação de entradas e regras de negócio no domínio`,
      `AC-3: Tratamento de exceção e idempotência`,
    ];
    const tasks = [
      `Modelar entidades de domínio e contratos para ${cleanTitle}`,
      `Implementar caso de uso na camada de aplicação`,
      `Integrar interfaces e portas`,
      `Escrever testes automatizados cobrindo AC-1 a AC-3 (DoD)`,
    ];

    const generatedCard = {
      type: "new_spec",
      title: cleanTitle,
      summary,
      acs,
      tasks,
    };

    const aiResponseText = `🛡️ **Trava de Governança SDD Ativada:**
Pela regra da esteira, **toda funcionalidade nova SEMPRE nasce de uma spec formal**. Nenhuma linha de código será desenvolvida sem contrato prévio.

Estruturei a especificação com critérios de aceite rigorosos em Given/When/Then e tarefas acionáveis com gates de teste. Clique abaixo para registrar a nova spec na esteira:`;

    return {
      sender: "architect",
      senderName: "Harness Master",
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      text: aiResponseText,
      intent: "NEW_FEATURE",
      generatedCard,
    };
  }
}
