# Caller integrado: triagem → central LLM → review

Exemplo copiável para um consumidor privado, não fork. Nenhum workflow deste diretório está ativo por si só. Configurações abaixo são genéricas: não são as do piloto nem credenciais da central.

## Adoção

1. Aguarde a publicação/revisão do commit central `e2027dd021a0dcfbb2f8fce08600d8aadb935284`. O código já existe nesse SHA local; não habilite uma referência ainda indisponível no remoto. Os três workflows e seus checkouts centrais usam o mesmo SHA imutável.
2. Copie a árvore `.github` deste diretório para a branch padrão do consumidor por PR revisado. Preserve seus workflows existentes e resolva colisões antes de ativar. Os nomes `triage.yml` e `review.yml` fazem parte do handoff; se os alterar, atualize também `triage_handoff.workflow_path` e `REVIEW_TARGET_WORKFLOW` nos jobs de dispatch.
3. Em `.github/triage/config.json`, substitua `consumer-org`, o Project 1 e os nomes de fields pelos metadados reais. Ajuste reviewer, allowlist, checks e stacked_bases. Estimate/Size/Effort e vínculos de release determinam a rota: metadados incompletos não autorizam correção.
4. Em `.github/review/config.json`, substitua `consumer-maintainer` e cada par id/login de `automation_actors` pelos autores reais dos PRs automáticos. Obtenha ambos na API de um PR; não adivinhe o ID nem aceite todos os bots. O login do reviewer precisa ser diferente do writer. Ajuste as mesmas allowlist/checks e os prefixos corrigíveis.
5. Confirme o nome real do job de conclusão da triagem em `triage_handoff.finish_job` (exemplo `triage / finish`). A prova consulta o attempt exato: nome, SHA ou conclusão incorretos bloqueiam o handoff. Ela não exige que o run inteiro tenha acabado enquanto o dispatch ainda está rodando.
6. Nos quatro JSON de `.github/llm`, substitua `MODELO_HABILITADO_NA_CONTA`; escolha modelo, esforço, modo e templates por tarefa. Os Markdown locais são enviados à LLM da revisão confiável. Para decision-then-prompt, acrescente a configuração decision e seu template conforme o contrato da central. Nenhum modelo ou prompt particular precisa ser cadastrado no repositório central.
7. Mantenha as regras próprias no AGENTS.md do consumidor. A central combina suas diretrizes globais integrais/versionadas com essas regras confiáveis; arquivos AGENTS do head do PR não substituem as diretrizes da default.
8. Configure os secrets/variável abaixo, revise os privilégios de Actions no consumidor e habilite os workflows somente após autorização. Não copie secrets para arquivos, inputs, artefatos ou para a central pública.

## Credenciais do consumidor

| Secret/variável | Finalidade e limite |
| --- | --- |
| `CLI_CODEX_SESSION` | JSON de sessão dedicada do Codex fornecido pelo mantenedor. Somente o job central recebe o conteúdo temporariamente. Não usar a sessão pessoal/global do agente nem compartilhar uma identidade central entre aplicações. |
| `CLI_CODEX_SESSION_WRITE_PAT` | Credencial restrita ao consumidor com permissão de Secrets para conferir metadados/chave pública e atualizar a sessão renovada. Não autentica a LLM nem publica PRs. A secret precisa ser de repositório, não apenas uma secret de organização/environment com o mesmo nome. |
| `AUTOMATION_METADATA_READ_TOKEN` | Leitura de Contents, Issues, Pull requests, Actions e do Project/fields/vínculos da organização configurada. Os endpoints de metadata não devem depender do token de escrita. |
| `REVIEW_DISPATCH_TOKEN` | Somente para o bridge de PR humano: Actions write e leituras necessárias no consumidor, com identidade de uma conta colaboradora cuja permissão write/maintain/admin possa ser conferida pela API. Não precisa de Contents write, Secrets write ou sessão da LLM. Não presumir que o bot padrão seja um colaborador. |
| `TRIAGE_VERIFICATION_IMAGE` (variável) | Imagem OCI `registro/imagem@sha256:<64 hex>` com dependências offline do produto. Exemplo de checks é Go; adapte a imagem/checks ao consumidor, sem instalar dependências pela rede dentro dos checks. |

Publicação usa o GITHUB_TOKEN do consumidor, com Contents/Issues/Pull requests write apenas nos jobs pertinentes. O dispatch pós-triagem usa o mesmo writer do PR e Actions write somente naquele job. Configure sua autoria id/login na política. Metadata, sessão e escrita não são herdadas indiscriminadamente.

