#!/usr/bin/env bash
set -euo pipefail
script_dir=$(CDPATH='' cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
source "$script_dir/resolve-adapter.sh"
source "$script_dir/release-gates.sh"

validate_release_gates
if [[ "$ADAPTER" == standard-version && "$PUBLISH_PHASE" == functional ]]; then
  exec bash "$script_dir/prepare-version-pr.sh"
fi
report_path="$VERSION_REPORT_PATH"
version=$(node -p 'JSON.parse(require("node:fs").readFileSync(process.argv[1],"utf8")).candidateVersion' "$(as_node_path "$report_path")")
tag=$(node -p 'JSON.parse(require("node:fs").readFileSync(process.argv[1],"utf8")).tag' "$(as_node_path "$report_path")")
origin_sha=$(node -p 'JSON.parse(require("node:fs").readFileSync(process.argv[1],"utf8")).sha' "$(as_node_path "$report_path")")
sha="$GITHUB_SHA"
repo="$GITHUB_REPOSITORY"
if [[ "$PUBLISH_PHASE" == version-pr ]]; then
  [[ "$ADAPTER" == standard-version && "$origin_sha" == "$ORIGIN_SHA" ]] || {
    echo 'Relatório de origem diverge do PR técnico integrado' >&2; exit 1;
  }
else
  [[ "$origin_sha" == "$sha" ]] || { echo 'Relatório normalizado diverge do SHA integrado' >&2; exit 1; }
fi

body=$(node -e '
  const r=JSON.parse(require("node:fs").readFileSync(process.argv[1],"utf8"));
  process.stdout.write([`Versão ${r.candidateVersion} calculada no commit homologado ${r.sha}.`,"",r.native.explanation.trim(),"",
    "```json",JSON.stringify(r.native.result,null,2),"```"].join("\n"));
' "$(as_node_path "$report_path")")
if [[ "$PUBLISH_PHASE" == version-pr ]]; then
  body="$body

Manifests e changelog revisados no commit integrado $sha."
fi
if [[ -n "${CHANGELOG_PATH:-}" ]]; then
  root=$(realpath "${GITHUB_WORKSPACE:-$(pwd)}")
  [[ "$CHANGELOG_PATH" != /* && "$CHANGELOG_PATH" != *'..'* ]] || { echo 'changelog_path inválido' >&2; exit 1; }
  changelog=$(realpath -m "$root/$CHANGELOG_PATH")
  [[ "$changelog" == "$root/"* ]] || { echo 'Changelog fora do repositório' >&2; exit 1; }
  [[ -f "$changelog" ]] && body="$body

$(<"$changelog")"
fi

report_outcome() {
  local outcome="$1" url="${2:-}" published_sha=''
  local version_pr_url=''
  [[ "$outcome" == published || "$outcome" == already-published ]] && published_sha="$sha"
  [[ -z "${VERSION_PR_NUMBER:-}" ]] || version_pr_url="https://github.com/$repo/pull/$VERSION_PR_NUMBER"
  [[ -z "${GITHUB_OUTPUT:-}" ]] || printf 'version=%s\ntag=%s\npublished_sha=%s\nrelease_url=%s\noutcome=%s\nversion_pr_url=%s\n' \
    "$version" "$tag" "$published_sha" "$url" "$outcome" "$version_pr_url" >>"$GITHUB_OUTPUT"
  [[ -z "${GITHUB_STEP_SUMMARY:-}" ]] || printf '### Publicação %s\nVersão: %s · tag: %s · commit: %s\n' \
    "$outcome" "$version" "$tag" "$sha" >>"$GITHUB_STEP_SUMMARY"
}

get_optional_api() {
  local response
  if response=$(gh api "$1" 2>&1); then printf '%s' "$response"
  elif [[ "$response" == *'HTTP 404'* ]]; then return 4
  else printf '%s\n' "$response" >&2; return 1
  fi
}

current_ref_sha() {
  local payload type object_sha
  payload=$(get_optional_api "repos/$repo/git/ref/tags/$tag") || return $?
  type=$(node -p 'JSON.parse(process.argv[1]).object.type' "$payload")
  object_sha=$(node -p 'JSON.parse(process.argv[1]).object.sha' "$payload")
  if [[ "$type" == tag ]]; then
    payload=$(gh api "repos/$repo/git/tags/$object_sha") || return 1
    type=$(node -p 'JSON.parse(process.argv[1]).object.type' "$payload")
    object_sha=$(node -p 'JSON.parse(process.argv[1]).object.sha' "$payload")
  fi
  [[ "$type" == commit ]] || { echo 'Tag não aponta para commit' >&2; return 2; }
  printf '%s' "$object_sha"
}

if ref_sha=$(current_ref_sha); then
  [[ "$ref_sha" == "$sha" ]] || {
    report_outcome conflict
    echo "Conflito: $tag aponta para $ref_sha, não $sha. A tag não será movida." >&2
    exit 1
  }
else
  status=$?
  [[ "$status" == 4 ]] || { echo 'Falha ao consultar a tag remota' >&2; exit 1; }
  if release=$(get_optional_api "repos/$repo/releases/tags/$tag"); then
    report_outcome conflict
    echo "Release $tag existe sem tag verificável" >&2
    exit 1
  else
    [[ $? == 4 ]] || exit 1
  fi
  node "$script_dir/version-report.mjs" ensure-new-tag \
    "$(as_node_path "${GITHUB_WORKSPACE:-$(pwd)}")" "$sha" "$version" "${TAG_PREFIX:-v}"
  if ! gh api -X POST "repos/$repo/git/refs" -f "ref=refs/tags/$tag" -f "sha=$sha" >/dev/null; then
    ref_sha=''
    for attempt in {1..10}; do
      if ref_sha=$(current_ref_sha); then break; fi
    done
    [[ "$ref_sha" == "$sha" ]] || { echo 'Criação concorrente da tag não convergiu para o SHA integrado' >&2; exit 1; }
  fi
fi

if release=$(get_optional_api "repos/$repo/releases/tags/$tag"); then
  node -e 'const r=JSON.parse(process.argv[1]);if(r.tag_name!==process.argv[2]||r.target_commitish!==process.argv[3])process.exit(1)' \
    "$release" "$tag" "$sha" || { report_outcome conflict; echo 'Release existente diverge de tag/SHA' >&2; exit 1; }
  url=$(node -p 'JSON.parse(process.argv[1]).html_url' "$release")
  report_outcome already-published "$url"
  printf 'Release já publicada: %s\n' "$url"
  exit 0
else
  [[ $? == 4 ]] || exit 1
fi

if ! release=$(gh api -X POST "repos/$repo/releases" -f "tag_name=$tag" -f "target_commitish=$sha" \
  -f "name=$tag" -f "body=$body"); then
  release=''
  for attempt in {1..10}; do
    if release=$(get_optional_api "repos/$repo/releases/tags/$tag"); then break; fi
    [[ $? == 4 ]] || exit 1
  done
  [[ -n "$release" ]] || { echo 'Tag preservada, mas a criação da release falhou' >&2; exit 1; }
  node -e 'const r=JSON.parse(process.argv[1]);if(r.tag_name!==process.argv[2]||r.target_commitish!==process.argv[3])process.exit(1)' \
    "$release" "$tag" "$sha" || { report_outcome conflict; echo 'Release concorrente diverge de tag/SHA' >&2; exit 1; }
  url=$(node -p 'JSON.parse(process.argv[1]).html_url' "$release")
  report_outcome already-published "$url"
  printf 'Release já publicada por execução concorrente: %s\n' "$url"
  exit 0
fi
url=$(node -p 'JSON.parse(process.argv[1]).html_url' "$release")
report_outcome published "$url"
printf 'Release publicada: %s\n' "$url"
