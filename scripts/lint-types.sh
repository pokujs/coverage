#!/usr/bin/env bash
set -euo pipefail

repositoryRoot="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

violations=""

for directory in src test; do
  hits="$(
    grep -rE '^(export )?type [A-Z]' \
      "$repositoryRoot/$directory" \
      --include='*.ts' \
      | grep -v '/@types/' \
      || true
  )"

  if [[ -n "$hits" ]]; then
    violations="${violations}${hits}"$'\n'
  fi
done

if [[ -n "$violations" ]]; then
  echo "Forbidden type declarations found outside @types/:" >&2
  printf '%s' "$violations" >&2
  exit 1
fi
