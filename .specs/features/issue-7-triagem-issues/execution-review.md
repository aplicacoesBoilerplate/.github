# Execution ledger: triagem

## T4: preparação isolada

Premissa: preparar um commit local não publica nem executa verificações do produto. Arquivos: prepare-patch.mjs, patch.test.mjs e progresso TLC. T6 conecta o job separado de checks sem credenciais; essa integração não é alegada como concluída em T4.

RED observado por módulo inexistente antes da implementação; allowlist do ambiente também testada antes da extração do helper. GREEN: gate completo em Node 22.23.3 e sintaxe passaram. Nenhum teste removido/ignorado ou credencial real utilizada.

Ruling: clone local sem checkout/hardlinks e template vazio; árvore aceita somente blobs regulares antes de checkout, hooks/global/system config desativados e ambiente fechado — preserva a fonte e evita execução de produto. Custo: bases com symlinks/submódulos exigem intervenção humana no MVP.
Ruling: bundle diferencial de um commit com base como pré-requisito — entrega uma proposta transportável sem Git config ou história inteira. Publisher precisa validar identidade/hash novamente; checks não autorizam publicação por si só.

| Critério / AC | Evidência e assertion | Resultado |
| --- | --- | --- |
| Aplicação exata e fonte intacta | `tests/triage/patch.test.mjs:35–40`: conteúdo new/old, HEAD fonte/base e HEAD^ da proposta iguais ao source_sha | Proposta na base exata, fonte preservada |
| Bundle e limpeza | `tests/triage/patch.test.mjs:41–42`: bundle verify exit0, access(directory) rejeita ENOENT | Artefato Git verificável, temporários removidos |
| Recusa sem proposta | `tests/triage/patch.test.mjs:51–53`: rejects códigos sanitizados para empty/out-of-policy/protected/inaplicável/SHA/envelope; fonte old | Sem patch publicável para entrada inválida |
| Nenhuma execução de produto/credenciais | `tests/triage/patch.test.mjs:62–67`: chaves de env exatas, CODEX_AUTH_JSON undefined, texto literal e hook marker ENOENT | Env fechado e hooks ignorados; produto não executado |
| Symlinks/submódulos | `tests/triage/patch.test.mjs:78`: rejects INVALID_TRIAGE_PATCH após base com modos 120000/160000 | Recusa antes do checkout |

Mapeamento reverso: todos testes do componente protegem TRI-13/16/17, sem testes documentais. Adequação: efeitos reais de Git/conteúdo/ancestralidade/limpeza, não apenas número de comandos; integração do job de produto explicitamente pendente T6. Task 4: complete.

## T3: central compatível

Premissa: configuração/default Git SHA separado do SHA analisado; perfil triage explícito sem abrir origens legadas indiscriminadamente. Arquivos: preflight/request/orchestrate/result/run, workflow central, origem extraída em collect, adaptador de domínio invocation, testes centrais/triage e progresso TLC.

RED: nova integração falhou UNTRUSTED_CONTEXT no código legado; comportamento ausente confirmado antes da implementação. GREEN: suite completa em Node 22.23.3, syntax e actionlint 1.7.12 Windows passaram. Binário reacquirido e checksum zip validado porque scratch antigo foi removido externamente; exceções precisas pré-existentes mantidas. Nenhuma inferência/autenticação real.

Ruling: adapter de domínio em scripts/triage autoriza rota/contexto/base e não duplica o ciclo de auth; central mantém executor genérico — evita trazer regras SDD para o executor; custo: perfil precisa manter compatibilidade de adapter junto da revisão central.
Ruling: schemas v1/v2 discriminados, v2 derivado do schema fechado v1 com campo config_source_sha obrigatório — preserva callers existentes sem duplicar todos campos; custo: revisão deve avaliar alterações comuns para ambos formatos.
Ruling: assertion de interface fechada do workflow atualizada somente com os inputs/secret aprovados; guards legados de evento/SHA e v1 não foram enfraquecidos — evolução de contrato, não remoção de teste; custo: consumidores v2 precisam passar token de leitura próprio.

