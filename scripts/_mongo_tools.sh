#!/usr/bin/env bash
# Shared helpers for mongo_backup.sh / mongo_restore.sh (source this file; do not run directly).

# Read first MONGO_URL= line from a dotenv file (strips quotes / CR).
prawn_erp_read_mongo_url_from_file() {
  local f="$1"
  [[ -f "$f" ]] || return 1
  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ "$line" =~ ^[[:space:]]*# ]] && continue
    [[ -z "${line//[[:space:]]/}" ]] && continue
    if [[ "$line" =~ ^[[:space:]]*MONGO_URL[[:space:]]*=[[:space:]]*(.*)$ ]]; then
      local val="${BASH_REMATCH[1]}"
      val="${val%$'\r'}"
      val="${val#\"}"
      val="${val%\"}"
      val="${val#\'}"
      val="${val%\'}"
      val="${val%%#*}"
      val="${val%"${val##*[![:space:]]}"}"
      printf '%s' "$val"
      return 0
    fi
  done < "$f"
  return 1
}

# Resolve MONGO_URL: env first, then backend/.env, then super-admin-api/.env.
prawn_erp_resolve_mongo_url() {
  local root="$1"
  local url=""
  if [[ -n "${MONGO_URL:-}" ]]; then
    printf '%s' "$MONGO_URL"
    return 0
  fi
  url="$(prawn_erp_read_mongo_url_from_file "$root/backend/.env" || true)"
  if [[ -n "$url" ]]; then
    printf '%s' "$url"
    return 0
  fi
  url="$(prawn_erp_read_mongo_url_from_file "$root/super-admin-api/.env" || true)"
  if [[ -n "$url" ]]; then
    printf '%s' "$url"
    return 0
  fi
  return 1
}

prawn_erp_require_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "Error: '$1' not found. Install MongoDB Database Tools: https://www.mongodb.com/try/download/database-tools" >&2
    exit 1
  }
}
