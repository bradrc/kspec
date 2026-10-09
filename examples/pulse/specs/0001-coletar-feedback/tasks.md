---
name: tasks
description: Tasks — Coletar feedback (exemplo golden).
alwaysApply: false
---

# Tasks — Coletar feedback

| #  | Task                          | Cobre AC      | Gate (comando)   | Status |
|----|-------------------------------|---------------|------------------|--------|
| 1  | Validar entrada               | AC-2 · AC-3   | `node --test`    | done   |
| 2  | Armazenar e retornar `id`     | AC-1          | `node --test`    | done   |
| 3  | Fix: Validar tamanho UTF-8    | AC-FIX-1      | `node --test`    | doing  |

## Plano de teste
- Aceite: um teste por AC em `src/feedback.test.mjs` (`AC-1`, `AC-2`, `AC-3`).

## Definition of Done
- [x] AC-1, AC-2, AC-3 verdes pelo gate (`node --test`)
- [x] Sem `SPEC_DEVIATION` pendente
