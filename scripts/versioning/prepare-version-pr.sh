#!/usr/bin/env bash
set -euo pipefail
script_dir=$(CDPATH='' cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
source "$script_dir/resolve-adapter.sh"
: "${VERSIONING_TOKEN:?versioning_token de GitHub App com Contents e Pull requests write é obrigatório}"
[[ "${RELEASE_GATES_VALIDATED:-}" == 1 && "${PUBLISH_PHASE:-}" == functional && \
   "$ADAPTER" == standard-version ]] || {
  echo 'Preparação Node exige merge funcional validado' >&2; exit 1;
}
node_script=$(as_node_path "$script_dir/version-pr.mjs")
report_path=$(as_node_path "$VERSION_REPORT_PATH")
version=$(node -p 'JSON.parse(require("node:fs").readFileSync(process.argv[1],"utf8")).candidateVersion' "$report_path")
tag=$(node -p 'JSON.parse(require("node:fs").readFileSync(process.argv[1],"utf8")).tag' "$report_path")
origin_pr=$(node -p 'JSON.parse(require("node:fs").readFileSync(process.argv[1],"utf8")).number' \
  "$(as_node_path "$PR_POLICY_PATH")")
branch="versioning/standard-version/${ORIGIN_SHA:0:12}"
prs=$(gh pr list -R "$GITHUB_REPOSITORY" --head "$branch" --state all --limit 100 --json number,url,state)
existing=$(node -e 'const a=JSON.parse(process.argv[1]);if(a.length>1)process.exit(1);if(a[0])process.stdout.write(JSON.stringify(a[0]))' "$prs")
if [[ -n "$existing" ]]; then
  state=$(node -p 'JSON.parse(process.argv[1]).state' "$existing")
  [[ "$state" == OPEN ]] || { echo "PR técnico existente está $state; reexecute o push do merge técnico" >&2; exit 1; }
  url=$(node -p 'JSON.parse(process.argv[1]).url' "$existing")
  [[ -z "${GITHUB_OUTPUT:-}" ]] || printf 'version=%s\ntag=%s\nversion_pr_url=%s\noutcome=pending-version-pr\n' \
    "$version" "$tag" "$url" >>"$GITHUB_OUTPUT"
  printf 'PR técnico já aberto: %s\n' "$url"
  exit 0
fi
remote_sha=$(gh api "repos/$GITHUB_REPOSITORY/git/ref/heads/$TARGET_BRANCH" --jq .object.sha)
[[ "$remote_sha" == "$GITHUB_SHA" ]] || { echo 'Branch principal avançou; recalcule antes de abrir PR técnico' >&2; exit 1; }
select_adapter standard-version "${PROJECT_PATH:-.}"
git switch -c "$branch" "$GITHUB_SHA"
before=$(git rev-parse HEAD)
(cd "$PROJECT_DIR" && "$ADAPTER_BIN" --skip.commit --skip.tag --tag-prefix "${TAG_PREFIX:-v}")
[[ "$(git rev-parse HEAD)" == "$before" ]] || { echo 'Adaptador criou commit inesperado' >&2; exit 1; }
files=$(node "$(as_node_path "$script_dir/verify-version-files.mjs")" working standard-version "${PROJECT_PATH:-.}")
node "$node_script" verify-manifests "$(as_node_path "${GITHUB_WORKSPACE:-$(pwd)}")" \
  "${PROJECT_PATH:-.}" "$version"
mapfile -t changed_files <<< "$files"
git add -A -- "${changed_files[@]}"
git diff --cached --quiet && { echo 'standard-version não atualizou manifests/changelog' >&2; exit 1; }
export GH_TOKEN="$VERSIONING_TOKEN"
bot_slug="${VERSIONING_BOT_SLUG:?Slug da GitHub App obrigatório}"
bot_id=$(gh api "users/${bot_slug}[bot]" --jq .id)
[[ "$bot_id" =~ ^[0-9]+$ ]] || { echo 'Identidade da GitHub App inválida' >&2; exit 1; }
git -c user.name="${bot_slug}[bot]" \
  -c user.email="${bot_id}+${bot_slug}[bot]@users.noreply.github.com" \
  commit -m "chore(release): $version"
gh auth setup-git
git push origin "HEAD:refs/heads/$branch"
body=$(printf 'Origin-PR: #%s\nOrigin-SHA: %s\nAdapter: standard-version\nProject: %s\nTag-Prefix: %s\nVersion: %s\n\nArquivos de versão calculados pelo standard-version no SHA homologado. Revise CI, manifests e changelog antes do merge.\n' \
  "$origin_pr" "$ORIGIN_SHA" "${PROJECT_PATH:-.}" "${TAG_PREFIX:-v}" "$version")
url=$(gh pr create -R "$GITHUB_REPOSITORY" --base "$TARGET_BRANCH" --head "$branch" \
  --title "chore(release): standard-version $version" --body "$body")
[[ -z "${GITHUB_OUTPUT:-}" ]] || printf 'version=%s\ntag=%s\nversion_pr_url=%s\noutcome=pending-version-pr\n' \
  "$version" "$tag" "$url" >>"$GITHUB_OUTPUT"
printf 'PR técnico aguardando revisão: %s\n' "$url"
