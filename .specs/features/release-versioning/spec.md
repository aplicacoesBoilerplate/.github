# Release versioning specification

## Problem Statement
O catálogo precisa aceitar versões por milestone ou Release-As, rejeitar tags duplicadas e versionar projetos em subdiretórios. Monorepos exigem adaptadores e versões independentes por pacote, com documentação prática.

## Goals
- [x] Resolver declarações de versão e validar disponibilidade no GitHub.
- [x] Preservar o contrato raiz e adicionar seleção de diretório e manifest nativo.
- [x] Entregar guia por artefato e exemplos executáveis dos cinco pacotes PackagesVue.

## Out of Scope
| Feature | Reason |
| --- | --- |
| Migrar o PackagesVue remoto | É referência de estrutura; usa Changesets atualmente. |
| Publicar PRs, tags, pacotes ou releases nesta sessão | A entrega é local e revisável. |
| Impedir criação de PR ou milestone pela interface | A validação bloqueia o check; o merge depende de regra obrigatória. |

## Assumptions & Open Questions
| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Diretório omitido | Raiz . | Preservar consumidores existentes | Sim |
| Manifest com vários pacotes e footer global | Rejeitar se houver mais de um alvo | Evitar broadcast de uma versão independente | Escolha técnica explícita |
| Publicação em manifest | Caller usa outputs por pacote | Preservar registro, build e credenciais do consumidor | Escolha técnica explícita |
| Versão inicial do catálogo | 0.0.1 | Release já publicada; próxima 0.0.2 vem da pipeline | Sim |
| Nome de tag monorepo | componente-vX.Y.Z | Isolar identidades dos pacotes | Escolha técnica explícita |

**Open questions:** none — decisões acima delimitam esta implementação.

## User Stories
### P1: Declaração e disponibilidade
1. WHEN um PR declarar milestone ou Release-As THEN o sistema SHALL resolver uma versão SemVer.
2. IF as declarações divergirem THEN o sistema SHALL rejeitar o PR.
3. WHEN a tag de uma versão já existir THEN o sistema SHALL rejeitar uma nova entrega por qualquer origem.
4. WHEN o PR técnico legítimo for concluído ou reexecutado THEN o sistema SHALL delegar sua publicação idempotente ao motor.
5. IF a API falhar ou o PR exceder 250 commits THEN o sistema SHALL falhar sem aprovar análise incompleta.

### P1: Projetos e monorepos
1. WHEN project-path for docs e project-type for node THEN o motor SHALL atualizar os manifestos Node de docs sem alterar o package da raiz.
2. WHEN project-path não for informado THEN o sistema SHALL usar a raiz.
3. WHEN config-file for informado THEN o sistema SHALL usar os adaptadores e versões independentes definidos no manifest nativo.
4. IF um Release-As global tiver mais de um alvo THEN o sistema SHALL rejeitar a ambiguidade.
5. WHEN um pacote possuir tag duplicada THEN o sistema SHALL bloquear essa identidade sem confundir tags de outros componentes.
6. WHEN publish-artifacts for false THEN os publicadores do called SHALL permanecer desativados.

### P1: Documentação
1. A documentação SHALL descrever os artefatos, eventos, conflitos, check obrigatório, subdiretórios, manifest e publicação.
2. A documentação SHALL incluir exemplos copiáveis dos cinco pacotes PackagesVue, preservando ui-vuetify 1.1.1 e os demais 0.0.1 como estado inicial observado.
3. O self-caller SHALL atualizar docs/package.json e lockfile pelo motor sem recriar o TXT de homologação.

## Edge Cases
- IF um erro 403 ocorrer THEN o sistema SHALL interromper a validação.
- IF dois componentes usarem a mesma versão numérica THEN o sistema SHALL distinguir suas tags completas.
- IF o caminho apontar para fora do repositório THEN o sistema SHALL rejeitar o diretório.
- IF uma pessoa criar branch com nome do robô THEN o sistema SHALL aplicar a validação de nova entrega.

## Requirement Traceability
| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| RV-01 | Declaração e disponibilidade | Execute | Verified |
| RV-02 | Projetos e monorepos | Execute | Verified |
| RV-03 | Documentação | Execute | Verified |

## Success Criteria
- [x] Suíte completa de TypeScript sem falhas e typecheck aprovado.
- [x] SDK real offline confirma alvo docs e override por pacote.
- [x] Exemplos dos cinco pacotes consistentes com arquivos reais e build VitePress.
- [x] Revisão independente sem bloqueios e artefato local completo.
