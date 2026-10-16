#!/usr/bin/env bash
set -euo pipefail
script_dir=$(CDPATH='' cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
source "$script_dir/resolve-adapter.sh"
source "$script_dir/paths.sh"
output_path="${1:?Relatório obrigatório}"
: "${ADAPTER:?Adaptador obrigatório}"
: "${TARGET_BRANCH:?Branch obrigatória}"
: "${GITHUB_SHA:?SHA obrigatório}"
select_adapter "$ADAPTER" "${PROJECT_PATH:-.}"
node "$(as_node_path "$script_dir/collect-version-report.mjs")" "$ADAPTER" "$(as_node_path "$PROJECT_DIR")" \
  "$TARGET_BRANCH" "$GITHUB_SHA" "$(as_node_path "${GITHUB_WORKSPACE:-$(pwd)}")" "$(as_node_path "$ADAPTER_BIN")" \
  "$(as_node_path "$output_path")" "${TAG_PREFIX:-v}"
