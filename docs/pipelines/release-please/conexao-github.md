# Conexão com GitHub no terminal

A conexão do agente/terminal é diferente do GITHUB_TOKEN das Actions. O MCP também usa uma autenticação própria: definir uma variável no shell não substitui automaticamente a sessão do conector.

## PAT e direnv

Direnv carrega variáveis conforme o diretório e sua configuração local. O diagnóstico deve conferir apenas a existência da variável, nunca imprimir seu conteúdo, exportar todo o ambiente em logs ou gravar o token em argumentos/URLs de Git.

No Bash do desenvolvedor, a partir do repositório:

~~~bash
direnv exec . bash -c '
  export GH_TOKEN="${PAT_MCP_AGENTE_APLICACOES_BOILERPLATE:?PAT ausente}"
  gh api user --jq .login
  gh api repos/aplicacoesBoilerplate/.github --jq .permissions
'
~~~

Esse comando limita a autenticação ao processo filho. Não precisa gravar a PAT em gh auth login. Para comandos de publicação posteriores, use o mesmo ambiente autenticado e a branch correta.

Antes de enviar, confira o head do PR, faça uma atualização fast-forward e preserve alterações de outros autores. Não force push para compensar um checkout antigo.

A worktree de integração local usada nesta entrega foi montada como snapshot com histórico artificial. Não publique esse histórico diretamente: aplique os commits/patches sobre a branch real do PR #19 e só então faça push.

## Como interpretar a falha

| Resultado | Camada | Próximo passo |
| --- | --- | --- |
| Variável ausente | Carregamento do ambiente | Conferir diretório, configuração e autorização local do direnv |
| getaddrinfo / host desconhecido | Resolução de rede | Comparar terminal normal com ambiente controlado |
| HTTP 401 | Autenticação | Conferir validade, expiração e credencial efetivamente selecionada |
| HTTP 403 | Autorização/política | Conferir acesso ao repo, permissões, SSO e aprovação da organização |
| exec-server transport disconnected | Sessão de execução | Restabelecer/reabrir o ambiente e testar um comando local simples |
| Falha MSYS NtCreateDirectoryObject | Inicialização do Git Bash | Comparar com Bash fora do ambiente; investigar restrições desse processo |

Os erros de rede não permitem concluir que uma chave é inválida. O diagnóstico em 24/10/2026 confirmou a variável presente, mas a resolução de api.github.com falhou antes de testar a PAT. Separadamente, o MCP retornou 403 ao criar blob.

## Isolar terminal e rede

No terminal normal da máquina, execute:

~~~bash
nslookup api.github.com
~~~

Depois execute a consulta autenticada acima. Se funcionar fora do ambiente controlado e falhar dentro, investigue a sessão/rede do executor. Se falhar nos dois, investigue DNS, proxy, VPN ou política de rede da máquina/organização.

Não altere DNS do sistema, desative proteção ou gere novas chaves sem isolar a causa. Uma falha de transporte pode ser resolvida restabelecendo o ambiente; ela não pede rotação da PAT.

Se precisar restabelecer a sessão do executor, preserve as worktrees e os arquivos pendentes. Após reconectar, confira git status e o SHA antes de retomar.

## Permissões para publicar esta entrega

O usuário/token precisa ter acesso de escrita ao repositório aplicacoesBoilerplate/.github. Alterações nos arquivos de workflow também precisam das permissões correspondentes ao tipo de token. Em PAT classic, confira repo e workflow conforme o acesso necessário; em fine-grained PAT, confira repositório selecionado, Contents e Workflows com escrita, além das permissões usadas para PRs.

Políticas de SSO, aprovação e restrições da organização podem limitar uma credencial válida. Para o MCP, confira a instalação do GitHub App na organização e os repositórios autorizados. Uma leitura de repositório público não comprova escrita autenticada.

O diagnóstico deve reportar usuário, status e permissões necessárias, sem registrar a PAT. A regra de proteção da master deve ser aplicada pelo administrador; a publicação desta entrega continua pelo PR #19.
