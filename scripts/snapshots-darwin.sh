#!/usr/bin/env bash
set -euo pipefail

repositoryRoot="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
archivePath="$repositoryRoot/snapshots-darwin.zip"
snapshotsRoot="$repositoryRoot/test/__snapshots__/e2e"

if [[ ! -f "$archivePath" ]]; then
  echo "snapshots-darwin.zip not found at $archivePath" >&2
  exit 1
fi

extractionDir="$(mktemp -d)"
trap 'rm -rf "$extractionDir"' EXIT

unzip -o "$archivePath" -d "$extractionDir" >/dev/null

nestedRoot="$extractionDir/test/__snapshots__/e2e"
sourceRoot="$extractionDir"
[[ -d "$nestedRoot" ]] && sourceRoot="$nestedRoot"

find "$sourceRoot" -type d -name darwin -print0 | while IFS= read -r -d '' darwinDir; do
  reporterRuntime="${darwinDir%/darwin}"
  reporterRuntimeRelative="${reporterRuntime#"$sourceRoot/"}"
  destination="$snapshotsRoot/$reporterRuntimeRelative/darwin"

  mkdir -p "$destination"
  rm -rf "$destination"
  mkdir -p "$(dirname "$destination")"
  cp -R "$darwinDir" "$destination"
done

rm "$archivePath"

npm run postbuild:snapshots
