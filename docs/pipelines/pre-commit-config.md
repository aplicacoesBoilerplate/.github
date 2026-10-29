# Commitlint Local (Configuração)

Para garantir que os commits sigam o padrão Conventional Commits antes do push, utilizamos o framework `pre-commit` (Python).

Crie os dois arquivos abaixo nos caminhos indicados, relativos à raiz da aplicação.

## 1. `.pre-commit-config.yaml`

Crie este arquivo na raiz da aplicação:

```yaml
repos:
  # Validador universal de Conventional Commits (para a mensagem do commit)
  - repo: https://github.com/alessandrojcm/commitlint-pre-commit-hook
    rev: v9.5.0
    hooks:
      - id: commitlint
        stages: [commit-msg]
        additional_dependencies: ['@commitlint/config-conventional@17.4.4']
        entry: commitlint --config config/commitlint/commitlint.config.cjs --edit

  # Boas práticas universais de arquivos
  - repo: https://github.com/pre-commit/pre-commit-hooks
    rev: v4.6.0
    hooks:
      - id: trailing-whitespace     # Remove espaços em branco no final das linhas
        stages: [pre-commit]
      - id: end-of-file-fixer       # Garante que o arquivo termine com uma linha em branco
        stages: [pre-commit]
      - id: check-yaml              # Valida a sintaxe de arquivos YAML
        stages: [pre-commit]
      - id: check-added-large-files # Impede o commit acidental de arquivos pesados (>500kb)
        stages: [pre-commit]
        args: ['--maxkb=500']
```

## 2. `config/commitlint/commitlint.config.cjs`

Crie a pasta `config/commitlint/` e adicione o arquivo `commitlint.config.cjs` com o seguinte conteúdo:

```js
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      ['feat', 'fix', 'docs', 'style', 'refactor', 'perf', 'test', 'build', 'ci', 'chore', 'revert'],
    ],
    'subject-case': [0],
    'subject-full-stop': [2, 'never', '.'],
    'header-max-length': [2, 'always', 120],
    'body-max-line-length': [2, 'always', 300],
    'footer-max-line-length': [2, 'always', 50],
  },
};
```

A configuração estende `@commitlint/config-conventional` e aplica as mesmas regras deste repositório: tipos de commit permitidos, assunto sem ponto final e limites de tamanho para título, corpo e rodapé. O hook acima instala a dependência no ambiente isolado do `pre-commit` e carrega este arquivo pelo caminho informado em `--config`.

## Ativar e conferir

Depois de criar os dois arquivos, siga o [setup dos hooks](/pipelines/pre-commit-setup). Apenas copiar o YAML não instala os hooks no clone local.
