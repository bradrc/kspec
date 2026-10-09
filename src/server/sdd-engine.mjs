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

      // Classifica o tipo de item: spec, fix ou improvement
      let type = "spec";
      let typeLabel = "Spec";

      const lowerName = specFolder.toLowerCase();
      const lowerTitle = title.toLowerCase();

      if (
        specRaw.includes("type: fix") ||
        specRaw.includes("type: bug") ||
        tasksRaw.includes("type: fix") ||
        lowerName.startsWith("fix-") ||
        lowerName.includes("bug") ||
        lowerName.includes("correc") ||
        lowerName.includes("remover-") ||
        lowerTitle.includes("bug") ||
        lowerTitle.includes("correção") ||
        lowerTitle.includes("correcao") ||
        lowerTitle.includes("fix") ||
        lowerTitle.includes("corrigir") ||
        lowerTitle.includes("remover")
      ) {
        type = "fix";
        typeLabel = "Correção";
      } else if (
        specRaw.includes("type: improvement") ||
        specRaw.includes("type: melhoria") ||
        tasksRaw.includes("type: improvement") ||
        lowerName.startsWith("imp-") ||
        lowerName.includes("melhoria") ||
        lowerName.includes("refactor") ||
        lowerName.includes("optimi") ||
        lowerTitle.includes("melhoria") ||
        lowerTitle.includes("refator") ||
        lowerTitle.includes("otimiza") ||
        lowerTitle.includes("performance")
      ) {
        type = "improvement";
        typeLabel = "Melhoria";
      } else {
        type = "spec";
        typeLabel = "Spec";
      }

      const codePrefix = type === "fix" ? "FIX" : type === "improvement" ? "IMP" : "REQ";
      const progressPercent = tasksList.length > 0 
        ? Math.round((completedInCard / tasksList.length) * 100) 
        : (overallStatus === "done" ? 100 : 0);

      const agentMap = {
        backlog: "AI Architect",
        todo: "AI Architect",
        doing: "Dev Agent",
        testing: "QA Agent",
        done: "Dev & QA",
      };

      // Lê subdocumentos / adendos (Bugs e Melhorias vinculados a esta Spec)
      const addendaList = [];
      const checkAddendaDir = (dirPath, defaultType) => {
        if (existsSync(dirPath)) {
          try {
            const files = readdirSync(dirPath).filter((f) => f.endsWith(".md") && !f.startsWith("_"));
            for (const f of files) {
              const fPath = join(dirPath, f);
              if (!statSync(fPath).isFile()) continue;
              const fContent = readFileSync(fPath, "utf8");

              let fTitle = f.replace(/\.md$/, "").replace(/^[a-z]+-\d+-/, "").replace(/-/g, " ");
              const tMatch = fContent.match(/^#\s+(?:Adendo\s*—\s*)?(?:[A-Z]+-\d+:\s*)?(.*)$/m);
              if (tMatch) fTitle = tMatch[1].trim();

              let fSummary = "";
              const sumMatch = fContent.match(/##\s+(?:Origem|Contexto|Resumo|Justificativa)[^\n]*\n([\s\S]*?)(?=##|$)/i);
              if (sumMatch) fSummary = sumMatch[1].trim();

              const isFix = defaultType === "fix" || f.startsWith("fix-") || fContent.includes("type: fix") || fContent.includes("type: bug");
              const aType = isFix ? "fix" : "improvement";
              const aTypeLabel = isFix ? "Correção" : "Melhoria";
              const aCode = `${isFix ? "FIX" : "IMP"}-${specFolder.slice(0, 4)}-${f.slice(0, 6).replace(/[^0-9]/g, "") || "01"}`;

              const aAcs = [...fContent.matchAll(/###\s+(AC-[^\n]+)([\s\S]*?)(?=###|##|$)/g)].map((m) => ({
                name: m[1].trim(),
                details: m[2].trim().split("\n").map((l) => l.trim()).filter(Boolean),
              }));

              const aTasks = [...fContent.matchAll(/-\s*\[([ xX])\]\s*([^\n]+)/g)].map((m, idx) => ({
                id: `${specFolder}-${f}-t${idx + 1}`,
                num: idx + 1,
                task: m[2].trim(),
                completed: m[1].toLowerCase() === "x",
                status: m[1].toLowerCase() === "x" ? "done" : "todo",
              }));

              const aCompleted = aTasks.filter((t) => t.completed).length;
              const aStatus = aTasks.length > 0 && aCompleted === aTasks.length ? "done" : (aCompleted > 0 ? "doing" : "todo");

              const subdocItem = {
                id: `${specFolder}-addendum-${f.replace(/\.md$/, "")}`,
                code: aCode,
                title: fTitle,
                summary: fSummary || `Subdocumento de ${aTypeLabel.toLowerCase()} vinculado à spec ${title}.`,
                file: `specs/${specFolder}/addenda/${f}`,
                type: aType,
                typeLabel: aTypeLabel,
                status: aStatus,
                progressPercent: aTasks.length > 0 ? Math.round((aCompleted / aTasks.length) * 100) : 100,
                parentSpec: {
                  id: specFolder,
                  code: `${codePrefix}-${specFolder.slice(0, 4)}`,
                  title,
                },
                acs: aAcs,
                tasks: aTasks,
                tasksCount: aTasks.length,
                completedTasksCount: aCompleted,
                raw: fContent,
              };

              addendaList.push(subdocItem);
            }
          } catch {}
        }
      };

      checkAddendaDir(join(folderPath, "addenda"), "fix");
      checkAddendaDir(join(folderPath, "fixes"), "fix");
      checkAddendaDir(join(folderPath, "improvements"), "improvement");

      // Card da Spec principal
      cards.push({
        id: specFolder,
        code: `${codePrefix}-${specFolder.slice(0, 4)}`,
        title,
        summary: summary || "Requisito estruturado sob as diretrizes do Spec-Driven Development.",
        folder: specFolder,
        specPath: `specs/${specFolder}/spec.md`,
        tasksPath: `specs/${specFolder}/tasks.md`,
        status: overallStatus,
        priority,
        type,
        typeLabel,
        progressPercent,
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
        addenda: addendaList,
      });

      // Para cada subdocumento (adendo), anexa como card rastreável vinculado à spec pai!
      for (const ad of addendaList) {
        cards.push({
          id: ad.id,
          code: ad.code,
          title: ad.title,
          summary: ad.summary,
          folder: specFolder,
          specPath: ad.file,
          tasksPath: `specs/${specFolder}/tasks.md`,
          status: ad.status,
          priority: "P1",
          type: ad.type,
          typeLabel: ad.typeLabel,
          progressPercent: ad.progressPercent,
          parentSpec: ad.parentSpec,
          agent: "Dev Agent",
          tasksCount: ad.tasksCount,
          completedTasksCount: ad.completedTasksCount,
          tasks: ad.tasks,
          dodList: [],
          acList: ad.acs,
          specRaw: ad.raw,
          tasksRaw: "",
          agentHistory: [],
          lastAgentMessage: `Adendo vinculado à Spec: ${ad.parentSpec.title}`,
        });
      }
    }

    // Lê também Quick Tasks se existirem em specs/quick/
    const quickDir = join(projectDir, "specs", "quick");
    if (existsSync(quickDir)) {
      try {
        const qEntries = readdirSync(quickDir).filter((e) => !e.startsWith("_") && statSync(join(quickDir, e)).isDirectory());
        for (const qFolder of qEntries) {
          const qPath = join(quickDir, qFolder);
          const taskFile = join(qPath, "TASK.md");
          if (existsSync(taskFile)) {
            const taskContent = readFileSync(taskFile, "utf8");
            let qTitle = qFolder.replace(/^\d+-/, "").replace(/-/g, " ");
            const titleM = taskContent.match(/^#\s+(?:Quick Task\s*—\s*)?(.*)$/m);
            if (titleM) qTitle = titleM[1].trim();

            let qSummary = "";
            const whatM = taskContent.match(/- \*\*O quê:\*\*\s*(.*)/i);
            if (whatM) qSummary = whatM[1].trim();

            const checkMatches = [...taskContent.matchAll(/-\s*\[([ xX])\]\s*([^\n]+)/g)];
            const qTasks = checkMatches.map((m, idx) => ({
              id: `quick-${qFolder}-t${idx + 1}`,
              num: idx + 1,
              task: m[2].trim(),
              acCovered: "AC-Quick",
              gate: "test",
              status: m[1].toLowerCase() === "x" ? "done" : "todo",
              completed: m[1].toLowerCase() === "x",
            }));

            const qCompleted = qTasks.filter((t) => t.completed).length;
            totalTasksCount += qTasks.length;
            completedTasksCount += qCompleted;

            let qStatus = "todo";
            if (qTasks.length > 0 && qCompleted === qTasks.length) qStatus = "done";
            else if (qCompleted > 0) qStatus = "doing";

            const isBug = qTitle.toLowerCase().includes("bug") || qTitle.toLowerCase().includes("fix") || qTitle.toLowerCase().includes("corre");
            const qType = isBug ? "fix" : "improvement";
            const qTypeLabel = isBug ? "Correção" : "Melhoria";

            cards.push({
              id: `quick-${qFolder}`,
              code: `${isBug ? "FIX" : "IMP"}-${qFolder.slice(0, 4)}`,
              title: qTitle,
              summary: qSummary || "Tarefa leve sob rastro do SDD (Quick Task).",
              folder: `quick/${qFolder}`,
              specPath: `specs/quick/${qFolder}/TASK.md`,
              tasksPath: `specs/quick/${qFolder}/TASK.md`,
              status: qStatus,
              priority: "P2",
              type: qType,
              typeLabel: qTypeLabel,
              progressPercent: qTasks.length > 0 ? Math.round((qCompleted / qTasks.length) * 100) : (qStatus === "done" ? 100 : 0),
              agent: "Dev Agent",
              tasksCount: qTasks.length,
              completedTasksCount: qCompleted,
              tasks: qTasks,
              dodList: [],
              acList: [{ name: "AC-Quick: Validação", details: ["- Validação de conformidade rápida"] }],
              specRaw: taskContent,
              tasksRaw: taskContent,
              agentHistory: [],
              lastAgentMessage: "",
            });
          }
        }
      } catch {}
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
        progressPercent: totalTasksCount > 0 ? Math.round((completedTasksCount / totalTasksCount) * 100) : (cards.length > 0 && cards.every((c) => c.status === "done") ? 100 : 0),
        specsCount: cards.filter((c) => c.type === "spec").length,
        fixesCount: cards.filter((c) => c.type === "fix").length,
        improvementsCount: cards.filter((c) => c.type === "improvement").length,
        doneCount: cards.filter((c) => c.status === "done").length,
        doingCount: cards.filter((c) => c.status === "doing").length,
        testingCount: cards.filter((c) => c.status === "testing").length,
        todoCount: cards.filter((c) => c.status === "todo").length,
        backlogCount: cards.filter((c) => c.status === "backlog").length,
      },
    };
  }

  // Extrai Roadmap organizado do projeto
  getProjectRoadmap(projectDir = this.baseDir) {
    const roadmapFile = join(projectDir, "docs", "product", "roadmap.md");
    const featuresFile = join(projectDir, "docs", "product", "features.md");

    let objective = "Plano incremental de entrega das funcionalidades e valor do produto.";
    let nowItems = [];
    let nextItems = [];
    let laterItems = [];
    let adoptionItems = [];
    let rawContent = "";
    let source = "generated";

    if (existsSync(roadmapFile)) {
      source = "docs/product/roadmap.md";
      try {
        rawContent = readFileSync(roadmapFile, "utf8");
        const objMatch = rawContent.match(/##\s+Objetivo do roadmap\s*\n([\s\S]*?)(?=##|$)/i);
        if (objMatch) objective = objMatch[1].trim();

        // Extrai Agora
        const nowMatch = rawContent.match(/###\s+[🟢]?\s*Agora[^\n]*\n([\s\S]*?)(?=###|##|$)/i);
        if (nowMatch) nowItems = this.parseRoadmapTable(nowMatch[1]);

        // Extrai Próximo
        const nextMatch = rawContent.match(/###\s+[🟡]?\s*Próximo[^\n]*\n([\s\S]*?)(?=###|##|$)/i);
        if (nextMatch) nextItems = this.parseRoadmapTable(nextMatch[1]);

        // Extrai Depois
        const laterMatch = rawContent.match(/###\s+[⚪]?\s*Depois[^\n]*\n([\s\S]*?)(?=###|##|$)/i);
        if (laterMatch) laterItems = this.parseRoadmapTable(laterMatch[1]);

        // Extrai Adoção do SDD
        const adoptMatch = rawContent.match(/##\s+Adoção do SDD[^\n]*\n([\s\S]*?)(?=##|$)/i);
        if (adoptMatch) {
          adoptionItems = [...adoptMatch[1].matchAll(/-\s*\[([ xX])\]\s*([^\n]+)/g)].map((m) => ({
            checked: m[1].toLowerCase() === "x",
            text: m[2].trim(),
          }));
        }
      } catch {}
    } else if (existsSync(featuresFile)) {
      source = "docs/product/features.md";
      try {
        rawContent = readFileSync(featuresFile, "utf8");
        objective = "Funcionalidades sequenciadas em ondas de valor e validação (MVP).";

        const tableLines = rawContent.split("\n").filter((l) => l.trim().startsWith("|"));
        for (const line of tableLines) {
          const cols = line.split("|").map((c) => c.trim()).filter(Boolean);
          if (cols.length >= 5 && !cols[0].startsWith("#") && !cols[0].startsWith("---")) {
            const item = {
              num: cols[0],
              name: cols[1],
              journey: cols[2] || "",
              effort: cols[3] || "médio",
              value: cols[4] || "alto",
              wave: cols[5] || "1",
            };
            if (item.wave === "1") {
              nowItems.push({ item: item.name, value: item.value, effort: item.effort, status: "Agora (Onda 1 - MVP)" });
            } else if (item.wave === "2") {
              nextItems.push({ item: item.name, value: item.value, effort: item.effort, status: "Próximo (Onda 2)" });
            } else {
              laterItems.push({ item: item.name, value: item.value, effort: item.effort, status: "Depois" });
            }
          }
        }
      } catch {}
    }

    // Se ainda vazio, sincroniza com as specs ativas
    if (nowItems.length === 0 && nextItems.length === 0) {
      const kanban = this.getKanbanData(projectDir);
      for (const card of kanban.columns.done.concat(kanban.columns.doing, kanban.columns.testing)) {
        nowItems.push({
          item: card.title,
          value: card.priority === "P0" ? "Crítico" : "Alto",
          effort: `${card.tasksCount} tasks`,
          owner: card.agent,
          status: card.status.toUpperCase(),
        });
      }
      for (const card of kanban.columns.todo.concat(kanban.columns.backlog)) {
        nextItems.push({
          item: card.title,
          value: "Planejado",
          effort: `${card.tasksCount} tasks`,
          owner: "AI Architect",
          status: card.status.toUpperCase(),
        });
      }
    }

    return {
      source,
      objective,
      now: nowItems,
      next: nextItems,
      later: laterItems,
      adoption: adoptionItems,
      raw: rawContent,
    };
  }

  parseRoadmapTable(text) {
    const items = [];
    const lines = text.split("\n").filter((l) => l.trim().startsWith("|"));
    for (const l of lines) {
      const cols = l.split("|").map((c) => c.trim()).filter(Boolean);
      if (cols.length >= 2 && !cols[0].startsWith("#") && !cols[0].startsWith("---")) {
        items.push({
          num: cols[0],
          item: cols[1],
          value: cols[2] || "alto",
          effort: cols[3] || "baixo",
          owner: cols[4] || "Time",
          dependsOn: cols[5] || "—",
          readyWhen: cols[6] || "DoD verificado",
        });
      }
    }
    if (items.length === 0) {
      const listMatches = [...text.matchAll(/-\s*([^\n]+)/g)];
      for (const m of listMatches) {
        items.push({ item: m[1].trim(), value: "Alto", effort: "Médio" });
      }
    }
    return items;
  }

  // Extrai métricas analíticas e de fluxo do projeto
  getProjectMetrics(projectDir = this.baseDir) {
    const kanban = this.getKanbanData(projectDir);
    const metricsFile = join(projectDir, "docs", "engineering", "metrics.md");

    let rawContent = "";
    if (existsSync(metricsFile)) {
      try {
        rawContent = readFileSync(metricsFile, "utf8");
      } catch {}
    }

    const totalSpecs = kanban.stats.specsCount || 0;
    const totalFixes = kanban.stats.fixesCount || 0;
    const totalImprovements = kanban.stats.improvementsCount || 0;
    const totalTasks = kanban.stats.totalTasks || 0;
    const completedTasks = kanban.stats.completedTasks || 0;

    let totalAcs = 0;
    let totalDod = 0;
    let checkedDod = 0;

    const allCards = [
      ...kanban.columns.backlog,
      ...kanban.columns.todo,
      ...kanban.columns.doing,
      ...kanban.columns.testing,
      ...kanban.columns.done,
    ];

    for (const c of allCards) {
      totalAcs += (c.acList?.length || 1);
      if (c.dodList) {
        totalDod += c.dodList.length;
        checkedDod += c.dodList.filter((d) => d.checked).length;
      }
    }

    return {
      summary: {
        totalCards: allCards.length,
        specsCount: totalSpecs,
        fixesCount: totalFixes,
        improvementsCount: totalImprovements,
        completionRate: kanban.stats.progressPercent || 0,
        totalTasks,
        completedTasks,
        totalAcs,
        dodTotal: totalDod,
        dodCompleted: checkedDod,
      },
      distribution: {
        backlog: kanban.columns.backlog.length,
        todo: kanban.columns.todo.length,
        doing: kanban.columns.doing.length,
        testing: kanban.columns.testing.length,
        done: kanban.columns.done.length,
      },
      metricsFileExists: existsSync(metricsFile),
      raw: rawContent,
    };
  }

  // Lista documentações do projeto organizadas por categoria
  getProjectDocs(projectDir = this.baseDir) {
    const docs = [];
    const rootCandidates = [
      { path: "docs/STATE.md", title: "STATE — Memória viva do projeto", category: "Memória Viva" },
      { path: "README.md", title: "README — Manual e Esteira SDD", category: "Geral" },
      { path: "CLAUDE.md", title: "CLAUDE.md — Diretrizes e Convenções dos Agentes", category: "Geral" },
      { path: "docs/glossary.md", title: "Glossário — Linguagem Ubíqua (DDD)", category: "Produto" },
      { path: "docs/lessons.md", title: "Lessons Learned — Lições da Esteira", category: "Engenharia" },
    ];

    for (const r of rootCandidates) {
      const full = join(projectDir, r.path);
      if (existsSync(full)) {
        docs.push({
          path: r.path,
          title: r.title,
          category: r.category,
          size: statSync(full).size,
        });
      }
    }

    const scanCategory = (subDir, category) => {
      const targetDir = join(projectDir, "docs", subDir);
      if (existsSync(targetDir)) {
        try {
          const files = readdirSync(targetDir);
          for (const f of files) {
            const fPath = join(targetDir, f);
            if (statSync(fPath).isFile() && f.endsWith(".md") && !f.startsWith("_")) {
              const rel = `docs/${subDir}/${f}`;
              let title = f.replace(/\.md$/, "");
              try {
                const head = readFileSync(fPath, "utf8").slice(0, 500);
                const tm = head.match(/^#\s+(.*)$/m);
                if (tm) title = tm[1].trim();
              } catch {}
              docs.push({
                path: rel,
                title,
                category,
                size: statSync(fPath).size,
              });
            }
          }
        } catch {}
      }
    };

    scanCategory("product", "Produto");
    scanCategory("architecture", "Arquitetura");
    scanCategory("engineering", "Engenharia");

    return docs;
  }

  // Lê o conteúdo bruto de um documento markdown com validação de segurança
  getDocContent(projectDir = this.baseDir, relPath) {
    const base = resolve(projectDir);
    const safePath = resolve(projectDir, relPath);
    if (!safePath.startsWith(base)) {
      return { error: "Acesso negado: fora do diretório do projeto." };
    }
    if (!existsSync(safePath) || !statSync(safePath).isFile()) {
      return { error: "Documento não encontrado." };
    }
    try {
      const content = readFileSync(safePath, "utf8");
      return { path: relPath, content };
    } catch (err) {
      return { error: err.message };
    }
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

  // Identifica a spec mais aderente para um determinado bug ou melhoria
  findMatchingSpec(projectDir = this.baseDir, text) {
    const specsDir = join(projectDir, "specs");
    if (!existsSync(specsDir)) return null;

    let entries = [];
    try {
      entries = readdirSync(specsDir).filter((e) => !e.startsWith("_") && statSync(join(specsDir, e)).isDirectory());
    } catch {
      return null;
    }

    if (entries.length === 0) return null;

    const queryWords = text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length > 2);

    let bestSpec = null;
    let highestScore = 0;

    for (const folder of entries) {
      let score = 0;
      const folderNormalized = folder
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");

      for (const w of queryWords) {
        if (folderNormalized.includes(w)) score += 3;
      }

      const specFile = join(specsDir, folder, "spec.md");
      if (existsSync(specFile)) {
        try {
          const content = readFileSync(specFile, "utf8")
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "");
          for (const w of queryWords) {
            if (content.includes(w)) score += 1;
          }
        } catch {}
      }

      if (score > highestScore) {
        highestScore = score;
        bestSpec = folder;
      }
    }

    if (!bestSpec && entries.length > 0) {
      bestSpec = entries[entries.length - 1];
    }

    const title = bestSpec.replace(/^\d+-/, "").replace(/-/g, " ");

    return {
      specFolder: bestSpec,
      specCode: `REQ-${bestSpec.slice(0, 4)}`,
      title,
      confidence: highestScore >= 3 ? "alta" : "sugerida",
      score: highestScore,
    };
  }

  // Anexa um subdocumento (adendo) de bug ou melhoria dentro de uma spec existente
  attachAddendumToSpec(projectDir = this.baseDir, { specFolder, type = "fix", title, summary, acs = [], tasks = [] }) {
    const folderPath = join(projectDir, "specs", specFolder);
    if (!existsSync(folderPath)) {
      return { error: `Spec ${specFolder} não encontrada.` };
    }

    const addendaDir = join(folderPath, "addenda");
    mkdirSync(addendaDir, { recursive: true });

    let count = 1;
    try {
      const files = readdirSync(addendaDir).filter((f) => f.startsWith(type));
      count = files.length + 1;
    } catch {}

    const slug = title
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 35);

    const fileName = `${type}-${String(count).padStart(2, "0")}-${slug}.md`;
    const filePath = join(addendaDir, fileName);
    const code = `${type === "fix" ? "FIX" : "IMP"}-${specFolder.slice(0, 4)}-${String(count).padStart(2, "0")}`;
    const today = new Date().toISOString().split("T")[0];

    const content = `---
name: addendum
type: ${type}
spec: ${specFolder}
code: ${code}
title: ${title}
date: ${today}
status: todo
---

# Adendo — ${code}: ${title}

## Origem e Justificativa
${summary || `Subdocumento de ${type === "fix" ? "correção de bug" : "melhoria"} vinculado à funcionalidade ${specFolder}.`}

## Critérios de Aceite do Adendo
${
  acs.length > 0
    ? acs
        .map(
          (ac, i) => `### AC-${type.toUpperCase()}-${i + 1}: ${typeof ac === "string" ? ac : ac.name || ac.title}
- **Dado** o contexto da funcionalidade '${specFolder}'
- **Quando** a operação for disparada
- **Então** o comportamento deve estar rigorosamente em conformidade com este adendo`
        )
        .join("\n\n")
    : `### AC-${type.toUpperCase()}-1: Validação de conformidade do adendo
- **Dado** a regra de negócio ajustada
- **Quando** a ação for executada
- **Então** o comportamento deve ser estável e sem regressões`
}

## Definition of Done do Adendo
- [ ] Critérios de aceite validados pelo gate de teste executável
- [ ] Rastreabilidade garantida no tasks.md da spec pai (${specFolder})
- [ ] Sem SPEC_DEVIATION pendente
`;

    writeFileSync(filePath, content, "utf8");

    // Também anexa tarefas no tasks.md da spec pai
    const tasksFile = join(folderPath, "tasks.md");
    if (existsSync(tasksFile)) {
      try {
        let tasksRaw = readFileSync(tasksFile, "utf8");
        const lines = tasksRaw.split("\n");
        const tableEndIdx = lines.findLastIndex((l) => l.trim().startsWith("|") && !l.includes("Task") && !l.includes("---"));

        let maxTaskNum = 0;
        for (const l of lines) {
          if (l.trim().startsWith("|") && !l.includes("Task") && !l.includes("---")) {
            const cols = l.split("|").map((c) => c.trim()).filter(Boolean);
            const n = parseInt(cols[0], 10);
            if (!isNaN(n) && n > maxTaskNum) maxTaskNum = n;
          }
        }

        const newTasks = tasks.length > 0 ? tasks : [`Implementar e validar ${code}: ${title}`];
        const newLines = newTasks.map((t, idx) => {
          const tText = typeof t === "string" ? t : t.task || `Ajuste ${idx + 1}`;
          return `| ${maxTaskNum + idx + 1} | [${code}] ${tText.replace(/\|/g, "-")} | AC-${type.toUpperCase()}-1 | \`npm test\` | todo |`;
        });

        if (tableEndIdx !== -1 && newLines.length > 0) {
          lines.splice(tableEndIdx + 1, 0, ...newLines);
          writeFileSync(tasksFile, lines.join("\n"), "utf8");
        }
      } catch {}
    }

    // Registra rastro na memória viva
    this.updateStateFile(projectDir, specFolder, `Adendo ${code} anexado (${type.toUpperCase()})`);

    return {
      success: true,
      code,
      fileName,
      filePath: `specs/${specFolder}/addenda/${fileName}`,
      specFolder,
      title,
    };
  }
}
