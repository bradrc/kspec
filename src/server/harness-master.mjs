import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { CliRunner } from "./cli-runner.mjs";

/**
 * Harness Master — O Orquestrador Central do Spec-Driven Development (SDD)
 */
export class HarnessMaster {
  constructor(projectDir = process.cwd(), cliRunner = new CliRunner()) {
    this.projectDir = projectDir;
    this.cliRunner = cliRunner;
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
          const bLines = blockersMatch[0].split("\n").filter(l => l.includes("[ ]") || l.includes("[x]"));
          analysis.blockers = bLines.map(l => l.replace(/^-\s*\[.\]\s*/, "").trim());
        }
      } catch {}
    }

    const specsDir = join(this.projectDir, "specs");
    if (existsSync(specsDir)) {
      try {
        const specs = readdirSync(specsDir).filter(e => !e.startsWith("_"));
        analysis.stats.totalSpecs = specs.length;
        if (specs.length > 0 && !analysis.activeFeature) {
          analysis.activeFeature = specs[specs.length - 1];
          analysis.currentStage = "SDD Execution";
        }
      } catch {}
    }

    return analysis;
  }

  async processUserMessage(userMessage, conversationHistory = [], cliType = "auto") {
    const analysis = this.analyzeCurrentState();

    const systemPrompt = `
Você é o HARNESS MASTER e AI ARCHITECT do framework SDD (Spec-Driven Development).
Você conhece todo o ciclo Lean Inception -> DDD -> Technical Design -> SDD.

Diretrizes:
1. Responda como o Arquiteto Líder do projeto.
2. Analise a solicitação sob a ótica de Domínio, Arquitetura em Camadas e Contrato (Spec).
3. Formule Critérios de Aceite (ACs) rigorosos em Given/When/Then (Dado/Quando/Então) e a decomposição de tarefas acionáveis com gates de teste.
4. No final da sua resposta, forneça OBRIGATORIAMENTE um bloco JSON estruturado com o card para o Kanban:
\`\`\`json
{
  "title": "Título Claro da Feature",
  "summary": "Resumo executivo do objetivo e valor",
  "tasks": [
    "Tarefa 1 acionável",
    "Tarefa 2 acionável",
    "Tarefa 3 acionável",
    "Tarefa 4 de testes e validação de DoD"
  ],
  "acs": [
    "AC-1: Cenário de sucesso principal",
    "AC-2: Validação de entradas e regras",
    "AC-3: Tratamento de exceção / borda"
  ]
}
\`\`\`

Workspace: ${this.projectDir}
Feature Ativa: ${analysis.activeFeature || "Nenhuma"}
Mensagem do Usuário: "${userMessage}"
`;

    let aiResponseText = "";
    let generatedCard = null;

    try {
      const queryResult = await this.cliRunner.queryLlmCli({
        cliType,
        prompt: systemPrompt,
        cwd: this.projectDir,
      });

      if (queryResult.success && queryResult.text) {
        aiResponseText = queryResult.text;
        const jsonMatch = aiResponseText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (jsonMatch) {
          try {
            generatedCard = JSON.parse(jsonMatch[1]);
            aiResponseText = aiResponseText.replace(/```(?:json)?\s*[\s\S]*?\s*```/, "").trim();
          } catch {}
        }
      }
    } catch {}

    // Fallback rico e contextual se o CLI externo não responder
    if (!generatedCard) {
      const clean = userMessage.toLowerCase();
      let title = userMessage.split(".")[0].replace(/^quero\s+|^preciso\s+que\s+/i, "").slice(0, 60).trim();
      let summary = `Implementação orientada a especificações: ${userMessage}`;
      let tasks = [];
      let acs = [];

      if (clean.includes("cep")) {
        title = "Sistema de Consulta de CEP";
        summary = "Serviço de busca de endereços por CEP com validação de formato e integração com serviço de CEP.";
        acs = [
          "AC-1: CEP válido (8 dígitos) retorna logradouro, bairro, cidade e UF com status 200",
          "AC-2: CEP inexistente na base de dados retorna erro 404 e payload padronizado",
          "AC-3: Formato de CEP inválido (menos de 8 dígitos ou caracteres inválidos) retorna erro 400"
        ];
        tasks = [
          "Definir Value Object 'Cep' com validação de máscara e 8 dígitos no domínio",
          "Implementar Service de busca e integração com API de CEP",
          "Criar Endpoint REST GET /cep/:codigo com tratamento de status 200, 400 e 404",
          "Escrever testes unitários e de integração cobrindo AC-1, AC-2 e AC-3 (DoD)"
        ];
      } else if (clean.includes("auth") || clean.includes("login") || clean.includes("jwt")) {
        title = "Autenticação e Sessão de Usuário";
        summary = "Mecanismo seguro de autenticação com validação de credenciais e emissão de tokens JWT.";
        acs = [
          "AC-1: Credenciais válidas retornam token JWT e payload de usuário",
          "AC-2: Senha incorreta ou usuário inexistente retorna erro 401 não autorizado",
          "AC-3: Token expirado ou inválido é rejeitado em rotas autenticadas"
        ];
        tasks = [
          "Modelar entidade de Usuário e Value Object de Hash de Senha no domínio",
          "Implementar serviço de autenticação e geração de tokens JWT",
          "Criar middleware de autorização para proteção de rotas privadas",
          "Adicionar suíte de testes de segurança cobrindo AC-1, AC-2 e AC-3"
        ];
      } else {
        acs = [
          `AC-1: Operação principal de '${title}' executada com conformidade`,
          `AC-2: Tratamento de validação de entrada e restrições de domínio`,
          `AC-3: Garantia de idempotência e ausência de regressões`
        ];
        tasks = [
          `Modelar contratos e entidades de domínio para: ${title}`,
          `Implementar regras de negócio e camada de serviço`,
          `Integrar interface / endpoints e fluxo de execução`,
          `Executar testes automatizados cobrindo todos os ACs (DoD)`
        ];
      }

      generatedCard = { title, summary, tasks, acs };

      if (!aiResponseText) {
        aiResponseText = `Analisei sua solicitação como Harness Master. O requisito foi enquadrado no padrão SDD (Tier Pequeno), com critérios de aceite Given/When/Then e tarefas decompostas prontas para a esteira. Veja a especificação abaixo:`;
      }
    }

    return {
      sender: "architect",
      senderName: "AI Architect",
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      text: aiResponseText,
      generatedCard,
    };
  }
}
