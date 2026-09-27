# Research: Templates de issues e PRs

## Decisão: formulários versus metadados externos

- **Decision**: `name`, `description` e `body` obrigatórios; `title`, `labels`, `type`
  e `projects` são suportados no nível superior. Aplicar `type` organizacional verificável;
  não fixar `projects` para toda a organização: adição exige permissão de escrita e o
  Project #6 não representa necessariamente os outros repositórios. Parent, milestone,
  Issue Fields e valores de Project exigem edição separada nesta entrega.
- **Rationale**: `release: "MAJOR"` no piloto `issuePai.yml` não é chave válida; `type`
  consegue atribuir Issue Type, mas não valores de Issue Fields.
- **Alternatives considered**: YAML com campos arbitrários mascararia falhas silenciosas.

## Decisão: migração dos pilotos

- **Decision**: manter `issueCLI.yml` (bug da CLI) e migrar `issuePai.yml` para o único
  template de épica, com conteúdo válido e escala explicitada.
- **Rationale**: preserva fluxo existente e evita duplicar opção de épica.
- **Alternatives considered**: excluir pilotos perderia dados que já solicitam.

## Decisão: escala e relações

- **Decision**: Size reflete valor, não dificuldade. Estimate 0 homologação; 1–5 conforme
  valor de features; 6 somente hotfix; 7 PATCH, 8 MINOR, 9 MAJOR e 10 só para épica.
- **Rationale**: mapeamento vem da issue #4; release não épica não herda 10.
- **Alternatives considered**: um único default de Estimate para todos gera Project incorreto.

## Decisão: escopo organizacional

- **Decision**: documentar adoção automática onde GitHub suportar defaults da organização,
  e instalação/cópia quando consumidor já tem arquivos locais ou precisar customização.
- **Rationale**: uma pasta local válida substitui todos os defaults de issue forms; workflows
  não são herdados do repositório `.github` e exigem integração explícita.
- **Alternatives considered**: afirmar herança universal seria enganoso.

## Fontes oficiais e verificação do repositório

- [Sintaxe dos issue forms](https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/syntax-for-issue-forms): `type`, `projects`, `labels`, `title` e a exigência de `body`.
- [Defaults de community health files](https://docs.github.com/en/communities/setting-up-your-project-for-healthy-contributions/creating-a-default-community-health-file): uma pasta de templates local válida substitui todos os defaults da pasta.
- `gh repo view ModulosTestesAutomatizados/.github --json visibility,defaultBranchRef`: público, branch `master`.
- Org apresenta Issue Types `Release`, `Feature`, `Task`, `Hotfix`, `Bug` e Issue Fields distintos dos campos do Project `GitHub Features` (#6).
