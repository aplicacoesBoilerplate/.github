# Caller reutilizável de LLM

Este exemplo configura uma chamada ao central e verifica o resultado em outro job. Modelo, esforço, prompts e credenciais pertencem ao consumidor. O central não fornece uma conta ChatGPT global.

A referência fixa `4301c87e422bee521e2dbe0ccd1283b40c76e499` contém o workflow e os scripts validados localmente. **Publicação dessa revisão ainda está pendente:** o exemplo só pode rodar no GitHub depois que o mantenedor autorizar e publicar esse commit. Não substituir por uma branch móvel para contornar essa pendência. Esta entrega não comprova login/inferência reais.

## Instalação no consumidor

1. Copie `.github/workflows/llm.yml` e a pasta `.github/llm/` deste exemplo para o repositório privado consumidor, na branch padrão.
2. Configure um modelo efetivamente disponível na sua conta em `.github/llm/analyze.json`. `MODELO_HABILITADO_NA_CONTA` é um marcador de configuração, não um modelo escolhido pelo central.
3. Edite o prompt versionado em `.github/llm/analyze.md` e o contexto da chamada no YAML.
4. Quando adotar o fluxo real, provisione as secrets do próprio consumidor descritas abaixo. Não colocar valores no JSON/YAML, nos prompts, em logs ou no repositório central.
5. Depois de publicar/revisar a referência central fixa, execute o workflow manualmente pela branch padrão do consumidor. O MVP não aceita evento de PR, fork ou branch arbitrária.
6. O job `inspect` verifica identidade, hashes e arquivos. Abra o artefato de um resultado aprovado para ler o resumo/proposta. O exemplo não modifica código, issues ou PRs.

As cópias do caller e da configuração são recursos do consumidor, adaptáveis para triagem e code review. Essas pipelines poderão acrescentar seus eventos e ações de domínio em versões futuras do contrato; os eventos correspondentes ainda não estão habilitados neste MVP.

## Autenticação ChatGPT pelo Codex CLI

O exemplo principal usa `auth_mode: chatgpt-session`. Não requer chave de API nem faturamento API separado.

Para futura adoção, crie um perfil dedicado do Codex em processo separado do perfil de desenvolvimento. Aponte o ambiente `CODEX_HOME` desse processo para um diretório exclusivo e configure `cli_auth_credentials_store = "file"`. Faça login com `codex login` e confira localmente que o arquivo gerado possui `auth_mode: "chatgpt"` e tokens gerenciados (incluindo refresh). Mantenha esse arquivo fora do Git.

No GitHub do consumidor, em Settings → Secrets and variables → Actions, crie **repository secrets**:

| Secret no consumidor | Mapeamento para o called | Conteúdo / finalidade |
| --- | --- | --- |
| `CLI_CODEX_SESSION` | `CODEX_AUTH_JSON` | Conteúdo completo do auth.json do perfil dedicado |
| `CLI_CODEX_SESSION_WRITE_PAT` | `CODEX_AUTH_WRITE_PAT` | Fine-grained PAT com Secrets: write somente nesse consumidor; aprovação da organização se exigida |

`session_secret_name: CLI_CODEX_SESSION` precisa corresponder ao nome da secret que forneceu o JSON. O central deriva o destino de `github.repository`; não existe parâmetro para escrever em outra organização/repositório. O PAT não autentica na LLM e nunca chega ao processo do modelo. O GITHUB_TOKEN do job tem somente contents/actions read.

Não copie a mesma sessão renovável entre repositórios ou use-a simultaneamente no perfil pessoal. Uma sessão corresponde a um fluxo serializado. O Codex renova o arquivo; o central preserva a versão válida alterada na mesma secret do consumidor. Isso não elimina a necessidade eventual de novo login humano.

Provisione secrets quando houver adoção real. A implementação/testes locais desta entrega usam fixtures, sem acessar a sessão pessoal do mantenedor.

## Alternativa API, somente opt-in

`variants/llm-api-key.yml` pode substituir o workflow principal, mantendo os mesmos arquivos de configuração/inspeção. Ele mapeia apenas `CLI_OPENAI_API_KEY` do consumidor para `OPENAI_API_KEY` e usa `auth_mode: api-key`. Exige chave e faturamento próprios desse consumidor. Não é necessário para o piloto ChatGPT nem fallback automático.

Não misture as credenciais das duas modalidades. Não usar `secrets: inherit`. Trocar a modalidade não muda modelo, prompt ou template silenciosamente.

## Entradas e configuração

| Campo do caller | Uso |
| --- | --- |
| `invocation_id` | Identidade estática de até 48 caracteres; comece com letra minúscula. Distinta por chamada no mesmo run/attempt |
| `config_path` | JSON relativo à raiz, regular e confiável, até 240 caracteres. Ao trocar, atualize também EXPECTED_CONFIG_PATH no inspector |
| `source_ref` | Branch padrão definida pelo caller; será resolvida para SHA antes do checkout |
| `context_json` | Objeto JSON de até 32 KiB enviado como dados para a LLM |
| `auth_mode` | chatgpt-session ou api-key explícito |
| `session_secret_name` | Nome uppercase da repository secret, obrigatório só no modo de sessão; sem prefixo GITHUB_ |

O JSON da invocação é fechado e versionado:

