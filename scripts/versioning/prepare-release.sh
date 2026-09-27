#!/usr/bin/env bash
set -euo pipefail
script_dir=$(CDPATH='' cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
source "$script_dir/resolve-adapter.sh"
source "$script_dir/release-gates.sh"
if [[ "${RELEASE_GATES_VALIDATED:-}" != 1 ]]; then validate_release_gates; fi
select_adapter "$ADAPTER" "${PROJECT_PATH:-.}"
node_script=$(as_node_path "$script_dir/version.mjs")
case "$ADAPTER" in
  standard-version|changesets)
    version=$(node -p "JSON.parse(require('node:fs').readFileSync(process.argv[1], 'utf8')).version" "$(as_node_path "$PROJECT_DIR/package.json")")
    ;;
  jgitver)
    if [[ "$ADAPTER_BIN" == */mvnw ]]; then
      version=$(cd "$PROJECT_DIR" && JGITVER_BRANCH="$TARGET_BRANCH" bash "$ADAPTER_BIN" -q -DforceStdout help:evaluate -Dexpression=project.version)
    else
      version=$(cd "$PROJECT_DIR" && JGITVER_BRANCH="$TARGET_BRANCH" "$ADAPTER_BIN" -q -DforceStdout help:evaluate -Dexpression=project.version)
    fi
    version=${version##*$'\n'}
    ;;
  go-gitsemver)
    native_output=$(cd "$PROJECT_DIR" && "$ADAPTER_BIN" --branch "$TARGET_BRANCH" --commit "$GITHUB_SHA" -o json --explain)
    version=$(node -e '
      const result = JSON.parse(process.argv[1]);
      const expectedSha = process.argv[2];
      if ((result.Sha !== expectedSha && result.Sha !== "") || typeof result.SemVer !== "string") {
        console.error(`go-gitsemver returned SHA ${result.Sha ?? "missing"}; expected ${expectedSha}`);
        process.exit(1);
      }
      process.stdout.write(result.SemVer);
    ' "$native_output" "$GITHUB_SHA")
    native_sha=$(node -p 'JSON.parse(process.argv[1]).Sha' "$native_output")
    if [[ -z "$native_sha" ]]; then
      version=$(node "$node_script" stable "$version")
      tagged_sha=$(git rev-parse -q --verify "refs/tags/v${version}^{commit}") || {
        echo "go-gitsemver omitiu Sha e não há tag v$version no checkout" >&2; exit 1;
      }
      [[ "$tagged_sha" == "$GITHUB_SHA" ]] || {
        echo "go-gitsemver omitiu Sha e a tag v$version não aponta para $GITHUB_SHA" >&2; exit 1;
      }
      echo "go-gitsemver omitiu Sha no commit já tagueado; v$version aponta para $GITHUB_SHA" >&2
    fi
    ;;
esac
version=$(node "$node_script" stable "$version")
[[ "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo 'Versão publicada inválida' >&2; exit 1; }
if [[ "$ADAPTER" == changesets ]]; then
  package=$(node -p "JSON.parse(require('node:fs').readFileSync(process.argv[1], 'utf8')).name" "$(as_node_path "$PROJECT_DIR/package.json")")
  [[ "$package" =~ ^@[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$ ]] || {
    echo 'Para Changesets selecione um package com nome @scope/name' >&2; exit 1;
  }
  TAG="$package@$version"
else
  TAG="v$version"
fi
export TAG
printf '%s\n' "$version"
