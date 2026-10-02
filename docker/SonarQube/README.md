# SonarQube local compartilhado

Este diretório mantém **um servidor SonarQube Community Build**, seu PostgreSQL e a definição de um **SonarScanner CLI sob demanda**. Cada aplicação consumidora mantém sua própria identidade de projeto, escopo de análise e token. O SonarQube for IDE (antigo SonarLint) roda na IDE e pode ser vinculado ao mesmo projeto no servidor.

| Local | Responsabilidade |
| --- | --- |
| `.env` deste stack | Senha do PostgreSQL e porta do servidor local. Nunca contém token de análise. |
| `.envrc` de **cada consumidor** | Mapeia `SONAR_TOKEN` para a variável externa específica daquele projeto, além de fornecer o caminho do projeto e deste compose. Não contém o token literal. |
| `sonar-project.properties` de **cada consumidor** | Chave do projeto, diretórios de código e testes, exclusões e caminhos dos relatórios. Pode ser versionado, sem credenciais. |

Os modelos ficam em [`examples/`](examples/). Os tokens são distintos: um **Project Analysis token** serve ao scanner daquele projeto; o **User Token** serve ao modo conectado da IDE, ao SonarQube CLI e ao MCP. A [documentação de tokens](https://docs.sonarsource.com/sonarqube-community-build/user-guide/managing-tokens/) explica o alcance de cada tipo.

## Subir o servidor

1. Inicie o Docker Desktop em modo Linux. Para uma instalação pequena, reserve ao menos 4 GB de RAM e 2 CPUs. Confira os [pré-requisitos do Elasticsearch no host Linux/WSL](https://docs.sonarsource.com/sonarqube-community-build/server-installation/pre-installation/linux/) se houver erro na inicialização.
2. Copie `examples/.env.example` para `.env` **neste diretório** e preencha `SONAR_DB_PASSWORD` com uma senha aleatória. Neste computador o `.env` já existe. O Compose carrega automaticamente o `.env` do projeto; `--env-file` só é necessário para escolher outro arquivo. Variáveis já exportadas no terminal têm prioridade sobre ele.
3. Na pasta deste stack, execute:

   ```bash
   docker compose up -d db sonarqube
   docker compose ps
   ```

4. Abra `http://localhost:9000` ou a porta definida em `SONAR_PORT`. Na instalação inicial, o login web é `admin` / `admin`; troque a senha e aguarde o servidor ficar **UP**. Para consultar o estado no Git Bash: `curl -fsS http://localhost:9000/api/system/status`.

O acesso web é publicado apenas em `127.0.0.1`; o PostgreSQL não publica porta para o host. Para investigar, use `docker compose logs --tail=100 sonarqube db`. Para parar, use `docker compose down` **sem** `-v`; a opção `-v` remove os volumes persistentes.

### O login `sonar` não é uma conta web

`POSTGRES_USER=sonar` e `SONAR_JDBC_USERNAME=sonar` identificam o **usuário do banco**. Eles não criam um usuário na tela de login. O Compose atual não provisiona contas web. Crie uma conta não administrativa na interface em **Administration > Security > Users**, conceda a ela as permissões necessárias ao projeto e gere seu token, se quiser deixar de usar o `admin`. Um Project Analysis token criado pelo `admin` ainda fica limitado à análise do projeto, mas um **User Token** criado pelo `admin` herda os privilégios amplos dessa conta.

## Preparar cada aplicação consumidora

1. Crie o projeto no SonarQube e anote sua chave.
2. Copie `examples/consumer.sonar-project.properties.example` para `sonar-project.properties` na raiz **da aplicação**. Ajuste `sonar.projectKey` e os diretórios reais do código. O scanner lê esse arquivo dentro do diretório montado em `/usr/src` no contêiner. Ele não fica no contêiner do servidor.
3. Gere um token do tipo **Project Analysis** para esse projeto e disponibilize seu valor em uma variável de ambiente externa ao `.envrc` (por exemplo, `SQP_K6`). Copie `examples/consumer.envrc.example` para `.envrc` na raiz **da aplicação** e ajuste a referência, por exemplo `export SONAR_TOKEN="$SQP_K6"`. Preencha `SONAR_STACK_COMPOSE` com o caminho absoluto deste `docker-compose.yml`. O exemplo usa `pwd -W` do Git Bash para fornecer ao Docker um caminho `C:/...` da aplicação. O `.envrc` contém somente a referência à variável, nunca o valor do token.
4. Garanta que `.envrc`, `.env` e `.scannerwork/` estejam no `.gitignore` **da aplicação**. Adicione o hook `eval "$(direnv hook bash)"` ao `~/.bashrc` do Git Bash, se ainda não estiver ativo. Entre na pasta da aplicação, execute `direnv allow` e confirme no próximo prompt que as variáveis foram carregadas. O direnv descarrega essas variáveis quando você sai da pasta.

O `.envrc` é código Bash executado pelo direnv; revise-o antes de `direnv allow`. A variável externa do projeto precisa existir no ambiente do Git Bash antes de o direnv carregar o `.envrc`. Cada consumidor pode apontar para uma variável externa diferente, mantendo a interface fixa `SONAR_TOKEN` exigida pelo scanner.

O `sonar-project.properties` aceita interpolação própria do SonarScanner CLI: `sonar.projectKey=${env.SONAR_PROJECT_KEY}` lê uma variável de ambiente **dentro do contêiner**. Ele não interpreta `$SONAR_PROJECT_KEY` ou `${SONAR_PROJECT_KEY}` como o Bash. O Compose atual encaminha `SONAR_TOKEN`, que o scanner lê diretamente; não copie o token para o `.properties`. Para uma chave dinâmica, exporte `SONAR_PROJECT_KEY` no `.envrc` e execute `docker compose -f "$SONAR_STACK_COMPOSE" run --rm -e SONAR_PROJECT_KEY scanner`. O `-e` repassa a variável do terminal ao contêiner. Como alternativa, mantenha uma chave fixa no arquivo ou passe `-Dsonar.projectKey="$SONAR_PROJECT_KEY"` após `scanner`. [Código de resolução de propriedades do SonarScanner CLI](https://github.com/SonarSource/sonar-scanner-cli/blob/master/src/main/java/org/sonarsource/scanner/cli/PropertyResolver.java).

## Executar o scanner e o perfil `scan`

No **Git Bash, dentro da aplicação consumidora**, depois de carregar o `.envrc`:

```bash
if test -n "${SONAR_TOKEN:-}" && test -f sonar-project.properties && test -f "$SONAR_STACK_COMPOSE"; then
  docker compose -f "$SONAR_STACK_COMPOSE" run --rm scanner
else
  echo 'Confira SONAR_TOKEN, sonar-project.properties e SONAR_STACK_COMPOSE' >&2
fi
```

A condição verifica as entradas sem imprimir o token. O `-f` aponta para o compose central; o valor exportado `SONAR_PROJECT_PATH` faz esse projeto ser montado em `/usr/src`. O Compose continua usando o `.env` do stack para a senha do banco, enquanto as variáveis exportadas pelo direnv prevalecem na configuração do scanner. Dentro da rede Docker, o scanner usa `http://sonarqube:9000`, não `localhost`.

`profiles: [scan]` impede o scanner de subir com `docker compose up -d` normal. Ao mirar explicitamente o serviço `scanner` com `docker compose run --rm scanner`, o Compose ativa esse serviço e suas dependências automaticamente; **não é preciso** passar `--profile scan`. O contêiner do scanner é removido ao terminar. Todos os consumidores podem usar a mesma definição e imagem, cada um em sua própria execução. Não há necessidade de manter um scanner permanente.

Também é possível executar o comando na pasta deste stack, mas nesse terminal você teria de exportar manualmente `SONAR_PROJECT_PATH` e `SONAR_TOKEN` do consumidor antes. Sem isso, o valor padrão `.` montaria a pasta de infraestrutura, e a análise não teria o token do projeto. O scanner escreve `.scannerwork` na pasta montada; ela precisa permitir leitura e escrita pelo usuário `1000` do contêiner.

A tela de criação de projeto pode sugerir `npm install -g @sonar/scan` quando você seleciona **JS/TS e Web**. Esse é o [SonarScanner for NPM](https://docs.sonarsource.com/sonarqube-community-build/analyzing-source-code/scanners/npm/introduction/), uma alternativa para projetos JavaScript/TypeScript; ele não é o SonarQube CLI mostrado na extensão. Escolha um scanner por execução do consumidor: o scanner genérico deste Compose ou o scanner específico da stack.

## Como funciona `sonar-project.properties`

O SonarScanner CLI procura um arquivo Java **`.properties`** chamado `sonar-project.properties` na raiz analisada. O formato é `chave=valor`, uma propriedade por linha, com comentários iniciados por `#`. Ele **não aceita YAML** como substituto desse arquivo. Se não puder manter o arquivo na raiz, use argumentos `-Dsonar.propriedade=valor` ou `-Dproject.settings=/caminho/arquivo.properties`; `project.settings` não pode ser combinado com `sonar.projectBaseDir`. Scanners de Maven, Gradle, .NET e NPM também admitem configuração própria da stack. Consulte a [configuração do SonarScanner CLI](https://docs.sonarsource.com/sonarqube-community-build/analyzing-source-code/scanners/sonarscanner/).

As propriedades locais sobrescrevem configurações do projeto na UI; argumentos `-D` têm prioridade ainda maior. Configurações definidas apenas no arquivo/CLI valem para a análise e não são salvas como configuração do projeto no servidor. Para regras e exclusões que devem ser compartilhadas com o modo conectado da IDE, configure-as na UI do projeto. Consulte a [hierarquia de configurações](https://docs.sonarsource.com/sonarqube-community-build/analyzing-source-code/analysis-parameters/configuration-overview/).

| Propriedade | Valor aceito e exemplo | Caso de uso e impacto |
| --- | --- | --- |
| `sonar.projectKey` | Identificador único, por exemplo `K6-Runner`; obrigatório. | Associa a análise ao projeto correto no servidor. |
| `sonar.projectName` | Texto, por exemplo `K6 Runner`; opcional. | Nome exibido na interface. |
| `sonar.sources` | Caminhos de pastas ou arquivos separados por vírgula, como `src,lib`; sem `*`, `**` ou `?`. | Define o escopo inicial do código de produção. Caminhos relativos partem da raiz analisada. |
| `sonar.tests` | Caminhos com a mesma sintaxe de `sonar.sources`, como `tests`; opcional. | Classifica arquivos como testes. Um arquivo não pode ser simultaneamente fonte e teste. |
| `sonar.exclusions` | Padrões separados por vírgula, como `src/generated/**,**/*.min.js`. | Remove esses arquivos de código de produção da análise; problemas neles deixam de aparecer. |
| `sonar.test.inclusions` | Padrões separados por vírgula, como `tests/**/*.test.ts`. | Restringe quais arquivos no escopo de testes são considerados testes. |
| `sonar.coverage.exclusions` | Padrões separados por vírgula, como `src/generated/**,src/bootstrap.ts`. | Mantém os arquivos na análise de problemas, mas tira esses arquivos do cálculo de cobertura. |
| `sonar.cpd.exclusions` | Padrões separados por vírgula, como `src/generated/**`. | Mantém os arquivos na análise de problemas, mas exclui da detecção de duplicação. |
| `sonar.javascript.lcov.reportPaths` | Caminhos de relatórios LCOV separados por vírgula, como `coverage/lcov.info`. | Importa cobertura de JS/TS produzida antes do scanner; não executa testes. |
| `sonar.coverage.jacoco.xmlReportPaths` | Caminhos de XML JaCoCo separados por vírgula, como `target/site/jacoco/jacoco.xml`; aceita curingas. | Importa cobertura Java/Kotlin/Scala gerada pelo build. |
| `sonar.sourceEncoding` | Nome de charset, normalmente `UTF-8`. | Evita leitura incorreta de caracteres no código fonte. |

Nos padrões de exclusão/inclusão, `?` representa um caractere, `*` representa caracteres dentro de um segmento e `**` atravessa diretórios. Os caminhos dos relatórios precisam existir **dentro do projeto montado** antes da análise; o SonarQube importa cobertura, mas não a gera. Fontes: [escopo inicial](https://docs.sonarsource.com/sonarqube-community-build/analyzing-source-code/analysis-parameters/parameters-not-settable-in-ui/), [exclusões e inclusões](https://docs.sonarsource.com/sonarqube-community-build/project-administration/adjusting-analysis/setting-analysis-scope/excluding-files-based-on-patterns/), [exclusões de cobertura/duplicação](https://docs.sonarsource.com/sonarqube-community-build/project-administration/adjusting-analysis/setting-analysis-scope/exclude-from-coverage-duplication/) e [relatórios de cobertura](https://docs.sonarsource.com/sonarqube-community-build/analyzing-source-code/test-coverage/test-coverage-parameters/).

### Exemplo JS/TS

Após gerar `coverage/lcov.info` com a ferramenta de testes da aplicação, a configuração **na própria aplicação** pode ser:

```properties
sonar.projectKey=meu-front
sonar.projectName=Meu front
sonar.sources=src
sonar.tests=tests
sonar.exclusions=src/generated/**,src/**/*.min.js
sonar.test.inclusions=tests/**/*.test.ts
sonar.coverage.exclusions=src/generated/**
sonar.javascript.lcov.reportPaths=coverage/lcov.info
sonar.sourceEncoding=UTF-8
```

Para Java, use preferencialmente o [SonarScanner for Maven](https://docs.sonarsource.com/sonarqube-community-build/analyzing-source-code/scanners/sonarscanner-for-maven/) ou Gradle junto do build; eles já conhecem fontes e artefatos compilados. Se o build gerar JaCoCo XML, o parâmetro de importação é `sonar.coverage.jacoco.xmlReportPaths=target/site/jacoco/jacoco.xml` (ajuste o caminho real). A análise Java com Scanner CLI isolado pode exigir `sonar.java.binaries` apontando para as classes compiladas.

## SonarQube for IDE, CLI e MCP

O **SonarQube for IDE** analisa o código durante a edição. No VS Code, abra **SONARQUBE SETUP > CONNECTED MODE**, conecte a `http://localhost:9000` com um **User Token** e vincule a pasta da aplicação ao projeto com a mesma chave de `sonar.projectKey`. O token de análise de projeto não funciona para esse vínculo. Consulte o [modo conectado](https://docs.sonarsource.com/sonarqube-for-vs-code/connect-your-ide/setup/).

O **SonarQube CLI** (`sonar`, atualmente em beta) é outra ferramenta: oferece consultas de issues e projetos, análise local de mudanças e integrações com agentes. Ele **não substitui** o SonarScanner CLI (`sonar-scanner`) que publica a análise completa no servidor. Para esta demanda, é opcional; instale quando houver um fluxo local ou de agente que use essas funções. Ele exige **User Token**, não Project Analysis token. Consulte a [visão geral](https://docs.sonarsource.com/sonarqube-cli/readme/) e o [guia inicial](https://docs.sonarsource.com/sonarqube-cli/quickstart-guide/).

### Autenticação do SonarQube CLI no Windows

O login pelo navegador (`sonar auth login --server http://localhost:9000`) usa uma porta local da faixa `64120–64130`. Nesta máquina o Windows reservou `64067–64166`, então o comando falha com `No available port in SonarLint range 64120-64130` e código 1. A página genérica de ajuda do terminal do VS Code não identifica essa causa: o terminal iniciou e foi a CLI que terminou com erro. Consulte `netsh interface ipv4 show excludedportrange protocol=tcp` para conferir a reserva.

Para usar a CLI sem esse retorno pelo navegador, gere um **User Token** (não o token de análise do projeto) e associe uma variável externa a ele. No `.envrc` de cada consumidor, se desejar usar também a CLI, faça o mapeamento sem copiar o token literal:

```bash
export SONARQUBE_CLI_SERVER='http://localhost:9000'
export SONARQUBE_CLI_TOKEN="$SONAR_USER_TOKEN"
```

Depois de `direnv allow`, rode `sonar auth status` ou um comando de leitura, como `sonar list issues -p K6-Runner`, no Git Bash. Neste computador, a CLI instalada pela extensão ainda não está no `PATH`; use `"$(cygpath -u "$LOCALAPPDATA/sonarqube-cli/bin/sonar.exe")" auth status` (e substitua `auth status` pelo comando desejado). A autenticação por variáveis evita o fluxo de navegador e não precisa gravar o token no chaveiro. O `--with-token` também lê um User Token da entrada padrão se preferir salvar a conexão no chaveiro. [Referência de variáveis da CLI](https://docs.sonarsource.com/sonarqube-cli/using-sonarqube-cli/environment-variables/).

O **SonarQube MCP Server** agrega valor quando um cliente de IA compatível precisa consultar issues, quality gates e contexto do projeto para ajudar na correção. Ele é uma integração **do cliente de IA**, não um substituto do scanner nem um serviço necessário para o servidor local. Primeiro conecte e vincule o SonarQube for IDE. Depois, em **SONARQUBE SETUP > AI AGENTS CONFIGURATION > Configure SonarQube MCP Server** no VS Code compatível, use o fluxo da extensão para aproveitar as credenciais do modo conectado. Mantenha o token de usuário nas credenciais locais do cliente. Se configurar o MCP manualmente em Docker, o servidor SonarQube exposto no host em `localhost:9000` deve ser endereçado a partir do contêiner via `host.docker.internal:9000` no Docker Desktop; use modo somente leitura quando o agente só precisar consultar dados. Consulte [MCP Server](https://docs.sonarsource.com/sonarqube-mcp-server/) e [integração na IDE](https://docs.sonarsource.com/sonarqube-for-vs-code/using/investigating-issues/).

O VS Code e o Codex desktop são **clientes MCP separados**: configurar um não registra automaticamente o servidor no outro. Ambos podem iniciar a mesma imagem oficial `sonarsource/sonarqube-mcp` sob demanda. Para reutilizar o `.envrc`, mapeie também `SONARQUBE_TOKEN` a uma variável externa de **User Token** (por exemplo, `export SONARQUBE_TOKEN="$SONAR_USER_TOKEN"`) e `SONARQUBE_URL='http://host.docker.internal:9000'`; inicie o cliente a partir de um ambiente que carregue essas variáveis ou faça o comando MCP carregar o `.envrc` com direnv na pasta consumidora. O `SONAR_TOKEN` existente continua exclusivo do scanner. Em clientes iniciados pelo menu do Windows, confirme a herança da variável externa antes de esperar que o direnv a encontre. [Configuração do MCP da SonarSource](https://github.com/SonarSource/sonarqube-mcp-server/blob/master/README.md), [MCP no VS Code](https://code.visualstudio.com/docs/agent-customization/mcp-servers/).

Neste computador, [`scripts/start-sonarqube-mcp.ps1`](scripts/start-sonarqube-mcp.ps1) inicia o contêiner MCP para um consumidor. Ele lê a variável externa do User Token do ambiente de usuário do Windows quando o VS Code ou o Codex foram abertos antes dela existir, chama o Git Bash, carrega o `.envrc` aprovado pelo direnv e repassa `SONARQUBE_TOKEN`, `SONARQUBE_URL` e `SONARQUBE_PROJECT_KEY` ao contêiner em modo somente leitura. Use `-Check` para validar as entradas sem iniciar o MCP. Exemplo para o k6 Runner:

```powershell
./scripts/start-sonarqube-mcp.ps1 -ProjectPath 'C:/Users/Gerson Ribeiro/Documents/TEK/ProjetosTek/Testes/k6' -UserTokenVariable SQU_FOR_ANALYZER_IN_IDE -Check
```

O k6 Runner possui `.mcp.json` local para o VS Code e uma entrada global `sonarqube-k6-local` no Codex, ambas apontando para esse inicializador. O `.mcp.json` é ignorado apenas pelo Git local do k6, porque contém caminhos específicos deste computador. No VS Code, use **MCP: List Servers** para iniciar/verificar `sonarqube-k6-local`; no Codex, confira `codex mcp get sonarqube-k6-local` e reinicie a sessão para carregar a nova entrada. O registro do MCP dispensa o SonarQube CLI; o scanner do Compose continua responsável por publicar as análises completas.

## Codex CLI com MCPs do projeto ativo

O Codex Desktop inclui um executável em uma pasta versionada própria. Esse caminho não estava disponível no Git Bash do VS Code (`bash: codex: command not found`). Esta foi a sequência executada nesta máquina para disponibilizar a **CLI independente** e abrir seu terminal interativo:

| Ordem | Comando no Git Bash | Motivo e resultado esperado |
| --- | --- | --- |
| 1 | `npm config get prefix` | Descobrir onde o npm instala comandos globais; aqui, `%APPDATA%/npm`, que precisa constar no `PATH` do Git Bash. |
| 2 | `npm list -g @openai/codex --depth=0` | Confirmar que o pacote da CLI ainda não estava instalado globalmente. |
| 3 | `npm install --global @openai/codex` | Instalar o comando `codex` e seu lançador em `%APPDATA%/npm/codex`, sem depender do executável versionado do Desktop. |
| 4 | `type -a codex` e `codex --version` | Confirmar que o Git Bash encontra o comando e qual versão será executada; a verificação nesta máquina retornou `codex-cli 0.160.0`. |
| 5 | `codex login status` | Confirmar a sessão de autenticação da CLI; aqui, ela já estava autenticada com a conta ChatGPT. |

Nesta máquina, o prefixo do npm já estava no `PATH`; instalar o pacote criou o comando que faltava, sem edição manual do `PATH`. Abra um terminal Git Bash **novo** após a instalação para herdar o ambiente atualizado. Se `type -a codex` continuar vazio, confira se a saída de `npm config get prefix` está no `PATH` desse terminal antes de prosseguir. Consulte a [instalação oficial da CLI](https://learn.chatgpt.com/docs/codex/cli).

O [perfil versionável](config/codex.direnv.config.toml) é instalado como `~/.codex/direnv.config.toml`. O Codex carrega esse arquivo quando recebe `--profile direnv`; ele se sobrepõe ao `~/.codex/config.toml` global apenas nessa sessão. O [lançador](scripts/codex-project.sh) carrega o `.envrc` aprovado, ativa os MCPs cujas variáveis estão presentes e inicia o Codex. Na pasta do consumidor, com `SONAR_STACK_COMPOSE` já definido pelo `.envrc`, instale o perfil:

```bash
mkdir -p ~/.codex
cp "$(dirname "$SONAR_STACK_COMPOSE")/config/codex.direnv.config.toml" ~/.codex/direnv.config.toml
```

O primeiro comando cria a pasta de configuração, caso ainda não exista; o segundo copia o perfil genérico sem alterar `~/.codex/config.toml`. Para que o comando simples `codex` use esse fluxo no Git Bash, acrescente ao `~/.bashrc` (ajuste o caminho do stack):

```bash
codex() {
  bash '/c/caminho/SonarQubeAnalyzer/scripts/codex-project.sh' "$@"
}
```

Depois de salvar o `~/.bashrc`, abra um Git Bash novo na pasta do k6 e execute, nesta ordem:

```bash
direnv allow      # aprova o .envrc do consumidor e carrega seus mapeamentos
codex --check     # confere o perfil e os nomes dos MCPs ativos, sem mostrar tokens
codex mcp list    # confere os servidores registrados na configuração efetiva
codex             # abre a interface interativa da CLI no terminal
```

Ao entrar em outro consumidor com seu próprio `.envrc`, execute `direnv allow` nele e **inicie uma nova sessão `codex`**; conexões MCP de uma sessão já aberta não trocam de projeto automaticamente. O `SONAR_TOKEN` continua sendo o Project Analysis token do scanner; o MCP lê `SONARQUBE_TOKEN`, que referencia o User Token externo.

| MCP da CLI | Variáveis lidas no `.envrc` do consumidor | Comportamento |
| --- | --- | --- |
| SonarQube | `SONARQUBE_TOKEN`, `SONARQUBE_URL`, `SONARQUBE_PROJECT_KEY` | Exige as três variáveis; inicia o contêiner oficial em modo somente leitura. `SONARQUBE_TOKEN` referencia o **User Token** externo, enquanto `SONAR_TOKEN` continua reservado ao scanner. |
| Docker MCP Gateway | `PROFILE_TOOLKIT` | Seleciona o perfil Docker do consumidor; não usa um nome de perfil fixo no TOML. |
| GitHub | `GITHUB_PERSONAL_ACCESS_TOKEN` | Codex lê o bearer token da variável do processo, sem gravá-lo no TOML. |
| Context7 | `API_KEY_CONTEXT7` | Codex lê o header da variável do processo, sem gravá-lo no perfil. |

Todas são opcionais, exceto que as três variáveis do SonarQube devem vir juntas. Os MCPs ausentes ficam desabilitados. O perfil também desabilita, **somente na CLI**, as entradas globais `sonarqube-k6-local`, `MCP_DOCKER` e `context7` que hoje contêm configuração fixa. Ele preserva `opencode.json`, `.envrc` existentes e as configurações do Desktop. O `config.toml` global ainda contém um header Context7 literal: removê-lo ou migrar a conexão global afetaria o Desktop e é uma decisão separada. [Perfis e precedência de configuração do Codex](https://github.com/openai/codex/blob/main/codex-rs/config/src/loader/mod.rs).

### Voz na CLI

A [documentação atual do ChatGPT Voice](https://learn.chatgpt.com/docs/features/voice) descreve a conversa bidirecional por voz no aplicativo Desktop e distingue esse modo do ditado, que apenas transforma fala em texto. A CLI do Codex não documenta um comando para falar as respostas em áudio. Se o terminal transcrever o que você diz e mostrar a resposta apenas em texto, o microfone provavelmente está sendo usado como ditado pelo sistema ou pela IDE. Para ouvir as respostas, use o modo de voz do aplicativo Desktop quando ele estiver disponível; a falha desse modo já foi reportada neste computador.

### Configuração da IDE e limite da variável de token

O SonarQube for IDE lê o binding do k6 em `.vscode/settings.json`: conexão `http-localhost-9000` e projeto `K6-Runner`. A conexão e o **User Token** são configurados no assistente **SONARQUBE SETUP > CONNECTED MODE**; o token fica no armazenamento de credenciais do VS Code, fora do repositório. A extensão não oferece uma interpolação documentada do `.envrc` para esse campo. Ao trocar o User Token externo, atualize a conexão no assistente da IDE.

Para compartilhar apenas URL e chave do projeto, a extensão exporta a configuração nativa para `.sonarlint/connectedMode.json` na raiz do consumidor. Ela não procura esse arquivo em um diretório arbitrário `config/`; o `.vscode/settings.json` atual já cumpre o papel de binding por projeto no piloto. Consulte a [configuração oficial do modo conectado](https://docs.sonarsource.com/sonarqube-for-vs-code/connect-your-ide/setup/). Depois de salvar um arquivo JS/TS no k6, confira **Problems** e **SonarQube Findings**; a extensão analisa o arquivo aberto localmente e sincroniza as regras do projeto, mas não publica a análise completa no servidor.

#### Se a IDE não conseguir listar os projetos remotos

A mensagem **“Request Failed: Could not get the list of remote projects. Please check the connection.”** ocorre antes de escolher o projeto para o vínculo. No diagnóstico de 02/10/2026, o log **Output > SonarQube for IDE** registrou `NetworkException: Request failed` ao listar projetos e `Connection closed by peer` em sincronizações anteriores. Durante a verificação, o servidor reiniciou e ficou temporariamente sem responder; depois voltou ao estado `UP`. A API autenticou o User Token externo (`valid: true`) e encontrou `K6-Runner`. Isso indica uma falha de comunicação na tentativa observada; não confirma se a credencial **salva na extensão** continua válida.

No Git Bash, dentro do k6 e com o `.envrc` carregado, verifique as três etapas sem mostrar o token:

```bash
curl -fsS http://localhost:9000/api/system/status
curl -fsS -H "Authorization: Bearer $SONARQUBE_TOKEN" http://localhost:9000/api/authentication/validate
curl -fsS -H "Authorization: Bearer $SONARQUBE_TOKEN" 'http://localhost:9000/api/projects/search?projects=K6-Runner'
```

Espere `"status":"UP"`, `"valid":true` e a chave `K6-Runner` na lista. Se o primeiro comando falhar, confira `docker compose -f "$SONAR_STACK_COMPOSE" ps` e os logs do serviço `sonarqube`, aguarde a inicialização e repita. Se a autenticação falhar, confira se `SONARQUBE_TOKEN` aponta para um **User Token**, não para o Project Analysis token `SONAR_TOKEN`. Se o projeto não aparecer, confira a chave e a permissão de leitura do usuário. Se os três comandos funcionarem e a IDE continuar falhando, no **SONARQUBE SETUP > CONNECTED MODE** edite a conexão `http-localhost-9000` para `http://localhost:9000` com o User Token, salve e recarregue a janela do VS Code. O token da extensão fica nas credenciais da IDE e não acompanha mudanças do `.envrc`. No workspace com várias pastas, selecione **k6** e o projeto remoto **K6-Runner** ao vincular. Consulte o [procedimento oficial de conexão e vínculo](https://docs.sonarsource.com/sonarqube-for-vs-code/connect-your-ide/setup/).

### Convenção `p` + PascalCase no k6

No piloto, o SonarQube for IDE apontou `catch (pErro)` como violação da regra **S7718** e sugeriu `error_`. O nome `pErro` segue a convenção escolhida para o projeto. Por isso, o servidor local agora associa **somente o projeto `K6-Runner`** a dois perfis derivados de **Sonar way**:

| Linguagem | Perfil associado | Regra ajustada |
| --- | --- | --- |
| JavaScript | `TEK pPascal JavaScript` | `javascript:S7718` |
| TypeScript | `TEK pPascal TypeScript` | `typescript:S7718` |

Nos dois perfis, o parâmetro `ignore` da S7718 mantém os padrões originais e acrescenta `^p[A-Z][A-Za-z0-9]*$`. Esse padrão aceita `pErro` e outros nomes `p` + PascalCase ASCII em cláusulas `catch`; não aceita `pfoo` nem `p_erro`. Os demais nomes de exceção continuam sujeitos à regra. Perfis derivados herdam atualizações de **Sonar way**; outros projetos continuam com seu perfil atual. A mudança fica no banco do servidor SonarQube, não em `sonar-project.properties`, no Compose ou no ESLint.

#### Compartilhar e reproduzir os perfis

A definição que pode ser compartilhada está em [`config/quality-profiles/p-pascal.json`](config/quality-profiles/p-pascal.json): nomes dos perfis, linguagens, pai **Sonar way**, regra S7718 e padrão aceito. O script [`scripts/configure-ppascal-quality-profiles.ps1`](scripts/configure-ppascal-quality-profiles.ps1) aplica essa definição pela API do SonarQube e associa os perfis à chave de projeto informada. Juntos, esses dois arquivos funcionam como uma **migração repetível** para uma instalação local nova; a execução não ocorre automaticamente em `docker compose up`, porque o projeto consumidor precisa existir primeiro.

Para reproduzir do zero em outro SonarQube local:

1. Copie este diretório do stack para a máquina ou obtenha seus arquivos de um repositório. Configure o `.env` local e inicie `docker compose up -d db sonarqube`; aguarde `http://localhost:9000/api/system/status` retornar `UP`.
2. Crie o projeto consumidor no SonarQube, com chave `K6-Runner` neste exemplo. Gere um **User Token** com permissão **Administer Quality Profiles** e disponibilize o valor em uma variável de ambiente externa, como `SQU_FOR_ANALYZER_IN_IDE`. O arquivo JSON e o script não contêm o valor do token.
3. Na pasta deste stack, execute no PowerShell:

```powershell
./scripts/configure-ppascal-quality-profiles.ps1 -ProjectKey K6-Runner -TokenVariable SQU_FOR_ANALYZER_IN_IDE
```

4. Abra **Quality profiles** no SonarQube para conferir os dois perfis e a associação ao `K6-Runner`. Depois, a partir da pasta do k6 com o `.envrc` carregado, execute `docker compose -f "$SONAR_STACK_COMPOSE" run --rm scanner` para atualizar as issues do servidor.

O script lê a variável do processo ou do usuário Windows, sem gravar nem exibir o token. Para cada linguagem, ele executa estas operações na API:

| Ordem | Operação | Resultado |
| --- | --- | --- |
| 1 | `projects/search` e `qualityprofiles/search` | Confirma que o token enxerga o projeto e identifica os perfis existentes. |
| 2 | `qualityprofiles/create` e `qualityprofiles/change_parent` | Cria o perfil, se faltar, e estabelece **Sonar way** como pai. |
| 3 | `rules/show` e `qualityprofiles/activate_rule` | Lê o valor padrão de `ignore` da S7718 e adiciona `^p[A-Z][A-Za-z0-9]*$` sem remover os padrões originais. |
| 4 | `qualityprofiles/add_project` | Associa apenas `K6-Runner` ao perfil daquela linguagem. |

O script pode ser executado de novo: ele não recria perfis existentes nem repete a associação. Se encontrar um perfil com o mesmo nome mas pai ou parâmetro S7718 diferente, interrompe para revisão. Para outro consumidor que adote a mesma convenção, informe sua chave em `-ProjectKey`; o Project Analysis token daquele consumidor continua exclusivo do scanner.

Para compartilhar por Git, coloque **README.md**, **`config/quality-profiles/p-pascal.json`** e **`scripts/configure-ppascal-quality-profiles.ps1`** no repositório do stack. Este diretório local ainda não está inicializado como repositório Git nem possui remoto configurado; portanto, esses arquivos ainda não foram publicados para outras máquinas. O `.gitignore` já exclui `.env` e `.envrc` locais.

O SonarQube também oferece **Quality Profiles > menu de três pontos > Back up** para exportar um perfil em XML e **Quality Profiles > Restore** para importá-lo. Esse é um snapshot útil para transporte manual. Na importação de um nome já existente, o SonarQube adiciona regras ativas ausentes, mas não atualiza as regras ativas existentes; por isso, use a migração acima para garantir o parâmetro S7718 e a associação ao projeto. Consulte o [backup e restore oficiais](https://docs.sonarsource.com/sonarqube-server/quality-standards-administration/managing-quality-profiles/creating-a-quality-profile.md#importing-a-quality-profile-from-another-sonarqube-instance).

Pela interface web, a mesma configuração é feita em **Quality Profiles > Create > Extend an existing quality profile**: escolha **JavaScript**, pai **Sonar way** e nome `TEK pPascal JavaScript`; repita para **TypeScript** com nome `TEK pPascal TypeScript`. Em cada perfil, vá a **Inheritance > active rules**, procure `S7718`, escolha **Change** e acrescente `,^p[A-Z][A-Za-z0-9]*$` ao final do campo `ignore`; salve. Em **Projects > Change projects > Without**, procure `K6-Runner` e associe o projeto aos dois perfis. Consulte a documentação de [criação](https://docs.sonarsource.com/sonarqube-server/quality-standards-administration/managing-quality-profiles/creating-a-quality-profile.md), [edição da regra](https://docs.sonarsource.com/sonarqube-server/quality-standards-administration/managing-quality-profiles/editing-a-custom-quality-profile.md) e [associação de projetos](https://docs.sonarsource.com/sonarqube-server/quality-standards-administration/managing-quality-profiles/associating-a-quality-profile-with-projects.md).

O `config/eslint.config.js` da raiz do k6 e o do frontend aceitam atualmente `format: ['camelCase', 'PascalCase']` com prefixo `p` para **parâmetros de função**. Portanto, ainda aceitam `pfoo`; o backend não possui essa regra. Um teste com ESLint também mostrou que `catch (pErro)` não é tratado por esse seletor de parâmetros. O ajuste no Sonar resolve a divergência relatada sem alterar o código consumidor. Se a intenção for **obrigar** `p` + PascalCase em todos os parâmetros, será preciso restringir essas configurações do ESLint, definir como tratar variáveis de `catch` e corrigir as ocorrências existentes nos três subprojetos. Isso é uma mudança de lint separada, com impacto potencial em arquivos já escritos.

Depois de alterar o perfil, confira o modo conectado e a sincronização em **Output > SonarQube for IDE** no VS Code; reabra ou salve o arquivo para obter os diagnósticos locais atualizados. Para atualizar a lista de issues **no servidor**, execute novamente, a partir do k6 e com seu `.envrc` carregado, `docker compose -f "$SONAR_STACK_COMPOSE" run --rm scanner`. O modo conectado e a análise completa têm ciclos separados.

Na reanálise deste piloto, o scanner carregou os dois novos perfis, concluiu com `EXECUTION SUCCESS` e o quality gate ficou `OK`. As 12 issues S7718 antigas de `pErro` aparecem no histórico como `CLOSED` / `FIXED`; a consulta de issues S7718 **não resolvidas** retornou zero. A confirmação visual no VS Code depende da próxima sincronização do modo conectado.

Para um teste reversível na IDE, crie temporariamente `tests/sonarqube-smoke.js` no k6, abra o arquivo e salve este código:

```javascript
function verificarSonar() {
  const valorNaoUsado = 42;
  return true;
}
```

A regra `javascript:S1481` (variável local não utilizada) continua ativa no perfil JavaScript herdado de **Sonar way** do projeto piloto. Aguarde a análise local e procure o problema no painel; apague o arquivo de teste depois. Se o painel continuar vazio, confira **SONARQUBE SETUP > CONNECTED MODE**, selecione a pasta k6 e confirme o binding `K6-Runner` antes de investigar o log **Output > SonarQube for IDE**.

O `sonar-project.properties` do k6 usa caminhos explícitos (`tests`, `scripts`, `config`, `infra/backend/src`, `infra/frontend/src` e `host-agent.js`) para não percorrer `node_modules`, documentos e artefatos gerados. Os scripts k6 sob `tests/` são tratados como código fonte neste piloto. Se o projeto passar a gerar cobertura e quiser classificar testes unitários separadamente, ajuste `sonar.tests`, inclusões e o caminho do relatório conforme a tabela acima.

## Dados legados

O compose antigo usava PostgreSQL 13 e volumes `sonar_db`, `sonar_data` e `sonar_logs`. A instalação atual usa volumes distintos para não tentar abrir o banco 13 diretamente com PostgreSQL 17 ou reutilizar índices antigos. Para preservar análises antigas, faça backup e siga o caminho de atualização compatível do SonarQube antes de migrar. Não execute `docker compose down -v` nem apague os volumes legados.
