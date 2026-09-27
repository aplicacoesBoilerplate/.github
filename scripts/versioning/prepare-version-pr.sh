#!/usr/bin/env bash
set -euo pipefail
script_dir=$(CDPATH='' cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
source "$script_dir/resolve-adapter.sh"
: "${VERSIONING_TOKEN:?Configure versioning_token (GitHub App/PAT) para criar PR com checks}"
[[ "${RELEASE_GATES_VALIDATED:-}" == 1 && "${PUBLISH_PHASE:-}" == functional ]] || {
  echo 'Preparação Node exige merge funcional validado' >&2; exit 1;
}
[[ "$ADAPTER" == standard-version || "$ADAPTER" == changesets ]] || {
  echo 'PR de versão só se aplica aos perfis Node' >&2; exit 1;
}
branch="versioning/$ADAPTER/$MILESTONE/${ORIGIN_SHA:0:12}"
prs=$(gh pr list -R "$GITHUB_REPOSITORY" --head "$branch" --state all --limit 100 --json number,url,state)
existing=$(node -e 'const items=JSON.parse(process.argv[1]);if(items.length>1)process.exit(1);if(items[0])process.stdout.write(JSON.stringify(items[0]))' "$prs")
if [[ -n "$existing" ]]; then
  state=$(node -p 'JSON.parse(process.argv[1]).state' "$existing")
  [[ "$state" == OPEN || "$state" == MERGED ]] || {
    echo "PR de versão $branch fechado sem merge; intervenção necessária" >&2; exit 1;
  }
  if [[ "$state" == OPEN ]]; then
    current_sha=$(gh api "repos/$GITHUB_REPOSITORY/git/ref/heads/$TARGET_BRANCH" --jq '.object.sha')
    [[ "$current_sha" == "$GITHUB_SHA" ]] || {
      echo "Base do PR de versão avançou para $current_sha; recalcule antes do merge" >&2; exit 1;
    }
  fi
  url=$(node -p 'JSON.parse(process.argv[1]).url' "$existing")
  if [[ "$state" == MERGED ]]; then
    number=$(node -p 'JSON.parse(process.argv[1]).number' "$existing")
    pr=$(gh api "repos/$GITHUB_REPOSITORY/pulls/$number")
    version=$(node -e 'const p=JSON.parse(process.argv[1]);const m=/^Version: (\d+\.\d+\.\d+)$/m.exec(p.body??"");if(!m||!p.merged_at||!p.merge_commit_sha)process.exit(1);process.stdout.write(m[1])' "$pr") || {
      echo "PR de versão $url não tem merge/versão verificáveis" >&2; exit 1;
    }
    if [[ "$ADAPTER" == changesets ]]; then
      select_adapter "$ADAPTER" "${PROJECT_PATH:-.}"
      package=$(node -p "JSON.parse(require('node:fs').readFileSync(process.argv[1], 'utf8')).name" "$(as_node_path "$PROJECT_DIR/package.json")")
      tag="$package@$version"
    else
      tag="v$version"
    fi
    merged_sha=$(node -p 'JSON.parse(process.argv[1]).merge_commit_sha' "$pr")
    ref=$(gh api "repos/$GITHUB_REPOSITORY/git/ref/tags/$tag" 2>/dev/null) || {
      echo "PR de versão integrado em $merged_sha, mas sem tag: reexecute o push desse commit" >&2; exit 1;
    }
    actual_sha=$(node -p 'JSON.parse(process.argv[1]).object.sha' "$ref")
    [[ "$actual_sha" == "$merged_sha" ]] || { echo "Conflito: $tag aponta para $actual_sha" >&2; exit 1; }
    release=$(gh api "repos/$GITHUB_REPOSITORY/releases/tags/$tag" 2>/dev/null) || {
      echo "Tag $tag sem release; reexecute o push do commit $merged_sha" >&2; exit 1;
    }
    release_url=$(node -e 'const r=JSON.parse(process.argv[1]);if(r.tag_name!==process.argv[2]||(/^[0-9a-f]{40}$/.test(r.target_commitish??"")&&r.target_commitish!==process.argv[3]))process.exit(1);process.stdout.write(r.html_url)' "$release" "$tag" "$merged_sha") || {
      echo "Release $tag diverge do commit $merged_sha" >&2; exit 1;
    }
    if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
      printf 'version=%s\ntag=%s\nversion_pr_url=%s\nrelease_url=%s\noutcome=already-published\n' \
        "$version" "$tag" "$url" "$release_url" >> "$GITHUB_OUTPUT"
    fi
    printf 'Versão já publicada: %s\n' "$release_url"
    exit 0
  fi
  if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
    printf 'version_pr_url=%s\noutcome=pending-version-pr\n' "$url" >> "$GITHUB_OUTPUT"
  fi
  printf 'PR de versão já existente (%s): %s\n' "$state" "$url"
  exit 0
fi
remote_sha=$(gh api "repos/$GITHUB_REPOSITORY/git/ref/heads/$TARGET_BRANCH" --jq '.object.sha')
[[ "$remote_sha" == "$GITHUB_SHA" ]] || {
  echo "Branch $TARGET_BRANCH avançou de $GITHUB_SHA para $remote_sha; recalcule a partir do HEAD atual" >&2; exit 1;
}

select_adapter "$ADAPTER" "${PROJECT_PATH:-.}"
git switch -c "$branch" "$GITHUB_SHA"
before=$(git rev-parse HEAD)
case "$ADAPTER" in
  standard-version)
    (cd "$PROJECT_DIR" && "$ADAPTER_BIN" --skip.commit --skip.tag)
    ;;
  changesets)
    (cd "${GITHUB_WORKSPACE:-$(pwd)}" && "$ADAPTER_BIN" version)
    root="${GITHUB_WORKSPACE:-$(pwd)}"
    if [[ -f "$root/pnpm-lock.yaml" ]]; then
      (cd "$root" && corepack pnpm install --lockfile-only --ignore-scripts)
    elif [[ -f "$root/yarn.lock" ]]; then
      (cd "$root" && corepack yarn install --mode=update-lockfile)
    elif [[ -f "$root/package-lock.json" || -f "$root/npm-shrinkwrap.json" ]]; then
      (cd "$root" && npm install --package-lock-only --ignore-scripts --no-audit --no-fund)
      lock="$root/package-lock.json"
      [[ -f "$root/npm-shrinkwrap.json" ]] && lock="$root/npm-shrinkwrap.json"
      node "$(as_node_path "$script_dir/sync-npm-lock.mjs")" "$(as_node_path "$lock")" \
        "${PROJECT_PATH:-.}" "$(as_node_path "$PROJECT_DIR/package.json")"
    elif [[ -f "$PROJECT_DIR/package-lock.json" ]]; then
      (cd "$PROJECT_DIR" && npm install --package-lock-only --ignore-scripts --no-audit --no-fund)
      node "$(as_node_path "$script_dir/sync-npm-lock.mjs")" \
        "$(as_node_path "$PROJECT_DIR/package-lock.json")" . "$(as_node_path "$PROJECT_DIR/package.json")"
    fi
    ;;
