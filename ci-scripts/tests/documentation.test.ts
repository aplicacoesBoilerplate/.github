import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { spawnSync, type SpawnSyncReturns } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

test('Documentação central: site isolado e workspace usam seus layouts reais sem publicar em PR', () => {
  const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  const workflow = parse(fs.readFileSync(path.join(repository, '.github/workflows/documentacao-pages.yml'), 'utf8'));
  const inputs = workflow.on.workflow_call.inputs;
  assert.equal(inputs['install-dir'].default, '');
  assert.equal(inputs['build-script'].default, 'docs:build');
  assert.equal(inputs['npm-version'].default, '');
  const steps = workflow.jobs.build.steps;
  const install = steps.find((step: any) => step.name === 'Instalar dependências da documentação');
  const build = steps.find((step: any) => step.name === 'Build VitePress');
  const pin = steps.find((step: any) => step.name === 'Fixar versão npm do consumidor');
  const setup = steps.find((step: any) => step.uses?.startsWith('actions/setup-node@'));
  assert.equal(setup.with.cache, undefined, 'Não invocar npm antes do pin exigido por devEngines');
  assert.equal(pin.if, "inputs.npm-version != ''");
  assert.equal(pin['working-directory'], '${{ runner.temp }}');
  assert.equal(pin.env.DOCS_NPM_VERSION, '${{ inputs.npm-version }}');
  assert.equal(pin.run, 'npm install --global "npm@$DOCS_NPM_VERSION" --ignore-scripts');
  assert.ok(steps.indexOf(pin) < steps.indexOf(install));
  assert.equal(install.run, 'npm ci');
  assert.equal(build.run, 'npm run "$DOCS_BUILD_SCRIPT"');
  assert.equal(build.env.DOCS_BUILD_SCRIPT, "${{ inputs.build-script || 'docs:build' }}");
  assert.equal(build.env.DOCS_BASE, '/${{ github.event.repository.name }}/');
  assert.equal(workflow.jobs.deploy.needs, 'build');
  const guard = "(github.event_name == 'push' || github.event_name == 'workflow_dispatch') && github.ref == 'refs/heads/master'";
  assert.equal(workflow.jobs.deploy.if, guard);
  const upload = steps.find((step: any) => step.uses?.startsWith('actions/upload-pages-artifact@'));
  assert.equal(upload.if, guard);
  assert.deepEqual(workflow.permissions, { contents: 'read' });
  assert.deepEqual(workflow.jobs.deploy.permissions, { pages: 'write', 'id-token': 'write' });

  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'documentation-contract-'));
  const npm = process.env.npm_execpath;
  assert.ok(npm && fs.existsSync(npm));
  const safe = Object.fromEntries(Object.entries(process.env).filter(([key]) => /^(PATH|SYSTEMROOT|WINDIR|COMSPEC|PATHEXT|TEMP|TMP)$/i.test(key)));
  try {
    for (const layout of [
      { name: 'standalone', options: {}, directory: 'docs', script: 'docs:build', output: 'docs/.vitepress/dist' },
      { name: 'workspace', options: { 'docs-dir': 'apps/docs', 'install-dir': '.', 'build-script': 'build', 'npm-version': '10.9.4' }, directory: '.', script: 'build', output: 'apps/docs/.vitepress/dist' },
    ]) {
      const cwd = path.join(root, layout.name);
      const expected = path.join(cwd, layout.directory);
      fs.mkdirSync(expected, { recursive: true });
      const relativeOutput = path.relative(expected, path.join(cwd, layout.output)).replaceAll('\\', '/');
      const script = `const fs=require('node:fs');fs.mkdirSync(${JSON.stringify(relativeOutput)},{recursive:true});fs.writeFileSync(${JSON.stringify(relativeOutput + '/index.html')},${JSON.stringify('built:' + layout.name)});`;
      fs.writeFileSync(path.join(expected, 'build.cjs'), script);
      const pkg = { name: layout.name, version: '0.0.1', private: true, scripts: { [layout.script]: 'node build.cjs' } };
      fs.writeFileSync(path.join(expected, 'package.json'), JSON.stringify(pkg));
      fs.writeFileSync(path.join(expected, 'package-lock.json'), JSON.stringify({ name: pkg.name, version: pkg.version, lockfileVersion: 3, packages: { '': pkg } }));
      const values = Object.fromEntries(Object.entries(inputs).map(([key, value]: [string, any]) => [key, value.default]));
      Object.assign(values, layout.options);
      const resolve = (expression: string) => {
        const terms = /^\$\{\{\s*(.*?)\s*\}\}$/.exec(expression);
        assert.ok(terms, expression);
        for (const term of terms[1].split('||').map(value => value.trim())) {
          const value = term.startsWith('inputs.') ? values[term.slice(7)] : /^'([^']*)'$/.exec(term)?.[1];
          if (value) return String(value);
        }
        return '';
      };
      assert.equal(resolve(install['working-directory']), layout.directory);
      assert.equal(resolve(build['working-directory']), layout.directory);
      const env = { ...safe, npm_config_audit: 'false', npm_config_fund: 'false', npm_config_update_notifier: 'false', npm_config_cache: path.join(root, 'cache') };
      for (const args of [['ci'], ['run', resolve(build.env.DOCS_BUILD_SCRIPT)]]) {
        const result: SpawnSyncReturns<string> = spawnSync(process.execPath, [npm, ...args], { cwd: expected, env, encoding: 'utf8' });
        assert.ifError(result.error);
        assert.equal(result.status, 0, result.stdout + result.stderr);
      }
      const uploadPath = upload.with.path.replace("${{ inputs.docs-dir || 'docs' }}", values['docs-dir']);
      assert.equal(uploadPath, layout.output);
      assert.equal(fs.readFileSync(path.join(cwd, uploadPath, 'index.html'), 'utf8'), 'built:' + layout.name);
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
