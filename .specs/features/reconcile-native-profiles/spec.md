# Conciliação dos perfis nativos — Specification

## Problem Statement
PR #12 contém standard-version/jgitver, enquanto codex/jgitver-maven contém uma implementação Maven independente validada. Consolidar os ganhos sem perder o fluxo técnico Node, prefixos ou compatibilidade Go. A publicação autorizada é na branch do PR #12, sem merge.

## Goals
- [ ] Uma implementação modular para Go, Maven e standard-version no PR existente.
- [ ] Cálculo e geração nativos sem permissões de escrita; escritor confiável sem executar ferramentas/configuração do consumidor.
- [ ] Testes reais, negativos, idempotência e revisão independente antes do push.

## Out of Scope
| Feature | Reason |
| --- | --- |
| Merge, release central e alterações nos pilotos | Não autorizados nesta solicitação |
| npm publish / Maven deploy | GitHub Release não distribui pacotes; integração dos pilotos posterior |
| Entrega de Changesets/Turbo no #12 | Pertence ao PR #13; avaliar compatibilidade e informar conflitos sem absorver escopo |
| Reescrever histórico remoto | Somente push fast-forward; divergência remota bloqueia |
| Substituir standard-version depreciado | Usuário pediu este adaptador; registrar limitação upstream |

## Assumptions & Open Questions
| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Base | PR12 fcf31e08165156a5938eec7577bbf1be945f365f | Fonte remota existente, não publicar implementação concorrente | Sim |
| Origem local | b4c783a47dcd923ce1d67253ceaf4b1fe3fc3589 preservado | Reaproveitar componentes e testes, não cherry-pick em bloco | Sim |
| Publicação | HEAD reconciliado -> codex/versioning-profiles, PR12 | Autorização expressa 2026-10-15 | Sim |
| Execução | Neste chat, commits atômicos e verificador fresco | Escolha anterior mantida; TLC obrigatório | Sim |
| Maven | plugin1.9.0/Java21/Maven3.9.9; versão única | Perfil nativo já provado localmente | Sim |
| Bootstrap | primeira versão de cada escopo sem tags somente0.0.1 | Regra aprovada; configuração nativa deve produzi-la sem fallback central | Herdado |
| Node | preservar PR técnico e outputs version_pr_url/pending-version-pr | Contrato remoto existente | Sim |
| Bootstrap Node | manifests0.0.0 -> candidata0.0.1 e alteração real; firstRelease e same-version não suportados | G1 reproduzido pelo Verifier; preservar guard de integridade, documentar e testar o recorte | Precisão técnica |
| Compatibilidade interna | migrar fixtures Maven de stdout para Properties, mantendo assertions de comportamento | Formato ativo mais forte e SHA nativo obrigatório | Decisão técnica |
| Autenticação | agente AI autorizado; token não impresso | Permissão de publicação existente nesta conversa | Sim |

**Open questions:** none — resolvidas ou registradas acima.

## User Stories

### P1: Reconciliação e modularidade — REC-01
**Acceptance Criteria**:
1. WHEN calcular Go, jgitver ou standard-version THEN o registro SHALL aceitar apenas IDs permitidos e receber dependências explícitas.
2. WHEN executar Go existente THEN o contrato SHALL preservar schema1, versão/SHA e outputs.
3. WHEN selecionar tag_prefix literal THEN o relatório SHALL usar somente tags estáveis alcançáveis do seu escopo.
**Independent Test**: contratos dos módulos e regressões das duas branches.

### P1: Maven verificável — REC-02
**Acceptance Criteria**:
1. WHEN calcular jgitver THEN o coletor SHALL exportar Properties nativas com used_version, calculated_version, SHA completo e plugin1.9.0 coincidentes.
2. IF houver versão aplicada divergente, SHA incorreto ou qualificador THEN a validação SHALL falhar antes de escrita.
3. WHEN publicar Maven THEN o publicador SHALL criar tag anotada no SHA integrado e reconciliar retry sem mover referências.
4. WHEN executar reactor e reconstruir tags THEN os quatro módulos SHALL manter versão comum, incluindo core-only e dirty preexistente preservado.
**Independent Test**: fixture real Java21/Maven e mocks de publicação.

### P1: standard-version funcional — REC-03
**Acceptance Criteria**:
1. WHEN integrar PR funcional com standard-version THEN a automação SHALL preparar um único PR técnico com manifests, lock e changelog nativos, sem publicar Release.
2. WHEN integrar esse PR técnico aprovado por humano no head atual THEN a publicação SHALL usar o SHA integrado e a versão recalculada no SHA funcional de origem.
3. IF review for bot, dismissed, obsoleto ou PR/diff/versão inválidos THEN a validação SHALL bloquear sem escrita.
4. WHEN reexecutar PR técnico ou Release existente THEN a automação SHALL reconciliar sem duplicar ou sobrescrever.
**Independent Test**: standard-version9.5.0 real e fluxo técnico em API controlada.

