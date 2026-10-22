---
name: CLAUDE
description: Convenções do agente para a esteira SDD. Sempre ativo.
alwaysApply: true
---

# CLAUDE.md — Convenções para agentes de IA

Este projeto segue **Spec-Driven Development (SDD)**. Leia antes de implementar qualquer coisa.

## Início de sessão — carregue o contexto base
> Um hook **`SessionStart`** (`.claude/settings.json` → `.claude/hooks/load-context.mjs`) injeta
> este contexto base **automaticamente** (garantia determinística). Se o hook estiver desativado,
> esta diretiva é o fallback — e como o `CLAUDE.md` é sempre carregado, ela cobre o caso.

**Garanta o contexto base antes da primeira tarefa — os docs `alwaysApply: true`:**
`docs/STATE.md` · `docs/product/vision.md` · `docs/product/roadmap.md` · e a `spec.md` da
feature ativa em `specs/`.

Todos os outros docs são `alwaysApply: false` — **não os leia agora**. Puxe cada um **sob demanda**,
quando a tarefa exigir, guiado pelo `description` no frontmatter dele. Para **achar onde algo mora**,
o índice navegável é `docs/README.md` (mapa do projeto).

## A spec é a fonte da verdade
- Implemente **a partir de** `specs/NNNN-*/spec.md`. Os critérios de aceite
  (Given/When/Then) são o contrato e o oráculo de teste.
- Se a spec for ambígua ou estiver errada, **pare e pergunte** — não adivinhe.
  Atualizar a spec é uma decisão consciente, não um efeito colateral do código.
- Nunca implemente além do escopo da spec. "Out of scope" é vinculante.

## Trava do Harness Master — Governança e Ciclo de Gates Inegociável
- **Ativação Automática**: Todo novo chat/sessão inicia com o Harness Master ativo por padrão.
- **Classificação Mandatória de Intenção**: Antes de qualquer ação ou resposta, certifique-se da real intenção do usuário entre os 4 caminhos:
  1. **Suporte, Dúvidas e Diagnóstico**: Responda com clareza técnica e didática. O agente pode utilizar **qualquer ferramenta MCP** disponível (leitura, logs, queries, inspeção) para dar auxílio completo ao usuário, **sem necessidade de criar nova spec ou alterar código**. Se durante o suporte for identificado um bug que exija alteração de código, **NUNCA altere o código diretamente**: direcione o usuário imediatamente para o fluxo da esteira SDD (identificando a spec dona e propondo o adendo de correção).
  2. **Correção de Bug**: Identifique a spec existente dona da funcionalidade e conduza para a criação de subdocumento (adendo) em `specs/NNNN-<slug>/addenda/fix-<slug>.md`.
  3. **Nova Melhoria**: Identifique a spec dona e conduza para subdocumento em `specs/NNNN-<slug>/addenda/melhoria-<slug>.md`.
  4. **Nova Feature**: Conduza obrigatoriamente para a criação de spec formal em `specs/NNNN-<slug>/spec.md` + `tasks.md`.
