# Progresso da preparação remota

## T1

Definição OpenCode vendorizada do gh-aw32ecafbc061c9af57e9361942099e381102ae304, blob30452f27a8ef983209b2a7c631c292fb649a3cff, licença MIT preservada. Alterações locais: AWF obrigatório; política nativa deny por padrão com read/glob/grep; remoção defensiva das chaves de inferência do ambiente filho. Rotas/protocolo/reflection/contabilidade upstream preservados.

Gate: dois testes em agentic-remote-engine.test.ts executam o script real da definição com módulos de fronteira simulados. Asserções conferem endpoint do proxy, chave placeholder, pacote Chat Completions, ausência das chaves no filho e negação efetiva de shell/edit/external_directory. Sem AWF, o processo nativo não é chamado. Typecheck aprovado. Isso verifica o contrato do adapter; não equivale a um sandbox remoto executado.

Ferramenta de compilação local: gh-aw0.93.5; SHA256e1661fa10956ed969c33b9208790b2857148699dd5f9ab97a149c605bdfb2eb6, validado com checksums oficiais. Docker daemon local indisponível. Secret remota ainda não cadastrada segundo o usuário; instruções enviadas sem ler ou gravar a chave.
