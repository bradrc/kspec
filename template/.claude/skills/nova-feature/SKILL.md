---
name: nova-feature
description: Use para abrir uma nova feature no padrão SDD. Decide o tier (trivial/pequeno/arquitetural), cria specs/NNNN-<nome>/ com os templates certos, conduz o preenchimento de cima pra baixo pelos gates (product → design → domain → spec → tasks) e, quando há MCP conectado, importa a story do Jira no início e cria as issues na quebra de tasks. Acione com /nova-feature.
---

# Skill: Nova feature (loop SDD)

Abre e conduz uma feature pela esteira do `README.md`. A **spec é o contrato**; preencha na
ordem dos gates e pare em cada um para review. Siga as convenções do `CLAUDE.md`.

## Princípios
- **Sabatina Obrigatória de Lacunas ANTES de Escrever as Specs**: As lacunas, dúvidas, telas/interfaces, regras de negócio e casos de borda sempre devem ser perguntadas antes de escrever as specs. Nunca assuma ou adivinhe. Execute a sabatina com **`/clarificar`** até que todas as decisões e lacunas estejam sanadas antes de redigir qualquer documento.
- **Trava de Lote de Specs**: O desenvolvimento de código só é iniciado após **todas as specs do lote estarem concluídas e validadas**.
- **Trava de Ciclo Fechado**: Quando iniciar a implementação do código, **nenhuma spec nova pode ser escrita**, só depois de implementar e encerrar todas as fases. Quando fechar o ciclo completo, um novo ciclo de fases pode ser iniciado para novas specs.
- **Pergunta Obrigatória de Integração com ADO**: Antes de transicionar para a fase de testes e código, é mandatória a pergunta sobre integração com o Azure DevOps.
- **Atualização do ADO na Conclusão de Tasks**: Durante a fase de implementação, ao concluir cada task no projeto (`tasks.md`), o agente deve atualizar imediatamente o status do respectivo Work Item no ADO.
- **Padrões de Mercado Mandatórios**: Todo código de produção deve respeitar os 7 pilares (SOLID, Clean Architecture, liberação estrita de recursos/DB, tratamento de erros seguro, testes unitários/integração, inspeção prévia e DoD rigoroso).
- **Não delegue a `spec.md`** — os critérios de aceite são o contrato; o usuário valida.
- Ações outward-facing (criar issue, publicar) → **confirme antes**.
- *Tools-aware:* só use um MCP se ele estiver disponível na sessão (`mcp__<servidor>__*`); caso contrário, siga sem ele e registre como pendência.

## Fase 1 — Identidade da feature & Levantamento de Lacunas
1. Calcule o próximo número: maior `NNNN` em `specs/` + 1, com 4 dígitos (ex.: `0002`).
2. Pergunte um nome curto em kebab-case → pasta `specs/NNNN-<nome>/`.
3. **Sabatina de Lacunas (Obrigatória antes da escrita)**:
   - Levante todas as dúvidas sobre regras de negócio, telas, integrações e comportamentos esperados.
   - Pergunte ao usuário e feche as lacunas antes de redigir qualquer artefato formal.
4. **(tools-aware) Importar contexto:** se Jira/Linear estiver conectado, pergunte se a feature
   tem uma story/épico. Se sim, leia a issue e use para semear `product.md`; guarde a chave na
   frontmatter (`jira: PROJ-123`). Se Confluence/Notion estiver conectado, puxe páginas relacionadas.

## Fase 2 — Decidir o tier
Pergunte (gate): **"isso introduz decisão difícil de reverter ou nova fronteira de domínio?"**

| Resposta | Tier | Artefatos a criar |
|----------|------|-------------------|
| Não, é trivial (≤3 arquivos) | **Trivial** | só o PR — ou `specs/quick/NNN-slug/` (TASK.md + SUMMARY.md) p/ deixar rastro. |
| Não, mas é uma feature isolada | **Pequeno** | `spec.md` + `tasks.md` |
| Sim | **Arquitetural** | `product.md` + `design.md` + `domain.md` + `spec.md` + `tasks.md` |

Na dúvida, promova de tier (é barato). Copie os templates de `specs/_templates/` para a pasta.

## Fase 3 — Preencher de cima pra baixo (pelos gates)
Para cada artefato do tier, rascunhe a partir do template e **pare no gate para review**:

1. **`product.md`** (arquitetural) — problema, para quem, métrica, goals/non-goals.
2. **`design.md`** (arquitetural) — solução + os 5 eixos (stack, arquitetura, infra, qualidade,
   observabilidade) + alternativas/trade-offs/riscos. Decisão difícil de reverter → vira ADR.
   Trade-offs entrelaçados? Rode **`/clarificar`** para sabatinar os ramos antes de fixar a decisão.
