# Checklist de qualidade dos requisitos: Templates compartilhados

**Purpose**: Revisão dos requisitos de formulários, escala, herança e metadados antes da implementação.
**Created**: 2026-09-24
**Feature**: [spec.md](../spec.md)

Checklist do revisor: `[x]` indica aprovação da qualidade do requisito, não conclusão da implementação. Os itens novos permanecem em aberto até a revisão.

## Completude

- [ ] CHK001 Os requisitos distinguem claramente épica e release não épica com mesmo Issue Type? [Completeness, Spec §FR-001/FR-003]
- [ ] CHK002 Os campos essenciais e justificativa da obrigatoriedade estão definidos para cada tipo, inclusive bug da CLI? [Completeness, Spec §FR-002/FR-008]
- [ ] CHK003 O contrato do PR exige vínculo, evidências, procedimento de teste e as quatro seções do relatório? [Completeness, Spec §FR-006]

## Clareza e consistência

- [ ] CHK004 A escala de Size e Estimate diferencia valor agregado de esforço e define inequivocamente o 0 e os valores 1–10? [Clarity, Spec §FR-004]
- [ ] CHK005 O título da épica corresponde à milestone e o prefixo das sub-issues corresponde ao label escolhido, e não necessariamente ao Issue Type? [Consistency, Spec §FR-003/FR-005]
- [ ] CHK006 Os requisitos não tratam `type`/`projects` como indisponíveis, nem confundem campos de Issue, Project e milestone? [Consistency, Spec §FR-007]

## Critérios e cenários

- [ ] CHK007 Os critérios de sucesso permitem avaliar independentemente as cinco jornadas de issue e a jornada do PR? [Acceptance Criteria, Spec §SC-001/SC-003]
- [ ] CHK008 Há cenários para ausência de Project/permissões, repositório com pasta local e opção de label/tipo não compartilhada? [Coverage, Spec §Edge Cases/FR-008]
- [ ] CHK009 Está especificado quando um PR fecha a issue e quando deve apenas referenciá-la? [Clarity, Spec §FR-006]

## Dependências e suposições

- [ ] CHK010 A herança da organização e sua precedência sobre templates locais estão descritas sem prometer execução automática de workflows? [Assumption, Spec §FR-008]
- [ ] CHK011 A complementação manual dos campos não nativos é verificável e não presume um Project global? [Measurability, Spec §FR-007]

## Notes

- Revisão de qualidade da redação dos requisitos; o guia [quickstart.md](../quickstart.md) contém os passos para testar o comportamento após a implementação.
