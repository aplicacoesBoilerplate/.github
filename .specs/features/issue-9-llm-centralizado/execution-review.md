# Evidências de implementação

## T7: execução controlada e prompt do caller

Gate Full e sintaxe passaram. `execution.test.mjs:28–41` confere resultado, modelo/esforço, dados literais, flags e fonte preservada; :47–49 exige exatamente as etapas decididas; :54–67 cobre provider/JSON/timeout sem retry; :75–77 confere prompt próprio e modelo do caller. `request.test.mjs:102–108` comprova carregamento de template versionado e recusa de excesso/ambiguidade/traversal. CLI 0.162.1 conferido por help e features list sem login; as flags usadas existem. Sandbox/inferência reais permanecem como evidência do piloto. O código é fornecido como dados, ferramentas de execução desativadas e prompt customizado não altera schema de resposta.

## T6: persistência criptografada

Gate passou. LLM-10/11: `persistence.test.mjs:43–50` verifica repo/secret/key_id e descriptografa sealed box para exigir conteúdo renovado; :55–56 verifica ausência de request quando inalterado; :60–68 recusa arquivo inválido, destino cruzado e escrita externa; :74–75 exige falha e um único PUT em 403/timeout, sem PUT para chave inválida. O cenário final preserva refresh mesmo após erro de provedor (:79–87). Metadata é conferida imediatamente antes do PUT; a ausência de CAS do GitHub permanece como limite operacional documentado. Nenhuma secret real foi alterada.

## T5: freshness antes de utilizar a sessão

Gate passou. LLM-09: `freshness.test.mjs:22–23` verifica boundary aprovado; :30 e :46 comprova que fila/rerun e metadata recusada não executam a continuação; :37 exige AUTH_SNAPSHOT_STALE para igualdade no segundo, calendário inválido e timestamps ausentes. As APIs simuladas verificam o destino e a credencial correta para cada GET (:12–16). A conexão ao job real permanece em T9.

## T4: autenticação isolada

Gate de auth e sintaxe passou. LLM-06/07/12: `auth.test.mjs:14–16` verifica arquivos/conteúdo de consumidores distintos; :24–28 e :40–43 verificam ambiente mínimo e ausência de credenciais de escrita; :30–34 verifica remoção após sucesso/erro; :56 exige AUTH_CONFIG_ERROR para combinações inválidas. Esses cenários protegem isolamento e recuperação, sem piso quantitativo. Permissões POSIX são verificadas quando executado em Linux; ACL Windows não é homologação do runner Ubuntu. Sem login ou tokens reais.

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

## T3: instruções integrais e proveniência

Gate de fase: 54 testes aprovados em Node 22.23.3 (28 contrato, 16 origem, 10 instruções), zero falhas/skips. Check de sintaxe passou. Ainda não há YAML executável desta feature; actionlint entra em T9. Igualdade do snapshot com o global normalizado para LF verificada por comparação do texto completo; hash original permaneceu o aprovado. Normalização e disponibilidade de skills registradas em provenance.json; Git mantém LF por atributo local.

| Critério / requisito | Evidência e expressão | Resultado especificado | Coberto |
| --- | --- | --- | --- |
| LLM-15: texto integral e hashes | `tests/llm/instructions.test.mjs:24` `assert.equal(result.content, 'all global lines\nincluding final newline\n\n\nconsumer guidance')`; :25 `assert.deepEqual(result.sources, [...])`; :29 `assert.equal(result.sha256, hash(result.content))` | Fontes completas, hashes individuais e agregado | Sim |
| Precedência e escopo Codex | `tests/llm/instructions.test.mjs:38–50` `assert.equal(...content, ...)`, `assert.deepEqual(...sources.map(s => s.path), [...])` | Global, raiz e cwd; override não vazio; irmãos não carregados | Sim |
| LLM-16: limite exato/excedido | `tests/llm/instructions.test.mjs:56` `assert.equal(result.bytes, 65536)`; :57 `assert.equal(result.content.length, 65536)`; :59 e :64 `deny(...)` com código exato em :17 | Limite em bytes sem truncamento | Sim |
| Symlinks, arquivos inválidos e cwd externo | `tests/llm/instructions.test.mjs:71–84` `deny(...)` | INSTRUCTIONS_INVALID | Sim |
| Snapshot/proveniência do mantenedor | `tests/llm/instructions.test.mjs:92–95` `assert.equal(hash(bytes), provenance.sha256)`, `assert.equal(provenance.source_sha256, '38ebd29a0c12506b5e53459d9a1add7734b19c56cca5fcc500302904d4cacf81')`, `assert.equal(provenance.source_bytes, 25298)` | Fonte aprovada identificável, snapshot verificável | Sim |

| Assertions | Origem | Manter |
| --- | --- | --- |
| instructions.test.mjs:24–50 | LLM-15, composição/prevalência documentada | Sim |
| instructions.test.mjs:56–84 | LLM-16, limites e paths da spec | Sim |
| instructions.test.mjs:92–95 | LLM-15 e Done-when de snapshot/proveniência | Sim |

Adequação: os 10 casos verificam conteúdo, hashes, precedência e recusas; matriz e constituição seguidas. Uma contagem de bytes literal do fixture foi corrigida de 40 para 41 antes da implementação; requisito e assertions de comportamento foram preservados. Nenhum teste removido/ignorado. T7 ainda deve conectar o conteúdo ao processo isolado; nenhum comportamento de inferência foi homologado.
