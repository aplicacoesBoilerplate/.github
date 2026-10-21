export type GitHubMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

export interface GitHubRequest {
  readonly method: GitHubMethod;
  readonly url: string;
  readonly body?: unknown;
}

export interface GitHubResponse {
  readonly status: number;
  readonly headers: Readonly<Record<string, string | undefined>>;
  readonly body: unknown;
}

export type GitHubTransport = (request: GitHubRequest) => Promise<GitHubResponse>;

export class GitHubHttpError extends Error {
  readonly status: number;

  constructor(status: number, method: GitHubMethod) {
    super(`GitHub API HTTP ${status} on ${method}`);
    this.name = 'GitHubHttpError';
    this.status = status;
  }
}

export interface ReadApi {
  get(endpoint: string): Promise<unknown>;
  getOptional(endpoint: string): Promise<unknown | null>;
  list(endpoint: string): Promise<unknown[]>;
  listField(endpoint: string, field: string): Promise<unknown[]>;
}

export interface WriteApi {
  post(endpoint: string, body: unknown): Promise<unknown>;
  patch(endpoint: string, body: unknown): Promise<unknown>;
  put(endpoint: string, body: unknown): Promise<unknown>;
  delete(endpoint: string): Promise<unknown>;
}

function baseUrl(value: string): URL {
  const base = new URL(value.endsWith('/') ? value : `${value}/`);
  if (base.protocol !== 'https:') throw new Error('GitHub API base must use HTTPS');
  return base;
}

function endpointUrl(base: URL, endpoint: string): URL {
  if (typeof endpoint !== 'string' || !endpoint || endpoint.startsWith('/') ||
    endpoint.includes('://') || /(^|\/)\.\.?($|\/)/.test(endpoint)) {
    throw new Error('GitHub endpoint inválido');
  }
  const result = new URL(endpoint, base);
  if (result.origin !== base.origin || !result.pathname.startsWith(base.pathname)) {
    throw new Error('GitHub endpoint fora da API');
  }
  return result;
}

async function request(transport: GitHubTransport, method: GitHubMethod,
  url: URL, body?: unknown, optional404 = false): Promise<GitHubResponse | null> {
  let result: GitHubResponse;
  try {
    result = await transport(body === undefined
      ? { method, url: url.href } : { method, url: url.href, body });
  } catch {
    throw new Error('GitHub transport failed');
  }
  if (!result || !Number.isInteger(result.status) || result.status < 100 || result.status > 599 ||
    !result.headers || typeof result.headers !== 'object') {
    throw new Error('GitHub transport returned an invalid response');
  }
  if (result.status === 404 && optional404) return null;
  if (result.status < 200 || result.status >= 300) throw new GitHubHttpError(result.status, method);
  return result;
}

function nextPage(response: GitHubResponse, current: URL, base: URL): URL | null {
  const link = Object.entries(response.headers).find(([name]) => name.toLowerCase() === 'link')?.[1];
  if (!link) return null;
  const next = link.split(',').find(part => /rel\s*=\s*"?next"?/i.test(part));
  if (!next) return null;
  const target = /<([^>]+)>/.exec(next)?.[1];
  if (!target) throw new Error('GitHub pagination link inválido');
  const url = new URL(target, current);
  if (url.origin !== base.origin || url.pathname !== current.pathname) {
    throw new Error('GitHub pagination saiu do endpoint original');
  }
  return url;
}

export function createReadApi(transport: GitHubTransport,
  apiBase = 'https://api.github.com/'): ReadApi {
  const base = baseUrl(apiBase);
  const get = async (endpoint: string): Promise<unknown> =>
    (await request(transport, 'GET', endpointUrl(base, endpoint)))?.body;
  const getOptional = async (endpoint: string): Promise<unknown | null> =>
    (await request(transport, 'GET', endpointUrl(base, endpoint), undefined, true))?.body ?? null;
  const paginate = async (endpoint: string, field?: string): Promise<unknown[]> => {
    let url: URL | null = endpointUrl(base, endpoint);
    const originalPath = url.pathname;
    const seen = new Set<string>();
    const items: unknown[] = [];
    while (url) {
      if (seen.has(url.href) || seen.size >= 1000) throw new Error('GitHub pagination cycle or limit');
      seen.add(url.href);
      const response = await request(transport, 'GET', url);
      if (!response) throw new Error('GitHub list response ausente');
      const page = field && response.body && typeof response.body === 'object' &&
        !Array.isArray(response.body) ? (response.body as Record<string, unknown>)[field] : response.body;
      if (!Array.isArray(page)) throw new Error('GitHub list response inválida');
      items.push(...page);
      const candidate: URL | null = nextPage(response, url, base);
      if (candidate && candidate.pathname !== originalPath) throw new Error('GitHub pagination path changed');
      url = candidate;
    }
    return items;
  };
  return Object.freeze({ get, getOptional, list: (endpoint: string) => paginate(endpoint),
    listField: (endpoint: string, field: string) => {
      if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(field)) throw new Error('GitHub list field inválido');
      return paginate(endpoint, field);
    } });
}

export function createWriteApi(transport: GitHubTransport,
  apiBase = 'https://api.github.com/'): WriteApi {
  const base = baseUrl(apiBase);
  const mutate = async (method: GitHubMethod, endpoint: string, body?: unknown): Promise<unknown> =>
    (await request(transport, method, endpointUrl(base, endpoint), body))?.body;
  return Object.freeze({
    post: (endpoint: string, body: unknown) => mutate('POST', endpoint, body),
    patch: (endpoint: string, body: unknown) => mutate('PATCH', endpoint, body),
    put: (endpoint: string, body: unknown) => mutate('PUT', endpoint, body),
    delete: (endpoint: string) => mutate('DELETE', endpoint),
  });
}