- **Alterações de Código ou Funcionalidade**: Conduza estritamente para o fluxo da esteira seguindo os gates:
  1. **Fase 1 — Clarificação Obrigatória & Sabatina de Lacunas**:
     - **As lacunas sempre devem ser perguntadas antes de escrever as specs**. Nunca assuma ou adivinhe telas/interfaces, regras de negócio, layout, integrações ou casos de borda. Faça uma sabatina profunda até eliminar todas as ambiguidades antes de formalizar qualquer documento.
     - Proibido gerar código nesta fase.
  2. **Fase 2 — Spec Formal, Fechamento de Lote & Gate de Parada (Stop & Wait)**:
     - Funcionalidade nova → `specs/NNNN-<slug>/spec.md` + `tasks.md`.
     - Bugs e melhorias → Subdocumento (adendo) em `specs/NNNN-<slug>/addenda/<tipo>-<slug>.md` e tarefas no `tasks.md` da spec dona.
     - **🛑 STOP & WAIT**: Apresente a proposta ao usuário e **PARE O TURNO**. Aguarde a aprovação explícita (Definition of Ready). É expressamente PROIBIDO gerar código de produção no mesmo turno em que a spec foi proposta.
     - **Trava de Lote de Specs**: O agente só pode avançar para a Fase 3 (TDD/Implementação) após **todas as specs do lote estarem completamente concluídas e validadas**.
     - **Pergunta Obrigatória de Integração com Azure DevOps (ADO)**: Após a aprovação de todas as specs do lote e antes de iniciar a Fase 3, é **obrigatório** perguntar ao usuário se deseja integrar/sincronizar os itens no Azure DevOps: *"Deseja sincronizar esta especificação no Azure DevOps (ADO)?"*. Se o usuário aceitar, colete o Epic associado (ou crie um novo) e a Iteration Path (Sprint), exiba a pré-visualização completa (Epic → Feature → Tasks com ACs) e aguarde confirmação antes da criação, gravando os IDs no frontmatter da spec (`ado_epic_id`, `ado_feature_id`, `ado_iteration_path`) e na coluna `ADO ID` de `tasks.md`. Se recusado, prossiga sem integração.
  3. **Fase 3 — TDD Estrito (Test-First) com Ciclo Fechado**:
     - **Trava de Ciclo Fechado**: O agente só pode iniciar a escrita de código após a escrita de todas as specs. **Quando iniciar a implementação do código, nenhuma spec nova pode ser escrita**, só depois de implementar e encerrar todas as fases. Quando fechar o ciclo completo, um novo ciclo de fases pode ser iniciado para novas specs.
     - **TESTE PRIMEIRO**: A primeira tarefa é OBRIGATORIAMENTE escrever o arquivo de teste automatizado cobrindo cada Critério de Aceite (AC).
     - **Execução Cirúrgica nos Testes**: Durante o desenvolvimento, o agente **deve rodar os testes apenas para o que foi desenvolvido** (arquivo ou teste específico da task/componente), e **NÃO a suíte completa**.
     - Nenhuma linha de código de produção é escrita sem seu respectivo teste automatizado.
  4. **Fase 4 — Implementação, Padrões de Mercado & DoD**:
     - Implemente o código mínimo necessário aderente aos Padrões de Mercado, Clean Architecture e DDD para fazer o teste específico da funcionalidade passar.
     - **Execução da Suíte Completa Apenas no Fim**: **Apenas quando acabar TODO o desenvolvimento** (todas as tarefas da spec/lote concluídas), o agente deve rodar a **suíte de testes completa** (`npm test`, build e análise estática) para validação integral de regressão antes do fechamento.
     - **Atualização Mandatória no ADO (Fechamento em Cascata Ascendente)**: Quando houver integração com o ADO, ao concluir cada task no projeto (`tasks.md`), o agente deve atualizar o status da respectiva Task no ADO (marcando-a como `Done` ou `Closed`) e verificar a hierarquia para fechamento em cascata ascendente:
       - Se fechar todas as Tasks de uma User Story (US), deve fechar a **User Story** correspondente (`Closed`/`Done`);
       - Se fechar todas as User Stories de uma Feature, deve fechar a **Feature** correspondente (`Closed`/`Done`);
       - Se fechar todas as Features de um Epic, deve fechar o **Epic** correspondente (`Closed`/`Done`).
     - Atualize `tasks.md` e `docs/STATE.md`.
  5. **Fase 5 — Testes E2E com Playwright (Primeira Validação Ponta a Ponta - Opcional, Pergunta Obrigatória)**:
     - **Pergunta Obrigatória**: Ao final de cada fase de implementação, o agente **deve OBRIGATORIAMENTE sempre perguntar ao usuário**:
       > *"Deseja executar a fase de testes E2E com Playwright para fazer a primeira validação do que foi implementado?"*
     - **Natureza Opcional**: A execução dos testes E2E é opcional (o usuário decide se executa ou não), porém **a pergunta feita pelo agente é estritamente mandatória**.
     - **Se o usuário aceitar**: Execute os testes E2E com **Playwright** (`npx playwright test`) para realizar a primeira validação prática e ponta a ponta da interface e dos fluxos implementados.
     - **Se o usuário recusar**: Prossiga diretamente para o encerramento da esteira / validação DoD.
