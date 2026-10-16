import { createHash } from 'node:crypto';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = fileURLToPath(new URL('../../', import.meta.url));
const version = '1.7.12';
if (process.platform !== 'linux' || process.arch !== 'x64') throw new Error('Workflow lint runtime: Linux amd64 required. Other platforms can run the pinned actionlint directly.');
const work = await mkdtemp(join(tmpdir(), 'llm-actionlint-'));
try {
  const filename = `actionlint_${version}_linux_amd64.tar.gz`;
  const response = await fetch(`https://github.com/rhysd/actionlint/releases/download/v${version}/${filename}`, { signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error('Actionlint download failed');
  const bytes = Buffer.from(await response.arrayBuffer());
  if (createHash('sha256').update(bytes).digest('hex') !== '8aca8db96f1b94770f1b0d72b6dddcb1ebb8123cb3712530b08cc387b349a3d8') throw new Error('Actionlint checksum mismatch');
  const archive = join(work, filename); await writeFile(archive, bytes);
  const unpack = spawnSync('tar', ['-xzf', archive, '-C', work, 'actionlint'], { stdio: 'inherit' });
  if (unpack.status !== 0) throw new Error('Actionlint extraction failed');
  const paths = [join(root, '.github/workflows/llm-execute.yml'), join(root, '.github/workflows/issue-triage.yml'), join(root, '.github/workflows/pr-code-review.yml'), join(root, '.github/workflows/ci.yml'),
    join(root, 'examples/callers/llm/.github/workflows/llm.yml'), join(root, 'examples/callers/llm/variants/llm-api-key.yml'),
    join(root, 'examples/callers/triage/.github/workflows/triage.yml'),
    ...['triage', 'review', 'review-bridge'].map(name => join(root, `examples/callers/review/.github/workflows/${name}.yml`))];
  // GitHub.com fields documented in design.md, not yet known to actionlint 1.7.12.
  const exceptions = ['-ignore', 'unexpected key "queue" for "concurrency" section', '-ignore', 'property "workflow_(repository|sha)" is not defined'];
  const result = spawnSync(join(work, 'actionlint'), ['-shellcheck=', '-pyflakes=', ...exceptions, ...paths], { stdio: 'inherit', cwd: root });
  process.exitCode = result.status ?? 1;
} finally { await rm(work, { recursive: true, force: true }); }
