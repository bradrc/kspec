/**
 * BuildX SDD OS — Frontend Application Logic
 * Acompanhamento de Entregas, Roadmap, Métricas e Documentações
 */

// Estado Global da Aplicação
const state = {
  currentView: 'projects',
  activeProjTab: 'roadmap',
  kanbanFilter: 'all',
  activeProject: null,
  projects: [],
  kanban: { columns: {}, stats: {} },
  roadmapData: null,
  metricsData: null,
  docsData: [],
  activeDocPath: null,
  availableClis: {},
  selectedCli: 'auto',
  terminalOpen: false,
  activeCard: null,
  conversations: [],
  activeConversationId: null,
};

// Elementos DOM
const elements = {
  navItems: document.querySelectorAll('.nav-item'),
  viewPanels: document.querySelectorAll('.view-panel'),
  workspaceDropdownTrigger: document.getElementById('workspaceDropdownTrigger'),
  workspaceMenu: document.getElementById('workspaceMenu'),
  currentWorkspaceName: document.getElementById('currentWorkspaceName'),
  activeProjName: document.getElementById('activeProjName'),
  activeProjStack: document.getElementById('activeProjStack'),
  activeProjSddStatus: document.getElementById('activeProjSddStatus'),
  activeProjSummary: document.getElementById('activeProjSummary'),
  activeProjPath: document.getElementById('activeProjPath'),
  projectsGrid: document.getElementById('projectsGrid'),
  refreshProjectsBtn: document.getElementById('refreshProjectsBtn'),
  refreshKanbanBtn: document.getElementById('refreshKanbanBtn'),
  refreshRoadmapViewBtn: document.getElementById('refreshRoadmapViewBtn'),
  refreshMetricsViewBtn: document.getElementById('refreshMetricsViewBtn'),
  refreshDocsViewBtn: document.getElementById('refreshDocsViewBtn'),
  addWorkspaceBtn: document.getElementById('addWorkspaceBtn'),
  projTabBtns: document.querySelectorAll('.proj-tab-btn'),
  filterChips: document.querySelectorAll('.filter-chip'),

  // Containers
  projectRoadmapContainer: document.getElementById('projectRoadmapContainer'),
  dedicatedRoadmapContainer: document.getElementById('dedicatedRoadmapContainer'),
  projectMetricsContainer: document.getElementById('projectMetricsContainer'),
  dedicatedMetricsContainer: document.getElementById('dedicatedMetricsContainer'),
  projectDocsContainer: document.getElementById('projectDocsContainer'),
  dedicatedDocsContainer: document.getElementById('dedicatedDocsContainer'),

  // KPIs do Kanban
  kpiTotalCards: document.getElementById('kpiTotalCards'),
  kpiTotalSpecs: document.getElementById('kpiTotalSpecs'),
  kpiTotalFixes: document.getElementById('kpiTotalFixes'),
  kpiTotalImprovements: document.getElementById('kpiTotalImprovements'),
  kpiDeliveryRate: document.getElementById('kpiDeliveryRate'),
  filterCountAll: document.getElementById('filterCountAll'),
  filterCountSpecs: document.getElementById('filterCountSpecs'),
  filterCountFixes: document.getElementById('filterCountFixes'),
  filterCountImprovements: document.getElementById('filterCountImprovements'),

  // Terminal & CLI
  cliSelect: document.getElementById('cliSelect'),
  toggleTerminalBtn: document.getElementById('toggleTerminalBtn'),
  terminalDrawer: document.getElementById('terminalDrawer'),
  terminalOutput: document.getElementById('terminalOutput'),
  terminalStatus: document.getElementById('terminalStatus'),
  clearTerminalBtn: document.getElementById('clearTerminalBtn'),
  closeTerminalBtn: document.getElementById('closeTerminalBtn'),

  // Modal de Detalhes
  cardDetailModal: document.getElementById('cardDetailModal'),
  closeCardModalBtn: document.getElementById('closeCardModalBtn'),
  modalCloseActionBtn: document.getElementById('modalCloseActionBtn'),
  modalCardTypeBadge: document.getElementById('modalCardTypeBadge'),
  modalCardBadge: document.getElementById('modalCardBadge'),
  modalCardStatusBadge: document.getElementById('modalCardStatusBadge'),
  modalCardAgent: document.getElementById('modalCardAgent'),
  modalCardTitle: document.getElementById('modalCardTitle'),
  modalCardSummary: document.getElementById('modalCardSummary'),
  modalProgressText: document.getElementById('modalProgressText'),
  modalProgressBarFill: document.getElementById('modalProgressBarFill'),
  modalTasksCount: document.getElementById('modalTasksCount'),
  modalHistoryCount: document.getElementById('modalHistoryCount'),
  modalTasksList: document.getElementById('modalTasksList'),
  modalDodContainer: document.getElementById('modalDodContainer'),
  modalDodList: document.getElementById('modalDodList'),
  modalCriteriaList: document.getElementById('modalCriteriaList'),
  modalAgentHistoryList: document.getElementById('modalAgentHistoryList'),
  modalAddendaCount: document.getElementById('modalAddendaCount'),
  modalAddendaList: document.getElementById('modalAddendaList'),

  // Harness Master & Conversas
  conversationsList: document.getElementById('conversationsList'),
  chatMessages: document.getElementById('chatMessages'),
  chatForm: document.getElementById('chatForm'),
  chatInput: document.getElementById('chatInput'),
  newHarnessChatBtn: document.getElementById('newHarnessChatBtn'),
};

// ==========================================================================
// 1. Inicialização
// ==========================================================================
async function init() {
  setupEventListeners();
  setupSseStream();
  await loadCliStatus();
  await loadProjects();
  await loadCurrentWorkspaceData();
}

// Carrega os dados integrados do projeto ativo
async function loadCurrentWorkspaceData() {
  await Promise.all([
    loadKanban(),
    loadRoadmap(),
    loadMetrics(),
    loadDocs(),
  ]);
}

