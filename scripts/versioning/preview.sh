#!/usr/bin/env bash
set -euo pipefail
script_dir=$(CDPATH='' cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
source "$script_dir/resolve-adapter.sh"
source "$script_dir/validate-sprint.sh"

: "${GITHUB_EVENT_PATH:?É necessário um evento pull_request}"
: "${GITHUB_REPOSITORY:?Informe o repositório consumidor}"
: "${RELEASE_BRANCH:?Informe release_branch}"
: "${TARGET_BRANCH:?Informe target_branch}"
validate_release_branch "$RELEASE_BRANCH"
[[ "$TARGET_BRANCH" =~ ^[A-Za-z0-9_.\/-]+$ ]] || { echo 'target_branch inválida' >&2; exit 1; }
node_script=$(as_node_path "$script_dir/version.mjs")
event=$(node "$node_script" event "$(as_node_path "$GITHUB_EVENT_PATH")" "$RELEASE_BRANCH" "$TARGET_BRANCH")
read_field() { node -p "JSON.parse(process.argv[1])[process.argv[2]] ?? ''" "$event" "$1"; }
pr=$(read_field number)
head_sha=$(read_field headSha)
phase=$(read_field phase)
issue=$(read_field issue)

cd "${GITHUB_WORKSPACE:-$(pwd)}"
[[ "$(git rev-parse HEAD)" == "$head_sha" ]] || {
  echo 'Checkout não corresponde ao HEAD atual do PR' >&2; exit 1;
}

case "$phase" in
  feature-to-release)
    validate_pr_issue "$issue" "$GITHUB_REPOSITORY" "$MILESTONE"
    summary="Feature vinculada à sub-issue #$issue da sprint $MILESTONE"
    ;;
  release-to-develop)
    validate_epic "$issue" "$GITHUB_REPOSITORY" "$MILESTONE" true
    summary="Release vinculada à épica #$issue; homologação em develop pode começar"
    ;;
  develop-to-main)
    validate_epic "$issue" "$GITHUB_REPOSITORY" "$MILESTONE" true
    validate_homologation_origin "$GITHUB_REPOSITORY" "$RELEASE_BRANCH" "$issue"
    validate_homologated_pr "$pr" "$GITHUB_REPOSITORY"
    summary="Integração homologada da épica #$issue em $TARGET_BRANCH"
    ;;
  version-pr)
    validate_epic "$issue" "$GITHUB_REPOSITORY" "$MILESTONE" true
    validate_version_pr "$pr" "$GITHUB_REPOSITORY" "${ADAPTER:?Informe adapter}" \
      "${PROJECT_PATH:-.}" "$TARGET_BRANCH" "$issue"
    summary="PR de versão pós-merge da épica #$issue validado; aguardando CI e revisão"
    ;;
  *) echo "Fase de PR desconhecida: $phase" >&2; exit 1 ;;
esac

if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
  printf 'phase=%s\nsummary=%s\n' "$phase" "$summary" >> "$GITHUB_OUTPUT"
fi
if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
  printf '### Validação de PR\nPR #%s · sprint %s · fase %s\n\n%s\n' "$pr" "$MILESTONE" "$phase" "$summary" >> "$GITHUB_STEP_SUMMARY"
fi
printf '%s\n' "$summary"
