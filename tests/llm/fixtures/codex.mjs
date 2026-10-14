import { readFile, writeFile, appendFile } from 'node:fs/promises';
const args = process.argv.slice(2);
let input = '';
for await (const chunk of process.stdin) input += chunk;
const prompt = JSON.parse(input);
const scenario = prompt.context.scenario;
const cwd = args[args.indexOf('--cd') + 1];
const output = args[args.indexOf('--output-last-message') + 1];
const record = { args, env: process.env, cwd, prompt };
if (process.env.GITHUB_TOKEN || process.env.GH_TOKEN || process.env.ACTIONS_RUNTIME_TOKEN) process.exit(9);
for (const name of ['.codex/config.toml', '.env']) {
  try { await readFile(cwd + '/' + name); process.exit(9); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
}
// Record through the output directory owned by the test invocation, not caller input.
await appendFile(output + '.calls', JSON.stringify(record) + '\n');
if (scenario === 'hang') setInterval(() => {}, 1000);
else if (scenario === 'error') process.exit(7);
else if (scenario === 'invalid') await writeFile(output, '{bad-json');
else {
  const isDecision = args[args.indexOf('--model') + 1] === 'decision-model';
  const effortArgument = args.find(value => value.startsWith('model_reasoning_effort='));
  const effort = effortArgument ? JSON.parse(effortArgument.slice('model_reasoning_effort='.length)) : '';
  const response = isDecision ? { decision: scenario || 'proceed', reason: 'fixture decision' }
    : { summary: scenario === 'caller' ? `${args[args.indexOf('--model') + 1]}|${effort}|${prompt.task}` : 'fixture result', patch: null };
  await writeFile(output, JSON.stringify(response));
}
