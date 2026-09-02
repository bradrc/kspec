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
  activeCard: null,
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
  cardDetailModal: document.getElementById('cardDetailModal'),
  closeCardModalBtn: document.getElementById('closeCardModalBtn'),
  modalCardBadge: document.getElementById('modalCardBadge'),
  modalCardAgent: document.getElementById('modalCardAgent'),
  modalStatusSelect: document.getElementById('modalStatusSelect'),
  modalCardTitle: document.getElementById('modalCardTitle'),
  modalCardSummary: document.getElementById('modalCardSummary'),
  modalTasksCount: document.getElementById('modalTasksCount'),
  modalHistoryCount: document.getElementById('modalHistoryCount'),
  modalTasksList: document.getElementById('modalTasksList'),
  modalCriteriaList: document.getElementById('modalCriteriaList'),
  modalAgentHistoryList: document.getElementById('modalAgentHistoryList'),
  modalRunDevBtn: document.getElementById('modalRunDevBtn'),
  modalRunQaBtn: document.getElementById('modalRunQaBtn'),
  modalSaveBtn: document.getElementById('modalSaveBtn'),
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
  elements.workspaceDropdownTrigger?.addEventListener('click', (e) => {
    e.stopPropagation();
    elements.workspaceMenu.classList.toggle('show');
  });

  document.addEventListener('click', () => {
    elements.workspaceMenu?.classList.remove('show');
  });

  // Botões de Ação do Kanban
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
  elements.newConversationBtn?.addEventListener('click', startNewConversation);

  // CLI Selector
  elements.cliSelect?.addEventListener('change', (e) => {
    state.selectedCli = e.target.value;
    logTerminal(`[SISTEMA] CLI runner alterado para: ${state.selectedCli}`, 'system');
  });

  // Terminal Drawer
  elements.toggleTerminalBtn?.addEventListener('click', toggleTerminal);
  elements.closeTerminalBtn?.addEventListener('click', () => setTerminalState(false));
  elements.clearTerminalBtn?.addEventListener('click', () => {
    elements.terminalOutput.innerHTML = '';
    logTerminal('[SISTEMA] Console limpo.', 'system');
  });

  // Modal de Detalhes do Card
  elements.closeCardModalBtn?.addEventListener('click', closeCardModal);
  elements.cardDetailModal?.addEventListener('click', (e) => {
    if (e.target === elements.cardDetailModal) closeCardModal();
  });

  // Tabs do Modal
  const modalTabs = document.querySelectorAll('.modal-tab');
  modalTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      modalTabs.forEach((t) => t.classList.remove('active'));
      document.querySelectorAll('.modal-tab-content').forEach((c) => c.classList.remove('active'));

      tab.classList.add('active');
      const targetContent = document.getElementById(`tab-${tab.dataset.tab}`);
      targetContent?.classList.add('active');
    });
  });

  // Ações dentro do Modal
  elements.modalRunDevBtn?.addEventListener('click', () => {
    if (state.activeCard) runAgentForCard(state.activeCard.id, 'dev');
  });

  elements.modalRunQaBtn?.addEventListener('click', () => {
    if (state.activeCard) runAgentForCard(state.activeCard.id, 'qa');
  });

  elements.modalSaveBtn?.addEventListener('click', async () => {
    if (state.activeCard) {
      const newStatus = elements.modalStatusSelect.value;
      if (newStatus !== state.activeCard.status) {
        await moveCardToColumn(state.activeCard.id, newStatus);
      }
      closeCardModal();
    }
  });
}

// ==========================================================================
// 3. Controle de Views
// ==========================================================================
function switchView(viewName) {
  state.currentView = viewName;

  elements.navItems.forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.view === viewName);
  });

  elements.viewPanels.forEach((panel) => {
    panel.classList.toggle('active', panel.id === `view-${viewName}`);
  });

  if (viewName === 'kanban') loadKanban();
  if (viewName === 'projects') loadProjects();
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
    state.activeProject = data.activeProject || null;

    if (state.activeProject) {
      elements.currentWorkspaceName.textContent = state.activeProject.name;
    }

    renderProjectsGrid();
    renderWorkspaceMenu();
  } catch (err) {
    console.error('Erro ao carregar projetos:', err);
  }
}