- **Regra Mandatória do Adendo (Bugs e Melhorias em Specs Já Implementadas)**:
  - **Correção e Testes no Código**: O agente nunca deve esquecer de implementar a correção ou melhoria no código, sempre criando/ajustando o teste automatizado correspondente.
  - **Atualização Obrigatória da Documentação da Spec**: O agente **NUNCA deve esquecer de atualizar a documentação da spec já implementada** (`specs/NNNN-<slug>/spec.md`, critérios de aceite e artefatos de domínio/design afetados). O subdocumento em `addenda/` registra o histórico e escopo do adendo, mas a documentação principal da spec mãe DEVE ser mantida viva e fiel ao novo comportamento, preservando a spec como a fonte única da verdade.
  - **Atualização Mandatória no ADO**: Se houver integração com o Azure DevOps, o agente **deve obrigatoriamente atualizar o ADO** (atualizando o status dos Work Items de bugs, tasks ou feature para `Closed`/`Done`).

## Padrões de Mercado Mandatórios na Fase de Implementação

Todo código-fonte produzido na esteira deve seguir rigorosamente as boas práticas de engenharia de software:

### 1. Princípios de código
- Aplicar **SOLID, DRY, KISS e Clean Code**.
- Evitar duplicação de regras de negócio, validações, consultas e cálculos.
- Seguir o **princípio de responsabilidade única (SRP)**.
- Utilizar **composição** como abordagem preferencial para reutilização de comportamento.
- Utilizar **herança** somente quando houver uma relação legítima de especialização.
- Criar abstrações, interfaces e classes-base apenas quando houver benefício arquitetural concreto.
- Evitar métodos excessivamente longos, classes com responsabilidades distintas e dependências desnecessárias.

### 2. Arquitetura e responsabilidades
- Separar adequadamente API/controllers, aplicação/casos de uso, domínio e infraestrutura, conforme a complexidade do projeto.
- Manter regras de negócio estritamente fora dos controllers e dos detalhes de persistência.
- Utilizar **injeção de dependência** para gerenciar dependências e seus ciclos de vida.
- Isolar o acesso a dados quando isso agregar valor à arquitetura.
- Não introduzir padrões arquiteturais desnecessários ou camadas que apenas repassem chamadas sem agregar responsabilidade.

### 3. Banco de dados e recursos
- Nunca deixar conexões, comandos, leitores, transações ou outros recursos sem liberação adequada.
- Em Java, utilizar `try-with-resources` para recursos `AutoCloseable` de propriedade local.
- Em C#, utilizar `using`/`await using` conforme o tipo de recurso e a API utilizada.
- Utilizar o `DataSource`, connection pooling ou mecanismo equivalente recomendado pelo framework.
- Não manter conexões abertas globalmente nem criar pools manualmente sem necessidade justificada.
- Abrir recursos próximo ao momento de uso e liberá-los assim que possível.
- Utilizar consultas parametrizadas para prevenir SQL injection.
- Definir limites transacionais coerentes com os casos de uso.
- Tratar corretamente rollback, falhas de conexão, timeouts e cancelamentos.
- Evitar N+1 queries, consultas redundantes e carregamento desnecessário de dados.

### 4. Tratamento de erros e segurança
- Nunca ignorar exceções silenciosamente.
- Preservar a causa original dos erros ao encapsulá-los.
- Não expor stack traces, credenciais ou informações internas ao cliente da API.
- Validar entradas e aplicar autorização nos pontos apropriados.
- Não registrar senhas, tokens ou outros dados sensíveis nos logs.

### 5. Testes e qualidade
- Criar testes unitários para regras de negócio relevantes.
- Criar testes de integração para persistência, transações e contratos com sistemas externos, conforme necessário.
- Garantir cobertura dos principais caminhos de sucesso e falha.
- Não substituir todos os testes de integração por mocks.
- **Estratégia de execução**: Rodar os testes **apenas para o que foi desenvolvido** durante o ciclo de código; executar a **suíte completa apenas quando acabar todo o desenvolvimento**.
- Executar compilação, testes e análise estática disponíveis antes de considerar a implementação concluída.
- Corrigir warnings e problemas relevantes introduzidos pela implementação.

