# Setup Automático por Ecossistema (pre-commit)

Para que os ganchos do Git sejam instalados na máquina do desenvolvedor sem a necessidade de comandos manuais, adicione a ativação do `pre-commit` no fluxo padrão de build da stack.

## Pré-requisito Global

O desenvolvedor precisa ter o `pre-commit` instalado na máquina:

- **macOS:** `brew install pre-commit`
- **Windows / Linux:** `pip install pre-commit`

---

## Node / Vue / TypeScript

Adicione o script `prepare` no `package.json`. Ele é disparado automaticamente sempre que o desenvolvedor executar `npm install`:

```json
{
  "scripts": {
    "prepare": "pre-commit install --hook-type pre-commit --hook-type commit-msg"
  }
}
```

## Java com Maven

Adicione o exec-maven-plugin no pom.xml para registrar os hooks na fase initialize da compilação:

```xml
<plugin>
  <groupId>org.codehaus.mojo</groupId>
  <artifactId>exec-maven-plugin</artifactId>
  <version>3.5.0</version>
  <executions>
    <execution>
      <id>install-pre-commit</id>
      <phase>initialize</phase>
      <goals><goal>exec</goal></goals>
      <configuration>
        <executable>pre-commit</executable>
        <arguments>
          <argument>install</argument>
          <argument>--hook-type</argument>
          <argument>pre-commit</argument>
          <argument>--hook-type</argument>
          <argument>commit-msg</argument>
        </arguments>
      </configuration>
    </execution>
  </executions>
</plugin>
```

## Kotlin / Java com Gradle

Adicione uma task no arquivo build.gradle.kts para instalar o hook na compilação:

```kotlin
tasks.register<Exec>("installPreCommit") {
  commandLine("pre-commit", "install", "--hook-type", "pre-commit", "--hook-type", "commit-msg")
}
tasks.named("assemble") { dependsOn("installPreCommit") }
```

## Go

Adicione um comando ao alvo de inicialização no Makefile do repositório:

```Makefile
setup:
  pre-commit install --hook-type pre-commit --hook-type commit-msg
```

## Instalação manual e validação

Na raiz de um clone Git, depois de criar os [arquivos de configuração](/pipelines/pre-commit-config), execute:

```sh
pre-commit --version
pre-commit validate-config
pre-commit install --hook-type pre-commit --hook-type commit-msg
pre-commit run --all-files
```

`pre-commit` verifica os arquivos; `commit-msg` valida a mensagem. O último comando verifica os arquivos existentes e pode corrigi-los: revise o diff, adicione as correções e execute novamente. Ele não valida mensagens de commit.

Para testar a mensagem sem criar um commit, salve `feat: adicionar recurso` em um arquivo de texto UTF-8, por exemplo `mensagem-commit.txt`, e execute:

```sh
pre-commit run commitlint --hook-stage commit-msg --commit-msg-filename mensagem-commit.txt
```

A mensagem válida deve passar; substitua por `invalid: testar tipo` para comprovar a rejeição. Apague o arquivo de ensaio ao terminar. A primeira execução pode baixar os ambientes dos hooks e precisa de acesso à rede.

## Diagnóstico e convivência com outros hooks

- **Comando não encontrado:** confira `pre-commit --version` no mesmo terminal do build e o PATH do Python. Não esconda a falha com `|| true`.
- **Novo clone ou worktree:** repita a instalação; hooks não são entregues apenas por versionar o YAML. Consulte `git config --get core.hooksPath` e `git rev-parse --git-path hooks`; em worktrees, `.git` pode ser um arquivo.
- **Husky já configurado:** escolha um único gerenciador de hooks e planeje a migração de `core.hooksPath`. Este repositório central usa Husky; os exemplos acima orientam aplicações que adotam pre-commit. Não substitua um `prepare` existente sem preservar suas outras tarefas.
- **CI ou instalação com scripts desabilitados:** o `prepare` do npm pode não executar ou rodar fora de um clone. Separe a instalação local de hooks do build hospedado; não dependa de hooks locais para proteger o merge.

A CI deve manter checks obrigatórios próprios. Consulte a [referência do pre-commit](https://pre-commit.com/#usage) e os [eventos de scripts do npm](https://docs.npmjs.com/cli/v11/using-npm/scripts/).
