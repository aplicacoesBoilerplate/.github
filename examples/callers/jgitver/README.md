# Caller jgitver

Copie os dois workflows para `.github/workflows/` no consumidor. O projeto
precisa de `pom.xml` e `.mvn/extensions.xml` com a extensão jgitver fixada;
use `jgitver-maven-plugin:1.9.0`, Java21 e Wrapper Maven3.9.9 revisado
(`mvnw` usado na CI deste exemplo). Sem wrapper, prepare explicitamente Maven3.9.9
antes de substituir o comando. O central não instala a extensão no projeto.
`target_branch`, Java, CI e environment devem refletir a aplicação. Para
tags de infraestrutura com prefixo próprio, alinhe `tag_prefix` à expressão
`regexVersionTag` de `.mvn/jgitver.config.xml`.

A publicação deriva a versão Maven no SHA integrado e não cria commit de POM.
Consulte o [contrato completo](../../../docs/versioning.md#callers-node-e-maven).
O [guia Maven](../../../docs/versioning-jgitver.md) explica bootstrap0.0.1,
checkpoints MINOR/MAJOR, versão única do reactor e teste remoto futuro.
