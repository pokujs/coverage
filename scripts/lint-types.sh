#!/usr/bin/env bash
set -euo pipefail

repositoryRoot="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

violations="$(grep -rE '^(export )?type [A-Z]' "$repositoryRoot/src" --include='*.ts' | grep -v 'src/@types/' || true)"

if [[ -n "$violations" ]]; then
  echo "Forbidden type declarations found outside src/@types/:" >&2
  echo "$violations" >&2
  exit 1
fi
