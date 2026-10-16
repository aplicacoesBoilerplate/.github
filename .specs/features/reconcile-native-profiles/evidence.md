# Evidências da conciliação

## T1

Baseline de entrada fcf31e0 PR12, local b4c783a preservado. API PR12 e13 lidos; baseline suite13 iniciada. validate_spec zero erros/avisos; validate_tasks zero erros e3 avisos documentais/diagramparsing, crosscheck manual sequencial Match. REC-01/06 autorizados em 2026-10-15, push fast-forward PR12 e execução neste chat. Nenhum piloto/merge/deploy autorizado. Context7 ausente, fontes oficiais consultadas. Testes não aplicáveis a planejamento; tools e gates definidos antes do código.

## T2

Red: module missing. Quick PASS process-runner.mjs. REC-04: tests/process-runner.mjs:13 assert.deepEqual credentials null/visible retained, :15 assert.throws outsideworkspace, :16 timeout, :17 exit7, :19 missingcommand; argv/stdout assertions exact. Porta reutilizada b4c783a sem mudança, diretório confinado e env explícito; sintaxe/diff PASS. Toda assertion corresponde fronteira de execução; sem excluir testes baseline.

## T3

Red module missing; Quick Properties PASS. java-properties.mjs:3 assert.deepEqual nativas/escapes/unicode/continuação e :7-10 assert.throws malformed/duplicação/truncado/tipo. REC-02 parsing exato e falha fechada, sem fallbackstdout; fonte b4c783a preservada. Diff PASS, nenhum teste existente alterado.

## T4

Red novo relatório: API stdout não aceita Properties. Quick PASS novo contrato, version-report30 e policy54; diff PASS. reconciled-report.mjs:17 deepEqual bootstrap/base/tagKind/formato, :19-20 negativos bootstrap Maven/Node, :23 base/tag/bump prefix isolado, :26 propriedades divergentes rejeitadas, :28-29 SHA/SNAPSHOT. Teste antigo version-report mantém30 assertions e expectativas, apenas input Maven migrou para Properties completas1.9. REC-01/02. Coletor Bash antigo será conectado no T7, integração Maven não alegada neste gate unitário.

## T5

Red módulo ausente; Quick coletor PASS. jgitver-adapter.mjs:20 versão/SHAexatos, :21 filtro dado pessoal, :22-24 branch/-N/temp cleanup, :31 divergência com todas Properties completas throws mensagem específica; skip/use-version bloqueados. REC02/04. Ruling: prova reactorCLI118 foi movida inteira para T7 onde a CLI existe (tentativa anterior falhou módulo ausente, não alegada como gate); nenhuma assertion removida/condicionada. Primeira baseline --local inválida: HEAD alterado pelo autor durante testepr-check; repetir em checkout congelado. Sintaxe/diff/tasks PASS.
