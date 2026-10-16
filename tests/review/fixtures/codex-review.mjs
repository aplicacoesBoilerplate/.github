import { readFile, writeFile } from 'node:fs/promises';
const args = process.argv.slice(2); let input = '';
for await (const chunk of process.stdin) input += chunk;
const prompt = JSON.parse(input); const schema = JSON.parse(await readFile(args[args.indexOf('--output-schema') + 1], 'utf8'));
if (process.env.REVIEW_READ_TOKEN || process.env.TRIAGE_READ_TOKEN || process.env.GITHUB_TOKEN || process.env.CODEX_AUTH_WRITE_PAT) process.exit(9);
const output = args[args.indexOf('--output-last-message') + 1];
const response = schema.required.includes('reason') ? { decision: prompt.context.pull.body === 'skip-review' ? 'skip' : 'proceed', reason: 'Review this PR.' }
  : { summary: `${args[args.indexOf('--model') + 1]}|${JSON.parse(args.find(a => a.startsWith('model_reasoning_effort=')).slice('model_reasoning_effort='.length))}|${prompt.task}`,
    findings: [{ severity: 'warning', path: 'main.go', line: prompt.context.diff.includes('unchanged') ? 110001 : 1, message: 'Review the changed line.' }], patch: null };
await writeFile(output, JSON.stringify(response));
