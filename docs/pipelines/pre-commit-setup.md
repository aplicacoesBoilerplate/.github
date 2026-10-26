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
    "prepare": "pre-commit install --hook-type commit-msg || true && pre-commit migrate-config"
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
          <argument>commit-msg</argument>
        </arguments>
        <successCodes><successCode>0</successCode><successCode>1</successCode></successCodes>
      </configuration>
    </execution>
  </executions>
</plugin>
```

## Kotlin / Java com Gradle

Adicione uma task no arquivo build.gradle.kts para instalar o hook silenciosamente na primeira compilação:

```java
tasks.register<Exec>("installPreCommit") {
  onlyIf { !file(".git/hooks/commit-msg").exists() }
  commandLine("pre-commit", "install", "--hook-type", "commit-msg")
  isIgnoreExitValue = true
}
tasks.named("assemble") { dependsOn("installPreCommit") }
```

## Go

Adicione um comando ao alvo de inicialização no Makefile do repositório:

```Makefile
setup:
  pre-commit install --hook-type commit-msg
```
