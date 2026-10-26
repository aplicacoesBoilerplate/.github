# Progresso da preparação remota

## T1

Definição OpenCode vendorizada do gh-aw32ecafbc061c9af57e9361942099e381102ae304, blob30452f27a8ef983209b2a7c631c292fb649a3cff, licença MIT preservada. Alterações locais: AWF obrigatório; política nativa deny por padrão com read/glob/grep; remoção defensiva das chaves de inferência do ambiente filho. Rotas/protocolo/reflection/contabilidade upstream preservados.

Gate: dois testes em agentic-remote-engine.test.ts executam o script real da definição com módulos de fronteira simulados. Asserções conferem endpoint do proxy, chave placeholder, pacote Chat Completions, ausência das chaves no filho e negação efetiva de shell/edit/external_directory. Sem AWF, o processo nativo não é chamado. Typecheck aprovado. Isso verifica o contrato do adapter; não equivale a um sandbox remoto executado.

Ferramenta de compilação local: gh-aw0.93.5; SHA256e1661fa10956ed969c33b9208790b2857148699dd5f9ab97a149c605bdfb2eb6, validado com checksums oficiais. Docker daemon local indisponível. Secret remota ainda não cadastrada segundo o usuário; instruções enviadas sem ler ou gravar a chave.

## T2

Gerador reutiliza a config do consumidor, incorpora diretrizes/prompts/inputs versionados e gera manifesto LF. Dois callers YAML manuais mapeiam secret e modelo explicitamente para dois calleds gh-aw workflow_call. Nenhuma leitura de credencial pelo gerador. Locks produzidos por gh-aw0.93.5, strict/validate, actions pin32ecafbc. .github/aw/actions-lock.json fixa resoluções; .gitattributes gerado identifica locks.

A compilação real corrigiu premissas do desenho: secret em engine.env é excluída do agente e rejeitada em strict; usar secret de workflow_call. O pin injeta create-issue quando safe-outputs é omitido; todos handlers foram explicitamente false, inclusive report-failed-jobs. AWF exige MCP: um GitHub readonly/get_file_contents mantém o sandbox. bash:false não é suportado pelo sample; a negação está no harness nativo. Testes WIP foram ajustados para a interface realmente suportada, preservando e fortalecendo os resultados contratuais (sem auth no agente, sem escrita), sem remover casos.

Cobertura e necessidade: agentic-remote-workflows.test.ts:14 Object.keys(WORKFLOW.on) confirma workflow_call; linhas18–21 recusam jobs/escalada; linhas24–32 conferem AWF, modelo, rota e exclusão de chaves; linhas45–59 conferem mapeamento explícito do caller e fonte do prompt; teste ARP-01 de mudança de modelo/secret comprova configuração adaptável e rejeita interpolação. Todos mapeiam ARP01–03; sem testes de documentação. Gate: 5/5 contratos, typecheck e dois locks strict/validate sem avisos. AWF remoto não executado.

## T3

Guard pre/post confere evento manual, SHA do checkout, modelo real do caller e os snapshots gerados. Registra hashes dos inputs/config, todos os arquivos versionados, repositório/run/attempt e estado pending. A conclusão só vira verified quando tudo permanece idêntico. Nenhuma credencial entra no registro; inferenceStatus permanece not-assessed e sonarStatus not-run, pois integridade não aprova análise.

Critérios/necessidade: agentic-remote-guard.test.ts:45–54 confere valores da proveniência e ausência da sentinela; linhas61–65 rejeitam modelo/evento/SHA/contexto divergentes; linhas75–79 adulteram fonte com assume-unchanged e comprovam falha sem evidência verified. Cobrem ARP04–05, sem testes de texto/documentação. Oito testes remotos passam com typecheck. Estado fixture Git é isolado e apagado somente após verificar o prefixo temporário. Nenhuma inferência real nem credencial usada.

## T4

Compilador bootstrap fixado para Windows/Linux x64 verifica SHA256 antes de executar; modo check compara fontes e locks antes/depois. CI reproduz a compilação sem secret de LLM e sem inferência. Instruções do consumidor cobrem secret, interface called/caller, atualização de modelo/prompt, integração humana, dispatch, artefatos, falhas e limites. Documentação não tem testes automatizados.

