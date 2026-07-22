---
name: project-home
description: Mapa do projeto — índice navegável com link para cada artefato (onde estamos, produto, arquitetura, engenharia, specs, glossário). Porta de entrada de docs/. Gerado/atualizado no /kickoff. Puxe quando precisar achar onde algo mora.
alwaysApply: false
---

# <Projeto> — Mapa do projeto

> **Porta de entrada da documentação.** Um índice de "onde está cada coisa" — não duplique
> conteúdo aqui, só **aponte** para o doc certo. Gerado/atualizado no `/kickoff` (Fase 5).
> Itens em `código` ainda não existem no boilerplate fresco: o `/kickoff` os gera e os
> transforma em link. Mantenha enxuto: seções têm nomes estáveis; só a lista de specs cresce.

**One-liner do produto:** <o que é, em uma frase> · **Status:** <discovery / MVP / em produção>

## 🧭 Onde estamos agora
- **Memória de trabalho** (onde paramos, próximo passo, bloqueios) → [STATE.md](STATE.md)
- **Aprendizados & gotchas** (staging volátil que se auto-poda) → [lessons.md](lessons.md)
- **Roadmap** (Now / Next / Later) → `product/roadmap.md`

## 🎯 Produto — por quê e para quem
> Gerados no `/kickoff` greenfield. Em projeto que já roda, comece pelo assessment (em Arquitetura).
- **Visão & escopo** → `product/vision.md`
- **Stakeholders** → `product/stakeholders.md`
- **Jornadas** → `product/journeys.md`
- **Funcionalidades** (classificadas + sequenciadas) → `product/features.md`
- **MVP canvas** → `product/mvp-canvas.md`

## 🏛️ Arquitetura — como, no nível de sistema
- **Overview** (os 5 eixos + segurança + operacional) → [architecture/overview.md](architecture/overview.md)
- **Context map** (bounded contexts e relações) → [architecture/context-map.md](architecture/context-map.md)
- **Diagramas** (Mermaid) → [architecture/diagrams.md](architecture/diagrams.md)
- **ADRs** (decisões duráveis e imutáveis) → [architecture/adr/](architecture/adr/)
- **Assessment as-is** (brownfield) → `architecture/assessment.md`

## 🛠️ Engenharia — como construímos
- **Testes e quality gates** → [engineering/TESTING.md](engineering/TESTING.md)
- **Camada agêntica** (rules, subagents, skills, workflows) → [engineering/agentic-layer.md](engineering/agentic-layer.md)
- **Integrações / MCPs** → `engineering/integrations.md`
- **Métricas de entrega** → [engineering/metrics.md](engineering/metrics.md)

## 📐 Specs — o contrato de cada feature
> A pasta [`specs/`](../specs/) é a fonte viva; a lista abaixo é mantida no `/kickoff`
> (atualize ao criar features com `/nova-feature`).
- [`specs/0001-exemplo-cota-de-uso/`](../specs/0001-exemplo-cota-de-uso/spec.md) — exemplo preenchido

## 📖 Linguagem & convenções
- **Glossário** (linguagem ubíqua) → [glossary.md](glossary.md)
- **Constituição p/ agentes de IA** → [../CLAUDE.md](../CLAUDE.md)
- **Manual da esteira SDD** (fluxo, tiers, DoR/DoD) → [../README.md](../README.md)
