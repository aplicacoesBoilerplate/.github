#!/usr/bin/env bash
set -euo pipefail

project_path=${1:?Provide the consumer project path}
mode=${2:---run}

cd "$project_path"
eval "$(direnv export bash)"

if [[ -z ${SONARQUBE_TOKEN:-} ]]; then
  echo 'SONARQUBE_TOKEN is missing from the environment' >&2
  exit 1
fi
if [[ -z ${SONARQUBE_URL:-} ]]; then
  echo 'SONARQUBE_URL is missing from the environment' >&2
  exit 1
fi
if [[ -z ${SONARQUBE_PROJECT_KEY:-} ]]; then
  echo 'SONARQUBE_PROJECT_KEY is empty after loading the project .envrc' >&2
  exit 1
fi

if [[ $mode == --check ]]; then
  printf 'MCP environment ready for project %s\n' "$SONARQUBE_PROJECT_KEY"
  exit 0
fi

exec docker run --init --rm -i \
  -e SONARQUBE_TOKEN \
  -e SONARQUBE_URL \
  -e SONARQUBE_PROJECT_KEY \
  -e SONARQUBE_READ_ONLY=true \
  sonarsource/sonarqube-mcp