Gate real: npm run compile:agentic -- --check reproduziu os dois locks com gh-aw0.93.5 strict/validate e zero avisos; tipo TypeScript aprovado. Os testes do programa compilado validam permissões somente read/none, ausência de publicação/detection, exclusão de chaves reais pelo AWF, endpoint/basepath, modelo e max-turns. Cadastro de secret, integração em branch padrão e primeiro run remoto permanecem pendentes. A revisão independente roda automaticamente após este commit.

## T5 — revisão independente, primeira correção

O verificador encontrou três mutações sobreviventes nos testes de proveniência/integridade, sem defeito funcional demonstrado. Reforçados os mesmos três casos: hashes do config/inputs comparados aos valores reais calculados com crypto, e adulteração com assume-unchanged tanto no AGENTS já coberto quanto em outro arquivo versionado fora do manifesto. Todas as asserções anteriores foram preservadas. Sem aumento de casos por meta.

Gate no Node22 da CI: 86/86 testes passam, zero skips; typecheck aprovado. O relatório inicial FAIL fica no histórico para rastreabilidade; revisão2 deve reexecutar os mutantes antes de encerrar a preparação. Não houve publicação nem inferência remota.

## Fechamento da preparação

Revisão2 confirmou PASS de preparação: baseline8/8 contratos e os três mutantes sobreviventes agora mortos. Cinco riscos de autenticação/política/modelo já discriminados na rodada1; total8/8. Suíte completa86/86 no Node22 e tipos aprovados. Relatório distingue contrato simulado de homologação remota: cadastro da secret, publicação/integração e primeiro run ainda pendentes. A chave real não foi utilizada nesta preparação e não foi gravada no repositório.

## Cadastro da credencial remota

Em 2026-10-26 o usuário confirmou o cadastro da secret API_KEY_OPENROUTER. Seu valor não foi acessado e nenhuma inferência foi disparada. Publicação/integração dos workflows e primeiro run real permanecem pendentes.

## Publicação autorizada e CI remota

Em 2026-10-26 o usuário autorizou o push e o PR draft. Branch publicada e PR24 aberto por agentegersonfribeiro-AI para release/v1.0.0, milestone v1.0.0, label Pipelines, Project GitHub Features/In review; Priority Urgent, Size XL, Effort Team, Estimate5 da #9. Revisão solicitada a gersonfribeiro. Referências não fecham as issues7–9; PRs14–16 preservados.

Base formal da milestone está53 commits atrás da master4176883. O corpo do PR distingue esse baseline já publicado do intervalo próprio do piloto e exige alinhar a integração antes do merge. A release e a master não foram alteradas.

CI remota40411970600 passou em3559bd9, incluindo testes/types/reprodução gh-aw Linux. Higiene40411970659 e build de documentação40411970613 também passaram. Essas execuções não chamam LLM: o primeiro run de inferência AWF/OpenRouter continua pendente de revisão e integração dos callers na branch padrão.

## Integração e primeiro piloto remoto

PR24 foi squash-mergeado pelo usuário em release/v1.0.0,084f826. A reconciliação b582d3b recuperou a ancestralidade da master4176883 mantendo exatamente a árvore bf7ada4d5b553736ca2b0f0f944be78dbae379d4. Develop remoto foi restaurado da master publicada, preservando o develop local em outro worktree. PR25 homologou via squash077bcdd com mensagem própria: o agregado do PR24 continha um footer histórico de versão já publicada. PR26 promoveu develop→master em ad203b6 após CI e política SemVer aprovadas. A árvore permaneceu idêntica; nenhum gate foi desativado ou autoaprovado. O PR técnico Release Please27 permanece aberto, sem publicação de tag/milestone/épica.

