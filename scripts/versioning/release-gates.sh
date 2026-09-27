#!/usr/bin/env bash
# Source from the publish process so gate results remain available to both phases.
source "$(dirname -- "${BASH_SOURCE[0]}")/validate-sprint.sh"

validate_release_gates() {
  : "${GITHUB_REPOSITORY:?Informe o repositório consumidor}"
  : "${GITHUB_SHA:?Publicação exige SHA integrado}"
  : "${TARGET_BRANCH:?Informe target_branch}"
  : "${RELEASE_BRANCH:?Informe release_branch}"
  : "${ADAPTER:?Informe adapter}"
  [[ "${GITHUB_EVENT_NAME:-}" == push && "${GITHUB_REF_NAME:-}" == "$TARGET_BRANCH" ]] || {
    echo 'Publicação permitida apenas em push na branch principal após merge' >&2; return 1;
  }
  [[ "$(git rev-parse HEAD)" == "$GITHUB_SHA" ]] || {
    echo 'Checkout não corresponde ao commit integrado' >&2; return 1;
  }
  validate_release_branch "$RELEASE_BRANCH"
  [[ "$TARGET_BRANCH" =~ ^[A-Za-z0-9_.\/-]+$ ]] || { echo 'target_branch inválida' >&2; return 1; }
  local default_branch milestone_json issues_json milestone_number prs_json pr_json origin_body
  default_branch=$(gh api "repos/$GITHUB_REPOSITORY" --jq '.default_branch') || return 1
  [[ "$TARGET_BRANCH" == "$default_branch" ]] || {
    echo "Publicação permitida somente na branch principal ($default_branch)" >&2; return 1;
  }

  milestone_json=$(gh api -X GET "repos/$GITHUB_REPOSITORY/milestones" -f state=all -f per_page=100) || return 1
  milestone_number=$(node -e 'const m=JSON.parse(process.argv[1]).find(v=>v.title===process.argv[2]);if(!m||m.state!=="closed"||m.open_issues!==0)process.exit(1);process.stdout.write(String(m.number))' "$milestone_json" "$MILESTONE") || {
    echo "Milestone $MILESTONE deve estar fechada com zero issues abertas" >&2; return 1;
  }
  issues_json=$(gh api -X GET "repos/$GITHUB_REPOSITORY/issues" -f state=closed -f "milestone=$milestone_number" -f per_page=100) || return 1

  prs_json=$(gh api -X GET "repos/$GITHUB_REPOSITORY/commits/$GITHUB_SHA/pulls" -f per_page=100) || return 1
  pr_json=$(node -e '
    const prs=JSON.parse(process.argv[1]);
    const [sha, target] = process.argv.slice(2);
    const pr=prs.find(p=>p.merged_at&&p.merge_commit_sha===sha&&p.base?.ref===target
      &&p.head?.ref==="develop") ??
      prs.find(p=>p.merged_at&&p.merge_commit_sha===sha&&p.base?.ref===target
        &&p.head?.ref?.startsWith("versioning/"));
    if(!pr)process.exit(1);
    process.stdout.write(JSON.stringify(pr));
  ' "$prs_json" "$GITHUB_SHA" "$TARGET_BRANCH") || {
    echo 'Commit não corresponde a PR funcional ou PR de versionamento mesclado' >&2; return 1;
  }
  PUBLISH_PR=$(node -p 'JSON.parse(process.argv[1]).number' "$pr_json")
  PUBLISH_PHASE=functional
  ORIGIN_PR="$PUBLISH_PR"
  ORIGIN_SHA="$GITHUB_SHA"
  if [[ "$(node -p 'JSON.parse(process.argv[1]).head.ref' "$pr_json")" == versioning/* ]]; then
    PUBLISH_PHASE=version-pr
    local body origin origin_sha original
    body=$(gh api "repos/$GITHUB_REPOSITORY/pulls/$PUBLISH_PR" --jq '.body // ""') || return 1
    [[ "$body" == *"Adapter: $ADAPTER"* && "$body" == *"Project: ${PROJECT_PATH:-.}"* ]] || {
      echo 'PR de versão diverge do adaptador ou projeto do caller' >&2; return 1;
    }
    origin=$(node -e 'const m=/^Origin-PR: #([1-9][0-9]*)$/m.exec(process.argv[1]);if(!m)process.exit(1);process.stdout.write(m[1])' "$body") || {
      echo 'PR de versão sem Origin-PR verificável' >&2; return 1;
    }
    origin_sha=$(node -e 'const m=/^Origin-SHA: ([0-9a-f]{40})$/m.exec(process.argv[1]);if(!m)process.exit(1);process.stdout.write(m[1])' "$body") || {
      echo 'PR de versão sem Origin-SHA verificável' >&2; return 1;
    }
    original=$(gh api "repos/$GITHUB_REPOSITORY/pulls/$origin") || return 1
    node -e 'const p=JSON.parse(process.argv[1]);if(!p.merged_at||p.merge_commit_sha!==process.argv[2]||p.base?.ref!==process.argv[3]||p.head?.ref!=="develop")process.exit(1)' \
      "$original" "$origin_sha" "$TARGET_BRANCH" || {
      echo 'PR de versão não está vinculado a merge funcional homologado' >&2; return 1;
    }
    git merge-base --is-ancestor "$origin_sha" HEAD || {
      echo 'Merge funcional não é ancestral do commit versionado' >&2; return 1;
    }
    node "$(as_node_path "$(dirname -- "${BASH_SOURCE[0]}")/verify-version-files.mjs")" pr \
      "$ADAPTER" "${PROJECT_PATH:-.}" "$GITHUB_SHA^" "$GITHUB_SHA" >/dev/null || return 1
    ORIGIN_PR="$origin"
    ORIGIN_SHA="$origin_sha"
    validate_homologated_pr "$PUBLISH_PR" "$GITHUB_REPOSITORY" || return 1
  fi
  origin_body=$(gh api "repos/$GITHUB_REPOSITORY/pulls/$ORIGIN_PR" --jq '.body // ""') || return 1
  EPIC_NUMBER=$(node -e 'const m=/^(?:Epic|Épica):\s*#([1-9][0-9]*)\s*$/mi.exec(process.argv[1]);if(!m)process.exit(1);process.stdout.write(m[1])' "$origin_body") || {
    echo "PR #$ORIGIN_PR sem vínculo explícito à épica" >&2; return 1;
  }
  node -e 'const issues=JSON.parse(process.argv[1]);const epic=issues.find(i=>i.number===Number(process.argv[2])&&i.title===process.argv[3]&&i.state==="closed"&&!i.pull_request);if(!epic)process.exit(1)' \
    "$issues_json" "$EPIC_NUMBER" "$MILESTONE" || {
    echo "Épica #$EPIC_NUMBER deve estar encerrada na milestone $MILESTONE" >&2; return 1;
  }
  validate_epic "$EPIC_NUMBER" "$GITHUB_REPOSITORY" "$MILESTONE" true || return 1
  if [[ "$PUBLISH_PHASE" == version-pr ]]; then
    [[ "$body" == *"Epic: #$EPIC_NUMBER"* ]] || {
      echo 'PR de versão diverge da épica do merge funcional' >&2; return 1;
    }
  fi
  validate_homologation_origin "$GITHUB_REPOSITORY" "$RELEASE_BRANCH" "$EPIC_NUMBER" || return 1
  validate_homologated_pr "$ORIGIN_PR" "$GITHUB_REPOSITORY" || return 1
  export PUBLISH_PHASE PUBLISH_PR ORIGIN_PR ORIGIN_SHA EPIC_NUMBER RELEASE_GATES_VALIDATED=1
}
