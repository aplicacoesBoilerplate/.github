# Protótipos de caller da issue #9

Estes arquivos são modelos de contrato para revisão. O workflow central ainda não existe e os marcadores de SHA/modelo impedem considerar o exemplo pronto para execução. Nenhum token real foi usado.

O caller escolhe evento, arquivo de configuração, modo de autenticação e mapping dos secrets. `analyze.json.example` pertence ao consumidor e define modo/modelos/esforço/templates. Para `single`, remover `decision` e trocar `invocation_mode`.

Cada chamada define `invocation_id` único no run, por exemplo `analyze-main` e `review-main`. Os dois exemplos são alternativas, por isso usam o mesmo ID. Ao usar duas chamadas no mesmo caller, definir IDs distintos e validar esse campo no resultado; o nome interno do job reutilizável não diferencia as chamadas.

| Arquivo | Destino na futura implementação/adoção |
| --- | --- |
| `caller-chatgpt.yml.example` | `.github/workflows/llm.yml` no consumidor privado |
| `caller-api-key.yml.example` | Alternativa ao caller ChatGPT, somente com chave própria e opt-in |
| `analyze.json.example` | `.github/llm/analyze.json` no consumidor |

## Provisionamento planejado

1. Implementar e revisar a referência central; substituir `PINNED_CENTRAL_SHA` e o SHA da action de download por commits reais revisados.
2. Escolher modelo e esforço disponíveis na conta e compatíveis com o CLI fixado. A conta Plus não implica API key ou faturamento de API.
3. No modo ChatGPT, criar uma sessão dedicada ao fluxo privado, armazenar no repository secret `CLI_CODEX_SESSION` e criar um PAT fine-grained do próprio consumidor em `CLI_CODEX_SESSION_WRITE_PAT`, com `Secrets: write` apenas nesse repo. O mapping em `secrets` e `session_secret_name` devem corresponder.
4. Não copiar a mesma sessão de refresh para consumidores diferentes ou continuar usando a mesma sessão em outra máquina. O código compartilhado não oferece lock entre organizações.
5. No modo API, configurar somente `CLI_OPENAI_API_KEY`; remover secrets e parâmetros de sessão. Não fornecer ambas as modalidades.
6. Acionar `workflow_dispatch` pela branch padrão. Contexto é dado; alteração de política depende de revisão do arquivo versionado.
7. Consumir o artefato apenas após sucesso técnico e validação de identidade/schema. `skipped`/`needs-human` não autorizam aplicação automática.

## Limitações e recuperação

- `AUTH_SNAPSHOT_STALE`: disparar um novo workflow depois da última gravação da secret. Reexecutar um run antigo não garante nova leitura.
- `AUTH_REQUIRED`: refazer login em ambiente confiável e substituir a secret desse consumidor.
- `AUTH_PERSIST_FAILED` ou cancelamento depois de refresh: pausar callers, conferir permissão e restaurar sessão válida antes de nova tentativa.
- Alterar secrets manualmente requer pausar as execuções: API de secrets não oferece compare-and-swap.
- A configuração inicial aceita somente dispatch confiável; os callers de triagem/review ganharão seus triggers no escopo próprio.

Contrato e valores completos: [design](../design.md). Plano de validação: [tasks](../tasks.md).
