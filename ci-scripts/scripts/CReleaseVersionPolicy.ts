// Regra única para versões declaradas por milestone, corpo do PR ou commits.
export class CReleaseVersionPolicy {
  private static normalize(pValue: string): string {
    const VERSION = pValue.trim().replace(/^[vV]/, '');
    const MATCH = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/.exec(VERSION);
    if (!MATCH || MATCH[4]?.split('.').some(PART => /^\d+$/.test(PART) && PART.length > 1 && PART.startsWith('0'))) {
      throw new Error(`A versão '${pValue}' não segue o padrão SemVer (vX.Y.Z).`);
    }
    return VERSION;
  }

  public static resolve(pMilestone: string | undefined, pMessages: string[]): string {
    const VERSIONS = new Set<string>();
    if (pMilestone) VERSIONS.add(this.normalize(pMilestone));
    for (const MESSAGE of pMessages) {
      let FENCE: string | undefined;
      for (const LINE of MESSAGE.split(/\r?\n/)) {
        const BLOCK = /^\s*(`{3,}|~{3,})/.exec(LINE);
        if (BLOCK) {
          if (!FENCE) FENCE = BLOCK[1][0];
          else if (BLOCK[1][0] === FENCE) FENCE = undefined;
          continue;
        }
        if (FENCE) continue;
        const FOOTER = /^Release-As:[ \t]*(.*)$/i.exec(LINE.trim());
        if (FOOTER) VERSIONS.add(this.normalize(FOOTER[1]));
      }
    }
    if (!VERSIONS.size) throw new Error('Falha de Governança: PR sem uma Milestone e sem footer Release-As válido.');
    if (VERSIONS.size > 1) throw new Error('Falha de Governança: versões divergentes entre milestone e Release-As.');
    return [...VERSIONS][0];
  }

  public static assertAvailable(pVersion: string, pTagExists: boolean, pTagPrefix = 'v'): void {
    if (pTagExists) throw new Error(`A versão ${pVersion} está indisponível: a tag ${pTagPrefix}${pVersion} já existe.`);
  }
}
