# Desenho da infraestrutura documental

## Architecture Overview

Um VitePress por consumidor e um único workflow central de build/Pages. O called recebe docs-dir, install-dir opcional, build-script e npm-version. Os defaults mantêm docs:build dentro de docs/. Vue informa raiz, build e npm10.9.4; Java usa projeto docs/ isolado. Preservar guard master/PR e as permissões atuais.

## Approaches

| Approach | Trade-off | Decision |
| --- | --- | --- |
| Ampliar minimamente o called e reaproveitar VitePress/catálogos | Quatro inputs, sem copiar build/deploy nos apps | Selecionado |
| Copiar workflow completo por app | Divergência e manutenção duplicada | Rejeitado |
| Criar pacote/framework documental compartilhado agora | Introduz distribuição e API de template fora do pedido imediato | Adiado |

## Components

- Central: npm instalado na versão solicitada em runner.temp antes de acessar devEngines; npm ci/build no install-dir; saída em docs-dir/.vitepress/dist. Sem cache npm antecipado.
- Java: docs/package.json privado/lock, versão sincronizada pelo extra-files nativo. Dados de build conferem manifest/documentação, páginas de parent/BOM/core/starter e guias reais. Sem fonte Java nova.
- Vue: páginas manuais fora de generated/, cabeçalho de versão por pacote com dados lidos em build; preservar o gerador e os previews atuais para evitar conflito com features não integradas. Build raiz produz manifests antes do app docs.
- Callers: config-file/manifest-file/project-path, validação de versão em PR, CI de leitura antes da publicação pós-merge e SHA central idêntico. Documentação usa o mesmo contrato central Pages, sem secrets herdados.

## Risks & Concerns

| Concern | Mitigation |
| --- | --- |
| Catálogo vazio em checkout limpo | Build completo e gate sobre HTML/manifests reais. |
| Turbo filtra contexto ou reaproveita versão documental antiga | Env base/SHA e inputs dos manifests/config apenas em docs#build; guard CI e auditor HTML real. |
| npm bundled viola devEngines | Pin em runner.temp antes de comandos npm no projeto. |
| Versão candidata confundida com pacote distribuído | Rótulo versão do código; registry desligado. |
| Geração sobrescreve prosa | Páginas locais fora de generated/. |
| Pages ainda não habilitado ou falta merge | Preflight e evidência explícita; não contornar autoridade humana. |

## Tech Decisions

Preservar VitePress1.6.4 usado pelo Vue. Java recebe a mesma versão travada. Usar loaders TS nativos e versões mantidas pelo Release Please; não usar jgitver ou parser/bump próprios. A publicação real depende da configuração Pages e dos merges reservados ao usuário.
