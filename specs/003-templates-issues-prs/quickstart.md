# Guia de validação: Templates de issues e PRs

Pré-requisitos: repositório de ensaio na organização sem templates locais, milestone
`v1.0.0` e permissão para criar issues/PRs. Ver [contrato](contracts/templates.md).

Antes da migração, `issueCLI.yml` exige comando, ecossistema e logs; `issuePai.yml` é a
única opção de épica. Após a migração, conferir que as três exigências e a opção única
continuam presentes, comparando com a versão anterior no diff.

1. Abrir cada formulário (épica, release, feature, task, hotfix); tentar enviar vazio.
   **Esperado**: campos necessários exigidos; títulos e escala condizentes com o tipo.
2. Criar épica com milestone `v1.0.0` e feature vinculada. **Esperado**: somente épica tem
   orientação de Estimate 10; feature orienta valor 1–5, vínculo, contexto e premissas.
3. Criar hotfix e release não épica. **Esperado**: 6 para hotfix e 7/8/9 por classe de
   release; os respectivos valores de Issue Fields/Project são preenchidos manualmente.
4. Criar bug da CLI pelo piloto e preencher comando, ecossistema e logs. **Esperado**:
   exigências preservadas. Confirmar que só há uma opção de épica.
5. Abrir PR ligado à issue. **Esperado**: quatro seções de relatório e checklist de
   metadados/revisão; conteúdo do PR reflete o destino da branch.
   Em PR intermediário, usar referência sem fechamento; no PR destinado à branch padrão,
   usar palavra-chave de fechamento apenas se a issue realmente deva ser encerrada.
6. Repetir em repo sem Project e com pasta local de templates, separadamente. **Esperado**:
   no primeiro caso criação disponível sem associação falsa e com instruções manuais; no
   segundo, defaults da pasta inteira substituídos pelos formulários locais.
