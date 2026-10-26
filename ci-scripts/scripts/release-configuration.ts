import * as fs from 'node:fs';
import * as path from 'node:path';
import { valid } from 'semver';

export type TVersionPolicy = 'milestone' | 'native';
export interface IReleaseConfiguration {
  configFile: string;
  manifestFile: string;
  policy: TVersionPolicy;
  engine: 'action' | 'configured-sdk';
}

/** Valida somente o contrato do consumidor; o parser e o cálculo são do Release Please. */
export class CReleaseConfiguration {
  public static load(pConfigFile = '', pManifestFile = '.release-please-manifest.json', pPolicy = 'milestone', pWorkspace = process.cwd()): IReleaseConfiguration {
    if (pPolicy !== 'milestone' && pPolicy !== 'native') {
      throw new Error(`Política de versão não suportada: ${pPolicy}`);
    }
    if (!pConfigFile) {
      if (pPolicy !== 'milestone') throw new Error('A política native exige configuração versionada no consumidor');
      return { configFile: '', manifestFile: pManifestFile, policy: pPolicy, engine: 'action' };
    }

    const configPath = this.repositoryFile(pConfigFile, pWorkspace);
    const manifestPath = this.repositoryFile(pManifestFile, pWorkspace);
    const config: unknown = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const manifest: unknown = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    if (!this.isRecord(config) || !this.isRecord(config.packages) || !this.isRecord(manifest)) {
      throw new Error('Config e manifest de versão devem ser objetos nativos do Release Please');
    }
    const components = Object.keys(config.packages);
    if (components.length === 0 || components.some(component => typeof manifest[component] !== 'string')) {
      throw new Error('O manifest deve informar a versão inicial de cada componente configurado');
    }
    for (const component of components) this.assertVersion(manifest[component] as string);
    if (pPolicy === 'milestone' && (components.length !== 1 || components[0] !== '.')) {
      throw new Error('Override da milestone exige um único componente na raiz; versões independentes usam política native');
    }
    return { configFile: pConfigFile, manifestFile: pManifestFile, policy: pPolicy,
      engine: pPolicy === 'milestone' ? 'configured-sdk' : 'action' };
  }

  public static assertVersion(pVersion: string): void {
    if (!valid(pVersion)) throw new Error(`Versão SemVer inválida: ${pVersion}`);
  }

  private static isRecord(pValue: unknown): pValue is Record<string, unknown> {
    return typeof pValue === 'object' && pValue !== null && !Array.isArray(pValue);
  }

  private static repositoryFile(pFile: string, pWorkspace: string): string {
    if (!pFile || /[\\\r\n\0]/.test(pFile) || /^[a-z]:/i.test(pFile) || path.posix.isAbsolute(pFile) || pFile.split('/').includes('..')) {
      throw new Error('Caminho de configuração deve permanecer dentro do repositório');
    }
    const resolved = fs.realpathSync(path.resolve(pWorkspace, pFile));
    const relative = path.relative(fs.realpathSync(pWorkspace), resolved);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new Error('Caminho de configuração deve permanecer dentro do repositório');
    }
    return resolved;
  }
}
