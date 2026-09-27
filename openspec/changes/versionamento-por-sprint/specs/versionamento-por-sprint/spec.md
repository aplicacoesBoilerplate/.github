# Spec Delta

## Purpose

Permitir que repositórios consumidores validem entregas e homologações sem versionamento antecipado e publiquem versões rastreáveis após a integração aprovada. Este delta deve ser lido com `corrigir-versionamento-pos-merge`, que substitui o contrato anterior de prévia SemVer.

## ADDED Requirements

### Requirement: Check contextual sem efeitos de publicação
A solução MUST disponibilizar uma chamada reutilizável de leitura para PRs feature → release, release → develop e develop → principal, retornando `phase` e `summary` sem calcular versão candidata, criar tags/releases ou modificar arquivos do consumidor.

#### Scenario: PR válido para branch de release
- **WHEN** um PR de entrega para `release/<milestone>` tem metadados e commits interpretáveis
- **THEN** o consumidor recebe um check de vínculo à sub-issue e sprint, e nenhuma versão definitiva é publicada

#### Scenario: Integração por develop
- **WHEN** a release é integrada a `develop` e depois `develop` à principal com os gates exigidos
- **THEN** cada transição recebe seu check contextual e nenhuma tag ou release é criada pelo check

#### Scenario: Metadados ou commits inválidos
- **WHEN** faltam metadados mínimos de sprint/issue, revisão ou homologação da transição
- **THEN** o check falha com diagnóstico acionável e não publica artefatos

### Requirement: Adaptação por perfil do consumidor
A solução MUST aceitar explicitamente os perfis `standard-version`, `changesets`, `jgitver` e `go-gitsemver`, respeitando a ferramenta e a convenção de versão configuradas pelo consumidor. MUST recusar perfil desconhecido ou ferramenta necessária ausente com diagnóstico, sem executar comandos arbitrários recebidos do PR.

#### Scenario: Perfis suportados
- **WHEN** o consumidor seleciona um dos quatro perfis e fornece a configuração necessária
- **THEN** o check valida a transição e a publicação pós-merge usa o cálculo nativo desse perfil; a primeira liberação ativa apenas `go-gitsemver`

#### Scenario: Perfil inválido ou ferramenta indisponível
- **WHEN** o perfil não é suportado ou falta a ferramenta necessária no consumidor
- **THEN** a operação é bloqueada com indicação do ajuste necessário, sem publicar tag ou release

### Requirement: Publicação condicionada à integração aprovada
A solução MUST disponibilizar uma chamada reutilizável de publicação separada do check, utilizável somente após o merge de `develop` na principal e após conclusão da sprint, revisão humana e homologação exigidas pelo consumidor. MUST vincular versão, tag, `published_sha` e release ao commit publicável e incluir changelog quando o perfil do consumidor o produzir. A versão da sprint MUST NOT substituir a versão do consumidor.

#### Scenario: Release aprovada e integrada
- **WHEN** a sprint está concluída, `release → develop` e `develop → principal` foram revisados/homologados e o commit está integrado na branch de publicação
- **THEN** são publicados versão, tag e release correspondentes ao commit integrado, com changelog quando disponível

#### Scenario: Aprovação ou homologação pendente
- **WHEN** uma publicação é solicitada sem aprovação humana ou sem homologação concluída
- **THEN** a publicação é bloqueada com motivo explícito e sem tag/release novos

#### Scenario: Chamada antes do merge ou em branch incorreta
- **WHEN** a chamada de publicação ocorre no contexto de PR ou em destino diferente da branch configurada
- **THEN** a operação falha sem publicar nem modificar tags

### Requirement: Reconciliação sem perda de histórico
A publicação MUST detectar colisões entre execuções, preservar tags existentes e reconhecer reexecução no mesmo commit, inclusive após uma versão posterior, sem duplicar release. MUST expor `published_sha`, resultados (`published`, `already-published` ou `conflict`) e diagnóstico verificável para falha parcial ou divergência entre versão, tag e release. Somente HTTP 404 indica ausência de recurso.

#### Scenario: Publicações concorrentes para a mesma versão
- **WHEN** duas execuções tentam publicar a mesma versão
- **THEN** no máximo uma a publica e a outra reconcilia o mesmo commit ou informa conflito sem mover a tag

#### Scenario: Reexecução após publicação íntegra
- **WHEN** a tag e a release já representam a mesma versão e o mesmo commit integrado
- **THEN** a execução retorna `already-published` com referência aos artefatos existentes sem duplicá-los

#### Scenario: Tag apontando para outro commit
- **WHEN** a tag da versão já aponta para commit diferente
- **THEN** a operação retorna conflito e preserva tag e release existentes para reconciliação explícita

#### Scenario: Publicação parcialmente concluída
- **WHEN** a tag, a release ou a versão do projeto não concordam após uma falha
- **THEN** a operação informa a inconsistência observada e o procedimento de recuperação sem sobrescrever referências publicadas

### Requirement: Contrato de consumo verificável
A solução MUST documentar entradas, saídas, permissões e exemplo mínimo de chamada para cada perfil; prévias MUST usar somente leitura e publicação MUST requerer permissão de escrita apenas no fluxo pós-integração. Callers MUST utilizar referência estável revisada para os workflows reutilizáveis.

#### Scenario: Integração de um novo consumidor
- **WHEN** um mantenedor configura um caller usando um dos perfis documentados
- **THEN** encontra entradas obrigatórias, saídas, permissões, gates do consumidor e exemplo com referência estável necessários para testar prévia e publicação
