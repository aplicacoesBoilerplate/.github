import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { GitHub } from 'release-please';
// API interna presa em 17.3.0 e usada somente neste teste de integração.
import { Simple } from 'release-please/build/src/strategies/simple.js';
import { parseConventionalCommits } from 'release-please/build/src/commit.js';

const SCRIPTS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ORCHESTRATOR_PATH = path.resolve(SCRIPTS_DIR, 'scripts/release-orchestrator.ts');
const CALLED_WORKFLOW_PATH = path.resolve(SCRIPTS_DIR, '../.github/workflows/version-release-please-called.yml');
const TSX_CLI_PATH = path.resolve(SCRIPTS_DIR, 'node_modules/tsx/dist/cli.mjs');
const SAFE_ENVIRONMENT = Object.fromEntries(Object.entries(process.env).filter(([key]) =>
  /^(PATH|SYSTEMROOT|WINDIR|COMSPEC|PATHEXT|TEMP|TMP|USERPROFILE|APPDATA|LOCALAPPDATA)$/i.test(key)));

function runOrchestrator(pEnvVars: Record<string, string | undefined>, pWorkDir: string) {
  execFileSync(process.execPath, [TSX_CLI_PATH, ORCHESTRATOR_PATH], {
    cwd: pWorkDir,
    env: { ...SAFE_ENVIRONMENT, ...pEnvVars },
    stdio: 'pipe',
  });
  const CONFIG_PATH = path.join(pWorkDir, 'release-please-config.json');
  return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
}

