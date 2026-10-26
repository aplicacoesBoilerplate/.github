// Uma tag existente só é reutilizável pela reexecução do mesmo commit de release.
export class CReleaseTagGuard {
  public constructor(private readonly REQUEST: typeof fetch = fetch) {}
  public async check(pRepository: string, pTag: string, pToken: string, pCommit?: string, pApiUrl = 'https://api.github.com'): Promise<void> {
    const GET = async (pPath: string, pOptional = false): Promise<any> => {
      const RESPONSE = await this.REQUEST(`${pApiUrl.replace(/\/$/, '')}/repos/${pRepository}/${pPath}`, {
        headers: { Authorization: `Bearer ${pToken}`, Accept: 'application/vnd.github+json' },
        signal: AbortSignal.timeout(30000),
      });
      if (RESPONSE.status === 404 && pOptional) return undefined;
      if (!RESPONSE.ok) throw new Error(`Não foi possível validar a tag: HTTP ${RESPONSE.status}.`);
      return RESPONSE.json();
    };
    const REF = await GET(`git/ref/tags/${encodeURIComponent(pTag)}`, true);
    if (REF) {
      if (!pCommit) throw new Error(`A tag ${pTag} já existe; essa versão não pode ser usada em nova entrega.`);
      let OBJECT = REF.object;
      for (let DEPTH = 0; OBJECT?.type === 'tag' && DEPTH < 10; DEPTH++) {
        OBJECT = (await GET(`git/tags/${encodeURIComponent(OBJECT.sha)}`)).object;
      }
      if (OBJECT?.type !== 'commit' || OBJECT.sha !== pCommit) {
        throw new Error(`A tag ${pTag} aponta para outro commit; publicação bloqueada sem sobrescrever a tag.`);
      }
      return;
    }
    if (await GET(`releases/tags/${encodeURIComponent(pTag)}`, true)) {
      throw new Error(`A tag ${pTag} já possui uma release e precisa de revisão antes de nova publicação.`);
    }
  }
}
