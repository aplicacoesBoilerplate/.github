# Progresso da preparação remota

## T1

Definição OpenCode vendorizada do gh-aw32ecafbc061c9af57e9361942099e381102ae304, blob30452f27a8ef983209b2a7c631c292fb649a3cff, licença MIT preservada. Alterações locais: AWF obrigatório; política nativa deny por padrão com read/glob/grep; remoção defensiva das chaves de inferência do ambiente filho. Rotas/protocolo/reflection/contabilidade upstream preservados.

Gate: dois testes em agentic-remote-engine.test.ts executam o script real da definição com módulos de fronteira simulados. Asserções conferem endpoint do proxy, chave placeholder, pacote Chat Completions, ausência das chaves no filho e negação efetiva de shell/edit/external_directory. Sem AWF, o processo nativo não é chamado. Typecheck aprovado. Isso verifica o contrato do adapter; não equivale a um sandbox remoto executado.

Ferramenta de compilação local: gh-aw0.93.5; SHA256e1661fa10956ed969c33b9208790b2857148699dd5f9ab97a149c605bdfb2eb6, validado com checksums oficiais. Docker daemon local indisponível. Secret remota ainda não cadastrada segundo o usuário; instruções enviadas sem ler ou gravar a chave.

## T2

Gerador reutiliza a config do consumidor, incorpora diretrizes/prompts/inputs versionados e gera manifesto LF. Dois callers YAML manuais mapeiam secret e modelo explicitamente para dois calleds gh-aw workflow_call. Nenhuma leitura de credencial pelo gerador. Locks produzidos por gh-aw0.93.5, strict/validate, actions pin32ecafbc. .github/aw/actions-lock.json fixa resoluções; .gitattributes gerado identifica locks.

A compilação real corrigiu premissas do desenho: secret em engine.env é excluída do agente e rejeitada em strict; usar secret de workflow_call. O pin injeta create-issue quando safe-outputs é omitido; todos handlers foram explicitamente false, inclusive report-failed-jobs. AWF exige MCP: um GitHub readonly/get_file_contents mantém o sandbox. bash:false não é suportado pelo sample; a negação está no harness nativo. Testes WIP foram ajustados para a interface realmente suportada, preservando e fortalecendo os resultados contratuais (sem auth no agente, sem escrita), sem remover casos.

Cobertura e necessidade: agentic-remote-workflows.test.ts:14 Object.keys(WORKFLOW.on) confirma workflow_call; linhas18–21 recusam jobs/escalada; linhas24–32 conferem AWF, modelo, rota e exclusão de chaves; linhas45–59 conferem mapeamento explícito do caller e fonte do prompt; teste ARP-01 de mudança de modelo/secret comprova configuração adaptável e rejeita interpolação. Todos mapeiam ARP01–03; sem testes de documentação. Gate: 5/5 contratos, typecheck e dois locks strict/validate sem avisos. AWF remoto não executado.
