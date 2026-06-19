# @igoruehara/spec-driven

Scaffold de **Spec-Driven Development (SDD)** para agentes de IA — [Claude Code](https://claude.com/claude-code),
[Codex](https://developers.openai.com/codex/), Cursor, GitHub Copilot, Gemini CLI e Windsurf.
Em qualquer projeto, rode um comando e ganhe a esteira completa: **Lean Inception → DDD →
Technical Design Docs → SDD**, com skills, templates, gates de qualidade e continuidade entre sessões.

```bash
# no diretório do seu projeto (menu interativo pergunta quais clientes gerar)
npx @igoruehara/spec-driven

# ou criando numa pasta nova
npx @igoruehara/spec-driven meu-projeto

# não-interativo: escolha os clientes pela flag
npx @igoruehara/spec-driven --agent=codex,cursor   # Claude (sempre) + Codex + Cursor
```

## Clientes suportados

O **Claude é a fonte canônica** (sempre gerado, formato mais rico). Os demais clientes são
**views geradas a partir do mesmo conteúdo** — escolha quais no menu interativo ou via `--agent`.

| Cliente | Instruções | Skills / commands |
|---|---|---|
| **Claude Code** | `CLAUDE.md` | `.claude/skills/*/SKILL.md` (+ hook `SessionStart`) |
| **Codex** | `AGENTS.md` | `.agents/skills/*/SKILL.md` |
| **Cursor** | `.cursor/rules/sdd.mdc` | `.cursor/commands/*.md` |
| **GitHub Copilot** | `.github/copilot-instructions.md` | `.github/prompts/*.prompt.md` |
| **Gemini CLI** | `GEMINI.md` | `.gemini/commands/*.toml` |
| **Windsurf** | `.windsurf/rules/sdd.md` | `.windsurf/workflows/*.md` |

> O `AGENTS.md` do Codex também é lido nativamente por Cursor, Copilot, Gemini e Windsurf —
> então ele já cobre a camada de instruções de quase todo o ecossistema. As views nativas de
> cada cliente são geradas só quando você as pede.

## Em que se baseia

| Prática | Sentido aqui | O que aporta à esteira |
|---|---|---|
| **Lean Inception** | workshop de descoberta (Paulo Caroli) | visão, personas e MVP — *o que construir primeiro* |
| **DDD** | Domain-Driven Design (Eric Evans) | linguagem ubíqua e bounded contexts — *o modelo do negócio* |
| **TDD** | Technical Design Doc / RFC | design antes de codar, com alternativas — *como no nível de sistema* |
| **SDD** | Spec-Driven Development | a spec é a fonte da verdade — *o contrato que dirige a implementação* |

Encadeadas: **Lean Inception** (descobrir) → **DDD** (modelar) → **TDD** (desenhar) → **SDD** (especificar e implementar).

## O que ele instala

```
seu-projeto/
├── CLAUDE.md                  # convenções que o agente segue (verificação de conhecimento, camadas, DoD)
├── README.md                  # o manual da esteira SDD
├── .claude/skills/            # 14 skills (ver abaixo) — + as views dos clientes extras escolhidos
├── .spec-driven/manifest.json # quais clientes foram gerados (usado pelo update)
├── .github/workflows/         # esteira.yml — gate de conformidade na CI
├── scripts/                   # audit-esteira.mjs + eval-spec-fidelity.mjs
├── docs/
│   ├── glossary.md · STATE.md
│   ├── product/               # vision · stakeholders · journeys · features · mvp-canvas · roadmap
│   ├── architecture/          # overview (5 eixos) · context-map · diagrams · assessment · adr/
│   └── engineering/           # TESTING · metrics · integrations · agentic-layer (+ _templates)
├── specs/                     # uma pasta por feature (0001-…) + quick/ + _templates/
└── src/                       # estrutura em camadas DDD
```

## As skills

| Skill | Responsabilidade |
|---|---|
| `/kickoff` | orquestra a constituição do projeto (greenfield ou brownfield) |
| `/integracoes` | ferramentas do time + MCPs (read-first, trava de conta/workspace) |
| `/mapear` | mapeia um codebase existente → `assessment.md` |
| `/diagramar` | arquitetura de alto nível em Mermaid → `diagrams.md` |
| `/roadmap` | constrói/revisa o roadmap com o time |
| `/camada-agentica` | gera rules, subagents, skills e workflows/CI |
| `/nova-feature` | abre uma feature no padrão SDD (tier → spec → tasks) |
| `/validar` | UAT: gates, AC→teste, SPEC_DEVIATION, DoD |
| `/revisar-pr` | gate de conformidade SDD no PR/MR |
| `/setup-ci` | pipeline CI/CD que materializa os gates |
| `/metricas` | Lead Time, Throughput e maturidade de Continuous Delivery/Deployment |
| `/auditar` | valida a conformidade da esteira (frontmatter, links, rastreabilidade) |
| `/evals` | mede fidelidade spec→código (AC cobertos por task/teste, SPEC_DEVIATION) |
| `/handoff` | pausa/retoma a sessão via `docs/STATE.md` |

## Exemplo completo

[`examples/pulse/`](examples/pulse/) é um produto fictício levado pela esteira **ponta a ponta** —
discovery (vision/features) → spec (AC) → tasks → código → testes — com **audit e eval verdes** e
os testes passando. A prova de que o fluxo fecha, não só artefatos soltos.

## Uso

```bash
npx @igoruehara/spec-driven [diretório-alvo] [opções]
```

### Exemplos

```bash
npx @igoruehara/spec-driven                # scaffolda no diretório atual
npx @igoruehara/spec-driven meu-projeto    # cria/usa a pasta ./meu-projeto
npx @igoruehara/spec-driven . --force      # sobrescreve arquivos existentes
npx @igoruehara/spec-driven update         # atualiza só a esteira, preserva seus docs
```

### Comandos

| Comando  | O que faz |
|----------|-----------|
| *(init)* | scaffolda a esteira completa. Arquivos existentes são **mantidos** (use `--force`). |
| `update` | atualiza só a **maquinaria** (skills, hooks, `_templates`, scripts, CI). **Preserva** seus docs/specs e mostra o diff antes de aplicar. |

### Opções

| Opção             | O que faz                                                              |
|-------------------|-----------------------------------------------------------------------|
| `--agent=a,b`     | clientes extras a gerar (`codex,cursor,copilot,gemini,windsurf`); pula o menu |
| `--all`           | gera as views de **todos** os clientes suportados                     |
| `--force`         | sobrescreve arquivos que já existem                                   |
| `--yes`, `-y`     | pula a confirmação interativa (sem `--agent`, gera só Claude)         |

> No `update`, `--agent=` **adiciona** um cliente novo a um projeto já existente (ex.:
> `npx @igoruehara/spec-driven update --agent=codex` materializa o Codex e o mantém atualizado).

> 🔒 **Seguro em projeto existente:** no init, arquivos existentes são **mantidos** (nada sobrescrito
> sem `--force`). No `update`, só a maquinaria da esteira é refeita — seus docs e specs ficam intactos.

## Depois de scaffoldar

1. `git init` (se ainda não for um repo).
2. No Claude Code, **aprove o hook de contexto** na 1ª sessão — um `SessionStart`
   (`.claude/settings.json`) que carrega o contexto base (STATE, vision, roadmap) automaticamente.
   Requer Node na máquina.
3. Rode `/integracoes` (se já conhece o ferramental) → `/kickoff`.
4. Comece a primeira feature com `/nova-feature`.

## Licença

MIT