3. **`domain.md`** (arquitetural) — bounded context, linguagem ubíqua, agregados, eventos.
   Atualize `docs/glossary.md` e `docs/architecture/context-map.md` se surgirem termos/fronteiras.
4. **`spec.md`** (sempre) — critérios de aceite em Given/When/Then, casos de borda, fora de escopo.
   Gate **Definition of Ready**: cada AC é testável e não-ambíguo? **Qualquer lacuna restante deve ser sanada com `/clarificar` antes de gravar**.
   Use a **Matriz de decisão** do template para regras multifatoriais.
5. **`tasks.md`** (sempre) — decomponha em tasks, cada uma mapeando para um ou mais AC + plano de teste.

## Fase 4 — Quebra de tasks, tracking e Pergunta Obrigatória do ADO
1. Preencha a tabela de `tasks.md` (task → cobre AC → depende de → status).
2. **Pergunta Obrigatória de Integração com Azure DevOps (ADO)**:
   - É **mandatório** perguntar ao usuário: *"Deseja sincronizar esta especificação no Azure DevOps (ADO)?"*
   - Se o usuário aceitar, acione o fluxo da skill **`/ado`**:
     - Pergunte qual Epic associar (ou crie um novo).
     - Pergunte o Iteration Path (Sprint).
     - **Preview Gate Obrigatório:** Exiba a árvore prévia (Epic → Feature → Tasks) com ACs antes de criar.
     - Crie no ADO via MCP ou AZ CLI e registre os IDs no frontmatter de `spec.md` e coluna `ADO ID` de `tasks.md`.
   - Se recusado, prossiga sem integração no ADO.
3. **Trava de Lote**: Só avance para a implementação se **todas as specs do lote atual estiverem concluídas**.

## Fase 5 — Implementação (Ciclo Fechado, TDD e Padrões de Mercado)
- **Trava de Ciclo Fechado**: Ao iniciar o código, **nenhuma nova spec pode ser escrita** até o fechamento de todas as fases.
- **TDD Obrigatório com Execução Cirúrgica**:
  - A primeira tarefa é escrever o teste automatizado para os ACs.
  - **Execute os testes apenas para o que foi desenvolvido** (arquivo ou teste específico da task). **NÃO rode a suíte completa** durante o desenvolvimento das tarefas individuais.
- **Padrões de Mercado**:
  - Aplicar SOLID, DRY, KISS, Clean Code e Clean Architecture/DDD.
  - Fechamento estrito de conexões e recursos (`using`/`try-with-resources`, connection pooling, queries parametrizadas).
  - Tratamento de exceções sem silenciamento e segurança em logs/APIs.
  - Testes unitários e de integração reais.
- **Atualização Mandatória no ADO (Fechamento em Cascata Ascendente)**:
  - Ao concluir cada task em `tasks.md`, o agente deve atualizar o status da respectiva Task no ADO (marcando-a como `Done` ou `Closed`).
  - Se fechar todas as Tasks de uma User Story (US), deve fechar a **User Story** correspondente (`Closed`/`Done`).
  - Se fechar todas as User Stories de uma Feature, deve fechar a **Feature** correspondente (`Closed`/`Done`).
  - Se fechar todas as Features de um Epic, deve fechar o **Epic** correspondente (`Closed`/`Done`).

## Fase 6 — Testes E2E com Playwright (Primeira Validação Ponta a Ponta)
- **Pergunta Obrigatória**: Ao final de cada fase de implementação, o agente deve **obrigatoriamente perguntar ao usuário**:
  > *"Deseja executar a fase de testes E2E com Playwright para fazer a primeira validação do que foi implementado?"*
- **Natureza Opcional**: A execução é opcional (a critério do usuário), mas a realização da pergunta é mandatória.
- **Se o usuário aceitar**: Execute os testes E2E com **Playwright** (`npx playwright test`) para validar o fluxo ponta a ponta e o comportamento da interface do que foi construído.
- **Se o usuário recusar**: Prossiga diretamente para a Fase 7.

## Fase 7 — Validação Final (UAT), Suíte Completa & Encerramento do Ciclo
Após finalizar todo o desenvolvimento, rode a skill **`/validar`**:
1. **Execução da Suíte Completa**: Somente agora que todo o desenvolvimento terminou, execute a **suíte de testes completa** (`npm test`), verificando regressões gerais, cobertura e análise estática.
2. Checa o Definition of Done (DoD) e atualiza `docs/STATE.md`.
3. Com todas as fases encerradas e o DoD satisfeito, o ciclo é fechado — permitindo a abertura de um novo ciclo de specs.
