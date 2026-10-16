# Registro da publicação remota

## Entrega confirmada e CI hospedada aprovada

PR12 atualizado na branch `codex/versioning-profiles` com
`8256757ae861a9e10c7da4faaf8d743661f44cec`, por fast-forward e identidade
`agentegersonfribeiro-AI`. A [CI38836589007](https://github.com/aplicacoesBoilerplate/.github/actions/runs/38836589007)
terminou com `success` nesse SHA, e o check de título também passou.
Revisão humana de `gersonfribeiro` continua solicitada. Não houve merge.

Provas hospedadas:27 fixtures locais, contrato64 assertions; standard-version9.5.0
real; bootstrap2 replays/4 rejeições; jgitver1.9.0 real; reactor118 assertions e
prefixo Maven; Maven3.9.9/checagem de checksum inválido; Go real com bootstrap,
fix/feat/breaking/sprint. O fixture mvnw passou no Linux após T14, incluindo sua
assertion de executabilidade. Assim, a condição hospedada do
[parecer POSIX](posix-fixture-validation.md) foi satisfeita; o RED anterior foi
preservado abaixo, não apagado ou tratado como sucesso.

Este commit de registro modifica somente documentação/estado da entrega.
O código produtivo revisado permanece inalterado. Os checks do novo SHA
documental devem ser acompanhados separadamente, sem atribuir a ele o run acima.
Não há publicação de pacotes ou validação remota dos pilotos nesta evidência.
PR13 continua separado, com a conciliação necessária documentada em
[pr13-compatibility.md](pr13-compatibility.md).

Avisos não bloqueantes observados: actions fixadas ainda declaram Node20 e foram
executadas em Node24 pelo runner; `ubuntu-latest` anuncia futura migração; cache
Go sem go.sum na raiz não pôde ser restaurado. Nenhum aviso foi convertido em
skip de teste ou guard enfraquecido. Atualizar actions/runner é manutenção futura.

## Retomada: autenticação liberada e CI em correção

O escopo `workflow` foi confirmado na credencial do agente. O envio de
`73c0198a4ff38f671417fcb6429ce5e1106e129d` foi aceito por fast-forward na mesma
branch do PR12, com ator AI confirmado e sem modificar a conta ativa pessoal.
A API confirmou esse novo SHA. A [CI38836186739](https://github.com/aplicacoesBoilerplate/.github/actions/runs/38836186739)
falhou no fixture adapter-report: `mvnw` temporário sem bit executável no Linux
(`spawnSync EACCES`). T14 adiciona chmod755 e assertion POSIX, sem mudar runtime
de produção, remover testes ou relaxar guards. A confirmação hospedada é o próximo gate.

## Histórico da tentativa bloqueada

Em2026-10-15, a implementação passou na revisão independente
([validation.md](validation.md), código b7d2c6b;7/7 mutantes mortos).
O commit de registro da aprovação é `c3490549934c2689fa247bf9f29924e83a8dc696`.

Foi tentado somente o envio autorizado para o PR
[#12](https://github.com/aplicacoesBoilerplate/.github/pull/12), branch
`codex/versioning-profiles`, por fast-forward, sem merge ou force-push.
Antes do envio, a API confirmou ator `agentegersonfribeiro-AI`, ponta remota
`fcf31e08165156a5938eec7577bbf1be945f365f`, ancestralidade e árvore local limpa.
O token foi obtido da credencial armazenada e passado apenas pelo ambiente
do processo/credential helper; não foi impresso, gravado no Git ou incluído na URL.

GitHub recusou a atualização da referência:

```text
refusing to allow an OAuth App to create or update workflow
`.github/workflows/README.md` without `workflow` scope
```

Na tentativa original, a branch permaneceu em `fcf31e08165156a5938eec7577bbf1be945f365f`.
Naquele momento não havia CI hospedada nova nem PR duplicado. Não houve merge,
Release ou alteração dos pilotos, PR13 ou PR14. O SSH padrão autentica a
conta pessoal; ele não foi usado como alternativa de escrita.

## Ação necessária do mantenedor

Autorizar o escopo adicional na credencial OAuth do agente, usando a conta
correta também no navegador. Os comandos abaixo dependem de interação humana;
não foram executados automaticamente:

```powershell
gh auth switch --hostname github.com --user agentegersonfribeiro-AI
gh auth refresh --hostname github.com --scopes workflow
gh auth switch --hostname github.com --user gersonfribeiro
```

Depois, confirmar login/scopes sem imprimir token, reler ponta remota e
ancestralidade, enviar HEAD para a mesma branch por fast-forward e acompanhar
os checks do PR12. Se a ponta tiver mudado, integrar/revalidar antes do envio.
Nenhuma autorização para usar outra conta, force-push, merge ou publicação de
Release é inferida dessa retomada. Os novos commits locais de relatório não
alteram os scripts ou a implementação já aprovada.

O incidente de instalação npm fora do scratch está detalhado em
[validation.md](validation.md#incidente-do-harness-de-bootstrap).
`C:/Users/gerso/node_modules` foi preservado por não existir baseline confiável;
nenhuma limpeza desse diretório foi tentada.
