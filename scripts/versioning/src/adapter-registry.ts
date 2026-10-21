import { adapterCapabilities, validateDescriptor } from './adapter-contract.js';
import type { AdapterContext, AdapterDescriptor, AdapterId, Collector, Preparer } from './adapter-contract.js';

export interface AdapterImplementation {
  readonly collect: Collector;
  readonly prepare?: Preparer;
}

export function resolveAdapter(id: unknown,
  implementations: Partial<Record<AdapterId, AdapterImplementation>>): AdapterDescriptor {
  if (typeof id !== 'string' || !Object.hasOwn(adapterCapabilities, id)) {
    throw new Error(`Adaptador não suportado: ${String(id)}`);
  }
  const selected = id as AdapterId;
  const implementation = implementations[selected];
  if (!implementation) throw new Error(`Adaptador ${selected} não implementado`);
  const capability = adapterCapabilities[selected];
  return validateDescriptor({ id: selected, ...capability, ...implementation });
}

export type { AdapterContext };
