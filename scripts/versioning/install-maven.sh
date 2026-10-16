#!/usr/bin/env bash
set -euo pipefail
: "${RUNNER_TEMP:?RUNNER_TEMP obrigatório}"
: "${GITHUB_PATH:?GITHUB_PATH obrigatório}"
archive=$(mktemp)
trap 'rm -f -- "$archive"' EXIT
curl --fail --silent --show-error --location \
  https://archive.apache.org/dist/maven/maven-3/3.9.9/binaries/apache-maven-3.9.9-bin.tar.gz -o "$archive"
printf '%s  %s\n' \
  a555254d6b53d267965a3404ecb14e53c3827c09c3b94b5678835887ab404556bfaf78dcfe03ba76fa2508649dca8531c74bca4d5846513522404d48e8c4ac8b \
  "$archive" | sha512sum --check --status
destination="$RUNNER_TEMP/central-maven-3.9.9"
mkdir -p -- "$destination"
tar -xzf "$archive" -C "$destination" --strip-components=1
printf '%s\n' "$destination/bin" >> "$GITHUB_PATH"
