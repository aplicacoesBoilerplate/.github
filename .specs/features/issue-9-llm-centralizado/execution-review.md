# Evidências de implementação

## T1: contrato de entrada

Gate: 28 testes aprovados, zero falhas e zero skips. Instalação `npm ci --ignore-scripts` em diretório temporário com apenas manifesto/lock passou. `node --check` passou. Codex 0.162.1 confirmou via `exec --help` as opções `--model`, `--sandbox read-only`, `--output-schema`, `--output-last-message`, `--ephemeral`, `--ignore-user-config`, `--ignore-rules` e prompt por stdin. Nenhum login ou inferência foi executado.

Versões resolvidas no registry e fixadas: Node 22.23.3 (runtime do workflow), Codex 0.162.1, Ajv 8.20.0, libsodium-wrappers 0.8.4, yaml 2.9.1. Os 28 testes passaram também em Node 22.23.3. Desenvolvimento local usa Node 24.19.0 compatível com o manifesto. Modelo/esforço disponíveis na conta continuam como evidência do piloto, sem fallback.

| Critério / requisito | Evidência e expressão | Resultado especificado | Coberto |
| --- | --- | --- | --- |
| LLM-01: configuração/contexto do caller | `tests/llm/request.test.mjs:15` `assert.deepEqual(request.config, source)`; :16 `assert.deepEqual(request.context, { issue: 9 })`; :24 `assert.deepEqual(validateRequest(b, inputs()).config.execution, b.execution)` | Escolhas próprias preservadas | Sim |
| LLM-02: modo e campos fechados | `tests/llm/request.test.mjs:10` `assert.throws(fn, { code: 'INVALID_CONFIG', message: 'INVALID_CONFIG' })`, usado em :29, :34, :47, :77 e :78 | Configuração inválida recusada sem eco de dados | Sim |
| Modelo, esforço, template e versão | `tests/llm/request.test.mjs:47` `invalid(() => validateRequest(c, inputs()))`; :50 `assert.equal(validateRequest(c, inputs()).config.execution.model, c.execution.model)` | Valores contratuais; 128 caracteres aceitos | Sim |
| Paths e symlink | `tests/llm/request.test.mjs:53` `invalid(() => validateRequest(config(), { ...inputs(), config_path: value }))`; :92 `assert.rejects(..., { code: 'INVALID_CONFIG' })` | Leitura apenas de arquivo regular dentro do checkout | Sim |
| Contexto em bytes, objeto JSON | `tests/llm/request.test.mjs:67` `assert.equal(...context.v.length, 32760)`; :68 `invalid(...)` | 32768 bytes aceitos; excesso multibyte recusado | Sim |
| Identidade e branch | `tests/llm/request.test.mjs:56` `invalid(...)`; :57 `assert.equal(...invocation_id.length, 48)`; :60 `invalid(...)` | Sem injeção, identidade até 48 caracteres | Sim |
| Modalidade/nome de secret | `tests/llm/request.test.mjs:71` `assert.equal(...session_secret_name, 'MY_CODEX_AUTH')`; :72–74 `invalid(...)` | Nome apenas em sessão, sem seleção automática | Sim |
| Manifesto, lock e flags | `scripts/llm/package.json`, `scripts/llm/package-lock.json`; instalação limpa e help do binário observados | Versões exatas e opções compatíveis | Sim, verificação por comando |

| Testes / assertions | Origem | Manter |
| --- | --- | --- |
| request.test.mjs:15–31 | LLM-01/02, configuração e dois modos | Sim |
| request.test.mjs:34–61 | LLM-02, campos/modelos/paths/identidade/branch | Sim |
| request.test.mjs:64–78 | LLM-02, contexto e modalidade | Sim |
| request.test.mjs:86–92 | LLM-01/02, arquivo confiável/ausente/inválido/symlink | Sim |

Adequação: cada caso mapeia ao contrato, assertions verificam valores e códigos previstos, sem testes removidos ou ignorados. Diretrizes: constituição e matriz de testes da feature. A comprovação do comportamento completo de LLM-01/02 ainda depende de T2/T9.

## T2: origem e revisão confiáveis

Gate: 16 testes aprovados, zero falhas/skips; check de sintaxe passou. Metadata REST e erros de rede são simulados; nenhum token real foi utilizado.

| Critério / requisito | Evidência e expressão | Resultado especificado | Coberto |
| --- | --- | --- | --- |
| LLM-02/13: checkout resolvido pela branch padrão | `tests/llm/preflight.test.mjs:19` `assert.deepEqual(result, { repository: 'owner/app', default_branch: 'master', source_sha: latest, private: true })`; :20 `assert.deepEqual(calls, ['owner/app', ['owner/app', 'master']])` | SHA e destino obtidos de metadata, contexto não seleciona branch | Sim |
| Eventos proibidos | `tests/llm/preflight.test.mjs:25` `deny(...)`; :26 `assert.equal(called, false)` | UNTRUSTED_CONTEXT antes de metadata | Sim |
| Fork, repo, privacidade e revisão | `tests/llm/preflight.test.mjs:30–52` `deny(...)`, cujo assert em :11 exige código/mensagem exatos; :35 `assert.equal(...private, false)` | Rejeição explícita, API aceita contexto público confiável | Sim |
| API indisponível e SHA malformado | `tests/llm/preflight.test.mjs:46–51` `deny(...)` | Falha fechada sem divulgar erro original | Sim |
| REST com prazo/sem redirect | `tests/llm/preflight.test.mjs:58–62` `assert.deepEqual(result, repository())`, `assert.equal(...redirect, 'error')`, `assert.equal(...signal instanceof AbortSignal, true)` | Destino GitHub fixo e bearer somente no GET | Sim |
| Retry restrito | `tests/llm/preflight.test.mjs:68` `assert.equal(calls, 1)`; :74 `assert.equal(calls, 2)` | 401/403/429 sem retry; rede até duas tentativas | Sim |

| Assertions | Origem | Manter |
| --- | --- | --- |
| preflight.test.mjs:19–52 | LLM-02/13 e casos de borda da origem | Sim |
| preflight.test.mjs:58–74 | Política REST de GET/prazo/retry do design | Sim |

Adequação: assertions verificam identidade e estados contratuais; todos os testes possuem requisito. A validação de origem está implementada, mas LLM-13 completo ainda depende da ligação em T9.
