import { defineConfig } from 'vitepress';

export default defineConfig({
  lang: 'pt-BR',
  title: 'Boilerplate CI/CD & Governança',
  description: 'Catálogo centralizado de pipelines reutilizáveis, versionamento e templates.',
  base: '/.github/',
  themeConfig: {
    nav: [
      { text: 'Início', link: '/' },
      { text: 'Pipelines', link: '/pipelines/versionamento-release-please' },
      { text: 'Governança & Templates', link: '/governanca/templates-issues-prs' },
    ],
    sidebar: [
      {
        text: 'Pipelines Centralizadas',
        items: [
          { text: 'Versionamento (Release Please)', link: '/pipelines/versionamento-release-please' },
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