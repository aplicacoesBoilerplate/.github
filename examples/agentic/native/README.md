# Piloto da arquitetura nativa

O próprio `aplicacoesBoilerplate/.github` é o piloto. O caller local é
`.github/workflows/agentic-architecture-pilot.yml`; `caller.yml` mostra adoção em
outro consumidor. Não copiar runtime nem credenciais para o central.

## Preparação no consumidor

1. Manter a secret `API_KEY_OPENROUTER` existente.
2. Criar `AGENTIC_PROJECTS_TOKEN`: leitura do repositório, issues/PRs e do Project
   V2 configurado. O ID esperado é o node ID `PVT_...`, não o número da URL.
3. Criar `AGENTIC_PUBLISH_TOKEN`: contents e pull requests com escrita;
   leitura de issues e Actions do repositório (consulta de Environments). Usar identidade de
   automação dedicada e informar seu login em `AGENTIC_AUTOMATION_ACTOR`.
   Não usar o token pessoal do autor dos eventos como identidade de automação.
4. Criar o Environment `agentic-architecture-approval`, com required reviewers
   humanos e prevenção de autoaprovação. Confirmar suporte do plano/visibilidade.
   Um Environment vazio, criado implicitamente, não autoriza implementar.
5. Definir a variável `AGENTIC_PROJECT_ID`. Nos consumidores externos, definir
   também `AGENTIC_MODELS` com as chaves `triage`, `low`, `medium`, `high`, `ultra`,
   cada uma contendo o ID exato do modelo OpenRouter. O piloto usa
   `nvidia/nemotron-3.5-lightning:free`, cujo preço zero é declarado explicitamente.
6. Publicar/revisar os workflows e registrar o caller na branch padrão para
   disponibilizar o acionamento manual do GitHub. Manter `AGENTIC_ENABLED`
   ausente ou `false` até validar os cenários abaixo.

O token padrão continua somente leitura. Os tokens adicionais são passados
nominalmente pelo caller. O central não recebe credenciais de outro consumidor.
O modelo precisa existir no catálogo de preços AWF; desconhecidos falham sem
substituição silenciosa. Os limites de turnos/tempo são configuráveis por perfil.
Variantes que fazem parte do ID do provedor, como sufixos suportados pelo
OpenRouter, permanecem literais. Aliases inventados `#rapido`/`#ultra` não são
recursos configurados deste MVP; o caller escolhe IDs reais distintos por perfil.

## Cenários de homologação

| Entrada | Resultado a observar |
| --- | --- |
| Issue sem Effort/épica/milestone | needs-human; nenhum worker de escrita |
| Issue completa, low/medium e sem SDD | um PR draft, marcador de entrega e checks relevantes |
| Issue com Effort High/Team, Size M/L/XL ou Release MAJOR | somente PR `.specs/**`, depois espera de aprovação |
| Aprovar a spec no Environment | implementador recebe exatamente o head SHA apresentado no resumo |
| Alterar a spec/base durante a espera | implementação bloqueada; nova execução/aprovação necessárias |
| PR real contra release, mesmo repositório | revisão do head exato; correção somente no PR de origem |
| Push de merge na release com PR associado inequívoco | análise do SHA integrado; correção em novo PR draft |
| Push sem vínculo, fork ou campos conflitantes | needs-human ou recusa explícita; nenhuma publicação |
| Repetir entrada ou evento da identidade de automação | sem PR duplicado e sem recursão |

O piloto manual aceita uma issue real. Um número de PR no acionamento manual
fica em needs-human: atualização do PR depende do evento `pull_request` nativo.
Para o piloto automático, ativar `AGENTIC_ENABLED=true`; issues exigem ainda
label `agentic:run`. Apenas colaboradores com escrita podem iniciar inferência.

Recuperação: após falha/cancelamento da implementação, usar **Re-run failed jobs**
no run original para preservar o pacote de aprovação. Uma execução nova da mesma
entrada não cria outra spec. Se a spec/base mudou, revisar a demanda e iniciar
uma nova execução com nova identidade; nunca reutilizar aprovação antiga.

Os locks são gerados, nunca editados manualmente. Compilar os quatro arquivos
`agentic-route`, `agentic-direct`, `agentic-specify`, `agentic-implement` com o
gh-aw fixado no lock. `actionlint` valida coordenador e caller; isso não comprova
execução de modelo, gate humano ou publicação remota.

O gate de publicação verifica terminal, patch, sinais de credenciais e identidade
atual. Não é análise semântica de segurança nem Quality Gate. As entregas são
draft e continuam exigindo revisão humana. SonarQube permanece `not-run`; manter
o fluxo aprovado após merge em develop, sem simular aprovação nem instalar plugin.

A homologação inicial somente de leitura usa `agentic-triage-homologation.yml`, separado do caller legado gerado. Evidências reais e preparo das operações estão em `.specs/features/agentic-orchestration/pilot.md`. Identidade é vinculada no exporter nativo; saída bruta e decisão normalizada permanecem separadas.
