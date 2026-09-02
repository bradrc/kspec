/**
 * BuildX SDD OS — Frontend Application Logic
 */

// Estado Global da Aplicação
const state = {
  currentView: 'projects',
  activeProject: null,
  projects: [],
  kanban: { columns: {}, stats: {} },
  conversations: [],
  activeConversationId: null,
  availableClis: {},
  selectedCli: 'auto',
  terminalOpen: false,
};

// Elementos DOM
const elements = {
  navItems: document.querySelectorAll('.nav-item'),
  viewPanels: document.querySelectorAll('.view-panel'),
  workspaceDropdownTrigger: document.getElementById('workspaceDropdownTrigger'),
  workspaceMenu: document.getElementById('workspaceMenu'),
  currentWorkspaceName: document.getElementById('currentWorkspaceName'),
  projectsGrid: document.getElementById('projectsGrid'),
  refreshKanbanBtn: document.getElementById('refreshKanbanBtn'),
  openSpecFromKanbanBtn: document.getElementById('openSpecFromKanbanBtn'),
  conversationsList: document.getElementById('conversationsList'),
  chatMessages: document.getElementById('chatMessages'),
  chatForm: document.getElementById('chatForm'),
  chatInput: document.getElementById('chatInput'),
  newConversationBtn: document.getElementById('newConversationBtn'),
  cliSelect: document.getElementById('cliSelect'),
  toggleTerminalBtn: document.getElementById('toggleTerminalBtn'),
  terminalDrawer: document.getElementById('terminalDrawer'),
  terminalOutput: document.getElementById('terminalOutput'),
  terminalStatus: document.getElementById('terminalStatus'),
  clearTerminalBtn: document.getElementById('clearTerminalBtn'),
  closeTerminalBtn: document.getElementById('closeTerminalBtn'),
};

// ==========================================================================
// 1. Inicialização
// ==========================================================================
async function init() {
  setupEventListeners();
  setupSseStream();
  await loadCliStatus();
  await loadProjects();
  await loadKanban();
  await loadConversations();
}

// ==========================================================================
// 2. Configuração de Eventos
// ==========================================================================
function setupEventListeners() {
  // Navegação entre Views
  elements.navItems.forEach((btn) => {
    btn.addEventListener('click', () => {
      const view = btn.dataset.view;
      switchView(view);
    });
  });

  // Dropdown de Workspaces
  elements.workspaceDropdownTrigger.addEventListener('click', (e) => {
    e.stopPropagation();
    elements.workspaceMenu.classList.toggle('show');
  });

  document.addEventListener('click', () => {
    elements.workspaceMenu.classList.remove('show');
  });

  // Botões de Ação
  elements.refreshKanbanBtn?.addEventListener('click', () => loadKanban());
  elements.openSpecFromKanbanBtn?.addEventListener('click', () => switchView('spec-editor'));

  const addWsBtn = document.getElementById('addWorkspaceBtn');
  addWsBtn?.addEventListener('click', async () => {
    const dir = prompt('Digite o caminho absoluto do projeto no seu computador:');
    if (dir && dir.trim()) {
      try {
        const res = await fetch('/api/projects/add', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: dir.trim() }),
        });
        const data = await res.json();
        if (data.success) {
          await loadProjects();
          await switchProject(dir.trim());
          logTerminal(`[SISTEMA] Novo workspace registrado: ${dir.trim()}`, 'system');
        } else {
          alert(data.error || 'Diretório não encontrado.');
        }
      } catch (err) {
        alert('Erro ao adicionar workspace.');
      }
    }
  });

  // Chat do Spec Editor
  elements.chatForm?.addEventListener('submit', handleSendMessage);
  elements.newConversationBtn?.addEventListener('click', createNewConversation);

  // Seletor de CLI
  elements.cliSelect?.addEventListener('change', (e) => {
    state.selectedCli = e.target.value;
    logTerminal(`[SISTEMA] CLI runner alterado para: ${state.selectedCli}`, 'system');
  });

  // Terminal Drawer
  elements.toggleTerminalBtn?.addEventListener('click', toggleTerminal);
  elements.closeTerminalBtn?.addEventListener('click', () => setTerminalState(false));
  elements.clearTerminalBtn?.addEventListener('click', () => {
    elements.terminalOutput.innerHTML = '';
  });
}

// ==========================================================================
// 3. Gerenciamento de Rotas / Views
// ==========================================================================
function switchView(viewName) {
  state.currentView = viewName;

  // Atualiza navegação
  elements.navItems.forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.view === viewName);
  });

  // Atualiza painéis
  elements.viewPanels.forEach((panel) => {
    panel.classList.toggle('active', panel.id === `view-${viewName}`);
  });

  if (viewName === 'kanban') loadKanban();
  if (viewName === 'spec-editor') loadConversations();
}

