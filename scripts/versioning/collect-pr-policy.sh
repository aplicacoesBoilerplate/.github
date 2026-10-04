#!/usr/bin/env bash
set -euo pipefail

script_dir=$(CDPATH='' cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
source "$script_dir/resolve-adapter.sh"
: "${GITHUB_REPOSITORY:?GITHUB_REPOSITORY obrigatório}"
: "${GH_TOKEN:?GH_TOKEN obrigatório}"
: "${TARGET_BRANCH:?TARGET_BRANCH obrigatório}"

api() {
  gh api "$@" -H 'Accept: application/vnd.github+json' -H 'X-GitHub-Api-Version: 2022-11-28'
}

tmp_dir=$(mktemp -d)
cleanup() { rm -rf -- "$tmp_dir"; }
trap cleanup EXIT

if [[ "${1:-}" == --commit ]]; then
  sha="${2:?SHA obrigatório}"
  output_path="${3:?Arquivo de saída obrigatório}"
  api "repos/$GITHUB_REPOSITORY/commits/$sha/pulls?per_page=100" --paginate --slurp >"$tmp_dir/associated.json"
  pr_number=$(node -e '
    const pages=JSON.parse(require("node:fs").readFileSync(process.argv[1],"utf8"));
    const sha=process.argv[2], target=process.argv[3];
    const matches=pages.flat().filter(p=>(p.head?.ref==="develop"||/^hotfix\/.+$/.test(p.head?.ref??""))&&p.base?.ref===target&&
      p.merged_at&&p.merge_commit_sha===sha);
    if(matches.length!==1){console.error(`Associação ambígua: ${matches.length} PRs integrados (develop ou hotfix/<nome>) -> ${target}`);process.exit(1)}
    process.stdout.write(String(matches[0].number));
  ' "$(as_node_path "$tmp_dir/associated.json")" "$sha" "$TARGET_BRANCH")
else
  pr_number="${1:?Número do PR obrigatório}"
  output_path="${2:?Arquivo de saída obrigatório}"
  [[ "$pr_number" =~ ^[1-9][0-9]*$ ]] || { echo 'Número de PR inválido' >&2; exit 1; }
fi

api "repos/$GITHUB_REPOSITORY/pulls/$pr_number" >"$tmp_dir/pr.json"
api "repos/$GITHUB_REPOSITORY/issues/$pr_number/timeline?per_page=100" --paginate --slurp >"$tmp_dir/timeline.json"
api "repos/$GITHUB_REPOSITORY/pulls/$pr_number/reviews?per_page=100" --paginate --slurp >"$tmp_dir/reviews.json"

node -e '
  const fs=require("node:fs");
  const timeline=JSON.parse(fs.readFileSync(process.argv[1],"utf8")).flat()
    .sort((a,b)=>String(a.created_at).localeCompare(String(b.created_at)));
  const reviews=JSON.parse(fs.readFileSync(process.argv[2],"utf8")).flat();
  let active=null;
  for(const event of timeline){
    if(event.label?.name!=="versioning:override") continue;
    if(event.event==="labeled") active=event;
    else if(event.event==="unlabeled") active=null;
  }
  const users=new Set(); if(active?.actor?.login) users.add(active.actor.login);
  for(const review of reviews) if(review.state==="APPROVED"&&review.user?.login) users.add(review.user.login);
  if(users.size) process.stdout.write([...users].join("\n")+"\n");
' "$(as_node_path "$tmp_dir/timeline.json")" "$(as_node_path "$tmp_dir/reviews.json")" >"$tmp_dir/users.txt"

: >"$tmp_dir/roles.jsonl"
while IFS= read -r user; do
  [[ -n "$user" ]] || continue
  api "repos/$GITHUB_REPOSITORY/collaborators/$user/permission" >"$tmp_dir/permission.json"
  node -e '
    const fs=require("node:fs"), login=process.argv[2];
    const value=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
    if(typeof value.role_name!=="string"){console.error(`role_name ausente para ${login}`);process.exit(1)}
    process.stdout.write(JSON.stringify({login,role_name:value.role_name.toLowerCase()})+"\n");
  ' "$(as_node_path "$tmp_dir/permission.json")" "$user" >>"$tmp_dir/roles.jsonl"
done <"$tmp_dir/users.txt"

node -e '
  const fs=require("node:fs");
  const [prPath,timelinePath,reviewsPath,rolesPath,repository,outputPath]=process.argv.slice(1);
  const pr=JSON.parse(fs.readFileSync(prPath,"utf8"));
  const timeline=JSON.parse(fs.readFileSync(timelinePath,"utf8")).flat()
    .sort((a,b)=>String(a.created_at).localeCompare(String(b.created_at)));
  const reviews=JSON.parse(fs.readFileSync(reviewsPath,"utf8")).flat();
  const roles=new Map(fs.readFileSync(rolesPath,"utf8").split(/\r?\n/).filter(Boolean)
    .map(line=>{const item=JSON.parse(line);return [item.login,item.role_name]}));
  let label=null;
  for(const event of timeline){
    if(event.label?.name!=="versioning:override") continue;
    if(event.event==="labeled") label=event;
    else if(event.event==="unlabeled") label=null;
  }
  const authorized=new Set(["maintain","admin"]);
  const effectiveReviews=new Map();
  reviews.sort((a,b)=>String(a.submitted_at).localeCompare(String(b.submitted_at)))
    .forEach(review=>{if(review.user?.login) effectiveReviews.set(review.user.login,review)});
  const approvals=label ? [...effectiveReviews.values()].filter(review=>review.state==="APPROVED" &&
    review.commit_id===pr.head?.sha && Date.parse(review.submitted_at)>Date.parse(label.created_at) &&
    review.user?.login!==label.actor?.login && authorized.has(roles.get(review.user?.login)))
    .sort((a,b)=>String(a.submitted_at).localeCompare(String(b.submitted_at))) : [];
  const approval=approvals.at(-1)??null;
  const snapshot={repository,number:pr.number,headSha:pr.head?.sha,headBranch:pr.head?.ref,
    baseBranch:pr.base?.ref,mergedAt:pr.merged_at??null,mergeCommitSha:pr.merge_commit_sha??null,
    milestone:pr.milestone?{title:pr.milestone.title}:null,override:{
      labelPresent:Boolean(label),labeledBy:label?.actor?.login??null,labeledAt:label?.created_at??null,
      labelerRole:label?roles.get(label.actor?.login)??null:null,
      approvalBy:approval?.user?.login??null,approvedAt:approval?.submitted_at??null,
      approverRole:approval?roles.get(approval.user.login)??null:null,
      reviewedCommitSha:approval?.commit_id??null}};
  if(!Number.isInteger(snapshot.number)||!snapshot.headSha||!snapshot.headBranch||!snapshot.baseBranch){
    throw new Error("Resposta de pull request incompleta");
  }
  fs.writeFileSync(outputPath,JSON.stringify(snapshot,null,2)+"\n");
' "$(as_node_path "$tmp_dir/pr.json")" "$(as_node_path "$tmp_dir/timeline.json")" \
  "$(as_node_path "$tmp_dir/reviews.json")" "$(as_node_path "$tmp_dir/roles.jsonl")" \
  "$GITHUB_REPOSITORY" "$(as_node_path "$output_path")"
