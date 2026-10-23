import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { assertDistributionContext, inspectDistribution, readArtifact } from './artifact-safety.js';
const record = (value) => {
    if (typeof value !== 'object' || value === null || Array.isArray(value))
        throw new Error('POM: campo XML inválido/duplicado');
    return value;
};
const scalar = (value) => {
    if (value === undefined)
        return '';
    if (typeof value !== 'string')
        throw new Error('POM: campo escalar inválido/duplicado');
    return value.trim();
};
const nodes = (value) => value === undefined ? [] : (Array.isArray(value) ? value : [value]).map(record);
const ga = (g, a) => `${g}:${a}`;
const id = (node) => ga(scalar(node.groupId), scalar(node.artifactId));
function xml(bytes) {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    if (/<!DOCTYPE|<!ENTITY/i.test(text))
        throw new Error('POM XML: DOCTYPE/entidade não permitida');
    if (XMLValidator.validate(text) !== true)
        throw new Error('POM XML inválido');
    return record(new XMLParser({ ignoreAttributes: true, parseTagValue: false, processEntities: false,
        removeNSPrefix: true, maxNestedTags: 64 }).parse(text));
}
function dependencyNodes(node) {
    const result = [];
    for (const [key, value] of Object.entries(node)) {
        if (key === 'dependency')
            result.push(...nodes(value));
        else if (typeof value === 'object' && value !== null) {
            for (const child of Array.isArray(value) ? value : [value]) {
                if (typeof child === 'object' && child !== null)
                    result.push(...dependencyNodes(record(child)));
            }
        }
    }
    return result;
}
/** Validate distributable POMs, not merely the effective model used to compile them. No deploy capability. */
export async function validateMavenArtifacts(input, registry) {
    assertDistributionContext(input);
    if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(input.approvedVersion) || !input.modules.length) {
        throw new Error('Versão aprovada/reactor inválido');
    }
    const modules = new Map();
    for (const module of input.modules) {
        if (!/^[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)*$/.test(module.groupId) ||
            !/^[A-Za-z0-9_-][A-Za-z0-9._-]*$/.test(module.artifactId) || !['pom', 'jar'].includes(module.packaging)) {
            throw new Error('Coordenada/packaging Maven inválido');
        }
        const key = ga(module.groupId, module.artifactId);
        if (modules.has(key))
            throw new Error('Módulo duplicado');
        modules.set(key, module);
    }
    const effectiveRoot = xml(readArtifact(input.stagingRoot, input.effectivePom, 8 * 1024 * 1024));
    const effective = effectiveRoot.project ? nodes(effectiveRoot.project) : nodes(record(effectiveRoot.projects).project);
    const seenEffective = new Set();
    for (const model of effective) {
        const key = id(model), module = modules.get(key);
        if (!module || seenEffective.has(key) || scalar(model.version) !== input.approvedVersion ||
            (scalar(model.packaging) || 'jar') !== module.packaging)
            throw new Error('Modelo efetivo diverge do reactor/versão');
        seenEffective.add(key);
        for (const dep of dependencyNodes(model)) {
            if (modules.has(id(dep)) && scalar(dep.version) !== input.approvedVersion) {
                throw new Error('Referência interna do modelo efetivo divergente');
            }
        }
    }
    if (seenEffective.size !== modules.size)
        throw new Error('Modelo efetivo do reactor incompleto');
    const poms = new Map();
    const paths = new Set(), coordinates = new Set();
    const artifacts = input.artifacts.map(artifact => {
        const key = ga(artifact.groupId, artifact.artifactId), module = modules.get(key);
        if (!module || artifact.version !== input.approvedVersion || artifact.packaging !== module.packaging ||
            !['jar', 'pom'].includes(artifact.extension) || (module.packaging === 'pom' && artifact.extension !== 'pom') || (artifact.classifier !== undefined &&
            (!/^[A-Za-z0-9_-]+$/.test(artifact.classifier) || artifact.extension !== 'jar'))) {
            throw new Error('Coordenada/versão Maven diverge do reactor');
        }
        const coordinate = `${key}:${artifact.version}:${artifact.extension}:${artifact.classifier ?? ''}`;
        const expected = `${artifact.groupId.replaceAll('.', '/')}/${artifact.artifactId}/${artifact.version}/` +
            `${artifact.artifactId}-${artifact.version}${artifact.classifier ? '-' + artifact.classifier : ''}.${artifact.extension}`;
        if (artifact.path !== expected)
            throw new Error('Artifact path diverge do layout Maven');
        if (coordinates.has(coordinate) || paths.has(artifact.path))
            throw new Error('Artifact Maven duplicado');
        coordinates.add(coordinate);
        paths.add(artifact.path);
        const bytes = readArtifact(input.stagingRoot, artifact, artifact.extension === 'pom' ? 2 * 1024 * 1024 : undefined);
        if (artifact.extension === 'pom') {
            const model = record(xml(bytes).project), parent = model.parent === undefined ? {} : record(model.parent);
            // Distributed identity must be self-resolving before fetching its parent; no CI-only revision placeholders.
            if (scalar(model.groupId ?? parent.groupId) !== artifact.groupId || scalar(model.artifactId) !== artifact.artifactId ||
                scalar(model.version ?? parent.version) !== artifact.version || (scalar(model.packaging) || 'jar') !== module.packaging) {
                throw new Error('Identidade/versão do POM distribuível diverge');
            }
            poms.set(key, model);
        }
        return { ...artifact, coordinate };
    }).sort((a, b) => a.coordinate.localeCompare(b.coordinate));
    for (const [key, module] of modules) {
        if (!poms.has(key) || (module.packaging === 'jar' && !coordinates.has(`${key}:${input.approvedVersion}:jar:`))) {
            throw new Error('Artifact do reactor ausente/incompleto');
        }
    }
    function properties(key, seen = new Set()) {
        if (seen.has(key))
            throw new Error('Ciclo de parent Maven');
        seen.add(key);
        const model = poms.get(key);
        const parent = model.parent === undefined ? {} : record(model.parent);
        const inherited = poms.has(id(parent)) ? properties(id(parent), seen) : {};
        const own = model.properties === undefined ? {} : record(model.properties);
        return { ...inherited, ...Object.fromEntries(Object.entries(own).map(([k, v]) => [k, scalar(v)])),
            'project.version': input.approvedVersion, 'pom.version': input.approvedVersion,
            'project.groupId': key.split(':')[0], 'project.artifactId': key.split(':')[1] };
    }
    function interpolate(value, props, seen = new Set()) {
        return value.replace(/\$\{([^}]+)\}/g, (_match, name) => {
            if (!Object.hasOwn(props, name) || seen.has(name))
                throw new Error(`Propriedade Maven não resolvida/ciclo: ${name}`);
            return interpolate(props[name], props, new Set([...seen, name]));
        });
    }
    function managedVersion(key, target, seen = new Set()) {
        if (seen.has(key))
            throw new Error('Ciclo de BOM/parent Maven');
        seen.add(key);
        const model = poms.get(key);
        const manager = model.dependencyManagement === undefined ? {} : record(model.dependencyManagement);
        const deps = dependencyNodes(manager), props = properties(key);
        for (const dep of deps) {
            const depKey = ga(interpolate(scalar(dep.groupId), props), interpolate(scalar(dep.artifactId), props));
            if (depKey === target && dep.version !== undefined)
                return interpolate(scalar(dep.version), props);
        }
        for (const dep of deps) {
            if (scalar(dep.scope) === 'import' && scalar(dep.type) === 'pom') {
                const imported = ga(interpolate(scalar(dep.groupId), props), interpolate(scalar(dep.artifactId), props));
                if (poms.has(imported)) {
                    const value = managedVersion(imported, target, new Set(seen));
                    if (value)
                        return value;
                }
            }
        }
        const parent = model.parent === undefined ? {} : record(model.parent);
        return poms.has(id(parent)) ? managedVersion(id(parent), target, seen) : '';
    }
    for (const [key, model] of poms) {
        const props = properties(key);
        if (model.parent !== undefined) {
            const parent = record(model.parent);
            if (modules.has(id(parent)) && scalar(parent.version) !== input.approvedVersion)
                throw new Error('Referência parent divergente');
        }
        for (const dep of dependencyNodes(model)) {
            const target = ga(interpolate(scalar(dep.groupId), props), interpolate(scalar(dep.artifactId), props));
            if (modules.has(target)) {
                const version = dep.version === undefined ? managedVersion(key, target) : interpolate(scalar(dep.version), props);
                if (version !== input.approvedVersion)
                    throw new Error(`Referência interna/versão divergente: ${target}`);
            }
        }
    }
    return inspectDistribution(input, artifacts, artifact => registry.lookup(artifact));
}