Para optar por API key, altere ambos os jobs chamados (`triage`/`review`) para `auth_mode: api-key`; remova session_secret_name, CODEX_AUTH_JSON e CODEX_AUTH_WRITE_PAT; passe somente `OPENAI_API_KEY: ${{ secrets.SUA_SECRET_DE_API }}` para a modalidade. A chave continua privada no consumidor. Não forneça as duas modalidades ao mesmo tempo. Essa alternativa não é requisito do piloto com sessão.

## Como o fluxo opera

- Issue opened ou dispatch manual da triagem: coleta confiável → central → checks isolados → comentário de planejamento ou PR draft. Somente uma entrega com PR e inspeção bem-sucedida chega ao job dispatch.
- O dispatch ocorre depois do finish/persistência da triagem e cria outro run na default. Ele transmite só PR, head esperado, handoff e correlação. Não repassa uma cópia da sessão capturada pelo run anterior.
- PR humano aberto/reaberto/sincronizado: review-bridge usa pull_request_target, código central fixado e configuração da default. Não faça checkout do head nem acrescente execução de código do produto nesse job. Autoria/permissão e origem própria são conferidas antes do dispatch.
- Review lê configuração confiável, chama a central, valida achados e prepara eventual correção sobre o head exato. Checks só veem a proposta dentro do container, sem rede, secrets, socket Docker ou mounts da automação. Publicação reconstrói o patch original em outro workspace.
- A correção é outro PR draft cuja base é a branch head original. Não há push direto na branch original, aprovação, merge, fechamento automático ou transição de Project. Checks falhos geram draft-checks-failed. PR complementar com origem comprovada interrompe a cadeia; não se ignora genericamente todo draft ou bot.
- A fila de sessão é a mesma para triagem/review no consumidor, sem cancelamento. A publicação de review tem fila própria por PR. Não acrescente no caller a mesma chave de concorrência do called: isso pode criar deadlock.

## Resultados e inspeção

O called expõe status, error_code, route, PR original/complementar, source/base/merge-base/config SHA, fingerprint e artifact_name. O pacote v3 contém result.json, review.json com hash e proposal.patch opcional; retenção de um dia. O snapshot review-input também é restrito à execução.

O job inspect reconstrói a identidade esperada com outputs confiáveis, run/attempt atuais, configuração/instruções versionadas e SHA central fixado. O inspector nunca aplica patches ou aprova PRs. Ausência de achados não é aprovação. Diff incompleto/binário/acima de 16 KiB/100 arquivos gera intervenção explícita, não review completa vazia.

## Recuperação

- `STALE_REVIEW_INPUT`: PR/head/base/config mudou; solicite nova execução com o head atual. Não force publicação de um snapshot antigo.
- `REVIEW_RESOURCE_CONFLICT`: houve edição humana ou proposta divergente. Preserve o recurso; peça decisão ao mantenedor, sem sobrescrever body, mover ref ou fechar PR automaticamente.
- Erro de dispatch: confira o run_id/correlação emitidos e o run correspondente, nunca apenas o último run do workflow. Timeout pode ter criado a execução. O helper consulta a identidade exata antes de qualquer nova escrita; um run exato já reprovado não é recuperado como sucesso.
- Falha/freshness/conflito de sessão: siga a falha explícita, confira a secret dedicada e inicie um novo workflow_dispatch do review na default. Reexecutar um job antigo pode manter o snapshot antigo de credenciais. Para PR da triagem, preencha review_handoff_json com source_run_id, source_run_attempt, issue_number e source_fingerprint da publicação original; para PR humano use `{}`. Informe PR/head atuais; o dispatch_id manual pode ficar vazio.
- Upload, consulta, persistência ou cleanup falhos não equivalem a entrega aprovada. Depois de corrigir a causa, nova execução e revisão humana são necessárias. Nunca copie uma sessão renovada por logs ou artefatos.

## Limites de homologação

O exemplo não provisiona credenciais, não cria o consumidor e não homologa os serviços reais. Publicação/ativação e uso de sessão dedicada exigem autorização. O piloto deve provar issue→triagem→draft→review, duas execuções novas sequenciais e os cenários de fila/persistência/recuperação; refresh real só pode ser afirmado se observado. O SonarQube mantém seu fluxo corretivo após merge em develop, independente deste review.