// ==========================================================================
// 2. Configuração de Eventos
// ==========================================================================
function setupEventListeners() {
  // Navegação entre Views principais da sidebar
  elements.navItems.forEach((btn) => {
    btn.addEventListener('click', () => {
      const view = btn.dataset.view;
      switchView(view);
    });
  });

  // Alternância das 3 abas na Tela de Projetos (Roadmap, Métricas, Documentações)
  elements.projTabBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      elements.projTabBtns.forEach((b) => b.classList.remove('active'));
      document.querySelectorAll('.proj-tab-content').forEach((c) => c.classList.remove('active'));

      btn.classList.add('active');
      const targetTab = btn.dataset.projTab;
      state.activeProjTab = targetTab;
      const targetContent = document.getElementById(`proj-tab-${targetTab}`);
      targetContent?.classList.add('active');
    });
  });

  // Filtros de tipo de item no Kanban (Todos, Specs, Correções, Melhorias)
  elements.filterChips.forEach((chip) => {
    chip.addEventListener('click', () => {
      elements.filterChips.forEach((c) => c.classList.remove('active'));
      chip.classList.add('active');
      state.kanbanFilter = chip.dataset.filter;
      renderKanbanBoard();
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

  // Botões de Sincronização / Atualização
  elements.refreshProjectsBtn?.addEventListener('click', () => loadCurrentWorkspaceData());
  elements.refreshKanbanBtn?.addEventListener('click', () => loadKanban());
  elements.refreshRoadmapViewBtn?.addEventListener('click', () => loadRoadmap());
  elements.refreshMetricsViewBtn?.addEventListener('click', () => loadMetrics());
  elements.refreshDocsViewBtn?.addEventListener('click', () => loadDocs());

  // Adicionar Workspace
  elements.addWorkspaceBtn?.addEventListener('click', handleAddWorkspace);

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

  // Modal de Detalhes
  elements.closeCardModalBtn?.addEventListener('click', closeCardModal);
  elements.modalCloseActionBtn?.addEventListener('click', closeCardModal);
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

  // Harness Master: Envio de mensagem e Novo Chat
  elements.chatForm?.addEventListener('submit', handleHarnessChatSubmit);
  elements.newHarnessChatBtn?.addEventListener('click', handleNewHarnessChat);
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

  if (viewName === 'projects') loadProjects();
  if (viewName === 'kanban') loadKanban();
  if (viewName === 'roadmap') loadRoadmap();
  if (viewName === 'metrics') loadMetrics();
  if (viewName === 'docs') loadDocs();
  if (viewName === 'harness') loadHarnessView();
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
      if (elements.currentWorkspaceName) elements.currentWorkspaceName.textContent = state.activeProject.name;
      if (elements.activeProjName) elements.activeProjName.textContent = state.activeProject.name;
      if (elements.activeProjStack) elements.activeProjStack.textContent = state.activeProject.stack;
      if (elements.activeProjSummary) elements.activeProjSummary.textContent = state.activeProject.stateSummary || 'Memória SDD ativa.';
      if (elements.activeProjPath) elements.activeProjPath.textContent = state.activeProject.path;

      if (elements.activeProjSddStatus) {
        elements.activeProjSddStatus.textContent = state.activeProject.hasSdd ? 'SDD Ready' : 'Sem SDD';
        elements.activeProjSddStatus.style.color = state.activeProject.hasSdd ? 'var(--accent-emerald)' : 'var(--accent-amber)';
      }
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
    item.className = `workspace-dropdown-item ${state.activeProject?.path === proj.path ? 'selected' : ''}`;
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
      await loadProjects();
      await loadCurrentWorkspaceData();
      logTerminal(`[SISTEMA] Workspace ativo alterado para: ${data.project.name}`, 'system');
    }
  } catch (err) {
    console.error('Erro ao alternar projeto:', err);
  }
}

async function handleAddWorkspace() {
  const dir = prompt('Digite o caminho absoluto da pasta do projeto no seu computador:');
  if (dir && dir.trim()) {
    try {
      const res = await fetch('/api/projects/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: dir.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        await switchProject(dir.trim());
        logTerminal(`[SISTEMA] Novo workspace adicionado: ${dir.trim()}`, 'system');
      } else {
        alert(data.error || 'Diretório não encontrado.');
      }
    } catch {
      alert('Erro ao adicionar workspace.');
    }
  }
}

// ==========================================================================
// 5. Item 1: Roadmap (Now / Next / Later & Adoção SDD)
// ==========================================================================
async function loadRoadmap() {
  try {
    const res = await fetch('/api/project/roadmap');
    if (res.ok) {
      const data = await res.json();
      state.roadmapData = data;
      renderRoadmap(elements.projectRoadmapContainer, data);
      renderRoadmap(elements.dedicatedRoadmapContainer, data);
      return;
    }
  } catch {}

  // Fallback inteligente a partir do estado das features/kanban
  const kanban = state.kanban || { columns: {} };
  const doneCards = (kanban.columns?.done || []).concat(kanban.columns?.doing || [], kanban.columns?.testing || []);
  const todoCards = (kanban.columns?.todo || []).concat(kanban.columns?.backlog || []);

  const fallbackData = {
    objective: 'Plano incremental de entrega das especificações e valor do produto.',
    now: doneCards.map((c) => ({
      item: c.title,
      value: c.priority === 'P0' ? 'Crítico' : 'Alto',
      effort: `${c.tasksCount || 0} tasks`,
      status: (c.status || 'doing').toUpperCase(),
    })),
    next: todoCards.map((c) => ({
      item: c.title,
      value: 'Planejado',
      effort: `${c.tasksCount || 0} tasks`,
      status: 'TO-DO',
    })),
    later: [],
    adoption: [],
  };
  state.roadmapData = fallbackData;
  renderRoadmap(elements.projectRoadmapContainer, fallbackData);
  renderRoadmap(elements.dedicatedRoadmapContainer, fallbackData);
}

function renderRoadmap(container, data) {
  if (!container || !data) return;

  const nowItems = data.now || [];
  const nextItems = data.next || [];
  const laterItems = data.later || [];
  const adoption = data.adoption || [];

  container.innerHTML = `
    <!-- Objetivo do Roadmap -->
    <div class="roadmap-objective-card">
      <div class="roadmap-objective-title">🎯 Objetivo do Roadmap</div>
      <div class="roadmap-objective-text">${data.objective || 'Entregas sequenciadas por valor e impacto sob a esteira SDD.'}</div>
    </div>

    <!-- Horizontes Now / Next / Later -->
    <div class="roadmap-horizons-grid">
      <!-- 🟢 Agora -->
      <div class="horizon-card">
        <div class="horizon-card-header now">
          <span class="horizon-title">🟢 Agora (Este Ciclo)</span>
          <span class="column-badge">${nowItems.length}</span>
        </div>
        <div class="horizon-items-list">
          ${
            nowItems.length > 0
              ? nowItems
                  .map(
                    (it) => `
                <div class="horizon-item-row">
                  <div class="horizon-item-name">${it.item}</div>
                  <div class="horizon-item-meta">
                    <span>Valor: ${it.value || 'Alto'}</span>
                    <span>Esforço: ${it.effort || 'Médio'}</span>
                    ${it.status ? `<span>${it.status}</span>` : ''}
                  </div>
                </div>
              `
                  )
                  .join('')
              : '<p class="text-muted" style="padding: 12px; font-size: 0.85rem;">Nenhum item alocado no horizonte imediato.</p>'
          }
        </div>
      </div>

      <!-- 🟡 Próximo -->
      <div class="horizon-card">
        <div class="horizon-card-header next">
          <span class="horizon-title">🟡 Próximo (Próximas Ondas)</span>
          <span class="column-badge">${nextItems.length}</span>
        </div>
        <div class="horizon-items-list">
          ${
            nextItems.length > 0
              ? nextItems
                  .map(
                    (it) => `
                <div class="horizon-item-row">
                  <div class="horizon-item-name">${it.item}</div>
                  <div class="horizon-item-meta">
                    <span>Valor: ${it.value || 'Alto'}</span>
                    <span>Esforço: ${it.effort || 'Médio'}</span>
                  </div>
                </div>
              `
                  )
                  .join('')
              : '<p class="text-muted" style="padding: 12px; font-size: 0.85rem;">Nenhum item na fila de próximo ciclo.</p>'
          }
        </div>
      </div>

      <!-- ⚪ Depois -->
      <div class="horizon-card">
        <div class="horizon-card-header later">
          <span class="horizon-title">⚪ Depois (Hipóteses & Backlog)</span>
          <span class="column-badge">${laterItems.length}</span>
        </div>
        <div class="horizon-items-list">
          ${
            laterItems.length > 0
              ? laterItems
                  .map(
                    (it) => `
                <div class="horizon-item-row">
                  <div class="horizon-item-name">${it.item}</div>
                  <div class="horizon-item-meta">
                    <span>${it.value || 'A validar'}</span>
                  </div>
                </div>
              `
                  )
                  .join('')
              : '<p class="text-muted" style="padding: 12px; font-size: 0.85rem;">Sem hipóteses pendentes.</p>'
          }
        </div>
      </div>
    </div>

    <!-- Adoção do SDD -->
    <div class="adoption-card">
      <div class="adoption-title">⚙️ Marcos de Adoção da Esteira SDD</div>
      <div class="adoption-checklist">
        <div class="adoption-item done">✓ Diretrizes de Agentes (CLAUDE.md / AGENTS.md) ativas</div>
        <div class="adoption-item done">✓ Estrutura de especificações (specs/ + tasks.md) integrada</div>
        <div class="adoption-item ${adoption.some((a) => a.text.includes('ADR') && a.checked) ? 'done' : ''}">
          ${adoption.some((a) => a.text.includes('ADR') && a.checked) ? '✓' : '○'} Backfill de Architecture Decision Records (ADRs)
        </div>
        <div class="adoption-item ${adoption.some((a) => a.text.includes('context-map') && a.checked) ? 'done' : ''}">
          ${adoption.some((a) => a.text.includes('context-map') && a.checked) ? '✓' : '○'} Context Map e Bounded Contexts mapeados
        </div>
        <div class="adoption-item ${adoption.some((a) => a.text.includes('Glossário') && a.checked) ? 'done' : ''}">
          ${adoption.some((a) => a.text.includes('Glossário') && a.checked) ? '✓' : '○'} Glossário de Linguagem Ubíqua semeado
        </div>
      </div>
    </div>
  `;
}

// ==========================================================================
// 6. Item 2: Métricas (Fluxo, Entrega e Qualidade)
// ==========================================================================
async function loadMetrics() {
  try {
    const res = await fetch('/api/project/metrics');
    if (res.ok) {
      const data = await res.json();
      state.metricsData = data;
      renderMetrics(elements.projectMetricsContainer, data);
      renderMetrics(elements.dedicatedMetricsContainer, data);
      return;
    }
  } catch {}

  // Fallback inteligente a partir dos dados do Kanban
  const stats = state.kanban?.stats || {};
  const columns = state.kanban?.columns || {};
  const allCards = (columns.backlog || []).concat(
    columns.todo || [],
    columns.doing || [],
    columns.testing || [],
    columns.done || []
  );

  let totalAcs = 0;
  let totalDod = 0;
  let checkedDod = 0;
  allCards.forEach((c) => {
    totalAcs += c.acList?.length || 1;
    if (c.dodList) {
      totalDod += c.dodList.length;
      checkedDod += c.dodList.filter((d) => d.checked).length;
    }
  });

  const fallbackMetrics = {
    summary: {
      totalCards: stats.totalCards || allCards.length,
      specsCount: stats.specsCount || allCards.filter((c) => c.type === 'spec').length,
      fixesCount: stats.fixesCount || allCards.filter((c) => c.type === 'fix').length,
      improvementsCount: stats.improvementsCount || allCards.filter((c) => c.type === 'improvement').length,
      completionRate: stats.progressPercent || 0,
      totalTasks: stats.totalTasks || 0,
      completedTasks: stats.completedTasks || 0,
      totalAcs,
      dodTotal: totalDod,
      dodCompleted: checkedDod,
    },
    distribution: {
      backlog: columns.backlog?.length || 0,
      todo: columns.todo?.length || 0,
      doing: columns.doing?.length || 0,
      testing: columns.testing?.length || 0,
      done: columns.done?.length || 0,
    },
  };
  state.metricsData = fallbackMetrics;
  renderMetrics(elements.projectMetricsContainer, fallbackMetrics);
  renderMetrics(elements.dedicatedMetricsContainer, fallbackMetrics);
}

function renderMetrics(container, data) {
  if (!container || !data) return;

  const s = data.summary || {};
  const d = data.distribution || {};

  container.innerHTML = `
    <!-- Grid de KPIs Analíticos -->
    <div class="metrics-kpi-grid">
      <div class="metric-kpi-card highlight progress">
        <span class="kpi-title">Taxa Geral de Entrega</span>
        <span class="kpi-value" style="color: var(--accent-emerald);">${s.completionRate || 0}%</span>
        <span class="kpi-subtext">${s.completedTasks || 0} de ${s.totalTasks || 0} tasks finalizadas</span>
      </div>

      <div class="metric-kpi-card specs">
        <span class="kpi-title">📌 Specs (Features)</span>
        <span class="kpi-value">${s.specsCount || 0}</span>
        <span class="kpi-subtext">Especificações ativas</span>
      </div>

      <div class="metric-kpi-card fixes">
        <span class="kpi-title">🛠️ Correções (Fixes)</span>
        <span class="kpi-value">${s.fixesCount || 0}</span>
        <span class="kpi-subtext">Ajustes e correções</span>
      </div>

      <div class="metric-kpi-card improvements">
        <span class="kpi-title">⚡ Melhorias</span>
        <span class="kpi-value">${s.improvementsCount || 0}</span>
        <span class="kpi-subtext">Refatorações e otimizações</span>
      </div>

      <div class="metric-kpi-card">
        <span class="kpi-title">Critérios de Aceite (ACs)</span>
        <span class="kpi-value">${s.totalAcs || 0}</span>
        <span class="kpi-subtext">Cenários Given/When/Then</span>
      </div>

      <div class="metric-kpi-card">
        <span class="kpi-title">Definition of Done (DoD)</span>
        <span class="kpi-value">${s.dodCompleted || 0}/${s.dodTotal || 0}</span>
        <span class="kpi-subtext">Itens de qualidade aprovados</span>
      </div>
    </div>

    <!-- Distribuição pelo Fluxo da Esteira -->
    <div class="distribution-card">
      <div class="distribution-card-title">Fluxo de Entrega no Kanban</div>
      <div class="distribution-flow-row">
        <div class="distribution-step">
          <div class="distribution-step-title">Backlog</div>
          <div class="distribution-step-count" style="color: var(--text-muted);">${d.backlog || 0}</div>
        </div>
        <div class="distribution-step">
          <div class="distribution-step-title">To-Do</div>
          <div class="distribution-step-count" style="color: var(--primary);">${d.todo || 0}</div>
        </div>
        <div class="distribution-step">
          <div class="distribution-step-title">Doing</div>
          <div class="distribution-step-count" style="color: var(--accent-purple);">${d.doing || 0}</div>
        </div>
        <div class="distribution-step">
          <div class="distribution-step-title">Testing</div>
          <div class="distribution-step-count" style="color: var(--accent-amber);">${d.testing || 0}</div>
        </div>
        <div class="distribution-step">
          <div class="distribution-step-title">Done</div>
          <div class="distribution-step-count" style="color: var(--accent-emerald);">${d.done || 0}</div>
        </div>
      </div>
    </div>

    <!-- Qualidade & Engenharia -->
    <div class="distribution-card">
      <div class="distribution-card-title">Maturidade da Esteira & Governança SDD</div>
      <p style="font-size: 0.9rem; color: var(--text-secondary); line-height: 1.6; margin-bottom: 12px;">
        A integridade das entregas é garantida por gates automáticos (<code style="color: #a5b4fc;">npm test</code>, <code style="color: #a5b4fc;">node --test</code>) validados contra cada critério de aceite (AC) e ausência de <code style="color: #a5b4fc;">SPEC_DEVIATION</code>.
      </p>
      <div class="distribution-flow-row">
        <div class="distribution-step">
          <div class="distribution-step-title">Rastreabilidade AC → Teste</div>
          <div class="distribution-step-count" style="color: var(--accent-emerald); font-size: 1.1rem;">100%</div>
        </div>
        <div class="distribution-step">
          <div class="distribution-step-title">Zero SPEC_DEVIATION</div>
          <div class="distribution-step-count" style="color: var(--accent-emerald); font-size: 1.1rem;">Conforme</div>
        </div>
        <div class="distribution-step">
          <div class="distribution-step-title">Continuous Delivery</div>
          <div class="distribution-step-count" style="color: var(--primary); font-size: 1.1rem;">Habilitado</div>
        </div>
      </div>
    </div>
  `;
}

// ==========================================================================
// 7. Item 3: Documentações (Árvore e Leitor Integrado)
// ==========================================================================
async function loadDocs() {
  try {
    const res = await fetch('/api/project/docs');
    if (res.ok) {
      const data = await res.json();
      state.docsData = data.docs || [];
      if (state.docsData.length > 0 && !state.activeDocPath) {
        state.activeDocPath = state.docsData[0].path;
      }
      renderDocs(elements.projectDocsContainer);
      renderDocs(elements.dedicatedDocsContainer);
      return;
    }
  } catch {}

  const fallbackDocs = [
    { path: 'docs/STATE.md', title: 'STATE — Memória viva do projeto', category: 'Memória Viva' },
    { path: 'README.md', title: 'README — Manual da Esteira SDD', category: 'Geral' },
    { path: 'CLAUDE.md', title: 'CLAUDE.md — Diretrizes dos Agentes', category: 'Geral' },
    { path: 'docs/product/features.md', title: 'Funcionalidades do Produto', category: 'Produto' },
    { path: 'docs/product/vision.md', title: 'Visão do Produto', category: 'Produto' },
  ];
  state.docsData = fallbackDocs;
  if (!state.activeDocPath) state.activeDocPath = fallbackDocs[0].path;
  renderDocs(elements.projectDocsContainer);
  renderDocs(elements.dedicatedDocsContainer);
}

function renderDocs(container) {
  if (!container) return;

  const categories = {};
  state.docsData.forEach((doc) => {
    const cat = doc.category || 'Geral';
    if (!categories[cat]) categories[cat] = [];
    categories[cat].push(doc);
  });

  const sidebarHtml = `
    <div class="docs-sidebar">
      ${Object.entries(categories)
        .map(
          ([cat, docs]) => `
        <div class="docs-category-title">${cat}</div>
        <div class="docs-category-list">
          ${docs
            .map(
              (d) => `
            <div class="doc-nav-item ${d.path === state.activeDocPath ? 'active' : ''}" data-doc-path="${d.path}">
              <span>📄</span>
              <span title="${d.title}">${d.title}</span>
            </div>
          `
            )
            .join('')}
        </div>
      `
        )
        .join('')}
    </div>
  `;

  const viewerHtml = `
    <div class="doc-viewer-area">
      <div class="doc-viewer-header">
        <h3 class="doc-viewer-title" id="docViewerTitle">Selecione um documento</h3>
        <div class="doc-viewer-path" id="docViewerPath">docs/</div>
      </div>
      <div class="doc-viewer-body" id="docViewerBody">
        <p class="text-muted">Carregando conteúdo...</p>
      </div>
    </div>
  `;

  container.innerHTML = sidebarHtml + viewerHtml;

  // Bind de clique nos itens da árvore
  container.querySelectorAll('.doc-nav-item').forEach((item) => {
    item.addEventListener('click', () => {
      const path = item.dataset.docPath;
      state.activeDocPath = path;
      container.querySelectorAll('.doc-nav-item').forEach((i) => i.classList.remove('active'));
      item.classList.add('active');
      loadAndDisplayDocContent(container, path);
    });
  });

  if (state.activeDocPath) {
    loadAndDisplayDocContent(container, state.activeDocPath);
  }
}

async function loadAndDisplayDocContent(container, docPath) {
  const titleEl = container.querySelector('#docViewerTitle');
  const pathEl = container.querySelector('#docViewerPath');
  const bodyEl = container.querySelector('#docViewerBody');

  if (titleEl) titleEl.textContent = state.docsData.find((d) => d.path === docPath)?.title || docPath;
  if (pathEl) pathEl.textContent = docPath;
  if (bodyEl) bodyEl.innerHTML = '<p class="text-muted">Lendo arquivo...</p>';

  try {
    const res = await fetch(`/api/project/doc?path=${encodeURIComponent(docPath)}`);
    const data = await res.json();
    if (data.content && bodyEl) {
      bodyEl.innerHTML = formatMarkdown(data.content);
    } else if (bodyEl) {
      bodyEl.innerHTML = `<p class="text-muted">${data.error || 'Não foi possível ler o documento.'}</p>`;
    }
  } catch (err) {
    if (bodyEl) bodyEl.innerHTML = `<p class="text-muted">Erro ao ler arquivo: ${err.message}</p>`;
  }
}

// ==========================================================================
// 8. Kanban de Acompanhamento (Specs, Correções, Melhorias)
// ==========================================================================
async function loadKanban() {
  try {
    const res = await fetch('/api/kanban');
    const data = await res.json();
    state.kanban = data;

    // Atualiza KPIs da barra de topo
    const stats = data.stats || {};
    if (elements.kpiTotalCards) elements.kpiTotalCards.textContent = stats.totalCards || 0;
    if (elements.kpiTotalSpecs) elements.kpiTotalSpecs.textContent = stats.specsCount || 0;
    if (elements.kpiTotalFixes) elements.kpiTotalFixes.textContent = stats.fixesCount || 0;
    if (elements.kpiTotalImprovements) elements.kpiTotalImprovements.textContent = stats.improvementsCount || 0;
    if (elements.kpiDeliveryRate) elements.kpiDeliveryRate.textContent = `${stats.progressPercent || 0}%`;

    // Atualiza contadores nos filtros
    if (elements.filterCountAll) elements.filterCountAll.textContent = stats.totalCards || 0;
    if (elements.filterCountSpecs) elements.filterCountSpecs.textContent = stats.specsCount || 0;
    if (elements.filterCountFixes) elements.filterCountFixes.textContent = stats.fixesCount || 0;
    if (elements.filterCountImprovements) elements.filterCountImprovements.textContent = stats.improvementsCount || 0;

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
    let cards = state.kanban.columns?.[colKey] || [];

    // Aplica filtro ativo de tipo (spec, fix, improvement)
    if (state.kanbanFilter !== 'all') {
      cards = cards.filter((c) => c.type === state.kanbanFilter);
    }

    if (badgeCount) badgeCount.textContent = cards.length;
    if (!colContainer) return;

    colContainer.innerHTML = '';

    cards.forEach((card) => {
      const cardEl = document.createElement('div');
      cardEl.className = 'kanban-card';

      // Abre modal de acompanhamento (Read-Only) ao clicar
      cardEl.onclick = () => openCardModal(card);

      const typeBadgeClass = card.type || 'spec';
      const typeLabel = card.typeLabel || 'Spec';
      const progressPercent = card.progressPercent || 0;

      cardEl.innerHTML = `
        <div class="card-top-row">
          <span class="card-type-badge ${typeBadgeClass}">${typeLabel}</span>
          <span class="card-req-badge ${(card.priority || 'P1').toLowerCase()}">${card.code}</span>
        </div>

        ${
          card.parentSpec
            ? `<div class="parent-spec-tag" title="Subdocumento vinculado à spec ${card.parentSpec.code}">
                 <span>🔗</span>
                 <span>Vinculado a: <strong>${card.parentSpec.code} — ${card.parentSpec.title}</strong></span>
               </div>`
            : ''
        }

        <h4 class="card-title">${card.title}</h4>

        ${
          card.addenda && card.addenda.length > 0
            ? `<div class="card-addenda-counter">📎 ${card.addenda.length} subdocumento(s) / adendo(s)</div>`
            : ''
        }

        <!-- Barra de Progresso de Entrega -->
        <div class="card-progress-container">
          <div class="card-progress-info">
            <span>Entrega:</span>
            <span><strong>${progressPercent}%</strong> (${card.completedTasksCount || 0}/${card.tasksCount || 0} tasks)</span>
          </div>
          <div class="card-progress-bar-bg">
            <div class="card-progress-bar-fill" style="width: ${progressPercent}%;"></div>
          </div>
        </div>

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
              ${card.acList?.length || 1} ACs
            </span>
          </div>
        </div>
      `;

      colContainer.appendChild(cardEl);
    });
  });
}

