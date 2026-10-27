# Evidências da melhoria documental

## D1: configuração Commitlint

Concluída em 2026-10-27, partindo da master 9884bd9. O guia mostra o objeto CJS completo antes do YAML e explica os dois caminhos de criação.

Gate executado com Node 24.19.0 e Commitlint 17.4.4 instalados:

- Extração dos blocos Markdown confirmou a ordem `js`, `yaml`.
- Objeto CJS avaliado em VM igual ao exportado por `config/commitlint/commitlint.config.cjs`.
- YAML parseado igual ao `.pre-commit-config.yaml` real, incluindo o caminho de `--config`.
- `docs: completar configuração local`: exit 0.
- `invalid: testar regra de tipo`: exit 1, regra `type-enum`.
- `git diff --check` aprovado. Nenhum teste existente alterado ou novo teste permanente criado.

## D2: largura do conteúdo

Baseline medida no navegador antes da alteração: conteúdo limitado a 688 px em viewports de 1440 e 1920 px; em 960 px, 544,8 px. Inspeção do tema VitePress 1.6.4 confirmou teto de largura, padding duplicado e margem externa da grade de 1440 px. Implementação e gate pendentes.
