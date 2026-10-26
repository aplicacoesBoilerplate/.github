# Desenho do piloto local

**Spec:** spec.md. **Status:** recorte experimental local autorizado; não é ativação de produção.

## Approaches

1. OpenCode com OpenRouter nativo em processo temporário: escolhido para a primeira prova local autorizada.
2. Pi nativa no gh-aw: alternativa futura; o usuário preferiu manter OpenCode e permitir CLIs específicas por workflow.
3. Adaptador customizado gh-aw desde a primeira chamada: adiado até comprovar inferência local e o contrato da rota AWF.

## Architecture Overview

Config do consumidor → validação TypeScript → snapshot selecionado da master → OpenCode standalone → resposta validada → JSON local → limpeza.

O exemplo consumidor fica em examples/agentic/self-pilot. Modelos e prompts pertencem a ele. O executor em ci-scripts/scripts/agentic não contém autenticações, modelos padrão ou repositório fixo. Codex e Claude não são simulados como implementados: engines sem adaptador falham explicitamente.

## Components

- CAgenticConfiguration.ts: contrato fechado, validação de processos, arquivos versionados e limites; reutiliza as convenções de CReleaseConfiguration.
- COpenCodePilot.ts: adapter OpenCode 2.0.26, perfil temporário, ambiente fechado, permissões e resposta JSONL. Sem shell do sistema para construir comandos.
- run-pilot.ts: caller CLI local; resolve o binário travado, executa processos sequenciais e persiste evidência atômica fora dos arquivos versionados.
- examples/agentic/self-pilot: configuração e entradas controladas de triagem/review sobre código real do próprio .github.

## Code Reuse Analysis

Usar Node test, tsx, TypeScript strict e package-lock do ci-scripts existente. Não importar o runtime JavaScript dos PRs antigos para a master atual. Diretrizes globais: snapshot integral versionado, com hash; acrescentar AGENTS.md do consumidor sem substituí-lo. Nenhum acesso automático ao perfil pessoal OpenCode/Codex.

## Error Handling Strategy

Config inválida ou chave ausente falha antes do spawn. Timeout encerra o processo privado. Erro JSONL ou saída vazia falha. Somente resposta final, sem credencial, entra no resultado; stdout/stderr bruto não é publicado. Diretório temporário contém config e código selecionado, nunca a chave em disco, e é removido em finally.

## SonarQube

Contrato do consumidor: enabled, hostUrl, projectKey, mainBranch, scanner, qualityGateRequired. Inicialmente desabilitado e registrado como not-run. Quando implementado, scanner por stack roda após merge em develop, coleta analysisId/SHA e exige Quality Gate aprovado para promover a master. Reprovação cria Hotfix On hold na milestone existente e mantém épica Done. MCP somente leitura terá credencial própria de usuário técnico; token de análise não será reutilizado como token MCP.

## Risks & Concerns

| Concern | Location | Impact | Mitigation |
| --- | --- | --- | --- |
| gh-aw sample não expõe OpenRouter nativo; aceita famílias github/anthropic/openai | Sample v0.93.5 | Prova local não equivale a Actions homologado | Provar gh-aw separadamente; não desabilitar sandbox para contornar incompatibilidade |
| Sample gh-aw tem detector Copilot por padrão | Sample v0.93.5 | Exige outra credencial | Resolver detector antes de publicação remota |
| V1 e V2 OpenCode têm schemas diferentes | Config V2 | Config antiga ignorada ou rejeitada | Fixar 2.0.26 e consultar docs V2 |
| Permissões do harness não equivalem a isolamento do sistema operacional | Processo local | Não autoriza execução de código hostil | Piloto com entradas controladas; shell, escrita, MCP e plugins externos negados |
| Scan atual não espera explicitamente Quality Gate e fixa Windows | .github/workflows/sonarqube-scan.yml | Falsa interpretação de sucesso ou dependência de runner | Preservar arquivo nesta iteração; contrato e implementação posterior separados |

## References

- https://opencode.ai/v2/docs/cli/commands/
- https://opencode.ai/v2/docs/providers/#gateways
- https://opencode.ai/v2/docs/permissions/
- https://github.com/github/gh-aw/blob/v0.93.5/.github/workflows/shared/opencode.md
- https://github.github.com/gh-aw/reference/threat-detection/
