# Code review reutilizável Specification

**Status:** Especificação e design aprovados pelo mantenedor em 2026-10-15; tasks em revisão. **Issue:** #8. **Data:** 2026-10-15.
**Base local:** #9 → #7 → #8. O OpenSpec `pr-code-review-mvp` permanece histórico; esta proposta reconcilia seu contrato com a implementação da central e da triagem.

## Problem Statement

A central LLM e a triagem estão implementadas localmente, mas ainda não existe code review que consuma a mesma central. O mantenedor quer homologar as três pipelines juntas em `aplicacoesBoilerplate/demo-repository`, não encerrar a entrega apenas com simulações. Configurações e credenciais desse consumidor pertencem somente a ele; o repositório central fornece lógica reutilizável.

## Goals

- [ ] Revisar PRs elegíveis, inclusive drafts criados pela triagem, com modelo e prompt escolhidos pelo consumidor.
- [ ] Publicar achados ligados ao diff exato e propor correção por PR complementar, sem aprovar ou fazer merge.
- [ ] Entregar callers encadeados e homologar #9/#7/#8 no consumidor privado escolhido.
- [ ] Preservar contratos legados, isolamento de credenciais e o fluxo corretivo do SonarQube.

## Out of Scope

| Recurso | Motivo |
| --- | --- |
| Merge, aprovação nativa ou fechamento automático | Aceitação continua humana |
| Push no head original ou em branches de integração | Correções são propostas separadas |
| SonarQube pré-merge e mudança automática de Status no Project | #5 continua corretiva após merge em develop |
| Forks, consumidores públicos, harness e execução arbitrária da LLM | Fora do contrato privado do MVP |
| Manual extenso e testes da documentação | Adiados pelo mantenedor; caller funcional e instruções de configuração permanecem |
| Migração global das demais aplicações | Homologar primeiro no consumidor escolhido |

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Consumidor integrado | `aplicacoesBoilerplate/demo-repository`, privado, default master, confirmado por API em 2026-10-15 | Escolha expressa do mantenedor | Sim |
| Responsabilidade de configuração | Callers, secrets, modelos/esforço/prompts próprios, Project, branches e checks no consumidor; central mantém código genérico e diretrizes globais reutilizáveis | Evitar uma identidade ou configuração de produto global | Sim |
| Unidade de entrega | Três pipelines e PRs empilhados; piloto da triagem permanece obrigatório, agora integrado ao review | Mantenedor quer o conjunto trabalhando junto | Sim |
| Entrada confiável de review | Caller privilegiado versionado na branch padrão; código do PR é somente dado até o job isolado de checks | Não promover alterações do head a configuração confiável | Proposto |
| Integração triagem → review | Job explícito no caller após triagem devolver PR; reconsultar esse PR e validar a origem antes de autenticar a LLM | Evitar depender do acionamento implícito de outro workflow | Proposto |
| Recursão | Aceitar PRs próprios da triagem; impedir nova correção a partir de PR complementar produzido pelo review | Ignorar todos os bots quebraria o piloto solicitado | Proposto |
| Achados | Resumo marcado como automático e lista estruturada de até 20 achados, apenas linhas adicionadas do diff no MVP | Referências verificáveis sem construir um sistema de annotations completo | Proposto |
| Limites | Config 32 KiB; body 16 KiB; diff 16 KiB e até 100 arquivos; contexto total 32 KiB; envelope/payload total 1 MiB; outputs 8 KiB; retenção 1 dia | Limites compatíveis com a central atual e falha explícita para excesso | Proposto |
| Provisionamento | Sem ler auth pessoal/global; credenciais dedicadas fornecidas pelo mantenedor no consumidor | Autorização de implementação não é autorização para usar a conta pessoal | Sim |

**Open questions:** none — todas as ambiguidades estão resolvidas ou registradas na tabela. O mantenedor aprovou a especificação e seus defaults em 2026-10-15. O rótulo Proposto na tabela registra a origem desses defaults; aprovação não autoriza ativação remota.

## User Stories

### P1: Analisar um PR pela central existente

**User Story:** Como mantenedor, quero revisar PRs humanos e da triagem com as mesmas regras de autenticação por consumidor, sem duplicar o executor.

**Acceptance Criteria:**

1. WHEN um PR elegível for aberto, reaberto, sincronizado ou solicitado por dispatch THEN o review SHALL analisar o head atual reconsultado pela API, sem filtro de branches de negócio. (REV-01)
2. IF o consumidor for público/fork, o head vier de outro repositório ou a identidade não estiver autorizada THEN o review SHALL recusar a chamada antes de materializar credenciais LLM. (REV-02)
3. WHEN a coleta começar THEN o review SHALL resolver configuração, prompts e AGENTS do consumidor a partir do SHA confiável da branch padrão, separado do head e do base SHA do PR. (REV-03)
4. WHEN a inferência for autorizada THEN o review SHALL reutilizar o executor central com modalidade, modelo, esforço e prompt configurados pelo caller. (REV-04)
5. IF o diff estiver incompleto, exceder 16 KiB/100 arquivos ou não puder ser representado integralmente como texto THEN o review SHALL retornar inconclusivo sem afirmar análise completa. (REV-05)
6. WHEN uma análise terminar THEN o review SHALL vincular o resultado ao repositório, PR, head/base/merge-base SHA, config SHA, revisão da automação, run/attempt e hashes de configuração/instruções. (REV-06)

