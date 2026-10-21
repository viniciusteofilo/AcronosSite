#!/usr/bin/env bash
# Restore drill: restores a backup into a SCRATCH database and compares row counts with the source.
# Usage: SOURCE_URL=postgres://.../acronos SCRATCH_URL=postgres://.../acronos_restore_check scripts/restore-check.sh backups/file.dump
# The scratch database must be empty or disposable: it is wiped first. Never point SCRATCH_URL at production.
set -euo pipefail
: "${SOURCE_URL:?Set SOURCE_URL}" "${SCRATCH_URL:?Set SCRATCH_URL}"
file="${1:?Pass the .dump file}"
case "$SCRATCH_URL" in *restore*|*scratch*|*test*) ;; *) echo "Refusing: SCRATCH_URL must contain restore, scratch or test"; exit 1;; esac
sha256sum --check "$file.sha256"
psql "$SCRATCH_URL" -q -c "DROP SCHEMA IF EXISTS public CASCADE; DROP SCHEMA IF EXISTS drizzle CASCADE; CREATE SCHEMA public;"
pg_restore --no-owner --no-privileges --dbname="$SCRATCH_URL" "$file"
count_sql="SELECT string_agg(t || '=' || n, ' ' ORDER BY t) FROM (SELECT relname AS t, (xpath('/row/c/text()', query_to_xml('SELECT count(*) AS c FROM public.' || quote_ident(relname), false, true, '')))[1]::text::int AS n FROM pg_stat_user_tables WHERE schemaname = 'public') s"
src=$(psql "$SOURCE_URL" -At -c "$count_sql")
dst=$(psql "$SCRATCH_URL" -At -c "$count_sql")
if [ "$src" = "$dst" ]; then echo "Restore OK: row counts match for every table."; else echo "MISMATCH"; diff <(tr ' ' '\n' <<<"$src") <(tr ' ' '\n' <<<"$dst") || true; exit 1; fi
