import { createServer } from "node:http";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join, resolve, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { SddEngine } from "./sdd-engine.mjs";
import { HarnessMaster } from "./harness-master.mjs";
import { CliRunner } from "./cli-runner.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const UI_DIR = resolve(__dirname, "..", "ui");

export class KspecServer {
  constructor({ port = 3000, projectDir = process.cwd() } = {}) {
    this.port = port;
    this.projectDir = resolve(projectDir);
    this.sddEngine = new SddEngine(this.projectDir);
    this.cliRunner = new CliRunner();
    this.harness = new HarnessMaster(this.projectDir, this.cliRunner);
    this.sseClients = new Set();
  }

  start() {
    const server = createServer(async (req, res) => {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const pathname = url.pathname;

      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");

      if (req.method === "OPTIONS") {
        res.writeHead(204);
        res.end();
        return;
      }

      if (pathname.startsWith("/api/")) {
        await this.handleApi(req, res, url);
        return;
      }

      this.serveStatic(req, res, pathname);
    });

    server.listen(this.port, () => {
      console.log(`\n🚀 KSpec SDD OS rodando em: http://localhost:${this.port}`);
      console.log(`📂 Workspace atual: ${this.projectDir}\n`);
    });

    return server;
  }

  async handleApi(req, res, url) {
    const pathname = url.pathname;

    const sendJson = (data, status = 200) => {
      res.writeHead(status, { "Content-Type": "application/json" });
      res.end(JSON.stringify(data));
    };

    const readBody = () => {
      return new Promise((resolve) => {
        const chunks = [];
        req.on("data", (chunk) => chunks.push(chunk));
        req.on("end", () => {
          try {
            const raw = Buffer.concat(chunks).toString("utf8");
            resolve(raw ? JSON.parse(raw) : {});
          } catch {
            resolve({});
          }
        });
        req.on("error", () => resolve({}));
      });
    };

    try {
      // 1. Status das CLIs instaladas
      if (pathname === "/api/cli-status" && req.method === "GET") {
        const clis = await CliRunner.detectAvailableClis();
        return sendJson({ clis });
      }

      // 2. Projetos / Workspaces
      if (pathname === "/api/projects" && req.method === "GET") {
        const projects = SddEngine.listProjects(this.projectDir);
        const current = SddEngine.getProjectMeta(this.projectDir);
        return sendJson({ projects, activeProject: current });
      }

      // 3. Adicionar Novo Workspace
      if (pathname === "/api/projects/add" && req.method === "POST") {
        const { path: addPath } = await readBody();
        if (addPath && existsSync(addPath)) {
          const meta = SddEngine.registerWorkspace(addPath);
          return sendJson({ success: true, project: meta });
        }
        return sendJson({ error: "Caminho de pasta não encontrado no sistema." }, 400);
      }

      // 4. Alternar Workspace
      if (pathname === "/api/projects/switch" && req.method === "POST") {
        const { path: newPath } = await readBody();
        if (newPath && existsSync(newPath)) {
          this.projectDir = resolve(newPath);
          this.sddEngine = new SddEngine(this.projectDir);
          this.harness = new HarnessMaster(this.projectDir, this.cliRunner);
          return sendJson({ success: true, project: SddEngine.getProjectMeta(this.projectDir) });
        }
        return sendJson({ error: "Diretório inválido ou não encontrado." }, 400);
      }

      // 5. Dados do Kanban
      if (pathname === "/api/kanban" && req.method === "GET") {
        const kanban = this.sddEngine.getKanbanData(this.projectDir);
        return sendJson(kanban);
      }

      // 6. Mover Card / Atualizar Status no Kanban
      if (pathname === "/api/kanban/move" && req.method === "POST") {
        const { cardId, targetStatus, taskNum, triggerAgent = true, cliType = "auto" } = await readBody();
        const success = this.sddEngine.updateCardStatus(this.projectDir, cardId, targetStatus, taskNum);

        let agentExecution = null;
        if (success && triggerAgent) {
          let agentType = "dev";
          if (targetStatus === "testing") agentType = "qa";
          else if (targetStatus === "backlog" || targetStatus === "todo") agentType = "architect";

          const prompt = `Executar tarefa correspondente ao card ${cardId} no status ${targetStatus.toUpperCase()}`;
          const { runId, emitter } = await this.cliRunner.runAgentCli({
            agentType,
            cliType,
            prompt,
            cwd: this.projectDir,
            taskId: `${cardId}-${Date.now()}`,
            specPath: `specs/${cardId}/spec.md`,
          });

          emitter.on("log", (log) => this.broadcastSse({ event: "agent-log", runId, ...log }));
          
          emitter.on("end", (end) => {
            // Salva a mensagem do que foi feito no card
            const msg = end.code === 0
              ? `${agentType.toUpperCase()} AGENT concluiu com sucesso a execução de ${cardId} em conformidade com o DoD.`
              : `${agentType.toUpperCase()} AGENT finalizou com alertas/erros (código: ${end.code}).`;
            
            this.sddEngine.saveAgentMessageToCard(this.projectDir, cardId, {
              agentType,
              message: msg,
              log: end.log || "",
              status: targetStatus,
            });

            this.broadcastSse({ event: "agent-end", runId, ...end, cardId, agentMessage: msg });
          });

          agentExecution = { runId, agentType, status: "started" };
        }

        return sendJson({ success, agentExecution });
      }

      // 7. Atualizar Item de Tarefa (Checkbox) dentro do Card
      if (pathname === "/api/kanban/card-task" && req.method === "POST") {
        const { cardId, taskNum, completed, status } = await readBody();
        const success = this.sddEngine.updateCardTaskItem(this.projectDir, cardId, taskNum, { completed, status });
        return sendJson({ success });
      }

      // 8. Criar Card / Spec a partir do Spec Editor
      if (pathname === "/api/kanban/create" && req.method === "POST") {
        const specData = await readBody();
        const result = this.sddEngine.createSpecFromRequirement(this.projectDir, specData);
        return sendJson({ success: true, result });
      }

      // 9. Conversas do Spec Editor
      if (pathname === "/api/conversations" && req.method === "GET") {
        const convs = this.sddEngine.getConversations(this.projectDir);
        return sendJson({ conversations: convs });
      }

      // 10. Mensagem no Chat do Spec Editor
      if (pathname === "/api/conversations/message" && req.method === "POST") {
        const { conversationId, message, cliType = "auto" } = await readBody();
        const convs = this.sddEngine.getConversations(this.projectDir);
        let conv = convs.find((c) => c.id === conversationId);

        if (!conv) {
          conv = {
            id: conversationId || `conv-${Date.now()}`,
            title: message.slice(0, 35) + "...",
            date: new Date().toISOString().split("T")[0],
            messages: [],
          };
        }

        const userMsg = {
          sender: "user",
          senderName: "You",
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          text: message,
        };
        conv.messages.push(userMsg);

        const agentReply = await this.harness.processUserMessage(message, conv.messages, cliType);
        conv.messages.push(agentReply);

        this.sddEngine.saveConversation(this.projectDir, conv);
        return sendJson({ conversation: conv, reply: agentReply });
      }

      // 11. SSE Streaming para Logs dos Agentes
      if (pathname === "/api/agent/stream" && req.method === "GET") {
        res.writeHead(200, {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        });
        res.write("data: {\"event\":\"connected\"}\n\n");

        this.sseClients.add(res);
        req.on("close", () => this.sseClients.delete(res));
        return;
      }

      // 12. Execução Direta de Agente para um Card
      if (pathname === "/api/agent/run-card" && req.method === "POST") {
        const { cardId, agentType = "dev", cliType = "auto" } = await readBody();
        const prompt = `Executar desenvolvimento/validação completo para o requisito ${cardId}`;
        const { runId, emitter } = await this.cliRunner.runAgentCli({
          agentType,
          cliType,
          prompt,
          cwd: this.projectDir,
          specPath: `specs/${cardId}/spec.md`,
        });

        emitter.on("log", (log) => this.broadcastSse({ event: "agent-log", runId, ...log }));
        
        emitter.on("end", (end) => {
          const msg = `${agentType.toUpperCase()} AGENT concluiu a execução em ${cardId} (exit: ${end.code}).`;
          this.sddEngine.saveAgentMessageToCard(this.projectDir, cardId, {
            agentType,
            message: msg,
            log: end.log || "",
            status: agentType === "qa" ? "testing" : "doing",
          });
          this.broadcastSse({ event: "agent-end", runId, ...end, cardId, agentMessage: msg });
        });

        return sendJson({ runId, status: "started" });
      }

      sendJson({ error: "Endpoint não encontrado" }, 404);
    } catch (err) {
      sendJson({ error: err.message }, 500);
    }
  }

  broadcastSse(data) {
    const payload = `data: ${JSON.stringify(data)}\n\n`;
    for (const client of this.sseClients) {
      try {
        client.write(payload);
      } catch {
        this.sseClients.delete(client);
      }
    }
  }

  serveStatic(req, res, pathname) {
    let filePath = join(UI_DIR, pathname === "/" ? "index.html" : pathname);

    if (!existsSync(filePath) || statSync(filePath).isDirectory()) {
      filePath = join(UI_DIR, "index.html");
    }

    const mimeTypes = {
      ".html": "text/html",
      ".css": "text/css",
      ".js": "application/javascript",
      ".json": "application/json",
      ".svg": "image/svg+xml",
      ".png": "image/png",
      ".ico": "image/x-icon",
    };

    const ext = extname(filePath);
    const contentType = mimeTypes[ext] || "text/plain";

    try {
      const content = readFileSync(filePath);
      res.writeHead(200, { "Content-Type": contentType });
      res.end(content);
    } catch {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not Found");
    }
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = process.env.PORT || 3000;
  const server = new KspecServer({ port });
  server.start();
}
