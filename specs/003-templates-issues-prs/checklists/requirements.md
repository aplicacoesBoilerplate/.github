# Specification Quality Checklist: Templates de issues e PRs

**Purpose**: Validar completude antes do planejamento
**Created**: 2026-09-23
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] Sem detalhes de implementação na especificação
- [x] Foco em valor e necessidades do consumidor
- [x] Linguagem compreensível para interessados
- [x] Todas as seções obrigatórias preenchidas

## Requirement Completeness

- [x] Sem marcadores de esclarecimento pendentes
- [x] Requisitos testáveis e inequívocos
- [x] Critérios de sucesso mensuráveis e independentes de tecnologia
- [x] Cenários de aceitação e casos extremos definidos
- [x] Escopo, dependências e premissas explícitos

## Feature Readiness

- [x] Requisitos cobertos por critérios de aceitação
- [x] Jornadas principais independentes e priorizadas
- [x] Resultados verificáveis sem conhecer a implementação

## Notes

- Premissa crítica: `type`/`projects` são chaves válidas em Issue Forms, mas não alteram
  valores de Issue Fields/Project Fields. Valores externos requerem preenchimento manual
  nesta entrega; eventual automação terá contrato próprio e opt-in.
