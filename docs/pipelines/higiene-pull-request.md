# Higiene de Pull Requests (`pull-request-hygiene.yml`)

Para garantir um histórico de repositório limpo e o funcionamento correto do nosso versionamento semântico, todos os PRs passam por uma validação estrita no servidor.

A pipeline `pull-request-hygiene.yml` valida automaticamente se o título de todo Pull Request aberto, editado ou sincronizado respeita a especificação **Conventional Commits**[cite: 3].

## Regras aplicadas

- **Prefixos aceitos:** `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `ci`, `build`, `perf`, `revert`[cite: 3].
- **Exemplo de título válido:** `feat(api): add customer endpoint`[cite: 3].

Se o título não estiver no padrão, o GitHub Actions falhará e impedirá o merge até que o desenvolvedor ajuste o título do PR.