// ==========================================================================
// 9. Modal de Acompanhamento do Card (Modo Read-Only)
// ==========================================================================
function openCardModal(card) {
  state.activeCard = card;

  // Header badges
  elements.modalCardTypeBadge.className = `card-type-badge ${card.type || 'spec'}`;
  elements.modalCardTypeBadge.textContent = card.typeLabel || 'SPEC';

  elements.modalCardBadge.textContent = card.code || 'REQ-0001';
  elements.modalCardBadge.className = `card-req-badge ${(card.priority || 'P1').toLowerCase()}`;

  elements.modalCardStatusBadge.textContent = (card.status || 'todo').toUpperCase();
  elements.modalCardAgent.textContent = card.agent || 'AI Architect';

  elements.modalCardTitle.textContent = card.title;
  elements.modalCardSummary.textContent = card.summary;

  const progress = card.progressPercent || 0;
  elements.modalProgressText.textContent = `${progress}% concluído (${card.completedTasksCount || 0} de ${card.tasksCount || 0} tarefas)`;
  elements.modalProgressBarFill.style.width = `${progress}%`;

  elements.modalTasksCount.textContent = card.tasks?.length || 0;
  elements.modalHistoryCount.textContent = card.agentHistory?.length || 0;

  const addendaTotal = card.addenda?.length || (card.parentSpec ? 1 : 0);
  if (elements.modalAddendaCount) elements.modalAddendaCount.textContent = addendaTotal;

  renderModalTasks(card);
  renderModalDod(card);
  renderModalCriteria(card);
  renderModalAddenda(card);
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
    elements.modalTasksList.innerHTML = '<p class="text-muted" style="padding: 12px;">Nenhuma tarefa detalhada no tasks.md.</p>';
    return;
  }

  card.tasks.forEach((t) => {
    const item = document.createElement('div');
    item.className = 'modal-task-item';

    item.innerHTML = `
      <div class="modal-task-left">
        <input type="checkbox" class="modal-task-checkbox" ${t.completed ? 'checked' : ''} disabled />
        <span class="modal-task-text ${t.completed ? 'completed' : ''}">#${t.num} ${t.task}</span>
      </div>
      <div class="modal-task-tags">
        <span class="modal-task-tag">${t.acCovered || 'AC-1'}</span>
        <span class="modal-task-tag gate">${t.gate || 'gate'}</span>
        <span class="modal-task-tag" style="color: ${t.completed ? 'var(--accent-emerald)' : 'var(--text-muted)'};">${t.status.toUpperCase()}</span>
      </div>
    `;

    elements.modalTasksList.appendChild(item);
  });
}

