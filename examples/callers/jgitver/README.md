# Caller jgitver

Copie os dois workflows para `.github/workflows/` no consumidor. O projeto
precisa de `pom.xml` e `.mvn/extensions.xml` com a extensão jgitver fixada;
`target_branch`, Java, CI e environment devem refletir a aplicação. Para
tags de infraestrutura com prefixo próprio, alinhe `tag_prefix` à expressão
`regexVersionTag` de `.mvn/jgitver.config.xml`.

A publicação deriva a versão Maven no SHA integrado e não cria commit de POM.
Consulte o [contrato completo](../../../docs/versioning.md#callers-node-e-maven).
