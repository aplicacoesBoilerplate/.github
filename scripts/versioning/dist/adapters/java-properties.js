function unescapeProperty(value) {
    return value.replace(/\\(u.{0,4}|.)/g, (_, escape) => {
        if (escape.startsWith('u')) {
            if (!/^u[0-9a-f]{4}$/i.test(escape))
                throw new Error('Escape unicode inválido em Properties');
            return String.fromCharCode(Number.parseInt(escape.slice(1), 16));
        }
        const escapes = { t: '\t', n: '\n', r: '\r', f: '\f' };
        return escapes[escape] ?? escape;
    });
}
export function parseJavaProperties(raw) {
    if (typeof raw !== 'string')
        throw new Error('Properties inválido');
    const properties = {};
    let logical = '';
    let continued = false;
    for (const physical of raw.split(/\r?\n/)) {
        const line = physical.replace(/^[ \t\f]+/, '');
        if (!continued && (!line || /^[#!]/.test(line)))
            continue;
        logical += line;
        const trailing = logical.match(/\\+$/)?.[0].length ?? 0;
        continued = trailing % 2 === 1;
        if (continued) {
            logical = logical.slice(0, -1);
            continue;
        }
        let separator = logical.length;
        let escaped = false;
        for (let index = 0; index < logical.length; index++) {
            const character = logical[index];
            if (!escaped && character && /[=:\t\f ]/.test(character)) {
                separator = index;
                break;
            }
            escaped = !escaped && character === '\\';
        }
        const key = unescapeProperty(logical.slice(0, separator));
        let value = logical.slice(separator).replace(/^[ \t\f]+/, '');
        if (/^[=:]/.test(value))
            value = value.slice(1);
        value = value.replace(/^[ \t\f]+/, '');
        if (Object.hasOwn(properties, key))
            throw new Error(`Propriedade duplicada: ${key}`);
        Object.defineProperty(properties, key, { value: unescapeProperty(value), enumerable: true,
            configurable: true });
        logical = '';
    }
    if (continued)
        throw new Error('Properties terminou durante continuação');
    return properties;
}