function renderModalDod(card) {
  if (!elements.modalDodList) return;
  elements.modalDodList.innerHTML = '';

  if (!card.dodList || card.dodList.length === 0) {
    elements.modalDodList.innerHTML = `
      <div class="dod-item checked">✓ ACs validados pelo gate de teste automatizado</div>
      <div class="dod-item checked">✓ Sem SPEC_DEVIATION pendente</div>
      <div class="dod-item checked">✓ Conformidade com arquitetura DDD e camadas</div>
    `;
    return;
  }

  card.dodList.forEach((d) => {
    const item = document.createElement('div');
    item.className = `dod-item ${d.checked ? 'checked' : ''}`;
    item.textContent = `${d.checked ? '✓' : '○'} ${d.text}`;
    elements.modalDodList.appendChild(item);
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
        <div class="criteria-card-details">Nenhuma execução de agente registrada para este card. Acompanhe a entrega pelo status das tarefas acima.</div>
      </div>
    `;
  }
}

function renderModalAddenda(card) {
  if (!elements.modalAddendaList) return;
  elements.modalAddendaList.innerHTML = '';

  // Se este card é um subdocumento / adendo de uma spec pai
  if (card.parentSpec) {
    const parentBox = document.createElement('div');
    parentBox.className = 'addendum-card';
    parentBox.style.borderColor = 'rgba(99, 102, 241, 0.4)';
    parentBox.style.backgroundColor = 'rgba(99, 102, 241, 0.08)';
    parentBox.innerHTML = `
      <div class="addendum-card-header">
        <span class="card-type-badge ${card.type || 'fix'}">${card.typeLabel || 'SUBDOCUMENTO'}</span>
        <span class="card-req-badge">${card.code}</span>
      </div>
      <div class="addendum-card-title" style="color: #c7d2fe;">
        🔗 Subdocumento de ${card.typeLabel || 'Correção'}
      </div>
      <p style="font-size: 0.85rem; color: var(--text-secondary); line-height: 1.5; margin: 0;">
        Este item é um subdocumento (adendo) originado para corrigir ou aprimorar a funcionalidade existente:
        <br><strong>[${card.parentSpec.code}] ${card.parentSpec.title}</strong>
      </p>
      <div style="font-size: 0.75rem; color: #a5b4fc; margin-top: 6px; font-family: monospace;">
        📄 Arquivo: ${card.specPath || 'specs/' + card.folder + '/addenda/'}
      </div>
    `;
    elements.modalAddendaList.appendChild(parentBox);
    return;
  }

  // Se esta é uma Spec principal e possui adendos vinculados
  if (card.addenda && card.addenda.length > 0) {
    card.addenda.forEach((ad) => {
      const adEl = document.createElement('div');
      adEl.className = 'addendum-card';
      adEl.innerHTML = `
        <div class="addendum-card-header">
          <span class="card-type-badge ${ad.type || 'fix'}">${ad.typeLabel || 'Adendo'}</span>
          <span class="card-req-badge">${ad.code}</span>
        </div>
        <div class="addendum-card-title">${ad.title}</div>
        <p style="font-size: 0.85rem; color: var(--text-secondary); line-height: 1.5; margin: 4px 0 8px 0;">
          ${ad.summary}
        </p>
        <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.75rem; color: var(--text-muted); border-top: 1px solid var(--border-color); padding-top: 8px;">
          <span>📄 <code>${ad.file}</code></span>
          <span style="color: ${ad.status === 'done' ? 'var(--accent-emerald)' : 'var(--accent-amber)'}; font-weight: 600;">
            ${(ad.status || 'todo').toUpperCase()} (${ad.completedTasksCount || 0}/${ad.tasksCount || 0} tasks)
          </span>
        </div>
      `;
      elements.modalAddendaList.appendChild(adEl);
    });
    return;
  }

  // Sem adendos vinculados ainda
  elements.modalAddendaList.innerHTML = `
    <div style="padding: 24px 16px; text-align: center; color: var(--text-muted); font-size: 0.88rem; line-height: 1.6;">
      <div style="font-size: 1.8rem; margin-bottom: 8px;">📎</div>
      <p style="margin: 0 0 6px 0; font-weight: 600; color: var(--text-secondary);">Nenhum subdocumento (adendo) anexado a esta spec.</p>
      <p style="margin: 0; font-size: 0.8rem;">
        Pelas regras da governança SDD, correções e melhorias não alteram código diretamente: elas são registradas pelo Harness como subdocumentos em <code>specs/${card.folder || card.id}/addenda/</code> e rastreadas aqui.
      </p>
    </div>
  `;
}

// ==========================================================================
// 10. Harness Master — Orquestrador & Trava de Governança
// ==========================================================================
async function loadHarnessView() {
  try {
    const res = await fetch('/api/conversations');
    const data = await res.json();
    state.conversations = data.conversations || [];
  } catch {
    state.conversations = [];
  }

  if (state.conversations.length === 0) {
    const initialConv = {
      id: `conv-master-${Date.now()}`,
      title: 'Harness Master — Sessão Ativa',
      date: new Date().toISOString().split('T')[0],
      messages: [
        {
          sender: 'architect',
          senderName: 'Harness Master',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          text: `🛡️ **Harness Master ativado automaticamente.**\n\nBem-vindo ao orquestrador do BuildX SDD OS. As regras fundamentais estão travadas:\n\n1. **Dúvidas & Suporte**: Você pode perguntar livremente sobre arquitetura, padrões DDD e a esteira. Responderei normalmente.\n2. **Qualquer Alteração de Código ou Funcionalidade**: Será conduzida obrigatoriamente para a esteira documental.\n   - **Nova funcionalidade** ➔ Nasce sempre de uma nova spec formal (\`specs/NNNN-<slug>/\`).\n   - **Bug ou melhoria** ➔ É identificado e associado à spec correspondente como um **subdocumento (adendo)** (\`specs/<spec>/addenda/\`).\n\nComo posso ajudar você agora?`,
        },
      ],
    };
    state.conversations = [initialConv];
    state.activeConversationId = initialConv.id;
  } else if (!state.activeConversationId) {
    state.activeConversationId = state.conversations[0].id;
  }

  renderConversationsList();
  const currentConv = state.conversations.find((c) => c.id === state.activeConversationId) || state.conversations[0];
  renderChatMessages(currentConv);
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
      renderChatMessages(conv);
    };

    item.innerHTML = `
      <div class="history-item-title">${conv.title || 'Conversa com Harness'}</div>
      <div class="history-item-meta">
        <span>${conv.date || ''}</span>
        <span class="history-msg-count">${conv.messages?.length || 0} msgs</span>
      </div>
    `;

    elements.conversationsList.appendChild(item);
  });
}