Run40416458541 chegou ao OpenCode/AWF, mas falhou com HTTP400 unknown_model_ai_credits para liquid/lfm-2.5-2.6b:free. O guard pós-execução confirmou workspaceIntegrity verified; isso não aprovou a inferência. A causa é falta de tarifa no catálogo interno AWF, antes da chamada ao modelo. API pública OpenRouter consultada confirmou prompt/completion zero. O pin gh-aw32ec suporta models.providers; AWF0.28.70 aceita zero no overlay exato, comprovado também por execução isolada do módulo upstream em memória. Não foi preciso acessar o valor da chave.

T6 acrescenta pricing opcional ao contrato, valida finitude/valor não negativo, transporta por modelo exato e recompila os locks. Um caso novo e reforços nos casos existentes demonstraram falha antes da correção (campo desconhecido/catálogo ausente) e passaram depois. A configuração do piloto declara preços zero explicitamente; outras configurações não recebem gratuidade automática. Sem fallback global, troca de modelo ou alteração do firewall/orçamento.

Verificação local T6: o teste preexistente AGP-05 timeout encerra também subprocessos do harness falhou uma vez na suíte Node22 sob carga Windows (86/87), enquanto a compilação também rodava. O arquivo runtime passou8/8 isoladamente sem qualquer mudança de teste ou código; a suíte foi repetida serialmente sem compilação concorrente. Essa observação fica registrada, não é atribuída à correção de pricing. T6 permanece um único contrato opcional que atravessa parser/renderer/config/locks, justificando o aviso estrutural de granularidade.

Gate final T6: suíte serial Node22 passou87/87, zero skips; tipos e reprodução dos dois locks strict/validate aprovados. Testes necessários: agentic-config.test.ts compara preço zero/ausência e rejeita inválidos; agentic-remote-workflows.test.ts compara preços zero no JSON efetivamente entregue ao AWF, ausência de fallback e tarifas não zero de outro modelo selecionado. Nenhum teste anterior foi removido ou enfraquecido. Revisão independente da correção segue automaticamente.

## T7 — rota observada no piloto remoto

PR28/CI40418152607 passou. A revisão independente de T6 aprovou8/8 contratos, tipos e3/3 mutações detectadas; relatório pricing-validation.md. O piloto40421313262 no SHA94745c5 passou pricing, mas GET/v1/models e POST/v1/chat/completions receberam404. Proveniência confirmou workspaceIntegrity verified, inferenceStatus not-assessed e sonarStatus not-run. Review40421333266 foi cancelado antes da inferência para evitar a mesma falha.

Diagnóstico independente executou buildUpstreamPath oficial do AWFv0.28.70: prefixo/api/v1 + entrada/v1/... produz /api/v1/v1/.... upstream-log.js registra req.url, não o caminho final. O fix mantém o harness/reflection e configura somente o prefixo técnico do AWF como https://openrouter.ai/api; as chamadas resultam em /api/v1/models e /api/v1/chat/completions. A URL pública direta do provedor não mudou. O fetch inicial do catálogo do pin pode falhar em /api/models sem abortar; o helper recupera usando /v1/models. Sem troca de modelo/chave, fallback ou alteração do firewall.

Os mesmos testes de geração/lock foram corrigidos e primeiro falharam2/3 na expectativa da URL antiga. Asserções adicionais conferem os dois caminhos upstream; não foi criado outro conjunto de testes. Compilação strict/validate dos dois locks passou sem avisos. Suíte completa/tipos/reprodução e novo piloto devem passar antes da promoção.

Gate T7: Node22.23.4 executou87/87 testes, zero falhas/skips; typecheck e reprodução strict/validate dos dois locks passaram com zero avisos. A revisão independente final segue após o commit; isso ainda não é sucesso de inferência remota.

Fontes pinned: https://github.com/github/gh-aw-firewall/blob/v0.28.70/containers/api-proxy/proxy-utils.js#L170; https://github.com/github/gh-aw-firewall/blob/v0.28.70/containers/api-proxy/upstream-http.js#L619; https://github.com/github/gh-aw-firewall/blob/v0.28.70/containers/api-proxy/upstream-log.js#L261; https://github.com/github/gh-aw/blob/32ecafbc061c9af57e9361942099e381102ae304/actions/setup/js/awf_reflect.cjs#L338.