// ==========================================================================
// 4. Projetos & Workspaces
// ==========================================================================
async function loadProjects() {
  try {
    const res = await fetch('/api/projects');
    const data = await res.json();
    state.projects = data.projects || [];
    state.activeProject = data.activeProject;

    if (state.activeProject) {
      elements.currentWorkspaceName.textContent = state.activeProject.name;
    }

    renderWorkspaceDropdown();
    renderProjectsGrid();
  } catch (err) {
    console.error('Erro ao carregar projetos:', err);
  }
}

function renderWorkspaceDropdown() {
  elements.workspaceMenu.innerHTML = '';
  state.projects.forEach((proj) => {
    const item = document.createElement('div');
    item.className = `workspace-dropdown-item ${proj.path === state.activeProject?.path ? 'active' : ''}`;
    item.innerHTML = `
      <span>${proj.name}</span>
      <span style="font-size: 0.7rem; color: var(--text-muted);">${proj.stack}</span>
    `;
    item.addEventListener('click', () => switchProject(proj.path));
    elements.workspaceMenu.appendChild(item);
  });
}

function renderProjectsGrid() {
  elements.projectsGrid.innerHTML = '';

  state.projects.forEach((proj) => {
    const card = document.createElement('div');
    card.className = 'project-card';
    card.innerHTML = `
      <div class="project-card-header">
        <div class="project-icon-box">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="20" height="14" x="2" y="7" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
        </div>
        <div class="project-actions">
          <button class="icon-action-btn" title="Recarregar" onclick="loadKanban()">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
          </button>
          <button class="icon-action-btn" title="Docs SDD" onclick="switchView('spec-editor')">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
          </button>
        </div>
      </div>

      <div>
        <h3 class="project-title">${proj.name}</h3>
      </div>

      <div class="project-stack-badge">
        &lt;&gt; ${proj.stack}
      </div>

      <div class="project-meta-list">
        <div class="project-meta-item">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><circle cx="18" cy="6" r="3"/><path d="M18 9v1a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V9"/><path d="M12 12v3"/></svg>
          <span>${proj.repo}</span>
        </div>
        <div class="project-meta-item">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
          <span>Workspace Local</span>
        </div>
        <div class="project-meta-item">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
          <span>Technical Context (AI)</span>
        </div>
      </div>

      <div class="project-card-footer">
        <button class="project-open-btn" onclick="openProjectKanban('${proj.path}')">
          <span>Abrir Kanban</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 18 6-6-6-6"/></svg>
        </button>
      </div>
    `;
    elements.projectsGrid.appendChild(card);
  });
}

window.openProjectKanban = async (projPath) => {
  await switchProject(projPath);
  switchView('kanban');
};

async function switchProject(projPath) {
  try {
    const res = await fetch('/api/projects/switch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: projPath }),
    });
    const data = await res.json();
    if (data.success) {
      state.activeProject = data.project;
      elements.currentWorkspaceName.textContent = data.project.name;
      renderWorkspaceDropdown();
      await loadKanban();
      await loadConversations();
      logTerminal(`[SISTEMA] Workspace ativo alterado para: ${data.project.name}`, 'system');
    }
  } catch (err) {
    console.error('Erro ao alternar projeto:', err);
  }
}

// ==========================================================================
// 5. Kanban Interativo
// ==========================================================================
async function loadKanban() {
  try {
    const res = await fetch('/api/kanban');
    const data = await res.json();
    state.kanban = data;
    renderKanbanBoard();
  } catch (err) {
    console.error('Erro ao carregar dados do Kanban:', err);
  }
}

function renderKanbanBoard() {
  const columns = ['backlog', 'todo', 'doing', 'testing', 'done'];

  columns.forEach((colKey) => {
    const colContainer = document.getElementById(`col-${colKey}`);
    const badgeCount = document.getElementById(`count-${colKey}`);
    const cards = state.kanban.columns?.[colKey] || [];

    if (badgeCount) badgeCount.textContent = cards.length;
    if (!colContainer) return;

    colContainer.innerHTML = '';

    // Permite soltar cards na coluna (Drag and drop)
    colContainer.ondragover = (e) => {
      e.preventDefault();
      colContainer.style.backgroundColor = 'rgba(59, 130, 246, 0.08)';
    };
    colContainer.ondragleave = () => {
      colContainer.style.backgroundColor = '';
    };
    colContainer.ondrop = async (e) => {
      e.preventDefault();
      colContainer.style.backgroundColor = '';
      const cardId = e.dataTransfer.getData('text/plain');
      if (cardId) {
        await moveCardToColumn(cardId, colKey);
      }
    };

    cards.forEach((card) => {
      const cardEl = document.createElement('div');
      cardEl.className = 'kanban-card';
      cardEl.draggable = true;

      cardEl.ondragstart = (e) => {
        e.dataTransfer.setData('text/plain', card.id);
      };

      const pClass = (card.priority || 'P1').toLowerCase();

      cardEl.innerHTML = `
        <div class="card-top-row">
          <span class="card-req-badge ${pClass}">${card.code} - ${card.priority || 'P1'}</span>
          <button class="card-menu-btn" title="Mais opções">•••</button>
        </div>

        <h4 class="card-title">${card.title}</h4>

        ${
          card.tasks?.length > 0
            ? `<div class="card-dependency">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                <span>${card.tasks[0].task.slice(0, 45)}...</span>
              </div>`
            : ''
        }

        <p class="card-summary">${card.summary}</p>

        <div class="card-footer">
          <span class="card-agent-badge">${card.agent}</span>
          <div class="card-meta-counts">
            <span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
              ${card.tasksCount} tarefas
            </span>
            <span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              ${card.acList?.length || 1}
            </span>
          </div>
        </div>
      `;

      colContainer.appendChild(cardEl);
    });
  });
}

