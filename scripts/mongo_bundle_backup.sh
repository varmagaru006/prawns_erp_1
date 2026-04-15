#!/usr/bin/env bash
# Full portable backup: MongoDB dump + backend/uploads + MANIFEST, as one .tar.gz under backups/.
#
# Usage:
#   ./scripts/mongo_bundle_backup.sh
#
# On the other machine:
#   tar xzf prawn_erp_bundle_*.tar.gz
#   ./scripts/mongo_restore.sh prawn_erp_bundle_*/mongodb_dump
#   cp -a prawn_erp_bundle_*/uploads/* backend/uploads/   # if you use file uploads

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
# shellcheck source=scripts/_mongo_tools.sh
source "$SCRIPT_DIR/_mongo_tools.sh"

STAMP=$(date +%Y%m%d_%H%M%S)
BUNDLE_NAME="prawn_erp_bundle_$STAMP"
BACKUPS="$ROOT/backups"
BUNDLE_DIR="$BACKUPS/$BUNDLE_NAME"

mkdir -p "$BACKUPS"
mkdir -p "$BUNDLE_DIR"

echo "== MongoDB dump =="
"$SCRIPT_DIR/mongo_backup.sh" -o "$BUNDLE_DIR/mongodb_dump"

echo "== Uploads (backend/uploads) =="
if [[ -d "$ROOT/backend/uploads" ]] && [[ -n "$(ls -A "$ROOT/backend/uploads" 2>/dev/null || true)" ]]; then
  cp -a "$ROOT/backend/uploads/." "$BUNDLE_DIR/uploads/"
else
  mkdir -p "$BUNDLE_DIR/uploads"
  echo "No files in backend/uploads on this machine (skipped)." > "$BUNDLE_DIR/uploads/README.txt"
fi

{
  echo "bundle_created_utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "hostname=$(hostname 2>/dev/null || echo unknown)"
  echo "repo_hint=prawns_erp_1"
  echo ""
  echo "Restore on target:"
  echo "  1. tar xzf ${BUNDLE_NAME}.tar.gz"
  echo "  2. Set MONGO_URL in backend/.env and super-admin-api/.env to target MongoDB"
  echo "  3. scripts/mongo_restore.sh ${BUNDLE_NAME}/mongodb_dump"
  echo "  4. Optional: cp -a ${BUNDLE_NAME}/uploads/* backend/uploads/"
} > "$BUNDLE_DIR/MANIFEST.txt"

ARCHIVE="$BACKUPS/${BUNDLE_NAME}.tar.gz"
echo "== Creating $ARCHIVE =="
tar -czf "$ARCHIVE" -C "$BACKUPS" "$BUNDLE_NAME"
echo "Done: $ARCHIVE"
echo "Copy that file to the other laptop, extract, and follow MANIFEST.txt inside the bundle."
