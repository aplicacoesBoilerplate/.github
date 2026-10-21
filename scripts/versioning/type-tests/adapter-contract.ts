import type { AdapterContext, AdapterDescriptor, DescriptorFor } from '../src/adapter-contract.js';

const context: AdapterContext = {
  repository: 'example/repo', workspace: '.', projectPath: '.', targetBranch: 'master',
  sha: 'a'.repeat(40), tagPrefix: 'v', configuration: {},
};

const go: DescriptorFor<'go-gitsemver'> = {
  id: 'go-gitsemver', runtime: 'go', reportKind: 'single', needsVersionPr: false,
  tagKind: 'lightweight', collect: current => current.sha,
};
go.collect(context);

// @ts-expect-error Caller context never carries credentials.
const leakedContext: AdapterContext = { ...context, token: 'do-not-model-secrets' };
void leakedContext;

// @ts-expect-error A Go descriptor cannot claim a Node runtime.
const wrongRuntime: AdapterDescriptor = { id: 'go-gitsemver', runtime: 'node', reportKind: 'single', needsVersionPr: false, tagKind: 'lightweight', collect: () => null };
void wrongRuntime;

// @ts-expect-error A version-PR adapter must provide its preparation function.
const missingPrepare: AdapterDescriptor = { id: 'changesets', runtime: 'node', reportKind: 'batch', needsVersionPr: true, tagKind: 'lightweight', collect: () => null };
void missingPrepare;

// @ts-expect-error Read-only Go cannot gain an artificial prepare capability.
const artificialPrepare: DescriptorFor<'go-gitsemver'> = { ...go, prepare: () => null };
void artificialPrepare;
