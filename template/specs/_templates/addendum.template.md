---
type: fix # fix | improvement
specCode: REQ-0001
parentSpec: 0001-slug-da-spec
title: Título do Subdocumento (Adendo)
createdAt: YYYY-MM-DD
status: todo # todo | doing | testing | done
---

# Subdocumento (Adendo) — {Título}

## Vinculação de Governança
- **Spec Pai**: `specs/{NNNN-slug}/`
- **Requisito Pai**: `[REQ-NNNN]`
- **Tipo**: Correção (Bug Fix) / Melhoria

### Resumo & Causa Raiz
Descreva o contexto do bug identificado ou a oportunidade de melhoria técnica na funcionalidade existente antes de qualquer alteração de código.

### Critérios de Aceite Adicionais (ACs)
- **AC-FIX-1**: Dado [contexto], Quando [ação de correção], Então [comportamento esperado sem regressão].
- **AC-FIX-2**: Validação de regressão e efeitos colaterais no domínio da spec pai.

### Tarefas Vinculadas (anexadas ao tasks.md da Spec Pai)
- [ ] Mapear causa raiz e impacto
- [ ] Aplicar correção em conformidade com o AC
- [ ] Executar suíte de testes automatizados (`npm test`)
