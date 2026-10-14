# Execution ledger: triagem

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