| Campo | Valores |
| --- | --- |
| `schema_version` | 1 |
| `invocation_mode` | single ou decision-then-prompt |
| `execution.model` / `decision.model` | Identificador escolhido pelo consumidor; disponibilidade real depende da conta |
| `effort` | low, medium, high; deve ser suportado pelo modelo escolhido |
| `template` | analyze ou propose-patch para execução; decision para etapa de decisão |
| `template_path` | Alternativa exclusiva a template: arquivo UTF-8 próprio do consumidor, não vazio, até 32 KiB |

Escolha exatamente `template` ou `template_path` em cada etapa. Não usar caminhos absolutos, traversal ou symlinks. O texto próprio chega literalmente à LLM, junto ao contexto e código como dados; não há shell interpolation nem execução de comandos do prompt.

Em single, somente execution existe. Em decision-then-prompt, decision e execution são obrigatórios. `examples/decision-then-prompt.json` demonstra a configuração; a primeira etapa devolve proceed/skip/needs-human. Somente proceed inicia a execução configurada. A escolha do modelo não é substituída pelo central.

Templates próprios mantêm o schema de resposta: decisão usa decision/reason; execução usa summary/patch (patch textual ou null). Não fornecer credenciais nos prompts. O global AGENTS integral versionado e o AGENTS do consumidor são combinados; skills pessoais citadas não são instaladas automaticamente. Harness/provedores adicionais ficam para evolução posterior.

## Resultado e consumo

Outputs: `status`, `decision`, `artifact_name`, `source_sha`, `automation_sha`, `request_id`, `error_code`. Status de sucesso técnico pode ser succeeded, skipped ou needs-human; erro/cancelamento não autoriza uso.

O caller exige sucesso do job e status succeeded antes do inspector. O pacote retido por um dia contém result.json e, quando houver proposta, proposal.patch. É vinculado ao repo, run, attempt, invocation_id, SHA de fonte, SHA central e hashes de configuração/instruções. Mudando invocation_id, atualize também EXPECTED_INVOCATION_ID no inspector.

O inspector reutiliza o validador da mesma revisão central, confere o checkout/configuração/instruções e recusa arquivos extras ou patch inválido. Não executar arquivos do artefato como scripts. Triagem/review devem revalidar o SHA vigente, revisar/applicar a proposta em seus jobs próprios e manter seus gates; resposta da LLM não aprova merge nem substitui SonarQube.

Ao atualizar a referência central, altere **tanto** o uses da chamada quanto o checkout central de inspeção para o mesmo SHA revisado.

## Limites e recuperação

O MVP entrega proposta, com ferramentas de execução desativadas. Código é um snapshot de até 1 MiB; não há execução de build/testes/hooks do consumidor. .git/.codex/.agents, dependências/build/coverage e arquivos de credenciais são excluídos; binários são identificados, sem conversão textual. Instruções: até 64 KiB; resposta/pacote: até 1 MiB; inferência: até 10 minutos agregados, sem retry automático. Job: 15 minutos.

| Falha | Ação |
| --- | --- |
| INVALID_CONFIG / INSTRUCTIONS_INVALID | Corrigir JSON, paths, templates ou limites; não ocorre fallback |
| UNTRUSTED_CONTEXT | Usar branch/evento/repo confiáveis. Se a branch avançou entre resolução e execução, iniciar novo run |
| AUTH_CONFIG_ERROR / AUTH_REQUIRED | Corrigir mapping/modalidade ou reautenticar o perfil dedicado |
| AUTH_SNAPSHOT_STALE | Criar **novo run**, após rotação da secret. Rerun preserva a criação original e pode continuar inválido |
| AUTH_STATE_CONFLICT | Pausar manutenção externa, conferir sessão atual e retomar sem sobrescrever concorrência |
| AUTH_PERSIST_FAILED | Verificar PAT/permissão; se refresh foi perdido, reseedar sessão antes de retomar |
| PROVIDER_ERROR / TIMEOUT | Corrigir indisponibilidade/modelo/limite e iniciar tentativa explícita |
| INVALID_RESULT / ARTIFACT_FAILED | Não usar a proposta; conferir contrato/upload e executar novamente após correção |

Secrets de repositório são capturadas ao criar o run; esperar na fila não atualiza esse snapshot. A fila serializa repo/secret sem cancelar a execução em andamento. Se a sessão mudou depois da criação do run, ele falha antes de usar o snapshot antigo.

Não editar a secret externamente durante jobs. GitHub não oferece compare-and-swap: o guard de metadata reduz conflitos, mas não garante atomicidade com intervenção externa. Cancelamento forçado ou perda do runner pode impedir persistência; verificar/reprovisionar antes de reativar.

## Validação e piloto

O projeto central roda `npm --prefix scripts/llm test`, check de sintaxe e actionlint fixado. Testes simulam dois callers, modalidades, ausência de credenciais, resultado vinculado ao SHA e falhas de persistência/publicação. São evidência de contratos, não de autenticação real.

O piloto futuro usa este mesmo caller em consumidor privado. Registrar dois runs novos sequenciais, comportamento diante de sessão atualizada enquanto enfileirado, persistência recusada e recuperação, sem valores de secrets nos logs/evidências. A entrega atual ainda não inclui essa homologação nem publicação remota.