// Mover Card e disparar Agente CLI
async function moveCardToColumn(cardId, targetStatus) {
  try {
    logTerminal(`[KANBAN] Movendo card ${cardId} para [${targetStatus.toUpperCase()}]...`, 'system');
    setTerminalState(true);

    const res = await fetch('/api/kanban/move', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cardId,
        targetStatus,
        triggerAgent: true,
        cliType: state.selectedCli,
      }),
    });

    const data = await res.json();
    if (data.success) {
      await loadKanban();
      if (data.agentExecution) {
        logTerminal(`🚀 [CLI AGENT DISPARADO] Modo: ${data.agentExecution.agentType.toUpperCase()} | RunId: ${data.agentExecution.runId}`, 'system');
      }
    }
  } catch (err) {
    console.error('Erro ao mover card:', err);
    logTerminal(`❌ Erro ao mover card: ${err.message}`, 'error');
  }
}

// ==========================================================================
// 6. Spec Conversations / Spec Editor
// ==========================================================================
async function loadConversations() {
  try {
    const res = await fetch('/api/conversations');
    const data = await res.json();
    state.conversations = data.conversations || [];

    if (!state.activeConversationId && state.conversations.length > 0) {
      state.activeConversationId = state.conversations[0].id;
    }

    renderConversationsList();
    renderActiveConversation();
  } catch (err) {
    console.error('Erro ao carregar conversas:', err);
  }
}

function renderConversationsList() {
  elements.conversationsList.innerHTML = '';

  state.conversations.forEach((conv) => {
    const item = document.createElement('div');
    item.className = `history-item ${conv.id === state.activeConversationId ? 'active' : ''}`;

    const lastMsg = conv.messages?.[conv.messages.length - 1]?.text || 'Nova conversa';

    item.innerHTML = `
      <span class="history-date">${conv.date || 'Hoje'}</span>
      <span class="history-text-preview">${conv.title || lastMsg}</span>
      <span class="history-msg-count">${conv.messages?.length || 0} msgs</span>
    `;

    item.addEventListener('click', () => {
      state.activeConversationId = conv.id;
      renderConversationsList();
      renderActiveConversation();
    });

    elements.conversationsList.appendChild(item);
  });
}

