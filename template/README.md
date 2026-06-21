---
name: README
description: Manual da esteira SDD. Consulte para entender fluxo e tiers.
alwaysApply: false
---

# Boilerplate SDD — Spec-Driven Development

Padrão de projeto para times de alta performance. Combina **Technical Design Docs (RFC)**,
**Domain-Driven Design (DDD)** e **Spec-Driven Development (SDD)** numa única esteira
repetível — para iniciar ou dar continuidade a qualquer projeto.

## Os conceitos em 30 segundos

> Atenção aos acrônimos: aqui **TDD** = *Technical Design Doc* (não Test-Driven), e
> **DDD** = *Domain-Driven Design* (não "design driven"). Cada prática resolve uma parte
> diferente — elas **se compõem**, não competem.

- **DDD — Domain-Driven Design** (Eric Evans): modelar o software a partir do **domínio do
  negócio**, com uma **linguagem ubíqua** (mesmos termos no negócio, na spec e no código) e
  fronteiras explícitas (**bounded contexts**). Responde: *qual é o modelo do negócio?*

- **Lean Inception** (Paulo Caroli): workshop enxuto de **descoberta** para alinhar time e
  negócio e definir o **MVP** — visão do produto, personas, jornadas e funcionalidades
  sequenciadas por valor × esforço. Responde: *o que construir primeiro e por quê?*

- **TDD — Technical Design Doc / RFC** (cultura Google, Amazon, Oxide): documento de **design
  escrito antes de codar** algo arriscado — contexto, alternativas consideradas, trade-offs,
  riscos e rollout. Pensar antes de implementar. Responde: *como, no nível de sistema?*

- **SDD — Spec-Driven Development**: a **especificação é a fonte da verdade**. A implementação
  (humana **ou** de um agente de IA) deriva de uma spec com critérios de aceite testáveis.
  A spec é, ao mesmo tempo, contrato, oráculo de teste e prompt do agente. Responde:
  *qual é o contrato e como verifico que foi cumprido?*

A esteira deste boilerplate encadeia tudo isso: **Lean Inception** (descobrir) →
**DDD** (modelar) → **TDD/RFC** (desenhar) → **SDD** (especificar e implementar).

---

> **Princípio central:** a **spec é o contrato**, o **ADR é a memória**, o resto é andaime.
> Quando o código diverge da spec, ou o código está errado, ou a spec é atualizada
> conscientemente. Documentação não apodrece porque ela *governa*, não *descreve*.

---

## Cada artefato responde uma pergunta

| Artefato        | Pergunta                                          | Raiz da prática         |
|-----------------|---------------------------------------------------|-------------------------|
| `product.md`    | **Por quê** e **para quem**? Métricas de sucesso  | Amazon Working Backwards|
| `design.md`     | **Como** no nível de sistema? Alternativas/riscos | Google design docs / RFC|
| `domain.md`     | Qual a **linguagem** e o **modelo** do negócio?   | DDD estratégico + tático|
| `spec.md`       | Qual o **contrato testável**? (fonte da verdade)  | Spec-Driven Development |
| `tasks.md`      | Qual a **decomposição** e o plano?                | Planning                |
| `docs/architecture/adr/*`    | **Por que** decidimos X? (durável, imutável)      | ADR (Nygard)            |

---

## A esteira

```
Problema/Intent
   │  gate: vale a pena?  ──────────────────────────────►  product.md
   │  gate: design review assíncrono (RFC)  ────────────►  design.md
   │  gate: linguagem ubíqua acordada  ─────────────────►  domain.md
   │  gate: critérios de aceite testáveis (DoR)  ───────►  spec.md
   │                                                       tasks.md
   ▼  implementação (humano + agente de IA)
   │  gate: verificação contra a spec (DoD)
   ▼  ADR + docs vivas atualizadas
```

---

## Tiers de cerimônia (não burocratize)

A pergunta que define o tier: **"isso introduz uma decisão difícil de reverter
ou uma nova fronteira de domínio?"**

| Tier             | Quando                                          | Artefatos exigidos                          |
|------------------|-------------------------------------------------|---------------------------------------------|
| **Trivial**      | ≤3 arquivos, sem decisão (bugfix/refactor local)| só o PR — ou `specs/quick/NNN-slug/` p/ deixar rastro |
| **Pequeno**      | feature isolada, <10 tasks, sem decisão arquitetural | `spec.md` + `tasks.md`                  |
| **Arquitetural** | novo bounded context, decisão difícil de reverter, integração externa, risco | esteira completa + `design.md` em review formal + ADR |

> Promova de tier na dúvida; é barato. O custo está em descobrir tarde que algo era arquitetural.
>
> **Escalonamento dinâmico:** a complexidade determina a profundidade, não um pipeline fixo.
> Mesmo no tier Trivial/Pequeno, **liste os passos atômicos antes de codar**; se passar de ~5
> passos ou surgir dependência complexa, **pare e suba de tier** (crie/expanda o `tasks.md`).

---

## Como iniciar (ou retomar) um projeto — `/kickoff`

Rode **`/kickoff`** no Claude Code. A skill primeiro descobre o **modo** e roteia:

- **Greenfield (começando):** entrevista **Lean Inception** (visão, personas, MVP) → gera
  `vision.md` e `mvp-canvas.md`.
- **Brownfield (já rodando):** **mapeia o estado atual** (as-is), faz gap analysis vs o padrão
  SDD e captura decisões históricas → gera `assessment.md` + ADRs retroativos.

