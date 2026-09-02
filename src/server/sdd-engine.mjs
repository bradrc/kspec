import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync, statSync } from "node:fs";
import { join, resolve, basename, dirname } from "node:path";
import { execSync } from "node:child_process";

export class SddEngine {
  constructor(baseDir = process.cwd()) {
    this.baseDir = resolve(baseDir);
  }

  // Lista workspaces/projetos conhecidos
  static listProjects(baseDir = process.cwd()) {
    const projects = [];
    const seenPaths = new Set();

    const addProj = (dirPath) => {
      const absPath = resolve(dirPath);
      if (existsSync(absPath) && !seenPaths.has(absPath)) {
        seenPaths.add(absPath);
        projects.push(SddEngine.getProjectMeta(absPath));
      }
    };

    addProj(baseDir);

    const examplesDir = join(baseDir, "examples");
    if (existsSync(examplesDir)) {
      try {
        const entries = readdirSync(examplesDir);
        for (const entry of entries) {
          const fullPath = join(examplesDir, entry);
          if (statSync(fullPath).isDirectory()) {
            addProj(fullPath);
          }
        }
      } catch {}
    }

    const homeConfig = join(process.env.HOME || "", ".kspec", "workspaces.json");
    if (existsSync(homeConfig)) {
      try {
        const saved = JSON.parse(readFileSync(homeConfig, "utf8"));
        if (Array.isArray(saved)) {
          for (const p of saved) {
            addProj(p);
          }
        }
      } catch {}
    }

    return projects;
  }

  static registerWorkspace(dirPath) {
    const absPath = resolve(dirPath);
    if (!existsSync(absPath)) return false;

    const homeDir = join(process.env.HOME || "", ".kspec");
    mkdirSync(homeDir, { recursive: true });
    const homeConfig = join(homeDir, "workspaces.json");

    let saved = [];
    if (existsSync(homeConfig)) {
      try {
        saved = JSON.parse(readFileSync(homeConfig, "utf8"));
      } catch {}
    }
    if (!saved.includes(absPath)) {
      saved.push(absPath);
      writeFileSync(homeConfig, JSON.stringify(saved, null, 2), "utf8");
    }
    return SddEngine.getProjectMeta(absPath);
  }

  static getProjectMeta(projPath) {
    const folderName = basename(projPath);
    const hasSdd = existsSync(join(projPath, "specs")) || existsSync(join(projPath, "docs", "STATE.md")) || existsSync(join(projPath, ".spec-driven"));
    const hasGit = existsSync(join(projPath, ".git"));
    const pkgPath = join(projPath, "package.json");

    let name = folderName;
    let stack = "NODE_SDD";
    let version = "1.0.0";
    let repoUrl = "local";

    if (hasGit) {
      try {
        const gitRemote = execSync("git remote get-url origin", { cwd: projPath, timeout: 1500, encoding: "utf8" }).trim();
        if (gitRemote) {
          repoUrl = basename(gitRemote);
        } else {
          repoUrl = `${folderName}.git`;
        }
      } catch {
        repoUrl = `${folderName}.git`;
      }
    }

    if (existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
        if (pkg.name) name = pkg.name;
        if (pkg.version) version = pkg.version;
        if (pkg.dependencies?.react || pkg.devDependencies?.react) stack = "REACT_APP";
        else if (pkg.dependencies?.vue || pkg.devDependencies?.vue) stack = "VUE_APP";
        else if (pkg.dependencies?.next || pkg.devDependencies?.next) stack = "NEXTJS_APP";
        else if (pkg.dependencies?.express || pkg.dependencies?.fastify) stack = "NODE_API";
        else stack = "NODE_PROJECT";
      } catch {}
    }