### 6. Processo obrigatório antes de implementar
- Inspecionar a arquitetura, as convenções e os componentes já existentes.
- Procurar funcionalidades, classes e métodos reutilizáveis antes de criar novos.
- Identificar responsabilidades e dependências da funcionalidade.
- Implementar a solução mais simples que atenda aos requisitos.
- Verificar ciclo de vida dos recursos, tratamento de exceções, segurança e transações.
- Adicionar ou atualizar os testes necessários.
- Revisar o diff para identificar duplicações, código morto, abstrações desnecessárias e regressões.

### 7. Critério de conclusão
- Não considerar uma funcionalidade concluída apenas porque compila ou funciona no cenário feliz.
- Antes de concluir, verificar se a implementação:
  - Respeita os padrões existentes do projeto.
  - Reutiliza corretamente o código disponível.
  - Não introduz vazamentos de recursos.
  - Possui tratamento adequado de falhas.
  - Tem testes proporcionais ao risco.
  - Não adiciona complexidade sem necessidade.
- Se houver conflito entre uma abstração excessiva e uma implementação simples, segura e sustentável, preferir a solução simples, sem comprometer os requisitos arquiteturais.

## Verificação de conhecimento (nunca invente)
Antes de afirmar como algo funciona, siga esta ordem — pare assim que tiver a resposta:
1. **Padrões do próprio codebase** (como já é feito aqui).
2. **Docs do projeto** (`specs/`, `docs/`, ADRs, glossário).
3. **MCP** de referência (ex.: Context7 para libs) quando conectado.
4. **Web/doc oficial** da tecnologia.
5. **Não encontrou? Diga "não sei" e sinalize.** Nunca invente API, padrão ou comportamento —
   inventar causa falha em cascata. Incerteza explícita é melhor que um chute confiante.

## Ferramentas conectadas (MCP)
> **Mantido pela skill `/integracoes`.** Lista os MCP servers validados e quem os consome, para o
> roteamento de skills/rules. Vazio até a primeira conexão — rode `/integracoes` para preencher.

| MCP (`mcp__<servidor>__*`) | Conta/workspace validada | Skills que consomem |
|---|---|---|
| _nenhum ainda_ | — | — |

Regra: conexão ativa **não** autoriza uso. Confirme a conta/workspace antes de ler e **reconfirme
antes de qualquer escrita** (ver `/integracoes`). Só use um MCP presente na sessão (`mcp__<servidor>__*`).

## Antes de codar — descubra o tier
Pergunta: *isso introduz decisão difícil de reverter ou nova fronteira de domínio?*
- **Trivial** (≤3 arquivos, sem decisão): só o PR (ou `quick/` se quiser deixar rastro).
- **Pequeno** (feature isolada, <10 tasks): exige `spec.md` + `tasks.md`.
- **Arquitetural** (novo bounded context, integração externa, decisão irreversível):
  exige `design.md` aprovado **antes** de implementar. Se não existir, pare e sinalize.

> **Escalonamento dinâmico:** mesmo quando `tasks.md` é dispensado, **sempre liste os passos
> atômicos inline antes de codar**. Se a lista passar de ~5 passos ou tiver dependências
> complexas, **PARE e crie um `tasks.md` formal** — o tier real era maior do que parecia.

## Linguagem ubíqua
- Use **exatamente** os termos de `docs/glossary.md` e do `domain.md` da feature.
  Mesmo nome no código, na spec e na conversa com o time. Não invente sinônimos.
- Termo novo → adicione ao glossário no mesmo PR.

## Arquitetura em camadas (regra de dependência)
`src/` segue DDD tático. A dependência aponta **só para dentro**:

```
interfaces → application → domain ← infrastructure
```

- `domain/` não importa NADA de framework, I/O, ou de outras camadas.
- `application/` orquestra casos de uso; depende só de `domain/`.
- `infrastructure/` implementa as portas definidas no domínio (repos, adapters).
- `interfaces/` é a borda (API/CLI/UI).

## Disciplina de contexto e delegação
Cada doc declara no frontmatter sua política de carregamento (padrão estilo Cursor rules):
- `alwaysApply: true` — **contexto base**, leia em toda sessão.
- `alwaysApply: false` — **sob demanda**; o campo `description` diz **quando** puxá-lo.