esac
[[ "$(git rev-parse HEAD)" == "$before" ]] || {
  echo 'Adaptador criou commit antes da revisão do PR' >&2; exit 1;
}
version=$(node -p "JSON.parse(require('node:fs').readFileSync(process.argv[1], 'utf8')).version" "$(as_node_path "$PROJECT_DIR/package.json")")
version=$(node "$(as_node_path "$script_dir/version.mjs")" stable "$version")
files=$(node "$(as_node_path "$script_dir/verify-version-files.mjs")" working "$ADAPTER" "${PROJECT_PATH:-.}") || exit 1
mapfile -t changed_files <<< "$files"
git add -A -- "${changed_files[@]}"
git diff --cached --quiet && { echo 'Ferramenta não produziu alteração de versão após o merge' >&2; exit 1; }
git -c user.name='versioning[bot]' -c user.email='versioning@users.noreply.github.com' \
  commit -m "chore(release): $version"
export GH_TOKEN="$VERSIONING_TOKEN"
gh auth setup-git
git push origin "HEAD:refs/heads/$branch"
body=$(printf 'Epic: #%s\nOrigin-PR: #%s\nOrigin-SHA: %s\nAdapter: %s\nProject: %s\nVersion: %s\nHomologação: aprovada\n' \
  "$EPIC_NUMBER" "$ORIGIN_PR" "$ORIGIN_SHA" "$ADAPTER" "${PROJECT_PATH:-.}" "$version")
url=$(gh pr create -R "$GITHUB_REPOSITORY" --base "$TARGET_BRANCH" --head "$branch" \
  --title "chore(release): $ADAPTER $version" --body "$body")
if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
  printf 'version=%s\nversion_pr_url=%s\noutcome=pending-version-pr\n' "$version" "$url" >> "$GITHUB_OUTPUT"
fi
printf 'PR de versão aguardando CI e revisão: %s\n' "$url"
