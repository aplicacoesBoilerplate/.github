# Commitlint Local (Configuração)

Para garantir que os commits sigam o padrão Conventional Commits antes do push, utilizamos o framework `pre-commit` (Python).

Copie os dois arquivos abaixo para a raiz da aplicação:

## 1. `.pre-commit-config.yaml`

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
