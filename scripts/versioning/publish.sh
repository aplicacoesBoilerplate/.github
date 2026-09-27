#!/usr/bin/env bash
set -euo pipefail
script_dir=$(CDPATH='' cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
source "$script_dir/resolve-adapter.sh"
source "$script_dir/validate-sprint.sh"
source "$script_dir/release-gates.sh"

validate_release_gates
if [[ "$PUBLISH_PHASE" == functional && ( "$ADAPTER" == standard-version || "$ADAPTER" == changesets ) ]]; then
  exec bash "$script_dir/prepare-version-pr.sh"
fi
version=$(bash "$script_dir/prepare-release.sh")
validate_release_branch "$RELEASE_BRANCH"
select_adapter "$ADAPTER" "${PROJECT_PATH:-.}"
node_script=$(as_node_path "$script_dir/version.mjs")
if [[ "$ADAPTER" == changesets ]]; then
  package=$(node -p "JSON.parse(require('node:fs').readFileSync(process.argv[1], 'utf8')).name" "$(as_node_path "$PROJECT_DIR/package.json")")
  tag="$package@$version"
  prefix="$package@"
else
  tag="v$version"
  prefix=v
fi
repo="$GITHUB_REPOSITORY"
sha="$GITHUB_SHA"
body="Sprint $MILESTONE; commit integrado $sha."
if [[ -n "${CHANGELOG_PATH:-}" ]]; then
  root=$(realpath "${GITHUB_WORKSPACE:-$(pwd)}")
  [[ "$CHANGELOG_PATH" != /* && "$CHANGELOG_PATH" != *'..'* ]] || {
    echo 'changelog_path inválido' >&2; exit 1;
  }
  changelog=$(realpath -m "$root/$CHANGELOG_PATH")
  [[ "$changelog" == "$root/"* ]] || { echo 'Changelog fora do repositório' >&2; exit 1; }
  if [[ -f "$changelog" ]]; then
    body=$(<"$changelog")
  else
    echo "Changelog $CHANGELOG_PATH ausente no commit publicável; usando resumo da sprint" >&2
  fi
fi

report() {
  local outcome="$1" url="${2:-}"
  local published_sha=''
  [[ "$outcome" == published || "$outcome" == already-published ]] && published_sha="$sha"
  if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
    printf 'version=%s\ntag=%s\npublished_sha=%s\nrelease_url=%s\noutcome=%s\n' "$version" "$tag" "$published_sha" "$url" "$outcome" >> "$GITHUB_OUTPUT"
  fi
  if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
    printf '### Publicação %s\nVersão: %s · tag: %s · commit: %s\n' "$outcome" "$version" "$tag" "$sha" >> "$GITHUB_STEP_SUMMARY"
  fi
}

get_optional_api() {
  local response
  if response=$(gh api "$1" 2>&1); then
    printf '%s' "$response"
  elif [[ "$response" == *'HTTP 404'* ]]; then
    return 4
  else
    printf '%s\n' "$response" >&2
    return 1
  fi
}

current_ref_sha() {
  local payload type object_sha
  payload=$(get_optional_api "repos/$repo/git/ref/tags/$tag") || return $?
  type=$(node -p 'JSON.parse(process.argv[1]).object.type' "$payload")
  object_sha=$(node -p 'JSON.parse(process.argv[1]).object.sha' "$payload")
  if [[ "$type" == tag ]]; then
    payload=$(gh api "repos/$repo/git/tags/$object_sha")
    type=$(node -p 'JSON.parse(process.argv[1]).object.type' "$payload")
    object_sha=$(node -p 'JSON.parse(process.argv[1]).object.sha' "$payload")
  fi
  [[ "$type" == commit ]] || { echo 'Tag não aponta diretamente para commit' >&2; return 2; }
  printf '%s' "$object_sha"
}

if ref_sha=$(current_ref_sha); then
  if [[ "$ref_sha" != "$sha" ]]; then
    report conflict
    echo "Conflito: $tag aponta para $ref_sha, não $sha. Nunca mova uma tag publicada." >&2
    exit 1
  fi
else
  ref_status=$?
  [[ "$ref_status" == 4 ]] || { echo 'Falha ao consultar a tag remota' >&2; exit 1; }
  if release=$(get_optional_api "repos/$repo/releases/tags/$tag"); then
    report conflict
    echo "Release $tag existe sem referência de tag verificável; intervenção necessária" >&2
    exit 1
  else
    [[ $? == 4 ]] || exit 1
  fi
  latest=$(git tag --list "$prefix*" --sort=-v:refname)
  latest=${latest%%$'\n'*}
  if [[ -n "$latest" && "$latest" != "$tag" ]]; then
    older=${latest#"$prefix"}
    if [[ $(node "$node_script" compare "$older" "$version") == none ]]; then
      echo "Versão $version não supera a última tag $latest" >&2
      exit 1
    fi
  fi
  # POST git/refs é create-only: uma execução concorrente não consegue sobrescrever.
  if ! gh api -X POST "repos/$repo/git/refs" -f "ref=refs/tags/$tag" -f "sha=$sha" >/dev/null; then
    ref_sha=''
    for attempt in 1 2 3; do
      if ref_sha=$(current_ref_sha); then break; fi
      sleep 1
    done
    [[ -n "$ref_sha" ]] || { echo 'Falha ao criar/consultar tag; investigar antes de repetir' >&2; exit 1; }
    if [[ "$ref_sha" != "$sha" ]]; then
      report conflict
      echo "Conflito concorrente: $tag aponta para $ref_sha" >&2
      exit 1
    fi
  fi
fi

if release=$(get_optional_api "repos/$repo/releases/tags/$tag"); then
  node -e 'const r=JSON.parse(process.argv[1]);if(r.tag_name!==process.argv[2]||(/^[0-9a-f]{40}$/.test(r.target_commitish??"")&&r.target_commitish!==process.argv[3]))process.exit(1)' \
    "$release" "$tag" "$sha" || { report conflict; echo 'Release existente diverge de tag/SHA' >&2; exit 1; }
  url=$(node -p 'JSON.parse(process.argv[1]).html_url' "$release")
  report already-published "$url"
  printf 'Release já publicada: %s\n' "$url"
  exit 0
else
  [[ $? == 4 ]] || exit 1
fi

if ! release=$(gh api -X POST "repos/$repo/releases" -f "tag_name=$tag" -f "target_commitish=$sha" -f "name=$tag" -f "body=$body"); then
  # Outra execução pode ter concluído a release entre o GET anterior e o POST.
  release=''
  for attempt in 1 2 3; do
    if release=$(get_optional_api "repos/$repo/releases/tags/$tag"); then break; fi
    [[ $? == 4 ]] || exit 1
    sleep 1
  done
  if [[ -n "$release" ]]; then
    node -e 'const r=JSON.parse(process.argv[1]);if(r.tag_name!==process.argv[2]||(/^[0-9a-f]{40}$/.test(r.target_commitish??"")&&r.target_commitish!==process.argv[3]))process.exit(1)' \
      "$release" "$tag" "$sha" || { report conflict; echo 'Release concorrente diverge de tag/SHA' >&2; exit 1; }
    url=$(node -p 'JSON.parse(process.argv[1]).html_url' "$release")
    report already-published "$url"
    printf 'Release já publicada por execução concorrente: %s\n' "$url"
    exit 0
  fi
  echo 'Tag criada mas release falhou. Reexecute após corrigir o erro; a tag será preservada.' >&2
  exit 1
fi
url=$(node -p 'JSON.parse(process.argv[1]).html_url' "$release")
report published "$url"
printf 'Release publicada: %s\n' "$url"
