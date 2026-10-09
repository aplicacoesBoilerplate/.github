#!/usr/bin/env bash
# Source from the publisher so the validated report and policy remain available.
script_dir=$(CDPATH='' cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
source "$script_dir/resolve-adapter.sh"

validate_release_gates() {
  : "${GITHUB_REPOSITORY:?Informe o repositório consumidor}"
  : "${GITHUB_SHA:?Publicação exige SHA integrado}"
  : "${TARGET_BRANCH:?Informe target_branch}"
  : "${ADAPTER:?Informe adapter}"
  [[ "${GITHUB_EVENT_NAME:-}" == push && "${GITHUB_REF_NAME:-}" == "$TARGET_BRANCH" ]] || {
    echo 'Publicação permitida apenas em push na branch principal após merge' >&2; return 1;
  }
  [[ "$TARGET_BRANCH" =~ ^[A-Za-z0-9_.\/-]+$ ]] || { echo 'target_branch inválida' >&2; return 1; }
  [[ "$(git rev-parse HEAD)" == "$GITHUB_SHA" ]] || {
    echo 'Checkout não corresponde ao commit integrado' >&2; return 1;
  }

  local default_branch remote_sha gate_dir snapshot_path report_path input_path policy_path outcome
  local associated version_pr_number expected_report_sha
  default_branch=$(gh api "repos/$GITHUB_REPOSITORY" --jq '.default_branch') || return 1
  [[ "$TARGET_BRANCH" == "$default_branch" ]] || {
    echo "Publicação permitida somente na branch principal ($default_branch)" >&2; return 1;
  }
  remote_sha=$(gh api "repos/$GITHUB_REPOSITORY/git/ref/heads/$TARGET_BRANCH" --jq '.object.sha') || return 1
  [[ "$remote_sha" == "$GITHUB_SHA" ]] || {
    echo 'SHA remoto da branch principal diverge do checkout' >&2; return 1;
  }

  gate_dir=$(mktemp -d)
  snapshot_path="$gate_dir/pr-policy.json"
  report_path="$gate_dir/version-report.json"
  input_path="$gate_dir/policy-input.json"
  policy_path="$gate_dir/release-policy.json"
  associated=$(gh api "repos/$GITHUB_REPOSITORY/commits/$GITHUB_SHA/pulls?per_page=100") || return 1
  version_pr_number=$(node -e '
    const items=JSON.parse(process.argv[1]);const sha=process.argv[2],target=process.argv[3];
    const matches=items.filter(p=>p.merged_at&&p.merge_commit_sha===sha&&p.base?.ref===target&&
      /^versioning\/standard-version\//.test(p.head?.ref??""));
    if(matches.length>1)process.exit(1);
    if(matches.length)process.stdout.write(String(matches[0].number));
  ' "$associated" "$GITHUB_SHA" "$TARGET_BRANCH") || return 1
  PUBLISH_PHASE=functional
  if [[ -n "$version_pr_number" ]]; then
    [[ "$ADAPTER" == standard-version ]] || { echo 'PR de versão não corresponde ao adaptador' >&2; return 1; }
    REQUIRE_MERGED=1 bash "$script_dir/validate-version-pr.sh" "$version_pr_number" \
      "$report_path" "$snapshot_path" "$gate_dir/version-pr-context.json" || return 1
    PUBLISH_PHASE=version-pr
  else
    bash "$script_dir/collect-pr-policy.sh" --commit "$GITHUB_SHA" "$snapshot_path" || return 1
    bash "$script_dir/collect-version-report.sh" "$report_path" || return 1
  fi
  expected_report_sha=$(node -p 'JSON.parse(require("node:fs").readFileSync(process.argv[1],"utf8")).sha' \
    "$(as_node_path "$report_path")") || return 1
  node -e '
    const fs=require("node:fs");
    const report=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
    const snapshot=JSON.parse(fs.readFileSync(process.argv[2],"utf8"));
    if(!(snapshot.headBranch==="develop"||/^hotfix\/.+$/.test(snapshot.headBranch??""))||snapshot.baseBranch!==process.argv[4]||
      !snapshot.mergedAt||snapshot.mergeCommitSha!==process.argv[3]) process.exit(1);
    fs.writeFileSync(process.argv[5],JSON.stringify({report,snapshot,phase:"publication"},null,2)+"\n");
  ' "$(as_node_path "$report_path")" "$(as_node_path "$snapshot_path")" "$expected_report_sha" \
    "$TARGET_BRANCH" "$(as_node_path "$input_path")" || {
      echo 'Commit não corresponde a um PR integrado develop ou hotfix/<nome> → branch principal' >&2; return 1;
    }
  node "$script_dir/release-policy.mjs" evaluate "$(as_node_path "$input_path")" \
    "$(as_node_path "$policy_path")" || return 1
  outcome=$(node -p 'JSON.parse(require("node:fs").readFileSync(process.argv[1],"utf8")).outcome' \
    "$(as_node_path "$policy_path")") || return 1
  [[ "$outcome" != blocked ]] || {
    cat "$policy_path" >&2
    echo 'Política de release bloqueou a publicação' >&2
    return 1
  }

  VERSION_REPORT_PATH="$report_path"
  PR_POLICY_PATH="$snapshot_path"
  RELEASE_POLICY_PATH="$policy_path"
  ORIGIN_SHA="$expected_report_sha"
  VERSION_PR_NUMBER="$version_pr_number"
  export VERSION_REPORT_PATH PR_POLICY_PATH RELEASE_POLICY_PATH RELEASE_GATES_VALIDATED=1 \
    PUBLISH_PHASE ORIGIN_SHA VERSION_PR_NUMBER
}
