# Release & Publicação Automatizada no NPM

Este repositório possui uma esteira contínua via **GitHub Actions** configurada em `.github/workflows/deploy-npm.yml`.

Toda alteração enviada para a branch `main` executa automaticamente a esteira de deploy no NPM.

---

## 1. Configuração do Secret no GitHub (Necessário apenas uma vez)

Para que o GitHub Actions tenha permissão para publicar no NPM em nome de `@acaldas12`:

1. No NPM, gere um **Access Token**:
   - Acesse [npmjs.com](https://www.npmjs.com/) → **Access Tokens** → **Generate New Token**.
   - Tipo: **Automation** (ou **Granular Access Token** com permissão de Read and Write no escopo `@acaldas12`).
2. No GitHub:
   - Acesse o repositório **`bradrc/kspec`** → **Settings** → **Secrets and variables** → **Actions**.
   - Clique em **New repository secret**.
   - Nome: `NPM_TOKEN`
   - Valor: cole o token gerado no NPM.

---

## 2. Fluxo de Publicação Automática (Recomendado)

Quando quiser lançar uma nova versão:

1. Atualize a versão no `package.json` (ou use `npm version`):
   ```bash
   npm version patch   # ou minor / major
   ```
2. Envie o commit e as tags para a branch `main`:
   ```bash
   git push origin main --tags
   ```
3. A esteira `.github/workflows/deploy-npm.yml` será disparada:
   - Executa o smoke test (`npm run test:scaffold`);
   - Detecta que a versão é nova no NPM;
   - Publica o pacote `@acaldas12/kspec` automaticamente com `--access public`;
   - Cria o **GitHub Release** correspondente (`vX.Y.Z`).

> **Nota de Segurança**: Se um push for feito na `main` sem incremento de versão (ex: apenas ajuste de documentação), a esteira detecta que a versão já existe no NPM e pula a etapa de publicação com sucesso, sem quebrar o pipeline.

---

## 3. Publicação Manual Local (Alternativa / Fallback)

Se precisar publicar manualmente do seu terminal:

```bash
# 1. Conferir arquivos do pacote
npm run pack:check

# 2. Executar smoke test
npm run test:scaffold

# 3. Publicar diretamente
npm publish --access public
```
