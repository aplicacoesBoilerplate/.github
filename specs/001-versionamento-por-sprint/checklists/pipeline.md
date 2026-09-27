# Pipeline Checklist: Versionamento por sprint

**Purpose**: Revisão da qualidade dos requisitos de integração, homologação e publicação pós-merge
**Created**: 2026-09-24
**Feature**: [spec.md](../spec.md)

**Review Ownership**: Este checklist é do revisor; `[x]` indica que o critério de qualidade dos requisitos foi avaliado e satisfeito, não que a implementação foi concluída.

## Requirement Completeness

- [ ] CHK001 Os critérios de vínculo entre feature, sub-issue, épica e milestone estão definidos para cada transição? [Completude, Spec §FR-001–FR-003]
- [ ] CHK002 Os critérios exigidos para considerar a homologação concluída distinguem evidência documental de aprovação humana? [Clareza, Spec §FR-003]
- [ ] CHK003 Está especificado o estado do fluxo quando o PR funcional já integrou mas o PR de versionamento aguarda revisão? [Completude, Spec §FR-006]
- [ ] CHK004 Está explícito se o changelog opcional ausente ou inválido pode impedir publicação? [Clareza, Spec §FR-004/FR-007]

## Requirement Consistency

- [ ] CHK005 A exigência de versão definitiva pós-merge é coerente com o guia provisório na homologação? [Consistência, Spec §FR-004–FR-006]
- [ ] CHK006 As condições de review do PR de integração e do PR de versionamento são diferenciadas sem contornar proteção da principal? [Consistência, Spec §FR-003/FR-006]
- [ ] CHK007 A versão independente da milestone é compatível com tags de projetos diferentes no mesmo laboratório? [Consistência, Spec §FR-005/FR-009]

## Scenario & Edge Case Coverage

- [ ] CHK008 Há critério claro para novo merge na principal antes do fechamento do PR versionado? [Cobertura, Spec §FR-006]
- [ ] CHK009 Estão especificadas as respostas para tag existente em SHA divergente, release sem tag e tag sem release? [Cobertura, Spec §FR-008]
- [ ] CHK010 O contrato cobre explicitamente PR de versionamento sem origem confiável ou com alterações além dos arquivos de versão? [Cobertura, Spec §FR-006/FR-008]
- [ ] CHK011 O comportamento de versões derivadas do Git, inclusive prerelease, é verificável sem impor alterações artificiais? [Clareza, Spec §FR-005–FR-007]

## Acceptance & Dependencies

- [ ] CHK012 Os quatro perfis e os três tipos de PR têm critérios observáveis de sucesso e rejeição? [Mensurabilidade, Spec §SC-001–SC-004]
- [ ] CHK013 Estão explicitadas as dependências externas para CI do consumidor, proteção da branch, revisão e ambiente protegido? [Dependências, Spec §FR-009]

## Notes

- Itens são perguntas sobre a especificação, não casos de teste de implementação.
- `/speckit.implement` lê o estado deste checklist e não altera marcadores; cabe ao revisor avaliar cada item.
