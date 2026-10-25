import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { GitHub, Manifest, type CreatedRelease, type Strategy } from 'release-please';
import { FileNotFoundError } from '@google-automations/git-file-utils';
// API interna presa em 17.3.0 e usada somente neste teste de integração.
import { Simple } from 'release-please/build/src/strategies/simple.js';
import { parseConventionalCommits } from 'release-please/build/src/commit.js';
import { buildStrategy } from 'release-please/build/src/factory.js';
import { TagName } from 'release-please/build/src/util/tag-name.js';

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
    assert.deepEqual(selfCaller.on, { pull_request: { types: ['opened', 'reopened', 'synchronize', 'edited', 'milestoned', 'demilestoned', 'closed'], branches: ['master'] } });
    assert.deepEqual(selfCaller.permissions, { contents: 'read' });
    assert.deepEqual(Object.keys(selfCaller.jobs).sort(), ['release', 'validate', 'version-policy']);
    assert.equal(selfCaller.jobs.validate.if, 'github.event.pull_request.merged == true');
    assert.equal(selfCaller.jobs.validate.uses, './.github/workflows/ci.yml');
    assert.deepEqual(selfCaller.jobs.validate.permissions, { contents: 'read' });
    assert.equal(selfCaller.jobs.validate.secrets, undefined);
    const selfCall = selfCaller.jobs.release;
    assert.equal(selfCall.if, 'github.event.pull_request.merged == true');
    assert.equal(selfCall.needs, 'validate', 'A publicação deve aguardar a CI do commit integrado');
    assert.equal(selfCall.uses, './.github/workflows/version-release-please-called.yml');
    assert.deepEqual(selfCall.with, { 'project-type': 'simple', 'config-file': 'release-please-config.json', 'publish-artifacts': false, 'central-ref': '${{ github.sha }}' });
    assert.deepEqual(selfCall.permissions, { contents: 'write', 'pull-requests': 'write', issues: 'write' });
    assert.equal(selfCall.secrets, undefined, 'O piloto simple não precisa de secrets de registries');
    // O arquivo evoluirá no PR técnico; a CI não pode ficar presa à base 0.0.0.
    assert.match(JSON.parse(fs.readFileSync(path.join(repository, 'docs/package.json'), 'utf8')).version, /^\d+\.\d+\.\d+(?:-[\w.-]+)?$/);
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
    try {
      fs.symlinkSync(path.join(SCRIPTS_DIR, 'node_modules'), path.join(central, 'node_modules'), 'junction');
    } catch (error) {
      // O fixture usa cópia quando Windows não permite criar junction.
      if ((error as NodeJS.ErrnoException).code !== 'EPERM') throw error;
      fs.cpSync(path.join(SCRIPTS_DIR, 'node_modules'), path.join(central, 'node_modules'), { recursive: true });
    }

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
      assert.equal(distribution[index].if, `\${{ inputs.config-file == '' && inputs.release-config-file == '' && inputs.publish-artifacts && steps.release.outputs.release_created == 'true' && inputs.project-type == '${type}' }}`);
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
    const runCaller = (branch: string, milestone: string, projectType = selfCall.with['project-type'], configuredInputs: Record<string, string> = {}) => {
      const context = {
        inputs: { ...selfCall.with, 'project-type': projectType, ...configuredInputs },
        steps: { 'version-policy': { outputs: {} } },
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
    assert.deepEqual(preparation.outputs, { release_type: 'simple', release_as: '0.0.1', engine: 'action' });
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
    assert.deepEqual(publication.outputs, { release_type: 'simple', release_as: '', engine: 'action' });
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

    // Configs pertencem ao consumidor e não podem ser sobrescritos pelo gerador.
    const rootConfig = JSON.stringify({ packages: { '.': { 'release-type': 'maven', 'skip-snapshot': true } } });
    fs.writeFileSync(path.join(TEMP_DIR, 'consumer-release.json'), rootConfig);
    fs.writeFileSync(path.join(TEMP_DIR, 'consumer-versions.json'), JSON.stringify({ '.': '0.0.1' }));
    const rootInputs = { 'release-config-file': 'consumer-release.json', 'release-manifest-file': 'consumer-versions.json' };
    const configured = runCaller('feature/piloto-java', 'v0.0.2', 'maven', rootInputs);
    assert.equal(configured.result.status, 0, configured.result.stderr);
    assert.deepEqual(configured.outputs, { release_type: '', release_as: '0.0.2', engine: 'configured-sdk' });
    assert.equal(fs.readFileSync(path.join(TEMP_DIR, 'consumer-release.json'), 'utf8'), rootConfig);
    const configuredPublish = runCaller(candidate.headRefName, '', 'maven', rootInputs);
    assert.equal(configuredPublish.result.status, 0, configuredPublish.result.stderr);
    assert.equal(configuredPublish.outputs.release_as, '');

    fs.writeFileSync(path.join(TEMP_DIR, 'workspace-release.json'), JSON.stringify({
      'release-type': 'node', plugins: ['node-workspace'],
      packages: { 'packages/ui': {}, 'packages/utils': {} },
    }));
    fs.writeFileSync(path.join(TEMP_DIR, 'workspace-versions.json'), JSON.stringify({ 'packages/ui': '1.1.1', 'packages/utils': '0.0.1' }));
    const workspaceInputs = { 'release-config-file': 'workspace-release.json', 'release-manifest-file': 'workspace-versions.json', 'version-policy': 'native' };
    const independent = runCaller('feature/piloto-vue', 'v9.0.0', 'node', workspaceInputs);
    assert.equal(independent.result.status, 0, independent.result.stderr);
    assert.deepEqual(independent.outputs, { release_type: '', release_as: '', engine: 'action' }, 'Milestone não força versão escalar nos componentes independentes');
    assert.equal(action.if, "inputs.config-file == '' && inputs.release-config-file == ''");
    const sdkStep = job.steps.find((step: { id?: string }) => step.id === 'manifest');
    assert.ok(sdkStep);
    assert.equal(sdkStep.if, "inputs.config-file != '' || inputs.release-config-file != ''");
    assert.equal(sdkStep.env.RELEASE_CONFIG_FILE, '${{ inputs.config-file || inputs.release-config-file }}');
    assert.match(sdkStep.run, /CManifestRelease\.ts$/);

    for (const invalidInputs of [
      { ...workspaceInputs, 'version-policy': 'milestone' },
      { ...rootInputs, 'version-policy': 'desconhecida' },
      { ...rootInputs, 'release-config-file': '../consumer-release.json' },
      { ...rootInputs, 'release-manifest-file': 'ausente.json' },
    ]) {
      const invalid = runCaller('feature/invalida', 'v0.0.2', 'node', invalidInputs);
      assert.equal(invalid.result.status, 1);
      assert.deepEqual(invalid.outputs, {}, 'Config inválido deve falhar antes dos parâmetros de escrita');
    }

    // Apenas o transporte e as entradas são simulados; parser, estratégias e updaters são nativos.
    const { loadConfiguredManifest, CConfiguredReleaseEngine } = await import('../scripts/configured-release.js');
    const files: Record<string, string> = {};
    const nativeGitHub = await GitHub.create({
      owner: 'pilot', repo: 'consumer', defaultBranch: 'master',
      fetch: async () => { throw new Error('Rede proibida no fluxo nativo configurado'); },
    });
    nativeGitHub.getFileContentsOnBranch = async file => {
      const contents = files[file];
      if (contents === undefined) throw new FileNotFoundError(file);
      return { content: Buffer.from(contents).toString('base64'), parsedContent: contents, sha: 'a'.repeat(40), mode: '100644' };
    };
    nativeGitHub.findFilesByFilenameAndRef = async name => Object.keys(files).filter(file => path.posix.basename(file) === name);
    const applyNative = (updates: NonNullable<typeof candidate>['updates']) => {
      for (const update of updates) {
        if (files[update.path] !== undefined || update.createIfMissing) {
          files[update.path] = update.updater.updateContent(files[update.path]);
        }
      }
    };

    const mavenConfig = {
      packages: { '.': { 'release-type': 'maven', 'skip-snapshot': true, 'include-component-in-tag': false,
        'extra-files': [{ type: 'xml', path: 'pom.xml', xpath: '/*[local-name()="project"]/*[local-name()="properties"]/*[local-name()="revision"]' }] } },
    };
    files['consumer-release.json'] = JSON.stringify(mavenConfig);
    files['consumer-versions.json'] = JSON.stringify({ '.': '0.0.1' });
    fs.writeFileSync(path.join(TEMP_DIR, 'consumer-release.json'), files['consumer-release.json']);
    files['pom.xml'] = '<project xmlns="http://maven.apache.org/POM/4.0.0"><modelVersion>4.0.0</modelVersion><groupId>pilot</groupId><artifactId>parent</artifactId><version>0.0.1</version><properties><revision>0.0.1</revision></properties></project>';
    for (const module of ['boilerplate-bom', 'boilerplate-core', 'boilerplate-starter']) {
      files[`${module}/pom.xml`] = `<project xmlns="http://maven.apache.org/POM/4.0.0"><modelVersion>4.0.0</modelVersion><parent><groupId>pilot</groupId><artifactId>parent</artifactId><version>0.0.1</version></parent><artifactId>${module}</artifactId></project>`;
    }
    const options = { repository: 'pilot/consumer', targetBranch: 'master', configFile: 'consumer-release.json',
      manifestFile: 'consumer-versions.json', releaseAs: '0.0.2', workspace: TEMP_DIR };
    const mavenManifest = await loadConfiguredManifest(options, nativeGitHub);
    assert.equal(mavenManifest.repositoryConfig['.'].releaseAs, '0.0.2');
    assert.equal(mavenManifest.repositoryConfig['.'].skipSnapshot, true);
    const maven = await buildStrategy({ ...mavenManifest.repositoryConfig['.'], github: nativeGitHub, targetBranch: 'master' });
    const mavenCandidate = await maven.buildReleasePullRequest(parseConventionalCommits([{
      sha: 'a'.repeat(40), message: 'fix: valida o reactor compartilhado', files: ['boilerplate-core/src/Example.java'],
    }]));
    assert.ok(mavenCandidate);
    assert.equal(mavenCandidate.version?.toString(), '0.0.2');
    assert.notEqual(mavenCandidate.group, 'snapshot');
    applyNative(mavenCandidate.updates);
    assert.match(files['pom.xml'], /<version>0\.0\.2<\/version>/);
    assert.match(files['pom.xml'], /<revision>0\.0\.2<\/revision>/);
    for (const module of ['boilerplate-bom', 'boilerplate-core', 'boilerplate-starter']) {
      assert.match(files[`${module}/pom.xml`], /<version>0\.0\.2<\/version>/);
    }
    const mavenReleases = await maven.buildReleases({ number: 124, headBranchName: mavenCandidate.headRefName,
      baseBranchName: 'master', title: mavenCandidate.title.toString(), body: mavenCandidate.body.toString(),
      labels: mavenCandidate.labels, files: mavenCandidate.updates.map(update => update.path), sha: 'b'.repeat(40) });
    assert.equal(mavenReleases[0].tag.toString(), 'v0.0.2');
    assert.equal(mavenReleases[0].sha, 'b'.repeat(40));

    // A ponte mantém a ordem da Action e os resultados, sem substituir o motor de cálculo.
    const nativeRelease: CreatedRelease = { id: 1, path: '.', tagName: mavenReleases[0].tag.toString(),
      sha: mavenReleases[0].sha, url: 'https://example.invalid/release', version: '0.0.2',
      major: 0, minor: 0, patch: 2, prNumber: 124, notes: mavenReleases[0].notes };
    const nativePR = { number: 124, headBranchName: mavenCandidate.headRefName, baseBranchName: 'master',
      title: mavenCandidate.title.toString(), body: mavenCandidate.body.toString(), labels: mavenCandidate.labels,
      files: mavenCandidate.updates.map(update => update.path), sha: 'b'.repeat(40) };
    const writerOrder: string[] = [];
    const engine = new CConfiguredReleaseEngine(async received => {
      const parsed = await loadConfiguredManifest(received, nativeGitHub);
      assert.equal(parsed.repositoryConfig['.'].releaseAs, '0.0.2');
      writerOrder.push('load');
      return { createReleases: async () => { writerOrder.push('releases'); return [undefined, nativeRelease]; },
        createPullRequests: async () => { writerOrder.push('pullRequests'); return [undefined, nativePR]; } };
    });
    const result = await engine.run(options);
    assert.deepEqual(writerOrder, ['load', 'releases', 'load', 'pullRequests']);
    assert.equal(result.release_created, true);
    assert.equal(result.prs_created, true);
    assert.equal(result.releases[0].tagName, 'v0.0.2');
    assert.equal(result.releases[0].sha, 'b'.repeat(40));
    assert.match(result.releases[0].notes || '', /valida o reactor compartilhado/);
    assert.equal(result.pullRequests[0].headBranchName, mavenCandidate.headRefName);

    const packageVersions = {
      'packages/composables': ['composables', '0.0.1'], 'packages/utils': ['utils', '0.0.1'],
      'packages/ui/core': ['ui-core', '0.0.1'], 'packages/ui/prime-vue': ['ui-prime-vue', '0.0.1'],
      'packages/ui/vuetify': ['ui-vuetify', '1.1.1'], 'apps/docs': ['docs', '0.0.0'],
    };
    const workspaceConfig = {
      'release-type': 'node', 'include-component-in-tag': true, 'include-v-in-tag': false,
      'tag-separator': '@', plugins: ['node-workspace'], packages: Object.fromEntries(Object.entries(packageVersions)
        .map(([p, [name]]) => [p, { component: `@aplicacoesboilerplate/${name}`,
          ...(p === 'apps/docs' ? { 'skip-github-release': true, 'skip-changelog': true, 'exclude-paths': ['apps/docs'] } : {}) }])),
    };
    files['workspace-release.json'] = JSON.stringify(workspaceConfig);
    files['workspace-versions.json'] = JSON.stringify(Object.fromEntries(Object.entries(packageVersions).map(([p, [, version]]) => [p, version])));
    files['.release-please-manifest.json'] = files['workspace-versions.json'];
    files['package.json'] = JSON.stringify({ name: '@aplicacoesboilerplate/packages-vue', version: '0.0.1', private: true });
    const lockPackages: Record<string, unknown> = { '': JSON.parse(files['package.json']) };
    for (const [p, [name, version]] of Object.entries(packageVersions)) {
      const packageName = `@aplicacoesboilerplate/${name}`;
      const pkg = { name: packageName, version, ...(p === 'apps/docs'
        ? { private: true, dependencies: { '@aplicacoesboilerplate/ui-vuetify': '^1.1.1' } } : {}) };
      files[`${p}/package.json`] = JSON.stringify(pkg);
      lockPackages[p] = pkg;
      lockPackages[`node_modules/${packageName}`] = { resolved: p, link: true };
    }
    files['package-lock.json'] = JSON.stringify({ name: '@aplicacoesboilerplate/packages-vue', version: '0.0.1', lockfileVersion: 3, packages: lockPackages });
    const nodeManifest = await Manifest.fromManifest(nativeGitHub, 'master', 'workspace-release.json', 'workspace-versions.json');
    assert.equal(nodeManifest.repositoryConfig['packages/ui/vuetify'].releaseAs, undefined);
    assert.equal(nodeManifest.releasedVersions['packages/ui/vuetify'].toString(), '1.1.1', 'Bootstrap preserva a versão do componente renomeado');
    const strategies: Record<string, Strategy> = {};
    const previous = Object.fromEntries(Object.keys(packageVersions).map(p => [p, {
      tag: new TagName(nodeManifest.releasedVersions[p], nodeManifest.repositoryConfig[p].component), sha: 'a'.repeat(40), notes: '',
    }]));
    for (const [p, config] of Object.entries(nodeManifest.repositoryConfig)) {
      strategies[p] = await buildStrategy({ ...config, path: p, github: nativeGitHub, targetBranch: 'master' });
    }
    const changedPath = 'packages/ui/vuetify';
    const uiCandidate = await strategies[changedPath].buildReleasePullRequest(parseConventionalCommits([{
      sha: 'a'.repeat(40), message: 'fix: valida o pacote Vue independente', files: [`${changedPath}/src/index.ts`],
    }]), previous[changedPath]);
    assert.ok(uiCandidate);
    assert.equal(uiCandidate.version?.toString(), '1.1.2');
    const plugin = nodeManifest.plugins[0];
    await plugin.preconfigure(strategies, {}, previous);
    const nativeCandidates = await plugin.run([{ path: changedPath, pullRequest: uiCandidate, config: nodeManifest.repositoryConfig[changedPath] }]);
    assert.equal(nativeCandidates.length, 1);
    applyNative(nativeCandidates[0].pullRequest.updates);
    assert.equal(JSON.parse(files['packages/ui/vuetify/package.json']).version, '1.1.2');
    assert.equal(JSON.parse(files['packages/utils/package.json']).version, '0.0.1');
    const docs = JSON.parse(files['apps/docs/package.json']);
    assert.equal(docs.private, true);
    assert.equal(docs.dependencies['@aplicacoesboilerplate/ui-vuetify'], '^1.1.2');
    const lock = JSON.parse(files['package-lock.json']);
    assert.equal(lock.packages['packages/ui/vuetify'].version, '1.1.2');
    assert.equal(lock.packages['apps/docs'].dependencies['@aplicacoesboilerplate/ui-vuetify'], '^1.1.2');
    assert.equal(JSON.parse(files['package.json']).private, true);
    assert.equal(JSON.parse(files['package.json']).version, '0.0.1');
    const nodePR = nativeCandidates[0].pullRequest;
    const mergedNodePR = { number: 125, headBranchName: nodePR.headRefName, baseBranchName: 'master',
      title: nodePR.title.toString(), body: nodePR.body.toString(), labels: nodePR.labels,
      files: nodePR.updates.map(update => update.path), sha: 'b'.repeat(40) };
    const uiReleases = await strategies[changedPath].buildReleases(mergedNodePR);
    assert.equal(uiReleases[0].tag.toString(), '@aplicacoesboilerplate/ui-vuetify@1.1.2');
    assert.deepEqual(await strategies['apps/docs'].buildReleases(mergedNodePR), [], 'Nó privado não gera tag/Release');
    t.diagnostic('Maven e workspace npm: versões, XML, dependências, lockfile e tags calculados pelo SDK real, sem escrita no GitHub');
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

test('Publicador Gradle central só roda por opt-in e após uma release nova', () => {
  const WORKFLOW = parse(fs.readFileSync(CALLED_WORKFLOW_PATH, 'utf8'));
  const JOB = WORKFLOW.jobs['publish-gradle'];
  assert.ok(JOB, 'A called deve disponibilizar o adaptador de publicação Gradle');
  assert.equal(JOB.needs, 'release-please');
  const EXPRESSION = JOB.if
    .replaceAll('inputs.publish-artifacts', "inputs['publish-artifacts']")
    .replaceAll('inputs.project-type', "inputs['project-type']")
    .replaceAll('needs.release-please', "needs['release-please']");
  const ENABLED = new Function('inputs', 'needs', 'return Boolean(' + EXPRESSION + ')') as
    (inputs: object, needs: object) => boolean;
  for (const [TYPE, PUBLISH, CREATED, EXPECTED] of [
    ['gradle', true, 'true', true], ['gradle', false, 'true', false],
    ['gradle', true, 'false', false], ['node', true, 'true', false],
  ] as const) {
    assert.equal(ENABLED({ 'project-type': TYPE, 'publish-artifacts': PUBLISH },
      { 'release-please': { outputs: { releases_created: CREATED } } }), EXPECTED);
  }
  const CHECKOUT = JOB.steps.find((STEP: { uses?: string }) => STEP.uses === 'actions/checkout@v4');
  assert.equal(CHECKOUT.with.ref, '${{ steps.target.outputs.tag }}');
  const PUBLISH = JOB.steps.find((STEP: { id?: string }) => STEP.id === 'publish');
  assert.equal(PUBLISH['working-directory'], '${{ steps.target.outputs.path }}');
  assert.equal(PUBLISH.run, './gradlew --no-daemon check publish');
  assert.equal(JOB.steps.find((STEP: { uses?: string }) => STEP.uses === 'actions/setup-java@v4').with['java-version'],
    '${{ inputs.gradle-java-version }}');
  assert.equal(JOB.permissions, undefined, 'O job condicional não deve exigir novas permissões de todos os callers');
});

test('Publicador Gradle seleciona uma release simple no caminho pedido e rejeita publicação ambígua', () => {
  const WORKFLOW = parse(fs.readFileSync(CALLED_WORKFLOW_PATH, 'utf8'));
  const JOB = WORKFLOW.jobs['publish-gradle'];
  assert.ok(JOB, 'Adaptador Gradle ausente');
  const SELECT = JOB.steps.find((STEP: { id?: string }) => STEP.id === 'target');
  assert.equal(SELECT.env.RELEASES, '${{ needs.release-please.outputs.releases }}');
  const RUN = new Function('core', 'process', SELECT.with.script) as (core: object, process: object) => void;
  const VALID = { path: 'packages/lib', version: '0.0.2', tag_name: 'lib-v0.0.2', release_type: 'simple' };
  const OUTPUTS: Record<string, string> = {};
  RUN({ setOutput: (KEY: string, VALUE: string) => { OUTPUTS[KEY] = VALUE; } },
    { env: { RELEASES: JSON.stringify([VALID]), PROJECT_PATH: 'packages/lib' } });
  assert.deepEqual(OUTPUTS, { path: 'packages/lib', tag: 'lib-v0.0.2' });
  for (const RELEASES of [[], [VALID, VALID], [{ ...VALID, path: 'docs' }],
    [{ ...VALID, release_type: 'node' }], [{ ...VALID, tag_name: '' }]]) {
    assert.throws(() => RUN({ setOutput: () => assert.fail('Não pode publicar um alvo inválido') },
      { env: { RELEASES: JSON.stringify(RELEASES), PROJECT_PATH: 'packages/lib' } }), /Gradle/);
  }
});