    if (existsSync(join(projPath, "pom.xml")) || existsSync(join(projPath, "build.gradle"))) {
      stack = existsSync(join(projPath, "package.json")) ? "JAVA_REACT" : "JAVA_SPRING";
    } else if (existsSync(join(projPath, "*.csproj")) || existsSync(join(projPath, "src", "*.cs"))) {
      stack = existsSync(join(projPath, "package.json")) ? "DOTNET_REACT" : "DOTNET_CORE";
    } else if (existsSync(join(projPath, "requirements.txt")) || existsSync(join(projPath, "pyproject.toml"))) {
      stack = "PYTHON_APP";
    } else if (existsSync(join(projPath, "Cargo.toml"))) {
      stack = "RUST_PROJECT";
    } else if (existsSync(join(projPath, "go.mod"))) {
      stack = "GO_PROJECT";
    }

    const stateFile = join(projPath, "docs", "STATE.md");
    let stateSummary = "Framework SDD ativo.";
    if (existsSync(stateFile)) {
      try {
        const stateContent = readFileSync(stateFile, "utf8");
        const match = stateContent.match(/## Em andamento \/ próximo passo[\s\S]*?(?=##|$)/);
        if (match) {
          stateSummary = match[0].replace("## Em andamento / próximo passo", "").trim().slice(0, 160);
        }
      } catch {}
    }

    return {
      id: Buffer.from(projPath).toString("base64url"),
      name,
      path: projPath,
      stack,
      version,
      hasSdd,
      hasGit,
      repo: repoUrl,
      stateSummary,
    };
  }

