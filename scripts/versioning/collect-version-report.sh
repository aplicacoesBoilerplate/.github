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
if [[ "$ADAPTER" == changesets ]]; then
  tag_prefix="${TAG_PREFIX:-v}"
  node "$(as_node_path "$script_dir/version-report.mjs")" validate-prefix "$tag_prefix" >/dev/null
    [[ "$tag_prefix" == v ]] || { echo 'changesets usa tags nativas name@version; TAG_PREFIX deve permanecer v' >&2; exit 1; }
  native_file=$(mktemp "$PROJECT_DIR/.changesets-status.XXXXXX")
  explanation_file=$(mktemp)
  trap 'rm -f -- "$native_file" "$explanation_file"' EXIT
  (cd "$PROJECT_DIR" && "$ADAPTER_BIN" status "--output=$(basename "$native_file")" >"$explanation_file" 2>&1) || {
    sed -n '1,80p' "$explanation_file" >&2; exit 1;
  }
  node "$(as_node_path "$script_dir/version-report.mjs")" normalize-changesets \
    "$(as_node_path "$native_file")" "$TARGET_BRANCH" "$GITHUB_SHA" \
    "$(as_node_path "$PROJECT_DIR")" "$tag_prefix" >"$(as_node_path "$output_path")"
else
  node "$(as_node_path "$script_dir/collect-version-report.mjs")" "$ADAPTER" "$(as_node_path "$PROJECT_DIR")" \
    "$TARGET_BRANCH" "$GITHUB_SHA" "$(as_node_path "${GITHUB_WORKSPACE:-$(pwd)}")" "$(as_node_path "$ADAPTER_BIN")" \
    "$(as_node_path "$output_path")" "${TAG_PREFIX:-v}"
fi
