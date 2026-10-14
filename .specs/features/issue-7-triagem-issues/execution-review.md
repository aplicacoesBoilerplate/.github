# Execution ledger: triagem

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
