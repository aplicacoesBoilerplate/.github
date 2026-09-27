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
