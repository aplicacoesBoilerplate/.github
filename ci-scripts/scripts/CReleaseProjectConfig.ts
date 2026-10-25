import { CReleaseVersionPolicy } from './CReleaseVersionPolicy.js';

export interface IReleaseProject {
  path: string;
  releaseType: string;
  tagPrefix: string;
  releaseAs?: string;
  component?: string;
}

// Interpreta apenas identidade, diretório e adaptador; o SDK continua responsável pelo release.
export class CReleaseProjectConfig {
  public static normalizePath(pPath: string): string {
    const DIRECTORY = pPath.trim().replace(/\/+$/, '');
    if (DIRECTORY === '.') return DIRECTORY;
    if (!DIRECTORY || !/^[\w@.-]+(?:\/[\w@.-]+)*$/.test(DIRECTORY)
      || DIRECTORY.split('/').some(PART => PART === '..' || PART === '.')) {
      throw new Error(`O diretório '${pPath}' deve ser relativo ao repositório, sem navegação para fora dele.`);
    }
    return DIRECTORY;
  }

  public static read(pConfig: unknown, pSelectedPath = '.'): IReleaseProject[] {
    const CONFIG = pConfig as Record<string, any>;
    if (!CONFIG?.packages || typeof CONFIG.packages !== 'object' || Array.isArray(CONFIG.packages)) {
      throw new Error('O manifest deve declarar packages por diretório.');
    }
    const PROJECTS = Object.entries(CONFIG.packages).map(([DIRECTORY, RAW]) => {
      const PACKAGE = RAW as Record<string, any>;
      const RELEASE_TYPE = PACKAGE['release-type'] || CONFIG['release-type'] || 'node';
      if (!['node', 'go', 'maven', 'gradle', 'simple'].includes(RELEASE_TYPE)) throw new Error(`adaptador não suportado: ${RELEASE_TYPE}`);
      const COMPONENT_TAG = PACKAGE['include-component-in-tag'] ?? CONFIG['include-component-in-tag'];
      if (typeof COMPONENT_TAG !== 'boolean') throw new Error('Declare include-component-in-tag explicitamente para definir a identidade da tag.');
      const COMPONENT = PACKAGE.component || CONFIG.component;
      if (COMPONENT_TAG && (typeof COMPONENT !== 'string' || !/^@?[\w.-]+(?:\/[\w.-]+)*$/.test(COMPONENT) || COMPONENT.includes('..'))) {
        throw new Error('Cada componente deve ter um nome explícito e seguro para sua tag.');
      }
      const INCLUDE_V = PACKAGE['include-v-in-tag'] ?? CONFIG['include-v-in-tag'] ?? true;
      const SEPARATOR = PACKAGE['tag-separator'] ?? CONFIG['tag-separator'] ?? '-';
      if (typeof INCLUDE_V !== 'boolean' || !['-', '@', '_', '.'].includes(SEPARATOR)) {
        throw new Error('Identidade da tag inválida.');
      }
      const PROJECT: IReleaseProject = {
        path: this.normalizePath(DIRECTORY), releaseType: RELEASE_TYPE,
        tagPrefix: (COMPONENT_TAG ? COMPONENT + SEPARATOR : '') + (INCLUDE_V ? 'v' : ''),
        ...(COMPONENT_TAG ? { component: COMPONENT } : {}),
      };
      const RELEASE_AS = PACKAGE['release-as'] ?? CONFIG['release-as'];
      if (RELEASE_AS) PROJECT.releaseAs = CReleaseVersionPolicy.resolve(undefined, [`Release-As: ${RELEASE_AS}`]);
      return PROJECT;
    });
    if (!PROJECTS.length) throw new Error('Nenhum pacote configurado.');
    if (new Set(PROJECTS.map(PROJECT => PROJECT.tagPrefix)).size !== PROJECTS.length) {
      throw new Error('Pacotes independentes precisam de namespaces de tag distintos.');
    }
    const SELECTED = this.normalizePath(pSelectedPath);
    if (PROJECTS.length > 1 && SELECTED === '.' && CONFIG['release-as']) {
      throw new Error('release-as global é ambíguo para vários pacotes; declare a versão por pacote.');
    }
    if (SELECTED === '.') return PROJECTS;
    const MATCH = PROJECTS.filter(PROJECT => PROJECT.path === SELECTED);
    if (!MATCH.length) throw new Error(`O diretório '${SELECTED}' não está configurado.`);
    return MATCH;
  }
}
