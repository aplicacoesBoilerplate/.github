import { mkdtemp, readdir, mkdir, writeFile, chmod, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';
import Ajv from 'ajv';
import { contractError, readTrustedFile, validateRelativePath } from './validate-request.mjs';
import { reviewExecutionSchema } from '../review/result.mjs';

const cli = fileURLToPath(new URL('./node_modules/@openai/codex/bin/codex.js', import.meta.url));
const excluded = new Set(['.git', '.codex', '.agents', 'node_modules', 'coverage', 'dist', 'target', 'build']);
const schemas = {
  decision: { type: 'object', additionalProperties: false, required: ['decision', 'reason'], properties: { decision: { enum: ['proceed', 'skip', 'needs-human'] }, reason: { type: 'string', maxLength: 2000 } } },
  execution: { type: 'object', additionalProperties: false, required: ['summary', 'patch'], properties: { summary: { type: 'string', maxLength: 4000 }, patch: { type: ['string', 'null'] } } },
};
const ajv = new Ajv({ strict: true, allowUnionTypes: true });
const validators = Object.fromEntries(Object.entries(schemas).map(([key, schema]) => [key, ajv.compile(schema)]));
const checkReview = ajv.compile(reviewExecutionSchema);

export function isExcludedSourcePath(path) {
  return path.split('/').some(name => excluded.has(name) || name.startsWith('.env')
    || /^(AGENTS(?:\.override)?\.md|auth\.json)$/.test(name) || /\.(pem|key)$/i.test(name));
}

async function materializeReview(files, destination) {
  if (!Array.isArray(files) || files.length > 100) throw contractError('REVIEW_INCONCLUSIVE');
  let total = 0; const seen = new Set();
  for (const file of files) {
    validateRelativePath(file.path);
    if (typeof file.content !== 'string' || isExcludedSourcePath(file.path) || seen.has(file.path)) throw contractError('REVIEW_INCONCLUSIVE');
    seen.add(file.path); total += Buffer.byteLength(file.content);
    if (total > 1048576) throw contractError('REVIEW_INCONCLUSIVE');
    const parts = file.path.split('/'); parts.pop(); if (parts.length) await mkdir(join(destination, ...parts), { recursive: true });
    await writeFile(join(destination, file.path), file.content, { mode: 0o444, flag: 'wx' });
  }
  return files;
}

async function snapshot(root, destination) {
  const files = [];
  let total = 0;
  async function visit(path = '') {
    for (const entry of (await readdir(join(root, path), { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
      if (isExcludedSourcePath(entry.name)) continue;
      const relative = path ? `${path}/${entry.name}` : entry.name;
      if (entry.isSymbolicLink()) throw contractError('INVALID_CONFIG');
      if (entry.isDirectory()) { await mkdir(join(destination, relative)); await visit(relative); continue; }
      const bytes = await readTrustedFile(root, relative, 1048576);
      total += bytes.length;
      if (total > 1048576) throw contractError('INVALID_CONFIG');
      await writeFile(join(destination, relative), bytes, { mode: 0o444 });
      let content;
      try { content = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
      catch { content = null; }
      files.push({ path: relative, content, ...(content === null ? { binary: true } : {}) });
    }
  }
  await visit();
  return files;
}

async function directoryMode(root, mode) {
  for (const entry of await readdir(root, { withFileTypes: true })) if (entry.isDirectory()) await directoryMode(join(root, entry.name), mode);
  await chmod(root, mode);
}

function runCli(args, env, prompt, timeout, cliPath) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cliPath, ...args], { env, shell: false, detached: process.platform !== 'win32', stdio: ['pipe', 'ignore', 'ignore'], windowsHide: true });
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      if (child.pid && process.platform === 'win32') spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
      else if (child.pid) { try { process.kill(-child.pid, 'SIGKILL'); } catch { child.kill('SIGKILL'); } }
    }, Math.max(1, timeout));
    child.on('error', () => { clearTimeout(timer); reject(contractError('PROVIDER_ERROR')); });
    child.on('close', code => {
      clearTimeout(timer);
      if (timedOut) reject(contractError('TIMEOUT'));
      else if (code !== 0) reject(contractError('PROVIDER_ERROR'));
      else resolve();
    });
    child.stdin.on('error', () => {}); // EPIPE is reported by the exit code above.
    child.stdin.end(JSON.stringify(prompt));
  });
}