**Independent Test:** PR confiável usa modelo/prompt do consumidor e produz identidade exata; contexto forjado ou configuração do head não alcança autenticação.

### P1: Publicar achados sem substituir o humano

**User Story:** Como revisor, quero achados verificáveis no PR para decidir sobre a proposta, sem uma aprovação artificial.

**Acceptance Criteria:**

1. WHEN a LLM retornar achados THEN o review SHALL validar até 20 itens com severidade critical/warning/suggestion, arquivo e linha adicionada existentes no diff analisado. (REV-07)
2. IF um achado ou envelope for inválido THEN o review SHALL recusar a publicação daquele resultado com erro sanitizado, sem descartar silenciosamente itens inválidos. (REV-08)
3. WHEN o resultado válido for publicado THEN o review SHALL registrar comentário identificado como automático com SHA, resumo e distinção entre achados críticos, sugestões e ausência de achados. (REV-09)
4. The review SHALL manter aprovação/merge/fechamento e transições do Project sob controle humano, sem executar o Quality Gate da issue #5. (REV-10)

**Independent Test:** Achado na linha correta é publicado; linha inventada é recusada; ausência de achados não cria review nativa APPROVE.

### P1: Propor correção revisável

**User Story:** Como mantenedor, quero receber uma correção separada para o PR original sem permitir que a automação altere minha branch diretamente.

**Acceptance Criteria:**

1. WHEN um PR de feature corrigível retornar patch THEN o review SHALL restringir os arquivos ao diff original e à allowlist do consumidor, recusando caminhos sensíveis já protegidos pela central. (REV-11)
2. WHEN o patch for preparado THEN o review SHALL aplicá-lo ao head SHA exato em repositório temporário isolado, sem executar hooks ou scripts do produto na preparação/publicação. (REV-12)
3. WHEN os checks do consumidor forem executados THEN o review SHALL usar o isolamento por container imutável da triagem, sem rede, secrets, socket Docker ou mounts da automação. (REV-13)
4. WHEN uma proposta válida for publicada THEN o review SHALL abrir PR draft complementar com base na branch head original, commit filho do head analisado e vínculo ao PR original. (REV-14)
5. IF os checks falharem THEN o review SHALL manter a proposta explicitamente draft-checks-failed para revisão humana, sem declarar aprovação. (REV-15)
6. IF o PR for de integração ou sua branch não for explicitamente corrigível pela política confiável THEN o review SHALL publicar apenas achados, sem criar correção automática. (REV-16)

**Independent Test:** Patch permitido gera PR complementar para feature; release/develop/master não recebem correção e o head original fica intacto.

### P1: Operar as três pipelines juntas

**User Story:** Como consumidor, quero que a triagem encaminhe seu PR ao review com configuração local, sem duplicação ou recursão.

**Acceptance Criteria:**

1. WHEN a triagem devolver um PR próprio THEN o caller SHALL encadear explicitamente o review, validando por API PR, origem e snapshot/identidade da execução antes da LLM. (REV-17)
2. WHEN o mesmo PR/head/base/config já tiver publicação íntegra da mesma revisão da automação THEN o review SHALL reutilizar o registro próprio, sem duplicar comentário ou PR complementar. (REV-18)
3. IF a automação encontrar um PR complementar de review com origem comprovada THEN o review SHALL interromper a cadeia de correções; PRs da triagem não recebem esse bloqueio genérico. (REV-19)
4. WHEN houver execuções concorrentes THEN os workflows SHALL serializar publicação por PR e acesso à mesma sessão do consumidor entre triagem e review, sem cancelar uma renovação em andamento. (REV-20)
5. WHEN um consumidor adotar as pipelines THEN a entrega SHALL fornecer callers copiáveis com entradas, secrets explícitos, modelos/prompts, recuperação e consumo de resultados, sem configurações particulares do piloto no central. (REV-21)
6. WHEN o conjunto for homologado THEN o piloto SHALL demonstrar issue → triagem → PR draft → review e duas execuções reais sequenciais da central no consumidor escolhido, com evidências sanitizadas. (REV-22)
7. WHEN a homologação exercitar falhas de sessão/fila/persistência e recuperação THEN o piloto SHALL comprovar os critérios pendentes TRI-24/25, distinguindo refresh real de refresh ainda não observado. (REV-23)

