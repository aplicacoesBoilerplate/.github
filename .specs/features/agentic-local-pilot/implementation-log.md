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