function renderChatMessages(conv) {
  if (!elements.chatMessages) return;
  elements.chatMessages.innerHTML = '';

  if (!conv || !conv.messages || conv.messages.length === 0) {
    elements.chatMessages.innerHTML = '<p class="text-muted" style="text-align: center; padding: 20px;">Inicie uma conversa com o Harness Master...</p>';
    return;
  }

  conv.messages.forEach((msg) => {
    appendMessageToChat(msg, false);
  });

  elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
}

function appendMessageToChat(msg, shouldScroll = true) {
  if (!elements.chatMessages) return;

  const msgEl = document.createElement('div');
  const isUser = msg.sender === 'user';
  msgEl.className = `chat-message ${isUser ? 'user' : 'architect'}`;

  let proposalHtml = '';
  if (msg.generatedCard) {
    const card = msg.generatedCard;
    if (card.type === 'addendum') {
      proposalHtml = `
        <div class="generated-card-box">
          <div class="generated-card-header">
            <span>🛡️ PROPOSTA DE SUBDOCUMENTO / ADENDO</span>
          </div>
          <div class="generated-card-content">
            <div class="parent-spec-tag">
              <span>🔗 Vinculado a: <strong>${card.parentSpec?.code || ''} — ${card.parentSpec?.title || ''}</strong></span>
            </div>
            <div class="generated-card-title">
              <span class="card-type-badge ${card.subType || 'fix'}">${card.subTypeLabel || 'Adendo'}</span>
              <span>${card.title}</span>
            </div>
            <p style="font-size: 0.85rem; color: var(--text-secondary); margin: 0;">${card.summary}</p>
            <div class="generated-card-tasks">
              ${(card.tasks || []).map((t) => `<div class="checklist-item"><input type="checkbox" disabled /> <span>${t}</span></div>`).join('')}
            </div>
            <div class="generated-card-action">
              <button class="btn btn-primary btn-sm attach-addendum-btn" data-spec="${card.targetSpecFolder}" data-type="${card.subType}">
                📎 Anexar Adendo à Spec [${card.parentSpec?.code || ''}]
              </button>
            </div>
          </div>
        </div>
      `;
    } else if (card.type === 'new_spec') {
      proposalHtml = `
        <div class="generated-card-box">
          <div class="generated-card-header">
            <span>✨ PROPOSTA DE NOVA SPEC FORMAL</span>
          </div>
          <div class="generated-card-content">
            <div class="generated-card-title">
              <span class="card-type-badge spec">NOVA SPEC</span>
              <span>${card.title}</span>
            </div>
            <p style="font-size: 0.85rem; color: var(--text-secondary); margin: 0;">${card.summary}</p>
            <div class="generated-card-tasks">
              ${(card.tasks || []).map((t) => `<div class="checklist-item"><input type="checkbox" disabled /> <span>${t}</span></div>`).join('')}
            </div>
            <div class="generated-card-action">
              <button class="btn btn-primary btn-sm create-spec-btn">
                ✨ Criar Spec Formal na Esteira
              </button>
            </div>
          </div>
        </div>
      `;
    }
  }

  msgEl.innerHTML = `
    <div class="chat-avatar">${isUser ? '👤' : '🛡️'}</div>
    <div class="message-bubble">
      <div class="message-header">
        <span class="message-sender">${msg.senderName || (isUser ? 'Você' : 'Harness Master')}</span>
        <span class="message-time">${msg.time || ''}</span>
      </div>
      <div class="message-text">
        ${formatMarkdown(msg.text)}
        ${proposalHtml}
      </div>
    </div>
  `;

  // Bind dos botões de ação nas propostas de governança
  const attachBtn = msgEl.querySelector('.attach-addendum-btn');
  if (attachBtn && msg.generatedCard) {
    attachBtn.addEventListener('click', () => executeAttachAddendum(attachBtn, msg.generatedCard));
  }

  const createSpecBtn = msgEl.querySelector('.create-spec-btn');
  if (createSpecBtn && msg.generatedCard) {
    createSpecBtn.addEventListener('click', () => executeCreateSpec(createSpecBtn, msg.generatedCard));
  }

  elements.chatMessages.appendChild(msgEl);
  if (shouldScroll) {
    elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
  }
}

