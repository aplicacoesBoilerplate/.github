#!/usr/bin/env bash
# Shared validation; source this file from preview and publish scripts.
set -euo pipefail

as_node_path() {
  if command -v cygpath >/dev/null 2>&1; then
    cygpath -w "$1"
  else
    printf '%s\n' "$1"
  fi
}

select_adapter() {
  local adapter="$1" project_path="${2:-.}" workspace="${GITHUB_WORKSPACE:-$(pwd)}"
  local root
  root=$(realpath "$workspace")
  [[ "$project_path" != /* && "$project_path" != *'..'* ]] || {
    echo 'project_path deve ser relativo e não pode conter ..' >&2; return 1;
  }
  PROJECT_DIR=$(realpath "$root/$project_path")
  [[ "$PROJECT_DIR" == "$root" || "$PROJECT_DIR" == "$root/"* ]] || {
    echo 'project_path fora do repositório consumidor' >&2; return 1;
  }
  [[ -d "$PROJECT_DIR" ]] || { echo "Projeto inexistente: $project_path" >&2; return 1; }

  case "$adapter" in
    standard-version|changesets)
      [[ -f "$PROJECT_DIR/package.json" ]] || { echo "Falta package.json em $project_path" >&2; return 1; }
      local binary=standard-version
      [[ "$adapter" == changesets ]] && binary=changeset
      if [[ -x "$root/node_modules/.bin/$binary" ]]; then
        ADAPTER_BIN="$root/node_modules/.bin/$binary"
      elif [[ -x "$PROJECT_DIR/node_modules/.bin/$binary" ]]; then
        ADAPTER_BIN="$PROJECT_DIR/node_modules/.bin/$binary"
      else
        echo "Instale $binary nas dependências do consumidor antes da análise" >&2; return 1
      fi
      if [[ "$adapter" == changesets ]]; then
        [[ -f "$root/.changeset/config.json" ]] || {
          echo 'Falta .changeset/config.json no repositório consumidor' >&2; return 1;
        }
      fi
      ;;
    jgitver)
      [[ -f "$PROJECT_DIR/pom.xml" && -f "$PROJECT_DIR/.mvn/extensions.xml" ]] || {
        echo 'jgitver requer pom.xml e .mvn/extensions.xml no módulo selecionado' >&2; return 1;
      }
      if [[ -f "$PROJECT_DIR/mvnw" ]]; then
        ADAPTER_BIN="$PROJECT_DIR/mvnw"
      elif command -v mvn >/dev/null 2>&1; then
        ADAPTER_BIN=$(command -v mvn)
      else
        echo 'Instale Maven ou inclua Maven Wrapper no consumidor' >&2; return 1
      fi
      ;;
    go-gitsemver)
      command -v go-gitsemver >/dev/null 2>&1 || {
        echo 'Instale go-gitsemver no consumidor (binário fixado pelo caller)' >&2; return 1;
      }
      ADAPTER_BIN=$(command -v go-gitsemver)
      ;;
    *) echo "Adapter não suportado: $adapter" >&2; return 1 ;;
  esac
  export PROJECT_DIR ADAPTER_BIN
}
