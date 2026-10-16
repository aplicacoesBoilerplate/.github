# Publicação remota: bloqueada pela credencial

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

A branch remota continua em `fcf31e08165156a5938eec7577bbf1be945f365f`.
Não há CI hospedada da nova revisão nem PR duplicado. Não houve merge,
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
