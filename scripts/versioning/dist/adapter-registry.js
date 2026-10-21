import { adapterCapabilities, validateDescriptor } from './adapter-contract.js';
export function resolveAdapter(id, implementations) {
    if (typeof id !== 'string' || !Object.hasOwn(adapterCapabilities, id)) {
        throw new Error(`Adaptador não suportado: ${String(id)}`);
    }
    const selected = id;
    const implementation = implementations[selected];
    if (!implementation)
        throw new Error(`Adaptador ${selected} não implementado`);
    const capability = adapterCapabilities[selected];
    return validateDescriptor({ id: selected, ...capability, ...implementation });
}
