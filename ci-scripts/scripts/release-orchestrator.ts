import * as fs from 'fs';
import * as path from 'path';
import { CReleaseConfiguration } from './release-configuration.js';

// 1. Contrato de Configuração do Release Please
interface PackageConfig {
  'release-type': string;
  'release-as'?: string;
  'extra-files'?: string[];
}

interface ReleasePleaseConfig {
  packages: Record<string, PackageConfig>;
}

// 2. Classe Base Abstrata (Abstração POO para os Adaptadores), adiciona a release na configuração para o release-please-config.json
abstract class CProjectAdapter {
  protected abstract lReleaseType: string;

  public buildPackageConfig(pVersion?: string): PackageConfig {
    const CONFIG: PackageConfig = {
      'release-type': this.lReleaseType,
    };

    if (pVersion) {
      CONFIG['release-as'] = pVersion;
    }

    return CONFIG;
  }
}

// 3. Implementações Concretas (Polimorfismo para cada stack)
class CNodeAdapter extends CProjectAdapter {
  protected lReleaseType = 'node'; // Atualiza package.json e CHANGELOG.md
}

class CGoAdapter extends CProjectAdapter {
  protected lReleaseType = 'go'; // Gerencia tags e CHANGELOG.md para o GoReleaser
}

class CMavenAdapter extends CProjectAdapter {
  protected lReleaseType = 'maven'; // Atualiza pom.xml automaticamente
}

class GradleAdapter extends CProjectAdapter {
  protected lReleaseType = 'gradle'; // Atualiza build.gradle / gradle.properties
}

class CSimpleAdapter extends CProjectAdapter {
  protected lReleaseType = 'simple'; // Versiona as próprias pipelines sem publicar pacote
}

// 4. Factory para instanciar o adaptador correto
class CAdapterFactory {
  public static create(pType: string): CProjectAdapter {
    switch (pType.toLowerCase()) {
      case 'node':
      case 'vue':
      case 'typescript':
        return new CNodeAdapter();
      case 'go':
        return new CGoAdapter();
      case 'maven':
      case 'java':
        return new CMavenAdapter();
      case 'gradle':
      case 'kotlin':
        return new GradleAdapter();
      case 'simple':
        return new CSimpleAdapter();
      default:
        throw new Error(`Adaptador não suportado para o tipo de projeto: ${pType}`);
    }
  }
}

// 5. Domínio da Milestone (Regra de Negócio de Versionamento)
class CMilestoneParser {
  public static extractVersion(pMilestoneTitle?: string, pPrBranch?: string): string | undefined {
    // Se o PR sendo mergeado já for o próprio PR do Release Please, não forçamos versão
    if (pPrBranch && pPrBranch.startsWith('release-please')) {
      console.log('Merge do PR de Release detectado. Ignorando extração de Milestone.');
      return undefined;
    }

    if (!pMilestoneTitle) {
      throw new Error('Falha de Governança: PR mergeado na master sem uma Milestone associada!');
    }

    // Remove o prefixo 'v' ou 'V' (ex: v1.2.3 -> 1.2.3)
    const CLEAN_VERSION = pMilestoneTitle.trim().replace(/^[vV]/, '');
    try {
      CReleaseConfiguration.assertVersion(CLEAN_VERSION);
    } catch {
      throw new Error(`A Milestone '${pMilestoneTitle}' não segue o padrão SemVer (vX.Y.Z).`);
    }

    return CLEAN_VERSION;
  }
}

// 6. Orquestrador Principal
class CReleaseOrchestrator {
  public run(): void {
    const PROJECT_TYPE = process.env.PROJECT_TYPE || '';
    const MILESTONE_TITLE = process.env.MILESTONE_TITLE;
    const PR_HEADE_REF = process.env.PR_HEAD_REF;

    console.log(`Iniciando orquestração para o tipo de projeto: [${PROJECT_TYPE}]`);

    const ADAPTER = CAdapterFactory.create(PROJECT_TYPE);
    const TARGET_VERSION = CMilestoneParser.extractVersion(MILESTONE_TITLE, PR_HEADE_REF);
    const SETTINGS = CReleaseConfiguration.load(
      process.env.RELEASE_CONFIG_FILE || '',
      process.env.RELEASE_MANIFEST_FILE || '.release-please-manifest.json',
      process.env.VERSION_POLICY || 'milestone',
    );
    const RELEASE_AS = SETTINGS.policy === 'milestone' ? TARGET_VERSION : undefined;

    const CONFIG: ReleasePleaseConfig = {
      packages: {
        '.': ADAPTER.buildPackageConfig(RELEASE_AS),
      },
    };

    const OUTPUT_PATH = path.resolve(process.cwd(), 'release-please-config.json');
    if (!SETTINGS.configFile) fs.writeFileSync(OUTPUT_PATH, JSON.stringify(CONFIG, null, 2), 'utf-8');

    // A Action recebe inputs oficiais; um JSON apenas local não configura manifest-mode.
    if (process.env.GITHUB_OUTPUT) {
      fs.appendFileSync(process.env.GITHUB_OUTPUT,
        `release_type=${SETTINGS.configFile ? '' : CONFIG.packages['.']['release-type']}\nrelease_as=${RELEASE_AS || ''}\nengine=${SETTINGS.engine}\n`, 'utf-8');
    }

    if (!SETTINGS.configFile) {
      console.log('Arquivo release-please-config.json gerado com sucesso:');
      console.log(fs.readFileSync(OUTPUT_PATH, 'utf-8'));
    } else {
      console.log(`Config do consumidor preservado; engine=${SETTINGS.engine}, policy=${SETTINGS.policy}`);
    }
  }
}

// Execução do Release Please
try {
  new CReleaseOrchestrator().run();
} catch (error) {
  console.error((error as Error).message);
  process.exit(1);
}