function renderActiveConversation() {
  elements.chatMessages.innerHTML = '';
  const conv = state.conversations.find((c) => c.id === state.activeConversationId);
  if (!conv || !conv.messages) return;

  conv.messages.forEach((msg) => {
    const msgEl = document.createElement('div');
    msgEl.className = `chat-message ${msg.sender === 'user' ? 'user' : 'architect'}`;

    msgEl.innerHTML = `
      <div class="chat-avatar">
        ${
          msg.sender === 'user'
            ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`
            : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 10h.01"/><path d="M15 10h.01"/><path d="M8 15h8"/></svg>`
        }
      </div>

      <div class="message-bubble">
        <div class="message-header">
          <span class="message-sender">${msg.senderName || (msg.sender === 'user' ? 'You' : 'Architect Agent')}</span>
          <span class="message-time">${msg.time || ''}</span>
        </div>

        <div class="message-text">${msg.text}</div>

        ${
          msg.generatedCard
            ? `
            <div class="generated-card-box">
              <div class="generated-card-header">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
                <span>1 card gerado para o Kanban</span>
              </div>
              <div class="generated-card-content">
                <div class="generated-card-title">
                  <span class="generated-card-badge">1</span>
                  <span>${msg.generatedCard.title}</span>
                </div>
                <div class="generated-card-tasks">
                  ${msg.generatedCard.tasks
                    .map(
                      (task) => `
                      <label class="checklist-item">
                        <input type="checkbox" checked />
                        <span>${task}</span>
                      </label>
                    `
                    )
                    .join('')}
                </div>
                <div class="generated-card-action">
                  <button class="btn btn-primary" onclick='sendCardToKanban(${JSON.stringify(msg.generatedCard)})'>
                    <span>Enviar Card para o Kanban</span>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 18 6-6-6-6"/></svg>
                  </button>
                </div>
              </div>
            </div>
            `
            : ''
        }
      </div>
    `;

    elements.chatMessages.appendChild(msgEl);
  });

  elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
}

// Enviar mensagem no chat
async function handleSendMessage(e) {
  e.preventDefault();
  const text = elements.chatInput.value.trim();
  if (!text) return;

  elements.chatInput.value = '';

  try {
    const res = await fetch('/api/conversations/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversationId: state.activeConversationId,
        message: text,
        cliType: state.selectedCli,
      }),
    });

    const data = await res.json();
    if (data.conversation) {
      // Atualiza ou insere na lista
      const idx = state.conversations.findIndex((c) => c.id === data.conversation.id);
      if (idx >= 0) state.conversations[idx] = data.conversation;
      else state.conversations.unshift(data.conversation);

      state.activeConversationId = data.conversation.id;
      renderConversationsList();
      renderActiveConversation();
    }
  } catch (err) {
    console.error('Erro ao enviar mensagem:', err);
  }
}

// Enviar Card gerado no chat diretamente para o Kanban & Filesystem SDD
window.sendCardToKanban = async (cardData) => {
  try {
    logTerminal(`[SDD ENGINE] Criando nova especificação: ${cardData.title}...`, 'system');
    setTerminalState(true);

    const res = await fetch('/api/kanban/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: cardData.title,
        summary: cardData.summary,
        acs: cardData.acs,
        tasks: cardData.tasks,
        priority: 'P1',
      }),
    });

    const data = await res.json();
    if (data.success) {
      logTerminal(`✅ Spec e Tasks criadas em: ${data.result.specPath}`, 'stdout');
      await loadKanban();
      switchView('kanban');
    }
  } catch (err) {
    console.error('Erro ao criar card:', err);
    logTerminal(`❌ Erro ao criar card: ${err.message}`, 'error');
  }
};

function createNewConversation() {
  const newId = `conv-${Date.now()}`;
  const newConv = {
    id: newId,
    title: 'Nova Conversa SDD',
    date: 'Hoje',
    messages: [
      {
        sender: 'architect',
        senderName: 'AI Architect',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        text: 'Olá! Sou o Harness Master do SDD. O que vamos projetar ou refinar hoje?',
      },
    ],
  };

  state.conversations.unshift(newConv);
  state.activeConversationId = newId;
  renderConversationsList();
  renderActiveConversation();
}

// ==========================================================================
// 7. Detecção de LLM CLIs & Terminal Drawer
// ==========================================================================
async function loadCliStatus() {
  try {
    const res = await fetch('/api/cli-status');
    const data = await res.json();
    state.availableClis = data.clis || {};

    // Popula o select
    elements.cliSelect.innerHTML = '';
    const autoOpt = document.createElement('option');
    autoOpt.value = 'auto';
    autoOpt.textContent = 'Auto (Detectar Ambiente)';
    elements.cliSelect.appendChild(autoOpt);

    for (const [key, info] of Object.entries(state.availableClis)) {
      if (['claude', 'gemini', 'codex'].includes(key)) {
        const opt = document.createElement('option');
        opt.value = key;
        opt.textContent = `${info.name} ${info.available ? '✓' : '(não detectado)'}`;
        elements.cliSelect.appendChild(opt);
      }
    }
  } catch (err) {
    console.error('Erro ao carregar status das CLIs:', err);
  }
}

function setupSseStream() {
  const eventSource = new EventSource('/api/agent/stream');

  eventSource.onmessage = (e) => {
    try {
      const data = JSON.parse(e.data);
      if (data.event === 'agent-log') {
        logTerminal(`[${data.runId || 'AGENT'}] ${data.text}`, data.type || 'stdout');
      } else if (data.event === 'agent-end') {
        logTerminal(`🏁 Execução concluída (exit code: ${data.code})`, data.code === 0 ? 'stdout' : 'stderr');
        elements.terminalStatus.textContent = 'Pronto';
      }
    } catch {}
  };

  eventSource.onerror = () => {
    // Reconecta silenciosamente
  };
}

function toggleTerminal() {
  setTerminalState(!state.terminalOpen);
}

function setTerminalState(open) {
  state.terminalOpen = open;
  elements.terminalDrawer.classList.toggle('open', open);
}

function logTerminal(text, type = 'stdout') {
  const line = document.createElement('div');
  line.className = `terminal-line ${type}`;
  line.textContent = text;
  elements.terminalOutput.appendChild(line);
  elements.terminalOutput.scrollTop = elements.terminalOutput.scrollHeight;
}

// Inicia aplicação
document.addEventListener('DOMContentLoaded', init);
