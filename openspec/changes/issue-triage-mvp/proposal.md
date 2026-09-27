# Proposal

## Why

A issue #7 precisa transformar uma nova issue em uma decisão de triagem útil, e, quando couber, numa proposta de correção. A automação deve reutilizar a autenticação, o roteamento de modelos e os prompts da pipeline central da issue #9, preservando o Git Flow e a revisão humana.

## What Changes

- Criar um workflow de triagem reutilizável chamado por um caller enxuto de cada repositório privado no evento de abertura de issue; ele envia metadados reais para a decisão de rota da pipeline central conforme o `AGENTS.md` global versionado.
- Pedir ao workflow central da issue #9 um resultado estruturado de planejamento ou um patch proposto, sem permitir que ele altere o repositório.
- Para rota de planejamento, registrar um resumo/SDD de triagem na issue sem aplicar código; para rota de correção, validar o patch e entregar as mudanças por PR revisável na branch de origem apropriada.
- Tratar saída inconclusiva, repetição do evento e falhas de permissões sem duplicar comentários ou PRs nem fechar a issue prematuramente.
- Entregar caller de exemplo e documentação do workflow reutilizável, gatilhos, rotas, configurações e resultados.

## Capabilities

### New Capabilities

- `issue-triage-automation`: Orquestração de triagem e entrega revisável de propostas de correção para issues novas.

### Modified Capabilities

Nenhuma.

## Impact

Novo workflow reutilizável de domínio e scripts de validação/publicação, documentação e caller de exemplo; ajuste coordenado da skill de CI/CD para exigir modelo de called documentado. Depende do contrato e da homologação da issue #9. Não inclui os eventos ilustrativos de comentários de review ou falhas de CI da issue original, merge automático, aprovação automática nem instalação de secrets neste repositório público.
