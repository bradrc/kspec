---
name: ado
description: Use para integrar a esteira SDD com o Azure DevOps (ADO) via MCP Server ou AZ CLI. Sincroniza Epics, Features (da spec.md) e Tasks (do tasks.md), gerencia Iteration Paths (Sprints) e exibe o preview obrigatório antes da criação. Acione com /ado.
---

# Skill: Integração com Azure DevOps (ADO)

Permite sincronizar os artefatos de especificação da esteira SDD com o Azure DevOps (ADO), mantendo rastreabilidade bidirecional entre o código/spec e os Work Items da nuvem.

## Princípios de Operação
- **Escopo Completo (Novas Features e Adendos)**: A sincronização com o ADO atende novas features (Epic -> Feature -> User Story -> Tasks) e **adendos de correção/melhoria** em specs existentes (Tasks ou Bugs vinculados à US/Feature pai).
- **Regra Mandatória de Adendo no ADO**: Em adendos de specs já implementadas, o agente **nunca deve esquecer de fazer a correção no código, atualizar a documentação da spec mãe (`spec.md`) e, havendo integração com o ADO, atualizar os Work Items correspondentes no ADO** (marcando tasks e bugs como `Closed`/`Done`).
- **Fechamento em Cascata Ascendente (Rollup Hierárquico)**: Ao atualizar o status dos itens no ADO, o agente deve seguir rigorosamente a regra em cascata:
  - Se fechar todas as Tasks de uma User Story (US), **deve fechar a US**;
  - Se fechar todas as US de uma Feature, **deve fechar a Feature**;
  - Se fechar todas as Features de um Epic, **deve fechar o Epic**.
- **Pergunta Obrigatória antes da Fase 3**: A pergunta sobre a sincronização com o Azure DevOps é **OBRIGATÓRIA** antes de avançar para a fase de implementação e após a aprovação de todas as specs. Se o usuário optar por não integrar, a esteira segue para o TDD sem nenhum bloqueio.
- **Atualização Mandatória de Status na Implementação**: Quando houver integração com o ADO, ao concluir cada tarefa no código e marcá-la em `tasks.md`, o agente **deve obrigatoriamente atualizar o status do respectivo Work Item no ADO** (marcando-o como `Done` ou `Closed`) e acionar a cascata ascendente.
- **Detecção Híbrida**: O agente prioriza o MCP do Azure DevOps se disponível na sessão (`mcp__azure_devops__*`); caso não esteja, utiliza comandos do `az devops` CLI (`az boards work-item`).
- **Preview Obrigatório (Preview Gate)**: Caso o usuário opte por sincronizar, NUNCA crie itens no ADO sem exibir antes a árvore hierárquica completa e obter a confirmação explícita.
- **Rastreabilidade**: Os IDs criados são registrados no frontmatter da `spec.md` e na tabela de `tasks.md`.

---

## Passo 1 — Verificação da Conexão (Híbrida)

1. **Checagem de MCP**:
   - Verifique se há MCP de Azure DevOps ativo na sessão (`mcp__azure_devops__*`).
   - Se ativo, confirme a organização e o projeto destino.

2. **Fallback AZ CLI**:
   - Se não houver MCP, verifique se a CLI oficial está instalada e autenticada:
     ```bash
     az account show
     az devops project list --output table
     ```
   - Se o usuário não estiver logado, oriente a executar:
     ```bash
     az login
     az devops configure --defaults organization=https://dev.azure.com/<sua-org> project=<seu-projeto>
     ```

---

## Passo 2 — Coleta de Parâmetros de Gestão

Logo após a spec ser validada (Fase 2):

1. **Pergunta de Envio**:
   > *"Deseja sincronizar esta especificação no Azure DevOps (ADO)?"*
   - Opções: **Sim, sincronizar agora (Recomendado)** · **Não, manter apenas local**.

2. **Definição do Epic**:
   > *"Qual Epic do Azure DevOps deve ser associado a esta funcionalidade?"*
   - O agente oferece:
     - **Vincular a Epic existente**: Lista os Epics abertos no projeto ou aceita o ID numérico informado pelo usuário.
     - **Criar novo Epic**: Coleta o título e descrição do novo Epic para criá-lo no momento da sincronização.

3. **Definição da Iteration (Sprint)**:
   > *"Qual a Iteration Path (Sprint) de destino no Azure DevOps?"*
   - O agente lista as iterações disponíveis (`az boards iteration project list` ou via MCP) ou aceita o caminho (ex.: `<Projeto>\\Sprint 1`).

