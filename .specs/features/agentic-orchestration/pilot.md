# Homologação remota

Marco autorizado: `20a456207bb8c436317107ca1dc85d90d15d6203`, merge do PR29.
A master e a tag v1.0.0 permanecem inalteradas nesta homologação.

## Evidências

- [Run 40806588561](https://github.com/aplicacoesBoilerplate/.github/actions/runs/40806588561): chave OpenRouter disponível ao caller; OpenCode executou no runner. Modelo liquid/lfm-2.5-2.6b:free forneceu argumento inválido ao GitHub MCP e omitiu o terminal. Coletor registrou `missing_terminal_safe_output`; execução reprovada, nenhum resultado promovido a sucesso.
- [Run 40807426485](https://github.com/aplicacoesBoilerplate/.github/actions/runs/40807426485): nova chamada com nvidia/nemotron-3.5-lightning:free. Catálogo OpenRouter consultado antes da seleção confirmou tools, contexto 1M e preços prompt/completion zero. Triagem deve reconhecer lacunas reais e finalizar por noop needs-human. Terminal noop real emitido; run reprovado pelo inspector porque o modelo omitiu repository/source_sha. Nenhuma operação foi publicada. O ajuste posterior vincula identidade confiável no exporter, sem criar terminal nem decisão artificial.
- [PR31](https://github.com/aplicacoesBoilerplate/.github/pull/31): integração limpa sobre o marco, preservando a branch feature original. Título, governança de versão, CI e build passaram nos runs iniciais. Substitui PR30, cujo histórico carregava Release-As antigo; nenhum histórico foi reescrito.

O caller antigo continua gerado pela ferramenta legada. O novo
`agentic-triage-homologation.yml` é nativo, tem acionamento manual e um push
limitado à sua própria mudança na branch de desenvolvimento, para possibilitar
o piloto antes de registrar esse arquivo na master. Não publica alterações.

- [Run 40808169668](https://github.com/aplicacoesBoilerplate/.github/actions/runs/40808169668): exporter passa a vincular repository/source_sha da execução, recusando identidade divergente quando fornecida pelo modelo. Decisão, enums, tipos e preservação das lacunas são validados antes da exportação. Brief ausente recebe a própria justificativa existente; o raw original continua no artifact do agente. Run reprovado porque o modelo omitiu action. Ação também é propriedade do evento, então o exporter posterior passa a vinculá-la ao contexto confiável; uma ação fornecida divergente continua sendo recusada.

## Configuração ainda necessária para operações

O readiness remoto confirmou ausência de `AGENTIC_PROJECTS_TOKEN`,
`AGENTIC_PUBLISH_TOKEN` e `AGENTIC_PROJECT_ID`. A API listou somente o Environment
github-pages; o gate de arquitetura não está provisionado.

No repositório `.github`, Settings → Secrets and variables → Actions:

- Secret `API_KEY_OPENROUTER`: já disponível pela organização; não duplicar.
- Secret `AGENTIC_PROJECTS_TOKEN`: token dedicado da identidade de automação,
  com leitura de Projects V2 da organização e leitura de issues/PRs/contents do
  consumidor. Não usar o valor de outra secret como placeholder.
- Secret `AGENTIC_PUBLISH_TOKEN`: token dedicado com contents/PRs em escrita e
  leitura de issues/Environments do consumidor. A publicação não exige guardar
  a credencial no workflow central.
- Variable `AGENTIC_PROJECT_ID`: `PVT_kwDOEtvXhs4Bkzok`, node ID consultado no
  Project GitHub Features (#12) da issue7 real.
- Variable `AGENTIC_AUTOMATION_ACTOR`: login efetivo do dono do token de publicação.

Em Settings → Environments, criar `agentic-architecture-approval` com required
reviewer humano `gersonfribeiro`. Não colocar aprovação automática nem considerar
Environment vazio equivalente à aprovação. Manter `AGENTIC_ENABLED` ausente/false
durante o preparo.

Provisionamento e teste das operações, cenários PR/push e gate humano permanecem
pendentes. Os checks estáticos e o piloto de triagem não comprovam esses cenários.

## Provisionamento pelo PAT do agente

O usuário confirmou que ainda não criou as duas secrets e perguntou como usar o PAT existente. Credencial local identificada pelo nome PAT_MCP_AGENTE_APLICACOES_BOILERPLATE, conta agentegersonfribeiro-AI; não copiar nem imprimir o valor em chat ou código. O token atual recebe 403 ao listar secrets/variables. Para provisionar essas configurações via API, conceder Secrets e Variables de repositório em read/write no token. Environments usam Actions read para consulta e Administration write para criação; a conta atualmente tem role write, não admin. Criação automática do Environment exige admin no repositório ou criação manual pelo usuário.

Terceiro run não é PASS. O ajuste posterior preserva status/tier/requires_sdd/lacunas/justificativa produzidos pela LLM; somente repository/source_sha/action são vinculados pelo workflow a fatos autoritativos. Brief fornecido deve ser texto não vazio. Nenhuma decisão ou terminal é fabricado para obter sucesso.
