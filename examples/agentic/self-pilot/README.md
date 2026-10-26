# Piloto local no próprio .github

Este consumidor executa OpenCode 2.0.26 com OpenRouter sobre um snapshot Git do próprio catálogo. Triagem e revisão usam modelos e prompts separados. Não cria issues, comentários ou PRs; não ativa Actions nem executa SonarQube.

No worktree da feature, instale dependências e execute em PowerShell ou Git Bash:

```text
npm ci --ignore-scripts
npm ci --prefix ci-scripts --ignore-scripts
cd ci-scripts
npm run pilot:agentic -- ../examples/agentic/self-pilot/config.json
```

A variável `API_KEY_OPENROUTER` deve existir no ambiente desse terminal. Não inclua seu valor em comandos, arquivos de configuração ou commits. O adapter a fornece apenas como `OPENROUTER_API_KEY` ao processo privado. Ele não reutiliza a autenticação do Codex/ChatGPT nem o serviço OpenCode pessoal.

## Configuração do consumidor

- `processes.triage` e `processes.review`: cada processo define engine, provider, model, credentialEnv, promptFile, inputFile e contextFiles.
- `engine`: `opencode` nesta primeira prova. `codex`/`claude` exigem adaptadores futuros e são recusados explicitamente.
- `provider`: `openrouter`, `openai` ou `anthropic`; só OpenRouter está homologado neste piloto quando houver evidência de inferência aprovada. O formato de `model` é o ID do provedor, sem repetir o prefixo externo OpenCode.
- `credentialEnv`: nome da variável no consumidor. O executor mapeia para a variável esperada pelo provedor; nunca coloca seu valor no config.
- `timeoutMs`: 1000 a 120000. Não há fallback ou repetição automática para outro modelo.
- `instructionsFile`: snapshot integral das diretrizes globais; o caller acrescenta o AGENTS.md do consumidor. Limite combinado: 64 KiB.
- `sonar`: URL, chave do projeto, branch principal e scanner ficam preparados; `enabled` deve permanecer `false` até a implementação própria. Quality Gate obrigatório quando essa integração for ativada.

Todos os inputs são lidos do commit HEAD, incluindo config e prompts. Depois de ajustar uma configuração, registre-a em commit local antes de executar. Alterações não commitadas nos arquivos-fonte ficam fora da análise. Cada resultado registra SHA e hashes das entradas.

## Evidências e limites

JSONs locais ficam em `ci-scripts/tmp-agentic-results/`, ignorados pelo Git. O resumo do comando confirma recebimento de resposta; a qualidade da triagem e a identificação da regressão devem ser conferidas no conteúdo dos JSONs.

Os casos são controlados: faltam metadados na triagem e o patch de review remove uma proteção contra traversal. O patch não é aplicado ao código original. Os modelos gratuitos podem estar indisponíveis ou sujeitos a limites; uma falha deve permanecer explícita.

O exemplo foi ajustado explicitamente para `liquid/lfm-2.5-2.6b:free` nos dois processos após o pool gratuito Gemma retornar429. Cada campo continua independente; o teste de contrato usa IDs diferentes. O executor não troca de modelo por conta própria.

Esta prova não homologa gh-aw, publicação, MCP ou Quality Gate. O adapter de exemplo gh-aw precisa de uma prova separada de endpoint, isolamento e detector antes da ativação no Actions.