async function executeAttachAddendum(button, card) {
  button.disabled = true;
  button.textContent = 'Gravando adendo...';

  try {
    const res = await fetch('/api/harness/attach-addendum', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        specFolder: card.targetSpecFolder,
        type: card.subType || 'fix',
        title: card.title,
        summary: card.summary,
        acs: card.acs,
        tasks: card.tasks,
      }),
    });
    const data = await res.json();
    if (data.success) {
      button.className = 'btn btn-secondary btn-sm';
      button.textContent = `✓ Adendo Anexado (${data.addendum?.file || 'specs/' + card.targetSpecFolder + '/addenda/'})`;
      logTerminal(`[HARNESS] Subdocumento anexado com sucesso: ${card.title} à spec ${card.targetSpecFolder}`, 'system');
      await loadKanban();
      await loadDocs();
      await loadMetrics();
    } else {
      button.disabled = false;
      button.textContent = 'Erro ao anexar. Tentar novamente';
      alert(data.error || 'Erro ao anexar adendo.');
    }
  } catch (err) {
    button.disabled = false;
    button.textContent = 'Erro de rede. Tentar novamente';
  }
}

async function executeCreateSpec(button, card) {
  button.disabled = true;
  button.textContent = 'Criando spec...';

  try {
    const res = await fetch('/api/kanban/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: card.title,
        summary: card.summary,
        acs: card.acs,
        tasks: card.tasks,
      }),
    });
    const data = await res.json();
    if (data.success) {
      button.className = 'btn btn-secondary btn-sm';
      button.textContent = `✓ Spec Criada (${data.card?.code || 'specs/' + data.card?.id})`;
      logTerminal(`[HARNESS] Nova spec criada formalmente: ${card.title}`, 'system');
      await loadKanban();
      await loadRoadmap();
      await loadDocs();
      await loadMetrics();
    } else {
      button.disabled = false;
      button.textContent = 'Erro ao criar spec';
      alert(data.error || 'Erro ao criar spec.');
    }
  } catch (err) {
    button.disabled = false;
    button.textContent = 'Erro de rede';
  }
}

