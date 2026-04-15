#!/usr/bin/env bash
# Dump all MongoDB databases reachable via MONGO_URL (full instance dump).
# Includes prawn_erp, prawn_erp_super_admin, prawn_erp_<tenant>, etc.
#
# Usage:
#   ./scripts/mongo_backup.sh
#   ./scripts/mongo_backup.sh -o /path/to/out
#   ./scripts/mongo_backup.sh -a ~/Desktop/prawn_erp.archive.gz
#
# MONGO_URL is read from the environment, or from backend/.env, then super-admin-api/.env.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
# shellcheck source=scripts/_mongo_tools.sh
source "$SCRIPT_DIR/_mongo_tools.sh"

OUT_DIR=""
ARCHIVE=""

usage() {
  echo "Usage: $0 [-o DIR | -a FILE.gz] [-h]"
  echo "Dump all databases from MONGO_URL (full instance dump)."
  echo ""
  echo "Options:"
  echo "  -o DIR       Output directory (mongodump classic layout)"
  echo "  -a FILE.gz   Single gzip archive (portable; good for USB/cloud copy)"
  echo "  -h           Help"
}

while getopts ":o:a:h" opt; do
  case "$opt" in
    o) OUT_DIR="$OPTARG" ;;
    a) ARCHIVE="$OPTARG" ;;
    h) usage; exit 0 ;;
    *) usage; exit 2 ;;
  esac
done

prawn_erp_require_cmd mongodump

URI="$(prawn_erp_resolve_mongo_url "$ROOT" || true)"
if [[ -z "${URI:-}" ]]; then
  echo "Error: MONGO_URL not set and not found in backend/.env or super-admin-api/.env" >&2
  echo "Set MONGO_URL or create backend/.env (see run_all.sh / CREDENTIALS.md)." >&2
  exit 1
fi

if [[ -n "$ARCHIVE" && -n "$OUT_DIR" ]]; then
  echo "Error: use only one of -o or -a" >&2
  exit 2
fi

if [[ -n "$ARCHIVE" ]]; then
  mkdir -p "$(dirname "$ARCHIVE")"
  echo "mongodump -> archive: $ARCHIVE"
  mongodump --uri="$URI" --gzip --archive="$ARCHIVE"
  echo "Done."
  exit 0
fi

if [[ -z "$OUT_DIR" ]]; then
  mkdir -p "$ROOT/backups"
  OUT_DIR="$ROOT/backups/mongo_dump_$(date +%Y%m%d_%H%M%S)"
fi

mkdir -p "$OUT_DIR"
echo "mongodump -> $OUT_DIR"
mongodump --uri="$URI" -o "$OUT_DIR"
echo "Done. Copy this folder to the other machine and run:"
echo "  $SCRIPT_DIR/mongo_restore.sh \"$OUT_DIR\""
