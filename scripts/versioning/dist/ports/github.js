export class GitHubHttpError extends Error {
    status;
    constructor(status, method) {
        super(`GitHub API HTTP ${status} on ${method}`);
        this.name = 'GitHubHttpError';
        this.status = status;
    }
}
function baseUrl(value) {
    const base = new URL(value.endsWith('/') ? value : `${value}/`);
    if (base.protocol !== 'https:')
        throw new Error('GitHub API base must use HTTPS');
    return base;
}
function endpointUrl(base, endpoint) {
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
async function request(transport, method, url, body, optional404 = false) {
    let result;
    try {
        result = await transport(body === undefined
            ? { method, url: url.href } : { method, url: url.href, body });
    }
    catch {
        throw new Error('GitHub transport failed');
    }
    if (!result || !Number.isInteger(result.status) || result.status < 100 || result.status > 599 ||
        !result.headers || typeof result.headers !== 'object') {
        throw new Error('GitHub transport returned an invalid response');
    }
    if (result.status === 404 && optional404)
        return null;
    if (result.status < 200 || result.status >= 300)
        throw new GitHubHttpError(result.status, method);
    return result;
}
function nextPage(response, current, base) {
    const link = Object.entries(response.headers).find(([name]) => name.toLowerCase() === 'link')?.[1];
    if (!link)
        return null;
    const next = link.split(',').find(part => /rel\s*=\s*"?next"?/i.test(part));
    if (!next)
        return null;
    const target = /<([^>]+)>/.exec(next)?.[1];
    if (!target)
        throw new Error('GitHub pagination link inválido');
    const url = new URL(target, current);
    if (url.origin !== base.origin || url.pathname !== current.pathname) {
        throw new Error('GitHub pagination saiu do endpoint original');
    }
    return url;
}
export function createReadApi(transport, apiBase = 'https://api.github.com/') {
    const base = baseUrl(apiBase);
    const get = async (endpoint) => (await request(transport, 'GET', endpointUrl(base, endpoint)))?.body;
    const getOptional = async (endpoint) => (await request(transport, 'GET', endpointUrl(base, endpoint), undefined, true))?.body ?? null;
    const list = async (endpoint) => {
        let url = endpointUrl(base, endpoint);
        const originalPath = url.pathname;
        const seen = new Set();
        const items = [];
        while (url) {
            if (seen.has(url.href) || seen.size >= 1000)
                throw new Error('GitHub pagination cycle or limit');
            seen.add(url.href);
            const response = await request(transport, 'GET', url);
            if (!response || !Array.isArray(response.body))
                throw new Error('GitHub list response inválida');
            items.push(...response.body);
            const candidate = nextPage(response, url, base);
            if (candidate && candidate.pathname !== originalPath)
                throw new Error('GitHub pagination path changed');
            url = candidate;
        }
        return items;
    };
    return Object.freeze({ get, getOptional, list });
}
export function createWriteApi(transport, apiBase = 'https://api.github.com/') {
    const base = baseUrl(apiBase);
    const mutate = async (method, endpoint, body) => (await request(transport, method, endpointUrl(base, endpoint), body))?.body;
    return Object.freeze({
        post: (endpoint, body) => mutate('POST', endpoint, body),
        patch: (endpoint, body) => mutate('PATCH', endpoint, body),
        put: (endpoint, body) => mutate('PUT', endpoint, body),
        delete: (endpoint) => mutate('DELETE', endpoint),
    });
}