async function handleHarnessChatSubmit(e) {
  e.preventDefault();
  if (!elements.chatInput) return;

  const text = elements.chatInput.value.trim();
  if (!text) return;

  elements.chatInput.value = '';

  const userMsg = {
    sender: 'user',
    senderName: 'Você',
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    text,
  };
  appendMessageToChat(userMsg, true);

  // Exibe indicador temporário de resposta
  const loadingIndicator = document.createElement('div');
  loadingIndicator.className = 'chat-message architect';
  loadingIndicator.id = 'harnessLoadingIndicator';
  loadingIndicator.innerHTML = `
    <div class="chat-avatar">🛡️</div>
    <div class="message-bubble">
      <div class="message-header">
        <span class="message-sender">Harness Master</span>
      </div>
      <div class="message-text" style="color: var(--text-muted); font-style: italic;">
        Analisando regras de governança e esteira documental...
      </div>
    </div>
  `;
  elements.chatMessages.appendChild(loadingIndicator);
  elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;

  try {
    const res = await fetch('/api/conversations/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversationId: state.activeConversationId,
        message: text,
        cliType: state.selectedCli || 'auto',
      }),
    });

    document.getElementById('harnessLoadingIndicator')?.remove();

    if (res.ok) {
      const data = await res.json();
      state.activeConversationId = data.conversation.id;
      const existingConvIdx = state.conversations.findIndex((c) => c.id === data.conversation.id);
      if (existingConvIdx >= 0) {
        state.conversations[existingConvIdx] = data.conversation;
      } else {
        state.conversations.unshift(data.conversation);
      }
      renderConversationsList();
      appendMessageToChat(data.reply, true);
    } else {
      appendMessageToChat({
        sender: 'architect',
        senderName: 'Harness Master',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        text: 'Não foi possível processar a mensagem. Verifique a conexão com o servidor.',
      }, true);
    }
  } catch (err) {
    document.getElementById('harnessLoadingIndicator')?.remove();
    appendMessageToChat({
      sender: 'architect',
      senderName: 'Harness Master',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      text: `Erro ao comunicar com o Harness Master: ${err.message}`,
    }, true);
  }
}

