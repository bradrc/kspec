---
name: tasks
description: Tasks — Remover botao New Customer do Menu Principal
alwaysApply: false
---

# Tasks — Remover botao New Customer do Menu Principal

| #  | Task                          | Cobre AC      | Gate (comando)   | Status |
|----|-------------------------------|---------------|------------------|--------|
| 1  | Localizar o componente de Menu/Sidebar no frontend | AC-1          | `npm test`     | done |
| 2  | Remover a referencia ao botao New Customer | AC-1          | `npm test`     | done |
| 3  | Validar se a rota de criacao ainda e acessivel via tela de listagem | AC-1          | `npm test`     | done |
| 4  | Testar a navegacao para garantir que nenhum erro de referencia foi gerado | AC-1          | `npm test`     | done |

## Plano de teste
- Testes unitários cobrindo todos os ACs da spec.

## Definition of Done
- [ ] ACs validados pelo gate de teste
- [ ] Sem SPEC_DEVIATION pendente
- [ ] Revisão de conformidade com a arquitetura