Os dois passam pelo **kickoff técnico nos 5 eixos** (tech stack, arquitetura, infra, qualidade,
observabilidade) e **convergem num `roadmap.md` incremental** para implementar com o time.
A constituição gerada: `CLAUDE.md` preenchido, `context-map.md`, `glossary.md`, ADRs e o roadmap.
Também propõe a **camada agêntica** do projeto — rules, subagents, skills e workflows/CI afinados
ao stack (ver [docs/engineering/agentic-layer.md](docs/engineering/agentic-layer.md)).

> Antes: copie o boilerplate para a pasta do projeto e rode `git init`. A skill vive em
> `.claude/skills/kickoff/` e viaja junto com o boilerplate.

### Ferramentas do time — skill separada `/integracoes`
Levantar o ferramental (Jira, Confluence, Notion, GitHub, cloud…) e conectar MCPs é **ortogonal**
ao kickoff — você pode iniciar o boilerplate **sem conhecer as ferramentas ainda**. Rode
**`/integracoes`** quando souber: **antes do `/kickoff`** (ideal — os MCPs de leitura alimentam os
artefatos com dado real) ou **depois**. Ela gera `integrations.md` e, se aprovado, `.mcp.json`,
com a **trava de conta/workspace** (evita usar o Notion pessoal no lugar do business), e **registra
os MCPs validados no roteamento** (bloco "Ferramentas conectadas (MCP)" do `CLAUDE.md` + skills).

Você não precisa lembrar de rodá-la: o **`/kickoff` faz uma oferta neutra** de conectar no
discovery (sem propor ferramenta — você diz o que usa), e as skills **reoferecem `/integracoes`** no
ponto em que o valor aparece — `/nova-feature` na quebra de tasks (gestão), `/revisar-pr` ao ler o
PR/MR (git host). Recusou no início? A skill segue **disponível para acionar depois**, é re-executável.

## Como iniciar uma nova feature — `/nova-feature`

Rode **`/nova-feature`**. A skill decide o tier, cria `specs/NNNN-<nome>/` com os templates
certos, conduz o preenchimento pelos gates e — se houver MCP conectado — importa a story do
Jira no início e cria as issues na quebra de tasks.

O que ela faz (e o que você faria à mão sem ela):

1. Cria a pasta `specs/NNNN-nome-curto/` (numeração sequencial, ordem cronológica).
2. Copia de `specs/_templates/` apenas os artefatos exigidos pelo tier.
3. Preenche de cima pra baixo na ordem da esteira (product → design → domain → spec → tasks),
   parando em cada gate para review.
4. Implemente. Critérios de aceite em `spec.md` são o oráculo de teste **e** o prompt do agente.
5. No fim: registre decisões relevantes como ADR em `docs/architecture/adr/`, atualize `docs/glossary.md`
   e `docs/architecture/context-map.md` se a linguagem/fronteiras mudaram.

Veja `specs/0001-exemplo-cota-de-uso/` para um exemplo preenchido.

## Definition of Ready (DoR) — antes de implementar
- [ ] `spec.md` tem critérios de aceite testáveis (Given/When/Then)
- [ ] Não-objetivos explícitos
- [ ] Linguagem ubíqua dos termos novos no `domain.md`/glossário
- [ ] Tier arquitetural: `design.md` aprovado

## Definition of Done (DoD) — antes do merge
- [ ] Todos os critérios de aceite verdes **pelo gate executável** (não por inspeção)
- [ ] Nenhum `SPEC_DEVIATION` pendente
- [ ] ADRs registrados para decisões difíceis de reverter
- [ ] Glossário e context-map atualizados se mudaram
- [ ] Spec reflete o que foi de fato construído (ou divergência documentada)
- [ ] `docs/STATE.md` atualizado (próximo passo / decisões)

## Continuidade entre sessões — `docs/STATE.md` e `/handoff`
A esteira tem **dois tipos de memória**: o **ADR** é durável e imutável (o *porquê* de uma
decisão); o **`docs/STATE.md`** é volátil (o *onde paramos*: feature ativa, próximo passo,
bloqueios, todos). Ao pausar ou retomar o trabalho, rode **`/handoff`** — ele grava/lê o STATE
para que qualquer pessoa (ou agente) continue de onde o outro parou.

---

## Estrutura

```
boilerplate_sdd/
├── README.md                  # este manual
├── CLAUDE.md                  # convenções que o agente de IA deve seguir
├── .claude/skills/            # kickoff·mapear·roadmap·camada-agentica·integracoes
│                              # nova-feature·clarificar·validar·revisar-pr·setup-ci·handoff
├── specs/
│   ├── _templates/            # os 5 templates da esteira
│   ├── quick/                 # quick mode: tarefas trivial com rastro leve
│   └── 0001-exemplo-cota-de-uso/  # exemplo preenchido
├── docs/                      # agrupado por concern (nomes estáveis, não numerados)
│   ├── glossary.md            # linguagem ubíqua global (anexo)
│   ├── STATE.md               # memória de trabalho (volátil) — continuidade
│   ├── product/               # vision · mvp-canvas · roadmap
│   ├── architecture/          # context-map · assessment · adr/ (decisões imutáveis)
│   └── engineering/           # TESTING · integrations · agentic-layer (+ _templates)
└── src/                       # estrutura em camadas DDD (ver src/README.md)
```

## Para aprofundar
- DDD: Vlad Khononov, *Learning DDD*; Vaughn Vernon, *Implementing DDD*
- Design docs: "Design Docs at Google"; processos RFC da Oxide/Rust
- Arquitetura: C4 model (Simon Brown), arc42, ADR (Michael Nygard)
- Working backwards: PR-FAQ da Amazon
- Spec-driven + IA: GitHub Spec Kit, Amazon Kiro, tlc-spec-driven (Tech Leads Club)
