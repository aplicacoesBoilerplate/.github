# Design

## Context

Ver `proposal.md` e a delta spec. A organização já usa workflows `workflow_call` com checkout da automação na mesma revisão do workflow, permissões explícitas e `persist-credentials: false`. A origem da automação é pública; somente repositórios consumidores privados confiáveis podem receber a sessão ChatGPT. Não há runner persistente nem token de API OpenAI. O `GITHUB_TOKEN` não oferece a permissão de Secrets exigida para atualizar a secret de repositório.

## Goals / Non-Goals

**Goals:** contrato mínimo reutilizável, exemplo de consumidor e demonstração testável de restauração/atualização de sessão, sem segredos reais nos testes.

**Non-Goals:** autenticação autônoma inicial, renovação garantida após revogação ou exigência de login humano, execução de conteúdo de forks/PRs não confiáveis, secret compartilhada entre repositórios, API faturada separadamente e solução de produção já homologada.

## Decisions

### 1. Uma sessão por repositório privado consumidor

O consumidor fornece `CODEX_AUTH_JSON` e `CODEX_AUTH_WRITE_PAT` como secrets de repositório, não de organização. Cada consumidor mantém sua própria cópia para permitir exclusão mútua local. A sessão inicial é provisionada manualmente pelo mantenedor. O PAT fine-grained é restrito ao repositório consumidor e à permissão `Secrets: write`; ele não autentica o Codex. A alternativa de uma secret da organização criaria concorrência entre repositórios e ampliaria o alcance da credencial. A alternativa de `GITHUB_TOKEN` não atende à permissão necessária.

### 2. Workflow central com entrada validada

O workflow `workflow_call` aceita identificador de template versionado, modelo, esforço de raciocínio e parâmetros mínimos do prompt. Um catálogo pequeno de templates versionados no repositório central evita aceitar caminho arbitrário ou comandos fornecidos pelo consumidor. O workflow valida os valores antes de restaurar a sessão. Codex CLI roda em modo não interativo, com sandbox restrito e sem permissão para modificar o checkout; resposta limitada é exposta como output textual e estado. A implementação deverá usar uma versão fixa e documentada do CLI e validar os valores de modelo/effort contra a versão escolhida. Alternativa rejeitada: prompt shell livre, que aumenta superfícies de injeção e dificulta a auditoria.

### 3. Proteção de execução e serialização

O caller de exemplo só dispara em evento de mantenedor/branch confiável, nunca em `pull_request_target` com checkout de PR nem em fork. O workflow central também revalida a natureza privada do consumidor e o evento permitido antes de acessar secrets. `concurrency` agrupa todas as chamadas do mesmo repositório que usam a secret, com `queue: max` e `cancel-in-progress: false`; o exemplo mostra o grupo necessário quando houver mais de um caller. A fila do GitHub tem limite de 100 chamadas pendentes; excesso é cancelado visivelmente, sem ser confundido com sucesso. Alternativa de paralelismo livre foi rejeitada por risco de sobrescrever uma sessão recém-renovada. Repositórios distintos não compartilham a secret.

### 4. Persistência criptografada, com resultado fail-closed

O job restaura a sessão em `CODEX_HOME` temporário com permissões restritas, sem imprimir conteúdo. Depois do Codex, inclusive quando a invocação falhar, valida se o arquivo atualizado permanece bem formado. Com o PAT disponível somente na etapa de persistência, obtém a chave pública de Actions Secrets do repositório, criptografa o conteúdo localmente e chama a API de criação/atualização da mesma secret. O PAT não é passado ao processo Codex. Sucesso da execução exige resposta válida **e** confirmação da gravação; falha de gravação produz estado de erro e exige reseed manual quando necessário. A remoção do diretório temporário ocorre no encerramento. Alternativa de Secret estática foi rejeitada porque o token renovado ficaria somente no runner descartável; alternativa de artefato de workflow foi rejeitada porque colocaria a sessão fora do cofre de secrets.

### 5. Superfície pública e documentação

A implementação entrega workflow central, scripts pequenos de validação/persistência, catálogo inicial com um template inofensivo, workflow consumidor de exemplo e duas documentações. O exemplo não recebe credenciais reais no repositório central público; indica onde o proprietário do consumidor privado cria as secrets. Um consumidor pode usar o resultado para decidir uma ação posterior, mas a primeira iteração não concede ao Codex poderes de alterar repositório, aprovar PR ou publicar automaticamente.

## Risks / Trade-offs

- [Sessão Plus pode expirar, ser revogada ou exigir login] → falhar explicitamente e documentar reseed humano; PAT não cria uma nova sessão ChatGPT.
- [PAT de escrita de secrets amplia o impacto de um job comprometido] → PAT fine-grained de um repositório, eventos confiáveis, sem checkout de código não confiável, PAT só na etapa final e revisão das permissões antes do piloto.
- [Secret atualizada não muda o valor já carregado em jobs simultâneos] → serialização obrigatória por repositório e proibição de outros callers fora do mesmo grupo de concorrência.
- [Fila de concorrência do GitHub é limitada] → usar `queue: max`, expor cancelamento como não execução e dimensionar o piloto para baixa frequência.
- [CLI/formatos de autenticação mudam] → fixar versão no MVP, validar contrato em testes e exigir piloto privado antes de considerar a solução operacional.
- [Aprovação do Plus para automação não é garantia de serviço permanente] → tratar como protótipo limitado às condições da documentação oficial e preservar alternativa futura de API ou identidade de serviço.

## Migration Plan

1. Publicar contrato, scripts, testes sem credenciais e exemplo; nenhum consumidor é ativado automaticamente.
2. Em repositório piloto privado, provisionar manualmente sessão e PAT restrito, configurar o caller e executar duas vezes em série para demonstrar persistência.
3. Conferir logs e outputs sem segredos, testar falhas de autenticação e de gravação, e documentar reseed.
4. Se o piloto falhar ou houver risco, desabilitar o caller e revogar o PAT; a automação central não altera as secrets de outros repositórios.

## Sources

- [OpenAI: manutenção de autenticação Codex em CI](https://learn.chatgpt.com/docs/auth/ci-cd-auth)
- [GitHub: permissões do `GITHUB_TOKEN`](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax)
- [GitHub: API de Actions Secrets](https://docs.github.com/en/rest/actions/secrets)
- [GitHub: concorrência e limite da fila](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency)
