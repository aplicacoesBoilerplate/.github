#!/usr/bin/env bash
set -euo pipefail
script_dir=$(CDPATH='' cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
source "$script_dir/release-gates.sh"
: "${VERSIONING_OUTPUT_DIR:?Diretório de evidência obrigatório}"
unset VERSIONING_PRECOMPUTED_REPORT VERSIONING_PRECOMPUTED_BUNDLE VERSIONING_INPUTS_SNAPSHOT VERSIONING_REQUIRE_PRECOMPUTED
mkdir -p "$VERSIONING_OUTPUT_DIR"
node "$script_dir/git-inputs.mjs" capture "$(as_node_path "$GITHUB_WORKSPACE")" \
  "$(as_node_path "$VERSIONING_OUTPUT_DIR/git-inputs.json")" "$ADAPTER"
validate_release_gates
if [[ "$ADAPTER" == standard-version && "$PUBLISH_PHASE" == functional ]]; then
  [[ "$STALE_PUSH" == 0 ]] || { echo 'Origem funcional antiga não pode preparar arquivos' >&2; exit 1; }
  source "$script_dir/resolve-adapter.sh"
  select_adapter standard-version "${PROJECT_PATH:-.}"
  node "$script_dir/version-bundle.mjs" generate "$(as_node_path "$GITHUB_WORKSPACE")" \
    "${PROJECT_PATH:-.}" "$(as_node_path "$VERSION_REPORT_PATH")" \
    "$(as_node_path "$VERSIONING_OUTPUT_DIR/version-bundle.json")" "$(as_node_path "$ADAPTER_BIN")"
fi
node "$script_dir/git-inputs.mjs" verify "$(as_node_path "$GITHUB_WORKSPACE")" \
  "$(as_node_path "$VERSIONING_OUTPUT_DIR/git-inputs.json")" "$GITHUB_SHA" '' "$ADAPTER"
cp "$VERSION_REPORT_PATH" "$VERSIONING_OUTPUT_DIR/version-report.json"
[[ -z "${GITHUB_OUTPUT:-}" ]] || printf 'phase=%s\nartifact_name=publication-%s-%s\n' \
  "$PUBLISH_PHASE" "$GITHUB_RUN_ID" "$GITHUB_RUN_ATTEMPT" >> "$GITHUB_OUTPUT"
