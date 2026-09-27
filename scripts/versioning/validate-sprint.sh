#!/usr/bin/env bash
set -euo pipefail

validate_release_branch() {
  [[ "$1" =~ ^release/v(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$ ]] || {
    echo "Branch deve ter formato release/vMAJOR.MINOR.PATCH: $1" >&2; return 1;
  }
  MILESTONE="${1#release/}"
  export MILESTONE
}

validate_commit_range() {
  git rev-parse --verify "$1^{commit}" >/dev/null
  git rev-parse --verify "$2^{commit}" >/dev/null
  git merge-base --is-ancestor "$1" "$2" || {
    echo 'A base do PR não é ancestral do commit analisado' >&2; return 1;
  }
  [[ "$1" != "$2" ]] || { echo 'PR sem commits novos' >&2; return 1; }
}

validate_pr_issue() {
  local issue_number="$1" repo="$2" milestone="$3" actual parent_url parent_number
  [[ "$issue_number" =~ ^[1-9][0-9]*$ && "$repo" =~ ^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$ ]] || {
    echo 'Issue ou repositório inválido no evento de PR' >&2; return 1;
  }
  actual=$(gh api "repos/$repo/issues/$issue_number" --jq '.milestone.title // ""')
  [[ "$actual" == "$milestone" ]] || {
    echo "Issue #$issue_number deve estar vinculada à milestone $milestone" >&2; return 1;
  }
  parent_url=$(gh api "repos/$repo/issues/$issue_number" --jq '.parent_issue_url // ""')
  parent_number=${parent_url##*/}
  [[ "$parent_number" =~ ^[1-9][0-9]*$ ]] || {
    echo "Issue #$issue_number deve ser sub-issue da épica $milestone" >&2; return 1;
  }
  actual=$(gh api "repos/$repo/issues/$parent_number" --jq '.title // ""')
  [[ "$actual" == "$milestone" ]] || {
    echo "Épica da issue #$issue_number deve se chamar $milestone" >&2; return 1;
  }
}

validate_epic() {
  local epic_number="$1" repo="$2" milestone="$3" require_closed="${4:-false}" payload
  [[ "$epic_number" =~ ^[1-9][0-9]*$ && "$repo" =~ ^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$ ]] || {
    echo 'Épica ou repositório inválido no evento de PR' >&2; return 1;
  }
  payload=$(gh api "repos/$repo/issues/$epic_number") || return 1
  node -e '
    const issue = JSON.parse(process.argv[1]);
    const [milestone, requireClosed] = process.argv.slice(2);
    if (issue.pull_request || issue.title !== milestone || issue.milestone?.title !== milestone) {
      console.error(`Épica deve ter título e milestone ${milestone}`); process.exit(1);
    }
    if (requireClosed === "true" && (issue.state !== "closed" || issue.milestone.state !== "closed" || issue.milestone.open_issues !== 0)) {
      console.error(`Épica e milestone ${milestone} devem estar encerradas, sem issues abertas`); process.exit(1);
    }
  ' "$payload" "$milestone" "$require_closed"
}

validate_homologated_pr() {
  local number="$1" repo="$2" body decision
  decision=$(gh pr view "$number" -R "$repo" --json reviewDecision --jq .reviewDecision) || return 1
  [[ "$decision" == APPROVED ]] || { echo "PR #$number sem review APPROVED vigente" >&2; return 1; }
  body=$(gh api "repos/$repo/pulls/$number" --jq '.body // ""') || return 1
  [[ "$body" == *'Homologação: aprovada'* ]] || {
    echo "PR #$number requer registro 'Homologação: aprovada'" >&2; return 1;
  }
}

validate_homologation_origin() {
  local repo="$1" release_branch="$2" epic_number="$3" payload origin
  payload=$(gh api -X GET "repos/$repo/pulls" -f state=closed -f base=develop \
    -f "head=${repo%/*}:$release_branch" -f per_page=100) || return 1
  origin=$(node -e '
    const prs = JSON.parse(process.argv[1]);
    const [branch, epic] = process.argv.slice(2);
    const reference = new RegExp(`(?:^|\\s)(?:Epic|Épica):?\\s+#${epic}\\b`, "im");
    const pr = prs.find(p => p.merged_at && p.base?.ref === "develop" && p.head?.ref === branch
      && reference.test(p.body ?? "") && p.merge_commit_sha);
    if (!pr) process.exit(1);
    process.stdout.write(`${pr.number}|${pr.merge_commit_sha}`);
  ' "$payload" "$release_branch" "$epic_number") || {
    echo "Não há PR release → develop mesclado e vinculado à épica #$epic_number" >&2; return 1;
  }
  local number="${origin%%|*}" sha="${origin#*|}"
  git merge-base --is-ancestor "$sha" HEAD || {
    echo "Merge homologado #$number não pertence ao histórico do PR de integração" >&2; return 1;
  }
  local decision
  decision=$(gh pr view "$number" -R "$repo" --json reviewDecision --jq .reviewDecision) || return 1
  [[ "$decision" == APPROVED ]] || {
    echo "PR de release #$number deve ter review APPROVED" >&2; return 1;
  }
}

validate_version_pr() {
  local number="$1" repo="$2" adapter="$3" project="$4" target="$5" epic="$6" body origin sha original base_sha
  body=$(gh api "repos/$repo/pulls/$number" --jq '.body // ""') || return 1
  origin=$(node -e 'const m=/^Origin-PR: #([1-9][0-9]*)$/m.exec(process.argv[1]);if(!m)process.exit(1);process.stdout.write(m[1])' "$body") || {
    echo 'PR de versão sem Origin-PR válido' >&2; return 1;
  }
  sha=$(node -e 'const m=/^Origin-SHA: ([0-9a-f]{40})$/m.exec(process.argv[1]);if(!m)process.exit(1);process.stdout.write(m[1])' "$body") || {
    echo 'PR de versão sem Origin-SHA válido' >&2; return 1;
  }
  [[ "$body" == *"Adapter: $adapter"* && "$body" == *"Project: $project"* && "$body" == *"Epic: #$epic"* ]] || {
    echo 'PR de versão diverge do adaptador/projeto/épica do caller' >&2; return 1;
  }
  original=$(gh api "repos/$repo/pulls/$origin") || return 1
  node -e '
    const p=JSON.parse(process.argv[1]);const [sha,target,epic]=process.argv.slice(2);
    const ref=new RegExp(`(?:^|\\s)(?:Epic|Épica):?\\s+#${epic}\\b`,"im");
    if(!p.merged_at||p.merge_commit_sha!==sha||p.base?.ref!==target||p.head?.ref!=="develop"||!ref.test(p.body??""))process.exit(1);
  ' "$original" "$sha" "$target" "$epic" || {
    echo 'PR de versão não corresponde a entrega homologada da mesma épica' >&2; return 1;
  }
  validate_homologated_pr "$origin" "$repo" || return 1
  git merge-base --is-ancestor "$sha" HEAD || {
    echo 'Merge funcional não é ancestral do PR de versão' >&2; return 1;
  }
  base_sha=$(git merge-base "origin/$target" HEAD)
  [[ "$(git rev-parse "origin/$target")" == "$base_sha" ]] || {
    echo 'Branch principal avançou; atualize o PR de versionamento antes do merge' >&2; return 1;
  }
  local project_path="${project#./}"
  node "$(as_node_path "$(dirname -- "${BASH_SOURCE[0]}")/verify-version-files.mjs")" pr "$adapter" "$project_path" "$base_sha" HEAD >/dev/null
}
