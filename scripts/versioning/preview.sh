#!/usr/bin/env bash
set -euo pipefail

script_dir=$(CDPATH='' cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
source "$script_dir/resolve-adapter.sh"
: "${GITHUB_EVENT_PATH:?GITHUB_EVENT_PATH obrigatório}"
: "${GITHUB_REPOSITORY:?GITHUB_REPOSITORY obrigatório}"
: "${TARGET_BRANCH:?TARGET_BRANCH obrigatório}"
: "${ADAPTER:?ADAPTER obrigatório}"
[[ "$TARGET_BRANCH" =~ ^[A-Za-z0-9_.\/-]+$ ]] || { echo 'target_branch inválida' >&2; exit 1; }

event_json=$(node -e '
  const event=JSON.parse(require("node:fs").readFileSync(process.argv[1],"utf8")), pr=event.pull_request;
  if(!Number.isInteger(pr?.number)||!pr.head?.sha||!pr.head?.ref||!pr.base?.ref||!pr.base?.sha){
    console.error("Evento pull_request inválido");process.exit(1)}
  const target=process.argv[2]; let phase;
  if(pr.base.ref==="develop"&&pr.head.ref!=="develop") phase="release-to-develop";
  else if(pr.head.ref==="develop"&&pr.base.ref===target) phase="develop-to-main";
  else {console.error(`Transição de PR não suportada: ${pr.head.ref} -> ${pr.base.ref}`);process.exit(1)}
  process.stdout.write(JSON.stringify({number:pr.number,headSha:pr.head.sha,baseSha:pr.base.sha,phase}));
' "$(as_node_path "$GITHUB_EVENT_PATH")" "$TARGET_BRANCH")
read_event() { node -p 'JSON.parse(process.argv[1])[process.argv[2]]' "$event_json" "$1"; }
pr_number=$(read_event number)
head_sha=$(read_event headSha)
base_sha=$(read_event baseSha)
phase=$(read_event phase)

cd "${GITHUB_WORKSPACE:-$(pwd)}"
[[ "$(git rev-parse HEAD)" == "$head_sha" ]] || { echo 'Checkout não corresponde ao HEAD atual do PR' >&2; exit 1; }
export GITHUB_SHA="$head_sha"

output_dir="${VERSIONING_OUTPUT_DIR:-${RUNNER_TEMP:-$(pwd)}/versioning}"
mkdir -p -- "$output_dir"
report_path="$output_dir/version-report.json"
snapshot_path="$output_dir/pr-policy.json"
policy_input="$output_dir/policy-input.json"
policy_output="$output_dir/release-policy.json"

bash "$script_dir/collect-version-report.sh" "$report_path"
bash "$script_dir/collect-pr-policy.sh" "$pr_number" "$snapshot_path"
version=$(node -p 'JSON.parse(require("node:fs").readFileSync(process.argv[1],"utf8")).candidateVersion' "$(as_node_path "$report_path")")
bump=$(node -p 'JSON.parse(require("node:fs").readFileSync(process.argv[1],"utf8")).bump' "$(as_node_path "$report_path")")
policy_outcome=not-applicable

if [[ "$phase" == release-to-develop ]]; then
  git log --no-merges --format=%s "$base_sha..$head_sha" >"$output_dir/changes.txt"
  gh api "repos/$GITHUB_REPOSITORY/commits/$head_sha/check-runs?per_page=100" --paginate --slurp \
    -H 'Accept: application/vnd.github+json' -H 'X-GitHub-Api-Version: 2022-11-28' >"$output_dir/checks.json"
  node -e '
    const fs=require("node:fs"), snapshot=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
    snapshot.changes=fs.readFileSync(process.argv[2],"utf8").split(/\r?\n/).filter(Boolean);
    snapshot.checks=JSON.parse(fs.readFileSync(process.argv[3],"utf8")).flat().map(c=>({name:c.name,status:c.status,conclusion:c.conclusion??null}));
    snapshot.suggestedChecks=[{id:"smoke",description:"Validate the changed application paths",status:"pending"}];
    fs.writeFileSync(process.argv[1],JSON.stringify(snapshot,null,2)+"\n");
  ' "$(as_node_path "$snapshot_path")" "$(as_node_path "$output_dir/changes.txt")" \
    "$(as_node_path "$output_dir/checks.json")"
  node "$script_dir/homologation-guide.mjs" "$(as_node_path "$report_path")" \
    "$(as_node_path "$snapshot_path")" "$(as_node_path "$output_dir")" >"$output_dir/summary.md"
  if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then cat "$output_dir/summary.md" >>"$GITHUB_STEP_SUMMARY"; fi
  artifact_limit="${VERSIONING_ARTIFACT_MAX_BYTES:-10737418240}"
  [[ "$artifact_limit" =~ ^[1-9][0-9]*$ ]] || { echo 'VERSIONING_ARTIFACT_MAX_BYTES inválido' >&2; exit 1; }
  artifact_bytes=$(node -e '
    const fs=require("node:fs");
    process.stdout.write(String(process.argv.slice(1).reduce((total,path)=>total+fs.statSync(path).size,0)));
  ' "$(as_node_path "$output_dir/homologation.md")" "$(as_node_path "$output_dir/homologation.json")")
  [[ "$artifact_bytes" -le "$artifact_limit" ]] || {
    echo "Artifacts de homologação somam $artifact_bytes bytes e excedem o limite de $artifact_limit bytes; o step summary foi preservado" >&2
    exit 1
  }
  summary="Versão candidata $version; guia de homologação gerado"
else
  node -e '
    const fs=require("node:fs");
    fs.writeFileSync(process.argv[3],JSON.stringify({report:JSON.parse(fs.readFileSync(process.argv[1],"utf8")),
      snapshot:JSON.parse(fs.readFileSync(process.argv[2],"utf8"))},null,2)+"\n");
  ' "$(as_node_path "$report_path")" "$(as_node_path "$snapshot_path")" "$(as_node_path "$policy_input")"
  node "$script_dir/release-policy.mjs" evaluate "$(as_node_path "$policy_input")" "$(as_node_path "$policy_output")"
  policy_outcome=$(node -p 'JSON.parse(require("node:fs").readFileSync(process.argv[1],"utf8")).outcome' "$(as_node_path "$policy_output")")
  [[ "$policy_outcome" != blocked ]] || { cat "$policy_output" >&2; exit 1; }
  summary="Política de release $policy_outcome para a versão $version"
fi

if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
  printf 'phase=%s\nversion=%s\nbump=%s\npolicy_outcome=%s\nsummary=%s\n' \
    "$phase" "$version" "$bump" "$policy_outcome" "$summary" >>"$GITHUB_OUTPUT"
fi
printf '%s\n' "$summary"