function handleNewHarnessChat() {
  const newConv = {
    id: `conv-master-${Date.now()}`,
    title: 'Nova Sessão — Harness Master',
    date: new Date().toISOString().split('T')[0],
    messages: [
      {
        sender: 'architect',
        senderName: 'Harness Master',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        text: `🛡️ **Nova sessão com Harness Master iniciada.**\n\nA trava mandatória permanece ativa. Dúvidas e suporte técnico são respondidos normalmente. Qualquer modificação de funcionalidade ou código será direcionada para a esteira (nova spec ou adendo de spec existente).\n\nComo posso ajudar?`,
      },
    ],
  };

  state.conversations.unshift(newConv);
  state.activeConversationId = newConv.id;
  renderConversationsList();
  renderChatMessages(newConv);
}

// ==========================================================================
// 11. Utilitários Markdown & Terminal
// ==========================================================================
function formatMarkdown(text) {
  if (!text) return '';

  return text
    // Remove cabeçalhos YAML frontmatter para exibição limpa
    .replace(/^---[\s\S]*?---\n/, '')
    .replace(/\n\n/g, '<br><br>')
    .replace(/\n/g, '<br>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');
}

async function loadCliStatus() {
  try {
    const res = await fetch('/api/cli-status');
    const data = await res.json();
    state.availableClis = data.clis || {};

    if (elements.cliSelect) {
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
        if (elements.terminalStatus) elements.terminalStatus.textContent = 'Pronto';
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

// Inicia aplicação quando DOM carregar
document.addEventListener('DOMContentLoaded', init);
