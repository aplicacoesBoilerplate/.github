# Contexto da arquitetura Agentic

**Data:** 2026-10-28. **Issue inicial:** #7, triagem. **Estado:** especificação para revisão; implementação não iniciada.

## Decisões do usuário

- OpenCode será o harness, com GitHub Agentic Workflows nativo: Markdown/frontmatter, imports e gh aw compile.
- TypeScript não é requisito da arquitetura. Scripts adicionais precisam de necessidade concreta demonstrada, sem recriar o roteador/execução oferecidos pelo gh-aw.
- Entrada reutilizável para issues, pull requests e push; correções automáticas desejadas nos três eventos.
- Perfis DRY low/medium/high/ultra; modelos, variantes e credenciais configuráveis pelo consumidor.
- Triagem considera metadados reais: labels, tipo, Size, Estimate, Effort, Projects V2, milestone, épica e dependências.
- Fluxo complexo gera SDD antes de implementar e exige aprovação humana.
- Exemplos de arquivos, YAMLs e modelos enviados pelo usuário exprimem intenção, não implementação obrigatória.
- Iterações e PRs anteriores podem ser substituídos pelo novo modelo. Histórico e alterações locais anteriores permanecem preservados até migração validada.
- Branch: feature/agentics-workflows-architecture, base release/v1.0.0, commit6020169c2248519bb3f7ebf4d44ca56fa73e0f35.

## Limites preservados

- Caller fornece credenciais; o catálogo público não disponibiliza uma conta compartilhada.
- Size/Estimate representam valor, Effort representa esforço; tier de inferência não dispensa SDD obrigatório.
- Entregas por PR e Git Flow; autonomia para correção não autoriza autoaprovação ou merge.
- Sonar em PR é extensão condicionada à compatibilidade do servidor/plugin. Não substitui revisão da LLM nem o fluxo corretivo pós-merge em develop, que bloqueia master e cria Hotfix On hold na mesma milestone mantendo épica Done.
- Testes relevantes para contratos/falhas; sem metas de contagem ou testes de documentação.

## Referências e estado conhecido

- Diagrama anexado pelo usuário e https://miro.com/app/board/uXjVEUPxYIg=/ . Board não acessível pela ferramenta web; imagem usada como referência.
- Piloto antigo: OpenCode2.0.26, gh-aw0.93.5 e AWF. Último run40423581789 recebeu resposta, mas falhou por ausência de terminal; não considerar homologado.
- A branch da documentação antiga contém alterações locais fora desta árvore; nenhuma foi descartada ou transferida implicitamente.
- Design deverá provar reuso entre repositórios, passagem de secrets, acesso Projects V2, transporte de variantes e gate anterior à implementação. Restrições de Environment em repositórios privados exigem alternativa suportada quando necessário.
