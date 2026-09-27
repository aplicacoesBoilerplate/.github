# Adoção do publicador Go

Copie o conteúdo de `.github/` deste diretório para `.github/` do repositório
consumidor. Ajuste `project_path`, `release_branch`, `target_branch`, o gatilho
`push`, o caminho de `go.mod` e os comandos da CI para a aplicação. A revisão
fixa do workflow deve permanecer igual na prévia e na publicação.

Leia o [contrato completo, pré-requisitos, opções nativas e efeito de cada
configuração](../../../docs/versioning.md#caller-go-copiável-da-primeira-liberação)
antes de habilitar a publicação. O exemplo tem `master`, Go na raiz e a sprint
`release/v1.0.0` como valores ilustrativos; eles não são universais.