  // Lê todos os cards do Kanban a partir de specs/ e tasks.md
  getKanbanData(projectDir = this.baseDir) {
    const specsDir = join(projectDir, "specs");
    const cards = [];

    if (!existsSync(specsDir)) {
      return {
        columns: {
          backlog: [],
          todo: [],
          doing: [],
          testing: [],
          done: [],
        },
        stats: { totalCards: 0, totalTasks: 0, completedTasks: 0 },
      };
    }

    let entries = [];
    try {
      entries = readdirSync(specsDir).filter((e) => !e.startsWith("_") && statSync(join(specsDir, e)).isDirectory());
    } catch {
      entries = [];
    }

    let totalTasksCount = 0;
    let completedTasksCount = 0;

    for (const specFolder of entries) {
      const folderPath = join(specsDir, specFolder);
      const specFile = join(folderPath, "spec.md");
      const tasksFile = join(folderPath, "tasks.md");

      let title = specFolder.replace(/^\d+-/, "").replace(/-/g, " ");
      let summary = "";
      let acList = [];
      let tasksList = [];
      let dodList = [];
      let specRaw = "";
      let tasksRaw = "";
      let priority = "P1";
      let overallStatus = "backlog";

      // Lê spec.md
      if (existsSync(specFile)) {
        try {
          specRaw = readFileSync(specFile, "utf8");
          const titleMatch = specRaw.match(/^#\s+(?:Spec\s*—\s*)?(.*)$/m);
          if (titleMatch) title = titleMatch[1].trim();

          const summaryMatch = specRaw.match(/##\s+Resumo\s*\n([\s\S]*?)(?=##|$)/i);
          if (summaryMatch) summary = summaryMatch[1].trim();

          const acMatches = [...specRaw.matchAll(/###\s+(AC-\d+:\s*[^\n]+)([\s\S]*?)(?=###|##|$)/g)];
          for (const m of acMatches) {
            acList.push({
              name: m[1].trim(),
              details: m[2].trim().split("\n").map((l) => l.trim()).filter(Boolean),
            });
          }
        } catch {}
      }

      // Lê tasks.md
      if (existsSync(tasksFile)) {
        try {
          tasksRaw = readFileSync(tasksFile, "utf8");

          const tableLines = tasksRaw.split("\n").filter((l) => l.trim().startsWith("|"));
          for (const line of tableLines) {
            const cols = line.split("|").map((c) => c.trim()).filter(Boolean);
            if (cols.length >= 3 && !cols[0].startsWith("#") && !cols[0].startsWith("---")) {
              const num = cols[0];
              const taskText = cols[1];
              const acCovered = cols[2] || "";
              const gate = cols[3] || "";
              const statusRaw = (cols[4] || "todo").toLowerCase();

              let status = "todo";
              if (statusRaw.includes("done") || statusRaw.includes("concl")) status = "done";
              else if (statusRaw.includes("doing") || statusRaw.includes("andamento") || statusRaw.includes("dev")) status = "doing";
              else if (statusRaw.includes("test") || statusRaw.includes("qa") || statusRaw.includes("validar")) status = "testing";
              else if (statusRaw.includes("backlog")) status = "backlog";

              tasksList.push({
                id: `${specFolder}-t${num}`,
                num,
                task: taskText,
                acCovered,
                gate,
                status,
                completed: status === "done",
              });
            }
          }

          // Lê DoD
          const dodMatches = [...tasksRaw.matchAll(/-\s*\[([ xX])\]\s*([^\n]+)/g)];
          for (const d of dodMatches) {
            dodList.push({
              checked: d[1].toLowerCase() === "x",
              text: d[2].trim(),
            });
          }
        } catch {}
      }

      // Lê histórico de mensagens do agente no card
      const activityLogFile = join(projectDir, ".spec-driven", "activity", `${specFolder}.json`);
      let agentHistory = [];
      let lastAgentMessage = "";
      if (existsSync(activityLogFile)) {
        try {
          agentHistory = JSON.parse(readFileSync(activityLogFile, "utf8"));
          if (agentHistory.length > 0) {
            lastAgentMessage = agentHistory[agentHistory.length - 1].message || "";
          }
        } catch {}
      }

      totalTasksCount += tasksList.length;
      const completedInCard = tasksList.filter((t) => t.completed).length;
      completedTasksCount += completedInCard;

      if (tasksList.length === 0) {
        overallStatus = "backlog";
      } else if (completedInCard === tasksList.length && tasksList.length > 0) {
        overallStatus = "done";
      } else if (tasksList.some((t) => t.status === "testing")) {
        overallStatus = "testing";
      } else if (tasksList.some((t) => t.status === "doing")) {
        overallStatus = "doing";
      } else {
        overallStatus = "todo";
      }

      if (specFolder.startsWith("0001") || specFolder.includes("auth") || specFolder.includes("core")) {
        priority = "P0";
      }

      const agentMap = {
        backlog: "AI Architect",
        todo: "AI Architect",
        doing: "Dev Agent",
        testing: "QA Agent",
        done: "Dev & QA",
      };

      cards.push({
        id: specFolder,
        code: `REQ-${specFolder.slice(0, 4)}`,
        title,
        summary: summary || "Requisito estruturado sob as diretrizes do Spec-Driven Development.",
        folder: specFolder,
        specPath: `specs/${specFolder}/spec.md`,
        tasksPath: `specs/${specFolder}/tasks.md`,
        status: overallStatus,
        priority,
        agent: agentMap[overallStatus] || "AI Architect",
        tasksCount: tasksList.length,
        completedTasksCount: completedInCard,
        tasks: tasksList,
        dodList,
        acList,
        specRaw,
        tasksRaw,
        agentHistory,
        lastAgentMessage,
      });
    }

    const columns = {
      backlog: cards.filter((c) => c.status === "backlog"),
      todo: cards.filter((c) => c.status === "todo"),
      doing: cards.filter((c) => c.status === "doing"),
      testing: cards.filter((c) => c.status === "testing"),
      done: cards.filter((c) => c.status === "done"),
    };

    return {
      columns,
      stats: {
        totalCards: cards.length,
        totalTasks: totalTasksCount,
        completedTasks: completedTasksCount,
      },
    };
  }

  // Registra atividade/mensagem do agente no card
  saveAgentMessageToCard(projectDir = this.baseDir, specFolder, { agentType = "dev", message, log = "", status = "doing" }) {
    const actDir = join(projectDir, ".spec-driven", "activity");
    mkdirSync(actDir, { recursive: true });
    const actFile = join(actDir, `${specFolder}.json`);

    let history = [];
    if (existsSync(actFile)) {
      try { history = JSON.parse(readFileSync(actFile, "utf8")); } catch {}
    }

    const entry = {
      id: `act-${Date.now()}`,
      agentType,
      message,
      log: log.slice(-3000), // guarda os logs recentes
      status,
      timestamp: new Date().toISOString(),
      timeFormatted: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    history.push(entry);
    writeFileSync(actFile, JSON.stringify(history, null, 2), "utf8");

    // Também anexa nota executiva no tasks.md se existir
    const tasksFile = join(projectDir, "specs", specFolder, "tasks.md");
    if (existsSync(tasksFile)) {
      try {
        let content = readFileSync(tasksFile, "utf8");
        const today = new Date().toISOString().split("T")[0];
        const note = `\n<!-- Agent Note [${today} ${agentType.toUpperCase()}]: ${message} -->\n`;
        if (!content.includes(note.trim())) {
          content += note;
          writeFileSync(tasksFile, content, "utf8");
        }
      } catch {}
    }

    return entry;
  }

  // Atualiza um item de tarefa específico no tasks.md
  updateCardTaskItem(projectDir = this.baseDir, specFolder, taskNum, { completed, status }) {
    const tasksFile = join(projectDir, "specs", specFolder, "tasks.md");
    if (!existsSync(tasksFile)) return false;

    let content = readFileSync(tasksFile, "utf8");
    const lines = content.split("\n");
    const newLines = [];

    const targetStatus = status || (completed ? "done" : "todo");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.trim().startsWith("|") && !line.includes("Task") && !line.includes("---")) {
        const cols = line.split("|");
        if (cols.length >= 5) {
          const num = cols[1].trim();
          if (num === String(taskNum)) {
            cols[cols.length - 2] = ` ${targetStatus} `;
            newLines.push(cols.join("|"));
            continue;
          }
        }
      }
      newLines.push(line);
    }

    writeFileSync(tasksFile, newLines.join("\n"), "utf8");
    return true;
  }

  // Atualiza o status geral do Card
  updateCardStatus(projectDir = this.baseDir, specFolder, targetStatus, taskNum = null) {
    const tasksFile = join(projectDir, "specs", specFolder, "tasks.md");
    if (!existsSync(tasksFile)) return false;

    let content = readFileSync(tasksFile, "utf8");
    const lines = content.split("\n");
    const newLines = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.trim().startsWith("|") && !line.includes("Task") && !line.includes("---")) {
        const cols = line.split("|");
        if (cols.length >= 5) {
          const num = cols[1].trim();
          if (!taskNum || num === String(taskNum)) {
            cols[cols.length - 2] = ` ${targetStatus} `;
            newLines.push(cols.join("|"));
            continue;
          }
        }
      }
      newLines.push(line);
    }

    writeFileSync(tasksFile, newLines.join("\n"), "utf8");
    this.updateStateFile(projectDir, specFolder, targetStatus);
    return true;
  }

  updateStateFile(projectDir, specFolder, status) {
    const docsDir = join(projectDir, "docs");
    mkdirSync(docsDir, { recursive: true });
    const stateFile = join(docsDir, "STATE.md");
    const today = new Date().toISOString().split("T")[0];

    try {
      let state = "";
      if (existsSync(stateFile)) {
        state = readFileSync(stateFile, "utf8");
        state = state.replace(/\*\*Última atualização:\*\* [^\n]*/, `**Última atualização:** ${today} por KSpec OS`);
        state = state.replace(
          /## Em andamento \/ próximo passo[\s\S]*?(?=##|$)/,
          `## Em andamento / próximo passo\n- Feature ativa: \`specs/${specFolder}/\` — fase: ${status.toUpperCase()}\n- Próximo passo: Conduzir execução da spec com agente responsável.\n\n`
        );
      } else {
        state = `---
name: STATE
description: Memória de trabalho volátil — onde paramos, próximo passo, bloqueios.
alwaysApply: true
---

# STATE — Memória viva do projeto

**Última atualização:** ${today} por KSpec OS

## Em andamento / próximo passo
- Feature ativa: \`specs/${specFolder}/\` — fase: ${status.toUpperCase()}
- Próximo passo: Conduzir execução da spec com agente responsável.

## Decisões recentes
- ${today}: Atualização de spec via KSpec OS

## Bloqueios
- [ ] Nenhum bloqueio ativo

## Ideias adiadas / backlog técnico
- Backlog técnico sob governança do SDD

## Todos soltos
- [ ] Refinar próximos critérios de aceite
`;
      }
      writeFileSync(stateFile, state, "utf8");
    } catch {}
  }

  getConversations(projectDir = this.baseDir) {
    const convDir = join(projectDir, ".spec-driven", "conversations");
    if (!existsSync(convDir)) {
      mkdirSync(convDir, { recursive: true });
      return [];
    }

    const files = readdirSync(convDir).filter((f) => f.endsWith(".json"));
    const convs = [];
    for (const f of files) {
      try {
        convs.push(JSON.parse(readFileSync(join(convDir, f), "utf8")));
      } catch {}
    }
    return convs.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  }

  saveConversation(projectDir = this.baseDir, conversation) {
    const convDir = join(projectDir, ".spec-driven", "conversations");
    mkdirSync(convDir, { recursive: true });
    const filePath = join(convDir, `${conversation.id}.json`);
    writeFileSync(filePath, JSON.stringify(conversation, null, 2), "utf8");
    return true;
  }

  createSpecFromRequirement(projectDir = this.baseDir, { title, summary, acs = [], tasks = [], priority = "P1" }) {
    const specsDir = join(projectDir, "specs");
    mkdirSync(specsDir, { recursive: true });

    let maxNum = 0;
    try {
      const existing = readdirSync(specsDir);
      for (const item of existing) {
        const match = item.match(/^(\d{4})/);
        if (match) {
          const n = parseInt(match[1], 10);
          if (n > maxNum) maxNum = n;
        }
      }
    } catch {}

    const nextNum = String(maxNum + 1).padStart(4, "0");
    const slug = title
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 30);

    const folderName = `${nextNum}-${slug}`;
    const targetFolder = join(specsDir, folderName);
    mkdirSync(targetFolder, { recursive: true });

    const specMd = `---
name: spec
description: Spec — ${title}
alwaysApply: true
---

# Spec — ${title}

## Resumo
${summary || "Implementação orientada a especificações."}

## Critérios de aceite

${
  acs.length > 0
    ? acs
        .map((ac, i) => {
          const text = typeof ac === "string" ? ac : (ac.title || ac.name || `AC-${i+1}`);
          return `### ${text.startsWith("AC-") ? text : `AC-${i + 1}: ${text}`}
- **Dado** o contexto da aplicação
- **Quando** a operação for disparada
- **Então** o resultado deve estar estritamente conforme com as regras de negócio`;
        })
        .join("\n\n")
    : `### AC-1: Fluxo principal de ${title}
- **Dado** o ambiente configurado
- **Quando** a ação for executada
- **Então** o resultado deve estar em conformidade com o DoD.`
}

## Fora de escopo
- Alterações estruturais não contempladas no escopo desta feature.
`;

    const tasksMd = `---
name: tasks
description: Tasks — ${title}
alwaysApply: false
---

# Tasks — ${title}

| #  | Task                          | Cobre AC      | Gate (comando)   | Status |
|----|-------------------------------|---------------|------------------|--------|
${
  tasks.length > 0
    ? tasks.map((t, i) => {
        const text = typeof t === "string" ? t : (t.text || t.task || `Task ${i+1}`);
        return `| ${i + 1}  | ${text.replace(/\|/g, "-")} | AC-1          | \`npm test\`     | todo   |`;
      }).join("\n")
    : `| 1  | Implementar lógica de domínio | AC-1          | \`npm test\`     | todo   |
| 2  | Integrar componentes e UI     | AC-1          | \`npm test\`     | todo   |`
}

## Plano de teste
- Testes automatizados cobrindo todos os ACs da spec.

## Definition of Done
- [ ] ACs validados pelo gate de teste
- [ ] Sem SPEC_DEVIATION pendente
- [ ] Revisão de conformidade com a arquitetura
`;

    writeFileSync(join(targetFolder, "spec.md"), specMd, "utf8");
    writeFileSync(join(targetFolder, "tasks.md"), tasksMd, "utf8");

    this.updateStateFile(projectDir, folderName, "todo");

    return {
      folderName,
      specPath: `specs/${folderName}/spec.md`,
      tasksPath: `specs/${folderName}/tasks.md`,
      title,
    };
  }
}
