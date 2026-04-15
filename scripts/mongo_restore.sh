#!/usr/bin/env bash
# Restore a mongodump into the MongoDB instance from MONGO_URL.
#
# Usage (directory dump):
#   ./scripts/mongo_restore.sh /path/to/mongo_dump_20260101_120000
#   ./scripts/mongo_restore.sh --drop --yes /path/to/dump   # replaces collections (destructive)
#
# Usage (gzip archive from mongo_backup.sh -a):
#   ./scripts/mongo_restore.sh --archive /path/to/prawn_erp.archive.gz
#   ./scripts/mongo_restore.sh --drop --yes --archive file.gz
#
# After restore, point backend/.env and super-admin-api/.env MONGO_URL at this MongoDB
# and restart backend (8000), super-admin-api (8002), and frontend.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
# shellcheck source=scripts/_mongo_tools.sh
source "$SCRIPT_DIR/_mongo_tools.sh"

DROP=0
YES=0
ARCHIVE=""

usage() {
  echo "Usage:"
  echo "  $0 [--drop --yes] DUMP_DIR"
  echo "  $0 [--drop --yes] --archive FILE.gz"
  echo "Restore mongodump output into MONGO_URL."
  echo ""
  echo "Options:"
  echo "  --archive FILE   Restore from mongodump gzip archive"
  echo "  --drop           Drop collections before restore (needs --yes)"
  echo "  --yes            Confirm destructive --drop"
  echo "  -h               Help"
}

ARGS=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --archive) ARCHIVE="$2"; shift 2 ;;
    --drop) DROP=1; shift ;;
    --yes) YES=1; shift ;;
    -h) usage; exit 0 ;;
    *) ARGS+=("$1"); shift ;;
  esac
done

prawn_erp_require_cmd mongorestore

URI="$(prawn_erp_resolve_mongo_url "$ROOT" || true)"
if [[ -z "${URI:-}" ]]; then
  echo "Error: MONGO_URL not set and not found in backend/.env or super-admin-api/.env" >&2
  exit 1
fi

if [[ "$DROP" -eq 1 && "$YES" -ne 1 ]]; then
  echo "Error: --drop is destructive; add --yes to confirm." >&2
  exit 2
fi

if [[ -n "$ARCHIVE" ]]; then
  [[ -f "$ARCHIVE" ]] || { echo "Error: archive not found: $ARCHIVE" >&2; exit 1; }
  echo "mongorestore <- archive: $ARCHIVE"
  if [[ "$DROP" -eq 1 ]]; then
    mongorestore --uri="$URI" --drop --gzip --archive="$ARCHIVE"
  else
    mongorestore --uri="$URI" --gzip --archive="$ARCHIVE"
  fi
  echo "Done."
  exit 0
fi

if [[ ${#ARGS[@]} -ne 1 ]]; then
  usage
  exit 2
fi

DUMP_DIR="${ARGS[0]}"
[[ -d "$DUMP_DIR" ]] || { echo "Error: not a directory: $DUMP_DIR" >&2; exit 1; }

# mongodump -o DIR creates DIR/<dbname>/... ; mongorestore wants the parent that contains db folders
echo "mongorestore <- $DUMP_DIR"
if [[ "$DROP" -eq 1 ]]; then
  mongorestore --uri="$URI" --drop "$DUMP_DIR"
else
  mongorestore --uri="$URI" "$DUMP_DIR"
fi
echo "Done."
