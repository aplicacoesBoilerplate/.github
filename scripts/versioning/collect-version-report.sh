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
tag_prefix="${TAG_PREFIX:-v}"
node "$(as_node_path "$script_dir/version-report.mjs")" validate-prefix "$tag_prefix" >/dev/null

native_file=$(mktemp)
explanation_file=$(mktemp)
cleanup() { rm -f -- "$native_file" "$explanation_file"; }
trap cleanup EXIT

case "$ADAPTER" in
  go-gitsemver)
    [[ "$tag_prefix" == v ]] || { echo 'go-gitsemver exige TAG_PREFIX=v' >&2; exit 1; }
    (cd "$PROJECT_DIR" && "$ADAPTER_BIN" --branch "$TARGET_BRANCH" --commit "$GITHUB_SHA" -o json --explain \
      >"$native_file" 2>"$explanation_file")
    normalize=normalize-go
    ;;
  standard-version)
    (cd "$PROJECT_DIR" && "$ADAPTER_BIN" --dry-run --skip.commit --skip.tag \
      --tag-prefix "$tag_prefix" >"$native_file" 2>&1)
    normalize=normalize-standard
    ;;
  jgitver)
    if [[ "$ADAPTER_BIN" == */mvnw ]]; then
      (cd "$PROJECT_DIR" && JGITVER_BRANCH="$TARGET_BRANCH" bash "$ADAPTER_BIN" -q -Dstyle.color=never \
        -DforceStdout help:evaluate -Dexpression=project.version >"$native_file" 2>&1)
    else
      (cd "$PROJECT_DIR" && JGITVER_BRANCH="$TARGET_BRANCH" "$ADAPTER_BIN" -q -Dstyle.color=never \
        -DforceStdout help:evaluate -Dexpression=project.version >"$native_file" 2>&1)
    fi
    normalize=normalize-jgitver
    ;;
  *) echo "Adapter ainda não normalizado: $ADAPTER" >&2; exit 1 ;;
esac

node_script=$(as_node_path "$script_dir/version-report.mjs")
native_node=$(as_node_path "$native_file")
explanation_node=$(as_node_path "$explanation_file")
project_node=$(as_node_path "$PROJECT_DIR")
output_node=$(as_node_path "$output_path")
if [[ "$normalize" == normalize-go ]]; then
  node "$node_script" "$normalize" "$native_node" "$explanation_node" \
    "$TARGET_BRANCH" "$GITHUB_SHA" "$project_node" >"$output_node"
else
  node "$node_script" "$normalize" "$native_node" "$TARGET_BRANCH" "$GITHUB_SHA" \
    "$project_node" "$tag_prefix" >"$output_node"
fi
