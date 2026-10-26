# Commitlint, documentação e CI

## Problem Statement

A validação de mensagens completas de commit ainda não tem um teste executado pelo CI. A documentação VitePress apresenta espaços e quebras de linha desproporcionais, sobretudo na página inicial e entre seções internas.

## Goals

- [ ] Demonstrar com um único teste TS que uma mensagem completa sem cabeçalho Conventional Commits é bloqueada e outra, com cabeçalho válido, é aceita.
- [ ] Melhorar a hierarquia visual e o uso do espaço no VitePress sem alterar o conteúdo editorial.
- [ ] Executar a suíte TS no workflow de CI em pull requests e pushes configurados.

## Out of Scope

| Feature | Reason |
| --- | --- |
| Novos cenários de commit | O pedido limita o teste a uma entrada inválida e uma válida. |
| Reescrever as páginas | O problema relatado é visual. |

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Ferramenta de validação | Executar o CLI Commitlint com a configuração já existente | Exercita a mesma regra do hook de commit. | n |
| Alcance visual | Tema padrão com CSS responsivo para home e páginas internas | Preserva o conteúdo e a navegação atuais. | n |

**Open questions:** none - all resolved or logged above.

## User Stories

### P1: Validar mensagens completas de commit

**User Story**: Como mantenedor, quero evidência de que o Commitlint barra uma mensagem inválida e libera uma válida para confiar no versionamento automático.

**Why P1**: É o comportamento explícito pedido para o novo teste.

**Acceptance Criteria**:

1. WHEN a mensagem com cabeçalho não convencional, corpo e rodapé for avaliada THEN o teste SHALL observar saída 1 e erro `type-empty`.
2. WHEN a mensagem com cabeçalho Conventional Commits, corpo e rodapé for avaliada THEN o teste SHALL observar saída 0.

**Independent Test**: Executar o novo teste TS contra o CLI e a configuração reais.

### P1: Corrigir a apresentação da documentação

**User Story**: Como leitor, quero páginas proporcionais e alinhadas para localizar o conteúdo com facilidade.

**Why P1**: É o segundo artefato solicitado.

**Acceptance Criteria**:

1. WHEN a home for aberta em largura intermediária THEN o tema SHALL apresentar o título e os cartões sem sobreposição ou transbordamento horizontal.
2. WHEN uma página interna contiver uma linha horizontal antes de um título de seção THEN o tema SHALL apresentar apenas um separador visual naquele ponto.

**Independent Test**: Inspeção visual da home e de uma página interna, seguida de build VitePress.

### P2: Acionar os testes no CI

**User Story**: Como mantenedor, quero que os testes sejam executados automaticamente nas alterações para detectar regressões.

**Why P2**: O pedido condiciona essa adição ao resultado das correções.

**Acceptance Criteria**:

1. WHEN o workflow CI for acionado por pull request ou push configurado THEN o job SHALL instalar as dependências da raiz e de `ci-scripts` e executar `npm test` em `ci-scripts`.

**Independent Test**: Validar o YAML e reproduzir localmente os comandos do job.

## Edge Cases

- IF a configuração do Commitlint não puder carregar THEN o teste SHALL falhar sem confundir isso com o bloqueio da mensagem inválida.

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| CC-01 | P1: Validar mensagens completas de commit | Execute | Implementing |
| CC-02 | P1: Validar mensagens completas de commit | Execute | Implementing |
| DOC-01 | P1: Corrigir a apresentação da documentação | Execute | Implementing |
| DOC-02 | P1: Corrigir a apresentação da documentação | Execute | Implementing |
| CI-01 | P2: Acionar os testes no CI | Execute | Implementing |

**Coverage:** 5 total, 5 mapped to implementation, 0 unmapped.

## Success Criteria

- [ ] Suíte TS completa, verificação de tipos e build VitePress terminam com código 0.
- [ ] Revisão independente confirma os critérios de aceite.
