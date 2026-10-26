# Pilotos no próprio .github

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
- `pricing` opcional por processo: `input` e `output` em USD por token, números finitos não negativos. Quando informado, gera a tarifa AWF para o modelo exato, sem fallback global; a ausência mantém o catálogo do AWF. O modelo gratuito deste piloto declara ambos como zero, conforme API pública OpenRouter consultada em 2026-10-26. Esses dados permitem contabilizar AI Credits; não alteram o preço cobrado pelo provedor. Ao trocar de modelo, conferir e atualizar também as tarifas.
- `timeoutMs`: 1000 a 120000. Não há fallback ou repetição automática para outro modelo.
- `instructionsFile`: snapshot integral das diretrizes globais; o caller acrescenta o AGENTS.md do consumidor. Limite combinado: 64 KiB.
- `sonar`: URL, chave do projeto, branch principal e scanner ficam preparados; `enabled` deve permanecer `false` até a implementação própria. Quality Gate obrigatório quando essa integração for ativada.

Todos os inputs são lidos do commit HEAD, incluindo config e prompts. Depois de ajustar uma configuração, registre-a em commit local antes de executar. Alterações não commitadas nos arquivos-fonte ficam fora da análise. Cada resultado registra SHA e hashes das entradas.

## Evidências e limites

JSONs locais ficam em `ci-scripts/tmp-agentic-results/`, ignorados pelo Git. O resumo do comando confirma recebimento de resposta; a qualidade da triagem e a identificação da regressão devem ser conferidas no conteúdo dos JSONs.

Os casos são controlados: faltam metadados na triagem e o patch de review remove uma proteção contra traversal. O patch não é aplicado ao código original. Os modelos gratuitos podem estar indisponíveis ou sujeitos a limites; uma falha deve permanecer explícita.

O exemplo foi ajustado explicitamente para `liquid/lfm-2.5-2.6b:free` nos dois processos após o pool gratuito Gemma retornar429. Cada campo continua independente; o teste de contrato usa IDs diferentes. O executor não troca de modelo por conta própria.

Esta prova não homologa gh-aw, publicação, MCP ou Quality Gate. O adapter de exemplo gh-aw precisa de uma prova separada de endpoint, isolamento e detector antes da ativação no Actions.

## Preparar o piloto no GitHub Actions

O consumidor deste piloto é `aplicacoesBoilerplate/.github`. A biblioteca compartilhada não guarda sua chave. No repositório, abra **Settings → Secrets and variables → Actions → New repository secret** e cadastre `API_KEY_OPENROUTER`, usando o valor da sua chave OpenRouter. Não use o campo Variables nem inclua a chave em comandos/commits. Quem chama outro consumidor fornece sua própria secret; os callers não usam `secrets: inherit`.

`config.json` continua controlando modelo, prompt e nome da secret por processo. Para atualizar os arquivos compilados:

```text
cd ci-scripts
npm run compile:agentic
npm test
npm run typecheck
npm run compile:agentic -- --check
```

O helper baixa gh-aw0.93.5 para uma pasta ignorada, valida seu SHA256 e fixa os scripts de Actions no commit32ecafbc061c9af57e9361942099e381102ae304. Suporta Windows/Linux x64 e requer Git/GitHub CLI autenticado para resolução de metadados. A CI apenas reproduz a compilação; não recebe a chave OpenRouter nem chama modelos. Os `.md`, `.lock.yml`, callers YAML, manifesto e actions-lock devem entrar juntos no commit.

Após revisão e integração humana dos callers na branch padrão, abra **Actions → Agentic triage pilot → Run workflow**. Escolha a revisão a testar. Depois execute **Agentic review pilot**. Novos workflows manuais precisam existir na branch padrão para aparecerem e aceitarem dispatch. A integração/merge não é feita automaticamente por este piloto.

O caller YAML passa o modelo escolhido e mapeia `API_KEY_OPENROUTER` para o secret requerido `OPENAI_API_KEY` do called. Esse é o nome técnico da interface compatível com OpenAI; o provedor continua sendo OpenRouter, em `https://openrouter.ai/api/v1`. AWF mantém a chave fora do agente, que recebe um placeholder. Não requer assinatura nem chave de Copilot. Permissões dos jobs são somente leitura. O MCP mínimo do pin permite somente `get_file_contents` do consumidor; o harness nativo permite read/glob/grep e somente safeoutputs_noop para o terminal interno. Outras ferramentas MCP, shell e escrita permanecem negadas. Não há harness pessoal, plugins ou MCPs adicionais homologados neste recorte.

O compilador injeta publicação por padrão quando `safe-outputs` é omitido. Por isso os handlers e relatos que criariam issues estão explicitamente desativados. A única saída habilitada é noop, máximo um sinal e report-as-issue:false, exigida para encerrar o workflow sem publicar recursos. O agente deve produzir a resposta e chamar safeoutputs_noop; a ausência desse terminal continua sendo falha, mesmo com exit zero e texto no log. O detector também fica fora deste ensaio sem publicação; qualquer habilitação futura de comentários/PRs exige contrato de detecção e aprovação próprios. Sandbox/firewall permanecem ativos. Inferência limitada a oito minutos e quatro turnos; o job reserva até sessenta minutos para instalação/artefatos. Artefato próprio de proveniência: três dias; logs/sessões geridos pelo gh-aw seguem a retenção da instância Actions.

## Conferir o primeiro run

Exija sucesso do job completo, não apenas do upload. Confira a resposta e a sessão nos artefatos/resumo do gh-aw: a triagem deve reconhecer metadados ausentes e a revisão deve apontar a remoção da proteção contra traversal. Nenhum código proposto será aplicado; nenhuma issue/comentário/PR será publicado pelo agente.

O artefato `agentic-pilot-triage-provenance` ou `agentic-pilot-review-provenance` contém `evidence.json`: SHA, modelo, hashes de config/inputs e `workspaceIntegrity: verified`. `inferenceStatus: not-assessed` é intencional: integridade do workspace não confirma a qualidade nem o sucesso da LLM. `sonarStatus: not-run` permanece até a entrega própria do SonarQube.

Sem secret o job deve falhar; HTTP429 exige aguardar o provedor ou trocar explicitamente o modelo na config e recompilar. Não há fallback silencioso. Erro de integridade exige corrigir a divergência e gerar/compilar novamente; não remova o guard. A execução real AWF/Linux, o transporte OpenRouter pelo proxy e os resultados remotos ainda aguardam o primeiro run. Compilação local e testes simulados não substituem essa homologação.
