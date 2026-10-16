import { realpathSync, writeFileSync } from 'node:fs';
import { relative, isAbsolute } from 'node:path';
import { resolveAdapter } from './adapter-registry.mjs';
import { validateTagPrefix } from './version-report.mjs';
try {
  const [adapter, projectPath, targetBranch, sha, workspacePath, adapterBin, output, prefix='v'] = process.argv.slice(2);
  const tagPrefix=validateTagPrefix(prefix);
  if(adapter==='go-gitsemver'&&tagPrefix!=='v')throw Error('go-gitsemver exige prefixo v');
  const selected = resolveAdapter(adapter);
  if (!output || !/^[0-9a-f]{40}$/i.test(sha ?? '') || !/^[A-Za-z0-9_.\/-]+$/.test(targetBranch ?? '')) throw new Error('Contexto de cálculo inválido');
  const workspace=realpathSync(workspacePath), projectDirectory=realpathSync(projectPath);
  const path=relative(workspace,projectDirectory);
  if (path === '..' || path.startsWith('../') || path.startsWith('..\\') || isAbsolute(path)) throw new Error('Projeto fora do workspace');
  const report=selected.calculate({workspace,projectDirectory,targetBranch,sha,adapterBin,tagPrefix,env:process.env});
  writeFileSync(output,JSON.stringify(report,null,2)+'\n');
} catch (error) { console.error(error.message); process.exitCode=1; }
