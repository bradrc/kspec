---
type: fix
specCode: REQ-0001
parentSpec: 0001-coletar-feedback
title: Correção na validação de tamanho máximo de feedback
createdAt: 2026-10-09
status: doing
---

# Correção (Bug Fix) — Validação de tamanho máximo de feedback

## Subdocumento vinculado à Spec: REQ-0001 (Coletar feedback)

### Resumo
Identificado que feedbacks com caracteres multibyte (emojis e caracteres acentuados) estavam ultrapassando o limite de 1000 bytes sem o erro de validação esperado. Este subdocumento formaliza a correção antes de qualquer alteração de código.

### Critérios de Aceite da Correção
- **AC-FIX-1**: O cálculo de tamanho máximo deve considerar codificação UTF-8 ou contagem correta de code points.
- **AC-FIX-2**: Retornar HTTP 422 com mensagem amigável `Texto excede o limite de 1000 caracteres` sem corromper o banco.

### Tarefas Associadas (anexadas ao tasks.md da Spec)
- [x] Ajustar validador de tamanho para utilizar contagem de code points (gate: npm test)
- [ ] Adicionar teste regressivo cobrindo payload com emojis longos