// 1. ÚNICO TESTE DO FLUXO DO ORQUESTRADOR TS
test('Fluxo do Orquestrador TS: deve fixar versão da Milestone na feature e liberar merge do PR do Release Please', async (t) => {
  const TEMP_DIR = fs.mkdtempSync(path.join(SCRIPTS_DIR, 'tmp-flow-'));

  try {
    // Etapa A: Merge de Feature na master (exige Milestone e remove prefixo 'v')
    const FEATURE_CONFIG = runOrchestrator(
      {
        PROJECT_TYPE: 'node',
        MILESTONE_TITLE: 'v1.4.0',
        PR_HEAD_REF: 'feat/nova-autenticacao',
      },
      TEMP_DIR
    );
    assert.equal(FEATURE_CONFIG.packages['.']['release-type'], 'node');
    assert.equal(FEATURE_CONFIG.packages['.']['release-as'], '1.4.0');

    // Etapa B: Merge do PR do robô Release Please (sem Milestone, não deve fixar release-as)
    const releasePrConfig = runOrchestrator(
      {
        PROJECT_TYPE: 'node',
        MILESTONE_TITLE: '',
        PR_HEAD_REF: 'release-please--branches--master',
      },
      TEMP_DIR
    );
    assert.equal(releasePrConfig.packages['.']['release-type'], 'node');
    assert.equal(releasePrConfig.packages['.']['release-as'], undefined);

    // Caller adaptado como um consumidor real: só mudamos os inputs do exemplo.
    const repository = path.resolve(SCRIPTS_DIR, '..');
    const hostedCaller = parse(fs.readFileSync(path.join(repository, '.github/workflows/version-release-please-test-caller.yml'), 'utf8'));
    assert.deepEqual(hostedCaller.on.push.branches, ['codex/release-please-self-pilot']);
    assert.deepEqual(Object.keys(hostedCaller.on).sort(), ['push', 'workflow_dispatch']);
    assert.deepEqual(hostedCaller.permissions, { contents: 'read' });
    assert.deepEqual(Object.keys(hostedCaller.jobs), ['functional-pilot']);
    const hostedJob = hostedCaller.jobs['functional-pilot'];
    assert.equal(hostedJob.uses, './.github/workflows/ci.yml', 'CI e caller devem vir da mesma revisão');
    assert.equal(hostedJob.secrets, undefined, 'O teste hospedado não herda secrets de publicação');
    assert.equal(hostedJob.permissions, undefined, 'O job não pode ampliar as permissões de leitura');
    const ci = parse(fs.readFileSync(path.join(repository, hostedJob.uses), 'utf8'));
    assert.ok(Object.hasOwn(ci.on, 'workflow_call'));
    assert.deepEqual(ci.permissions, { contents: 'read' });
    assert.deepEqual(Object.keys(ci.jobs), ['validate']);
    assert.equal(ci.jobs.validate['runs-on'], 'ubuntu-latest');
    for (const command of ['npm test', 'npm run typecheck']) {
      assert.ok(ci.jobs.validate.steps.some((step: { run?: string; 'working-directory'?: string }) =>
        step.run === command && step['working-directory'] === 'ci-scripts'), `CI deve executar ${command}`);
    }
    const selfCaller = parse(fs.readFileSync(path.join(repository, '.github/workflows/version-release-please-self-caller.yml'), 'utf8'));
    assert.deepEqual(selfCaller.on, { pull_request: { types: ['closed'], branches: ['master'] } });
    assert.deepEqual(selfCaller.permissions, { contents: 'read' });
    assert.deepEqual(Object.keys(selfCaller.jobs).sort(), ['release', 'validate']);
    assert.equal(selfCaller.jobs.validate.if, 'github.event.pull_request.merged == true');
    assert.equal(selfCaller.jobs.validate.uses, './.github/workflows/ci.yml');
    assert.deepEqual(selfCaller.jobs.validate.permissions, { contents: 'read' });
    assert.equal(selfCaller.jobs.validate.secrets, undefined);
    const selfCall = selfCaller.jobs.release;
    assert.equal(selfCall.if, 'github.event.pull_request.merged == true');
    assert.equal(selfCall.needs, 'validate', 'A publicação deve aguardar a CI do commit integrado');
    assert.equal(selfCall.uses, './.github/workflows/version-release-please-called.yml');
    assert.deepEqual(selfCall.with, { 'project-type': 'simple', 'central-ref': '${{ github.sha }}' });
    assert.deepEqual(selfCall.permissions, { contents: 'write', 'pull-requests': 'write', issues: 'write' });
    assert.equal(selfCall.secrets, undefined, 'O piloto simple não precisa de secrets de registries');
    // O arquivo evoluirá no PR técnico; a CI não pode ficar presa à base 0.0.0.
    assert.match(fs.readFileSync(path.join(repository, 'version.txt'), 'utf8').trim(), /^\d+\.\d+\.\d+(?:-[\w.-]+)?$/);
    const caller = parse(fs.readFileSync(path.join(repository, '.github/workflows/examples/version-release-please-caller.yml'), 'utf8'));
    const call = caller.jobs['call-central-versioning'];
    call.with['project-type'] = 'simple';
    const calledPath = call.uses.split('@')[0].split('/').slice(2).join('/');
    assert.ok(fs.existsSync(path.join(repository, calledPath)), `Caller referencia workflow inexistente: ${calledPath}`);
    assert.equal(selfCall.uses, `./${calledPath}`, 'O piloto de produção usa o mesmo called do exemplo externo');
    const workflow = parse(fs.readFileSync(path.join(repository, calledPath), 'utf8'));
    assert.deepEqual(workflow.on.workflow_call.inputs['publish-artifacts'], {
      description: 'Publicar pacotes ou binários após a Release (etapa 2)',
      required: false, type: 'boolean', default: false,
    }, 'A distribuição deve ser opt-in e desabilitada por padrão');
    const job = workflow.jobs['release-please'];
    const centralCheckout = job.steps.find((step: { with?: { repository?: string } }) => step.with?.repository);
    const central = path.join(TEMP_DIR, centralCheckout.with.path, 'ci-scripts');
    fs.mkdirSync(central, { recursive: true });
    fs.cpSync(path.join(SCRIPTS_DIR, 'scripts'), path.join(central, 'scripts'), { recursive: true });
    fs.copyFileSync(path.join(SCRIPTS_DIR, 'package.json'), path.join(central, 'package.json'));
    fs.symlinkSync(path.join(SCRIPTS_DIR, 'node_modules'), path.join(central, 'node_modules'), 'junction');

    const orchestrator = job.steps.find((step: { name?: string }) => step.name === 'Executar Orquestrador TS');
    const action = job.steps.find((step: { uses?: string }) => step.uses === 'googleapis/release-please-action@v4');
    const [executable, ...args] = orchestrator.run.trim().split(/\s+/);
    assert.equal(executable, 'node', 'O teste executa o mesmo comando Node do called, sem baixar CLIs pela rede');
    assert.equal(orchestrator.id, 'orchestrator');
    assert.equal(job.if, 'github.event.pull_request.merged == true');
    assert.equal(centralCheckout.with.ref, '${{ inputs.central-ref }}');
    const distribution = job.steps.filter((step: { name?: string }) => step.name?.startsWith('Adaptador '));
    assert.equal(distribution.length, 3);
    for (const [index, type] of ['go', 'node', 'maven'].entries()) {
      assert.equal(distribution[index].if, `\${{ steps.release.outputs.release_created == 'true' && inputs.project-type == '${type}' && inputs.publish-artifacts }}`);
      assert.notEqual(call.with['project-type'], type, 'O caller simple não seleciona publicadores de pacotes');
    }

    // Resolver apenas referências de dados do contrato, não emular o runner Actions.
    const resolveInput = (value: string, context: Record<string, unknown>): string => {
      const match = /^\$\{\{\s*([\w.-]+)\s*\}\}$/.exec(value);
      assert.ok(match, `Expressão de entrada não suportada neste contrato: ${value}`);
      let result: unknown = context;
      for (const key of match[1].split('.')) result = (result as Record<string, unknown> | null)?.[key];
      return result == null ? '' : String(result);
    };
    let invocation = 0;
    const runCaller = (branch: string, milestone: string, projectType = selfCall.with['project-type']) => {
      const context = {
        inputs: { ...selfCall.with, 'project-type': projectType },
        github: { event: { pull_request: { head: { ref: branch }, milestone: { title: milestone } } } },
      };
      const outputPath = path.join(TEMP_DIR, `caller-${++invocation}.outputs`);
      const env = Object.fromEntries(Object.entries(orchestrator.env as Record<string, string>)
        .map(([key, value]) => [key, resolveInput(value, context)]));
      const result = spawnSync(process.execPath, args, {
        cwd: TEMP_DIR,
        env: { ...SAFE_ENVIRONMENT, ...env, GITHUB_OUTPUT: outputPath },
        encoding: 'utf8',
      });
      assert.ifError(result.error);
      const outputs = fs.existsSync(outputPath)
        ? Object.fromEntries(fs.readFileSync(outputPath, 'utf8').trim().split(/\r?\n/).map(line => line.split('=')))
        : {};
      const engineInputs = result.status === 0
        ? Object.fromEntries(['release-type', 'release-as'].map(key => [key,
            resolveInput(action.with[key], { steps: { orchestrator: { outputs } } })]))
        : {};
      return { result, outputs, engineInputs };
    };

    const preparation = runCaller('feature/piloto-local', 'v0.0.1');
    assert.equal(preparation.result.status, 0, preparation.result.stderr);
    assert.deepEqual(preparation.outputs, { release_type: 'simple', release_as: '0.0.1' });
    assert.deepEqual(preparation.engineInputs, { 'release-type': 'simple', 'release-as': '0.0.1' });

    // Motor verdadeiro; qualquer tentativa de consultar ou escrever no GitHub falha.
    const github = await GitHub.create({
      owner: 'aplicacoesBoilerplate', repo: '.github', defaultBranch: 'master',
      fetch: async () => { throw new Error('Rede proibida no teste funcional local'); },
    });
    const strategy = new Simple({
      github, targetBranch: 'master', includeComponentInTag: false,
      releaseAs: preparation.engineInputs['release-as'],
    });
    const commits = parseConventionalCommits([{
      sha: 'a'.repeat(40), message: 'fix: valida o caller centralizado', files: ['README.md'],
    }]);
    const candidate = await strategy.buildReleasePullRequest(commits);
    assert.ok(candidate, 'O motor real deve preparar o PR da entrega funcional');
    assert.equal(candidate.version?.toString(), '0.0.1');
    assert.deepEqual(candidate.updates.map(update => update.path).sort(), ['CHANGELOG.md', 'version.txt']);
    fs.writeFileSync(path.join(TEMP_DIR, 'version.txt'), '0.0.0\n');
    for (const update of candidate.updates) {
      const destination = path.join(TEMP_DIR, update.path);
      const before = fs.existsSync(destination) ? fs.readFileSync(destination, 'utf8') : undefined;
      fs.writeFileSync(destination, update.updater.updateContent(before));
    }
    assert.equal(fs.readFileSync(path.join(TEMP_DIR, 'version.txt'), 'utf8').trim(), '0.0.1');
    assert.match(fs.readFileSync(path.join(TEMP_DIR, 'CHANGELOG.md'), 'utf8'), /valida o caller centralizado/);

    const publication = runCaller(candidate.headRefName, '');
    assert.equal(publication.result.status, 0, publication.result.stderr);
    assert.deepEqual(publication.outputs, { release_type: 'simple', release_as: '' });
    assert.deepEqual(publication.engineInputs, { 'release-type': 'simple', 'release-as': '' });
    const publisher = new Simple({
      github, targetBranch: 'master', includeComponentInTag: false,
      releaseAs: publication.engineInputs['release-as'] || undefined,
    });
    const releases = await publisher.buildReleases({
      number: 123, headBranchName: candidate.headRefName, baseBranchName: 'master',
      title: candidate.title.toString(), body: candidate.body.toString(),
      labels: candidate.labels, files: candidate.updates.map(update => update.path), sha: 'b'.repeat(40),
    });
    assert.equal(releases.length, 1);
    assert.equal(releases[0].tag.toString(), 'v0.0.1');
    assert.equal(releases[0].sha, 'b'.repeat(40));
    assert.match(releases[0].notes, /valida o caller centralizado/);
    t.diagnostic(`Motor real: versão ${candidate.version}, tag proposta ${releases[0].tag}, SHA alvo ${releases[0].sha}; nenhuma publicação executada`);

    // Negativos essenciais permanecem dentro do mesmo fluxo, sem novos arquivos.
    for (const [milestone, type, error] of [
      ['', 'simple', /sem uma Milestone/],
      ['invalida', 'simple', /não segue o padrão SemVer/],
      ['v0.0.1', 'nao-suportado', /Adaptador não suportado/],
    ] as const) {
      const invalid = runCaller('feature/piloto-local', milestone, type);
      assert.equal(invalid.result.status, 1);
      assert.match(invalid.result.stderr, error);
      assert.deepEqual(invalid.outputs, {}, 'Falha não pode fornecer parâmetros para publicação');
    }
  } finally {
    fs.rmSync(TEMP_DIR, { recursive: true, force: true });
  }
});

