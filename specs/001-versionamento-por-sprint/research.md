# Research: Versionamento por sprint

## Decisão: momento de publicar

- **Decision**: PR recebe check de vínculo/homologação conforme fase, sem prévia SemVer
  obrigatória. Changelog provisório é somente guia opcional. A versão definitiva só é
  produzida após o merge homologado na principal.
- **Rationale**: O nome da milestone não é a versão da aplicação; cálculo antecipado
  pode mudar e bloquear indevidamente o PR final.
- **Alternatives considered**: exigir prévia SemVer ou versão nos arquivos da release
  antes do merge contraria a decisão do responsável.

## Decisão: interoperabilidade

- **Decision**: contratos de `workflow_call` separados para check de PR e publicação;
  perfil de ferramenta em enumeração fechada, com comandos explícitos por adaptador.
- **Rationale**: o repositório centraliza a lógica de coordenação, enquanto projetos preservam
  ferramentas de versionamento próprias. Não executar comandos arbitrários vindos do título/PR.
- **Alternatives considered**: impor `standard-version` a todos quebraria Maven/Go/Changesets.

## Decisão: colisões e tag já existente

- **Decision**: serialização por destino, conferência imediata antes da escrita e reconciliação
  idempotente quando a tag existente aponta para o mesmo commit. Divergência exige intervenção
  explícita sem force-push.
- **Rationale**: tags são referências auditáveis; mover uma tag publicada pode comprometer
  consumidores e proveniência.
- **Alternatives considered**: realocação automática sugerida na issue foi rejeitada por risco
  de inconsistência entre consumidores e release publicada.

## Decisão: changelog e proteção

- **Decision**: changelog pré-merge é opcional; `changelog_path` lê o arquivo existente
  no SHA publicável. Alterações de versão Node são geradas pós-merge em PR sujeito a
  checks/revisão; ferramentas derivadas de Git não recebem commit artificial.
  Escrita é restrita ao fluxo pós-merge; gates humanos residem na proteção do consumidor.
- **Rationale**: nem todos os perfis geram o mesmo arquivo, e um workflow não substitui review.
- **Alternatives considered**: sintetizar changelog genérico para todos perderia semântica.

## Decisão: autenticação e validação hospedada

- **Decision**: `prepare-release.sh` executa em processo filho de `publish.sh`; seu
  `unset GH_TOKEN GITHUB_TOKEN` não remove token do pai. Ensaiar criação remota real
  antes de diagnosticar falhas de credencial. Para PR de versão, usar identidade de
  automação que dispare checks/revisões sem contornar a proteção.
- **Rationale**: mock local não cobre permissões, environments e gatilhos GitHub.
- **Alternatives considered**: tratar a linha comentada como correção bloqueante não
  reproduz o comportamento do subprocesso.
