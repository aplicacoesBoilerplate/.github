# Proposal

## Why

A issue #8 pede revisão automática quando um PR é aberto, reaproveitando a pipeline de LLM e o padrão de decisão da triagem. O desenho original vinculava essa revisão a uma análise SonarQube antes do merge, mas a decisão posterior do fluxo tornou o SonarQube corretivo após integração em `develop`; os dois controles precisam permanecer separados.

## What Changes

- Criar workflow reutilizável de code review, chamado por um caller enxuto do repositório privado para PRs elegíveis independentemente da combinação de branches, que reuse a autenticação, modelos e prompts da issue #9.
- Publicar achados contextualizados no PR e, quando houver patch seguro para PR de feature, entregar a correção por PR complementar revisável; o workflow central não edita código.
- Tratar PRs de integração e origens não confiáveis sem aplicação automática, evitar loops e não duplicar revisões para o mesmo SHA.
- Documentar evento, configuração, called, fluxo de decisão, outputs e limites de permissão.
- Separar explicitamente code review preventivo do SonarQube corretivo da issue #5: a revisão não aciona o SonarQube nem altera o Project para `Request changes` por falha de Quality Gate.

## Capabilities

### New Capabilities

- `pr-code-review-automation`: Revisão de PRs com LLM, publicação de achados e correções propostas por PR complementar.

### Modified Capabilities

Nenhuma.

## Impact

Novo workflow reutilizável de domínio, caller de exemplo, validação de patches e documentação. Depende da issue #9 para inferência e da issue #7 para convenções de roteamento, idempotência e entrega; não requer SonarQube online no MVP. Não concede aprovação automática ao PR original, não faz merge nem muda o Status do Project com base apenas em achados da LLM.
