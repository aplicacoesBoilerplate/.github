# Status das especificações

O campo **Status** de cada `spec.md` espelha o item da issue correspondente no
[Project GitHub Features](https://github.com/orgs/ModulosTestesAutomatizados/projects/6).
O Project é a fonte de verdade: após uma transição, atualize a spec para refletir o valor
observado, sem usar `Draft` como status paralelo.

Ordem das opções configuradas no campo `Status` do Project:

1. Backlog
2. On hold
3. In progress
4. In review
5. Request changes
6. Reopened
7. Ready
8. Done
9. Cancelled

Essa é a **ordem de exibição** no Project, não uma exigência de passar por todos os estados.
`On hold`, `Request changes`, `Reopened` e `Cancelled` dependem do evento ocorrido; `Ready`
deve manter o significado configurado nos workflows do Project. O histórico e os metadados
da issue não são substituídos pelo campo resumido na especificação.

| Feature | Issue |
| --- | --- |
| Versionamento por sprint (spec na branch `feature/issue-2`) | [#2](https://github.com/ModulosTestesAutomatizados/.github/issues/2) |
| [Revisão SonarQube em PRs](002-revisao-sonarqube-pr/spec.md) | [#3](https://github.com/ModulosTestesAutomatizados/.github/issues/3) |
| [Templates de issues e PRs](003-templates-issues-prs/spec.md) | [#4](https://github.com/ModulosTestesAutomatizados/.github/issues/4) |