| AC / critério | Evidência e assertion | Resultado |
| --- | --- | --- |
| Modelo/prompt/diretrizes e fonte corretos | `tests/triage/central.test.mjs:59–69`: schema/source/config SHA, modelo/esforço/template/source_files e env/instruções exatos | V2 vinculado à fonte e configuração próprias |
| Forja/base/issue/config/token ausente | `tests/triage/central.test.mjs:83–85`: código/mensagem exatos, authUsed false, output vazio | Recusa antes de auth |
| SDD não retorna código | `tests/triage/central.test.mjs:93–94`: INVALID_RESULT/output vazio | Patch em plan recusado |
| Inspector/config SHA e legado | `tests/triage/central.test.mjs:99–107`: valida/recusa v2 spoof/downgrade, manual schema 1 sem campo novo | V1 preservado e v2 fechado |
| Persistência e token de leitura | `tests/triage/central.test.mjs:131–141`: AUTH_PERSIST_FAILED após PUT real simulado, output vazio/ENOENT; token em summary recusado | Sem resultado utilizável ou vazamento |
| Runner real e evento da plataforma | `tests/triage/central.test.mjs:170–179`: subprocesso bootstrap/source exit0, SHAs emitidos, somente state.json; payload diferente exit1 UNTRUSTED_CONTEXT | SHA Git/config e issue validados antes do checkout de análise |
| Workflow de checkouts e credenciais | `tests/triage/central.test.mjs:185–194`: manual default, refs exatas e zero sessão/PAT nas fases de metadata | Separação preservada |

Mapeamento reverso: asserts novos cobrem TRI-03/04/06/07/09/13/20/22 e critérios T3. Suite anterior continua no gate; sem testes de texto ou metas de contagem. Preload de rede é test-only e nunca faz fallback externo. Task 3: complete; integração local não substitui piloto GitHub/Codex real.

## T2: coleta

Premissa: configuração confiável escolhe fonte dos campos; metadata não vem do body. Arquivos: collect.mjs, api.mjs, config.schema.json/field_sources, collect.test.mjs e progresso TLC. Sucesso: consulta issue real, autor/ator autorizados, origem privada/default, metadata paginada, SHA de base/config separados e limites sem truncamento.

RED observado antes de collect.mjs existir. GREEN: testes do componente, suite completa em Node 22.23.3 e sintaxe passaram. Credenciais de LLM não foram utilizadas; transportes dos testes são fixtures.

Ruling: field_sources opcional por campo, default Project, permite usar Issue Fields sem confundi-los com Project — consulta real da issue mostrou Effort distinto nos dois lugares; fontes explícitas evitam downgrade silencioso; custo: consumidor precisa escolher fonte se preferir a organização.
Ruling: adapter read-only dedicado suporta queries paginadas/GraphQL que githubGet central não aceita — preserva endpoint fixo/prazo/erros sanitizados, sem retry automático de POST; custo: manter adapter testado em vez de ampliar implicitamente o helper de auth.

| AC / critério | Evidência e assertion | Resultado |
| --- | --- | --- |
| Origem/ator/issue fechada | `tests/triage/collect.test.mjs:74` assert.rejects UNTRUSTED_CONTEXT / STALE_TRIAGE_INPUT | Sem snapshot autorizado |
| Snapshot e duas revisões | `tests/triage/collect.test.mjs:40–49` issue/base/source/config SHA/route/proveniência/body exatos | Contexto da API e hashes separados |
| Entrada antiga | `tests/triage/collect.test.mjs:57,58,61` fingerprint muda com body/base | Nova análise distinguível |
| Insuficiência/ambiguidades | `tests/triage/collect.test.mjs:85–87` needs-human, complete false, erro privado ausente | Ausência não concede patch |
| Fonte issue explícita | `tests/triage/collect.test.mjs:94–96` Team + field_id/source/value exatos + plan | Fonte selecionada preservada |
| Limites bytes | `tests/triage/collect.test.mjs:101,104,105` tamanho íntegro / INVALID_TRIAGE_INPUT | Sem truncamento |
| Paginação e erros reais do adapter | `tests/triage/collect.test.mjs:117–123,130–133,154–157` blocker da segunda página, endpoint/auth/read-only, erro sanitizado, fields/values completos | Não ignorar segunda página nem dados GraphQL parciais |

