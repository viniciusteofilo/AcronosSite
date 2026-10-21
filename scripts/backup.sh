#!/usr/bin/env bash
# Logical backup of the database (custom format, compressed).
# Usage: DATABASE_URL=postgres://... scripts/backup.sh [output-dir]
# Neon also keeps point-in-time history; this file is the extra, provider-independent copy.
set -euo pipefail
: "${DATABASE_URL:?Set DATABASE_URL}"
out_dir="${1:-backups}"
mkdir -p "$out_dir"
file="$out_dir/acronos-$(date -u +%Y%m%dT%H%M%SZ).dump"
pg_dump --format=custom --no-owner --no-privileges --file="$file" "$DATABASE_URL"
sha256sum "$file" > "$file.sha256"
echo "Backup written: $file ($(du -h "$file" | cut -f1))"
