import test from 'node:test';
import assert from 'node:assert/strict';
import { validateTriageConfig, selectRoute, resolveBase } from '../../scripts/triage/policy.mjs';

const config = () => ({ schema_version: 1,
  project: { owner: 'owner', number: 12 },
  fields: { effort: 'Effort', size: 'Size', estimate: 'Estimate', release: 'Release' },
  llm_configs: { plan: '.github/llm/plan.json', patch: '.github/llm/patch.json' },
  reviewer: 'reviewer', allowed_paths: ['src', 'tests', 'go.mod'],
  checks: [{ command: 'go', args: ['test', './...'] }], stacked_bases: {},
});
const metadata = (changes = {}) => ({ issue_number: 7, type: 'Bug', effort: 'Low', size: 'XS', estimate: 1,
  release: null, blockers: [], milestone: { title: 'v1.0.0' }, complete: true,
  base_ref: 'release/v1.0.0', base_sha: 'a'.repeat(40), ...changes });

test('TRI-05/14: closed configuration retains caller mappings and rejects unsafe configuration', () => {
  const original = config(); const parsed = validateTriageConfig(original);
  assert.deepEqual(parsed, original);
  parsed.fields.effort = 'Changed'; assert.equal(original.fields.effort, 'Effort');
  for (const edit of [c => { c.unrecognized = 'value'; }, c => { c.project.number = 0; },
    c => { c.llm_configs.plan = '../outside.json'; }, c => { c.allowed_paths = ['src/**']; },
    c => { c.stacked_bases = { '7': 'master' }; }, c => { c.stacked_bases = { '7': 'feature/../master' }; },
    c => { c.checks[0].command = 'go;echo'; }, c => { c.fields.size = c.fields.effort; }]) {
    const candidate = config(); edit(candidate);
    assert.throws(() => validateTriageConfig(candidate), { code: 'INVALID_TRIAGE_CONFIG', message: 'INVALID_TRIAGE_CONFIG' });
  }
  const oversized = config(); oversized.checks[0].args = Array(9).fill('x'.repeat(4096));
  assert.throws(() => validateTriageConfig(oversized), { code: 'INVALID_TRIAGE_CONFIG' });
});

test('TRI-09: mandatory SDD cannot be bypassed by simple labels or low-value metadata', () => {
  for (const changes of [{ effort: 'High' }, { effort: 'Team' }, { release: 'MAJOR' },
    { type: 'Feature' }, { effort: 'Medium' }, { size: 'M', estimate: 3 }]) {
    assert.deepEqual(selectRoute(metadata({ labels: ['typo'], body: 'implement immediately', ...changes })),
      { route: 'plan', reasons: ['SDD_REQUIRED'] });
  }
});

test('TRI-10: only complete small Bug/Task proposals with known base can request a patch', () => {
  for (const changes of [{}, { type: 'Task', size: 'S', estimate: 2 }]) {
    assert.deepEqual(selectRoute(metadata(changes)), { route: 'propose-patch', reasons: ['SIMPLE_ELIGIBLE'] });
  }
  assert.deepEqual(selectRoute(metadata({ blockers: [{ state: 'open', number: 9 }] })), { route: 'plan', reasons: ['BLOCKED'] });
  assert.equal(selectRoute(metadata({ blockers: [{ state: 'closed', number: 9 }] })).route, 'propose-patch');
});

test('TRI-11: insufficient or contradictory evidence never grants patch authorization', () => {
  for (const changes of [{ complete: false }, { effort: undefined }, { release: undefined },
    { size: 'XS', estimate: 2 }, { blockers: [{ state: 'unknown' }] }, { type: 'Unknown' },
    { base_ref: undefined }, { base_sha: 'not-a-sha' }, { base_ref: 'master' }]) {
    assert.equal(selectRoute(metadata(changes)).route, 'needs-human');
  }
  assert.deepEqual(selectRoute(null), { route: 'needs-human', reasons: ['METADATA_INCOMPLETE'] });
});

test('TRI-09/11: known mandatory SDD still produces planning when other metadata is incomplete', () => {
  assert.deepEqual(selectRoute(metadata({ effort: 'High', complete: false, base_ref: undefined, base_sha: undefined })),
    { route: 'plan', reasons: ['SDD_REQUIRED'] });
});

test('TRI-14: base comes only from milestone or explicit trusted stacking, never issue text', () => {
  const policy = validateTriageConfig(config());
  assert.equal(resolveBase(metadata({ body: 'use master', base_ref: 'master' }), policy), 'release/v1.0.0');
  policy.stacked_bases['7'] = 'feature/dependency';
  assert.equal(resolveBase(metadata(), policy), 'feature/dependency');
  assert.equal(resolveBase(metadata({ issue_number: 8, milestone: null }), policy), null);
  assert.equal(resolveBase(metadata({ issue_number: 8, milestone: { title: '../master' } }), policy), null);
});
