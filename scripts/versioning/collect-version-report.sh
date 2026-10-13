#!/usr/bin/env bash
set -euo pipefail

script_dir=$(CDPATH='' cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
source "$script_dir/resolve-adapter.sh"

output_path="${1:?Uso: collect-version-report.sh <output.json>}"
: "${ADAPTER:?ADAPTER obrigatório}"
: "${TARGET_BRANCH:?TARGET_BRANCH obrigatório}"
: "${GITHUB_SHA:?GITHUB_SHA obrigatório}"

# Selection and path confinement happen before any adapter command is executed.
select_adapter "$ADAPTER" "${PROJECT_PATH:-.}"
[[ "$ADAPTER" == go-gitsemver ]] || {
  echo "Adapter ainda não normalizado neste MVP: $ADAPTER" >&2
  exit 1
}

native_file=$(mktemp)
explanation_file=$(mktemp)
cleanup() { rm -f -- "$native_file" "$explanation_file"; }
trap cleanup EXIT

(
  cd "$PROJECT_DIR"
  "$ADAPTER_BIN" --branch "$TARGET_BRANCH" --commit "$GITHUB_SHA" -o json --explain \
    >"$native_file" 2>"$explanation_file"
)

node_script=$(as_node_path "$script_dir/version-report.mjs")
native_node=$(as_node_path "$native_file")
explanation_node=$(as_node_path "$explanation_file")
project_node=$(as_node_path "$PROJECT_DIR")
output_node=$(as_node_path "$output_path")
node "$node_script" normalize-go "$native_node" "$explanation_node" \
  "$TARGET_BRANCH" "$GITHUB_SHA" "$project_node" >"$output_node"