function renderProjectsGrid() {
  if (!elements.projectsGrid) return;
  elements.projectsGrid.innerHTML = '';

  state.projects.forEach((proj) => {
    const card = document.createElement('div');
    card.className = `project-card ${state.activeProject?.path === proj.path ? 'active-project' : ''}`;
    card.onclick = () => switchProject(proj.path);

    card.innerHTML = `
      <div class="project-header">
        <h3 class="project-name">${proj.name}</h3>
        <span class="project-tag ${proj.stack.toLowerCase()}">${proj.stack}</span>
      </div>
      <p class="project-summary">${proj.stateSummary || 'Memória SDD ativa.'}</p>
      <div class="project-footer">
        <div class="project-git">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><path d="M13 6h3a2 2 0 0 1 2 2v7"/><line x1="6" y1="9" x2="6" y2="21"/></svg>
          <span>${proj.repo}</span>
        </div>
        <span class="badge ${proj.hasSdd ? 'badge-success' : 'badge-warning'}">
          ${proj.hasSdd ? 'SDD Ready' : 'Sem SDD'}
        </span>
      </div>
    `;

    elements.projectsGrid.appendChild(card);
  });
}

function renderWorkspaceMenu() {
  if (!elements.workspaceMenu) return;
  elements.workspaceMenu.innerHTML = '';

  state.projects.forEach((proj) => {
    const item = document.createElement('div');
    item.className = `workspace-menu-item ${state.activeProject?.path === proj.path ? 'selected' : ''}`;
    item.innerHTML = `
      <span>${proj.name}</span>
      <span class="item-tag">${proj.stack}</span>
    `;
    item.onclick = (e) => {
      e.stopPropagation();
      elements.workspaceMenu.classList.remove('show');
      switchProject(proj.path);
    };
    elements.workspaceMenu.appendChild(item);
  });
}

