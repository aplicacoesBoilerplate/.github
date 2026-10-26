# Governança: Templates de Issues e Pull Requests

Nossa gestão no **GitHub Projects V2** utiliza templates estruturados em `.github/ISSUE_TEMPLATE/` onde **Size** e **Estimate** medem o **valor agregado ao produto**, e não o esforço ou dificuldade técnica[cite: 2].

## Escala de Valor Agregado (Estimate 0 a 10)

| Tipo de Issue | Arquivo Template | Regra de Estimate e Size |
| :--- | :--- | :--- |
| **Épica de Release** | `issuePai.yml` | **Estimate 10 (Exclusivo)**, `Size: XL`, `Release: MAJOR`, `Effort: Team`. O título deve ser exatamente o nome da Milestone (`vX.Y.Z`)[cite: 2]. |
| **Release não épica** | `release.yml` | Entregas vinculadas a uma épica: **PATCH = 7**, **MINOR = 8**, **MAJOR = 9**[cite: 2]. |
| **Hotfix** | `hotfix.yml` | **Estimate 6 (Reservado)**. Correção urgente em produção com preenchimento do campo `Hotfix` (`Release` ou `Fix`)[cite: 2]. |
| **Feature** | `feature.yml` | Medida por valor agregado: **XS = 1** (docs/DX/modelagem), **S = 2** (pequeno ajuste), **M = 3** (feature padrão), **L = 4** (funcionalidade elaborada), **XL = 5** (novo recurso amplo)[cite: 2]. |
| **Task** | `task.yml` | Trabalho delimitado da sprint. **Homologação = 0**; ou acompanha a classe de valor (1 a 9)[cite: 2]. |
| **Bug na CLI** | `issueCLI.yml` | Relato de problemas na CLI Boilerplate Go com coleta do comando executado, ecossistema afetado (Java, Vue ou Setup) e logs do terminal[cite: 2]. |

---

## Regras para Pull Requests

1. **Título em Conventional Commits:** Validado pela pipeline `pull-request-hygiene.yml` (ex: `feat(core): implementar parser de milestone`)[cite: 3].
2. **Associação Obrigatória de Milestone:** Todo PR com destino à branch `master` deve estar vinculado à Milestone da Sprint (`vX.Y.Z`) para que o Orquestrador do Release Please fixe a versão correspondente.
3. **Múltiplas Entregas no mesmo PR:** Utilize rodapés em formato Conventional Commits no corpo da mensagem de commit do merge para que o Release Please registre todas as entradas no `CHANGELOG.md`.
