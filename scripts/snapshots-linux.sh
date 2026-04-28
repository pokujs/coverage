#!/usr/bin/env bash
set -euo pipefail

repositoryRoot="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
archivePath="$repositoryRoot/snapshots-linux.zip"
snapshotsRoot="$repositoryRoot/test/__snapshots__/e2e"

if [[ ! -f "$archivePath" ]]; then
  echo "snapshots-linux.zip not found at $archivePath" >&2
  exit 1
fi

extractionDir="$(mktemp -d)"
trap 'rm -rf "$extractionDir"' EXIT

unzip -o "$archivePath" -d "$extractionDir" >/dev/null

nestedRoot="$extractionDir/test/__snapshots__/e2e"
sourceRoot="$extractionDir"
[[ -d "$nestedRoot" ]] && sourceRoot="$nestedRoot"

find "$sourceRoot" -type d -name linux -print0 | while IFS= read -r -d '' linuxDir; do
  reporterRuntime="${linuxDir%/linux}"
  reporterRuntimeRelative="${reporterRuntime#"$sourceRoot/"}"
  destination="$snapshotsRoot/$reporterRuntimeRelative/linux"

  mkdir -p "$destination"
  rm -rf "$destination"
  mkdir -p "$(dirname "$destination")"
  cp -R "$linuxDir" "$destination"
done

rm "$archivePath"

npm run postbuild:snapshots