async function switchProject(path) {
  try {
    const res = await fetch('/api/projects/switch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path }),
    });
    const data = await res.json();
    if (data.success) {
      state.activeProject = data.project;
      elements.currentWorkspaceName.textContent = data.project.name;
      await loadProjects();
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

      // Abre modal de detalhes ao clicar no card
      cardEl.onclick = (e) => {
        if (!e.target.closest('.card-menu-btn')) {
          openCardModal(card);
        }
      };

      const pClass = (card.priority || 'P1').toLowerCase();

      cardEl.innerHTML = `
        <div class="card-top-row">
          <span class="card-req-badge ${pClass}">${card.code} - ${card.priority || 'P1'}</span>
          <button class="card-menu-btn" title="Ver detalhes">•••</button>
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

        ${
          card.lastAgentMessage
            ? `<div class="card-agent-message">💬 ${card.lastAgentMessage}</div>`
            : ''
        }

        <div class="card-footer">
          <span class="card-agent-badge">${card.agent}</span>
          <div class="card-meta-counts">
            <span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
              ${card.completedTasksCount || 0}/${card.tasksCount || 0}
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
      if (data.agentExecution) {
        logTerminal(`🚀 [CLI AGENT DISPARADO] Modo: ${data.agentExecution.agentType.toUpperCase()} | RunId: ${data.agentExecution.runId}`, 'system');
        elements.terminalStatus.textContent = `Rodando (${data.agentExecution.agentType.toUpperCase()})`;
      }
      await loadKanban();
    }
  } catch (err) {
    console.error('Erro ao mover card:', err);
  }
}

// ==========================================================================
// 6. Modal de Detalhes do Card
// ==========================================================================
function openCardModal(card) {
  state.activeCard = card;

  elements.modalCardBadge.textContent = card.code || 'REQ-0001';
  elements.modalCardBadge.className = `card-req-badge ${(card.priority || 'P1').toLowerCase()}`;
  elements.modalCardAgent.textContent = card.agent || 'AI Architect';
  elements.modalStatusSelect.value = card.status || 'backlog';
  elements.modalCardTitle.textContent = card.title;
  elements.modalCardSummary.textContent = card.summary;
  elements.modalTasksCount.textContent = card.tasks?.length || 0;
  elements.modalHistoryCount.textContent = card.agentHistory?.length || 0;

  renderModalTasks(card);
  renderModalCriteria(card);
  renderModalHistory(card);

  elements.cardDetailModal.classList.add('show');
}

function closeCardModal() {
  elements.cardDetailModal.classList.remove('show');
  state.activeCard = null;
}

function renderModalTasks(card) {
  elements.modalTasksList.innerHTML = '';

  if (!card.tasks || card.tasks.length === 0) {
    elements.modalTasksList.innerHTML = '<p class="text-muted">Nenhuma tarefa detalhada no tasks.md.</p>';
    return;
  }

  card.tasks.forEach((t) => {
    const item = document.createElement('div');
    item.className = 'modal-task-item';

    item.innerHTML = `
      <div class="modal-task-left">
        <input type="checkbox" class="modal-task-checkbox" ${t.completed ? 'checked' : ''} />
        <span class="modal-task-text ${t.completed ? 'completed' : ''}">#${t.num} ${t.task}</span>
      </div>
      <div class="modal-task-tags">
        <span class="modal-task-tag">${t.acCovered || 'AC-1'}</span>
        <span class="modal-task-tag gate">${t.gate || 'npm test'}</span>
      </div>
    `;

    const checkbox = item.querySelector('.modal-task-checkbox');
    const taskText = item.querySelector('.modal-task-text');

    checkbox.onchange = async () => {
      const isChecked = checkbox.checked;
      taskText.classList.toggle('completed', isChecked);
      t.completed = isChecked;
      t.status = isChecked ? 'done' : 'todo';

      try {
        await fetch('/api/kanban/card-task', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            cardId: card.id,
            taskNum: t.num,
            completed: isChecked,
            status: t.status,
          }),
        });
        await loadKanban();
      } catch {}
    };

    elements.modalTasksList.appendChild(item);
  });
}

function renderModalCriteria(card) {
  elements.modalCriteriaList.innerHTML = '';

  if (card.acList && card.acList.length > 0) {
    card.acList.forEach((ac) => {
      const el = document.createElement('div');
      el.className = 'criteria-card';
      el.innerHTML = `
        <div class="criteria-card-title">${ac.name}</div>
        <div class="criteria-card-details">${ac.details?.join('\n') || '- Cenário de validação'}</div>
      `;
      elements.modalCriteriaList.appendChild(el);
    });
  } else {
    elements.modalCriteriaList.innerHTML = `
      <div class="criteria-card">
        <div class="criteria-card-title">AC-1: Critério Geral de Aceite</div>
        <div class="criteria-card-details">- Dado o contexto da feature\n- Quando a operação for realizada\n- Então deve estar conforme a especificação.</div>
      </div>
    `;
  }
}

function renderModalHistory(card) {
  elements.modalAgentHistoryList.innerHTML = '';

  if (card.agentHistory && card.agentHistory.length > 0) {
    card.agentHistory.forEach((act) => {
      const el = document.createElement('div');
      el.className = 'agent-history-card';
      el.innerHTML = `
        <div class="agent-history-card-header">
          <span class="agent-history-author">🤖 ${act.agentType.toUpperCase()} AGENT</span>
          <span class="agent-history-time">${act.timeFormatted || ''} (${act.timestamp?.split('T')[0] || ''})</span>
        </div>
        <div class="agent-history-message">${act.message}</div>
      `;
      elements.modalAgentHistoryList.appendChild(el);
    });
  } else {
    elements.modalAgentHistoryList.innerHTML = `
      <div class="criteria-card">
        <div class="criteria-card-details">Nenhuma execução de agente registrada para este card ainda. Clique em "Disparar Dev Agent" abaixo para iniciar.</div>
      </div>
    `;
  }
}

async function runAgentForCard(cardId, agentType) {
  try {
    logTerminal(`[SISTEMA] Disparando ${agentType.toUpperCase()} AGENT para card: ${cardId}...`, 'system');
    setTerminalState(true);

    const res = await fetch('/api/agent/run-card', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cardId,
        agentType,
        cliType: state.selectedCli,
      }),
    });

    const data = await res.json();
    if (data.runId) {
      logTerminal(`🚀 [AGENT RUNNING] RunId: ${data.runId}`, 'system');
      elements.terminalStatus.textContent = `Rodando (${agentType.toUpperCase()})`;
      closeCardModal();
    }
  } catch (err) {
    console.error('Erro ao executar agente:', err);
  }
}

// ==========================================================================
// 7. Spec Editor & Chat com o Harness Master
// ==========================================================================
async function loadConversations() {
  try {
    const res = await fetch('/api/conversations');
    const data = await res.json();
    state.conversations = data.conversations || [];

    if (state.conversations.length > 0 && !state.activeConversationId) {
      state.activeConversationId = state.conversations[0].id;
    }

    renderConversationsList();
    renderActiveConversation();
  } catch (err) {
    console.error('Erro ao carregar conversas:', err);
  }
}

function renderConversationsList() {
  if (!elements.conversationsList) return;
  elements.conversationsList.innerHTML = '';

  state.conversations.forEach((conv) => {
    const item = document.createElement('div');
    item.className = `history-item ${conv.id === state.activeConversationId ? 'active' : ''}`;
    item.onclick = () => {
      state.activeConversationId = conv.id;
      renderConversationsList();
      renderActiveConversation();
    };

    item.innerHTML = `
      <div class="history-item-date">${conv.date || 'Hoje'}</div>
      <div class="history-item-title">${conv.title}</div>
      <div class="history-item-meta">${conv.messages?.length || 0} msgs</div>
    `;

    elements.conversationsList.appendChild(item);
  });
}

function renderActiveConversation() {
  if (!elements.chatMessages) return;
  elements.chatMessages.innerHTML = '';

  const conv = state.conversations.find((c) => c.id === state.activeConversationId);

  if (!conv || !conv.messages || conv.messages.length === 0) {
    elements.chatMessages.innerHTML = `
      <div class="empty-chat-placeholder">
        <div class="chat-avatar architect">AI</div>
        <h3>AI Architect & Harness Master</h3>
        <p>Descreva uma feature, regra de negócio ou requisito. O Harness Master fará a análise arquitetural, formulará os critérios de aceite e decomporá o card para o Kanban.</p>
      </div>
    `;
    return;
  }

  conv.messages.forEach((msg) => {
    appendMessageToChat(msg);
  });

  elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
}

function appendMessageToChat(msg) {
  const isUser = msg.sender === 'user';
  const msgEl = document.createElement('div');
  msgEl.className = `chat-message ${isUser ? 'user' : 'architect'}`;

  let cardPreviewHtml = '';
  if (msg.generatedCard) {
    const card = msg.generatedCard;
    cardPreviewHtml = `
      <div class="card-proposal">
        <div class="card-proposal-header">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
          <span>1 card estruturado para o Kanban</span>
        </div>
        <div class="card-proposal-content">
          <div class="proposal-title">
            <span class="proposal-badge">1</span>
            <strong>${card.title}</strong>
          </div>
          <p class="proposal-summary">${card.summary || ''}</p>
          
          <div class="proposal-tasks">
            ${(card.tasks || [])
              .map(
                (t) => `
              <div class="proposal-task-item">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
                <span>${typeof t === 'string' ? t : t.task}</span>
              </div>
            `
              )
              .join('')}
          </div>

          <div class="proposal-actions">
            <button class="btn btn-primary btn-sm btn-create-spec" data-card='${JSON.stringify(card).replace(/'/g, '&apos;')}'>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              <span>Enviar Card para o Kanban</span>
            </button>
          </div>
        </div>
      </div>
    `;
  }

  msgEl.innerHTML = `
    <div class="chat-avatar ${isUser ? 'user' : 'architect'}">
      ${isUser ? 'ME' : '🤖'}
    </div>
    <div class="chat-bubble">
      <div class="chat-header">
        <span class="chat-author">${msg.senderName || (isUser ? 'You' : 'AI Architect')}</span>
        <span class="chat-time">${msg.time || ''}</span>
      </div>
      <div class="chat-text">${formatMarkdown(msg.text || '')}</div>
      ${cardPreviewHtml}
    </div>
  `;

  // Bind no botão de criar spec
  const createBtn = msgEl.querySelector('.btn-create-spec');
  if (createBtn) {
    createBtn.onclick = async () => {
      try {
        const raw = createBtn.dataset.card;
        const cardData = JSON.parse(raw);
        createBtn.disabled = true;
        createBtn.innerHTML = '<span>Criando Spec e Tasks...</span>';

        const res = await fetch('/api/kanban/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(cardData),
        });

        const data = await res.json();
        if (data.success) {
          createBtn.innerHTML = '<span>✓ Enviado para o Kanban!</span>';
          createBtn.classList.replace('btn-primary', 'btn-secondary');
          logTerminal(`[SDD ENGINE] Spec e Tasks criadas em: ${data.result.specPath}`, 'stdout');
          await loadKanban();
        }
      } catch (err) {
        console.error('Erro ao enviar card:', err);
        createBtn.disabled = false;
        createBtn.innerHTML = '<span>Tentar novamente</span>';
      }
    };
  }

  elements.chatMessages.appendChild(msgEl);
}

async function handleSendMessage(e) {
  e.preventDefault();
  const text = elements.chatInput.value.trim();
  if (!text) return;

  elements.chatInput.value = '';

  const tempUserMsg = {
    sender: 'user',
    senderName: 'You',
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    text,
  };
  appendMessageToChat(tempUserMsg);
  elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;

  // Placeholder digitando
  const typingEl = document.createElement('div');
  typingEl.className = 'chat-message architect typing';
  typingEl.innerHTML = `
    <div class="chat-avatar architect">🤖</div>
    <div class="chat-bubble"><span class="typing-indicator">Analisando requisito na esteira SDD...</span></div>
  `;
  elements.chatMessages.appendChild(typingEl);
  elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;

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

    typingEl.remove();
    const data = await res.json();

    if (data.reply) {
      appendMessageToChat(data.reply);
      elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
      await loadConversations();
    }
  } catch (err) {
    typingEl.remove();
    logTerminal(`[ERRO] Falha ao consultar Harness Master: ${err.message}`, 'stderr');
  }
}

function startNewConversation() {
  const newId = `conv-${Date.now()}`;
  state.conversations.unshift({
    id: newId,
    title: 'Nova Conversa SDD',
    date: 'Hoje',
    messages: [],
  });
  state.activeConversationId = newId;
  renderConversationsList();
  renderActiveConversation();
}

function formatMarkdown(text) {
  return text
    .replace(/\n\n/g, '<br><br>')
    .replace(/\n/g, '<br>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');
}

// ==========================================================================
// 8. Detecção de LLM CLIs & Terminal Drawer
// ==========================================================================
async function loadCliStatus() {
  try {
    const res = await fetch('/api/cli-status');
    const data = await res.json();
    state.availableClis = data.clis || {};

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
        // Atualiza o kanban quando o agente terminar para exibir a nova mensagem no card!
        loadKanban();
      }
    } catch {}
  };
}

function toggleTerminal() {
  setTerminalState(!state.terminalOpen);
}

function setTerminalState(open) {
  state.terminalOpen = open;
  elements.terminalDrawer?.classList.toggle('open', open);
}

function logTerminal(text, type = 'stdout') {
  if (!elements.terminalOutput) return;
  const line = document.createElement('div');
  line.className = `terminal-line ${type}`;
  line.textContent = text;
  elements.terminalOutput.appendChild(line);
  elements.terminalOutput.scrollTop = elements.terminalOutput.scrollHeight;
}

// Inicia aplicação
document.addEventListener('DOMContentLoaded', init);
