# .github

Recursos reutilizáveis de colaboração e automação para projetos GitHub: templates
de issues/PRs e workflows chamados por pipelines menores nos consumidores.

- [Constituição e princípios](.specify/memory/constitution.md)
- [Versionamento por sprint: contratos, gates e exemplos](docs/versioning.md)
- [Caller Go copiável e configuração do consumidor](examples/callers/go/)
- [Especificação e estado da issue #2](specs/001-versionamento-por-sprint/spec.md)
- [Planejamento TLC da pipeline LLM (#9), em revisão](.specs/features/issue-9-llm-centralizado/spec.md)

Os workflows compartilhados devem ser referenciados por revisão fixa ou tag
estável já publicada. Testes e consumidores mínimos ficam no repositório
[LocalLabs](https://github.com/GersonTekSystem/LocalLabs).
## MVP de invocação LLM

O workflow central e o caller configurável estão em desenvolvimento para a issue #9. Modelo, prompt e autenticação são definidos pelo consumidor. Consulte [o caller e suas instruções de adoção](examples/callers/llm/README.md). Credenciais não são distribuídas pelo repositório central. A referência fixa do exemplo ainda precisa ser publicada e homologada antes do uso remoto.
