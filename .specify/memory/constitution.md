# Constituição do repositório .github

## Core Principles

### I. Reutilização como finalidade

Este repositório DEVE concentrar convenções e recursos GitHub que possam ser compartilhados
entre projetos, especialmente templates de issues e pull requests e workflows reutilizáveis.
Uma nova automação DEVE ter uma responsabilidade definida, um caso de consumo identificável e
uma interface menor para os repositórios consumidores do que a lógica centralizada. Lógica
específica de um único produto só DEVE entrar aqui quando houver uma justificativa explícita
para seu compartilhamento; evitar duplicação é a razão de existir deste repositório.

### II. Contratos explícitos e compatibilidade

Workflows chamados por outros repositórios DEVEM expor e documentar seus gatilhos de reuso,
entradas, saídas, secrets, permissões exigidas e comportamento em caso de falha. Repositórios
consumidores DEVEM poder escolher uma referência estável do workflow, sem depender de mudanças
não revisadas na branch de desenvolvimento. Mudanças incompatíveis no contrato DEVEM incluir
uma estratégia de migração e uma referência nova, preservando a referência anterior enquanto
existirem consumidores que dela dependam. Parâmetros específicos de um consumidor DEVEM ser
fornecidos pela chamada, sem copiar o corpo do pipeline.

### III. Templates úteis e acessíveis

Templates de issues e pull requests DEVEM solicitar apenas dados que ajudem a triagem, a
execução ou a revisão, com instruções claras e campos obrigatórios justificados. Templates
compartilhados DEVEM evitar rótulos, responsáveis, campos ou fluxos particulares de um único
projeto quando não forem configuráveis ou aplicáveis aos consumidores previstos. Novos formatos
DEVEM complementar os existentes por finalidade, sem criar opções indistinguíveis. A adoção
pelos demais repositórios DEVE ser documentada conforme o mecanismo real do GitHub: convenções
herdadas pela organização e artefatos referenciados ou copiados explicitamente não são a mesma
coisa.

### IV. Segurança por padrão

Workflows DEVEM declarar permissões mínimas do `GITHUB_TOKEN` e receber secrets apenas quando
necessários; credenciais NÃO DEVEM ser registradas em logs, exemplos ou arquivos versionados.
Automações que recebem código, artefatos ou dados externos DEVEM tratar essa entrada como não
confiável, sobretudo quando também dispuserem de permissões de escrita ou secrets. Versões de
actions e de dependências externas DEVEM ser fixadas em referências revisáveis e atualizadas
deliberadamente. O reuso entre repositórios não pode ampliar privilégios por conveniência.

### V. Validação e documentação do consumo

Cada recurso compartilhado DEVE ter instruções de uso, exemplo mínimo de integração e indicação
das condições necessárias para funcionar. Alterações DEVEM validar a sintaxe e o comportamento
afetado; mudanças em workflows DEVEM verificar também a interface de chamada e, quando viável,
um cenário representativo de consumo. Alterações em templates DEVEM verificar legibilidade,
campos e experiência de preenchimento. A revisão DEVE identificar consumidores potencialmente
afetados e registrar migração ou limitações conhecidas antes da publicação.

## Escopo e limites

- O repositório hospeda recursos compartilháveis de colaboração e automação GitHub. A
  existência de um arquivo aqui NÃO implica que ele seja aplicado automaticamente a todos os
  projetos: cada recurso DEVE declarar onde vive, como é disponibilizado e como é adotado.
- Workflows reutilizáveis DEVEM permanecer parametrizáveis e coesos; a CI do consumidor DEVE
  conter apenas os gatilhos, parâmetros, permissões e etapas específicas daquele projeto.
- OpenSpec e SpecKit apoiam a especificação das mudanças. A constituição fixa princípios
  duradouros; especificações de recursos DEVEM detalhar comportamentos e critérios verificáveis
  sem contradizê-la. Não duplicar a mesma decisão em dois documentos sem uma referência clara.
- Mudanças genéricas que também beneficiem o repositório `upstream` PODEM ser propostas por PR,
  após separar configurações locais da melhoria reaproveitável e respeitar a licença e a
  atribuição do projeto de origem.

## Fluxo de evolução e revisão

1. Descrever o público consumidor e o problema de repetição ou padronização que a mudança
   resolve; para novos comportamentos, definir contratos e critérios de aceitação antes de
   implementar.
2. Revisar se o recurso pertence a este repositório, como será descoberto e adotado, e quais
   integrações existentes poderão ser afetadas.
3. Implementar a menor interface reutilizável possível; documentar a chamada ou o preenchimento
   do template e executar as validações pertinentes ao tipo de arquivo alterado.
4. Na revisão do PR, conferir compatibilidade, permissões, instruções de adoção, evidências de
   validação e, se houver ruptura, plano de migração e referências para os consumidores.

## Governance

Esta constituição prevalece sobre orientações locais conflitantes para mudanças neste
repositório. Exceções DEVEM ser justificadas no plano ou PR, com impacto, prazo ou condição
de revisão e aprovação dos mantenedores. Emendas DEVEM ser propostas em PR com motivação,
resumo das regras alteradas e análise de impacto nos recursos e consumidores existentes;
os revisores DEVEM verificar a conformidade antes da integração.

A versão desta constituição segue SemVer: MAJOR para remoção ou redefinição incompatível de
princípios, MINOR para princípio novo ou ampliação material de regras e PATCH para ajustes sem
mudança normativa. Essa versão governa o documento; referências de workflows e outros recursos
compartilhados possuem compatibilidade própria e não são alteradas automaticamente por ela.

**Version**: 1.0.0 | **Ratified**: 2026-09-23 | **Last Amended**: 2026-09-23
