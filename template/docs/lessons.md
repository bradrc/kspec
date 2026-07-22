---
name: lessons
description: Aprendizados transversais e gotchas descobertos durante o trabalho — quirks de lib, armadilhas de setup, suposições que se provaram erradas. Área de staging volátil que se auto-poda (o que estabiliza vira ADR/glossary/CLAUDE.md/TESTING e sai daqui). Puxe quando for mexer numa área com histórico de armadilha, ou antes de tomar uma decisão que já esbarrou num gotcha registrado.
alwaysApply: false
---

# LESSONS — Aprendizados & gotchas

> **Área de staging, não cemitério.** Registra o que se aprende na marra: quirks de biblioteca,
> armadilhas de ambiente, suposições que quebraram. É **volátil** — diferente do **ADR** (decisão
> durável) e do **STATE** (o que estamos fazendo agora). A lição que **estabiliza** é **promovida**
> e **removida** daqui (ver poda abaixo). Se este arquivo cresce sem parar, a poda não está rolando.

## Como usar
- **Captura inline (na hora):** ao corrigir um erro não-óbvio, quebrar uma suposição ou descobrir
  um gotcha, adicione **1 linha aqui na hora** — não espere o handoff (o detalhe some).
- **Consolidação (no `/handoff`):** ao pausar, revise as lições da sessão: alguma duplicada?
  alguma já estabilizou → **promova e remova**.

### Poda — para onde a lição vai quando amadurece
| A lição virou… | Vai para | Sai daqui |
|---|---|---|
| Decisão difícil de reverter | ADR (`docs/architecture/adr/`) | ✅ |
| Termo/conceito de negócio | `docs/glossary.md` | ✅ |
| Convenção de código/agente | `CLAUDE.md` | ✅ |
| Padrão de teste/quality gate | `docs/engineering/TESTING.md` | ✅ |
| Gotcha que ainda não estabilizou | **fica aqui** | — |

## Aprendizados ativos
> Formato: `- <YYYY-MM-DD> · <área/arquivo> · o gotcha em 1 linha · como evitar/mitigar`.
> Mantenha acionável e curto. Se não é acionável, não é uma lição — é desabafo.

- <YYYY-MM-DD> · <área> · <o que mordeu> · <como não morder de novo>

## Promovidas (histórico curto)
> Rastro de para onde foram as lições podadas — só o link, sem reexplicar. Poda este histórico também.
- <YYYY-MM-DD: "<lição>" → [ADR-NNNN](architecture/adr/NNNN-*.md) / glossary / CLAUDE.md>
