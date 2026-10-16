#!/usr/bin/env bash
# Path conversion only; independent of adapter selection.
as_node_path() {
  if command -v cygpath >/dev/null 2>&1; then cygpath -w "$1"; else printf '%s\n' "$1"; fi
}
