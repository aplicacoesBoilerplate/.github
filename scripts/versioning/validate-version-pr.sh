#!/usr/bin/env bash
set -euo pipefail
script_dir=$(CDPATH='' cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
source "$script_dir/resolve-adapter.sh"
: "${GITHUB_REPOSITORY:?Repositório obrigatório}"
: "${TARGET_BRANCH:?Branch principal obrigatória}"
: "${GITHUB_SHA:?SHA avaliado obrigatório}"
number="${1:?Número do PR de versão obrigatório}"
report_path="${2:?Relatório obrigatório}"
snapshot_path="${3:?Snapshot obrigatório}"
context_path="${4:?Contexto obrigatório}"
[[ "$ADAPTER" == standard-version ]] || { echo 'PR técnico disponível somente para standard-version' >&2; exit 1; }
pr_path=$(mktemp)
trap 'rm -f -- "$pr_path"' EXIT
gh api "repos/$GITHUB_REPOSITORY/pulls/$number" >"$pr_path"
node "$script_dir/version-pr.mjs" parse "$(as_node_path "$pr_path")" \
  "$TARGET_BRANCH" "${PROJECT_PATH:-.}" "${TAG_PREFIX:-v}" >"$context_path"
origin_pr=$(node -p 'JSON.parse(require("node:fs").readFileSync(process.argv[1],"utf8")).originPr' "$(as_node_path "$context_path")")
origin_sha=$(node -p 'JSON.parse(require("node:fs").readFileSync(process.argv[1],"utf8")).originSha' "$(as_node_path "$context_path")")
expected_version=$(node -p 'JSON.parse(require("node:fs").readFileSync(process.argv[1],"utf8")).version' "$(as_node_path "$context_path")")
if [[ "${REQUIRE_MERGED:-}" == 1 ]]; then
  node -e 'const p=JSON.parse(require("node:fs").readFileSync(process.argv[1],"utf8"));
    if(!p.merged_at||p.merge_commit_sha!==process.argv[2])process.exit(1)' \
    "$(as_node_path "$pr_path")" "$GITHUB_SHA" || { echo 'PR de versão não corresponde ao merge integrado' >&2; exit 1; }
  review=$(gh pr view "$number" -R "$GITHUB_REPOSITORY" --json reviewDecision --jq .reviewDecision)
  [[ "$review" == APPROVED ]] || { echo 'PR de versão sem aprovação humana vigente' >&2; exit 1; }
  diff_base="$GITHUB_SHA^"
  diff_head="$GITHUB_SHA"
else
  current_head=$(node -p 'JSON.parse(require("node:fs").readFileSync(process.argv[1],"utf8")).head.sha' "$(as_node_path "$pr_path")")
  [[ "$current_head" == "$GITHUB_SHA" ]] || { echo 'HEAD do PR de versão mudou' >&2; exit 1; }
  diff_base=$(node -p 'JSON.parse(require("node:fs").readFileSync(process.argv[1],"utf8")).base.sha' "$(as_node_path "$pr_path")")
  diff_head="$GITHUB_SHA"
fi
git merge-base --is-ancestor "$origin_sha" "$GITHUB_SHA" || {
  echo 'SHA homologado não é ancestral do PR de versão' >&2; exit 1;
}
bash "$script_dir/collect-pr-policy.sh" "$origin_pr" "$snapshot_path"
node -e '
  const s=JSON.parse(require("node:fs").readFileSync(process.argv[1],"utf8"));
  if(!s.mergedAt||s.mergeCommitSha!==process.argv[2]||s.baseBranch!==process.argv[3]||
     !(s.headBranch==="develop"||/^hotfix\/.+$/.test(s.headBranch)))process.exit(1);
' "$(as_node_path "$snapshot_path")" "$origin_sha" "$TARGET_BRANCH" || {
  echo 'PR original não é uma integração homologada elegível' >&2; exit 1;
}
bash "$script_dir/collect-origin-report.sh" "$origin_sha" "$report_path"
native_version=$(node -p 'JSON.parse(require("node:fs").readFileSync(process.argv[1],"utf8")).candidateVersion' "$(as_node_path "$report_path")")
[[ "$native_version" == "$expected_version" ]] || {
  echo "Versão do PR ($expected_version) diverge do cálculo nativo ($native_version)" >&2; exit 1;
}
node "$script_dir/version-pr.mjs" verify-files "$(as_node_path "${GITHUB_WORKSPACE:-$(pwd)}")" \
  "${PROJECT_PATH:-.}" "$expected_version" "$diff_base" "$diff_head"
