# Evidências da conciliação

## T1

Baseline de entrada fcf31e0 PR12, local b4c783a preservado. API PR12 e13 lidos; baseline suite13 iniciada. validate_spec zero erros/avisos; validate_tasks zero erros e3 avisos documentais/diagramparsing, crosscheck manual sequencial Match. REC-01/06 autorizados em 2026-10-15, push fast-forward PR12 e execução neste chat. Nenhum piloto/merge/deploy autorizado. Context7 ausente, fontes oficiais consultadas. Testes não aplicáveis a planejamento; tools e gates definidos antes do código.

## T2

Red: module missing. Quick PASS process-runner.mjs. REC-04: tests/process-runner.mjs:13 assert.deepEqual credentials null/visible retained, :15 assert.throws outsideworkspace, :16 timeout, :17 exit7, :19 missingcommand; argv/stdout assertions exact. Porta reutilizada b4c783a sem mudança, diretório confinado e env explícito; sintaxe/diff PASS. Toda assertion corresponde fronteira de execução; sem excluir testes baseline.
