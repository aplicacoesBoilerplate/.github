# Progresso do piloto

## T1

Contrato de configuração implementado. Configuração e modelos são do consumidor; engines não implementadas falham, sem fallback.

Gate: 4 testes em agentic-config.test.ts aprovados. Afirmações AGP-01 em assert.equal(model/prompt/credentialEnv); AGP-02 em assert.throws para engine, campo desconhecido, timeout, traversal e modelo inválido; AGP-08 em assert.throws para ativação Sonar não implementada ou gate opcional. Todos testam resultados contratuais; nenhum teste de documentação.

Base: worktree criado de origin/release/v1.0.0 e atualizado por fast-forward para origin/master 4176883. Nenhuma branch remota foi atualizada. Variável API_KEY_OPENROUTER encontrada; autenticação aceita pelo endpoint /api/v1/key. Essa consulta não executou inferência. is_free_tier identifica a categoria da conta; não foi interpretado como autorização de modelos pagos.

## T2

Adapter OpenCode 2.0.26 travado no package-lock. Instalação realizada com scripts npm desabilitados; bootstrap oficial postinstall executado explicitamente para preparar apenas o binário da plataforma. Não usar o OpenCode global da máquina.

Gate: 8 testes aprovados; typecheck aprovado. agentic-runtime.test.ts verifica no filho a ausência de PAT/outro provedor, o modelo efetivo, diretrizes, política deny e limpeza do cwd/profile. assert.rejects cobre chave ausente, código de erro, timeout, evento de erro após texto parcial, resposta vazia e eco da chave. O teste confirma o efeito do isolamento do processo; não afirma isolamento do sistema operacional.

T3 entrega o caller com gate simulado e commit dos seus inputs; T4 faz a inferência real sobre esses arquivos já versionados. Essa separação preserva a identidade dos inputs no ensaio.

## T3

Caller local pronto no próprio .github. Modelos por processo: google/gemma-4-26b-a4b-it:free para triagem e google/gemma-4-31b-it:free para revisão, presentes no catálogo OpenRouter consultado em 2026-10-26. A disponibilidade da inferência ainda é validada em T4.

Snapshot integral do AGENTS global copiado sem edição, SHA-256 original 38ebd29a0c12506b5e53459d9a1add7734b19c56cca5fcc500302904d4cacf81. A conversão de CRLF/LF pelo Git pode mudar o hash de bytes do blob; o resultado registra o hash do conteúdo efetivamente enviado, incluindo diretrizes do consumidor.

Gate: 74 testes e typecheck aprovados. A primeira execução da suíte revelou ausência das dependências Commitlint da raiz; npm ci --ignore-scripts na raiz resolveu o ambiente, sem alterar testes. agentic-caller.test.ts comprova conteúdo do commit apesar de edição local, modelos separados, SHA/repositório/hashes, not-run para Sonar/gh-aw e recusa de arquivo não versionado. Fontes originais não são alterados pelo caso de review.

## F1: correções da revisão e diagnóstico real

A revisão independente detectou descoberta de `.opencode` em diretório ancestral fora do perfil temporário. HOME/USERPROFILE isolados não impediam a descoberta. Foram adicionados flags reais do CLI fixado: OPENCODE_DISABLE_PROJECT_CONFIG, OPENCODE_CONFIG, OPENCODE_CONFIG_DIR e OPENCODE_TEST_HOME, com AGENTS explícito em instructions. O preflight sem chave do verificador confirmou três fontes, todas internas ao scratch, sem plugin externo configurado. Registry de agents vazio no comando API ficou registrado como observação de bootstrap, não defeito: a execução real subsequente gerou eventos de sessão e alcançou OpenRouter.

Correções adicionais: soma de contexto limitada a64KiB separadamente das diretrizes; diagnóstico limitado e com a chave redigida em stderr/stdout; término da árvore no timeout. O teste de descendente reproduziu EPERM na limpeza antes da correção de encerramento. Asserções existentes foram preservadas; novas asserções cobrem os defeitos.

Gate independente corrigido: 78 testes, zero falhas/skips e typecheck aprovado. Sensor5/5 detectou mutações de herança de ambiente, permissões, eco da chave, flags de descoberta e limite de contexto. Relatório mantém histórico de FAIL.

## T4: inferência real em andamento

Tentativas com Gemma4 chegaram ao OpenRouter e falharam com HTTP429, limite upstream_provider_shared_pool, sem evidência de sucesso. Consulta de disponibilidade confirmou ausência de saldo para modelos pagos; nenhum modelo pago foi acionado. Probes nvidia/poolside com32tokens não produziram texto útil e não contam como homologação; outro poolside retornou429. Probe liquid/lfm-2.5-2.6b:free sem parâmetros extras retornou texto com finish_reason=stop. Modelo do exemplo foi alterado explicitamente no consumidor para Liquid nos dois processos, sem implementar fallback no executor. O próximo ensaio deve comprovar as duas respostas pelo harness, não apenas a chamada HTTP direta.

Ensaio inicial completo Liquid atingiu timeout. Diagnóstico mínimo pelo mesmo adapter retornou OK em3557ms, com perfil isolado e chave do consumidor, comprovando rota OpenCode→OpenRouter. Probe direto Liquid com ferramenta retornou tool_calls. Esses probes não substituem AGP-07. O caller passou a anexar input/código explicitamente com --file; os prompts do consumidor refletem essa entrega direta. Essa mudança evita depender de ferramentas para receber entradas já selecionadas e versionadas, sem reduzir o AGENTS global. O teste de fronteira do adapter exige os dois anexos exatos.