---

## Passo 3 — Pré-visualização Estruturada (Preview Gate)

Antes de criar qualquer Work Item, exiba a estrutura completa para validação do usuário:

```markdown
### 🔍 Pré-visualização dos Work Items no Azure DevOps

| Tipo | Título | Iteration | Vínculo / Pai |
|---|---|---|---|
| **Epic** | [EPIC] <Título do Epic> | <Iteration Path> | — (Raiz) |
| **Feature** | [REQ-NNNN] <Título da Spec> | <Iteration Path> | Filho do Epic acima |
| **Task #1** | <Título da Task 1> | <Iteration Path> | Filho da Feature |
| **Task #2** | <Título da Task 2> | <Iteration Path> | Filho da Feature |

**Critérios de Aceite que serão incluídos na descrição da Feature:**
- AC-1: <resumo>
- AC-2: <resumo>
```

> 🛑 **Confirmação:** *"Confirma a criação destes itens no Azure DevOps? (s/N)"*
> Só execute a escrita após o "Sim" do usuário.

---

## Passo 4 — Execução e Criação dos Work Items

### Via MCP Server:
- Crie o Epic (se for novo).
- Crie a Feature passando `Title`, `Description` (com ACs) e `IterationPath`.
- Vincule a Feature ao Epic com relação `System.LinkTypes.Hierarchy-Reverse`.
- Crie cada Task vinculada como filha da Feature.

### Via AZ CLI:
1. **Epic (se novo):**
   ```bash
   az boards work-item create --type "Epic" --title "<Titulo do Epic>" --iteration "<Iteration>" --output json
   ```
2. **Feature vinculada ao Epic:**
   ```bash
   az boards work-item create --type "Feature" --title "<Titulo da Spec>" --iteration "<Iteration>" --description "<Conteudo com ACs>" --output json
   az boards work-item relation add --id <FEATURE_ID> --relation-type "Parent" --target-id <EPIC_ID>
   ```
3. **Tasks vinculadas à Feature:**
   ```bash
   az boards work-item create --type "Task" --title "<Titulo da Task>" --iteration "<Iteration>" --output json
   az boards work-item relation add --id <TASK_ID> --relation-type "Parent" --target-id <FEATURE_ID>
   ```

---

## Passo 5 — Gravação da Rastreabilidade no Projeto

Após a criação bem-sucedida, atualize os arquivos do repositório:

1. **`specs/NNNN-<slug>/spec.md` (Frontmatter):**
   ```yaml
   ado_epic_id: <ID_DO_EPIC>
   ado_feature_id: <ID_DA_FEATURE>
   ado_iteration_path: "<CAMINHO_DA_ITERATION>"
   ```

2. **`specs/NNNN-<slug>/tasks.md`:**
   Preencha a coluna `ADO ID` na tabela com o ID de cada Task criada no ADO.

3. **`docs/STATE.md`:**
   Registre o ID da Feature e do Epic ativos na sessão.

---

## Passo 6 — Atualização Contínua & Fechamento em Cascata Ascendente

Durante a fase de desenvolvimento/código:

1. **Ao concluir cada Task:**
   Assim que a tarefa for implementada e o teste passar, marque `[x]` em `tasks.md` e execute a atualização da Task no ADO:
   - **Via MCP Server / AZ CLI**:
     ```bash
     az boards work-item update --id <TASK_ID> --state "Closed" # ou "Done"
     ```

2. **Cascata Ascendente 1: Task → User Story (US):**
   Verifique se todas as tasks filhas da **User Story (US)** associada foram concluídas:
   - Se todas as tasks da US estiverem `Closed`/`Done`, atualize o status da **User Story**:
     ```bash
     az boards work-item update --id <US_ID> --state "Closed" # ou "Done"
     ```

3. **Cascata Ascendente 2: User Story → Feature:**
   Verifique se todas as User Stories filhas da **Feature** foram concluídas:
   - Se todas as US da Feature estiverem `Closed`/`Done`, atualize o status da **Feature**:
     ```bash
     az boards work-item update --id <FEATURE_ID> --state "Closed" # ou "Done"
     ```

4. **Cascata Ascendente 3: Feature → Epic:**
   Verifique se todas as Features filhas do **Epic** foram concluídas:
   - Se todas as Features do Epic estiverem `Closed`/`Done`, atualize o status do **Epic**:
     ```bash
     az boards work-item update --id <EPIC_ID> --state "Closed" # ou "Done"
     ```