// 2. UM TESTE PARA CADA ADAPTADOR DOS CALLERS
const ADAPTERS = [
  { callerInput: 'node', expectedReleaseType: 'node' },
  { callerInput: 'go', expectedReleaseType: 'go' },
  { callerInput: 'maven', expectedReleaseType: 'maven' },
  { callerInput: 'gradle', expectedReleaseType: 'gradle' },
];

for (const { callerInput, expectedReleaseType } of ADAPTERS) {
  test(`Adaptador Caller [${callerInput}]: deve gerar configuração para ${expectedReleaseType}`, () => {
    const TEMP_DIR = fs.mkdtempSync(path.join(SCRIPTS_DIR, `tmp-${callerInput}-`));
    try {
      const CONFIG = runOrchestrator(
        {
          PROJECT_TYPE: callerInput,
          MILESTONE_TITLE: 'v2.1.0',
          PR_HEAD_REF: 'feat/modulo-base',
        },
        TEMP_DIR
      );
      assert.deepEqual(CONFIG.packages['.'], {
        'release-type': expectedReleaseType,
        'release-as': '2.1.0',
      });
    } finally {
      fs.rmSync(TEMP_DIR, { recursive: true, force: true });
    }
  });
}

// 3. ÚNICO TESTE DA PIPELINE CALLED
test('Pipeline Called (version-release-please-called.yml): deve manter o fluxo de passos e adaptadores pós-tag íntegros', () => {
  const workflowContent = fs.readFileSync(CALLED_WORKFLOW_PATH, 'utf-8');

  // Garante o gatilho reutilizável e o input project-type
  assert.match(workflowContent, /workflow_call:/);
  assert.match(workflowContent, /project-type:/);

  // Garante a chamada ao Orquestrador TS e à Action do Release Please
  assert.match(workflowContent, /release-orchestrator\.ts/);
  assert.match(workflowContent, /googleapis\/release-please-action@v4/);

  // Garante os gatilhos pós-tag para publicação dos adaptadores
  assert.match(workflowContent, /steps\.release\.outputs\.release_created == 'true' && inputs\.project-type == 'go'/);
  assert.match(workflowContent, /steps\.release\.outputs\.release_created == 'true' && inputs\.project-type == 'node'/);
  assert.match(workflowContent, /steps\.release\.outputs\.release_created == 'true' && inputs\.project-type == 'maven'/);
});