export async function executeRequest(request, { sourceRoot, auth, instructions }, { cliPath = cli, timeoutMs = 600000, onInvocation } = {}) {
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 600000) throw contractError('INVALID_CONFIG');
  const work = await mkdtemp(join(tmpdir(), 'llm-exec-'));
  const source = join(work, 'source'); await mkdir(source);
  try {
    const review = request.caller_profile === 'review';
    const source_files = review ? await materializeReview(request.source_files, source) : await snapshot(sourceRoot, source);
    await writeFile(join(source, 'AGENTS.md'), instructions, { mode: 0o444 });
    await directoryMode(source, 0o555);
    const deadline = Date.now() + timeoutMs;
    async function invoke(stage, kind) {
      const remaining = deadline - Date.now();
      if (remaining <= 0) throw contractError('TIMEOUT');
      const schemaFile = join(work, `${kind}.schema.json`);
      const output = join(work, `${kind}.json`);
      await writeFile(schemaFile, JSON.stringify(review && kind === 'execution' ? reviewExecutionSchema : schemas[kind]));
      const template = stage.template_path ? request.prompts?.[kind] : await readFile(new URL(`./templates/${stage.template}.md`, import.meta.url), 'utf8');
      if (typeof template !== 'string' || !template.trim()) throw contractError('INVALID_CONFIG');
      const prompt = { task: template, context: request.context, source_files };
      const args = ['exec', '--model', stage.model, '--sandbox', 'read-only', '--cd', source, '--skip-git-repo-check', '--ignore-user-config', '--ignore-rules', '--ephemeral', '--color', 'never', '--output-schema', schemaFile, '--output-last-message', output,
        '-c', `model_reasoning_effort=${JSON.stringify(stage.effort)}`, '-c', 'approval_policy="never"', '-c', 'cli_auth_credentials_store="file"', '-c', 'project_doc_max_bytes=65536', '-c', 'web_search="disabled"'];
      for (const feature of ['shell_tool', 'unified_exec', 'apps', 'plugins', 'multi_agent', 'browser_use', 'computer_use', 'daemon_auto_start']) args.push('-c', `features.${feature}=false`);
      args.push('-c', 'features.skip_host_skill_discovery=true', '-');
      const env = { ...auth.env };
      onInvocation?.({ stage, prompt, args, env });
      const launchBudget = deadline - Date.now();
      if (launchBudget <= 0) throw contractError('TIMEOUT');
      await runCli(args, env, prompt, launchBudget, cliPath);
      let result;
      try { result = JSON.parse((await readTrustedFile(work, `${kind}.json`, 1048576, 'INVALID_RESULT')).toString('utf8')); }
      catch { throw contractError('INVALID_RESULT'); }
      if (!(review && kind === 'execution' ? checkReview : validators[kind])(result)) throw contractError('INVALID_RESULT');
      return result;
    }
    let decision = 'none';
    if (request.config.invocation_mode === 'decision-then-prompt') {
      const first = await invoke(request.config.decision, 'decision');
      decision = first.decision;
      if (decision !== 'proceed') return { status: decision === 'skip' ? 'skipped' : 'needs-human', decision, summary: first.reason, patch: null, ...(review ? { findings: [] } : {}) };
    }
    const result = await invoke(request.config.execution, 'execution');
    return { status: 'succeeded', decision, ...result };
  } finally {
    await directoryMode(source, 0o755);
    await rm(work, { recursive: true, force: true });
  }
}
