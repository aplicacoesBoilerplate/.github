#!/usr/bin/env bash
set -euo pipefail
workspace=$(realpath "${GITHUB_WORKSPACE:?}")
project_path="${PROJECT_PATH:-.}"
[[ "$project_path" != /* && "$project_path" != *'..'* ]] || {
  echo 'project_path inválido' >&2; exit 1;
}
project_dir=$(realpath "$workspace/$project_path")
[[ "$project_dir" == "$workspace" || "$project_dir" == "$workspace/"* ]] || {
  echo 'project_path fora do repositório' >&2; exit 1;
}
if [[ "${NODE_PACKAGE_MANAGER:-}" == npm ]]; then
  [[ -f "$project_dir/package-lock.json" || -f "$project_dir/npm-shrinkwrap.json" ]] || {
    echo 'standard-version exige package-lock.json ou npm-shrinkwrap.json no projeto' >&2; exit 1;
  }
  [[ ! -f "$project_dir/pnpm-lock.yaml" && ! -f "$project_dir/yarn.lock" ]] || {
    echo 'standard-version aceita apenas lockfile npm' >&2; exit 1;
  }
  (cd "$project_dir" && npm ci --ignore-scripts)
  exit 0
fi
if [[ -f "$workspace/pnpm-lock.yaml" ]]; then
  (cd "$workspace" && corepack enable && pnpm install --frozen-lockfile --ignore-scripts)
elif [[ -f "$workspace/yarn.lock" ]]; then
  (cd "$workspace" && corepack enable && yarn install --immutable --mode=skip-build)
elif [[ -f "$workspace/package-lock.json" ]]; then
  (cd "$workspace" && npm ci --ignore-scripts)
elif [[ -f "$project_dir/package-lock.json" ]]; then
  (cd "$project_dir" && npm ci --ignore-scripts)
else
  echo 'Node adapter exige lockfile e gerenciador npm, pnpm ou Yarn configurado' >&2
  exit 1
fi