**Independent Test:** Caller integrado chega ao comentário de review no draft da triagem, sem identidade central global; fixtures não substituem runs reais.

## Edge Cases

1. IF o PR fechar ou seu head/base/config mudar antes de publicar THEN o review SHALL recusar a proposta antiga como STALE_REVIEW_INPUT, sem atualizar branches ou comentários com resultado obsoleto. (REV-24)
2. IF uma escrita retornar erro ambíguo THEN o review SHALL consultar os recursos próprios antes de repetir a operação, preservando edições e recursos humanos. (REV-25)
3. IF provider, API, persistência, upload ou limpeza falhar THEN o workflow SHALL falhar explicitamente sem disponibilizar artefato utilizável ou vazar credenciais. (REV-26)

## Implicit-Requirement Dimensions

| Dimensão | Resolução |
| --- | --- |
| Validação e limites | REV-02/03/05/06/07/08/11; limites explícitos acima |
| Falha parcial | REV-15/25/26; sem retry cego de escrita |
| Idempotência | REV-18/25; recurso próprio íntegro e identidade reconsultados |
| Autenticação e rate limits | REV-02/04/26; API indisponível ou rate-limited falha explicitamente, sem inferência não autorizada |
| Concorrência | REV-20/24; fila compartilhada da sessão e checagem final de entrada |
| Ciclo de dados | REV-21/26; artefatos por 1 dia e temporários removidos; comentários/PRs preservados para decisão humana |
| Observabilidade | REV-06/09/15/26; identidades e códigos sanitizados, sem body/diff nos outputs |
| Dependências externas | REV-05/26; provider/API/checks indisponíveis não viram análise aprovada |
| Transições | REV-10/14/16/19/24; sem merge/fechamento ou promoção automática |

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| REV-01 | Origem | Specify | Pending review |
| REV-02 | Confiança | Specify | Pending review |
| REV-03 | Configuração | Specify | Pending review |
| REV-04 | Central | Specify | Pending review |
| REV-05 | Limites | Specify | Pending review |
| REV-06 | Proveniência | Specify | Pending review |
| REV-07 | Achados | Specify | Pending review |
| REV-08 | Recusa | Specify | Pending review |
| REV-09 | Publicação | Specify | Pending review |
| REV-10 | Humano/Sonar | Specify | Pending review |
| REV-11 | Escopo do patch | Specify | Pending review |
| REV-12 | Preparação | Specify | Pending review |
| REV-13 | Checks | Specify | Pending review |
| REV-14 | PR complementar | Specify | Pending review |
| REV-15 | Falha dos checks | Specify | Pending review |
| REV-16 | Integração | Specify | Pending review |
| REV-17 | Encadeamento | Specify | Pending review |
| REV-18 | Idempotência | Specify | Pending review |
| REV-19 | Recursão | Specify | Pending review |
| REV-20 | Concorrência | Specify | Pending review |
| REV-21 | Caller | Specify | Pending review |
| REV-22 | Piloto conjunto | Specify | Pending review |
| REV-23 | Piloto transferido | Specify | Pending review |
| REV-24 | Entrada antiga | Specify | Pending review |
| REV-25 | Recuperação | Specify | Pending review |
| REV-26 | Falhas | Specify | Pending review |

**Coverage:** 26 requisitos aprovados, em design e ainda sem implementação da #8. Os estados Pending review da tabela registram a rodada original; a aprovação desta revisão os promove a In Design, não a Verified.

## Success Criteria

- [ ] Caller privado demonstra o ciclo integrado real com a central e o review da triagem.
- [ ] Achados são verificáveis e correções só chegam por PR complementar revisável.
- [ ] Configuração de produto e credenciais permanecem no consumidor.
- [ ] Gates de segurança e compatibilidade existentes permanecem verdes.
- [ ] Verifier TLC independente valida a entrega; piloto real comprova REV-22/23 e TRI-24/25.

## Fontes e diferenças em relação ao histórico

- Issue #8 consultada em 2026-10-15: Feature, Effort High, milestone v1.0.0, épica #3; bloqueios remotos #5/#9 preservados. O body menciona dependência lógica de #7; o empilhamento local a concretiza sem alterar metadados remotos nesta etapa.
- Diretrizes globais atuais prevalecem sobre a sugestão antiga de Sonar pré-merge do body.
- O OpenSpec antigo ignorava todo PR do bot; isso impediria revisar a própria triagem e é substituído por REV-17/19.
- Central atual aceita perfis manual/triage e resultado summary/patch; o design deverá estender explicitamente origem de review e achados estruturados sem quebrar envelopes/callers existentes. Não se presume suporte já implementado.
- [GitHub: Trigger a workflow](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow), consultado em 2026-10-15: eventos de PR gerados por GITHUB_TOKEN podem ficar aguardando aprovação; dispatch é exceção. Encadeamento explícito evita depender dessa execução implícita. Context7 não está disponível nesta sessão; consulta oficial usada como fallback.
