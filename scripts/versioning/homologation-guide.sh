#!/usr/bin/env bash
set -euo pipefail
[[ "${PR_PHASE:-}" == release-to-develop ]] || exit 0
cd "${GITHUB_WORKSPACE:-$(pwd)}"
git rev-parse --verify 'origin/develop^{commit}' >/dev/null
base=$(git merge-base origin/develop HEAD)
guide=$(git log --no-merges --format='- %s' "$base"..HEAD)
if [[ -z "$guide" ]]; then
  echo 'Nenhum commit de entrega encontrado para o guia provisório.' >&2
  exit 1
fi
if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
  printf '### Guia provisório de homologação (não versionado)\n\n%s\n' "$guide" >> "$GITHUB_STEP_SUMMARY"
fi
printf '%s\n' "$guide"
