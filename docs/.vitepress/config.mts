import { readFileSync } from 'node:fs';
import { defineConfig } from 'vitepress';

const { version: VERSION } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(VERSION)) {
  throw new Error('docs/package.json deve conter uma versão SemVer no formato X.Y.Z');
}

export default defineConfig({
  lang: 'pt-BR',
  title: 'Boilerplate CI/CD & Governança',
  description: 'Catálogo centralizado de pipelines reutilizáveis, versionamento e templates.',
  base: '/.github/',
  themeConfig: {
    nav: [
      { text: `v${VERSION}`, link: '/releases' },
      { text: 'Início', link: '/' },
      {
        text: 'Versionamento',
        items: [
          { text: 'Visão geral', link: '/pipelines/versionamento-release-please' },
          { text: 'Artefatos e inputs', link: '/pipelines/release-please/artefatos' },
          { text: 'Versões e conflitos', link: '/pipelines/release-please/versoes-conflitos' },
          { text: 'Subdiretórios', link: '/pipelines/release-please/subdiretorios' },
          { text: 'Monorepos', link: '/pipelines/release-please/monorepos' },
          { text: 'Publicação e diagnóstico', link: '/pipelines/release-please/publicacao' },
        ],
      },
      { text: 'Governança & Templates', link: '/governanca/templates-issues-prs' },
    ],
    sidebar: [
      {
        text: 'Versionamento (Release Please)',
        items: [
          { text: 'Visão geral e ciclo de release', link: '/pipelines/versionamento-release-please' },
          { text: 'Artefatos e inputs', link: '/pipelines/release-please/artefatos' },
          { text: 'Versões, conflitos e duplicidade', link: '/pipelines/release-please/versoes-conflitos' },
          { text: 'Projetos em subdiretórios', link: '/pipelines/release-please/subdiretorios' },
          { text: 'Monorepos: cinco pacotes Vue', link: '/pipelines/release-please/monorepos' },
          { text: 'Publicação e diagnóstico', link: '/pipelines/release-please/publicacao' },
        ],
      },
      {
        text: 'Pipelines Centralizadas',
        items: [
          { text: 'Publicação GitHub Pages', link: '/pipelines/documentacao-pages' },
        ],
      },
      {
        text: 'Qualidade de Código',
        items: [
          { text: 'Análise SonarQube', link: '/pipelines/qualidade-sonarqube' },
          { text: 'Higiene de Pull Requests', link: '/pipelines/higiene-pull-request' },
          { text: 'Commitlint (Configuração)', link: '/pipelines/pre-commit-config' },
          { text: 'Commitlint (Setup por Ecossistema)', link: '/pipelines/pre-commit-setup' },
        ],
      },
      {
        text: 'Governança Ágil',
        items: [
          { text: 'Templates de Issues e PRs', link: '/governanca/templates-issues-prs' },
        ],
      },
    ],
    search: {
      provider: 'local',
    },
  },
});