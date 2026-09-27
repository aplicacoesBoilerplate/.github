# Proposal

## Why

A issue #9 pede uma pipeline reutilizável para acionar o Codex CLI, mas os consumidores privados usam uma assinatura ChatGPT Plus, sem chave de API faturada separadamente nem runner persistente. Em runners efêmeros do GitHub Actions, a sessão do Codex precisa ser restaurada e sua versão renovada preservada com segurança entre execuções.

## What Changes

- Definir um contrato de workflow reutilizável para executar um prompt parametrizado, com modelo e nível de raciocínio configuráveis, e devolver resultado e estado explícitos ao consumidor.
- Usar uma secret de repositório privado para fornecer a sessão inicial do Codex CLI e um PAT fine-grained separado, limitado à atualização dessa secret após a execução.
- Serializar execuções que compartilham a mesma sessão, rejeitar eventos não confiáveis e falhar de modo seguro quando a autenticação ou a gravação da sessão falhar.
- Entregar documentação do workflow central e um workflow consumidor de exemplo com sua própria documentação.
- Validar a lógica sem credenciais reais; a prova ponta a ponta depende de um repositório privado piloto, de uma sessão fornecida pelo usuário e do PAT restrito.

## Capabilities

### New Capabilities

- `centralized-llm-execution`: Contrato reutilizável de execução de prompts pelo Codex CLI, autenticação persistida entre jobs e integração segura de consumidores privados.

### Modified Capabilities

Nenhuma.

## Impact

Novos workflows em `.github/workflows/`, suporte mínimo em `scripts/` e documentação em `docs/`. O consumidor privado deverá provisionar duas secrets distintas: a sessão do Codex e o PAT de escrita de secrets; o repositório central público não recebe credenciais. O fluxo depende do Codex CLI, GitHub Actions e da API de secrets do GitHub. Não inclui faturamento da API OpenAI, runners self-hosted, análise de PRs de código não confiável nem automação de triagem/revisão das issues dependentes.
