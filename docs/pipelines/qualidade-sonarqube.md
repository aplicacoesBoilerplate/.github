# Análise SonarQube Community (`sonarqube-scan.yml`)

O repositório `.github` centraliza a automação de inspeção de código contínua[cite: 3]. Utilizamos um workflow reutilizável (`workflow_call`) executado em runner `[self-hosted, Windows]` que utiliza Docker (`sonarsource/sonar-scanner-cli`) para analisar o repositório consumidor[cite: 3].

## Pré-requisito no Consumidor

O repositório da aplicação deve obrigatoriamente possuir o arquivo `sonar-project.properties` versionado na raiz[cite: 3].

## Exemplo de Caller (SonarQube)

Para acionar a análise, crie a pipeline abaixo no repositório da aplicação:

```yaml
name: SonarQube Analysis

on:
  push:
    branches: [master, develop]

jobs:
  sonarqube:
    uses: aplicacoesBoilerplate/.github/.github/workflows/sonarqube-scan.yml@master
    with:
      project_key: 'meu-projeto-key'
      sonar_host_url: '[http://sonarqube.interno:9000](http://sonarqube.interno:9000)'
    secrets:
      sonar_token: ${{ secrets.SONAR_TOKEN }}
```
