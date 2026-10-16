# Design da conciliação
A base é PR12; componentes do Maven local são incorporados por responsabilidade, sem sobrescrever Node.

## Mapa de reconciliação
| Área | PR12 | Local Maven | Decisão |
| --- | --- | --- | --- |
| Node | PR técnico, prefixos, App, diff/review | Ausente | Preservar e testar |
| Maven | stdout project.version, Java17, tag leve | Properties/SHA/plugin1.9, Java21, anotada | Usar coletor local e configurar prefixo nativo |
| Coleta | case Bash | Ports/registro ESM | Compor os três adaptadores |
| Tag prefix | literal e namespace | v fixo | Preservar input e isolamento de namespace |
| Escrita | ferramentas no job privilegiado | relatório read-only para Go/Maven | Estender materialização ao PR técnico Node |
| Guia | comum | distingue Properties/derivação | Preservar formato Go/Node, enriquecer Maven |
| Retry | Node origem vs merge e stale completo | snapshots de refs | Conciliar ambas garantias |
| CI | Go/Node/Maven legado | reactor118 Java21 | União das suítes, sem apagar assertions |

## Arquitetura
Process port filtra credenciais/opções, limita cwd/timeout. Registry allowlist -> adaptadores -> VersionReport schema1.
tagPrefix permanece opcional v; Go v-only. Fonte Maven Properties, sem fallback stdout.
Atualizar setup de fixtures Maven para plugin1.9/Properties preservando expectations; não relaxar assertions.
Bootstrap nativo0.0.1 e versões estáveis são gates, não cálculo paralelo.
Job read-only prepara relatório, snapshot, contexto funcional/técnico e, quando necessário, manifesto de arquivos de versão.
Writer valida evidência/currentPR/API e aplica apenas arquivos permitidos; não carrega código npm/Maven do consumer.
GitHub App só no escritor e token não é persistido no checkout. Commit técnico desabilita hooks e assinatura configuráveis do consumer.
Milestone/override permanecem política única. PR13 não é absorvido no12: comparar contrato e registrar necessidade de conciliação.

## Fontes e riscos
Código baseline fcf31e0 e local b4c783a. Context7 ausente no catálogo, fallback primário:
https://github.com/conventional-changelog/standard-version (depreciado; não migrar ferramenta sem pedido).
https://github.com/jgitver/jgitver-maven-plugin (Properties, branch detached, regexVersionTag).
Prefixos Maven precisam configurar regexVersionTag no consumidor; provar com ferramenta real.
Riscos: hooks/updaters Node no escritor, App token em processo nativo, refs alteradas, artifacts adulterados, base funcional != merge técnico.
Mitigar com jobs separados, schema/hash/path allowlists e snapshots, testes negativos e verificador fresco.
Remoto: push somente HEAD:refs/heads/codex/versioning-profiles se ancestral do HEAD remoto esperado; nenhum force/merge.
