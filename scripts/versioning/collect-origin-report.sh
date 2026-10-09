#!/usr/bin/env bash
set -euo pipefail
script_dir=$(CDPATH='' cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
: "${GITHUB_WORKSPACE:?Checkout consumidor obrigatório}"
origin_sha="${1:?SHA homologado obrigatório}"
output_path="${2:?Caminho do relatório obrigatório}"
[[ "$origin_sha" =~ ^[0-9a-f]{40}$ ]] || { echo 'Origin-SHA inválido' >&2; exit 1; }
root=$(realpath "$GITHUB_WORKSPACE")
temporary=$(mktemp -d)
origin="$temporary/origin"
cleanup() {
  git -C "$root" worktree remove --force "$origin" >/dev/null 2>&1 || true
  rmdir "$temporary" >/dev/null 2>&1 || true
}
trap cleanup EXIT
git -C "$root" worktree add --detach "$origin" "$origin_sha" >/dev/null
project="${PROJECT_PATH:-.}"
if [[ -d "$root/node_modules" ]]; then ln -s "$root/node_modules" "$origin/node_modules"; fi
if [[ "$project" != . && -d "$root/$project/node_modules" ]]; then
  ln -s "$root/$project/node_modules" "$origin/$project/node_modules"
fi
GITHUB_WORKSPACE="$origin" GITHUB_SHA="$origin_sha" \
  bash "$script_dir/collect-version-report.sh" "$output_path"
