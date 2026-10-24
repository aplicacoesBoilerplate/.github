Prepara os três consumidores externos do versionamento centralizado. Separa GitHub Release da distribuição com publish-artifacts=false por padrão e acrescenta configuração nativa para Maven compartilhado e workspace npm independente.

A Action oficial continua nos modos single/manifest. Uma ponte TypeScript mínima usa a API pública do mesmo Release Please para aplicar milestone transitória na raiz configurada, atualizando revision/parents sem snapshot. A suíte existente usa o motor real e verifica XML, dependências, lockfile, tags propostas e negativos; sete casos, typecheck e auditoria de produção aprovados.

Callers reais ficam nas aplicações. Não publica pacotes ou binários, não altera aplicações neste PR e não encerra/reabre a issue #4. Merges permanecem humanos; ciclos reais dos consumidores serão acompanhados após suas integrações. Limites da etapa 2 documentados.