### P1: Fronteira read/write — REC-04
**Acceptance Criteria**:
1. WHEN executar cálculo ou geração de arquivos nativos THEN o job SHALL ter somente leitura e não receber App secrets/tokens de escrita.
2. WHEN executar escritor com escrita THEN o job SHALL consumir evidência materializada sem Maven, npm install ou standard-version.
3. IF SHA, prefixo, identidade, arquivos, hashes ou referências Git divergirem após leitura THEN o escritor SHALL falhar sem escrita.
4. WHEN fornecer project_path fora do workspace ou exceder timeout THEN o executor SHALL falhar com motivo e sem fallback.
**Independent Test**: escritor com binário nativo exit99; artefatos adulterados; workflow sem runtime/install no job privilegiado.

### P1: Governança e homologação — REC-05
**Acceptance Criteria**:
1. WHEN PR não possuir milestone THEN a policy SHALL aceitar cálculo nativo mantendo gates restantes.
2. WHEN milestone existir THEN a policy SHALL validar versão exata e incremento; título inválido SHALL bloquear sem override.
3. WHEN divergência válida tiver label Maintain/Admin e aprovação posterior de outra pessoa autorizada no head atual THEN a policy SHALL registrar override sem alterar versão.
4. WHEN gerar guia Maven THEN os artifacts SHALL distinguir Properties nativas de explicação derivada.
**Independent Test**: policy existente, equivalência entre adaptadores e payloads do guia.

### P1: Entrega no remoto existente — REC-06
**Acceptance Criteria**:
1. WHEN gates locais e revisão independente passarem THEN a entrega SHALL atualizar somente a branch autorizada do PR12 por fast-forward.
2. IF branch remota tiver commits novos não integrados THEN o envio SHALL parar sem force-push.
3. WHEN relatar prontidão THEN o relatório SHALL distinguir CI hospedada, provas locais e piloto/registry ainda pendentes.
**Independent Test**: SHA remoto antes/depois, checks do PR12 e relatório rastreável.

## Edge Cases
- IF tag existente apontar para outro commit após peeling THEN o publicador SHALL retornar conflito sem mover tag.
- IF tag for criada e Release falhar THEN o retry SHALL recuperar apenas a Release ausente.
- IF refs mudarem durante environment THEN a publicação SHALL exigir nova leitura, tolerando apenas própria tag no mesmo SHA.
- IF artefato técnico contiver path absoluto, traversal ou symlink THEN o escritor SHALL bloquear sem executar hooks/configuração do consumidor.
- IF não houver tag no escopo THEN o normalizador SHALL aceitar somente0.0.1; configuração nativa permanece dona do cálculo.
- IF consumer origin avançar THEN o PR técnico funcional SHALL bloquear; retry de release antiga só aceita estado já completo.

## Implicit Requirement Dimensions
| Dimension | Coverage |
| --- | --- |
| Input/bounds | REC01/02/04, schema, paths, prefixos, timeout, tamanho |
| Partial failures | REC02/03 e edges; não desfazer release publicada |
| Idempotency | REC02/03, PR existente/tag/release |
| Auth | REC04/05, tokens separados e revisão humana |
| Concurrency | REC04/06, snapshot/ref e fast-forward |
| Lifecycle | temporários/artifacts fora do consumer, histórico local preservado |
| Observability | versão, SHA, fase, outcome e relatório |
| External failure | fail closed Maven/npm/API, sem fallback |
| State transitions | PR funcional -> técnico -> publicação; hotfix e environment |

## Requirement Traceability
| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| REC-01 | Modularidade | Execute | Verified locally; independent PASS |
| REC-02 | Maven | Execute | Verified locally; independent PASS |
| REC-03 | Node | Execute | Verified locally; independent PASS |
| REC-04 | Read/write | Execute | Verified locally; independent PASS |
| REC-05 | Governança | Execute | Verified locally; independent PASS |
| REC-06 | Publicação existente | Execute | Pending |

## Success Criteria
- [ ] Baselines preservadas, três ferramentas reais aprovadas e sensor independente discriminante.
- [ ] PR12 atualizado, sem merge e sem alterações dos pilotos.
- [ ] Limites de suporte standard-version e impacto sobre PR13 documentados.