Mapeamento reverso: esses asserts atendem TRI-01/02/03/05/08/09/11/14/20/22 e critérios T2; nenhum teste de documentação. Efeitos/snapshots são assertados, não somente contagem de requests. Task 2: complete; integração do coletor com auth/workflow ainda depende de T3/T6.

Plan: `.specs/features/issue-7-triagem-issues/tasks.md`. Spec/design/tasks aprovados em 2026-10-14; execução inline sequencial.

## Pre-flight

T1 produz policy/route/base candidatos para T2; T2 comprova origem/base e produz snapshot para T3/T5. T3 produz envelope v2 para T4/T7; T4 prepara patch para T5; T5 publica via API; T6 integra componentes e T7 entrega caller; T8 exige piloto real. Interfaces compatíveis no plano.

Ruling: progresso/rulings ficam no ledger TLC e STATE, não em documentação paralela superpowers — preserva o workflow TLC escolhido e a decisão de evitar documentação; custo se inadequado: adaptar tooling de extração sem alterar produto.
Ruling: documentação operacional adiada por solicitação em 2026-10-14; T7 mantém caller/config/prompts/inspector funcional — não remover componentes executáveis ao adiar prosa; custo: documentação de adoção futura ainda necessária.
Ruling: sinal explícito High/Team/MAJOR determina SDD mesmo quando outros metadados faltarem — TRI-09 é determinístico; não autoriza patch nem ignora informações faltantes no planejamento; custo: resumo pode exigir complemento humano.

## T1: política

Assumptions: policy pura não prova existência remota da branch; T2 deve comprová-la. Files: scripts/triage/policy.mjs, schemas/config.schema.json, tests/triage/policy.test.mjs e progresso TLC. Success: rota simples exige evidência completa/base; sinais SDD não podem ser burlados; configuração/path/base inválidos recusados sem ecoar valores.

RED: teste escrito antes de policy.mjs; falha observada por componente inexistente. Dependências centrais instaladas pelo lockfile com scripts desativados, sem usar credencial LLM.

GREEN: Quick passou; suite completa central+triagem passou em Node 22.23.3, sintaxe e validate_tasks passaram. Nenhum teste eliminado/ignorado, nenhuma credencial real de LLM utilizada.

| Critério / AC | Evidência e assertion | Resultado especificado |
| --- | --- | --- |
| Config fechada/path/base/limite | `tests/triage/policy.test.mjs:18,25,28`: deepEqual do config e throws INVALID_TRIAGE_CONFIG | Config próprio preservado, inválidos recusados |
| SDD obrigatório | `tests/triage/policy.test.mjs:34,57`: deepEqual plan/SDD_REQUIRED | High/Team/MAJOR não autorizam patch |
| Caso simples e blockers | `tests/triage/policy.test.mjs:41,43,44`: rota exata e blockers open/closed | Patch somente com evidência simples; blocker aberto planeja |
| Insuficiência/contradição/base desconhecida | `tests/triage/policy.test.mjs:51,53`: needs-human exato | Sem autorização de patch |
| Base não vem do body | `tests/triage/policy.test.mjs:63,65–67`: release/stack/null exatos | Somente milestone ou config confiável |

Mapeamento reverso: todos asserts de policy.test.mjs atendem critérios T1 e TRI-05/09/10/11/14; nenhum teste de prosa ou regra externa à spec. Adequação: asserts medem configuração/rota/base, não mocks; consulta remota fica explicitamente em T2. Task 1: complete, gate Node22 e Quick green; registrar no commit atômico T1.
