# Context: entrega integrada LLM, triagem e review

**Gathered:** 2026-10-15. **Status:** Especificação/contexto/design aprovados pelo mantenedor; tasks em revisão. **Spec:** spec.md.

## Feature Boundary

Implementar code review da #8 sobre a central #9 e os componentes da triagem #7; homologar as três no demo-repository. Não encerrar o piloto da triagem como se já tivesse sido realizado.

## Implementation Decisions

- O mantenedor escolheu demo-repository e solicitou configurações apenas nele.
- A central pública distribui lógica, contratos e diretrizes globais genéricas; não recebe configuração particular ou credenciais persistentes do piloto.
- Branch/worktree próprios e PRs empilhados são mantidos. A branch #8 recebeu #7 por merge local não destrutivo, preservando o commit antigo de planejamento. Nenhum push ou merge de PR remoto.
- Implementação sequencial; testes só por contrato/falha relevante e sem metas quantitativas. Documentação extensa adiada; instruções completas no caller permanecem.
- SonarQube permanece corretivo após merge em develop, independente deste MVP de review.

## Declined / Undiscussed Gray Areas → Assumptions

- Propostos na spec: review com origem confiável na branch padrão; encadeamento explícito após triagem; aceitar seus drafts e bloquear recursão apenas dos complementares; achados estruturados com referências validadas; limites compatíveis com a central.
- Esses defaults foram aprovados pelo mantenedor após a revisão escrita da especificação em 2026-10-15. Design e tasks ainda precisam dos respectivos gates, conforme TLC.
- Criar/habilitar workflows no consumidor, publicar pins centrais e executar LLM real exigem autorização específica e provisionamento de sessão dedicada. Nenhuma credencial pessoal será descoberta ou reutilizada automaticamente.

## Deferred Ideas

Harness, review de forks/públicos, aprovação automática e documentação extensa ficam fora deste MVP.