**Base (`alwaysApply: true`):** este `CLAUDE.md` · `docs/STATE.md` · `docs/product/vision.md` ·
`docs/product/roadmap.md` · a `spec.md` da feature ativa. Todo o resto é sob demanda — puxe
pelo `description` quando a tarefa exigir (TESTING, glossary, context-map, ADRs, integrations…).

> **Dois dialetos de frontmatter:** os **docs da esteira** usam `name`+`description`+`alwaysApply`;
> as **skills** (`.claude/skills/*/SKILL.md`) e os **templates de skill/subagente** usam o dialeto
> do alvo (`name`+`description`, sem `alwaysApply`) — porque são copiados para virar skills/agentes.

- **Carregue sob demanda:** não leia o repo inteiro — puxe o on-demand conforme a task atual.
- **Delegue para manter o contexto enxuto:** pesquisa e tasks paralelas (`[P]`) vão para
  subagentes (ver `docs/engineering/_templates/subagent.template.md`), que recebem só a task +
  spec + TESTING e devolvem um report-back estruturado. Reserve a janela para o trabalho.

### Orçamento de contexto (alvo)
- **Base (`alwaysApply: true`): ~15k tokens.** Mantenha enxuto — se crescer, é sinal de mover
  detalhe para docs on-demand.
- **Sob demanda: só o necessário.** Total carregado **< 40k**; reserve **160k+** para o trabalho.
- Estourou o orçamento? **Delegue a subagente** (contexto isolado) em vez de inchar a sessão.

## Divergência da spec (SPEC_DEVIATION)
Se durante a implementação você precisar fazer diferente do que a `spec.md` diz:
1. **Pare antes de seguir.** Marque no código/PR um comentário `// SPEC_DEVIATION: <motivo>`.
2. Decida com o dono da spec: ou **corrige o código** (a spec vence) ou **atualiza a spec**
   conscientemente (e registra ADR se for decisão difícil de reverter).
3. Nunca deixe código e spec divergentes em silêncio — é assim que a fonte da verdade apodrece.

## Definition of Done
- [ ] Todos os critérios de aceite da `spec.md` passam — **verificados pelo gate executável**
      (o comando de teste em `tasks.md`), não por inspeção visual
- [ ] **Cobertura ≥ mínimo** do projeto, com o **relatório anexado ao PR** (evidência, não inspeção)
- [ ] **Análise estática limpa** (type-check + complexidade + SAST) — sem findings bloqueantes
- [ ] Nenhum `SPEC_DEVIATION` pendente sem resolução
- [ ] Decisões difíceis de reverter viraram ADR em `docs/architecture/adr/`
- [ ] Glossário e `docs/architecture/context-map.md` atualizados se mudaram
- [ ] A spec reflete o que foi construído (ou a divergência está documentada)
- [ ] `docs/STATE.md` atualizado (próximo passo, decisões, bloqueios)

## Memória de trabalho — `docs/STATE.md`
- **STATE.md é memória volátil** (em andamento, próximo passo, bloqueios, todos); **ADR é memória
  durável** (decisão imutável). Não confunda: decisão estrutural vai pro ADR, estado do trabalho
  vai pro STATE.
- Atualize o STATE ao pausar/encerrar uma sessão e leia-o ao retomar. Ver a skill `/handoff`.

## Aprendizados & gotchas — `docs/lessons.md`
- Ao **corrigir um erro não-óbvio, quebrar uma suposição ou descobrir um gotcha** (quirk de lib,
  armadilha de setup, rate-limit), **registre 1 linha em `docs/lessons.md` na hora** — não espere
  o handoff, senão o detalhe some. É captura *just-in-time*, não retrospectiva.
- `lessons.md` é **área de staging volátil**: a lição que estabiliza é **promovida** (ADR, glossary,
  este `CLAUDE.md` ou TESTING) e **removida** de lá. A consolidação/poda acontece no `/handoff`.

## Onde escrever
- Decisão arquitetural durável → novo ADR (`docs/architecture/adr/`), nunca edite ADR antigo (são imutáveis; crie um que o substitua).
- Estado do trabalho / próximo passo → `docs/STATE.md`.
- Aprendizado transversal / gotcha (ainda não estabilizado) → `docs/lessons.md`.
- Termo de negócio → `docs/glossary.md`.
- Mudança de fronteira/contexto → `docs/architecture/context-map.md`.
